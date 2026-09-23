"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowsLeftRight,
  CheckCircle,
  CloudArrowUp,
  CreditCard,
  Globe,
  HandCoins,
  Money,
  Printer,
  Receipt,
  Scroll,
  WhatsappLogo,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { toast, useStore } from "@/lib/store";
import { paymentStore, type PaymentTarget } from "@/lib/store-m2";
import { useCurrentShift } from "@/lib/api/hooks-m2";
import { documentsApi, shiftsApi } from "@/lib/api/endpoints-m2";
import { useDeskRefresh } from "@/lib/api/mutations-m2";
import type { Folio, ReceiptDocument } from "@/lib/api/types-m2";
import { deskAction } from "@/lib/offline/desk-action";
import { useOnline } from "@/lib/offline/network";
import { useEntitlements } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import { PAYMENT_METHODS, type PaymentMethod } from "@/lib/catalog-m2";
import { naira } from "@/lib/format";
import { Sheet } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { NairaInput } from "@/components/m2/bits";

const ICONS: Record<PaymentMethod, React.ReactNode> = {
  CASH: <Money size={22} weight="duotone" />,
  TRANSFER: <ArrowsLeftRight size={22} weight="duotone" />,
  POS: <CreditCard size={22} weight="duotone" />,
  CARD_ONLINE: <Globe size={18} weight="duotone" />,
  CITY_LEDGER: <Scroll size={18} weight="duotone" />,
  COMPLIMENTARY: <HandCoins size={18} weight="duotone" />,
};

export function PaymentHost() {
  const target = useStore(paymentStore);
  return (
    <Sheet
      open={!!target}
      onOpenChange={(o) => !o && paymentStore.set(null)}
      eyebrow={target ? `${target.reservationCode ? `${target.reservationCode} · ` : ""}${target.label}` : "Folio"}
      title="Take payment"
      width="sm:max-w-[500px]"
    >
      {target && <PaymentForm key={target.folioId} target={target} onClose={() => paymentStore.set(null)} />}
    </Sheet>
  );
}

function PaymentForm({ target, onClose }: { target: PaymentTarget; onClose: () => void }) {
  const refresh = useDeskRefresh();
  const online = useOnline();
  const { has } = useEntitlements();
  const { can } = useCan();
  const shift = useCurrentShift(can("shift.own"));
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [amount, setAmount] = useState<number | null>(target.balanceKobo > 0 ? target.balanceKobo : null);
  const [reference, setReference] = useState("");
  const [float, setFloat] = useState<number | null>(2000000);
  const [done, setDone] = useState<{ receipt?: ReceiptDocument; queued?: boolean; amount: number } | null>(null);

  const needsShift = PAYMENT_METHODS[method].needsShift;
  const shiftOpen = shift.data?.status === "OPEN";
  const blockedByShift = needsShift && !shiftOpen && online;
  const needsRef = method === "TRANSFER" || method === "POS";

  const openShift = useMutation({
    mutationFn: () => shiftsApi.open(float ?? 0),
    onSuccess: async () => {
      await refresh();
      toast.success("Shift opened", `Float ${naira(float ?? 0)}. Payments now go to your shift.`);
    },
    meta: { errorTitle: "Shift not opened" },
  });

  const pay = useMutation({
    mutationFn: async () => {
      if (!amount || amount <= 0) throw new Error("Enter an amount");
      return deskAction<{ folio: Folio; receipt: ReceiptDocument }>({
        kind: "payment",
        title: `${naira(amount)} ${PAYMENT_METHODS[method].short.toLowerCase()} from ${target.label}`,
        subtitle: target.reservationCode ?? undefined,
        method: "POST",
        path: `/folios/${target.folioId}/payments`,
        body: { method, amountKobo: amount, reference: reference.trim() || undefined },
        offlineAllowed: has("offline_mode"),
        invalidate: [["folio"], ["reservations"]],
      });
    },
    onSuccess: async (r) => {
      if (r.queued) {
        setDone({ queued: true, amount: amount! });
        return;
      }
      await refresh();
      target.onDone?.();
      setDone({ receipt: r.result.receipt, amount: amount! });
    },
    meta: { errorTitle: "Payment not recorded" },
  });

  if (done) return <PaymentDone done={done} onClose={onClose} />;

  const methods: PaymentMethod[] = ["CASH", "TRANSFER", "POS"];
  const more: PaymentMethod[] = can("payments.privileged") ? ["CARD_ONLINE", "CITY_LEDGER", "COMPLIMENTARY"] : [];
  const bal = target.balanceKobo;

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        pay.mutate();
      }}
    >
      <div>
        <div className="mb-2 flex items-baseline justify-between">
          <label htmlFor="pay-amount" className="text-[13px] font-medium text-ink">
            Amount
          </label>
          <span className="text-[12.5px] text-ink-muted">
            {bal > 0 ? (
              <>
                Balance due <span className="font-mono text-ochre">{naira(bal)}</span>
              </>
            ) : bal < 0 ? (
              <>
                In credit <span className="font-mono text-palm">{naira(-bal)}</span>
              </>
            ) : (
              "Nothing due"
            )}
          </span>
        </div>
        <NairaInput id="pay-amount" kobo={amount} onChange={setAmount} large autoFocus />
        {bal > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[bal, Math.round(bal / 2 / 100000) * 100000, 5000000, 10000000]
              .filter((v, i, a) => v > 0 && v <= bal && a.indexOf(v) === i)
              .map((v, i) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setAmount(v)}
                  className={cn(
                    "h-7 rounded-full border px-2.5 font-mono text-[12px] transition-colors",
                    amount === v ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:text-ink",
                  )}
                >
                  {i === 0 ? `Full ${naira(v)}` : naira(v)}
                </button>
              ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-[13px] font-medium text-ink">Method</p>
        <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-3 gap-2">
          {methods.map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={method === m}
              onClick={() => setMethod(m)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-md border px-2 py-3.5 text-[13px] font-medium transition-colors",
                method === m
                  ? "border-laterite bg-laterite-wash/70 text-ink shadow-[inset_0_-2px_0_var(--laterite)]"
                  : "border-line-strong bg-surface text-ink-muted hover:border-ink-faint hover:text-ink",
              )}
            >
              <span className={method === m ? "text-laterite" : ""}>{ICONS[m]}</span>
              {PAYMENT_METHODS[m].short}
            </button>
          ))}
        </div>
        {more.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {more.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={method === m}
                onClick={() => setMethod(m)}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] transition-colors",
                  method === m ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:text-ink",
                )}
              >
                {ICONS[m]}
                {PAYMENT_METHODS[m].label}
              </button>
            ))}
          </div>
        )}
      </div>

      {needsRef && (
        <Field
          label={method === "TRANSFER" ? "Transfer reference" : "POS slip number"}
          htmlFor="pay-ref"
          optional
          hint={method === "TRANSFER" ? "Session ID or the sender's name as it shows on the alert." : "The RRN or STAN printed on the slip."}
        >
          <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} className="font-mono" autoComplete="off" />
        </Field>
      )}

      {blockedByShift && !shift.isLoading && (
        <div className="rounded-md border border-dashed border-[color-mix(in_oklab,var(--brass)_60%,transparent)] bg-brass-wash/50 p-4">
          <p className="text-[13.5px] font-medium text-ink">Open your shift first</p>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            Cash, transfer and POS payments are counted against your till. Count your opening float and start the shift.
          </p>
          <div className="mt-3 flex items-end gap-2">
            <Field label="Opening float" htmlFor="pay-float" className="flex-1">
              <NairaInput id="pay-float" kobo={float} onChange={setFloat} />
            </Field>
            <Button type="button" variant="ink" onClick={() => openShift.mutate()} loading={openShift.isPending}>
              Open shift
            </Button>
          </div>
        </div>
      )}

      <div className="flex gap-2 border-t border-line pt-4">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" size="lg" loading={pay.isPending} disabled={!amount || blockedByShift}>
          {!online && has("offline_mode") ? <CloudArrowUp size={16} weight="bold" /> : <Receipt size={16} weight="bold" />}
          {!online && has("offline_mode") ? "Save offline" : "Record"} {amount ? naira(amount) : ""}
        </Button>
      </div>
    </form>
  );
}

