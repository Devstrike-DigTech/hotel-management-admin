"use client";

import Link from "next/link";
import { WarningCircle } from "@phosphor-icons/react";
import type { Subscription } from "@/lib/api/types";
import { daysUntil } from "@/lib/format";
import { cn } from "@/lib/cn";

const TRIAL_DAYS = 14;

/** Countdown pill for trials; warning pill for past-due / read-only. */
export function TrialPill({ sub, className }: { sub: Subscription | undefined; className?: string }) {
  if (!sub) return null;
  if (sub.status === "TRIALING") {
    const left = daysUntil(sub.trialEndsAt) ?? 0;
    const frac = Math.max(0, Math.min(1, left / TRIAL_DAYS));
    const r = 6;
    const c = 2 * Math.PI * r;
    const urgent = left <= 3;
    return (
      <Link
        href="/billing"
        className={cn(
          "group inline-flex h-7 items-center gap-2 rounded-full border pl-1.5 pr-3 text-[12px] font-medium transition-colors",
          urgent
            ? "border-[color-mix(in_oklab,var(--laterite)_40%,transparent)] bg-laterite-wash text-laterite"
            : "border-[color-mix(in_oklab,var(--brass)_40%,transparent)] bg-brass-wash text-brass hover:border-brass",
          className,
        )}
        aria-label={`Trial: ${left} ${left === 1 ? "day" : "days"} left. Open billing.`}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden className="-rotate-90">
          <circle cx="8" cy="8" r={r} fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2" />
          <circle
            cx="8"
            cy="8"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - frac)}
          />
        </svg>
        <span>
          <span className="font-mono">{left}</span> {left === 1 ? "day" : "days"} of trial
        </span>
      </Link>
    );
  }
  if (sub.status === "PAST_DUE" || sub.status === "READ_ONLY" || sub.status === "SUSPENDED") {
    return (
      <Link
        href="/billing"
        className={cn(
          "inline-flex h-7 items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-danger-wash px-2.5 text-[12px] font-medium text-danger",
          className,
        )}
      >
        <WarningCircle size={14} weight="duotone" />
        {sub.status === "PAST_DUE" ? "Payment due" : sub.status === "READ_ONLY" ? "Read-only" : "Suspended"}
      </Link>
    );
  }
  return null;
}
