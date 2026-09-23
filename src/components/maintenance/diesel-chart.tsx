"use client";

import { useState } from "react";
import { formatDay, type DayKey } from "@/lib/dates";
import { naira, nairaCompact, number } from "@/lib/format";
import { axisText, niceMax, useWidth } from "@/components/reports/charts";

export interface DieselDay {
  date: DayKey;
  litres: number;
  costKobo: number;
  runHours?: number | null;
  suppliers?: string[];
}

/**
 * Litres and naira, as two aligned panels on one time axis (never two scales
 * on one chart). A shared crosshair reads both, plus the price per litre.
 */
export function DieselChart({ days }: { days: DieselDay[] }) {
  const { ref, w } = useWidth(300);
  const [hover, setHover] = useState<number | null>(null);
  const padL = 58;
  const panelH = 118;
  const gap = 22;
  const padB = 22;
  const height = panelH * 2 + gap + padB + 8;
  const step = (w - padL) / Math.max(1, days.length);
  const barW = Math.max(3, Math.min(18, step * 0.6));
  const maxL = tight(Math.max(1, ...days.map((d) => d.litres)));
  const maxK = tight(Math.max(1, ...days.map((d) => d.costKobo)));
  const every = Math.ceil(days.length / Math.max(2, Math.floor((w - padL) / 62)));

  const panel = (top: number, value: (d: DieselDay) => number, max: number, color: string, fmt: (v: number) => string, title: string) => {
    const y = (v: number) => top + 18 + (panelH - 18) - (v / max) * (panelH - 18);
    return (
      <g>
        <text x={padL} y={top + 10} style={{ ...axisText, fontSize: 10.5, fill: "var(--ink-muted)", letterSpacing: "0.08em" }}>
          {title}
        </text>
        {[0, max / 2, max].map((t) => (
          <g key={t}>
            <line x1={padL} x2={w} y1={y(t)} y2={y(t)} style={{ stroke: "var(--line)" }} strokeDasharray={t ? "2 4" : undefined} />
            <text x={padL - 8} y={y(t) + 3.5} textAnchor="end" style={axisText}>
              {fmt(t)}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const v = value(d);
          if (!v) return null;
          const cx = padL + step * (i + 0.5);
          const y1 = y(v);
          const y0 = y(0);
          const h = y0 - y1;
          const r = Math.min(3, barW / 2, h);
          const x0 = cx - barW / 2;
          return (
            <path
              key={d.date}
              d={`M${x0} ${y0} V${y1 + r} Q${x0} ${y1} ${x0 + r} ${y1} H${x0 + barW - r} Q${x0 + barW} ${y1} ${x0 + barW} ${y1 + r} V${y0} Z`}
              style={{ fill: color, opacity: hover === null || hover === i ? 1 : 0.4, transition: "opacity 150ms" }}
            />
          );
        })}
      </g>
    );
  };

  const h = hover !== null ? days[hover] : null;
  return (
    <div className="relative" ref={ref}>
      <svg width={w} height={height} viewBox={`0 0 ${w} ${height}`} className="block" role="img" aria-label="Diesel bought each day: litres and naira" onMouseLeave={() => setHover(null)}>
        {hover !== null && <rect x={padL + step * hover + 1} y={0} width={step - 2} height={panelH * 2 + gap} rx={3} style={{ fill: "var(--surface-2)" }} />}
        {panel(0, (d) => d.litres, maxL, "var(--adire)", (v) => `${number(Math.round(v))} L`, "LITRES")}
        {panel(panelH + gap, (d) => d.costKobo, maxK, "var(--laterite)", (v) => nairaCompact(v), "NAIRA")}
        {days.map((d, i) => {
          const cx = padL + step * (i + 0.5);
          return (
            <g key={d.date}>
              <rect x={cx - step / 2} y={0} width={step} height={height} fill="transparent" onMouseEnter={() => setHover(i)} />
              {(i === days.length - 1 || (i % every === 0 && days.length - 1 - i >= every * 0.7)) && (
                <text x={cx} y={height - 6} textAnchor="middle" style={{ ...axisText, fill: "var(--ink-muted)" }}>
                  {formatDay(d.date, { day: "numeric", month: "short" })}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute top-4 z-10 min-w-[190px] rounded-md border border-line bg-surface px-3 py-2 shadow-float"
          style={{ left: `${((padL + step * (hover + 0.5)) / w) * 100}%`, transform: `translateX(${(padL + step * hover) / w > 0.62 ? "-106%" : "10%"})` }}
        >
          <p className="mb-1 text-[11.5px] font-medium text-ink">{formatDay(h.date, { weekday: "short", day: "numeric", month: "short" })}</p>
          {h.litres ? (
            <>
              <Row label="Litres" value={`${number(h.litres)} L`} color="var(--adire)" />
              <Row label="Spent" value={naira(h.costKobo)} color="var(--laterite)" />
              <Row label="Per litre" value={naira(Math.round(h.costKobo / h.litres))} />
              {h.runHours ? <Row label="Generator ran" value={`${h.runHours} h`} /> : null}
              {h.suppliers?.length ? <p className="mt-1 border-t border-line pt-1 text-[11.5px] text-ink-muted">{h.suppliers.join(", ")}</p> : null}
            </>
          ) : (
            <p className="text-[12px] text-ink-muted">No delivery</p>
          )}
        </div>
      )}
      <table className="sr-only">
        <caption>Diesel by day</caption>
        <thead>
          <tr>
            <th>Date</th>
            <th>Litres</th>
            <th>Naira</th>
          </tr>
        </thead>
        <tbody>
          {days
            .filter((d) => d.litres)
            .map((d) => (
              <tr key={d.date}>
                <td>{d.date}</td>
                <td>{d.litres}</td>
                <td>{naira(d.costKobo)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

/** A round axis top that doesn't waste half the panel (steps of 1, 1.5, 2, 3, 4, 5, 6, 8, 10). */
function tight(v: number) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const step = [1, 1.5, 2, 3, 4, 5, 6, 8, 10].find((s) => s * p >= v) ?? 10;
  return step === 10 ? niceMax(v) : step * p;
}

function Row({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-6 py-px text-[12px]">
      <span className="flex items-center gap-1.5 text-ink-muted">
        {color && <span className="h-2 w-2 rounded-[2px]" style={{ background: color }} />}
        {label}
      </span>
      <span className="font-mono text-ink">{value}</span>
    </div>
  );
}
