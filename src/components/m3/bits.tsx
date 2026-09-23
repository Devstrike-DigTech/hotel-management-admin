"use client";

import { Globe, Storefront, Star, Hourglass } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/use-now";

/* Small M3 pieces: online channel badges, the hold countdown and stars. */

/** Brass for text: plain brass is under 3:1 on paper, so it is pulled toward ink. */
export const BRASS_TEXT = "color-mix(in oklab, var(--brass) 62%, var(--ink))";

export type OnlineChannel = "MARKETPLACE" | "BOOKING_SITE";
export const isOnlineSource = (s: string | null | undefined): s is OnlineChannel => s === "MARKETPLACE" || s === "BOOKING_SITE";

export const CHANNEL_META: Record<OnlineChannel, { label: string; short: string; color: string; wash: string; blurb: string }> = {
  MARKETPLACE: {
    label: "Marketplace",
    short: "MKT",
    color: "var(--brass)",
    wash: "var(--brass-wash)",
    blurb: "Booked on the marketplace. Commission applies.",
  },
  BOOKING_SITE: {
    label: "Booking site",
    short: "SITE",
    color: "var(--adire)",
    wash: "var(--adire-wash)",
    blurb: "Booked on your own booking site. No commission.",
  },
};

/**
 * Where an online booking came from. A stamped chip: glyph, name, and colour
 * that never carries the meaning alone.
 */
export function ChannelBadge({
  source,
  size = "md",
  compact,
  className,
}: {
  source: OnlineChannel;
  size?: "sm" | "md";
  /** MKT / SITE instead of the full name, for tight rows */
  compact?: boolean;
  className?: string;
}) {
  const m = CHANNEL_META[source];
  const I = source === "MARKETPLACE" ? Storefront : Globe;
  return (
    <span
      data-testid="channel-badge"
      data-channel={source}
      title={m.blurb}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-xs border font-mono font-medium uppercase leading-none whitespace-nowrap",
        size === "sm" ? "h-[18px] px-1 text-[9.5px] tracking-[0.1em]" : "h-[22px] px-1.5 text-[10.5px] tracking-[0.12em]",
        className,
      )}
      style={{
        // brass on its wash is under 3:1; pull the text toward ink for AA
        color: source === "MARKETPLACE" ? BRASS_TEXT : m.color,
        borderColor: `color-mix(in oklab, ${m.color} 45%, transparent)`,
        background: `color-mix(in oklab, ${m.wash} 70%, transparent)`,
      }}
    >
      <I size={size === "sm" ? 10 : 12} weight="bold" aria-hidden />
      {compact ? (
        <>
          <span aria-hidden>{m.short}</span>
          <span className="sr-only">{m.label}</span>
        </>
      ) : (
        m.label
      )}
    </span>
  );
}

/** Channel badge for online sources, the plain mono tag for everything else. */
export function SourceMark({ source, size, fallback }: { source: string; size?: "sm" | "md"; fallback?: React.ReactNode }) {
  if (isOnlineSource(source)) return <ChannelBadge source={source} size={size} />;
  return <>{fallback ?? null}</>;
}

