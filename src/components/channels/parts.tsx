"use client";

import { ArrowDown, ArrowUp, Check, LinkBreak, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { naira, nairaCompact, percent } from "@/lib/format";

/* ---------- channel identity ---------- */

/** Channel marks: a monogram in a squared seal plus the name. Colour is never the only cue. */
export const CHANNEL_LOOK: Record<string, { mono: string; color: string }> = {
  BOOKING_COM: { mono: "B.", color: "var(--adire)" },
  EXPEDIA: { mono: "Ex", color: "var(--brass)" },
  AGODA: { mono: "Ag", color: "var(--laterite)" },
  AIRBNB: { mono: "Ab", color: "var(--m-ledger)" },
  HOTELS_NG: { mono: "Hn", color: "var(--palm)" },
  TRIVAGO: { mono: "Tv", color: "var(--ochre)" },
  OTHER: { mono: "OT", color: "var(--ink-muted)" },
};

export function channelLook(code: string) {
  return CHANNEL_LOOK[code] ?? { mono: code.slice(0, 2), color: "var(--ink-muted)" };
}

export function ChannelSeal({ code, name, size = "md" }: { code: string; name?: string; size?: "sm" | "md" }) {
  const l = channelLook(code);
  return (
    <span className="inline-flex min-w-0 items-center gap-2">
      <span
        aria-hidden
        className={cn("grid shrink-0 place-items-center rounded-[3px] border font-display font-semibold italic leading-none", size === "sm" ? "h-5 w-5 text-[10px]" : "h-7 w-7 text-[13px]")}
        style={{ color: l.color, borderColor: `color-mix(in oklab, ${l.color} 45%, transparent)`, background: `color-mix(in oklab, ${l.color} 10%, var(--surface))` }}
      >
        {l.mono}
      </span>
      {name && <span className={cn("truncate", size === "sm" ? "text-[12.5px]" : "text-[13.5px] font-medium text-ink")}>{name}</span>}
    </span>
  );
}

/* ---------- mapping grid ---------- */

export interface MapColumn {
  connectionId: string;
  channel: string;
  name: string;
  /** remote rooms to choose from */
  remote: { id: string; name: string }[];
}

export interface MapRow {
  roomTypeId: string;
  roomTypeName: string;
  rooms?: number;
}

/** cell value: remote room id or null */
export type MapCells = Record<string, Record<string, { remoteId: string; remoteName: string } | null>>;

/**
 * Room types down, channels across. A mapped cell names the channel's room; an
 * unmapped one is a dashed slot. Completeness per channel sits in the header.
 */
export function MappingGrid({
  rows,
  cols,
  cells,
  onEdit,
  editable,
}: {
  rows: MapRow[];
  cols: MapColumn[];
  cells: MapCells;
  onEdit: (row: MapRow, col: MapColumn) => void;
  editable: boolean;
}) {
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-[13px]" role="grid" aria-label="Room type mapping by channel">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-[200px] border-b border-r border-line bg-surface px-4 py-3 text-left">
              <span className="eyebrow text-[10px]">Your room types</span>
            </th>
            {cols.map((c) => {
              const mapped = rows.filter((r) => cells[r.roomTypeId]?.[c.connectionId]).length;
              const frac = rows.length ? mapped / rows.length : 0;
              return (
                <th key={c.connectionId} className="border-b border-line px-3 py-3 text-left align-bottom font-normal">
                  <ChannelSeal code={c.channel} name={c.name} />
                  <div className="mt-2 flex items-center gap-2">
                    <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-line">
                      <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${frac * 100}%`, background: frac === 1 ? "var(--palm)" : "var(--ochre)" }} />
                    </span>
                    <span className={cn("font-mono text-[11px]", frac === 1 ? "text-palm" : "text-ochre")}>
                      {mapped}/{rows.length}
                    </span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.roomTypeId}>
              <th scope="row" className="sticky left-0 z-10 border-b border-r border-line bg-surface px-4 py-3 text-left font-normal">
                <span className="block text-[13.5px] font-medium text-ink">{r.roomTypeName}</span>
                {r.rooms != null && <span className="text-[11.5px] text-ink-muted">{r.rooms} rooms</span>}
              </th>
              {cols.map((c) => {
                const v = cells[r.roomTypeId]?.[c.connectionId] ?? null;
                return (
                  <td key={c.connectionId} className="border-b border-line p-1.5">
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => onEdit(r, c)}
                      data-testid={`map-${r.roomTypeName}-${c.name}`}
                      className={cn(
                        "flex h-[46px] w-full items-center gap-2 rounded-sm px-2.5 text-left transition-colors disabled:cursor-default",
                        v ? "border border-line bg-paper hover:border-line-strong" : "border border-dashed border-[color-mix(in_oklab,var(--ochre)_55%,transparent)] text-ochre hover:bg-ochre-wash/50",
                      )}
                    >
                      {v ? (
                        <>
                          <Check size={14} weight="bold" className="shrink-0 text-palm" />
                          <span className="min-w-0">
                            <span className="block truncate text-[12.5px] text-ink">{v.remoteName}</span>
                            <span className="block truncate font-mono text-[10px] text-ink-faint">{v.remoteId}</span>
                          </span>
                        </>
                      ) : (
                        <>
                          {editable ? <Plus size={13} weight="bold" /> : <LinkBreak size={13} />}
                          <span className="text-[12.5px]">{editable ? "Map a room" : "Not mapped"}</span>
                        </>
                      )}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ---------- OTA cost vs direct ---------- */

export interface CostRow {
  channel: string;
  name: string;
  bookings: number;
  roomNights?: number;
  revenueKobo: number;
  commissionKobo: number;
  commissionPct?: number;
}

/**
 * What the OTAs cost this month, and what the same stays would have cost
 * through the hotel's own booking site (no commission) or the marketplace
 * (the plan's commission). Bars: revenue with the commission carved out.
 */
export function OtaCostBars({ rows, directSavingsKobo, marketplaceCostKobo, marketplacePct }: { rows: CostRow[]; directSavingsKobo: number; marketplaceCostKobo?: number | null; marketplacePct?: number | null }) {
  const max = Math.max(1, ...rows.map((r) => r.revenueKobo));
  const paid = rows.reduce((s, r) => s + r.commissionKobo, 0);
  return (
    <div>
      <ul className="flex flex-col gap-3.5">
        {rows.map((r) => {
          const w = (r.revenueKobo / max) * 100;
          const cw = r.revenueKobo ? (r.commissionKobo / r.revenueKobo) * 100 : 0;
          const l = channelLook(r.channel);
          return (
            <li key={r.channel + r.name} className="grid grid-cols-[minmax(0,140px)_1fr] items-center gap-3 sm:grid-cols-[180px_1fr_auto]">
              <span className="min-w-0">
                <ChannelSeal code={r.channel} name={r.name} size="sm" />
                <span className="mt-0.5 block pl-7 font-mono text-[10.5px] text-ink-faint">
                  {r.bookings} bookings{r.roomNights ? ` · ${r.roomNights} nights` : ""}
                </span>
              </span>
              <span className="relative h-6" aria-hidden>
                <span className="absolute inset-y-0 left-0 flex overflow-hidden rounded-[2px]" style={{ width: `${Math.max(2, w)}%` }}>
                  <span className="h-full" style={{ width: `${100 - cw}%`, background: `color-mix(in oklab, ${l.color} 28%, var(--surface))` }} />
                  <span className="hatch h-full border-l border-surface" style={{ width: `${cw}%`, color: "var(--danger)", background: "color-mix(in oklab, var(--danger) 22%, var(--surface))" }} />
                </span>
              </span>
              <span className="col-span-2 flex items-baseline justify-end gap-3 text-right sm:col-span-1">
                <span className="font-mono text-[12.5px] text-ink">{nairaCompact(r.revenueKobo)}</span>
                <span className="font-mono text-[12.5px] text-danger">−{nairaCompact(r.commissionKobo)}</span>
                {r.commissionPct != null && <span className="w-10 font-mono text-[11px] text-ink-faint">{percent(r.commissionPct / 100, 0)}</span>}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11.5px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-4 rounded-[2px] bg-[color-mix(in_oklab,var(--adire)_28%,var(--surface))]" /> room revenue you kept
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="hatch h-2.5 w-4 rounded-[2px] bg-[color-mix(in_oklab,var(--danger)_22%,var(--surface))] text-danger" /> commission paid
        </span>
      </div>
      <table className="sr-only">
        <caption>Commission by channel</caption>
        <thead>
          <tr>
            <th>Channel</th>
            <th>Revenue</th>
            <th>Commission</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.name}>
              <td>{r.name}</td>
              <td>{naira(r.revenueKobo)}</td>
              <td>{naira(r.commissionKobo)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-line bg-paper px-4 py-3">
          <p className="display-sm text-[13px] italic text-ink-muted">Paid to OTAs</p>
          <p className="mt-1 font-mono text-[22px] text-danger">{naira(paid)}</p>
        </div>
        <div className="rounded-md border border-[color-mix(in_oklab,var(--palm)_35%,transparent)] bg-palm-wash/50 px-4 py-3">
          <p className="display-sm text-[13px] italic text-ink-muted">Direct would have saved</p>
          <p className="mt-1 font-mono text-[22px] text-palm">{naira(directSavingsKobo)}</p>
          <p className="text-[11.5px] text-ink-muted">booking site: no commission</p>
        </div>
        {marketplaceCostKobo != null && (
          <div className="rounded-md border border-line bg-paper px-4 py-3">
            <p className="display-sm text-[13px] italic text-ink-muted">On the marketplace</p>
            <p className="mt-1 font-mono text-[22px] text-ink">{naira(marketplaceCostKobo)}</p>
            <p className="text-[11.5px] text-ink-muted">{marketplacePct != null ? `${marketplacePct}% commission on your plan` : "your plan's commission"}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function SyncDirection({ dir }: { dir: "PUSH" | "PULL" | string }) {
  return dir === "PUSH" ? (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-adire">
      <ArrowUp size={11} weight="bold" /> out
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 font-mono text-[11px] text-palm">
      <ArrowDown size={11} weight="bold" /> in
    </span>
  );
}
