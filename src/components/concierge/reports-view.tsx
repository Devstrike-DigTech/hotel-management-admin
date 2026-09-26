"use client";

import { useMemo, useState } from "react";
import { ChartBar, DownloadSimple, Star } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { apiRaw } from "@/lib/api/client";
import { conciergeApi } from "@/lib/api/endpoints-m8";
import { useConciergeAccess, useConciergeReport, useConciergeSettings } from "@/lib/api/hooks-m8";
import type { ConciergeReport } from "@/lib/api/types-m8";
import { addDays, formatDay, todayKey } from "@/lib/dates";
import { naira, nairaCompact } from "@/lib/format";
import { toast } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { LockedInline } from "@/components/gating/gate";
import { EmptyState, ErrorState, PageHeader, Panel, PanelHeader, Segmented, Skeleton } from "@/components/ui/primitives";
import { RequireAny } from "@/components/m7/routes";
import { categoryMeta } from "./catalog";
import { CategoryGlyph, DISCREET_HOLDERS } from "./bits";
import { ConciergeTabs } from "./tabs";

type Range = "7" | "30" | "90";

export function ReportsView() {
  return (
    <RequireAny caps={["concierge.reports"]} what="Concierge reports">
      <Reports />
    </RequireAny>
  );
}

function Reports() {
  const [range, setRange] = useState<Range>("30");
  const to = todayKey();
  const from = addDays(to, -(Number(range) - 1));
  const q = useConciergeReport({ from, to });
  const access = useConciergeAccess();
  const settings = useConciergeSettings();
  const [downloading, setDownloading] = useState(false);
  const r = q.data;

  const download = async () => {
    setDownloading(true);
    try {
      const res = await apiRaw(conciergeApi.exportPath, { query: { from, to, format: "csv" } });
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `concierge-${from}-to-${to}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Export downloaded", access.discreet ? "Private requests are included; the export is logged." : `Private requests are left out; they're for ${DISCREET_HOLDERS}.`);
    } catch (e) {
      toast.error("Export failed", e instanceof Error ? e.message : undefined);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <ChartBar size={14} weight="duotone" /> Concierge
          </>
        }
        title={
          <>
            What the desk <em>arranged</em>.
          </>
        }
        description="Requests by kind, how fast guests heard back, what it earned, what vendors are owed and how guests rated it. Private requests are counted, never named."
        actions={
          <>
            <Segmented<Range> label="Period" size="sm" value={range} onChange={setRange} options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]} />
            <Button size="sm" variant="secondary" onClick={download} loading={downloading} data-testid="concierge-export">
              <DownloadSimple size={14} /> CSV
            </Button>
          </>
        }
      />
      <ConciergeTabs />
      {q.isError ? (
        <Panel>
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </Panel>
      ) : !r ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-28 md:col-span-2" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
      ) : !r.totals.requests ? (
        <Panel>
          <EmptyState glyph="rings" title="Nothing in this period" body="Reports fill in as requests come and go." />
        </Panel>
      ) : (
        <div className="flex flex-col gap-6" data-testid="concierge-reports">
          <Panel className="grid grid-cols-2 divide-line sm:grid-cols-3 lg:grid-cols-6 lg:divide-x max-lg:[&>*]:border-b max-lg:[&>*]:border-line">
            {[
              { k: "Requests", v: r.totals.requests.toLocaleString("en-NG"), s: `${r.totals.completed} done, ${r.totals.discreet} private` },
              { k: "Revenue", v: nairaCompact(r.revenue.totalKobo), s: `${nairaCompact(r.revenue.netKobo)} before tax` },
              { k: "First answer", v: r.responseTimes.medianMinutes == null ? "–" : `${r.responseTimes.medianMinutes} min`, s: "median" },
              { k: "On time", v: r.responseTimes.withinSlaPct == null ? "–" : `${Math.round(r.responseTimes.withinSlaPct)}%`, s: "within your target" },
              { k: "Guest rating", v: r.ratings.average == null ? "–" : r.ratings.average.toFixed(1), s: `from ${r.ratings.count}` },
              { k: "Held for review", v: String(r.totals.flagged), s: `${r.totals.declined} declined` },
            ].map((c) => (
              <div key={c.k} className="flex flex-col gap-1 px-5 py-4">
                <span className="display-sm text-[13.5px] italic text-ink-muted">{c.k}</span>
                <span className="font-mono text-[26px] leading-none text-ink">{c.v}</span>
                <span className="truncate text-[11.5px] text-ink-faint">{c.s}</span>
              </div>
            ))}
          </Panel>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-2">
            <Panel>
              <PanelHeader title="By kind of service" description="Requests, with what each kind earned before tax." />
              <CategoryBars data={r.byCategory} />
            </Panel>
            <Panel>
              <PanelHeader title="How fast guests heard back" description="Time to the first answer, against your targets." />
              <ResponseRuler rt={r.responseTimes} inStay={settings.data?.sla.inStayMinutes ?? 15} preArrival={settings.data?.sla.preArrivalMinutes ?? 120} />
            </Panel>
          </div>

          <Panel>
            <PanelHeader title="Requests by day" />
            <DayColumns data={r.byDay} />
          </Panel>

          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <Panel className="overflow-hidden">
              <PanelHeader title="Vendors" description={r.vendorCommission ? "Jobs, what they earned, your commission and what's still owed to them." : "Jobs and ratings."} />
              {r.vendorCommission ? <VendorTable data={r.vendorCommission} /> : <div className="p-5"><LockedInline feature="concierge_vendors" text="See each vendor's commission and what you still owe them." /></div>}
              {r.vendorRatings.length > 0 && !r.vendorCommission && <VendorRatings data={r.vendorRatings} />}
            </Panel>
            <Panel>
              <PanelHeader title="How guests rated it" description="After each completed request." />
              <RatingSpread dist={r.ratings.distribution} />
              <RevenueSplit rev={r.revenue} />
            </Panel>
          </div>
        </div>
      )}
    </>
  );
}

function SrTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <table className="sr-only">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j}>{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function CategoryBars({ data }: { data: ConciergeReport["byCategory"] }) {
  const rows = [...data].sort((a, b) => b.requests - a.requests);
  const max = Math.max(1, ...rows.map((r) => r.requests));
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div className="px-5 py-4">
      <ul className="flex flex-col gap-2.5" aria-hidden>
        {rows.map((r) => {
          const w = r.requests / max;
          return (
            <li key={r.category} className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_72px] items-center gap-3 text-[12.5px]" onMouseEnter={() => setHover(r.category)} onMouseLeave={() => setHover(null)}>
              <span className="flex min-w-0 items-center gap-1.5 text-ink">
                <CategoryGlyph category={r.category} size={14} className="shrink-0 text-ink-muted" />
                <span className="truncate">{r.label || categoryMeta(r.category).label}</span>
              </span>
              <span className="relative flex h-4 items-center">
                <span className="h-full rounded-r-[4px] bg-laterite transition-opacity" style={{ width: `${w * 100}%`, opacity: hover && hover !== r.category ? 0.35 : 0.88 }} />
                <span className="pl-1.5 font-mono text-[11px] text-ink">
                  {r.requests}
                  {hover === r.category && <span className="text-ink-muted"> &middot; {r.completed} done</span>}
                </span>
              </span>
              <span className="text-right font-mono text-ink-muted">{nairaCompact(r.revenueNetKobo)}</span>
            </li>
          );
        })}
      </ul>
      <SrTable caption="Requests by kind of service" head={["Kind", "Requests", "Completed", "Revenue before tax"]} rows={rows.map((r) => [r.label, r.requests, r.completed, naira(r.revenueNetKobo)])} />
    </div>
  );
}

