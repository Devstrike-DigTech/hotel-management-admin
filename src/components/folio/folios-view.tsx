"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, Plus, Printer } from "@phosphor-icons/react";
import { documentsApi, foliosApi } from "@/lib/api/endpoints-m2";
import { useFolio } from "@/lib/api/hooks-m2";
import { useDeskRefresh } from "@/lib/api/mutations-m2";
import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/store";
import { formatDate } from "@/lib/format";
import { PAYMENT_METHODS } from "@/lib/catalog-m2";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, Input } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { BalancePill, Money } from "@/components/m2/bits";
import { FolioPanel } from "./folio-panel";

type Tab = "open" | "closed" | "invoices" | "receipts";

export function FoliosView() {
  const [tab, setTab] = useState<Tab>("open");
  const [newOpen, setNewOpen] = useState(false);
  const { can } = useCan();
  return (
    <>
      <PageHeader
        eyebrow="Money"
        title={
          <>
            Folios &amp; <em>invoices</em>
          </>
        }
        description="Open bills, closed folios, and every invoice and receipt issued. Walk-in folios cover the restaurant, pool passes and other sales without a room."
        actions={
          can("frontdesk.act") && (
            <Button onClick={() => setNewOpen(true)}>
              <Plus size={15} weight="bold" /> Walk-in folio
            </Button>
          )
        }
      />
      <div className="mb-4 flex gap-1 border-b border-line" role="tablist">
        {(
          [
            ["open", "Open folios"],
            ["closed", "Closed"],
            ["invoices", "Invoices"],
            ["receipts", "Receipts"],
          ] as [Tab, string][]
        ).map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={cn("relative h-10 px-3 text-[13.5px] font-medium", tab === v ? "text-ink" : "text-ink-muted hover:text-ink")}>
            {l}
            {tab === v && <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-laterite" />}
          </button>
        ))}
      </div>
      {tab === "open" || tab === "closed" ? <FolioList status={tab === "open" ? "OPEN" : "CLOSED"} /> : tab === "invoices" ? <InvoiceList /> : <ReceiptList />}
      <NewFolio open={newOpen} onOpenChange={setNewOpen} />
    </>
  );
}

