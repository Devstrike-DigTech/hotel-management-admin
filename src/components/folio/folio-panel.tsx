"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { FilePlus, Money, Percent, Plus } from "@phosphor-icons/react";
import { useFolio } from "@/lib/api/hooks-m2";
import { foliosApi } from "@/lib/api/endpoints-m2";
import { useDeskRefresh } from "@/lib/api/mutations-m2";
import type { FolioEntry } from "@/lib/api/types-m2";
import { useCan } from "@/lib/permissions";
import { openPayment } from "@/lib/store-m2";
import { toast } from "@/lib/store";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Badge, ErrorState, Panel, Skeleton } from "@/components/ui/primitives";
import { FolioLedger } from "./folio-ledger";
import { ChargeDialog, DiscountDialog, VoidDialog } from "./folio-dialogs";

/** The folio with its desk actions, as used on a reservation or a walk-in folio. */
export function FolioPanel({ folioId, title, reservationCode }: { folioId: string; title?: string; reservationCode?: string | null }) {
  const q = useFolio(folioId);
  const { can } = useCan();
  const refresh = useDeskRefresh();
  const [charge, setCharge] = useState(false);
  const [discount, setDiscount] = useState(false);
  const [voiding, setVoiding] = useState<FolioEntry | null>(null);
  const proforma = useMutation({
    mutationFn: () => foliosApi.proforma(folioId),
    onSuccess: async (inv) => {
      await refresh();
      window.open(`/print/invoice/${inv.id}`, "_blank", "noopener");
      toast.success(`Proforma ${inv.number} issued`);
    },
    meta: { errorTitle: "Proforma not issued" },
  });

  const f = q.data;
  const open = f?.status === "OPEN";
  const act = can("frontdesk.act");

  return (
    <Panel className="overflow-hidden" aria-labelledby="folio-title">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-[linear-gradient(to_bottom,var(--surface),color-mix(in_oklab,var(--surface-2)_40%,var(--surface)))] px-5 py-4">
        <div className="min-w-0">
          <p className="eyebrow mb-1">
            Folio{f ? <> &middot; opened {formatDate(f.openedAt, { day: "numeric", month: "short" })}</> : null}
          </p>
          <h2 id="folio-title" className="display-sm flex items-center gap-2 text-[19px] leading-tight text-ink">
            {title ?? f?.name ?? "Folio"}
            {f && <Badge tone={open ? "palm" : "neutral"}>{open ? "Open" : "Closed"}</Badge>}
          </h2>
        </div>
        {f && (
          <div className="flex flex-wrap items-center gap-1.5">
            {open && act && (
              <>
                <Button size="sm" variant="ghost" onClick={() => setCharge(true)}>
                  <Plus size={14} weight="bold" /> Charge
                </Button>
                {can("discount") && (
                  <Button size="sm" variant="ghost" onClick={() => setDiscount(true)}>
                    <Percent size={14} weight="bold" /> Discount
                  </Button>
                )}
              </>
            )}
            <Button size="sm" variant="ghost" onClick={() => proforma.mutate()} loading={proforma.isPending}>
              <FilePlus size={14} weight="bold" /> Proforma
            </Button>
            {open && act && (
              <Button
                size="sm"
                onClick={() =>
                  openPayment({ folioId: f.id, label: f.guest?.fullName ?? f.name, balanceKobo: f.totals.balanceKobo, reservationCode })
                }
              >
                <Money size={14} weight="bold" /> Take payment
              </Button>
            )}
          </div>
        )}
      </header>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !f ? (
        <div className="flex flex-col gap-3 p-5">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : (
        <>
          <FolioLedger
            folio={f}
            canVoid={can("void")}
            onVoid={setVoiding}
            onReceipt={(id) => window.open(`/print/receipt/${id}`, "_blank", "noopener")}
          />
          <ChargeDialog folio={f} open={charge} onOpenChange={setCharge} />
          <DiscountDialog folio={f} open={discount} onOpenChange={setDiscount} />
          <VoidDialog folio={f} entry={voiding} onOpenChange={(o) => !o && setVoiding(null)} />
        </>
      )}
    </Panel>
  );
}
