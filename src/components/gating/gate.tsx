"use client";

import { LockKey, ArrowRight } from "@phosphor-icons/react";
import { useEntitlements } from "@/lib/auth";
import { featureName } from "@/lib/catalog";
import { usePublicFeatures } from "@/lib/api/hooks";
import { openUpgrade } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";

/**
 * Render children only when the tenant is entitled to `feature`.
 * Otherwise render `fallback`, or a compact locked card by default.
 * The server still enforces every gate; this is presentation only.
 */
export function Gate({
  feature,
  children,
  fallback,
  loading = null,
}: {
  feature: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loading?: React.ReactNode;
}) {
  const { has, loading: isLoading } = useEntitlements();
  if (isLoading) return <>{loading}</>;
  if (has(feature)) return <>{children}</>;
  return <>{fallback ?? <LockedInline feature={feature} />}</>;
}

export function LockedInline({ feature, className, text }: { feature: string; className?: string; text?: string }) {
  const { requiredPlan } = useEntitlements();
  const features = usePublicFeatures();
  const plan = requiredPlan(feature);
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-md border border-dashed border-[color-mix(in_oklab,var(--brass)_55%,transparent)] bg-brass-wash/50 p-4 sm:flex-row sm:items-center",
        className,
      )}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[color-mix(in_oklab,var(--brass)_40%,transparent)] bg-surface text-brass">
        <LockKey size={18} weight="duotone" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium text-ink">
          {featureName(feature, features.data)} is available on {plan.name}
        </p>
        <p className="text-[12.5px] text-ink-muted">{text ?? "Upgrade to unlock it for your whole team."}</p>
      </div>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => openUpgrade({ kind: "feature", feature, requiredPlan: plan.code })}
      >
        See {plan.name}
        <ArrowRight size={13} weight="bold" />
      </Button>
    </div>
  );
}
