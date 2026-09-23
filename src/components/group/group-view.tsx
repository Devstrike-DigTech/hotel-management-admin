"use client";

import { useMemo, useState } from "react";
import { TreeStructure } from "@phosphor-icons/react";
import { useGroupReport, useMyProperties } from "@/lib/api/hooks-m5";
import type { GroupReport, GroupRow } from "@/lib/api/types-m5";
import { addDays, formatDay, todayKey } from "@/lib/dates";
import { naira, nairaCompact, number, percent } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useSwitchProperty } from "@/components/shell/property-switcher";
import { Button } from "@/components/ui/button";
import { ErrorState, PageHeader, Panel, PanelHeader, Segmented, Skeleton, Stat } from "@/components/ui/primitives";
import { TipRow, Tooltip, axisText, niceMax, useWidth } from "@/components/reports/charts";

/** Series colours for properties, in the validated categorical order. */
export const PROPERTY_COLORS = ["var(--season-2)", "var(--season-1)", "var(--season-4)", "var(--season-3)", "var(--season-5)"];

type Range = "7" | "30" | "90";

export function GroupView() {
  const today = todayKey();
  const [range, setRange] = useState<Range>("30");
  const from = addDays(today, -Number(range));
  const to = addDays(today, -1);
  const props = useMyProperties();
  const all = useMemo(() => props.data?.items ?? [], [props.data]);
  const [off, setOff] = useState<Set<string>>(new Set());
  const ids = all.filter((p) => !off.has(p.id)).map((p) => p.id);
  const q = useGroupReport(from, to, off.size ? ids : [], all.length > 0);
  const r = q.data;
  const colorOf = useMemo(() => new Map(all.map((p, i) => [p.id, PROPERTY_COLORS[i % PROPERTY_COLORS.length]])), [all]);
  const switchTo = useSwitchProperty();
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <TreeStructure size={14} weight="duotone" /> Group reports &middot; all properties
          </>
        }
        title={
          <>
            The whole group, <em>side by side</em>.
          </>
        }
        description="Occupancy, ADR, RevPAR and revenue for every property you can see, added up for the group and compared night by night."
        actions={
          <Segmented
            size="sm"
            label="Period"
            value={range}
            onChange={setRange}
            options={[
              { value: "7", label: "7 days" },
              { value: "30", label: "30 days" },
              { value: "90", label: "90 days" },
            ]}
          />
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="Properties in the report">
        {all.map((p) => {
          const on = !off.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => setOff((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else if (n.size < all.length - 1) n.add(p.id); return n; })}
              className={cn("inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium transition-colors", on ? "border-ink bg-surface text-ink" : "border-dashed border-line-strong text-ink-faint")}
            >
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: on ? colorOf.get(p.id) : "var(--line-strong)" }} />
              {p.name}
            </button>
          );
        })}
        <span className="text-[12px] text-ink-muted">
          {formatDay(from, { day: "numeric", month: "short" })} to {formatDay(to, { day: "numeric", month: "short", year: "numeric" })}
        </span>
      </div>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !r ? (
        <div className="grid gap-4">
          <Skeleton className="h-28" />
          <Skeleton className="h-72" />
        </div>
      ) : (
        <div className={cn("flex flex-col gap-5 transition-opacity", q.isPlaceholderData && "opacity-60")}>
          <Panel className="grid grid-cols-2 gap-6 p-5 sm:p-6 lg:grid-cols-5">
            <Stat label="Occupancy" value={<span data-testid="group-occupancy">{percent(r.totals.occupancyRate, 1)}</span>} sub={`${number(r.totals.roomsSold)} of ${number(r.totals.roomsAvailable)} room nights`} />
            <Stat label="ADR" value={nairaCompact(r.totals.adrKobo)} sub="average room rate" />
            <Stat label="RevPAR" value={nairaCompact(r.totals.revparKobo)} sub="per available room" />
            <Stat label="Revenue" value={nairaCompact(r.totals.totalRevenueKobo)} sub={`${nairaCompact(r.totals.posRevenueKobo)} from the outlets`} />
            <Stat label="To the OTAs" value={nairaCompact(r.totals.otaCommissionKobo)} sub="commission" />
          </Panel>
          <Compare r={r} colorOf={colorOf} onOpen={(id, name) => switchTo(id, name)} />
          <Panel>
            <PanelHeader eyebrow="Night by night" title="Occupancy, each property" />
            <div className="px-5 pb-5 pt-2">
              <MultiLine r={r} colorOf={colorOf} />
            </div>
          </Panel>
        </div>
      )}
    </>
  );
}

const METRICS: { key: keyof GroupRow; label: string; fmt: (v: number) => string }[] = [
  { key: "occupancyRate", label: "Occupancy", fmt: (v) => percent(v, 1) },
  { key: "adrKobo", label: "ADR", fmt: (v) => naira(v) },
  { key: "revparKobo", label: "RevPAR", fmt: (v) => naira(v) },
  { key: "roomRevenueKobo", label: "Rooms", fmt: (v) => nairaCompact(v) },
  { key: "posRevenueKobo", label: "Outlets", fmt: (v) => nairaCompact(v) },
  { key: "totalRevenueKobo", label: "Total revenue", fmt: (v) => nairaCompact(v) },
  { key: "paymentsKobo", label: "Money in", fmt: (v) => nairaCompact(v) },
  { key: "otaCommissionKobo", label: "OTA commission", fmt: (v) => nairaCompact(v) },
];