function mmss(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Time left on an unpaid online hold. Calm by default, ochre in the last five
 * minutes, and a plain "hold lapsed" once it is past.
 */
export function HoldCountdown({
  expiresAt,
  totalMs = 20 * 60_000,
  variant = "chip",
  className,
}: {
  expiresAt: string;
  totalMs?: number;
  variant?: "chip" | "inline" | "block";
  className?: string;
}) {
  const now = useNow(1000);
  const left = +new Date(expiresAt) - now;
  const lapsed = left <= 0;
  const late = !lapsed && left < 5 * 60_000;
  const ratio = Math.max(0, Math.min(1, left / totalMs));
  const color = lapsed ? "var(--ink-faint)" : late ? "var(--ochre)" : "var(--brass)";
  const textColor = lapsed ? "var(--ink-muted)" : late ? "color-mix(in oklab, var(--ochre) 70%, var(--ink))" : BRASS_TEXT;
  const label = lapsed ? "Hold lapsed" : `Hold ${mmss(left)}`;
  const aria = lapsed ? "The payment hold has lapsed" : `Payment hold, ${Math.ceil(left / 60_000)} minutes left`;

  if (variant === "inline")
    return (
      <span className={cn("inline-flex items-center gap-1 font-mono text-[11.5px]", className)} style={{ color: textColor }} role="timer" aria-label={aria}>
        <Hourglass size={12} weight="duotone" aria-hidden />
        {lapsed ? "lapsed" : mmss(left)}
      </span>
    );

  if (variant === "block") {
    const R = 17;
    const C = 2 * Math.PI * R;
    return (
      <div className={cn("flex items-center gap-3", className)} role="timer" aria-label={aria}>
        <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden className="shrink-0 -rotate-90">
          <circle cx="22" cy="22" r={R} fill="none" strokeWidth="2" style={{ stroke: "var(--line)" }} />
          <circle
            cx="22"
            cy="22"
            r={R}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - ratio)}
            style={{ stroke: color, transition: "stroke-dashoffset 900ms linear" }}
          />
        </svg>
        <div className="min-w-0">
          <p className="eyebrow mb-1 text-[10px]">Payment hold</p>
          <p className="font-mono text-[22px] leading-none tracking-tight" style={{ color: lapsed ? "var(--ink-muted)" : "var(--ink)" }}>
            {lapsed ? "00:00" : mmss(left)}
          </p>
          <p className="mt-1 text-[12px] text-ink-muted">
            {lapsed ? "The hold lapsed. The room goes back on sale unless payment lands." : "Held while the guest pays online. It releases itself if they don't."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <span
      role="timer"
      aria-label={aria}
      className={cn("inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2 font-mono text-[11px] font-medium", className)}
      style={{
        color: textColor,
        borderColor: `color-mix(in oklab, ${color} 40%, transparent)`,
        background: `color-mix(in oklab, ${color} 9%, transparent)`,
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden className="-rotate-90">
        <circle cx="6" cy="6" r="4.5" fill="none" strokeWidth="1.4" style={{ stroke: `color-mix(in oklab, ${color} 30%, transparent)` }} />
        <circle
          cx="6"
          cy="6"
          r="4.5"
          fill="none"
          strokeWidth="1.4"
          strokeDasharray={2 * Math.PI * 4.5}
          strokeDashoffset={2 * Math.PI * 4.5 * (1 - ratio)}
          style={{ stroke: color }}
        />
      </svg>
      {label}
    </span>
  );
}

/** Five stars, filled to the nearest half. */
export function Stars({ value, size = 13, className, label }: { value: number; size?: number; className?: string; label?: string }) {
  const v = Math.max(0, Math.min(5, Math.round(value * 2) / 2));
  return (
    <span className={cn("inline-flex items-center gap-[1px] text-brass", className)} role="img" aria-label={label ?? `${value.toFixed(1)} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = v >= i + 1 ? "full" : v >= i + 0.5 ? "half" : "none";
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }}>
            <Star size={size} weight="regular" className="absolute inset-0 opacity-45" aria-hidden />
            {fill !== "none" && (
              <span className="absolute inset-y-0 left-0 overflow-hidden" style={{ width: fill === "half" ? size / 2 : size }}>
                <Star size={size} weight="fill" aria-hidden />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

/** A bare figure like 4.6 in mono with a brass star. */
export function RatingFigure({ value, className }: { value: number | null | undefined; className?: string }) {
  if (value == null) return <span className={cn("font-mono text-ink-faint", className)}>-</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono tabular-nums text-ink", className)}>
      <Star size={12} weight="fill" className="text-brass" aria-hidden />
      {value.toFixed(1)}
    </span>
  );
}
