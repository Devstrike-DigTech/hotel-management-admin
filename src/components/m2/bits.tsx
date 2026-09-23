"use client";

import { useState } from "react";
import { Check, Copy, Crown, Minus, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { naira } from "@/lib/format";
import { SOURCES, STAY_STATUS, type ReservationSource, type ReservationStatus } from "@/lib/catalog-m2";
import { Badge } from "@/components/ui/primitives";

export function StayBadge({ status, className }: { status: ReservationStatus; className?: string }) {
  const m = STAY_STATUS[status];
  return (
    <Badge tone={m.tone} dot className={className}>
      {m.label}
    </Badge>
  );
}

export function SourceTag({ source }: { source: ReservationSource }) {
  return <span className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-faint">{SOURCES[source]}</span>;
}

/** Reservation code, mono, copyable. */
export function Code({ value, className, copy = false }: { value: string; className?: string; copy?: boolean }) {
  const [done, setDone] = useState(false);
  if (!copy) return <span className={cn("font-mono tracking-wide", className)}>{value}</span>;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          window.setTimeout(() => setDone(false), 1400);
        });
      }}
      className={cn("group inline-flex items-center gap-1.5 font-mono tracking-wide hover:text-ink", className)}
      aria-label={`Copy ${value}`}
    >
      {value}
      {done ? <Check size={12} className="text-palm" /> : <Copy size={12} className="opacity-0 transition-opacity group-hover:opacity-60" />}
    </button>
  );
}

export function GuestName({ name, vip, className }: { name: string; vip?: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>
      <span className="truncate">{name}</span>
      {vip && (
        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-xs border border-[color-mix(in_oklab,var(--brass)_45%,transparent)] px-1 font-mono text-[9px] font-medium uppercase tracking-wider text-brass">
          <Crown size={9} weight="fill" />
          VIP
        </span>
      )}
    </span>
  );
}

/** Signed naira amount in mono, coloured by sign when asked. */
export function Money({
  kobo,
  className,
  signed,
  tone,
}: {
  kobo: number | null | undefined;
  className?: string;
  signed?: boolean;
  tone?: "balance" | "none";
}) {
  if (kobo === null || kobo === undefined) return <span className={cn("font-mono text-ink-faint", className)}>-</span>;
  const neg = kobo < 0;
  const text = naira(Math.abs(kobo), "-");
  return (
    <span
      className={cn(
        "font-mono tabular-nums",
        tone === "balance" && (kobo > 0 ? "text-ochre" : kobo < 0 ? "text-palm" : "text-ink-muted"),
        className,
      )}
    >
      {neg ? "−" : signed && kobo > 0 ? "+" : ""}
      {text}
    </span>
  );
}

export function BalancePill({ kobo }: { kobo: number }) {
  if (kobo === 0)
    return (
      <span className="inline-flex items-center gap-1 font-mono text-[12px] text-palm">
        <Check size={12} weight="bold" /> settled
      </span>
    );
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center rounded-full border px-2 font-mono text-[11.5px] font-medium",
        kobo > 0
          ? "border-[color-mix(in_oklab,var(--ochre)_35%,transparent)] bg-ochre-wash text-ochre"
          : "border-[color-mix(in_oklab,var(--palm)_30%,transparent)] bg-palm-wash text-palm",
      )}
      title={kobo > 0 ? "Guest owes" : "In credit"}
    >
      {kobo > 0 ? "owes " : "credit "}
      {naira(Math.abs(kobo))}
    </span>
  );
}

export function Stepper({
  value,
  onChange,
  min = 0,
  max = 99,
  label,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label: string;
  suffix?: string;
}) {
  return (
    <div className="inline-flex h-10 items-stretch overflow-hidden rounded-md border border-line-strong bg-surface" role="group" aria-label={label}>
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="grid w-9 place-items-center text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
        aria-label={`Fewer ${label}`}
      >
        <Minus size={13} weight="bold" />
      </button>
      <span className="flex min-w-[52px] items-center justify-center gap-1 border-x border-line px-2 font-mono text-[14px] text-ink" aria-live="polite">
        {value}
        {suffix && <span className="font-sans text-[12px] text-ink-muted">{suffix}</span>}
      </span>
      <button
        type="button"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="grid w-9 place-items-center text-ink-muted hover:bg-surface-2 hover:text-ink disabled:opacity-40"
        aria-label={`More ${label}`}
      >
        <Plus size={13} weight="bold" />
      </button>
    </div>
  );
}

/** Pill radio row (chips) for short enumerations. */
export function ChipRadio<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; disabled?: boolean }[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("flex flex-wrap gap-1.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium transition-colors disabled:opacity-40",
              on
                ? "border-ink bg-ink text-paper"
                : "border-line-strong bg-surface text-ink-muted hover:border-ink-faint hover:text-ink",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/** "₦" amount input that edits whole naira and reports kobo. */
export function NairaInput({
  kobo,
  onChange,
  id,
  placeholder = "0",
  autoFocus,
  className,
  large,
  "aria-label": ariaLabel,
}: {
  kobo: number | null;
  onChange: (kobo: number | null) => void;
  id?: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  large?: boolean;
  "aria-label"?: string;
}) {
  const text = kobo === null ? "" : new Intl.NumberFormat("en-NG").format(Math.round(kobo / 100));
  return (
    <div
      className={cn(
        "flex items-stretch overflow-hidden rounded-md border border-line-strong bg-surface transition-[border-color,box-shadow] focus-within:border-laterite focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--laterite)_18%,transparent)] hover:border-ink-faint",
        large ? "h-14" : "h-10",
        className,
      )}
    >
      <span className={cn("flex items-center border-r border-line bg-surface-2/60 px-3 font-mono text-ink-muted", large ? "text-[20px]" : "text-[13px]")}>
        ₦
      </span>
      <input
        id={id}
        inputMode="numeric"
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          const digits = e.target.value.replace(/[^\d]/g, "");
          onChange(digits ? Number(digits) * 100 : null);
        }}
        className={cn(
          "min-w-0 flex-1 bg-transparent px-3 font-mono text-ink outline-none",
          large ? "text-[26px] tracking-tight" : "text-[16px] sm:text-[14px]",
        )}
      />
    </div>
  );
}

export function KV({ k, v, className }: { k: React.ReactNode; v: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4 py-1.5", className)}>
      <dt className="text-[13px] text-ink-muted">{k}</dt>
      <dd className="text-right text-[13.5px] text-ink">{v}</dd>
    </div>
  );
}

export function SectionTitle({ children, aside, className }: { children: React.ReactNode; aside?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("mb-2.5 flex items-baseline justify-between gap-3", className)}>
      <h3 className="eyebrow">{children}</h3>
      {aside}
    </div>
  );
}
