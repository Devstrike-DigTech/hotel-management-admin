"use client";

import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowClockwise, CaretLeft, CaretRight, Moon, PaperPlaneTilt, Printer } from "@phosphor-icons/react";
import {
  useAuditRuns,
  useDailyFlash,
  useDigests,
  usePaymentsReport,
  useRangeReport,
  useShiftsReport,
} from "@/lib/api/hooks-m2";
import { digestsApi, reportsApi } from "@/lib/api/endpoints-m2";
import { useDeskRefresh } from "@/lib/api/mutations-m2";
import type { DailyFlash, Digest } from "@/lib/api/types-m2";
import { useEntitlements } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/store";
import { addDays, formatDay, lagosHHMM, todayKey } from "@/lib/dates";
import { formatDate, naira, nairaCompact, percent, relativeTime } from "@/lib/format";
import { METHOD_ORDER, PAYMENT_METHODS } from "@/lib/catalog-m2";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, PanelHeader, Segmented, Skeleton } from "@/components/ui/primitives";
import { LockedInline } from "@/components/gating/gate";
import { LineChart, MethodBar, StackedColumns } from "./charts";
import { VarianceChip } from "@/components/shifts/shift-parts";
import { PhonePreview } from "./phone-preview";

type Tab = "flash" | "range" | "payments" | "shifts" | "digest" | "audit";

export function ReportsView() {
  const [tab, setTab] = useState<Tab>("flash");
  const tabs: [Tab, string][] = [
    ["flash", "Daily flash"],
    ["range", "Trends"],
    ["payments", "Payments"],
    ["shifts", "Shifts"],
    ["digest", "Owner digest"],
    ["audit", "Night audit"],
  ];
  return (
    <>
      <PageHeader
        eyebrow="The numbers"
        title={
          <>
            <em>Reports</em>
          </>
        }
        description="Occupancy, rates and takings in naira, the way an owner reads them: the day at a glance, the trend, and where every payment went."
      />
      <div className="scrollbar-thin -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0" role="tablist">
        {tabs.map(([v, l]) => (
          <button key={v} role="tab" aria-selected={tab === v} onClick={() => setTab(v)} className={cn("relative h-10 shrink-0 whitespace-nowrap px-3 text-[13.5px] font-medium", tab === v ? "text-ink" : "text-ink-muted hover:text-ink")}>
            {l}
            {tab === v && <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-laterite" />}
          </button>
        ))}
      </div>
      {tab === "flash" && <Flash />}
      {tab === "range" && <Trends />}
      {tab === "payments" && <Payments />}
      {tab === "shifts" && <ShiftsReportView />}
      {tab === "digest" && <DigestView />}
      {tab === "audit" && <AuditRuns />}
    </>
  );
}

/* ---------------- daily flash ---------------- */

function Flash() {
  const today = todayKey();
  const [date, setDate] = useState(today);
  const q = useDailyFlash(date);
  const d = q.data;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-md border border-line bg-surface">
          <button onClick={() => setDate(addDays(date, -1))} className="grid h-9 w-9 place-items-center text-ink-muted hover:text-ink" aria-label="Previous day">
            <CaretLeft size={14} weight="bold" />
          </button>
          <span className="min-w-[160px] border-x border-line px-3 text-center text-[13.5px] font-medium leading-9 text-ink">
            {formatDay(date, { weekday: "long", day: "numeric", month: "short" })}
          </span>
          <button onClick={() => setDate(addDays(date, 1))} disabled={date >= today} className="grid h-9 w-9 place-items-center text-ink-muted hover:text-ink disabled:opacity-30" aria-label="Next day">
            <CaretRight size={14} weight="bold" />
          </button>
        </div>
        {d?.live && <Badge tone="palm" dot>Live, not yet audited</Badge>}
        <Button variant="ghost" size="sm" className="ml-auto" onClick={() => window.print()}>
          <Printer size={14} /> Print
        </Button>
      </div>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !d ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <FlashBody d={d} />
      )}
    </div>
  );
}

