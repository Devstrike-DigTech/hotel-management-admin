"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle, CloudArrowUp, Door, Money, Scroll, WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/store";
import { naira } from "@/lib/format";
import { useFolio } from "@/lib/api/hooks-m2";
import { foliosApi } from "@/lib/api/endpoints-m2";
import { useDeskRefresh } from "@/lib/api/mutations-m2";
import type { CheckOutResult, InvoiceDocument, ReservationDetail } from "@/lib/api/types-m2";
import { isApiError } from "@/lib/api/client";
import { deskAction } from "@/lib/offline/desk-action";
import { useOnline } from "@/lib/offline/network";
import { useEntitlements } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import { openPayment } from "@/lib/store-m2";
import { useNow } from "@/lib/use-now";
import { Dialog } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/form";
import { ChipRadio, NairaInput } from "@/components/m2/bits";
import { DocumentActions } from "@/components/documents/share";

export function CheckOutDialog({
  reservation: r,
  open,
  onOpenChange,
}: {
  reservation: ReservationDetail;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const folio = useFolio(open ? r.folioId : null);
  const refresh = useDeskRefresh();
  const online = useOnline();
  const { has } = useEntitlements();
  const { can } = useCan();
  const [override, setOverride] = useState(false);
  const [reason, setReason] = useState("");
  const [done, setDone] = useState<{ invoice?: InvoiceDocument; queued?: boolean } | null>(null);
  const [refundMethod, setRefundMethod] = useState<"CASH" | "TRANSFER" | "POS">("TRANSFER");
  const [refundAmount, setRefundAmount] = useState<number | null>(null);

  const balance = folio.data?.totals.balanceKobo ?? r.balanceKobo;
  const now = useNow();
  const early = +new Date(r.departureAt) > now + 2 * 3600_000;

  const checkout = useMutation({
    mutationFn: () =>
      deskAction<CheckOutResult>({
        kind: "check-out",
        title: `Check out ${r.guest.fullName}`,
        subtitle: `${r.code}${r.room ? ` · room ${r.room.number}` : ""}`,
        method: "POST",
        path: `/reservations/${r.id}/check-out`,
        body: override ? { override: { reason: reason.trim() } } : {},
        offlineAllowed: has("offline_mode") && balance === 0,
        invalidate: [["reservations"], ["folio"]],
      }),
    onSuccess: async (res) => {
      if (res.queued) {
        setDone({ queued: true });
        return;
      }
      await refresh();
      setDone({ invoice: res.result.invoice });
      toast.success(`${r.guest.fullName} checked out`, r.room ? `Room ${r.room.number} is now dirty and on the housekeeping list.` : undefined);
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "BALANCE_OUTSTANDING") void folio.refetch();
    },
    meta: { errorTitle: "Not checked out" },
  });

  const refund = useMutation({
    mutationFn: () => foliosApi.refund(r.folioId, { method: refundMethod, amountKobo: refundAmount ?? -balance, reason: "Refund of credit at check-out" }),
    onSuccess: async () => {
      await refresh();
      await folio.refetch();
      toast.success("Refund recorded");
    },
    meta: { errorTitle: "Refund not recorded" },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setDone(null);
      }}
      eyebrow={`${r.code}${r.room ? ` · Room ${r.room.number}` : ""}`}
      title={done ? (done.queued ? "Check-out saved" : "Checked out") : `Check out ${r.guest.fullName.split(" ")[0]}`}
      className="max-w-[480px]"
    >
      {done ? (
        <div className="flex flex-col items-center gap-4 py-2 text-center">
          <span className={cn("grid h-14 w-14 place-items-center rounded-full", done.queued ? "bg-ochre-wash text-ochre" : "bg-palm-wash text-palm")}>
            {done.queued ? <CloudArrowUp size={28} weight="duotone" /> : <CheckCircle size={28} weight="duotone" />}
          </span>
          {done.invoice ? (
            <>
              <div>
                <p className="text-[14px] text-ink-muted">Final invoice</p>
                <p className="font-mono text-[22px] text-ink" data-testid="invoice-number">
                  {done.invoice.number}
                </p>
                <p className="mt-1 text-[13px] text-ink-muted">
                  Total <span className="font-mono text-ink">{naira(done.invoice.totals.totalKobo)}</span>, paid{" "}
                  <span className="font-mono text-ink">{naira(done.invoice.totals.paidKobo)}</span>
                </p>
              </div>
              <DocumentActions kind="invoice" id={done.invoice.id} className="flex flex-wrap justify-center gap-2" />
            </>
          ) : (
            <p className="text-[13.5px] text-ink-muted">Saved on this device. The invoice is issued when it syncs.</p>
          )}
          <Button onClick={() => onOpenChange(false)} className="mt-1 min-w-36">
            Done
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-baseline justify-between rounded-md border border-line bg-paper/60 px-4 py-3.5">
            <span className="text-[13px] text-ink-muted">{balance > 0 ? "Still owed" : balance < 0 ? "Guest is in credit" : "Folio balance"}</span>
            <span className={cn("font-mono text-[26px] leading-none", balance > 0 ? "text-ochre" : balance < 0 ? "text-palm" : "text-ink")}>
              {naira(Math.abs(balance))}
            </span>
          </div>
          {early && (
            <p className="flex items-start gap-2 text-[12.5px] text-ink-muted">
              <WarningCircle size={15} weight="duotone" className="mt-px shrink-0 text-brass" />
              Leaving early. Nights not yet posted will not be charged; departure moves to now.
            </p>
          )}

          {balance === 0 && (
            <>
              <p className="text-[13.5px] text-ink-muted">
                All settled. Checking out closes the folio, issues the final invoice
                {r.room ? `, and sends room ${r.room.number} to housekeeping` : ""}.
              </p>
              <Button size="lg" onClick={() => checkout.mutate()} loading={checkout.isPending} data-testid="confirm-checkout">
                {!online && has("offline_mode") ? <CloudArrowUp size={16} weight="bold" /> : <Door size={16} weight="bold" />}
                {!online && has("offline_mode") ? "Save check-out offline" : "Check out and issue invoice"}
              </Button>
            </>
          )}

          {balance > 0 && (
            <>
              <Button
                size="lg"
                onClick={() =>
                  openPayment({
                    folioId: r.folioId,
                    label: r.guest.fullName,
                    balanceKobo: balance,
                    reservationCode: r.code,
                    onDone: () => void folio.refetch(),
                  })
                }
              >
                <Money size={16} weight="bold" /> Take {naira(balance)}
              </Button>
              {can("override") ? (
                <div className="rounded-md border border-dashed border-line-strong">
                  <button
                    type="button"
                    onClick={() => setOverride((o) => !o)}
                    aria-expanded={override}
                    className="flex w-full items-center gap-2 px-4 py-3 text-left text-[13px] font-medium text-ink"
                  >
                    <Scroll size={16} weight="duotone" className="text-ochre" />
                    Let them leave owing (city ledger)
                  </button>
                  {override && (
                    <div className="flex flex-col gap-3 border-t border-dashed border-line-strong px-4 py-3">
                      <p className="text-[12.5px] text-ink-muted">
                        The balance moves to the city ledger as money owed by the guest or their company. Revenue Guard records it for
                        the owner.
                      </p>
                      <Field label="Reason" htmlFor="co-reason">
                        <Textarea id="co-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Company account, Access Bank PO 4471" className="min-h-16" />
                      </Field>
                      <Button variant="danger" onClick={() => checkout.mutate()} loading={checkout.isPending} disabled={reason.trim().length < 4}>
                        Check out owing {naira(balance)}
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[12.5px] text-ink-muted">Only a manager can check a guest out with money owing.</p>
              )}
            </>
          )}

          {balance < 0 && (
            <>
              <p className="text-[13.5px] text-ink-muted">Refund the credit before check-out, so the folio closes at zero.</p>
              {can("refund") ? (
                <div className="flex flex-col gap-3">
                  <ChipRadio
                    label="Refund method"
                    value={refundMethod}
                    onChange={setRefundMethod}
                    options={[
                      { value: "TRANSFER", label: "Transfer" },
                      { value: "CASH", label: "Cash" },
                      { value: "POS", label: "POS reversal" },
                    ]}
                  />
                  <NairaInput kobo={refundAmount ?? -balance} onChange={setRefundAmount} aria-label="Refund amount" />
                  <Button onClick={() => refund.mutate()} loading={refund.isPending}>
                    Refund {naira(refundAmount ?? -balance)}
                  </Button>
                </div>
              ) : (
                <p className="text-[12.5px] text-ink-muted">Ask a manager to record the refund.</p>
              )}
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}
