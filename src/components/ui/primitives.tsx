"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { ArrowClockwise, WarningOctagon } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/catalog";
import { AdireGlyph } from "@/components/motifs/adire";
import { Button } from "./button";
import { errorMessage } from "@/lib/api/client";

/* ---------- Badge / chip ---------- */
const toneCls: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-muted border-line",
  laterite: "bg-laterite-wash text-laterite border-[color-mix(in_oklab,var(--laterite)_25%,transparent)]",
  brass: "bg-brass-wash text-brass border-[color-mix(in_oklab,var(--brass)_30%,transparent)]",
  palm: "bg-palm-wash text-palm border-[color-mix(in_oklab,var(--palm)_25%,transparent)]",
  adire: "bg-adire-wash text-adire border-[color-mix(in_oklab,var(--adire)_25%,transparent)]",
  ochre: "bg-ochre-wash text-ochre border-[color-mix(in_oklab,var(--ochre)_30%,transparent)]",
  danger: "bg-danger-wash text-danger border-[color-mix(in_oklab,var(--danger)_25%,transparent)]",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  dot,
  icon,
}: {
  tone?: Tone;
  children: React.ReactNode;
  className?: string;
  dot?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-1.5 rounded-full border px-2 text-[11.5px] font-medium leading-none whitespace-nowrap",
        toneCls[tone],
        className,
      )}
    >
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
      {icon}
      {children}
    </span>
  );
}

/** Rectangular engraved plate used for plan names. */
export function PlanPlate({ name, code, className }: { name: string; code?: string; className?: string }) {
  const color =
    code === "enterprise"
      ? "var(--brass)"
      : code === "pro"
        ? "var(--adire)"
        : code === "growth"
          ? "var(--laterite)"
          : "var(--palm)";
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-xs border px-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em]",
        className,
      )}
      style={{
        color,
        borderColor: `color-mix(in oklab, ${color} 45%, transparent)`,
        background: `color-mix(in oklab, ${color} 9%, transparent)`,
      }}
    >
      {name}
    </span>
  );
}

/* ---------- Panel ---------- */
export function Panel({
  children,
  className,
  as: As = "section",
  ...rest
}: { children: React.ReactNode; className?: string; as?: "section" | "div" | "article" | "aside" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <As className={cn("rounded-lg border border-line bg-surface", className)} {...rest}>
      {children}
    </As>
  );
}

export function PanelHeader({
  eyebrow,
  title,
  actions,
  className,
  description,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  description?: React.ReactNode;
}) {
  return (
    <header className={cn("flex items-start justify-between gap-4 border-b border-line px-5 py-4", className)}>
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        <h2 className="display-sm text-[19px] leading-tight text-ink">{title}</h2>
        {description && <p className="mt-1 text-[13px] text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

/* ---------- Page header ---------- */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-7 flex flex-col gap-4 md:mb-9 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0 max-w-2xl">
        {eyebrow && <p className="eyebrow mb-3 flex items-center gap-2">{eyebrow}</p>}
        <h1 className="display text-[34px] leading-[1.02] text-ink md:text-[44px]">{title}</h1>
        {description && <div className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-ink-muted">{description}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/* ---------- Skeleton ---------- */
export function Skeleton({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return <div aria-hidden className={cn("shimmer rounded-sm", className)} style={style} />;
}

/* ---------- Empty + error states ---------- */
export function EmptyState({
  title,
  body,
  action,
  glyph = "rings",
  className,
  compact,
}: {
  title: React.ReactNode;
  body?: React.ReactNode;
  action?: React.ReactNode;
  glyph?: Parameters<typeof AdireGlyph>[0]["kind"];
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 px-6 py-8" : "gap-3 px-6 py-14",
        className,
      )}
    >
      <div className="relative mb-1 grid place-items-center">
        <span className="absolute h-16 w-16 rounded-full bg-laterite-wash opacity-60" />
        <AdireGlyph kind={glyph} size={compact ? 40 : 52} className="relative text-laterite" />
      </div>
      <h3 className="display-sm text-[18px] text-ink">{title}</h3>
      {body && <p className="max-w-sm text-[13.5px] leading-relaxed text-ink-muted">{body}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  title = "This didn't load",
  className,
}: {
  error?: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
}) {
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 px-6 py-12 text-center", className)}>
      <span className="grid h-11 w-11 place-items-center rounded-full border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-wash text-danger">
        <WarningOctagon size={22} weight="duotone" />
      </span>
      <h3 className="display-sm text-[18px] text-ink">{title}</h3>
      {error !== undefined && <p className="max-w-sm text-[13.5px] text-ink-muted">{errorMessage(error)}</p>}
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry} className="mt-1">
          <ArrowClockwise size={14} weight="bold" />
          Try again
        </Button>
      )}
    </div>
  );
}

