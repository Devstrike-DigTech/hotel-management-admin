"use client";

import { forwardRef, useId, useState } from "react";
import { CaretDown, Eye, EyeSlash, LockSimple } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

const control =
  "w-full rounded-md border border-line-strong bg-surface px-3 text-[14px] text-ink transition-[border-color,box-shadow] duration-150 outline-none hover:border-ink-faint focus:border-laterite focus:shadow-[0_0_0_3px_color-mix(in_oklab,var(--laterite)_18%,transparent)] disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger";

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(control, "h-10", className)} {...rest} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...rest }, ref) {
    return <textarea ref={ref} className={cn(control, "min-h-24 py-2.5 leading-relaxed", className)} {...rest} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...rest }, ref) {
    return (
      <div className="relative">
        <select ref={ref} className={cn(control, "h-10 appearance-none pr-9", className)} {...rest}>
          {children}
        </select>
        <CaretDown
          size={14}
          weight="bold"
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-muted"
        />
      </div>
    );
  },
);

/** Prefixed input, e.g. ₦ for money or a domain suffix. */
export const AffixInput = forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { prefix?: React.ReactNode; suffix?: React.ReactNode }
>(function AffixInput({ prefix, suffix, className, ...rest }, ref) {
  return (
    <div
      className={cn(
        "flex h-10 items-stretch overflow-hidden rounded-md border border-line-strong bg-surface transition-[border-color,box-shadow] focus-within:border-laterite focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--laterite)_18%,transparent)] hover:border-ink-faint",
        rest.disabled && "opacity-60",
        className,
      )}
    >
      {prefix && (
        <span className="flex items-center border-r border-line bg-surface-2/60 px-3 font-mono text-[13px] text-ink-muted">
          {prefix}
        </span>
      )}
      <input ref={ref} className="min-w-0 flex-1 bg-transparent px-3 text-[14px] outline-none disabled:cursor-not-allowed" {...rest} />
      {suffix && (
        <span className="flex items-center border-l border-line bg-surface-2/60 px-3 font-mono text-[12px] text-ink-muted">
          {suffix}
        </span>
      )}
    </div>
  );
});

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
  locked,
  optional,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  error?: string | null;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
  locked?: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="flex items-center gap-2 text-[13px] font-medium text-ink">
        {label}
        {optional && <span className="font-normal text-ink-faint">optional</span>}
        {locked && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-brass-wash px-2 py-0.5 text-[11px] font-medium text-brass">
            <LockSimple size={11} weight="bold" />
            {locked}
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-[12.5px] text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[12.5px] leading-snug text-ink-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled,
  id,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
}) {
  const auto = useId();
  const sid = id ?? auto;
  const toggle = (
    <button
      id={sid}
      aria-label={ariaLabel}
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-[22px] w-[38px] shrink-0 items-center rounded-full border transition-colors duration-200 disabled:opacity-50",
        checked ? "border-laterite bg-laterite" : "border-line-strong bg-surface-2",
      )}
    >
      <span
        className={cn(
          "inline-block h-4 w-4 rounded-full shadow-sm transition-transform duration-200 ease-out",
          checked ? "translate-x-[18px] bg-laterite-ink" : "translate-x-[2px] bg-surface",
        )}
      />
    </button>
  );
  if (!label) return toggle;
  return (
    <div className="flex items-start justify-between gap-6">
      <label htmlFor={sid} className="flex flex-col gap-0.5">
        <span className="text-[14px] font-medium text-ink">{label}</span>
        {description && <span className="text-[13px] leading-snug text-ink-muted">{description}</span>}
      </label>
      {toggle}
    </div>
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cn("group flex cursor-pointer items-center gap-2.5 text-[13.5px]", disabled && "opacity-50")}>
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className="grid h-4 w-4 place-items-center rounded-xs border border-line-strong bg-surface transition-colors peer-checked:border-laterite peer-checked:bg-laterite peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-laterite"
      >
        <svg viewBox="0 0 12 12" className={cn("h-2.5 w-2.5 text-laterite-ink", checked ? "opacity-100" : "opacity-0")}>
          <path d="M2 6.5 4.8 9 10 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="text-ink">{label}</span>
    </label>
  );
}

export const PasswordInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function PasswordInput({ className, ...rest }, ref) {
    const [show, setShow] = useState(false);
    return (
      <div className="relative">
        <input ref={ref} type={show ? "text" : "password"} className={cn(control, "h-10 pr-11", className)} {...rest} />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          aria-pressed={show}
          className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
        >
          {show ? <EyeSlash size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  },
);
