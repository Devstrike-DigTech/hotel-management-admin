"use client";

import { Crown, Medal, Star } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatDate, naira, number } from "@/lib/format";

/* Loyalty view model. */
export interface TierView {
  id: string;
  name: string;
  color?: string | null;
  /** nights in the last 12 months to reach it */
  minNights: number;
  bonusPct: number;
  perks: string[];
  members?: number;
  sortOrder?: number;
}

export interface MemberView {
  id: string;
  number?: string | null;
  guestName: string;
  phone?: string | null;
  tierName: string;
  tierIndex: number;
  tierColor?: string | null;
  points: number;
  pointsValueKobo?: number | null;
  nights12m: number;
  nextTier?: { name: string; minNights: number } | null;
  joinedAt?: string | null;
  expiringPoints?: number | null;
  expiringAt?: string | null;
  programmeName: string;
}

export interface StatementRow {
  id: string;
  at: string;
  kind: "EARN" | "REDEEM" | "ADJUST" | "EXPIRE" | "BONUS";
  points: number;
  balance?: number | null;
  description: string;
  reference?: string | null;
  propertyName?: string | null;
  actor?: string | null;
}

/** Tier plates by colour: brushed washes with the tier's glyph. Never colour alone: each has its name and glyph. */
export type TierColorName = "palm" | "brass" | "laterite" | "adire" | "ochre";
const plate = (c: string, a: number, b: number, d: number) =>
  `linear-gradient(135deg, color-mix(in oklab, var(--${c}) ${a}%, var(--surface)) 0%, color-mix(in oklab, var(--${c}) ${b}%, var(--surface)) 55%, color-mix(in oklab, var(--${c}) ${d}%, var(--surface)) 100%)`;
export const TIER_LOOK: Record<TierColorName, { ink: string; plate: string; edge: string; Icon: typeof Star }> = {
  palm: { ink: "var(--palm)", plate: plate("palm", 12, 6, 14), edge: "color-mix(in oklab, var(--palm) 40%, transparent)", Icon: Star },
  adire: { ink: "var(--adire)", plate: plate("adire", 16, 7, 18), edge: "color-mix(in oklab, var(--adire) 40%, transparent)", Icon: Medal },
  brass: { ink: "color-mix(in oklab, var(--brass) 80%, var(--ink))", plate: plate("brass", 26, 12, 32), edge: "color-mix(in oklab, var(--brass) 55%, transparent)", Icon: Crown },
  laterite: { ink: "var(--laterite)", plate: plate("laterite", 16, 7, 20), edge: "color-mix(in oklab, var(--laterite) 40%, transparent)", Icon: Crown },
  ochre: { ink: "var(--ochre)", plate: plate("ochre", 18, 8, 22), edge: "color-mix(in oklab, var(--ochre) 45%, transparent)", Icon: Medal },
};
const ORDER: TierColorName[] = ["palm", "adire", "brass", "laterite", "ochre"];
export const tierLook = (color?: string | null, index = 0) => TIER_LOOK[(color as TierColorName) in TIER_LOOK ? (color as TierColorName) : ORDER[Math.max(0, Math.min(ORDER.length - 1, index))]];
/** @deprecated index-based lookup kept for previews */
export const tierStyle = (i: number) => tierLook(null, i);

export function TierBadge({ name, index = 0, color, className }: { name: string; index?: number; color?: string | null; className?: string }) {
  const s = tierLook(color, index);
  const I = s.Icon;
  return (
    <span
      className={cn("inline-flex h-[22px] items-center gap-1 rounded-xs border px-1.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.1em]", className)}
      style={{ color: s.ink, borderColor: s.edge, background: s.plate }}
    >
      <I size={11} weight="fill" /> {name}
    </span>
  );
}

/**
 * The tier ladder: a ruler of nights in the last 12 months with each tier's
 * threshold as a rung, and how many members stand on each.
 */