/** One row per metric, a bar per property scaled to the best of them. */
function Compare({ r, colorOf, onOpen }: { r: GroupReport; colorOf: Map<string, string>; onOpen: (id: string, name: string) => void }) {
  return (
    <Panel className="overflow-hidden">
      <PanelHeader eyebrow="Compare" title="Property by property" />
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]" data-testid="group-compare">
          <thead>
            <tr className="border-b border-line">
              <th className="w-[160px] px-5 py-3 text-left font-normal" />
              {r.properties.map((p) => (
                <th key={p.property.id} className="px-4 py-3 text-left font-normal">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: colorOf.get(p.property.id) }} />
                    <span className="display-sm truncate text-[15px] text-ink">{p.property.name}</span>
                  </span>
                  <span className="mt-0.5 block pl-[18px] text-[11.5px] text-ink-muted">
                    {p.property.area || p.property.city} &middot; {p.property.roomCount} rooms
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {METRICS.map((m) => {
              const vals = r.properties.map((p) => Number(p[m.key] ?? 0));
              const max = Math.max(1, ...vals);
              const best = vals.indexOf(Math.max(...vals));
              return (
                <tr key={m.key} className="border-b border-line last:border-b-0">
                  <th scope="row" className="px-5 py-2.5 text-left font-normal text-ink-muted">
                    {m.label}
                  </th>
                  {r.properties.map((p, i) => (
                    <td key={p.property.id} className="px-4 py-2.5">
                      <span className={cn("font-mono", i === best && m.key !== "otaCommissionKobo" ? "text-ink" : "text-ink-muted")}>{m.fmt(vals[i])}</span>
                      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-line" aria-hidden>
                        <span className="block h-full rounded-full" style={{ width: `${(vals[i] / max) * 100}%`, background: colorOf.get(p.property.id) }} />
                      </span>
                    </td>
                  ))}
                </tr>
              );
            })}
            <tr>
              <td />
              {r.properties.map((p) => (
                <td key={p.property.id} className="px-4 py-2.5">
                  <Button size="sm" variant="ghost" onClick={() => onOpen(p.property.id, p.property.name)}>
                    Work in {p.property.name.split(" ").slice(-1)[0]}
                  </Button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function MultiLine({ r, colorOf }: { r: GroupReport; colorOf: Map<string, string> }) {
  const { ref, w } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const height = 220;
  const padL = 40;
  const padB = 24;
  const padT = 10;
  const innerH = height - padB - padT;
  const days = r.byDay;
  const max = niceMax(Math.max(0.5, ...days.flatMap((d) => Object.values(d.byProperty).map((v) => v.occupancyRate))));
  const xAt = (i: number) => padL + (days.length <= 1 ? 0 : (i / (days.length - 1)) * (w - padL - 8));
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const every = Math.ceil(days.length / Math.max(2, Math.floor((w - padL) / 64)));
  return (
    <div className="relative" ref={ref}>
      <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} className="block" role="img" aria-label="Occupancy by night for each property" onMouseLeave={() => setHover(null)} onMouseMove={(e) => { const b = e.currentTarget.getBoundingClientRect(); const i = Math.round(((e.clientX - b.left - padL) / (w - padL - 8)) * (days.length - 1)); setHover(Math.max(0, Math.min(days.length - 1, i))); }}>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={padL} x2={w} y1={y(t)} y2={y(t)} style={{ stroke: "var(--line)" }} strokeDasharray={t ? "2 4" : undefined} />
            <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" style={axisText}>
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        {r.properties.map((p) => {
          const d = days.map((x, i) => `${i ? "L" : "M"}${xAt(i)} ${y(x.byProperty[p.property.id]?.occupancyRate ?? 0)}`).join(" ");
          return <path key={p.property.id} d={d} fill="none" style={{ stroke: colorOf.get(p.property.id) }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />;
        })}
        {days.map((d, i) =>
          i === days.length - 1 || (i % every === 0 && days.length - 1 - i >= every * 0.7) ? (
            <text key={d.date} x={xAt(i)} y={height - 7} textAnchor="middle" style={{ ...axisText, fill: "var(--ink-muted)" }}>
              {formatDay(d.date, { day: "numeric", month: "short" })}
            </text>
          ) : null,
        )}
        {hover !== null && days[hover] && (
          <g>
            <line x1={xAt(hover)} x2={xAt(hover)} y1={padT} y2={y(0)} style={{ stroke: "var(--ink-faint)" }} strokeDasharray="3 3" />
            {r.properties.map((p) => (
              <circle key={p.property.id} cx={xAt(hover)} cy={y(days[hover].byProperty[p.property.id]?.occupancyRate ?? 0)} r={4} style={{ fill: colorOf.get(p.property.id), stroke: "var(--surface)" }} strokeWidth={2} />
            ))}
          </g>
        )}
      </svg>
      {hover !== null && days[hover] && (
        <Tooltip leftPct={(xAt(hover) / w) * 100} title={formatDay(days[hover].date, { weekday: "short", day: "numeric", month: "short" })}>
          {r.properties.map((p) => (
            <TipRow key={p.property.id} color={colorOf.get(p.property.id) ?? "var(--ink)"} label={p.property.name} value={percent(days[hover].byProperty[p.property.id]?.occupancyRate ?? 0)} />
          ))}
        </Tooltip>
      )}
      <ul className="mt-2 flex flex-wrap gap-4 text-[12px] text-ink-muted">
        {r.properties.map((p) => (
          <li key={p.property.id} className="inline-flex items-center gap-1.5">
            <span className="h-[3px] w-4 rounded-full" style={{ background: colorOf.get(p.property.id) }} /> {p.property.name}
          </li>
        ))}
      </ul>
      <table className="sr-only">
        <caption>Occupancy by night</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <th>{d.date}</th>
              {r.properties.map((p) => (
                <td key={p.property.id}>{percent(d.byProperty[p.property.id]?.occupancyRate ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
