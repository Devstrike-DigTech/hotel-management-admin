"use client";

import { LockSimple } from "@phosphor-icons/react";
import { useCan, type Capability, type Permission } from "@/lib/permissions";
import { useMe } from "@/lib/api/hooks";
import { roleLabel } from "@/lib/catalog";
import { permissionInfo } from "@/lib/permission-catalog";
import { ButtonLink } from "@/components/ui/button";
import { Panel, Skeleton } from "@/components/ui/primitives";

/** Shows a page only to roles with the capability; others get a plain explanation. The API enforces it regardless. */
export function RequireCap({ cap, what, children }: { cap: Capability | Permission; what: string; children: React.ReactNode }) {
  const { can, ready } = useCan();
  const me = useMe();
  if (!ready) return <Skeleton className="h-64 w-full" />;
  if (can(cap)) return <>{children}</>;
  return (
    <Panel className="mx-auto mt-10 max-w-lg px-6 py-10 text-center">
      <span className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-[color-mix(in_oklab,var(--brass)_40%,transparent)] bg-brass-wash text-brass">
        <LockSimple size={20} weight="duotone" />
      </span>
      <h1 className="display-sm mt-4 text-[22px] text-ink">{what} isn&rsquo;t part of your role</h1>
      <p className="mt-2 text-[13.5px] text-ink-muted">
        Your role{me.data ? ` (${roleLabel(me.data.user)})` : ""} doesn&rsquo;t include
        {cap.includes(".") && permissionInfo(cap).description ? <> &ldquo;{permissionInfo(cap).label.toLowerCase()}&rdquo;</> : " it"}. Ask the owner if you need access.
      </p>
      <ButtonLink href="/today" variant="secondary" className="mt-5">
        Back to Today
      </ButtonLink>
    </Panel>
  );
}
