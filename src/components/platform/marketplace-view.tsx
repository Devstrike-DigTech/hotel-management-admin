"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowCounterClockwise, ArrowUpRight, CheckCircle, Clock, Storefront, WarningOctagon, Receipt } from "@phosphor-icons/react";
import { useMarketplaceSummary, useOrphanedPayments, useReceivables, qk3 } from "@/lib/api/hooks-m3";
import { platformM3Api } from "@/lib/api/endpoints-m3";
import type { MarketplaceSummary, OrphanReason, RefundStatus } from "@/lib/api/types-m3";
import { addDays, todayKey } from "@/lib/dates";
import { formatDate, formatDateTime, lagosLongDate, naira, nairaCompact, number } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageHeader, Panel, PanelHeader, PlanPlate, Segmented, Skeleton } from "@/components/ui/primitives";
import { PLAN_NAMES } from "@/lib/catalog";
import { ChannelBadge } from "@/components/m3/bits";

type Period = "30d" | "90d" | "365d";
const range = (p: Period) => {
  const t = todayKey();
  return { from: addDays(t, p === "30d" ? -29 : p === "90d" ? -89 : -364), to: t };
};

/* Collected (taken at the split) vs receivable (pay-at-hotel, invoiced monthly).
   --m-transfer and --m-card pass the palette validator as an adjacent pair in
   both themes; receivable also carries a hatch, so hue never works alone. */
const COLLECTED = "var(--m-transfer)";
const RECEIVABLE = "var(--m-card)";

export function MarketplaceView() {
  const [period, setPeriod] = useState<Period>("30d");
  const { from, to } = range(period);
  const m = useMarketplaceSummary(from, to);
  const d = m.data;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Storefront size={14} weight="duotone" /> <span suppressHydrationWarning>{lagosLongDate()}</span>
          </>
        }
        title={
          <>
            The <em>marketplace</em>
          </>
        }
        description="Online bookings across every hotel: what guests booked, what the platform took at the split, and what hotels owe for pay-at-hotel bookings."
        actions={
          <Segmented<Period>
            label="Period"
            value={period}
            onChange={setPeriod}
            size="sm"
            options={[
              { value: "30d", label: "30 days" },
              { value: "90d", label: "90 days" },
              { value: "365d", label: "12 months" },
            ]}
          />
        }
      />

      {m.isError ? (
        <Panel className="mb-6">
          <ErrorState error={m.error} onRetry={() => m.refetch()} />
        </Panel>
      ) : (
        <Panel className="mb-6 grid grid-cols-2 md:grid-cols-4 [&>*]:border-line max-md:[&>*:nth-child(-n+2)]:border-b max-md:[&>*:nth-child(odd)]:border-r md:[&>*:not(:first-child)]:border-l">
          <Hero label="Gross booking value" value={d ? nairaCompact(d.gmvKobo) : null} sub={d ? `${number(d.bookings.total)} online bookings` : ""} accent />
          <Hero label="Commission collected" value={d ? nairaCompact(d.commissionCollectedKobo) : null} sub="at the split, net of refunds" swatch={COLLECTED} />
          <Hero label="Receivable" value={d ? nairaCompact(d.commissionReceivableKobo) : null} sub="pay-at-hotel, all time, unsettled" swatch={RECEIVABLE} hatch />
          <Hero label="Paid online" value={d ? nairaCompact(d.onlineCollectedKobo) : null} sub={d ? `${naira(d.refundsKobo)} refunded` : ""} />
        </Panel>
      )}

      {d && <Mix d={d} />}

      <Panel className="mb-6">
        <PanelHeader eyebrow="By hotel" title="Commission collected and receivable" description="Booking-site bookings pay no commission, so a hotel can have value here with none taken." actions={<Legend />} />
        {!d ? (
          <div className="flex flex-col gap-3 p-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : d.byHotel.length === 0 ? (
          <EmptyState compact glyph="dots" title="No online bookings in this period" />
        ) : (
          <HotelRows rows={d.byHotel} />
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-7">
          <Orphaned />
        </div>
        <div className="xl:col-span-5">
          <ReceivablesPanel />
        </div>
      </div>
    </>
  );
}

