"use client";

import { useState } from "react";
import { ChartBar } from "@phosphor-icons/react";
import { useOutlets, usePosReport } from "@/lib/api/hooks-m5";
import type { PosPaymentMethod } from "@/lib/api/types-m5";
import { addDays, formatDay, todayKey } from "@/lib/dates";
import { formatDateTime, naira, nairaCompact, number } from "@/lib/format";
import { cn } from "@/lib/cn";
import { ErrorState, PageHeader, Panel, PanelHeader, Segmented, Skeleton, Stat } from "@/components/ui/primitives";
import { RequireCap } from "@/components/gating/require-cap";
import { MethodBar, StackedColumns } from "@/components/reports/charts";

const SETTLE_LABEL: Record<PosPaymentMethod, { label: string; color: string }> = {
  CASH: { label: "Cash", color: "var(--m-cash)" },
  POS: { label: "POS terminal", color: "var(--m-pos)" },
  TRANSFER: { label: "Transfer", color: "var(--m-transfer)" },
  ROOM_CHARGE: { label: "Charged to rooms", color: "var(--adire)" },
  CITY_LEDGER: { label: "Company accounts", color: "var(--m-ledger)" },
  COMPLIMENTARY: { label: "Complimentary", color: "var(--m-comp)" },
};

type Range = "1" | "7" | "30";

export function PosReports() {
  return (
    <RequireCap cap="reports.read" what="Outlet sales">
      <Inner />
    </RequireCap>
  );
}

