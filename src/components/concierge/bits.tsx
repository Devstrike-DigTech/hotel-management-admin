"use client";

import { useId, useState } from "react";
import { EyeSlash, Star } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/use-now";
import type { RequestListItem, RequestStatus, ServiceCategory } from "@/lib/api/types-m8";
import { Badge, Tip } from "@/components/ui/primitives";
import { STATUS, categoryMeta } from "./catalog";

export function ReqStatus({ s }: { s: RequestStatus }) {
  const m = STATUS[s];
  return (
    <Badge tone={m.tone} dot>
      {m.label}
    </Badge>
  );
}

export function CategoryGlyph({ category, size = 16, className }: { category: ServiceCategory | null | undefined; size?: number; className?: string }) {
  const I = categoryMeta(category).icon;
  return <I size={size} weight="duotone" className={className} aria-hidden />;
}

/** Who holds concierge.discreet by default (API-M8 0.2). */
export const DISCREET_HOLDERS = "owners, managers and the concierge team";

/**
 * The fine interlocking lines printed inside a security envelope so what's inside can't be read
 * through the paper. Drawn wherever a private request's details are withheld.
 */
export function SecurityTint({ className, dense }: { className?: string; dense?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const s = dense ? 6 : 8;
  return (
    <svg aria-hidden className={cn("pointer-events-none absolute inset-0 h-full w-full", className)}>
      <defs>
        <pattern id={`tint-${id}`} width={s * 2} height={s} patternUnits="userSpaceOnUse">
          <path d={`M0 ${s * 0.75} Q ${s / 2} ${s * 0.1} ${s} ${s * 0.75} T ${s * 2} ${s * 0.75}`} fill="none" stroke="currentColor" strokeWidth="0.7" />
          <path d={`M0 ${s * 0.25} Q ${s / 2} ${s * 0.9} ${s} ${s * 0.25} T ${s * 2} ${s * 0.25}`} fill="none" stroke="currentColor" strokeWidth="0.7" opacity="0.55" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#tint-${id})`} />
    </svg>
  );
}

/** A withheld run of text: the tint where the words would be, and a plain label for screen readers. */
export function Masked({ width = "9ch", label = "Hidden", className }: { width?: string; label?: string; className?: string }) {
  return (
    <span className={cn("relative inline-block h-[1em] translate-y-[0.14em] overflow-hidden rounded-[2px] bg-surface-2 text-ink-faint", className)} style={{ width }}>
      <SecurityTint dense />
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** A wax seal drawn in one line: a scalloped ring around a closed eye. */
export function SealGlyph({ size = 14, className }: { size?: number; className?: string }) {
  const pts = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const r = i % 2 ? 6.2 : 7.2;
    return `${(8 + Math.cos(a) * r).toFixed(2)},${(8 + Math.sin(a) * r).toFixed(2)}`;
  }).join(" ");
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round" aria-hidden className={className}>
      <polygon points={pts} />
      <path d="M4.8 8.2c1.9 1.7 4.5 1.7 6.4 0" strokeLinecap="round" />
      <path d="M6 9.6l-.5 1M8 10.1v1.1M10 9.6l.5 1" strokeLinecap="round" />
    </svg>
  );
}

/** The private mark. Its tooltip says exactly who can read what is sealed. */
export function DiscreetSeal({ compact, className, readable = true }: { compact?: boolean; className?: string; readable?: boolean }) {
  const body = readable ? `Private. Only ${DISCREET_HOLDERS} see the service, notes and guest. The bill uses neutral wording.` : `A private request. Only ${DISCREET_HOLDERS} see what it is and who asked.`;
  return (
    <Tip content={body}>
      <span
        tabIndex={0}
        data-testid="discreet-seal"
        className={cn(
          "inline-flex shrink-0 items-center gap-1 rounded-full border border-[color-mix(in_oklab,var(--brass)_45%,transparent)] bg-brass-wash/70 text-brass outline-none focus-visible:ring-2 focus-visible:ring-laterite",
          compact ? "h-5 w-5 justify-center" : "h-[22px] px-2 text-[11px] font-medium",
          className,
        )}
      >
        <SealGlyph size={12} />
        {compact ? <span className="sr-only">Private</span> : "Private"}
      </span>
    </Tip>
  );
}

/** What a viewer without concierge.discreet reads in place of the service. */
export function PrivateLine({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-ink", className)}>
      <EyeSlash size={14} className="shrink-0 text-ink-muted" aria-hidden />
      <span className="truncate">Private request</span>
    </span>
  );
}

/* ---------------- SLA ---------------- */

type SlaLike = Pick<RequestListItem, "sla" | "status" | "createdAt">;

export function slaState(r: SlaLike, now: number) {
  if (r.sla.firstResponseAt || r.status !== "NEW") return null;
  const left = Date.parse(r.sla.dueAt) - now;
  return { left, over: left < 0 || r.sla.overdue, soon: left >= 0 && left < 5 * 60_000 };
}

function mins(ms: number) {
  const m = Math.max(0, Math.round(Math.abs(ms) / 60_000));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h${m % 60 ? ` ${m % 60} min` : ""}`;
}

/** First-answer clock: an arc that fills as time runs, ochre in the last five minutes, laterite once late. */
export function SlaTimer({ r, className, compact }: { r: SlaLike; className?: string; compact?: boolean }) {
  const now = useNow(15_000);
  const st = slaState(r, now);
  if (!st) return null;
  const span = Math.max(60_000, Date.parse(r.sla.dueAt) - Date.parse(r.createdAt));
  const frac = st.over ? 1 : Math.min(1, Math.max(0, 1 - st.left / span));
  const tone = st.over ? "var(--laterite)" : st.soon ? "var(--ochre)" : "var(--ink-muted)";
  const R = 6;
  const C = 2 * Math.PI * R;
  return (
    <span
      className={cn("inline-flex items-center gap-1.5 font-mono text-[11.5px] tabular-nums", st.over ? "font-medium text-laterite" : st.soon ? "text-ochre" : "text-ink-muted", className)}
      data-testid="sla-timer"
      data-over={st.over || undefined}
      title={st.over ? "Past the first-answer target" : "Time left to answer the guest"}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
        <circle cx="8" cy="8" r={R} fill="none" stroke="var(--line-strong)" strokeWidth="2" />
        <circle cx="8" cy="8" r={R} fill="none" stroke={tone} strokeWidth="2" strokeDasharray={`${C * frac} ${C}`} transform="rotate(-90 8 8)" />
      </svg>
      {compact ? (st.over ? `+${mins(st.left)}` : mins(st.left)) : st.over ? `${mins(st.left)} late` : `${mins(st.left)} to answer`}
      <span className="sr-only">{st.over ? "overdue for a first answer" : "left for a first answer"}</span>
    </span>
  );
}

/* ---------------- Rating ---------------- */

export function StarInput({ value, onChange, label, size = 22 }: { value: number; onChange: (v: number) => void; label: string; size?: number }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex items-center gap-0.5" onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} of 5`}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(n)}
          data-testid={`star-${n}`}
          className="grid place-items-center rounded-xs p-0.5 outline-none focus-visible:ring-2 focus-visible:ring-laterite"
        >
          <Star size={size} weight={n <= shown ? "fill" : "regular"} className={n <= shown ? "text-brass" : "text-line-strong"} />
        </button>
      ))}
    </div>
  );
}