/** Median and slowest-tenth answer times on one ruler, with the targets marked (a far pre-arrival target is noted at the end). */
function ResponseRuler({ rt, inStay, preArrival }: { rt: ConciergeReport["responseTimes"]; inStay: number; preArrival: number }) {
  const top = Math.ceil(Math.max(30, inStay * 2.5, (rt.p90Minutes ?? 0) * 1.35) / 5) * 5;
  const x = (m: number) => `${Math.min(100, (m / top) * 100)}%`;
  const within = rt.withinSlaPct ?? 0;
  const marks = [{ m: inStay, label: "in-stay target" }, ...(preArrival <= top ? [{ m: preArrival, label: "pre-arrival target" }] : [])];
  return (
    <div className="flex flex-col gap-5 px-5 py-5">
      <div aria-hidden>
        <div className="relative h-20">
          <div className="absolute inset-x-0 top-10 h-3 rounded-xs bg-surface-2" />
          {rt.p90Minutes != null && <div className="absolute left-0 top-10 h-3 rounded-r-[4px] bg-adire/35" style={{ width: x(rt.p90Minutes) }} />}
          {rt.medianMinutes != null && <div className="absolute left-0 top-10 h-3 rounded-r-[4px] bg-adire" style={{ width: x(rt.medianMinutes) }} />}
          {marks.map((t) => (
            <div key={t.label} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: x(t.m) }}>
              <span className="whitespace-nowrap text-[10.5px] text-ink-muted">{t.label}</span>
              <span className="font-mono text-[10.5px] text-ink">{t.m} min</span>
              <span className="mt-0.5 h-8 border-l border-dashed border-ink" />
            </div>
          ))}
        </div>
        <div className="relative mt-1 h-4 font-mono text-[10.5px] text-ink-faint">
          <span className="absolute left-0">0</span>
          <span className="absolute right-0">{preArrival > top ? `${top} min · pre-arrival target ${preArrival} min` : `${top} min`}</span>
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-3 text-[12.5px]">
        <div>
          <dt className="flex items-center gap-1.5 text-ink-muted">
            <span className="h-2.5 w-3 rounded-xs bg-adire" /> Median
          </dt>
          <dd className="font-mono text-[20px] text-ink">{rt.medianMinutes == null ? "–" : `${rt.medianMinutes} min`}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-ink-muted">
            <span className="h-2.5 w-3 rounded-xs bg-adire/35" /> Slowest tenth
          </dt>
          <dd className="font-mono text-[20px] text-ink">{rt.p90Minutes == null ? "–" : `${rt.p90Minutes} min`}</dd>
        </div>
        <div>
          <dt className="text-ink-muted">Late right now</dt>
          <dd className={cn("font-mono text-[20px]", rt.overdueNow ? "text-laterite" : "text-ink")}>{rt.overdueNow}</dd>
        </div>
      </dl>
      <div>
        <div className="mb-1 flex justify-between text-[12px] text-ink-muted">
          <span>Answered within target</span>
          <span className="font-mono text-ink">{rt.withinSlaPct == null ? "–" : `${Math.round(within)}%`}</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-xs bg-surface-2" role="meter" aria-label="Answered within target" aria-valuenow={Math.round(within)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-palm" style={{ width: `${within}%` }} />
        </div>
        {rt.escalated > 0 && <p className="mt-2 text-[12px] text-ink-muted">{rt.escalated} went to a manager for being late.</p>}
      </div>
    </div>
  );
}

