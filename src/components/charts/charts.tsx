"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/* Small, hand-built SVG charts in the house style: thin marks, hairline grid,
   mono axis labels, rounded data-ends, a hover tooltip on every mark. */

export function ColumnChart({
  data,
  height = 180,
  label,
  formatX = (s) => s,
  color = "var(--laterite)",
}: {
  data: { x: string; y: number }[];
  height?: number;
  label: string;
  formatX?: (s: string) => string;
  color?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // Render in real pixels so axis text stays legible at every width.
  const [w, setW] = useState(600);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(240, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const max = Math.max(1, ...data.map((d) => d.y));
  const niceMax = Math.ceil(max / 2) * 2 || 2;
  const labelEvery = w < 420 ? 4 : 3;
  const padL = 26;
  const padB = 22;
  const innerH = height - padB - 8;
  const step = (w - padL) / Math.max(1, data.length);
  const barW = Math.min(22, step * 0.5);
  const ticks = [0, niceMax / 2, niceMax];
  const y = (v: number) => 8 + innerH - (v / niceMax) * innerH;

  return (
    <div className="relative" ref={ref}>
      <svg viewBox={`0 0 ${w} ${height}`} width={w} height={height} className="block w-full" role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w} y1={y(t)} y2={y(t)} style={{ stroke: "var(--line)" }} strokeDasharray={t === 0 ? undefined : "2 4"} />
            <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--ink-faint)" }}>
              {t}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = padL + step * (i + 0.5);
          const h = Math.max(d.y > 0 ? 3 : 0, (d.y / niceMax) * innerH);
          const top = 8 + innerH - h;
          const r = Math.min(4, barW / 2, h / 2);
          return (
            <g key={d.x} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={cx - step / 2} y={0} width={step} height={height} fill="transparent" />
              {hover === i && <rect x={cx - step / 2 + 2} y={8} width={step - 4} height={innerH} rx={3} style={{ fill: "var(--surface-2)" }} />}
              {h > 0 && (
                <path
                  d={`M${cx - barW / 2} ${8 + innerH} V${top + r} Q${cx - barW / 2} ${top} ${cx - barW / 2 + r} ${top} H${cx + barW / 2 - r} Q${cx + barW / 2} ${top} ${cx + barW / 2} ${top + r} V${8 + innerH} Z`}
                  style={{ fill: color, opacity: hover === null || hover === i ? 1 : 0.45, transition: "opacity 150ms" }}
                />
              )}
              {(i === data.length - 1 || (i % labelEvery === 0 && data.length - 1 - i >= labelEvery / 2)) && (
                <text x={cx} y={height - 6} textAnchor="middle" style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--ink-muted)" }}>
                  {formatX(d.x)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-sm border border-line bg-surface px-2.5 py-1.5 text-[12px] shadow-float"
          style={{ left: `${((padL + step * (hover + 0.5)) / w) * 100}%` }}
        >
          <span className="font-mono text-ink">{data[hover].y}</span>
          <span className="ml-1.5 text-ink-muted">week of {formatX(data[hover].x)}</span>
        </div>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.x}>
              <th>{d.x}</th>
              <td>{d.y}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** One horizontal 100% bar with 2px gaps, direct labels and a legend. */
export function ShareBar({
  items,
  label,
  className,
}: {
  items: { key: string; label: string; value: number; color: string; ink?: string }[];
  label: string;
  className?: string;
}) {
  const [hover, setHover] = useState<string | null>(null);
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const visible = items.filter((i) => i.value > 0);
  return (
    <div className={className}>
      <div className="flex h-9 w-full gap-[2px] overflow-hidden rounded-sm" role="img" aria-label={`${label}: ${items.map((i) => `${i.label} ${i.value}`).join(", ")}`}>
        {visible.map((i) => {
          const pct = (i.value / total) * 100;
          return (
            <div
              key={i.key}
              onMouseEnter={() => setHover(i.key)}
              onMouseLeave={() => setHover(null)}
              className="relative flex items-center justify-start overflow-hidden px-2 transition-opacity duration-150 first:rounded-l-sm last:rounded-r-sm"
              style={{ width: `${pct}%`, background: i.color, opacity: hover && hover !== i.key ? 0.5 : 1 }}
              title={`${i.label}: ${i.value} (${Math.round(pct)}%)`}
            >
              {pct > 9 && (
                <span className="font-mono text-[11px] font-medium" style={{ color: i.ink ?? "var(--surface)" }}>
                  {i.value}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {items.map((i) => (
          <li
            key={i.key}
            className={cn("flex items-center gap-2 text-[12.5px] transition-opacity", hover && hover !== i.key && "opacity-50")}
            onMouseEnter={() => setHover(i.key)}
            onMouseLeave={() => setHover(null)}
          >
            <span className="h-2.5 w-2.5 rounded-xs" style={{ background: i.color }} />
            <span className="text-ink">{i.label}</span>
            <span className="font-mono text-ink-muted">
              {i.value} &middot; {Math.round((i.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Unit chart: one small square per tenant, grouped by status, labelled. */
export function UnitRows({
  rows,
}: {
  rows: { key: string; label: string; value: number; color: string; hatch?: boolean }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.key} className="grid grid-cols-[92px_minmax(0,1fr)_32px] items-center gap-3 text-[12.5px]">
          <span className="truncate text-ink-muted">{r.label}</span>
          <span className="flex flex-wrap gap-[3px]" aria-hidden>
            {r.value === 0 && <span className="h-2.5 w-full max-w-[40px] rounded-xs border border-dashed border-line-strong" />}
            {Array.from({ length: Math.min(r.value, 60) }, (_, i) => (
              <span
                key={i}
                className={cn("h-2.5 w-2.5 rounded-[2px]", r.hatch && "hatch")}
                style={{ background: r.color, color: "var(--surface)" }}
              />
            ))}
            {r.value > 60 && <span className="font-mono text-[10px] text-ink-muted">+{r.value - 60}</span>}
          </span>
          <span className="text-right font-mono text-ink">{r.value}</span>
          <span className="sr-only">
            {r.label}: {r.value} of {max}
          </span>
        </li>
      ))}
    </ul>
  );
}