function FlashBody({ d }: { d: DailyFlash }) {
  const occ = d.occupancyRate;
  return (
    <>
      <Panel className="grid overflow-hidden md:grid-cols-[300px_1fr]">
        <div className="flex items-center gap-5 border-b border-line px-6 py-6 md:border-b-0 md:border-r">
          <OccArc value={occ} />
          <div>
            <p className="display-sm text-[14px] italic text-ink-muted">Occupancy</p>
            <p className="font-mono text-[40px] leading-none tracking-tight text-ink" data-testid="flash-occupancy">
              {percent(occ)}
            </p>
            <p className="mt-1 text-[12.5px] text-ink-muted">
              <span className="font-mono text-ink">{d.roomsSold}</span> of <span className="font-mono text-ink">{d.roomsAvailable}</span> rooms sold
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 divide-line sm:grid-cols-4 sm:divide-x [&>*]:border-line max-sm:[&>*:nth-child(-n+2)]:border-b max-sm:[&>*:nth-child(odd)]:border-r">
          <Tile label="Revenue" value={nairaCompact(d.totalRevenueKobo)} sub="excl. tax" />
          <Tile label="ADR" value={nairaCompact(d.adrKobo)} sub="average daily rate" />
          <Tile label="RevPAR" value={nairaCompact(d.revparKobo)} sub="per available room" />
          <Tile label="Collected" value={nairaCompact(d.paymentsTotalKobo)} sub={d.refundsKobo ? `${naira(d.refundsKobo)} refunded` : "all methods"} />
        </div>
      </Panel>
      <div className="grid gap-6 lg:grid-cols-12">
        <Panel className="lg:col-span-7">
          <PanelHeader eyebrow="Where the money came in" title="Payments by method" />
          <div className="px-5 py-5">
            <MethodBar
              items={METHOD_ORDER.map((m) => ({ key: m, label: PAYMENT_METHODS[m].label, value: d.paymentsByMethod[m] ?? 0, color: PAYMENT_METHODS[m].color, display: naira(d.paymentsByMethod[m] ?? 0) }))}
            />
          </div>
        </Panel>
        <Panel className="lg:col-span-5">
          <PanelHeader eyebrow="The house" title="Movement" />
          <dl className="grid grid-cols-2 gap-px bg-line">
            {[
              ["Arrivals", d.arrivals],
              ["Departures", d.departures],
              ["Day use", d.dayUseCount],
              ["In house", d.guestsInHouse],
              ["No-shows", d.noShows],
              ["Cancellations", d.cancellations],
            ].map(([k, v]) => (
              <div key={k} className="bg-surface px-5 py-3.5">
                <dt className="text-[12.5px] text-ink-muted">{k}</dt>
                <dd className="font-mono text-[22px] leading-tight text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
      </div>
      <Panel>
        <PanelHeader eyebrow="Revenue build-up" title="From rooms to the bottom line" />
        <dl className="grid gap-x-10 px-5 py-4 text-[13.5px] sm:grid-cols-2">
          {[
            ["Room revenue", d.roomRevenueKobo],
            ["Day-use revenue", d.dayUseRevenueKobo],
            ["Other charges", d.otherRevenueKobo],
            ["Discounts", -d.discountKobo],
            ["Taxes collected", d.taxKobo],
            ["Service charge", d.serviceChargeKobo],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between border-b border-dashed border-line py-2">
              <dt className="text-ink-muted">{k}</dt>
              <dd className="font-mono text-ink">
                {(v as number) < 0 ? "−" : ""}
                {naira(Math.abs(v as number))}
              </dd>
            </div>
          ))}
        </dl>
      </Panel>
    </>
  );
}

function OccArc({ value }: { value: number }) {
  const r = 34;
  const c = Math.PI * r;
  return (
    <svg width="88" height="52" viewBox="0 0 88 52" aria-hidden>
      <path d={`M10 46 A${r} ${r} 0 0 1 78 46`} fill="none" style={{ stroke: "var(--surface-2)" }} strokeWidth="8" strokeLinecap="round" />
      <path
        d={`M10 46 A${r} ${r} 0 0 1 78 46`}
        fill="none"
        style={{ stroke: "var(--laterite)", transition: "stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)" }}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, value))}
      />
    </svg>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-1.5 px-5 py-5">
      <span className="display-sm text-[14px] italic text-ink-muted">{label}</span>
      <span className="font-mono text-[26px] leading-none tracking-tight text-ink md:text-[30px]">{value}</span>
      {sub && <span className="text-[12px] text-ink-faint">{sub}</span>}
    </div>
  );
}

/* ---------------- trends ---------------- */

function useRange(days: number) {
  const to = todayKey();
  return { from: addDays(to, -(days - 1)), to };
}

function RangePicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <Segmented<string>
      label="Range"
      size="sm"
      value={String(value)}
      onChange={(v) => onChange(Number(v))}
      options={[
        { value: "7", label: "7 days" },
        { value: "30", label: "30 days" },
        { value: "90", label: "90 days" },
      ]}
    />
  );
}