function Inner() {
  const today = todayKey();
  const [range, setRange] = useState<Range>("7");
  const [outletId, setOutletId] = useState("");
  const from = range === "1" ? today : addDays(today, -Number(range) + 1);
  const q = usePosReport(from, today, outletId || undefined);
  const outlets = useOutlets();
  const r = q.data;
  const peak = r ? r.byHour.reduce((a, b) => (b.netKobo > a.netKobo ? b : a), r.byHour[0]) : null;
  const topMax = r ? Math.max(1, ...r.byItem.map((i) => i.netKobo)) : 1;
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <ChartBar size={14} weight="duotone" /> Outlet sales
          </>
        }
        title={
          <>
            What the bar and the kitchen <em>took</em>.
          </>
        }
        description="Sales by outlet, item and hour, how they were settled, who rang them up and every void. Net of discounts and voids, before tax."
        actions={
          <Segmented
            size="sm"
            label="Period"
            value={range}
            onChange={setRange}
            options={[
              { value: "1", label: "Today" },
              { value: "7", label: "7 days" },
              { value: "30", label: "30 days" },
            ]}
          />
        }
      />
      <div className="mb-5 flex flex-wrap gap-1.5">
        {[{ id: "", name: "Every outlet" }, ...(outlets.data ?? [])].map((o) => (
          <button key={o.id || "all"} type="button" aria-pressed={outletId === o.id} onClick={() => setOutletId(o.id)} className={cn("h-8 rounded-full border px-3 text-[12.5px] font-medium", outletId === o.id ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:text-ink")}>
            {o.name}
          </button>
        ))}
      </div>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !r ? (
        <Skeleton className="h-96" />
      ) : (
        <div className={cn("flex flex-col gap-5", q.isPlaceholderData && "opacity-60")}>
          <Panel className="grid grid-cols-2 gap-6 p-5 sm:p-6 lg:grid-cols-5">
            <Stat label="Net sales" value={nairaCompact(r.totals.netKobo)} sub={`${naira(r.totals.discountKobo)} in discounts`} />
            <Stat label="Orders" value={number(r.totals.orders)} sub={`${number(r.totals.covers)} covers`} />
            <Stat label="Average bill" value={nairaCompact(r.totals.avgOrderKobo)} sub={`${number(r.totals.itemsSold)} items sold`} />
            <Stat label="Voids" value={<span className={r.totals.voidCount ? "text-danger" : undefined}>{number(r.totals.voidCount)}</span>} sub={naira(r.totals.voidKobo)} />
            <Stat label="Tips" value={nairaCompact(r.totals.tipsKobo)} sub="on receipts, not revenue" />
          </Panel>

          <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
            <Panel>
              <PanelHeader eyebrow="By hour" title={peak && peak.netKobo ? `Busiest at ${String(peak.hour).padStart(2, "0")}:00` : "Through the day"} description="Lagos time, all days in the period added together." />
              <div className="px-4 pb-4 pt-2">
                <StackedColumns
                  data={r.byHour.map((h) => ({ x: String(h.hour), values: { net: h.netKobo } }))}
                  series={[{ key: "net", label: "Net sales", color: "var(--laterite)" }]}
                  label="Net sales by hour"
                  formatY={(v) => nairaCompact(v)}
                  formatX={(x) => `${x.padStart(2, "0")}h`}
                  height={210}
                />
              </div>
            </Panel>
            <Panel>
              <PanelHeader eyebrow="Settled as" title="How it was paid" />
              <div className="p-5">
                <MethodBar items={r.bySettlement.map((s) => ({ key: s.settlement, label: SETTLE_LABEL[s.settlement]?.label ?? s.settlement, value: s.amountKobo, color: SETTLE_LABEL[s.settlement]?.color ?? "var(--ink-faint)", display: nairaCompact(s.amountKobo) }))} />
              </div>
            </Panel>
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
            <Panel>
              <PanelHeader eyebrow="Top items" title="What sold" />
              <ol className="flex flex-col gap-2.5 p-5">
                {r.byItem.slice(0, 12).map((i, n) => (
                  <li key={i.itemId} className="grid grid-cols-[22px_1fr_auto] items-center gap-3 text-[13px]">
                    <span className="font-mono text-[11px] text-ink-faint">{n + 1}</span>
                    <span className="min-w-0">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-ink">{i.name}</span>
                        <span className="shrink-0 font-mono text-[11.5px] text-ink-muted">&times;{number(i.quantity)}</span>
                      </span>
                      <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-line">
                        <span className="block h-full rounded-full bg-laterite/80" style={{ width: `${(i.netKobo / topMax) * 100}%` }} />
                      </span>
                    </span>
                    <span className="w-20 text-right font-mono text-ink">{nairaCompact(i.netKobo)}</span>
                  </li>
                ))}
              </ol>
            </Panel>
            <div className="flex flex-col gap-5">
              <Panel>
                <PanelHeader eyebrow="By outlet" title="Where" />
                <ul className="divide-y divide-line">
                  {r.byOutlet.map((o) => (
                    <li key={o.outlet.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                      <span className="flex-1 text-ink">{o.outlet.name}</span>
                      <span className="font-mono text-ink-muted">{number(o.orders)} orders</span>
                      <span className="w-20 text-right font-mono text-ink">{nairaCompact(o.netKobo)}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
              <Panel>
                <PanelHeader eyebrow="By cashier" title="Who" />
                <ul className="divide-y divide-line">
                  {r.byCashier.map((c) => (
                    <li key={c.user.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                      <span className="flex-1 text-ink">{c.user.fullName}</span>
                      <span className="font-mono text-ink-muted">{number(c.orders)}</span>
                      <span className={cn("w-16 text-right font-mono text-[12px]", c.voids ? "text-danger" : "text-ink-faint")}>{c.voids} voids</span>
                      <span className="w-20 text-right font-mono text-ink">{nairaCompact(c.totalKobo)}</span>
                    </li>
                  ))}
                </ul>
              </Panel>
            </div>
          </div>

          <Panel className="overflow-hidden">
            <PanelHeader eyebrow="Voids" title={`${r.voids.length} voided ${r.voids.length === 1 ? "item" : "items"}`} description="Items taken off after the kitchen saw them are flagged in Revenue Guard." />
            <div className="scrollbar-thin overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead>
                  <tr className="border-b border-line text-left">
                    {["When", "Order", "Item", "Reason", "By", "Approved", "Value"].map((h) => (
                      <th key={h} className={cn("eyebrow px-4 py-2.5 text-[10px] font-normal", h === "Value" && "text-right")}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {r.voids.map((v, i) => (
                    <tr key={i} className="border-b border-line last:border-b-0">
                      <td className="whitespace-nowrap px-4 py-2.5 font-mono text-[12px] text-ink-muted">{formatDateTime(v.voidedAt)}</td>
                      <td className="px-4 py-2.5 font-mono text-[12px] text-ink">{v.orderNumber}</td>
                      <td className="px-4 py-2.5 text-ink">
                        {v.quantity} &times; {v.itemName}
                        {v.afterSend && <span className="ml-2 rounded-xs border border-[color-mix(in_oklab,var(--danger)_40%,transparent)] px-1 font-mono text-[10px] text-danger">after send</span>}
                      </td>
                      <td className="px-4 py-2.5 text-ink-muted">{v.reason}</td>
                      <td className="px-4 py-2.5 text-ink">{v.voidedBy?.fullName ?? "-"}</td>
                      <td className="px-4 py-2.5 text-ink-muted">{v.approvedBy?.fullName ?? "-"}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-danger">{naira(v.amountKobo)}</td>
                    </tr>
                  ))}
                  {!r.voids.length && (
                    <tr>
                      <td colSpan={7} className="px-4 py-6 text-center text-ink-muted">
                        No voids in these dates.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
          <p className="text-[12px] text-ink-faint">
            {formatDay(r.from, { day: "numeric", month: "short" })} to {formatDay(r.to, { day: "numeric", month: "short", year: "numeric" })}. Settled and room-charged orders count on the day they were settled.
          </p>
        </div>
      )}
    </>
  );
}
