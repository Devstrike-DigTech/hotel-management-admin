"use client";

import { LockKey } from "@phosphor-icons/react";
import { useEntitlements } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import { ButtonLink } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";
import { HkView } from "./hk-view";

export function HkRoute() {
  const { has, loading, requiredPlan } = useEntitlements();
  const { can, ready } = useCan();
  if (loading || !ready)
    return (
      <div className="mx-auto flex max-w-[520px] flex-col gap-3 p-4">
        <Skeleton className="h-16" />
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
    );
  if (!has("housekeeping") || !can("housekeeping.work"))
    return (
      <div className="mx-auto flex min-h-dvh max-w-[420px] flex-col items-center justify-center gap-4 px-6 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-brass-wash text-brass">
          <LockKey size={22} weight="duotone" />
        </span>
        <h1 className="display-sm text-[22px] text-ink">{!has("housekeeping") ? `Housekeeping comes with ${requiredPlan("housekeeping").name}` : "This is the housekeepers' view"}</h1>
        <p className="text-[14px] text-ink-muted">
          {!has("housekeeping") ? "Ask the owner about upgrading the plan." : "Your role doesn't clean rooms. The board shows everyone's rooms."}
        </p>
        <ButtonLink href={has("housekeeping") && can("housekeeping.view") ? "/housekeeping" : "/today"} variant="secondary">
          {has("housekeeping") && can("housekeeping.view") ? "Open the board" : "Back to Today"}
        </ButtonLink>
      </div>
    );
  return <HkView />;
}
