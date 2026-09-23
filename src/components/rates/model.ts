import { addDays, diffDays, weekday, type DayKey } from "@/lib/dates";

/* ------------------------------------------------------------------------ */
/* The Rate Almanac's own view model. The API's calendar is adapted into     */
/* these shapes, so the grid engine does not depend on the wire contract.    */
/* ------------------------------------------------------------------------ */

export type AdjustmentType = "PERCENT" | "AMOUNT" | "FIXED";

export interface Adjustment {
  type: AdjustmentType;
  /** PERCENT: whole percent (10 = +10%, -15 = -15%). AMOUNT / FIXED: kobo. */
  value: number;
}

export interface AlmanacRule {
  id: string;
  name: string;
  /** colour slot 1..5 (validated categorical order) */
  slot: number;
  roomTypeIds: string[]; // empty = every room type
  dateFrom: DayKey;
  dateTo: DayKey; // inclusive
  daysOfWeek: number[]; // 0 Sun .. 6 Sat; empty = every night
  adjustment: Adjustment;
  priority: number;
  active?: boolean;
}

export interface AlmanacCell {
  date: DayKey;
  priceKobo: number;
  baseKobo: number;
  ruleId: string | null;
  overrideKobo: number | null;
  minNights: number | null;
  closedToArrival: boolean;
  stopSell?: boolean;
  available?: number | null;
}

export interface AlmanacType {
  id: string;
  name: string;
  basePriceKobo: number;
  rooms?: number;
}

export interface AlmanacDemand {
  date: DayKey;
  /** 0..1 forecast occupancy (booked + held) */
  occupancy: number;
  booked?: number;
  total?: number;
}

export interface AlmanacData {
  from: DayKey;
  days: DayKey[];
  types: AlmanacType[];
  /** typeId -> date -> cell */
  cells: Map<string, Map<DayKey, AlmanacCell>>;
  rules: AlmanacRule[];
  demand: Map<DayKey, AlmanacDemand>;
}

/** A rectangular selection: rows [r0..r1] x columns [c0..c1], inclusive. */
export interface Selection {
  r0: number;
  r1: number;
  c0: number;
  c1: number;
}

export function norm(anchor: { r: number; c: number }, head: { r: number; c: number }): Selection {
  return {
    r0: Math.min(anchor.r, head.r),
    r1: Math.max(anchor.r, head.r),
    c0: Math.min(anchor.c, head.c),
    c1: Math.max(anchor.c, head.c),
  };
}

export const inSel = (s: Selection | null, r: number, c: number) => !!s && r >= s.r0 && r <= s.r1 && c >= s.c0 && c <= s.c1;

export function applyAdjustment(baseKobo: number, a: Adjustment): number {
  if (a.type === "FIXED") return Math.max(0, a.value);
  if (a.type === "AMOUNT") return Math.max(0, baseKobo + a.value);
  // round to the nearest ₦100, the way a front desk would quote it
  return Math.max(0, Math.round((baseKobo * (1 + a.value / 100)) / 10_000) * 10_000);
}

export function ruleCovers(rule: AlmanacRule, typeId: string, date: DayKey): boolean {
  if (rule.active === false) return false;
  if (date < rule.dateFrom || date > rule.dateTo) return false;
  if (rule.roomTypeIds.length && !rule.roomTypeIds.includes(typeId)) return false;
  if (rule.daysOfWeek.length && !rule.daysOfWeek.includes(weekday(date))) return false;
  return true;
}

/**
 * Client-side resolution, used only to preview a change before it is saved.
 * The server's resolver is the source of truth; this mirrors it: an override
 * wins, otherwise the highest-priority covering rule adjusts the base price.
 */
export function previewCell(
  cell: AlmanacCell,
  typeId: string,
  rules: AlmanacRule[],
  draft?: { rule?: AlmanacRule; overrideKobo?: number | null; inDraft: boolean },
): { priceKobo: number; ruleId: string | null; overridden: boolean } {
  if (draft?.inDraft && draft.overrideKobo != null) return { priceKobo: draft.overrideKobo, ruleId: null, overridden: true };
  if (cell.overrideKobo != null && !(draft?.inDraft && draft.overrideKobo === null))
    return { priceKobo: cell.overrideKobo, ruleId: null, overridden: true };
  const all = draft?.rule ? [...rules.filter((r) => r.id !== draft.rule!.id), draft.rule] : rules;
  let best: AlmanacRule | null = null;
  for (const r of all) {
    if (!ruleCovers(r, typeId, cell.date)) continue;
    if (!best || r.priority > best.priority || (r.priority === best.priority && r.id === draft?.rule?.id)) best = r;
  }
  if (!best) return { priceKobo: cell.baseKobo, ruleId: null, overridden: false };
  return { priceKobo: applyAdjustment(cell.baseKobo, best.adjustment), ruleId: best.id, overridden: false };
}

/** Lay rules out in lanes so their date spans never overlap within a lane. */
export function packRuleLanes(rules: AlmanacRule[], from: DayKey, to: DayKey) {
  const visible = rules
    .filter((r) => r.active !== false && r.dateTo >= from && r.dateFrom <= to)
    .sort((a, b) => b.priority - a.priority || a.dateFrom.localeCompare(b.dateFrom));
  const lanes: AlmanacRule[][] = [];
  for (const r of visible) {
    const lane = lanes.find((l) => l.every((x) => x.dateTo < r.dateFrom || x.dateFrom > r.dateTo));
    if (lane) lane.push(r);
    else lanes.push([r]);
  }
  return lanes;
}

/** The runs of consecutive covered dates of a rule inside the window (DOW rules split into pieces). */
export function ruleRuns(rule: AlmanacRule, days: DayKey[]): { c0: number; c1: number }[] {
  const out: { c0: number; c1: number }[] = [];
  let start = -1;
  days.forEach((d, i) => {
    const on =
      d >= rule.dateFrom && d <= rule.dateTo && (!rule.daysOfWeek.length || rule.daysOfWeek.includes(weekday(d)));
    if (on && start < 0) start = i;
    if (!on && start >= 0) {
      out.push({ c0: start, c1: i - 1 });
      start = -1;
    }
  });
  if (start >= 0) out.push({ c0: start, c1: days.length - 1 });
  return out;
}

export function describeAdjustment(a: Adjustment, naira: (k: number) => string): string {
  if (a.type === "FIXED") return `${naira(a.value)} fixed`;
  if (a.type === "AMOUNT") return `${a.value >= 0 ? "+" : "−"}${naira(Math.abs(a.value))}`;
  return `${a.value >= 0 ? "+" : "−"}${Math.abs(a.value)}%`;
}

export const DOW_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function describeDays(dows: number[]): string {
  if (!dows.length || dows.length === 7) return "every night";
  const s = [...dows].sort();
  if (s.join() === "5,6") return "Friday and Saturday nights";
  if (s.join() === "0,6") return "Saturday and Sunday nights";
  if (s.join() === "1,2,3,4") return "Monday to Thursday nights";
  return s.map((d) => DOW_LABEL[d]).join(", ");
}

export function spanNights(from: DayKey, to: DayKey) {
  return diffDays(from, to) + 1;
}

export function windowDays(from: DayKey, count: number): DayKey[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}

export const SLOT_VAR = (slot: number) => `var(--season-${((Math.max(1, slot) - 1) % 5) + 1})`;
