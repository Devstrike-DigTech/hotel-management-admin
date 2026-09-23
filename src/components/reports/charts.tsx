"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/* In-house SVG charts: hairline grid, mono axis text, 2px surface gaps between
   stacked segments, rounded data-ends, hover tooltip, table fallback. */

export function useWidth(min = 280) {
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

export function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / p;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * p;
}

export const axisText = { fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--ink-faint)" } as const;

export interface Series {
  key: string;
  label: string;
  color: string;
}

export function StackedColumns({
  data,
  series,
  label,
  formatY,
  formatX,
  height = 220,
}: {
  data: { x: string; values: Record<string, number> }[];
  series: Series[];
  label: string;
  formatY: (v: number) => string;
  formatX: (x: string) => string;
  height?: number;
}) {
  const { ref, w } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 56;
  const padB = 24;
  const padT = 10;
  const innerH = height - padB - padT;
  const totals = data.map((d) => series.reduce((s, k) => s + Math.max(0, d.values[k.key] ?? 0), 0));
  const max = niceMax(Math.max(1, ...totals));
  const step = (w - padL) / Math.max(1, data.length);
  const barW = Math.max(3, Math.min(26, step * 0.62));
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const every = Math.ceil(data.length / Math.max(2, Math.floor((w - padL) / 64)));
  return (
    <div className="relative" ref={ref}>
      <Legend series={series} />
      <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} className="block" role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={padL} x2={w} y1={y(t)} y2={y(t)} style={{ stroke: "var(--line)" }} strokeDasharray={t ? "2 4" : undefined} />
            <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" style={axisText}>
              {formatY(t)}
            </text>
          </g>
        ))}
        {data.map((d, i) => {
          const cx = padL + step * (i + 0.5);
          let acc = 0;
          const segs = series
            .map((s) => ({ s, v: Math.max(0, d.values[s.key] ?? 0) }))
            .filter((x) => x.v > 0);
          const topIdx = segs.length - 1;
          return (
            <g key={d.x} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={cx - step / 2} y={0} width={step} height={height} fill="transparent" />
              {hover === i && <rect x={cx - step / 2 + 1} y={padT} width={step - 2} height={innerH} rx={3} style={{ fill: "var(--surface-2)" }} />}
              {segs.map(({ s, v }, j) => {
                const y0 = y(acc);
                acc += v;
                const y1 = y(acc);
                const h = Math.max(0, y0 - y1 - (j < topIdx ? 2 : 0));
                const top = j === topIdx;
                const r = top ? Math.min(3, barW / 2, h) : 0;
                const x0 = cx - barW / 2;
                const path = top
                  ? `M${x0} ${y0} V${y1 + r} Q${x0} ${y1} ${x0 + r} ${y1} H${x0 + barW - r} Q${x0 + barW} ${y1} ${x0 + barW} ${y1 + r} V${y0} Z`
                  : `M${x0} ${y0} V${y0 - h} H${x0 + barW} V${y0} Z`;
                return <path key={s.key} d={path} style={{ fill: s.color, opacity: hover === null || hover === i ? 1 : 0.45, transition: "opacity 150ms" }} />;
              })}
              {(i === data.length - 1 || (i % every === 0 && data.length - 1 - i >= every * 0.7)) && (
                <text x={cx} y={height - 7} textAnchor="middle" style={{ ...axisText, fill: "var(--ink-muted)" }}>
                  {formatX(d.x)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {hover !== null && data[hover] && (
        <Tooltip leftPct={((padL + step * (hover + 0.5)) / w) * 100} title={formatX(data[hover].x)}>
          {series.map((s) => (
            <TipRow key={s.key} color={s.color} label={s.label} value={formatY(data[hover].values[s.key] ?? 0)} />
          ))}
          <div className="mt-1 flex justify-between gap-6 border-t border-line pt-1 text-[12px]">
            <span className="text-ink-muted">Total</span>
            <span className="font-mono text-ink">{formatY(totals[hover])}</span>
          </div>
        </Tooltip>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <thead>
          <tr>
            <th>Date</th>
            {series.map((s) => (
              <th key={s.key}>{s.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.x}>
              <th>{d.x}</th>
              {series.map((s) => (
                <td key={s.key}>{formatY(d.values[s.key] ?? 0)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function LineChart({
  data,
  label,
  formatY,
  formatX,
  max: fixedMax,
  height = 200,
  color = "var(--laterite)",
  seriesLabel,
}: {
  data: { x: string; y: number }[];
  label: string;
  formatY: (v: number) => string;
  formatX: (x: string) => string;
  max?: number;
  height?: number;
  color?: string;
  seriesLabel: string;
}) {
  const { ref, w } = useWidth();
  const [hover, setHover] = useState<number | null>(null);
  const padL = 44;
  const padB = 24;
  const padT = 12;
  const innerH = height - padB - padT;
  const max = fixedMax ?? niceMax(Math.max(1, ...data.map((d) => d.y)));
  const xAt = (i: number) => padL + (data.length <= 1 ? 0 : (i / (data.length - 1)) * (w - padL - 8));
  const y = (v: number) => padT + innerH - (v / max) * innerH;
  const line = data.map((d, i) => `${i ? "L" : "M"}${xAt(i)} ${y(d.y)}`).join(" ");
  const area = data.length ? `${line} L${xAt(data.length - 1)} ${y(0)} L${xAt(0)} ${y(0)} Z` : "";
  const every = Math.ceil(data.length / Math.max(2, Math.floor((w - padL) / 64)));
  const onMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - r.left;
    const i = Math.round(((x - padL) / (w - padL - 8)) * (data.length - 1));
    setHover(Math.max(0, Math.min(data.length - 1, i)));
  };
  return (
    <div className="relative" ref={ref}>
      <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} className="block" role="img" aria-label={label} onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        <defs>
          <linearGradient id={`lg-${seriesLabel.replace(/\W/g, "")}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.18 }} />
            <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={padL} x2={w} y1={y(t)} y2={y(t)} style={{ stroke: "var(--line)" }} strokeDasharray={t ? "2 4" : undefined} />
            <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" style={axisText}>
              {formatY(t)}
            </text>
          </g>
        ))}
        <path d={area} style={{ fill: `url(#lg-${seriesLabel.replace(/\W/g, "")})` }} />
        <path d={line} fill="none" style={{ stroke: color }} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {data.map((d, i) =>
          i === data.length - 1 || (i % every === 0 && data.length - 1 - i >= every * 0.7) ? (
            <text key={d.x} x={xAt(i)} y={height - 7} textAnchor="middle" style={{ ...axisText, fill: "var(--ink-muted)" }}>
              {formatX(d.x)}
            </text>
          ) : null,
        )}
        {hover !== null && data[hover] && (
          <g>
            <line x1={xAt(hover)} x2={xAt(hover)} y1={padT} y2={y(0)} style={{ stroke: "var(--ink-faint)" }} strokeDasharray="3 3" />
            <circle cx={xAt(hover)} cy={y(data[hover].y)} r={4.5} style={{ fill: color, stroke: "var(--surface)" }} strokeWidth={2} />
          </g>
        )}
      </svg>
      {hover !== null && data[hover] && (
        <Tooltip leftPct={(xAt(hover) / w) * 100} title={formatX(data[hover].x)}>
          <TipRow color={color} label={seriesLabel} value={formatY(data[hover].y)} />
        </Tooltip>
      )}
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {data.map((d) => (
            <tr key={d.x}>
              <th>{d.x}</th>
              <td>{formatY(d.y)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Tooltip({ leftPct, title, children }: { leftPct: number; title: string; children: React.ReactNode }) {
  return (
    <div
      className="pointer-events-none absolute top-8 z-10 min-w-[170px] rounded-md border border-line bg-surface px-3 py-2 shadow-float"
      style={{ left: `${leftPct}%`, transform: `translateX(${leftPct > 65 ? "-105%" : "8%"})` }}
    >
      <p className="mb-1 text-[11.5px] font-medium text-ink">{title}</p>
      {children}
    </div>
  );
}

export function TipRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6 py-px text-[12px]">
      <span className="flex items-center gap-1.5 text-ink-muted">
        <span className="h-2 w-2 rounded-[2px]" style={{ background: color }} />
        {label}
      </span>
      <span className="font-mono text-ink">{value}</span>
    </div>
  );
}

export function Legend({ series, className }: { series: Series[]; className?: string }) {
  if (series.length < 2) return null;
  return (
    <ul className={cn("mb-3 flex flex-wrap gap-x-4 gap-y-1", className)}>
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5 text-[12px] text-ink-muted">
          <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

/** One 100% bar with 2px gaps; labels live in the list beside it, in ink. */
export function MethodBar({ items }: { items: { key: string; label: string; value: number; color: string; display: string }[] }) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const visible = items.filter((i) => i.value > 0);
  return (
    <div>
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-[3px]" role="img" aria-label={items.map((i) => `${i.label} ${i.display}`).join(", ")}>
        {visible.map((i) => (
          <span key={i.key} style={{ width: `${(i.value / total) * 100}%`, background: i.color }} title={`${i.label}: ${i.display}`} />
        ))}
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {items.map((i) => (
          <li key={i.key} className="grid grid-cols-[auto_1fr_auto_44px] items-center gap-3 text-[13px]">
            <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: i.color }} />
            <span className="text-ink">{i.label}</span>
            <span className="font-mono text-ink">{i.display}</span>
            <span className="text-right font-mono text-[11.5px] text-ink-muted">{Math.round((i.value / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
