export const LAGOS_TZ = "Africa/Lagos";

const nairaFmt = new Intl.NumberFormat("en-NG", {
  style: "currency",
  currency: "NGN",
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0,
});

/** Kobo integer -> "₦12,500". Null/undefined -> em dash placeholder supplied by caller. */
export function naira(kobo: number | null | undefined, fallback = "Custom"): string {
  if (kobo === null || kobo === undefined || Number.isNaN(kobo)) return fallback;
  return nairaFmt.format(Math.round(kobo / 100));
}

/** Kobo -> compact "₦1.2m" / "₦845k" for headline figures. */
export function nairaCompact(kobo: number | null | undefined): string {
  if (kobo === null || kobo === undefined) return "-";
  const n = kobo / 100;
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `₦${trim(n / 1_000_000_000)}bn`;
  if (abs >= 1_000_000) return `₦${trim(n / 1_000_000)}m`;
  if (abs >= 10_000) return `₦${trim(n / 1_000)}k`;
  return nairaFmt.format(Math.round(n));
}

function trim(v: number) {
  const s = v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2);
  return s.includes(".") ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

export function number(n: number | null | undefined): string {
  if (n === null || n === undefined) return "-";
  return new Intl.NumberFormat("en-NG").format(n);
}

export function percent(ratio: number | null | undefined, digits = 0): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) return "-";
  // accept both 0..1 and 0..100
  const v = ratio <= 1 ? ratio * 100 : ratio;
  return `${v.toFixed(digits)}%`;
}

export function ratioOf(value: number | null | undefined): number {
  if (value === null || value === undefined || Number.isNaN(value)) return 0;
  return value > 1 ? value / 100 : value;
}

export function formatDate(iso: string | null | undefined, opts: Intl.DateTimeFormatOptions = {}): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: LAGOS_TZ,
    ...opts,
  }).format(d);
}

export function formatDateTime(iso: string | null | undefined): string {
  return formatDate(iso, { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: LAGOS_TZ,
  }).format(new Date(iso));
}

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "-";
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 365 * 864e5],
    ["month", 30 * 864e5],
    ["week", 7 * 864e5],
    ["day", 864e5],
    ["hour", 36e5],
    ["minute", 6e4],
  ];
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

/** Whole days until the given instant (ceil), never negative. */
export function daysUntil(iso: string | null | undefined, now = Date.now()): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now;
  return Math.max(0, Math.ceil(ms / 864e5));
}

/** Hour of day in Lagos, 0..23. */
export function lagosHour(date = new Date()): number {
  const h = new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: LAGOS_TZ }).format(date);
  return Number(h) % 24;
}

export function greeting(date = new Date()): string {
  const h = lagosHour(date);
  if (h < 5) return "Still up";
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export function lagosLongDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: LAGOS_TZ,
  }).format(date);
}

export function firstName(full: string | null | undefined): string {
  if (!full) return "";
  return full.trim().split(/\s+/)[0] ?? "";
}

export function initials(full: string | null | undefined): string {
  if (!full) return "?";
  const parts = full.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .split(/[_\s]+/)
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** "+2348031234567" -> "+234 803 123 4567" */
export function formatPhone(p: string | null | undefined): string {
  if (!p) return "-";
  const m = p.replace(/\s+/g, "").match(/^\+234(\d{3})(\d{3})(\d{4})$/);
  return m ? `+234 ${m[1]} ${m[2]} ${m[3]}` : p;
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}