/* ---------- Segmented control ---------- */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = "md",
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[];
  label: string;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex items-center rounded-md border border-line bg-surface-2/70 p-0.5", className)}
      onKeyDown={(e) => {
        const idx = options.findIndex((o) => o.value === value);
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          onChange(options[(idx + 1) % options.length].value);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          onChange(options[(idx - 1 + options.length) % options.length].value);
        }
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-sm font-medium transition-colors duration-150",
              size === "sm" ? "h-7 px-2.5 text-[12.5px]" : "h-8 px-3 text-[13px]",
              active
                ? "bg-surface text-ink shadow-[0_1px_0_var(--line-strong),0_0_0_1px_var(--line)]"
                : "text-ink-muted hover:text-ink",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Usage meter ---------- */
export function Meter({
  label,
  used,
  max,
  className,
}: {
  label: string;
  used: number;
  max: number | undefined;
  className?: string;
}) {
  const unlimited = max === undefined || max < 0;
  const ratio = unlimited ? 0 : Math.min(1, used / Math.max(1, max));
  const tone = unlimited
    ? "var(--palm)"
    : used > max
      ? "var(--danger)"
      : ratio >= 0.85 && max > 1
        ? "var(--ochre)"
        : "var(--ink)";
  const ticks = unlimited || max > 30 ? 0 : max;
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-ink-muted">{label}</span>
        <span className="font-mono text-[13px] text-ink">
          {used}
          <span className="text-ink-faint"> / {unlimited ? "unlimited" : max}</span>
        </span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={unlimited ? undefined : max}
        aria-valuenow={used}
        className="relative h-1.5 overflow-hidden rounded-xs bg-surface-2"
      >
        <div
          className="absolute inset-y-0 left-0 rounded-xs transition-[width] duration-500 ease-out"
          style={{ width: unlimited ? "100%" : `${ratio * 100}%`, background: tone, opacity: unlimited ? 0.25 : 0.85 }}
        />
        {ticks > 1 && (
          <div className="absolute inset-0 flex" aria-hidden>
            {Array.from({ length: ticks }, (_, i) => (
              <span key={i} className="flex-1 border-r border-surface last:border-r-0" />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ---------- Tooltip ---------- */
export function Tip({
  content,
  children,
  side = "top",
  delay = 250,
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  delay?: number;
}) {
  return (
    <TooltipPrimitive.Root delayDuration={delay}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className="z-[60] max-w-xs rounded-sm bg-ink px-2 py-1 text-[12px] text-paper shadow-float animate-[fade_120ms_ease-out]"
        >
          {content}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/* ---------- Stat ---------- */
export function Stat({
  label,
  value,
  sub,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <span className="display-sm text-[14px] italic text-ink-muted">{label}</span>
      <span className="font-mono text-[30px] font-normal leading-none tracking-tight text-ink md:text-[34px]">
        {value}
      </span>
      {sub && <span className="text-[12.5px] text-ink-muted">{sub}</span>}
    </div>
  );
}