function Hero({ label, value, sub, accent, swatch, hatch }: { label: string; value: string | null; sub: string; accent?: boolean; swatch?: string; hatch?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-5 py-5">
      <span className="display-sm flex items-center gap-2 text-[14px] italic text-ink-muted">
        {swatch && <Swatch color={swatch} hatch={hatch} />}
        {label}
      </span>
      {value === null ? <Skeleton className="h-9 w-28" /> : <span className={cn("font-mono text-[28px] leading-none tracking-tight md:text-[34px]", accent ? "text-laterite" : "text-ink")}>{value}</span>}
      <span className="truncate text-[12.5px] text-ink-muted">{sub}</span>
    </div>
  );
}

function Swatch({ color, hatch }: { color: string; hatch?: boolean }) {
  return <span aria-hidden className={cn("inline-block h-2.5 w-2.5 shrink-0 rounded-xs", hatch && "hatch")} style={hatch ? { color, border: `1px solid ${color}` } : { background: color }} />;
}

function Legend() {
  return (
    <div className="flex items-center gap-4 text-[12px] text-ink-muted">
      <span className="inline-flex items-center gap-1.5">
        <Swatch color={COLLECTED} /> Collected
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Swatch color={RECEIVABLE} hatch /> Receivable
      </span>
    </div>
  );
}

/** Channel and payment mix as two plain ledgers of counts. */
function Mix({ d }: { d: MarketplaceSummary }) {
  const b = d.bookings;
  return (
    <div className="mb-6 grid gap-4 md:grid-cols-3">
      <Panel className="flex flex-col gap-2.5 px-5 py-4">
        <p className="eyebrow text-[10px]">Where they booked</p>
        <div className="flex items-center gap-3">
          <ChannelBadge source="MARKETPLACE" size="sm" />
          <span className="ml-auto font-mono text-[18px] text-ink">{number(b.marketplace)}</span>
        </div>
        <div className="flex items-center gap-3">
          <ChannelBadge source="BOOKING_SITE" size="sm" />
          <span className="ml-auto font-mono text-[18px] text-ink">{number(b.bookingSite)}</span>
        </div>
      </Panel>
      <Panel className="flex flex-col gap-2.5 px-5 py-4">
        <p className="eyebrow text-[10px]">How they paid</p>
        <div className="flex items-baseline gap-3 text-[13.5px]">
          <span className="text-ink">Online</span>
          <span className="ml-auto font-mono text-[18px] text-ink">{number(b.payOnline)}</span>
        </div>
        <div className="flex items-baseline gap-3 text-[13.5px]">
          <span className="text-ink">At the hotel</span>
          <span className="ml-auto font-mono text-[18px] text-ink">{number(b.payAtHotel)}</span>
        </div>
      </Panel>
      <Panel className="flex flex-col gap-2.5 px-5 py-4">
        <p className="eyebrow text-[10px]">Fell through</p>
        <div className="flex items-baseline gap-3 text-[13.5px]">
          <span className="text-ink">Cancelled</span>
          <span className="ml-auto font-mono text-[18px] text-ink">{number(b.cancelled)}</span>
        </div>
        <div className="flex items-baseline gap-3 text-[13.5px]">
          <span className="text-ink">Holds that lapsed unpaid</span>
          <span className="ml-auto font-mono text-[18px] text-ink">{number(b.expiredHolds)}</span>
        </div>
      </Panel>
    </div>
  );
}

