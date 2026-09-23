"use client";

import { LockSimple } from "@phosphor-icons/react";
import { useCan, type Capability } from "@/lib/permissions";
import { ROLES } from "@/lib/catalog";
import { ButtonLink } from "@/components/ui/button";
import { Panel, Skeleton } from "@/components/ui/primitives";

/** Shows a page only to roles with the capability; others get a plain explanation. The API enforces it regardless. */
export function RequireCap({ cap, what, children }: { cap: Capability; what: string; children: React.ReactNode }) {
  const { can, role, ready } = useCan();
  if (!ready) return <Skeleton className="h-64 w-full" />;
  if (can(cap)) return <>{children}</>;
  return (
    <Panel className="mx-auto mt-10 max-w-lg px-6 py-10 text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-[color-mix(in_oklab,var(--brass)_40%,transparent)] bg-brass-wash text-brass">
        <LockSimple size={20} weight="duotone" />
      </span>
      <h1 className="display-sm mt-4 text-[22px] text-ink">{what} is for owners and managers</h1>
      <p className="mt-2 text-[13.5px] text-ink-muted">
        Your role{role ? ` (${ROLES[role]?.label ?? role})` : ""} doesn&rsquo;t include it. Ask the owner if you need access.
      </p>
      <ButtonLink href="/today" variant="secondary" className="mt-5">
        Back to Today
      </ButtonLink>
    </Panel>
  );
}