function Trends() {
  const [days, setDays] = useState(30);
  const { from, to } = useRange(days);
  const q = useRangeReport(from, to);
  const d = q.data;
  const fx = (x: string) => formatDay(x, days > 31 ? { day: "numeric", month: "short" } : { day: "numeric", month: "short" });
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <RangePicker value={days} onChange={setDays} />
        <span className="text-[12.5px] text-ink-muted">
          {formatDay(from, { day: "numeric", month: "short" })} to {formatDay(to, { day: "numeric", month: "short" })}
        </span>
      </div>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !d ? (
        <Skeleton className="h-[520px] w-full" />
      ) : (
        <>
          <Panel className="grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x [&>*]:border-line max-md:[&>*:nth-child(-n+2)]:border-b max-md:[&>*:nth-child(odd)]:border-r">
            <Tile label="Occupancy" value={percent(d.totals.occupancyRate)} sub={`${d.totals.roomsSold} room-nights sold`} />
            <Tile label="ADR" value={nairaCompact(d.totals.adrKobo)} />
            <Tile label="RevPAR" value={nairaCompact(d.totals.revparKobo)} />
            <Tile label="Revenue" value={nairaCompact(d.totals.totalRevenueKobo)} sub={`${d.totals.dayUseCount} day-use stays`} />
          </Panel>
          <Panel>
            <PanelHeader eyebrow="Each night" title="Occupancy" />
            <div className="px-5 py-4">
              <LineChart
                data={d.days.map((x) => ({ x: x.date, y: x.occupancyRate * 100 }))}
                label="Occupancy by night"
                seriesLabel="Occupancy"
                max={100}
                formatY={(v) => `${Math.round(v)}%`}
                formatX={fx}
              />
            </div>
          </Panel>
          <Panel>
            <PanelHeader eyebrow="Each day" title="Payments collected, by method" />
            <div className="px-5 py-4">
              <StackedColumns
                data={d.days.map((x) => ({ x: x.date, values: x.paymentsByMethod as unknown as Record<string, number> }))}
                series={METHOD_ORDER.filter((m) => d.days.some((x) => (x.paymentsByMethod[m] ?? 0) > 0)).map((m) => ({ key: m, label: PAYMENT_METHODS[m].short, color: PAYMENT_METHODS[m].color }))}
                label="Payments by method per day"
                formatY={(v) => nairaCompact(v)}
                formatX={fx}
              />
            </div>
          </Panel>
          <Panel>
            <PanelHeader eyebrow="Each night" title="Average daily rate" />
            <div className="px-5 py-4">
              <LineChart data={d.days.map((x) => ({ x: x.date, y: x.adrKobo }))} label="ADR by night" seriesLabel="ADR" color="var(--m-transfer)" formatY={(v) => nairaCompact(v)} formatX={fx} height={170} />
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

/* ---------------- payments ---------------- */

function Payments() {
  const [days, setDays] = useState(7);
  const { from, to } = useRange(days);
  const q = usePaymentsReport(from, to);
  const d = q.data;
  const byUser = useMemo(() => {
    const m = new Map<string, { name: string; total: number; count: number; methods: Record<string, number> }>();
    for (const r of d?.byUser ?? []) {
      const x = m.get(r.user.id) ?? { name: r.user.fullName, total: 0, count: 0, methods: {} };
      x.total += r.amountKobo;
      x.count += r.count;
      x.methods[r.method] = (x.methods[r.method] ?? 0) + r.amountKobo;
      m.set(r.user.id, x);
    }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [d]);
  return (
    <div className="flex flex-col gap-6">
      <RangePicker value={days} onChange={setDays} />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !d ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <Panel className="lg:col-span-5">
            <PanelHeader eyebrow={`${formatDay(from, { day: "numeric", month: "short" })} to ${formatDay(to, { day: "numeric", month: "short" })}`} title={naira(d.totalKobo)} description="Net of voids, refunds taken off." />
            <div className="px-5 py-5">
              <MethodBar
                items={METHOD_ORDER.map((m) => {
                  const x = d.byMethod.find((b) => b.method === m);
                  return { key: m, label: `${PAYMENT_METHODS[m].label}${x ? ` · ${x.count}` : ""}`, value: x?.amountKobo ?? 0, color: PAYMENT_METHODS[m].color, display: naira(x?.amountKobo ?? 0) };
                })}
              />
            </div>
          </Panel>
          <Panel className="lg:col-span-7">
            <PanelHeader eyebrow="Who took it" title="By staff member" />
            <ul className="divide-y divide-line">
              {byUser.map((u) => (
                <li key={u.name} className="px-5 py-3">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[14px] text-ink">{u.name}</span>
                    <span className="font-mono text-[14px] text-ink">{naira(u.total)}</span>
                  </div>
                  <div className="mt-2 flex h-2 gap-[2px] overflow-hidden rounded-[2px]">
                    {METHOD_ORDER.filter((m) => u.methods[m]).map((m) => (
                      <span key={m} style={{ width: `${(u.methods[m] / u.total) * 100}%`, background: PAYMENT_METHODS[m].color }} title={`${PAYMENT_METHODS[m].label} ${naira(u.methods[m])}`} />
                    ))}
                  </div>
                  <p className="mt-1.5 text-[11.5px] text-ink-muted">
                    {u.count} payments &middot;{" "}
                    {METHOD_ORDER.filter((m) => u.methods[m])
                      .map((m) => `${PAYMENT_METHODS[m].short} ${nairaCompact(u.methods[m])}`)
                      .join(" · ")}
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}
    </div>
  );
}

/* ---------------- shifts ---------------- */

function ShiftsReportView() {
  const [days, setDays] = useState(30);
  const { from, to } = useRange(days);
  const q = useShiftsReport(from, to);
  const d = q.data;
  return (
    <div className="flex flex-col gap-6">
      <RangePicker value={days} onChange={setDays} />
      {!d ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <>
          <Panel className="grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x [&>*]:border-line max-md:[&>*:nth-child(-n+2)]:border-b max-md:[&>*:nth-child(odd)]:border-r">
            <Tile label="Shifts" value={String(d.totals.shifts)} sub={`${d.totals.flagged} flagged`} />
            <Tile label="Cash expected" value={nairaCompact(d.totals.expectedCashKobo)} />
            <Tile label="Cash counted" value={nairaCompact(d.totals.countedCashKobo)} />
            <div className="flex flex-col gap-1.5 px-5 py-5">
              <span className="display-sm text-[14px] italic text-ink-muted">Cash variance</span>
              <span className="text-[26px] leading-none md:text-[30px]">
                <VarianceChip v={d.totals.varianceCashKobo} />
              </span>
            </div>
          </Panel>
          <Panel className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left">
                  {["Date", "Cashier", "Float", "Expected", "Counted", "Cash", "POS", "Transfer", "Status"].map((h) => (
                    <th key={h} className="eyebrow py-2.5 pr-3 text-[10px] font-normal first:pl-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {d.items.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="py-2.5 pl-5 pr-3 text-ink">{formatDate(s.openedAt, { day: "numeric", month: "short", year: undefined })}</td>
                    <td className="py-2.5 pr-3 text-ink">{s.user.fullName}</td>
                    <td className="py-2.5 pr-3 font-mono text-ink-muted">{naira(s.openingFloatKobo)}</td>
                    <td className="py-2.5 pr-3 font-mono text-ink-muted">{naira(s.expectedCashKobo, "-")}</td>
                    <td className="py-2.5 pr-3 font-mono text-ink">{naira(s.countedCashKobo, "-")}</td>
                    <td className="py-2.5 pr-3"><VarianceChip v={s.varianceCashKobo} /></td>
                    <td className="py-2.5 pr-3"><VarianceChip v={s.variancePosKobo} /></td>
                    <td className="py-2.5 pr-3"><VarianceChip v={s.varianceTransferKobo} /></td>
                    <td className="py-2.5 pr-5">
                      <Badge tone={s.status === "APPROVED" ? "neutral" : "brass"}>{s.status === "APPROVED" ? "Approved" : "Waiting"}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </>
      )}
    </div>
  );
}

/* ---------------- digest ---------------- */

function DigestView() {
  const { has, loading } = useEntitlements();
  const { can } = useCan();
  const on = has("owner_whatsapp_alerts");
  const q = useDigests(1, on);
  const [sel, setSel] = useState<string | null>(null);
  const refresh = useDeskRefresh();
  const send = useMutation({
    mutationFn: () => digestsApi.send(),
    onSuccess: async (d) => {
      await refresh([["digests"]]);
      setSel(d.id);
      toast.success(d.status === "SENT" ? "Digest sent on WhatsApp" : "Digest composed", d.status === "LOGGED" ? "WhatsApp isn't connected yet, so it was logged here." : undefined);
    },
    meta: { errorTitle: "Digest not sent" },
  });
  if (!loading && !on) return <LockedInline feature="owner_whatsapp_alerts" text="Tonight's takings, occupancy and red flags on the owner's phone at 23:00." />;
  const list = q.data?.items ?? [];
  const current: Digest | undefined = list.find((d) => d.id === sel) ?? list[0];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
      <Panel className="self-start overflow-hidden">
        <PanelHeader
          eyebrow="Every night at 23:00"
          title="Owner digest"
          description="What was sent to the owner's WhatsApp each night."
          actions={
            can("digest.manage") && (
              <Button size="sm" variant="secondary" onClick={() => send.mutate()} loading={send.isPending}>
                <PaperPlaneTilt size={14} /> Send today&rsquo;s now
              </Button>
            )
          }
        />
        {q.isLoading ? (
          <Skeleton className="m-5 h-48" />
        ) : !list.length ? (
          <EmptyState compact glyph="river" title="No digests yet" body="The first one goes out tonight at 23:00." />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => setSel(d.id)}
                  className={cn("grid w-full grid-cols-[1fr_auto] items-center gap-3 px-5 py-3 text-left hover:bg-surface-2/50", current?.id === d.id && "bg-surface-2/70")}
                >
                  <span>
                    <span className="block text-[14px] text-ink">{formatDay(d.businessDate, { weekday: "short", day: "numeric", month: "short" })}</span>
                    <span className="block text-[12px] text-ink-muted">
                      {percent(d.data.occupancyRate)} occupied &middot; {nairaCompact(d.data.totalRevenueKobo)} &middot; {d.data.openFlags} {d.data.openFlags === 1 ? "flag" : "flags"}
                    </span>
                  </span>
                  <Badge tone={d.status === "SENT" ? "palm" : d.status === "FAILED" ? "danger" : "neutral"}>{d.status === "SENT" ? "Sent" : d.status === "FAILED" ? "Failed" : "Logged"}</Badge>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <div className="lg:sticky lg:top-20 lg:self-start">{current ? <PhonePreview digest={current} /> : <Skeleton className="h-[640px] w-full rounded-[40px]" />}</div>
    </div>
  );
}

/* ---------------- night audit ---------------- */

function AuditRuns() {
  const q = useAuditRuns();
  const { can } = useCan();
  const refresh = useDeskRefresh();
  const run = useMutation({
    mutationFn: () => reportsApi.runAudit(),
    onSuccess: async (r) => {
      await refresh([["reports"]]);
      toast.success(r.alreadyRun ? "Already audited" : "Night audit finished", `${formatDay(r.businessDate)}: ${r.summary?.roomChargesPosted ?? 0} room charges posted.`);
    },
    meta: { errorTitle: "Audit failed" },
  });
  return (
    <Panel>
      <PanelHeader
        eyebrow="Every night at 02:00"
        title="Night audit"
        description="Posts the night's room charges, marks no-shows, runs Revenue Guard and closes the day's figures."
        actions={
          can("audit.run") && (
            <Button size="sm" variant="secondary" onClick={() => run.mutate()} loading={run.isPending}>
              <ArrowClockwise size={14} /> Run for yesterday
            </Button>
          )
        }
      />
      {!q.data ? (
        <Skeleton className="m-5 h-40" />
      ) : (
        <ul className="divide-y divide-line">
          {q.data.items.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-x-5 gap-y-1 px-5 py-3">
              <Moon size={16} weight="duotone" className="text-adire" />
              <span className="w-28 text-[13.5px] text-ink">{formatDay(r.businessDate, { weekday: "short", day: "numeric", month: "short" })}</span>
              <Badge tone={r.status === "COMPLETED" ? "palm" : r.status === "FAILED" ? "danger" : "brass"}>{r.status === "COMPLETED" ? "Done" : r.status === "FAILED" ? "Failed" : "Running"}</Badge>
              <span className="flex-1 text-[12.5px] text-ink-muted">
                {r.summary ? `${r.summary.roomChargesPosted} room charges (${nairaCompact(r.summary.roomChargesKobo)}), ${r.summary.noShows} no-shows, ${r.summary.flagsCreated} flags` : r.error}
              </span>
              <span className="font-mono text-[11.5px] text-ink-faint">
                {r.trigger === "MANUAL" ? `by ${r.runBy?.fullName ?? "staff"}` : `at ${lagosHHMM(r.startedAt)}`} &middot; {relativeTime(r.startedAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
