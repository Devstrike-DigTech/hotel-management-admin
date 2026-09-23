"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/* Hand-built SVG for reviews: the monthly rating line with a count strip
   beneath it (two small charts sharing an x axis, never two y axes), and
   subscore bars on a 1 to 5 scale. */

export interface TrendPoint {
  /** YYYY-MM */
  month: string;
  average: number | null;
  count: number;
}

const monthLabel = (m: string, long = false) => {
  const [y, mo] = m.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString("en-NG", { month: long ? "long" : "short", year: long ? "numeric" : undefined, timeZone: "UTC" });
};

function useWidth(min = 260) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(min, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, [min]);
  return { ref, w };
}

export function RatingTrend({ data, label = "Average rating by month" }: { data: TrendPoint[]; label?: string }) {
  const { ref, w } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const H = 170;
  const STRIP = 34;
  const padL = 28;
  const padR = 36;
  const top = 12;
  const innerH = H - top - 18;
  const step = (w - padL - padR) / Math.max(1, data.length);
  const cx = (i: number) => padL + step * (i + 0.5);
  // 1..5 scale, but zoom to 3..5 when every month sits above 3.2 so movement shows
  const vals = data.map((d) => d.average).filter((v): v is number => v != null);
  const lo = vals.length && Math.min(...vals) >= 3.2 ? 3 : 1;
  const y = (v: number) => top + innerH - ((v - lo) / (5 - lo)) * innerH;
  const ticks = lo === 3 ? [3, 4, 5] : [1, 2, 3, 4, 5];
  const maxCount = Math.max(1, ...data.map((d) => d.count));
  const labelEvery = w < 440 ? 3 : data.length > 8 ? 2 : 1;

  // a path that breaks over months with no reviews
  const segs: string[] = [];
  let cur = "";
  data.forEach((d, i) => {
    if (d.average == null) {
      if (cur) segs.push(cur);
      cur = "";
      return;
    }
    cur += `${cur ? "L" : "M"}${cx(i).toFixed(1)} ${y(d.average).toFixed(1)}`;
  });
  if (cur) segs.push(cur);
  const lastIdx = data.map((d) => d.average != null).lastIndexOf(true);

  return (
    <div ref={ref} className="relative">
      <svg viewBox={`0 0 ${w} ${H + STRIP + 18}`} width={w} height={H + STRIP + 18} className="block w-full" role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w - padR + 8} y1={y(t)} y2={y(t)} style={{ stroke: "var(--line)" }} strokeDasharray={t === lo ? undefined : "2 4"} />
            <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--ink-faint)" }}>
              {t}
            </text>
          </g>
        ))}
        {hover !== null && <line x1={cx(hover)} x2={cx(hover)} y1={top} y2={H + STRIP} style={{ stroke: "var(--line-strong)" }} />}
        {segs.map((d, i) => (
          <path key={i} d={d} fill="none" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: "var(--laterite)" }} />
        ))}
        {data.map((d, i) =>
          d.average == null ? null : (
            <circle
              key={d.month}
              cx={cx(i)}
              cy={y(d.average)}
              r={hover === i ? 5 : 4}
              strokeWidth={2}
              style={{ fill: hover === i ? "var(--laterite)" : "var(--surface)", stroke: "var(--laterite)" }}
            />
          ),
        )}
        {lastIdx >= 0 && data[lastIdx].average != null && (
          <text x={cx(lastIdx) + 9} y={y(data[lastIdx].average!) + 4} style={{ fontFamily: "var(--font-mono)", fontSize: 11, fill: "var(--ink)" }}>
            {data[lastIdx].average!.toFixed(1)}
          </text>
        )}

        {/* count strip: its own little chart under the line */}
        <text x={padL - 8} y={H + 6} textAnchor="end" style={{ fontFamily: "var(--font-mono)", fontSize: 9, fill: "var(--ink-faint)" }}>
          n
        </text>
        {data.map((d, i) => {
          const h = d.count ? Math.max(2, (d.count / maxCount) * (STRIP - 8)) : 0;
          const bw = Math.min(14, step * 0.42);
          return (
            <g key={`c-${d.month}`}>
              {h > 0 && <rect x={cx(i) - bw / 2} y={H + STRIP - h} width={bw} height={h} rx={Math.min(2, bw / 2)} style={{ fill: "var(--ink-faint)", opacity: hover === null || hover === i ? 0.55 : 0.25 }} />}
              {(i % labelEvery === 0 || i === data.length - 1) && (
                <text x={cx(i)} y={H + STRIP + 14} textAnchor="middle" style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--ink-muted)" }}>
                  {monthLabel(d.month)}
                </text>
              )}
              <rect
                x={cx(i) - step / 2}
                y={0}
                width={step}
                height={H + STRIP + 18}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-sm border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-float"
          style={{ left: `${Math.min(88, Math.max(12, (cx(hover) / w) * 100))}%` }}
        >
          <span className="text-ink-muted">{monthLabel(data[hover].month, true)}</span>
          <span className="ml-2 font-mono text-ink">{data[hover].average != null ? data[hover].average!.toFixed(2) : "no reviews"}</span>
          {data[hover].count > 0 && <span className="ml-1.5 text-ink-muted">from {data[hover].count}</span>}
        </div>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th>Month</th>
            <th>Average</th>
            <th>Reviews</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.month}>
              <th>{monthLabel(d.month, true)}</th>
              <td>{d.average?.toFixed(2) ?? "none"}</td>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Subscores as rulers from 1 to 5 with a tick at each whole point. */
export function SubscoreBars({ items, className }: { items: { key: string; label: string; value: number | null }[]; className?: string }) {
  return (
    <dl className={cn("flex flex-col gap-3", className)}>
      {items.map((it) => {
        const ratio = it.value == null ? 0 : Math.max(0, Math.min(1, (it.value - 1) / 4));
        return (
          <div key={it.key} className="grid grid-cols-[92px_1fr_36px] items-center gap-3">
            <dt className="text-[13px] text-ink-muted">{it.label}</dt>
            <dd className="relative h-2 rounded-xs bg-surface-2" aria-hidden>
              <span className="absolute inset-y-0 left-0 rounded-xs bg-ink" style={{ width: `${ratio * 100}%`, opacity: 0.82 }} />
              {[1, 2, 3].map((t) => (
                <span key={t} className="absolute inset-y-0 w-[2px] bg-surface" style={{ left: `calc(${(t / 4) * 100}% - 1px)` }} />
              ))}
            </dd>
            <dd className="text-right font-mono text-[13px] text-ink">
              {it.value == null ? "-" : it.value.toFixed(1)}
              <span className="sr-only"> out of 5 for {it.label}</span>
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** How many reviews at each star, 5 down to 1, as clickable filters. */
export function StarDistribution({
  counts,
  total,
  active,
  onPick,
}: {
  counts: Record<string, number>;
  total: number;
  active?: number | null;
  onPick?: (stars: number | null) => void;
}) {
  return (
    <ul className="flex flex-col gap-1.5">
      {[5, 4, 3, 2, 1].map((s) => {
        const n = counts[String(s)] ?? 0;
        const ratio = total ? n / total : 0;
        const on = active === s;
        return (
          <li key={s}>
            <button
              type="button"
              onClick={() => onPick?.(on ? null : s)}
              aria-pressed={on}
              className={cn(
                "grid w-full grid-cols-[28px_1fr_34px] items-center gap-2.5 rounded-sm px-1 py-0.5 text-left transition-colors hover:bg-surface-2/60",
                active != null && !on && "opacity-50",
              )}
              aria-label={`${s} stars: ${n} reviews${on ? ", filtering" : ""}`}
            >
              <span className="font-mono text-[12px] text-ink-muted">{s}&#9733;</span>
              <span className="relative h-1.5 rounded-xs bg-surface-2">
                <span className="absolute inset-y-0 left-0 rounded-xs" style={{ width: `${ratio * 100}%`, background: s <= 2 ? "var(--danger)" : "var(--brass)" }} />
              </span>
              <span className="text-right font-mono text-[12px] text-ink">{n}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
