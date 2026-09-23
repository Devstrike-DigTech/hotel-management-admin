"use client";

import { cn } from "@/lib/cn";
import { naira, nairaCompact } from "@/lib/format";

export type BucketKey = "CURRENT" | "D31_60" | "D61_90" | "D90_PLUS";
export type Buckets = Record<BucketKey, number>;

/** Older money is darker: one hue (laterite), light to dark, so age reads as magnitude. */
export const BUCKETS: { key: BucketKey; label: string; short: string; shade: string }[] = [
  { key: "CURRENT", label: "0 to 30 days", short: "0-30", shade: "color-mix(in oklab, var(--laterite) 28%, var(--surface))" },
  { key: "D31_60", label: "31 to 60 days", short: "31-60", shade: "color-mix(in oklab, var(--laterite) 52%, var(--surface))" },
  { key: "D61_90", label: "61 to 90 days", short: "61-90", shade: "color-mix(in oklab, var(--laterite) 76%, var(--surface))" },
  { key: "D90_PLUS", label: "Over 90 days", short: "90+", shade: "var(--laterite)" },
];

export const bucketTotal = (b: Buckets) => BUCKETS.reduce((s, k) => s + (b[k.key] ?? 0), 0);

/** The headline aging bar, direct-labelled, with a table behind it for screen readers. */
export function AgingBar({ buckets, className }: { buckets: Buckets; className?: string }) {
  const total = bucketTotal(buckets);
  return (
    <div className={className}>
      <div className="flex h-10 w-full gap-[2px] overflow-hidden rounded-[3px] bg-surface-2" role="img" aria-label={`Outstanding by age: ${BUCKETS.map((b) => `${b.label} ${naira(buckets[b.key] ?? 0)}`).join(", ")}`}>
        {total > 0 &&
          BUCKETS.map((b) => {
            const v = buckets[b.key] ?? 0;
            if (!v) return null;
            return <span key={b.key} className="h-full min-w-[3px]" style={{ width: `${(v / total) * 100}%`, background: b.shade }} title={`${b.label}: ${naira(v)}`} />;
          })}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {BUCKETS.map((b) => {
          const v = buckets[b.key] ?? 0;
          return (
            <div key={b.key} className="flex flex-col gap-0.5 border-l-2 pl-2.5" style={{ borderColor: b.shade }}>
              <dt className="text-[11.5px] text-ink-muted">{b.label}</dt>
              <dd className={cn("font-mono text-[17px] leading-tight", v ? "text-ink" : "text-ink-faint")}>{naira(v)}</dd>
              <dd className="font-mono text-[10.5px] text-ink-faint">{total ? `${Math.round((v / total) * 100)}%` : "0%"}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/** A compact per-account aging strip for tables. */
export function AgingStrip({ buckets, width = 120 }: { buckets: Buckets; width?: number }) {
  const total = bucketTotal(buckets);
  if (!total) return <span className="font-mono text-[11px] text-ink-faint">settled</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex h-2 gap-px overflow-hidden rounded-[2px] bg-surface-2" style={{ width }} aria-hidden>
        {BUCKETS.map((b) => {
          const v = buckets[b.key] ?? 0;
          return v ? <span key={b.key} className="h-full" style={{ width: `${(v / total) * 100}%`, background: b.shade }} /> : null;
        })}
      </span>
      <span className="sr-only">{BUCKETS.map((b) => `${b.short} days ${naira(buckets[b.key] ?? 0)}`).join(", ")}</span>
      {(buckets.D90_PLUS ?? 0) > 0 && <span className="font-mono text-[10.5px] text-laterite">{nairaCompact(buckets.D90_PLUS)} 90+</span>}
    </span>
  );
}

/** Credit used against the limit. */
export function CreditMeter({ usedKobo, limitKobo }: { usedKobo: number; limitKobo: number | null }) {
  if (!limitKobo) return <span className="text-[12px] text-ink-faint">no limit</span>;
  const r = Math.min(1, usedKobo / limitKobo);
  const over = usedKobo > limitKobo;
  const tone = over ? "var(--danger)" : r >= 0.85 ? "var(--ochre)" : "var(--ink)";
  return (
    <span className="flex min-w-[120px] flex-col gap-1">
      <span className="flex justify-between font-mono text-[11px]">
        <span className={over ? "text-danger" : "text-ink"}>{nairaCompact(usedKobo)}</span>
        <span className="text-ink-faint">of {nairaCompact(limitKobo)}</span>
      </span>
      <span className="relative h-1.5 overflow-hidden rounded-xs bg-surface-2" role="meter" aria-label="Credit used" aria-valuemin={0} aria-valuemax={limitKobo} aria-valuenow={usedKobo}>
        <span className="absolute inset-y-0 left-0 rounded-xs" style={{ width: `${r * 100}%`, background: tone, opacity: 0.85 }} />
      </span>
    </span>
  );
}