function DayColumns({ data }: { data: ConciergeReport["byDay"] }) {
  const max = Math.max(1, ...data.map((d) => d.requests));
  const [hover, setHover] = useState<number | null>(null);
  const ticks = useMemo(() => {
    const step = Math.max(1, Math.ceil(data.length / 7));
    return new Set(data.map((_, i) => i).filter((i) => i % step === 0));
  }, [data]);
  return (
    <div className="px-5 py-4">
      <div className="relative flex h-36 items-end gap-[2px] border-b border-line" aria-hidden>
        {data.map((d, i) => (
          <div key={d.date} className="relative flex h-full min-w-0 flex-1 items-end" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
            <div className="w-full rounded-t-[4px] bg-laterite transition-opacity" style={{ height: `${d.requests ? Math.max(3, (d.requests / max) * 100) : 0}%`, opacity: hover !== null && hover !== i ? 0.35 : 0.85 }} />
            {hover === i && (
              <span className={cn("absolute bottom-full z-10 mb-1 whitespace-nowrap rounded-sm bg-ink px-2 py-1 text-[11px] text-paper", i > data.length / 2 ? "right-0" : "left-0")}>
                {formatDay(d.date)} &middot; <span className="font-mono">{d.requests}</span> asked, <span className="font-mono">{d.completed}</span> done
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="relative mt-1.5 h-4 font-mono text-[10.5px] text-ink-faint" aria-hidden>
        {data.map((d, i) =>
          ticks.has(i) ? (
            <span key={d.date} className="absolute whitespace-nowrap" style={{ left: `${(i / data.length) * 100}%` }}>
              {formatDay(d.date, { day: "numeric", month: "short" })}
            </span>
          ) : null,
        )}
      </div>
      <SrTable caption="Requests by day" head={["Day", "Requests", "Completed"]} rows={data.map((d) => [d.date, d.requests, d.completed])} />
    </div>
  );
}

function VendorTable({ data }: { data: NonNullable<ConciergeReport["vendorCommission"]> }) {
  if (!data.length) return <p className="px-5 py-6 text-[13px] text-ink-muted">No vendor jobs in this period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.1em] text-ink-muted">
            <th className="px-5 py-2 font-medium">Vendor</th>
            <th className="px-3 py-2 text-right font-medium">Jobs</th>
            <th className="px-3 py-2 text-right font-medium">Earned</th>
            <th className="px-3 py-2 text-right font-medium">Yours</th>
            <th className="px-5 py-2 text-right font-medium">Still owed</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {data.map((v) => (
            <tr key={v.vendorId}>
              <td className="px-5 py-2.5 text-ink">{v.name}</td>
              <td className="px-3 py-2.5 text-right font-mono">{v.jobs}</td>
              <td className="px-3 py-2.5 text-right font-mono">{naira(v.netKobo)}</td>
              <td className="px-3 py-2.5 text-right font-mono">{naira(v.commissionKobo)}</td>
              <td className="px-5 py-2.5 text-right font-mono">{naira(v.payableKobo - v.settledKobo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VendorRatings({ data }: { data: ConciergeReport["vendorRatings"] }) {
  return (
    <ul className="divide-y divide-line border-t border-line">
      {data.map((v) => (
        <li key={v.vendorId} className="flex items-center justify-between px-5 py-2 text-[13px]">
          <span className="text-ink">{v.name}</span>
          <span className="inline-flex items-center gap-1 font-mono text-ink">
            <Star size={12} weight="fill" className="text-brass" /> {v.average == null ? "–" : v.average.toFixed(1)} <span className="text-ink-faint">({v.count})</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function RatingSpread({ dist }: { dist: ConciergeReport["ratings"]["distribution"] }) {
  const rows = ([5, 4, 3, 2, 1] as const).map((s) => ({ s, c: dist[String(s) as "1"] ?? 0 }));
  const total = rows.reduce((a, b) => a + b.c, 0);
  const max = Math.max(1, ...rows.map((r) => r.c));
  if (!total) return <p className="px-5 py-6 text-[13px] text-ink-muted">No ratings yet.</p>;
  return (
    <ul className="flex flex-col gap-2 px-5 py-4">
      {rows.map(({ s, c }) => (
        <li key={s} className="grid grid-cols-[34px_minmax(0,1fr)_32px] items-center gap-3 text-[12.5px]">
          <span className="inline-flex items-center gap-1 font-mono text-ink">
            {s} <Star size={11} weight="fill" className="text-brass" />
          </span>
          <span className="h-2.5 rounded-r-[4px] bg-surface-2">
            <span className="block h-full rounded-r-[4px] bg-brass" style={{ width: `${(c / max) * 100}%` }} />
          </span>
          <span className="text-right font-mono text-ink-muted">{c}</span>
        </li>
      ))}
    </ul>
  );
}

function RevenueSplit({ rev }: { rev: ConciergeReport["revenue"] }) {
  const total = rev.online + rev.folio;
  if (!total) return null;
  const pct = (rev.online / total) * 100;
  return (
    <div className="border-t border-line px-5 py-4">
      <p className="mb-2 text-[12.5px] text-ink-muted">How it was paid</p>
      <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-xs" aria-hidden>
        <span className="bg-adire" style={{ width: `${pct}%` }} />
        <span className="flex-1 bg-brass" />
      </div>
      <p className="mt-2 flex justify-between text-[12px]">
        <span className="inline-flex items-center gap-1.5 text-ink">
          <span className="h-2 w-2 rounded-xs bg-adire" /> Online <span className="font-mono">{rev.online}</span>
        </span>
        <span className="inline-flex items-center gap-1.5 text-ink">
          <span className="h-2 w-2 rounded-xs bg-brass" /> On the bill <span className="font-mono">{rev.folio}</span>
        </span>
      </p>
    </div>
  );
}
