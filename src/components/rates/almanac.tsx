"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PushPin, Prohibit } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { addDays, formatDay, isWeekend, monthName, weekday, type DayKey } from "@/lib/dates";
import { naira, percent } from "@/lib/format";
import {
  DOW_LABEL,
  SLOT_VAR,
  describeAdjustment,
  describeDays,
  inSel,
  norm,
  packRuleLanes,
  ruleRuns,
  type AlmanacCell,
  type AlmanacData,
  type AlmanacRule,
  type Selection,
} from "./model";

export const COL_W = 66;
const ROW_H = 58;
const LANE_H = 24;

export type Preview = (typeId: string, cell: AlmanacCell, r: number, c: number) => { priceKobo: number; ruleId: string | null; overridden: boolean } | null;

/**
 * The Rate Almanac grid: room types down, nights across. Each cell is the
 * resolved nightly price; season rules run above as coloured bands. Drag across
 * cells (or use Shift + arrows) to select nights, then paint a rule, an override
 * or a restriction onto them.
 */
export function AlmanacGrid({
  data,
  selection,
  onSelectionChange,
  onCommit,
  onRuleClick,
  preview,
  activeRuleId,
  today,
  draftRule,
}: {
  data: AlmanacData;
  selection: Selection | null;
  onSelectionChange: (s: Selection | null) => void;
  onCommit: (s: Selection) => void;
  onRuleClick?: (r: AlmanacRule) => void;
  preview?: Preview;
  activeRuleId?: string | null;
  today: DayKey;
  /** a season being painted, shown as a dashed band in its own lane */
  draftRule?: AlmanacRule | null;
}) {
  const { days, types } = data;
  const [focus, setFocus] = useState<{ r: number; c: number }>(() => ({ r: 0, c: Math.max(0, days.indexOf(today)) }));
  const anchor = useRef<{ r: number; c: number } | null>(null);
  const dragging = useRef(false);
  const touchMode = useRef(false);
  const gridRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [typeW, setTypeW] = useState(208);
  const [sx, setSx] = useState(0);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const apply = () => setTypeW(mq.matches ? 112 : 208);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const lanes = useMemo(() => {
    const base = packRuleLanes(
      data.rules.filter((r) => r.id !== draftRule?.id),
      days[0],
      days[days.length - 1],
    );
    return draftRule ? [[{ ...draftRule, id: `${draftRule.id}::draft` }], ...base] : base;
  }, [data.rules, days, draftRule]);
  const ruleById = useMemo(() => new Map(data.rules.map((r) => [r.id, r])), [data.rules]);

  const focusCell = useCallback((r: number, c: number) => {
    setFocus({ r, c });
    requestAnimationFrame(() => {
      const el = gridRef.current?.querySelector<HTMLElement>(`[data-cell="${r}:${c}"]`);
      el?.focus({ preventScroll: true });
      el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    });
  }, []);

  // keep focus inside the window when it changes
  const fr = Math.min(focus.r, Math.max(0, types.length - 1));
  const fc = Math.min(focus.c, Math.max(0, days.length - 1));

  const cellAt = (x: number, y: number) => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-cell]");
    if (!el || !gridRef.current?.contains(el)) return null;
    const [r, c] = el.dataset.cell!.split(":").map(Number);
    return { r, c };
  };

  // mouse / pen: press, drag, release. touch: tap a start, tap an end, tap again to paint.
  const onPointerDown = (e: React.PointerEvent) => {
    const hit = cellAt(e.clientX, e.clientY);
    if (!hit || e.button !== 0) return;
    if (e.pointerType === "touch") {
      touchMode.current = true;
      const s = selection;
      if (s && s.r0 === s.r1 && s.c0 === s.c1 && !(s.r0 === hit.r && s.c0 === hit.c) && anchor.current) {
        onSelectionChange(norm(anchor.current, hit));
      } else if (s && inSel(s, hit.r, hit.c)) {
        onCommit(s);
      } else {
        anchor.current = hit;
        onSelectionChange(norm(hit, hit));
      }
      setFocus(hit);
      return;
    }
    e.preventDefault();
    touchMode.current = false;
    dragging.current = true;
    anchor.current = e.shiftKey && selection ? { r: selection.r0, c: selection.c0 } : hit;
    onSelectionChange(norm(anchor.current, hit));
    focusCell(hit.r, hit.c);
  };

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (!dragging.current || !anchor.current) return;
      const hit = cellAt(e.clientX, e.clientY);
      if (!hit) return;
      onSelectionChange(norm(anchor.current, hit));
      setFocus(hit);
      // auto-scroll near the edges while painting
      const sc = scrollRef.current;
      if (sc) {
        const b = sc.getBoundingClientRect();
        if (e.clientX > b.right - 40) sc.scrollLeft += 18;
        else if (e.clientX < b.left + typeW + 30) sc.scrollLeft -= 18;
      }
    };
    const up = () => {
      if (!dragging.current) return;
      dragging.current = false;
      if (anchor.current && selection) onCommit(selection);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [onSelectionChange, onCommit, selection, typeW]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const maxR = types.length - 1;
    const maxC = days.length - 1;
    let { r, c } = { r: fr, c: fc };
    const k = e.key;
    if (k === "Escape") {
      onSelectionChange(null);
      anchor.current = null;
      return;
    }
    if (k === "Enter" || k === " ") {
      e.preventDefault();
      onCommit(selection && inSel(selection, r, c) ? selection : norm({ r, c }, { r, c }));
      return;
    }
    if (k === "ArrowRight") c = Math.min(maxC, c + 1);
    else if (k === "ArrowLeft") c = Math.max(0, c - 1);
    else if (k === "ArrowDown") r = Math.min(maxR, r + 1);
    else if (k === "ArrowUp") r = Math.max(0, r - 1);
    else if (k === "PageDown") c = Math.min(maxC, c + 7);
    else if (k === "PageUp") c = Math.max(0, c - 7);
    else if (k === "Home") c = 0;
    else if (k === "End") c = maxC;
    else if ((e.metaKey || e.ctrlKey) && k.toLowerCase() === "a") {
      e.preventDefault();
      anchor.current = { r: 0, c: 0 };
      onSelectionChange({ r0: 0, r1: maxR, c0: 0, c1: maxC });
      return;
    } else return;
    e.preventDefault();
    if (e.shiftKey) {
      if (!anchor.current || !selection) anchor.current = { r: fr, c: fc };
      onSelectionChange(norm(anchor.current, { r, c }));
    } else {
      anchor.current = { r, c };
      onSelectionChange(null);
    }
    focusCell(r, c);
  };

  const width = typeW + days.length * COL_W;
  const months = useMemo(() => {
    const out: { key: string; label: string; c0: number; n: number }[] = [];
    days.forEach((d, i) => {
      const m = d.slice(0, 7);
      const last = out[out.length - 1];
      if (last && last.key === m) last.n++;
      else out.push({ key: m, label: `${monthName(d)} ${d.slice(0, 4)}`, c0: i, n: 1 });
    });
    return out;
  }, [days]);

  const selCount = selection ? (selection.r1 - selection.r0 + 1) * (selection.c1 - selection.c0 + 1) : 0;

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        className="scrollbar-thin overflow-x-auto overscroll-x-contain"
        onScroll={(e) => {
          const x = e.currentTarget.scrollLeft;
          requestAnimationFrame(() => setSx(x));
        }}
      >
        <div style={{ width }} className="relative select-none">
          {/* month row */}
          <div className="flex h-7 border-b border-line">
            <div className="sticky left-0 z-20 shrink-0 border-r border-line bg-surface" style={{ width: typeW }} />
            <div className="relative flex-1">
              {months.map((m) => (
                <div
                  key={m.key}
                  className="absolute inset-y-0 flex items-center border-l border-line-strong pl-2 first:border-l-0"
                  style={{ left: m.c0 * COL_W, width: m.n * COL_W }}
                >
                  <span className="sticky left-[calc(var(--tw)+8px)] display-sm truncate text-[13px] italic text-ink" style={{ ["--tw" as string]: `${typeW}px` }}>
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* dates + demand */}
          <div className="flex border-b border-line">
            <div className="sticky left-0 z-20 flex shrink-0 flex-col justify-end border-r border-line bg-surface px-3 pb-1.5" style={{ width: typeW }}>
              <span className="eyebrow text-[9.5px]">Night of</span>
              <span className="text-[11px] text-ink-faint">bars: forecast occupancy</span>
            </div>
            {days.map((d) => {
              const dem = data.demand.get(d);
              const occ = dem?.occupancy ?? 0;
              const high = occ >= 0.85;
              const isToday = d === today;
              const first = d.endsWith("-01");
              return (
                <div
                  key={d}
                  className={cn(
                    "relative flex shrink-0 flex-col items-center pt-1.5",
                    isWeekend(d) && "bg-surface-2/60",
                    first && "border-l border-line-strong",
                  )}
                  style={{ width: COL_W }}
                  title={dem ? `${formatDay(d, { weekday: "long", day: "numeric", month: "long" })}: ${percent(occ)} forecast${dem.total ? `, ${dem.booked ?? Math.round(occ * dem.total)} of ${dem.total} rooms` : ""}` : formatDay(d)}
                >
                  {isToday && <span className="absolute inset-x-1 top-0 h-[2px] rounded-b-xs bg-laterite" aria-hidden />}
                  <span className={cn("font-mono text-[9.5px] uppercase tracking-[0.12em]", isToday ? "text-laterite" : "text-ink-faint")}>
                    {DOW_LABEL[weekday(d)].slice(0, 2)}
                  </span>
                  <span className={cn("font-mono text-[15px] leading-tight", isToday ? "font-medium text-laterite" : "text-ink")}>{Number(d.slice(8))}</span>
                  {/* demand: a thin column; tall and laterite when the house is nearly full */}
                  <div className="mt-1 flex h-[26px] w-full items-end justify-center gap-1 px-2 pb-1" aria-hidden>
                    <div className="relative h-full w-[8px] overflow-hidden rounded-t-[2px] bg-line/70">
                      <div
                        className="absolute inset-x-0 bottom-0 rounded-t-[2px] transition-[height] duration-300"
                        style={{ height: `${Math.max(occ > 0 ? 8 : 0, occ * 100)}%`, background: high ? "var(--laterite)" : "var(--adire)" }}
                      />
                    </div>
                    <span className={cn("w-[18px] text-left font-mono text-[9.5px] leading-none", high ? "text-ink" : "text-ink-faint")}>
                      {dem ? Math.round(occ * 100) : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* season lanes */}
          <div className="border-b border-line bg-paper/40">
            {lanes.length === 0 ? (
              <div className="flex h-8 items-center">
                <div className="sticky left-0 z-20 h-full shrink-0 border-r border-line bg-surface" style={{ width: typeW }} />
                <span className="sticky pl-3 text-[12px] text-ink-faint" style={{ left: typeW }}>
                  No seasons in these dates. Drag across nights below to paint one.
                </span>
              </div>
            ) : (
              lanes.map((lane, li) => (
                <div key={li} className="flex" style={{ height: LANE_H + 4 }}>
                  <div className="sticky left-0 z-20 flex shrink-0 items-center border-r border-line bg-surface px-3" style={{ width: typeW }}>
                    {li === 0 && <span className="eyebrow text-[9.5px]">Seasons</span>}
                  </div>
                  <div className="relative flex-1">
                    {lane.flatMap((rule) =>
                      ruleRuns(rule, days).map((run, ri) => {
                        const w = (run.c1 - run.c0 + 1) * COL_W - 4;
                        const isDraft = rule.id.endsWith("::draft");
                        const on = activeRuleId === rule.id;
                        return (
                          <button
                            key={`${rule.id}-${ri}`}
                            type="button"
                            onClick={() => !isDraft && onRuleClick?.(rule)}
                            tabIndex={isDraft ? -1 : undefined}
                            className={cn(
                              "absolute top-[3px] flex items-center gap-1.5 overflow-hidden rounded-[3px] border px-1.5 text-left text-[11px] font-medium leading-none text-ink transition-shadow",
                              on && "ring-2 ring-laterite ring-offset-1 ring-offset-surface",
                              isDraft && "border-dashed animate-[breathe_1.8s_ease-in-out_infinite]",
                            )}
                            style={{
                              left: run.c0 * COL_W + 2,
                              width: w,
                              height: LANE_H,
                              borderColor: `color-mix(in oklab, ${SLOT_VAR(rule.slot)} 55%, transparent)`,
                              background: `color-mix(in oklab, ${SLOT_VAR(rule.slot)} 16%, var(--surface))`,
                              boxShadow: `inset 3px 0 0 ${SLOT_VAR(rule.slot)}`,
                            }}
                            aria-label={`${rule.name}, ${describeAdjustment(rule.adjustment, naira)}, ${describeDays(rule.daysOfWeek)}, priority ${rule.priority}. Edit.`}
                            title={`${rule.name}: ${describeAdjustment(rule.adjustment, naira)}, ${describeDays(rule.daysOfWeek)}, ${formatDay(rule.dateFrom, { day: "numeric", month: "short" })} to ${formatDay(rule.dateTo, { day: "numeric", month: "short" })}. Priority ${rule.priority}.`}
                          >
                            {w > 44 && (
                              <span className="truncate pl-0.5" style={{ marginLeft: Math.max(0, Math.min(w - 120, sx - run.c0 * COL_W)) }}>
                                {rule.name}
                                {rule.roomTypeIds.length > 0 && w > 150 && (
                                  <span className="font-normal text-ink-muted">
                                    {" "}
                                    &middot; {rule.roomTypeIds.length} {rule.roomTypeIds.length === 1 ? "type" : "types"}
                                  </span>
                                )}
                              </span>
                            )}
                            {w > 110 && <span className="ml-auto shrink-0 font-mono text-[10.5px] text-ink-muted">{describeAdjustment(rule.adjustment, naira)}</span>}
                          </button>
                        );
                      }),
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* the grid */}
          <div
            ref={gridRef}
            role="grid"
            aria-label="Nightly rates by room type and date"
            aria-multiselectable="true"
            aria-rowcount={types.length}
            aria-colcount={days.length + 1}
            onPointerDown={onPointerDown}
            onKeyDown={onKeyDown}
            className="touch-pan-x touch-pan-y"
          >
            {types.map((t, r) => (
              <div role="row" key={t.id} className="flex border-b border-line last:border-b-0" style={{ height: ROW_H }}>
                <div
                  role="rowheader"
                  className="sticky left-0 z-20 flex shrink-0 flex-col justify-center border-r border-line bg-surface px-3"
                  style={{ width: typeW }}
                >
                  <span className="line-clamp-2 text-[13.5px] font-medium leading-tight text-ink sm:truncate" title={t.name}>
                    {t.name}
                  </span>
                  <span className="truncate text-[11.5px] text-ink-muted">
                    <span className="font-mono">{naira(t.basePriceKobo)}</span>
                    <span className="hidden sm:inline"> base{t.rooms != null ? ` · ${t.rooms} rooms` : ""}</span>
                  </span>
                </div>
                {days.map((d, c) => {
                  const cell = data.cells.get(t.id)?.get(d);
                  return (
                    <Cell
                      key={d}
                      r={r}
                      c={c}
                      date={d}
                      typeName={t.name}
                      typeId={t.id}
                      cell={cell}
                      rule={cell?.ruleId ? ruleById.get(cell.ruleId) : undefined}
                      ruleById={ruleById}
                      selected={inSel(selection, r, c)}
                      edge={selection && inSel(selection, r, c) ? edges(selection, r, c) : null}
                      focused={fr === r && fc === c}
                      preview={cell && preview ? preview(t.id, cell, r, c) : null}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite">
        {selCount ? `${selCount} ${selCount === 1 ? "night" : "nights"} selected. Press Enter to paint.` : ""}
      </p>
    </div>
  );
}

function edges(s: Selection, r: number, c: number) {
  return { t: r === s.r0, b: r === s.r1, l: c === s.c0, rr: c === s.c1 };
}

function Cell({
  r,
  c,
  date,
  typeName,
  typeId,
  cell,
  rule,
  ruleById,
  selected,
  edge,
  focused,
  preview,
}: {
  r: number;
  c: number;
  date: DayKey;
  typeName: string;
  typeId: string;
  cell?: AlmanacCell;
  rule?: AlmanacRule;
  ruleById: Map<string, AlmanacRule>;
  selected: boolean;
  edge: { t: boolean; b: boolean; l: boolean; rr: boolean } | null;
  focused: boolean;
  preview: ReturnType<Preview>;
}) {
  const weekend = isWeekend(date);
  const first = date.endsWith("-01");
  if (!cell)
    return (
      <div role="gridcell" data-cell={`${r}:${c}`} tabIndex={focused ? 0 : -1} className={cn("shrink-0", weekend && "bg-surface-2/40")} style={{ width: COL_W }} aria-label={`${typeName}, ${formatDay(date)}: no rate`} />
    );
  const changed = preview && preview.priceKobo !== cell.priceKobo;
  const shownRule = preview ? (preview.ruleId ? ruleById.get(preview.ruleId) : undefined) : rule;
  const overridden = preview ? preview.overridden : cell.overrideKobo != null;
  const price = preview?.priceKobo ?? cell.priceKobo;
  const delta = cell.baseKobo ? Math.round(((price - cell.baseKobo) / cell.baseKobo) * 100) : 0;
  const color = shownRule ? SLOT_VAR(shownRule.slot) : null;
  const label = [
    `${typeName}, night of ${formatDay(date, { weekday: "long", day: "numeric", month: "long" })}`,
    naira(price),
    overridden ? "fixed for this night" : shownRule ? `${shownRule.name}` : "base rate",
    cell.minNights && cell.minNights > 1 ? `minimum ${cell.minNights} nights` : "",
    cell.closedToArrival ? "closed to arrival" : "",
    cell.stopSell ? "stop sell" : "",
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <div
      role="gridcell"
      data-cell={`${r}:${c}`}
      data-type={typeId}
      data-date={date}
      aria-selected={selected}
      aria-label={label}
      tabIndex={focused ? 0 : -1}
      className={cn(
        "group relative shrink-0 cursor-cell outline-none",
        weekend && "bg-surface-2/40",
        first && "border-l border-line-strong",
        "focus-visible:z-10 focus-visible:shadow-[inset_0_0_0_2px_var(--laterite)]",
      )}
      style={{
        width: COL_W,
        background: selected
          ? "color-mix(in oklab, var(--laterite) 11%, var(--surface))"
          : color
            ? `color-mix(in oklab, ${color} ${overridden ? 0 : 10}%, var(--surface))`
            : undefined,
      }}
      title={label}
    >
      {/* season stripe */}
      {color && !overridden && <span className="absolute inset-x-0 top-0 h-[3px]" style={{ background: color }} aria-hidden />}
      {/* closed to arrival: a hatched left edge */}
      {cell.closedToArrival && (
        <span className="hatch absolute inset-y-0 left-0 w-[6px] border-r border-[color-mix(in_oklab,var(--danger)_55%,transparent)] text-danger" aria-hidden />
      )}
      <div className={cn("flex h-full flex-col items-end justify-center pr-2", cell.closedToArrival ? "pl-2.5" : "pl-1.5")}>
        {changed && <span className="font-mono text-[9.5px] leading-none text-ink-faint line-through">{thousands(cell.priceKobo)}</span>}
        <span
          className={cn(
            "font-mono text-[12.5px] leading-tight tracking-tight",
            cell.stopSell ? "text-ink-faint line-through" : changed ? "font-medium text-laterite" : shownRule || overridden ? "text-ink" : "text-ink-muted",
          )}
        >
          {thousands(price)}
        </span>
        <span className="flex h-3 items-center gap-1 font-mono text-[9.5px] leading-none text-ink-muted">
          {cell.minNights && cell.minNights > 1 ? (
            <span className="rounded-[2px] border border-line-strong px-[3px] py-[1px] text-ink" title={`Minimum ${cell.minNights} nights`}>
              {cell.minNights}N
            </span>
          ) : null}
          {delta !== 0 && !cell.stopSell && <span>{delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`}%</span>}
        </span>
      </div>
      {overridden && (
        <span className="absolute right-0.5 top-0.5 text-brass" aria-hidden>
          <PushPin size={10} weight="fill" />
        </span>
      )}
      {cell.stopSell && (
        <span className="absolute left-1 top-1 text-danger" aria-hidden>
          <Prohibit size={10} weight="bold" />
        </span>
      )}
      {edge && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 border-laterite"
          style={{
            borderTopWidth: edge.t ? 2 : 0,
            borderBottomWidth: edge.b ? 2 : 0,
            borderLeftWidth: edge.l ? 2 : 0,
            borderRightWidth: edge.rr ? 2 : 0,
          }}
        />
      )}
    </div>
  );
}

/** "65,000": naira without the sign, the column header carries it. */
function thousands(kobo: number) {
  const n = Math.round(kobo / 100);
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2).replace(/0$/, "")}m`;
  return new Intl.NumberFormat("en-NG").format(n);
}

export function selectionDates(days: DayKey[], s: Selection) {
  return { from: days[s.c0], to: days[s.c1], toExclusive: addDays(days[s.c1], 1) };
}
