"use client";

import { forwardRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "ink" | "link";
type Size = "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-[background-color,border-color,color,transform,box-shadow] duration-150 ease-out disabled:pointer-events-none disabled:opacity-50 active:translate-y-px";

const variants: Record<Variant, string> = {
  primary:
    "bg-laterite text-laterite-ink hover:bg-laterite-hover shadow-[inset_0_-1px_0_rgb(0_0_0/0.18),inset_0_1px_0_rgb(255_255_255/0.12)]",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-surface-2 hover:border-ink-faint",
  ghost: "text-ink-muted hover:text-ink hover:bg-surface-2",
  danger: "bg-danger text-paper hover:opacity-90",
  ink: "bg-ink text-paper hover:opacity-90",
  link: "text-laterite underline-offset-4 hover:underline px-0! h-auto!",
};

const sizes: Record<Size, string> = {
  sm: "h-8 rounded-sm px-3 text-[13px]",
  md: "h-9 rounded-md px-3.5 text-sm",
  lg: "h-11 rounded-md px-5 text-[15px]",
  icon: "h-9 w-9 rounded-md",
  "icon-sm": "h-7 w-7 rounded-sm",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, className, children, disabled, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, variants[variant], sizes[size], className)}
      {...rest}
    >
      {loading && <Spinner className="absolute" />}
      <span className={cn("inline-flex items-center gap-2", loading && "invisible")}>{children}</span>
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: { href: string; variant?: Variant; size?: Size } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const external = /^https?:/.test(href);
  const cls = cn(base, variants[variant], sizes[size], className);
  if (external)
    return (
      <a href={href} className={cls} {...rest}>
        {children}
      </a>
    );
  return (
    <Link href={href} className={cls} {...rest}>
      {children}
    </Link>
  );
}

export function Spinner({ className, size = 14 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
      className={cn("animate-spin [animation-duration:900ms]", className)}
    >
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.25" strokeWidth="1.5" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