export function TierLadder({ tiers, max }: { tiers: TierView[]; max?: number }) {
  const sorted = [...tiers].sort((a, b) => a.minNights - b.minNights);
  const top = max ?? Math.max(10, Math.ceil((sorted[sorted.length - 1]?.minNights ?? 10) * 1.35));
  const total = sorted.reduce((s, t) => s + (t.members ?? 0), 0);
  return (
    <div>
      <div className="relative h-16">
        <div className="absolute inset-x-0 top-8 h-px bg-line-strong" />
        {Array.from({ length: Math.floor(top / 5) + 1 }, (_, i) => i * 5).map((n) => (
          <span key={n} className="absolute top-[30px] h-[5px] w-px bg-line-strong" style={{ left: `${(n / top) * 100}%` }} aria-hidden />
        ))}
        {sorted.map((t, i) => {
          const s = tierLook(t.color, i);
          const I = s.Icon;
          const left = (t.minNights / top) * 100;
          return (
            <div key={t.id} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${Math.min(97, Math.max(3, left))}%` }}>
              <span className="grid h-7 w-7 place-items-center rounded-full border" style={{ color: s.ink, borderColor: s.edge, background: s.plate }}>
                <I size={13} weight="fill" />
              </span>
              <span className="mt-[3px] h-[9px] w-[2px]" style={{ background: s.ink }} aria-hidden />
              <span className="mt-1 whitespace-nowrap font-mono text-[10.5px] text-ink-muted">{t.minNights}n</span>
            </div>
          );
        })}
      </div>
      <p className="mt-1 text-right font-mono text-[10px] text-ink-faint">nights in the last 12 months</p>
      {total > 0 && (
        <div className="mt-4">
          <div className="flex h-2.5 overflow-hidden rounded-xs" aria-hidden>
            {sorted.map((t, i) => (
              <span key={t.id} style={{ width: `${((t.members ?? 0) / total) * 100}%`, background: tierLook(t.color, i).ink, opacity: 0.85 }} className="border-r border-surface last:border-r-0" />
            ))}
          </div>
          <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-muted">
            {sorted.map((t, i) => (
              <li key={t.id} className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-[2px]" style={{ background: tierLook(t.color, i).ink }} aria-hidden />
                {t.name} <span className="font-mono text-ink">{number(t.members ?? 0)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The member card: a brass-edged plate with the balance and the road to the next tier. */
export function MemberCard({ m, className }: { m: MemberView; className?: string }) {
  const s = tierLook(m.tierColor, m.tierIndex);
  const next = m.nextTier;
  const progress = next ? Math.min(1, m.nights12m / Math.max(1, next.minNights)) : 1;
  return (
    <div className={cn("relative overflow-hidden rounded-lg border p-5 sm:p-6", className)} style={{ background: s.plate, borderColor: s.edge }}>
      <svg aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 opacity-[0.14]" viewBox="0 0 48 48" fill="none" stroke={s.ink} strokeWidth="0.6">
        <circle cx="24" cy="24" r="22" />
        <circle cx="24" cy="24" r="16" />
        <circle cx="24" cy="24" r="10" />
        <circle cx="24" cy="24" r="4" />
      </svg>
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow text-[10px]" style={{ color: s.ink }}>
            {m.programmeName}
          </p>
          <p className="display mt-1 truncate text-[28px] leading-tight text-ink">{m.guestName}</p>
          {m.number && <p className="mt-0.5 font-mono text-[12px] tracking-[0.18em] text-ink-muted">{m.number}</p>}
        </div>
        <TierBadge name={m.tierName} index={m.tierIndex} color={m.tierColor} />
      </div>
      <div className="relative mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="display-sm text-[13px] italic text-ink-muted">Points</p>
          <p className="font-mono text-[40px] leading-none tracking-tight text-ink" data-testid="member-points">
            {number(m.points)}
          </p>
          {m.pointsValueKobo != null && <p className="mt-1 text-[12.5px] text-ink-muted">worth {naira(m.pointsValueKobo)} off a bill</p>}
        </div>
        <div className="min-w-[200px] flex-1 sm:max-w-[280px]">
          <div className="flex items-baseline justify-between text-[12px] text-ink-muted">
            <span>
              <span className="font-mono text-ink">{m.nights12m}</span> nights this year
            </span>
            {next ? (
              <span>
                <span className="font-mono text-ink">{Math.max(0, next.minNights - m.nights12m)}</span> to {next.name}
              </span>
            ) : (
              <span>top tier</span>
            )}
          </div>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--ink)_10%,transparent)]" role="meter" aria-valuemin={0} aria-valuemax={next?.minNights ?? m.nights12m} aria-valuenow={m.nights12m} aria-label="Nights toward the next tier">
            <div className="h-full rounded-full" style={{ width: `${progress * 100}%`, background: s.ink }} />
          </div>
        </div>
      </div>
      {!!m.expiringPoints && m.expiringAt && (
        <p className="relative mt-4 text-[12px] text-ochre">
          {number(m.expiringPoints)} points expire on {formatDate(m.expiringAt)}.
        </p>
      )}
    </div>
  );
}

const KIND_META: Record<StatementRow["kind"], { label: string; tone: string }> = {
  EARN: { label: "Earned", tone: "text-palm" },
  BONUS: { label: "Bonus", tone: "text-palm" },
  REDEEM: { label: "Redeemed", tone: "text-laterite" },
  ADJUST: { label: "Adjusted", tone: "text-adire" },
  EXPIRE: { label: "Expired", tone: "text-ink-faint" },
};

export function PointsStatement({ rows }: { rows: StatementRow[] }) {
  if (!rows.length) return <p className="px-5 py-8 text-center text-[13px] text-ink-muted">No points yet. They are earned at check-out.</p>;
  return (
    <table className="w-full text-[13px]">
      <thead>
        <tr className="border-b border-line text-left">
          <th className="eyebrow px-5 py-2.5 text-[10px] font-normal">Date</th>
          <th className="eyebrow px-2 py-2.5 text-[10px] font-normal">What</th>
          <th className="eyebrow px-2 py-2.5 text-right text-[10px] font-normal">Points</th>
          <th className="eyebrow hidden px-5 py-2.5 text-right text-[10px] font-normal sm:table-cell">Balance</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-dashed border-line last:border-b-0">
            <td className="whitespace-nowrap px-5 py-2.5 align-top font-mono text-[12px] text-ink-muted">{formatDate(r.at, { day: "numeric", month: "short", year: "2-digit" })}</td>
            <td className="px-2 py-2.5 align-top">
              <span className={cn("mr-2 font-mono text-[10px] uppercase tracking-[0.12em]", KIND_META[r.kind].tone)}>{KIND_META[r.kind].label}</span>
              <span className="text-ink">{r.description}</span>
              {(r.reference || r.propertyName || r.actor) && (
                <span className="block text-[11.5px] text-ink-faint">
                  {[r.reference, r.propertyName, r.actor ? `by ${r.actor}` : null].filter(Boolean).join(" · ")}
                </span>
              )}
            </td>
            <td className={cn("whitespace-nowrap px-2 py-2.5 text-right align-top font-mono", r.points >= 0 ? "text-palm" : "text-laterite")}>
              {r.points >= 0 ? "+" : "−"}
              {number(Math.abs(r.points))}
            </td>
            <td className="hidden whitespace-nowrap px-5 py-2.5 text-right align-top font-mono text-ink sm:table-cell">{r.balance != null ? number(r.balance) : ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