function FolioList({ status }: { status: "OPEN" | "CLOSED" }) {
  const router = useRouter();
  const q = useQuery({ queryKey: ["folio", "list", status], queryFn: () => foliosApi.list({ status, pageSize: 50 }) });
  return (
    <Panel className="overflow-hidden">
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <Skeleton className="m-5 h-48" />
      ) : !q.data?.items.length ? (
        <EmptyState glyph="dots" title="No folios here" />
      ) : (
        <ul className="divide-y divide-line">
          {[...q.data.items].sort((a, b) => b.balanceKobo - a.balanceKobo || b.chargesKobo - a.chargesKobo).map((f) => (
            <li key={f.id}>
              <button
                onClick={() => router.push(f.kind === "WALK_IN" ? `/folios/${f.id}` : `/folios/${f.id}`)}
                className="grid w-full grid-cols-[1fr_auto] items-center gap-4 px-5 py-3 text-left hover:bg-surface-2/50 md:grid-cols-[minmax(0,2fr)_110px_120px_120px_130px]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-medium text-ink">{f.name}</span>
                  <span className="block text-[12px] text-ink-muted">
                    {f.kind === "WALK_IN" ? "Walk-in" : <span className="font-mono">{f.reservationCode}</span>}
                    {f.roomNumber ? ` · room ${f.roomNumber}` : ""} &middot; {formatDate(f.openedAt, { day: "numeric", month: "short", year: undefined })}
                  </span>
                </span>
                <span className="hidden text-right md:block">
                  <Badge tone={f.kind === "WALK_IN" ? "adire" : "neutral"}>{f.kind === "WALK_IN" ? "Walk-in" : "Stay"}</Badge>
                </span>
                <Money kobo={f.chargesKobo} className="hidden text-right text-[13px] text-ink-muted md:block" />
                <Money kobo={-f.paymentsKobo} className="hidden text-right text-[13px] text-ink-muted md:block" />
                <span className="text-right">
                  {f.chargesKobo === 0 && f.paymentsKobo === 0 ? (
                    <span className="text-[12px] italic text-ink-faint">nothing posted</span>
                  ) : (
                    <BalancePill kobo={f.balanceKobo} />
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function InvoiceList() {
  const q = useQuery({ queryKey: ["invoices", "list"], queryFn: () => documentsApi.invoices({ pageSize: 50 }) });
  return (
    <Panel className="overflow-hidden">
      {q.isLoading ? (
        <Skeleton className="m-5 h-48" />
      ) : !q.data?.items.length ? (
        <EmptyState glyph="dots" title="No invoices yet" body="Final invoices are issued at check-out." />
      ) : (
        <ul className="divide-y divide-line">
          {q.data.items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
              <span className="w-[140px] font-mono text-[13px] text-ink">{i.number}</span>
              <Badge tone={i.kind === "FINAL" ? "palm" : "neutral"}>{i.kind === "FINAL" ? "Final" : "Proforma"}</Badge>
              <span className="min-w-[140px] flex-1 truncate text-[13.5px] text-ink">{i.guestName ?? "-"}</span>
              <span className="font-mono text-[12px] text-ink-faint">{i.reservationCode}</span>
              <span className="w-24 text-[12px] text-ink-muted">{formatDate(i.issuedAt, { day: "numeric", month: "short", year: undefined })}</span>
              <Money kobo={i.totalKobo} className="w-28 text-right text-[13.5px] text-ink" />
              <Button size="icon-sm" variant="ghost" aria-label={`Print ${i.number}`} onClick={() => window.open(`/print/invoice/${i.id}`, "_blank", "noopener")}>
                <Printer size={15} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function ReceiptList() {
  const q = useQuery({ queryKey: ["receipts", "list"], queryFn: () => documentsApi.receipts({ pageSize: 50 }) });
  return (
    <Panel className="overflow-hidden">
      {q.isLoading ? (
        <Skeleton className="m-5 h-48" />
      ) : !q.data?.items.length ? (
        <EmptyState glyph="dots" title="No receipts yet" />
      ) : (
        <ul className="divide-y divide-line">
          {q.data.items.map((r) => (
            <li key={r.id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3", r.voided && "opacity-60")}>
              <span className={cn("w-[140px] font-mono text-[13px] text-ink", r.voided && "line-through")}>{r.number}</span>
              <span className="w-20 text-[12.5px] text-ink-muted">{PAYMENT_METHODS[r.method].short}</span>
              <span className="min-w-[140px] flex-1 truncate text-[13.5px] text-ink">{r.guestName ?? "-"}</span>
              {r.voided && <Badge tone="danger">Voided</Badge>}
              <span className="w-24 text-[12px] text-ink-muted">{formatDate(r.issuedAt, { day: "numeric", month: "short", year: undefined })}</span>
              <Money kobo={r.amountKobo} className="w-28 text-right text-[13.5px] text-ink" />
              <Button size="icon-sm" variant="ghost" aria-label={`Print ${r.number}`} onClick={() => window.open(`/print/receipt/${r.id}`, "_blank", "noopener")}>
                <Printer size={15} />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function NewFolio({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [name, setName] = useState("");
  const router = useRouter();
  const refresh = useDeskRefresh();
  const m = useMutation({
    mutationFn: () => foliosApi.create({ name: name.trim() }),
    onSuccess: async (f) => {
      await refresh();
      toast.success("Walk-in folio opened");
      onOpenChange(false);
      router.push(`/folios/${f.id}`);
    },
    meta: { errorTitle: "Folio not opened" },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Walk-in folio"
      description="For sales without a room: the restaurant, a pool pass, an event hall."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => m.mutate()} loading={m.isPending} disabled={name.trim().length < 2}>
            Open folio
          </Button>
        </>
      }
    >
      <Field label="Name on the folio" htmlFor="wf-name">
        <Input id="wf-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Pool pass, Mr Adewale" autoFocus />
      </Field>
    </Dialog>
  );
}

/** /folios/[id]: one folio on its own (walk-ins mostly). */
export function FolioPage({ id }: { id: string }) {
  const f = useFolio(id);
  const refresh = useDeskRefresh();
  const close = useMutation({
    mutationFn: () => foliosApi.close(id),
    onSuccess: async (r) => {
      await refresh();
      toast.success(`Folio closed, ${r.invoice.number} issued`);
      window.open(`/print/invoice/${r.invoice.id}`, "_blank", "noopener");
    },
    meta: { errorTitle: "Folio not closed" },
  });
  return (
    <>
      <Link href={f.data?.reservation ? `/reservations/${f.data.reservation.id}` : "/folios"} className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> {f.data?.reservation ? f.data.reservation.code : "Folios"}
      </Link>
      <PageHeader
        eyebrow={f.data?.kind === "WALK_IN" ? "Walk-in folio" : "Folio"}
        title={f.data?.name ?? <Skeleton className="h-11 w-72" />}
        actions={
          f.data?.kind === "WALK_IN" &&
          f.data.status === "OPEN" && (
            <Button onClick={() => close.mutate()} loading={close.isPending} disabled={f.data.totals.balanceKobo !== 0}>
              Close and invoice
            </Button>
          )
        }
      />
      <FolioPanel folioId={id} />
    </>
  );
}
