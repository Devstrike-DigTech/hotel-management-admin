/**
 * Lagos calendar arithmetic. Africa/Lagos is UTC+01:00 all year (no DST), so a
 * business day is a fixed 24h window and we can do exact arithmetic in ms
 * without a timezone library. A "day key" is the Lagos calendar date as
 * "YYYY-MM-DD".
 */

export const LAGOS_OFFSET_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * 60 * 60 * 1000;

export type DayKey = string;

/** Epoch ms of Lagos midnight at the start of the given day key. */
export function dayStartMs(key: DayKey): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d) - LAGOS_OFFSET_MS;
}

/** Lagos day key for an instant. */
export function dayKeyOf(input: Date | string | number = new Date()): DayKey {
  const ms = typeof input === "number" ? input : new Date(input).getTime();
  const d = new Date(ms + LAGOS_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function todayKey(): DayKey {
  return dayKeyOf(Date.now());
}

export function addDays(key: DayKey, n: number): DayKey {
  return dayKeyOf(dayStartMs(key) + n * DAY_MS + DAY_MS / 2);
}

/** Whole days from a to b (b - a). */
export function diffDays(a: DayKey, b: DayKey): number {
  return Math.round((dayStartMs(b) - dayStartMs(a)) / DAY_MS);
}

export function dayRange(from: DayKey, count: number): DayKey[] {
  return Array.from({ length: count }, (_, i) => addDays(from, i));
}

/** 0 = Sunday ... 6 = Saturday, in Lagos. */
export function weekday(key: DayKey): number {
  return new Date(dayStartMs(key) + LAGOS_OFFSET_MS).getUTCDay();
}

export function isWeekend(key: DayKey) {
  const w = weekday(key);
  return w === 5 || w === 6; // Friday and Saturday nights sell like weekends in Lagos
}

/** "HH:MM" -> minutes after midnight. */
export function hhmmToMinutes(t: string | null | undefined, fallback = 0): number {
  if (!t) return fallback;
  const m = t.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return fallback;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** ISO instant for a Lagos wall-clock time on a given day. */
export function lagosIso(key: DayKey, time = "00:00"): string {
  return new Date(dayStartMs(key) + hhmmToMinutes(time) * 60_000).toISOString();
}

/** Lagos wall-clock "HH:MM" for an instant. */
export function lagosHHMM(input: string | number | Date): string {
  const ms = typeof input === "number" ? input : new Date(input).getTime();
  const d = new Date(ms + LAGOS_OFFSET_MS);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Minutes after Lagos midnight for an instant. */
export function lagosMinutes(input: string | number | Date): number {
  const ms = typeof input === "number" ? input : new Date(input).getTime();
  return Math.floor((((ms + LAGOS_OFFSET_MS) % DAY_MS) + DAY_MS) % DAY_MS / 60_000);
}

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function fmt(opts: Intl.DateTimeFormatOptions) {
  const k = JSON.stringify(opts);
  let f = fmtCache.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", { timeZone: "Africa/Lagos", ...opts });
    fmtCache.set(k, f);
  }
  return f;
}

/** Format a day key: default "Tue 23 Sep". */
export function formatDay(key: DayKey, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) {
  return fmt(opts).format(new Date(dayStartMs(key) + 12 * 3600_000));
}

export function shortWeekday(key: DayKey) {
  return formatDay(key, { weekday: "short" });
}

export function monthName(key: DayKey, style: "short" | "long" = "long") {
  return formatDay(key, { month: style });
}

/** Number of nights between two instants using Lagos calendar dates. */
export function nightsBetween(arrivalIso: string, departureIso: string): number {
  return Math.max(0, diffDays(dayKeyOf(arrivalIso), dayKeyOf(departureIso)));
}

/** "2h 30m" style duration from ms. */
export function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60_000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

/** Stay window label: "23 Sep 14:00 to 25 Sep 12:00", compact when same day. */
export function stayWindow(arrivalIso: string, departureIso: string): string {
  const a = dayKeyOf(arrivalIso);
  const b = dayKeyOf(departureIso);
  if (a === b) return `${formatDay(a, { day: "numeric", month: "short" })}, ${lagosHHMM(arrivalIso)} to ${lagosHHMM(departureIso)}`;
  return `${formatDay(a, { day: "numeric", month: "short" })} to ${formatDay(b, { day: "numeric", month: "short" })}`;
}