function HotelRows({ rows }: { rows: MarketplaceSummary["byHotel"] }) {
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b.commissionCollectedKobo + b.commissionReceivableKobo - (a.commissionCollectedKobo + a.commissionReceivableKobo) || b.gmvKobo - a.gmvKobo),
    [rows],
  );
  const max = Math.max(1, ...sorted.map((r) => r.commissionCollectedKobo + r.commissionReceivableKobo));
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[760px] text-[13.5px]" data-testid="commission-table">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="eyebrow py-3 pl-5 text-[10px] font-normal">Hotel</th>
            <th className="eyebrow w-[34%] py-3 text-[10px] font-normal">Commission</th>
            <th className="eyebrow py-3 pr-4 text-right text-[10px] font-normal">Collected</th>
            <th className="eyebrow py-3 pr-4 text-right text-[10px] font-normal">Receivable</th>
            <th className="eyebrow py-3 pr-5 text-right text-[10px] font-normal">Booking value</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const total = r.commissionCollectedKobo + r.commissionReceivableKobo;
            return (
              <tr key={r.tenantId} className="border-b border-line last:border-0 hover:bg-surface-2/40">
                <td className="py-3 pl-5 pr-3">
                  <Link href={`/platform/tenants/${r.tenantId}`} className="group inline-flex items-center gap-1.5 text-ink hover:text-laterite">
                    <span className="truncate font-medium">{r.hotelName}</span>
                    <ArrowUpRight size={12} className="text-ink-faint opacity-0 group-hover:opacity-100" />
                  </Link>
                  <span className="mt-1 flex items-center gap-2">
                    <PlanPlate name={PLAN_NAMES[r.planCode] ?? r.planCode} code={r.planCode} />
                    {!r.payoutReady && <span className="text-[11px] text-ochre">no payout account</span>}
                  </span>
                </td>
                <td className="py-3 pr-4">
                  <div className="flex h-3 gap-[2px]" role="img" aria-label={`${r.hotelName}: ${naira(r.commissionCollectedKobo)} collected, ${naira(r.commissionReceivableKobo)} receivable`}>
                    {r.commissionCollectedKobo > 0 && (
                      <span style={{ width: `${(r.commissionCollectedKobo / max) * 100}%`, background: COLLECTED, borderRadius: r.commissionReceivableKobo ? "2px 0 0 2px" : 2 }} />
                    )}
                    {r.commissionReceivableKobo > 0 && (
                      <span
                        className="hatch"
                        style={{ width: `${(r.commissionReceivableKobo / max) * 100}%`, color: RECEIVABLE, border: `1px solid ${RECEIVABLE}`, borderRadius: r.commissionCollectedKobo ? "0 2px 2px 0" : 2 }}
                      />
                    )}
                    {total === 0 && <span className="self-center text-[11.5px] text-ink-faint">none (booking site only)</span>}
                  </div>
                </td>
                <td className="py-3 pr-4 text-right font-mono text-ink">{r.commissionCollectedKobo ? naira(r.commissionCollectedKobo) : <span className="text-ink-faint">-</span>}</td>
                <td className="py-3 pr-4 text-right font-mono text-ink">{r.commissionReceivableKobo ? naira(r.commissionReceivableKobo) : <span className="text-ink-faint">-</span>}</td>
                <td className="py-3 pr-5 text-right font-mono text-ink-muted">
                  {naira(r.gmvKobo)}
                  <span className="block text-[11px]">
                    {r.bookings} {r.bookings === 1 ? "booking" : "bookings"}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const REFUND: Record<RefundStatus, { label: string; color: string; icon: React.ElementType }> = {
  PENDING: { label: "Refund pending", color: "var(--ochre)", icon: Clock },
  PROCESSED: { label: "Refunded", color: "var(--palm)", icon: CheckCircle },
  FAILED: { label: "Refund failed", color: "var(--danger)", icon: WarningOctagon },
};
const ORPHAN: Record<OrphanReason, string> = {
  LATE_NO_INVENTORY: "Paid after the 20-minute hold lapsed, and the room had been sold.",
  AMOUNT_MISMATCH: "The amount paid didn't match the quoted total.",
  BOOKING_CANCELLED: "The booking was cancelled before the payment landed.",
};

function Orphaned() {
  const [all, setAll] = useState(false);
  const q = useOrphanedPayments({ status: all ? "all" : "open", pageSize: 20 });
  const qc = useQueryClient();
  const retry = useMutation({
    mutationFn: (id: string) => platformM3Api.retryRefund(id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk3.pOrphanedAll });
      toast.success("Refund sent again");
    },
    meta: { errorTitle: "Refund not retried" },
  });
  const items = q.data?.items ?? [];
  return (
    <Panel className="h-full">
      <PanelHeader
        eyebrow="Needs a look"
        title="Orphaned payments"
        description="Money that arrived but couldn't be applied. Each is refunded automatically; failed refunds wait here for a retry."
        actions={
          <Segmented<"open" | "all">
            label="Show"
            size="sm"
            value={all ? "all" : "open"}
            onChange={(v) => setAll(v === "all")}
            options={[
              { value: "open", label: "Open" },
              { value: "all", label: "All" },
            ]}
          />
        }
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="m-5 h-24" />
      ) : items.length === 0 ? (
        <EmptyState compact glyph="rings" title={all ? "Nothing orphaned yet" : "Nothing open"} body="Every online payment found its booking, or its refund went through." />
      ) : (
        <ul className="divide-y divide-line" data-testid="orphaned-list">
          {items.map((o) => {
            const s = o.refund ? REFUND[o.refund.status] : REFUND.PENDING;
            const SI = s.icon;
            return (
              <li key={o.id} className="grid gap-2 px-5 py-4 md:grid-cols-[1fr_auto] md:items-start">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-[16px] text-ink">{naira(o.amountKobo)}</span>
                    <Link href={`/platform/tenants/${o.tenantId}`} className="text-[13.5px] text-ink hover:text-laterite">
                      {o.hotelName}
                    </Link>
                    <span className="font-mono text-[12px] text-ink-muted">{o.reservationCode}</span>
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-ink-muted">{ORPHAN[o.orphanReason] ?? o.orphanReason}</p>
                  <p className="mt-1 font-mono text-[11px] text-ink-faint">
                    {o.guestName} {o.guestPhoneMasked} &middot; {o.reference} &middot; {formatDateTime(o.paidAt ?? o.createdAt)}
                  </p>
                  {o.refund?.error && <p className="mt-1 text-[12px] text-danger">{o.refund.error}</p>}
                </div>
                <div className="flex items-center gap-3 md:flex-col md:items-end">
                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12.5px] font-medium" style={{ color: s.color }}>
                    <SI size={14} weight="fill" /> {o.refund ? s.label : "No refund yet"}
                  </span>
                  {(!o.refund || o.refund.status === "FAILED") && (
                    <Button size="sm" variant="secondary" onClick={() => retry.mutate(o.id)} loading={retry.isPending && retry.variables === o.id}>
                      <ArrowCounterClockwise size={13} /> Retry refund
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}

function monthKey(offset = 0) {
  const [y, m] = todayKey().split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
const monthName = (k: string) => {
  const [y, m] = k.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString("en-NG", { month: "long", year: "numeric", timeZone: "UTC" });
};

/** Pay-at-hotel commission, invoiced by the month, and marked settled when paid. */
function ReceivablesPanel() {
  const [month, setMonth] = useState(monthKey());
  const q = useReceivables(month);
  const qc = useQueryClient();
  const settle = useMutation({
    mutationFn: (tenantId: string) => platformM3Api.settle(tenantId, month),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk3.pReceivablesAll });
      await qc.invalidateQueries({ queryKey: ["platform", "marketplace"] });
      toast.success("Marked as settled");
    },
    meta: { errorTitle: "Not settled" },
  });
  const months = [monthKey(), monthKey(-1), monthKey(-2)];
  return (
    <Panel className="h-full">
      <PanelHeader
        eyebrow="To invoice"
        title="Receivables"
        description="Commission on marketplace bookings paid at the hotel."
        actions={
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            aria-label="Month"
            className="h-8 rounded-md border border-line-strong bg-surface px-2 text-[12.5px] text-ink"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthName(m)}
              </option>
            ))}
          </select>
        }
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="m-5 h-24" />
      ) : q.data.items.length === 0 ? (
        <EmptyState compact glyph="arcs" title="Nothing to invoice" body={`No pay-at-hotel marketplace bookings in ${monthName(month)}.`} />
      ) : (
        <>
          <ul className="divide-y divide-line">
            {q.data.items.map((r) => (
              <li key={r.tenantId} className="flex items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] text-ink">{r.hotelName}</p>
                  <p className="font-mono text-[11px] text-ink-muted">
                    {r.bookings} {r.bookings === 1 ? "booking" : "bookings"}
                    {r.reversedKobo ? `, ${naira(r.reversedKobo)} reversed` : ""}
                  </p>
                </div>
                <span className="font-mono text-[14px] text-ink">{naira(r.dueKobo || r.settledKobo)}</span>
                {r.settledAt ? (
                  <span className="inline-flex w-[92px] items-center justify-end gap-1 text-[12px] text-palm">
                    <CheckCircle size={13} weight="fill" /> {formatDate(r.settledAt, { day: "numeric", month: "short", year: undefined })}
                  </span>
                ) : (
                  <Button size="sm" variant="secondary" className="w-[92px]" disabled={!r.dueKobo} onClick={() => settle.mutate(r.tenantId)} loading={settle.isPending && settle.variables === r.tenantId}>
                    <Receipt size={13} /> Settle
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <p className="flex items-baseline justify-between border-t-2 border-double border-line-strong px-5 py-3">
            <span className="display-sm text-[15px] text-ink">Due for {monthName(month)}</span>
            <span className="font-mono text-[18px] text-ink">{naira(q.data.totalDueKobo)}</span>
          </p>
        </>
      )}
    </Panel>
  );
}