function PaymentDone({
  done,
  onClose,
}: {
  done: { receipt?: ReceiptDocument; queued?: boolean; amount: number };
  onClose: () => void;
}) {
  const share = useMutation({
    mutationFn: () => documentsApi.shareReceipt(done.receipt!.id),
    onSuccess: (l) => {
      if (l.whatsappUrl) window.open(l.whatsappUrl, "_blank", "noopener");
      else {
        void navigator.clipboard?.writeText(l.url);
        toast.info("Link copied", "The guest has no phone on file, so the receipt link is on your clipboard.");
      }
    },
    meta: { errorTitle: "Couldn't create a share link" },
  });
  return (
    <div className="flex flex-col items-center gap-4 py-6 text-center">
      <span
        className={cn(
          "grid h-14 w-14 place-items-center rounded-full",
          done.queued ? "bg-ochre-wash text-ochre" : "bg-palm-wash text-palm",
        )}
      >
        {done.queued ? <CloudArrowUp size={28} weight="duotone" /> : <CheckCircle size={28} weight="duotone" />}
      </span>
      <div>
        <p className="font-mono text-[30px] leading-none text-ink">{naira(done.amount)}</p>
        <p className="mt-2 text-[14px] text-ink-muted">
          {done.queued ? (
            "Saved on this device. It syncs, with its own receipt number, when the line returns."
          ) : (
            <>
              Received. Receipt <span className="font-mono text-ink">{done.receipt?.number}</span>
            </>
          )}
        </p>
        {done.receipt && (
          <p className="mt-1 text-[12.5px] italic text-ink-faint">{done.receipt.amountInWords}</p>
        )}
      </div>
      {done.receipt && (
        <div className="flex flex-wrap justify-center gap-2">
          <Button variant="secondary" onClick={() => window.open(`/print/receipt/${done.receipt!.id}`, "_blank", "noopener")}>
            <Printer size={15} weight="duotone" /> Print receipt
          </Button>
          <Button variant="secondary" onClick={() => share.mutate()} loading={share.isPending}>
            <WhatsappLogo size={15} weight="duotone" /> Send on WhatsApp
          </Button>
        </div>
      )}
      <Button onClick={onClose} className="mt-2 min-w-40">
        Done
      </Button>
    </div>
  );
}
