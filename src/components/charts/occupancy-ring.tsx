"use client";

import type { RoomStatus } from "@/lib/api/types";
import { ROOM_STATUS } from "@/lib/catalog";

const ORDER: RoomStatus[] = ["OCCUPIED", "RESERVED", "VACANT_CLEAN", "VACANT_DIRTY", "OUT_OF_ORDER"];

function arc(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${x0.toFixed(2)} ${y0.toFixed(2)} A${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/**
 * Occupancy dial: one tick per room (like keys around a ring), coloured by status,
 * occupied first. Falls back to one arc per status for very large hotels.
 */
export function OccupancyRing({
  byStatus,
  total,
  size = 148,
  rate,
}: {
  byStatus: Partial<Record<RoomStatus, number>>;
  total: number;
  size?: number;
  /** 0..1 */
  rate?: number | null;
}) {
  const occupied = byStatus.OCCUPIED ?? 0;
  // Prefer the server's rate (occupied / sellable rooms, excluding out of order).
  const sellable = total - (byStatus.OUT_OF_ORDER ?? 0);
  const pct = rate != null ? Math.round(rate * 100) : sellable > 0 ? Math.round((occupied / sellable) * 100) : 0;
  const c = 50;
  const r = 42;
  const start = -Math.PI / 2;
  const perRoom = total > 0 && total <= 120;
  const seq: RoomStatus[] = [];
  ORDER.forEach((s) => {
    for (let i = 0; i < (byStatus[s] ?? 0); i++) seq.push(s);
  });

  const label = `${pct}% occupied. ${ORDER.map((s) => `${byStatus[s] ?? 0} ${ROOM_STATUS[s].label}`).join(", ")}.`;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={label}>
        <circle cx={c} cy={c} r={r} fill="none" style={{ stroke: "var(--surface-2)" }} strokeWidth={7} />
        {/* inner hairline + hour ticks, like a desk clock */}
        <circle cx={c} cy={c} r={33} fill="none" style={{ stroke: "var(--line)" }} strokeWidth={0.5} />
        {Array.from({ length: 12 }, (_, i) => {
          const a = start + (i / 12) * Math.PI * 2;
          return (
            <line
              key={i}
              x1={c + 30.5 * Math.cos(a)}
              y1={c + 30.5 * Math.sin(a)}
              x2={c + 33 * Math.cos(a)}
              y2={c + 33 * Math.sin(a)}
              style={{ stroke: "var(--line-strong)" }}
              strokeWidth={0.6}
            />
          );
        })}
        {perRoom
          ? seq.map((s, i) => {
              const step = (Math.PI * 2) / total;
              const gap = Math.min(step * 0.22, 0.05);
              return (
                <path
                  key={i}
                  d={arc(c, c, r, start + i * step + gap / 2, start + (i + 1) * step - gap / 2)}
                  fill="none"
                  strokeWidth={7}
                  style={{ stroke: ROOM_STATUS[s].color, transition: "stroke 300ms" }}
                />
              );
            })
          : (() => {
              let acc = 0;
              return ORDER.map((s) => {
                const n = byStatus[s] ?? 0;
                if (!n || !total) return null;
                const a0 = start + (acc / total) * Math.PI * 2;
                acc += n;
                const a1 = start + (acc / total) * Math.PI * 2 - 0.02;
                return <path key={s} d={arc(c, c, r, a0, a1)} fill="none" strokeWidth={7} style={{ stroke: ROOM_STATUS[s].color }} />;
              });
            })()}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[30px] leading-none tracking-tight text-ink">
          {pct}
          <span className="text-[15px] text-ink-muted">%</span>
        </span>
        <span className="mt-1 text-[11px] italic text-ink-muted" style={{ fontFamily: "var(--font-display)" }}>
          occupied
        </span>
      </div>
    </div>
  );
}
