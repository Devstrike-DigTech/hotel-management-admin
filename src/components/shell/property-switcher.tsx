"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { useQueryClient } from "@tanstack/react-query";
import { Buildings, CaretUpDown, Check, ChartBar, LockSimple, Plus } from "@phosphor-icons/react";
import { useEntitlements } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import { onPropertyDenied, setPropertyId, usePropertyId } from "@/lib/property";
import { useMyProperties } from "@/lib/api/hooks-m5";
import { propertiesApi } from "@/lib/api/endpoints-m5";
import { clearPersistedQueries } from "@/lib/offline/persist";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { PlanPlate, Skeleton } from "@/components/ui/primitives";
import { TrialPill } from "./trial-pill";

/** Switch the whole admin to another property: every query refetches under the new X-Property-Id. */
export function useSwitchProperty() {
  const qc = useQueryClient();
  return (id: string | null, name?: string) => {
    setPropertyId(id);
    // remember it as the default for sessions that send no header (and other devices)
    if (id) void propertiesApi.setCurrent(id).catch(() => undefined);
    void clearPersistedQueries();
    // drop everything scoped to the old house, keep who we are and the plans
    qc.removeQueries({ predicate: (q) => !["me", "public", "properties"].includes(String(q.queryKey[0])) });
    void qc.invalidateQueries({ queryKey: ["me"] });
    void qc.refetchQueries({ type: "active" });
    if (name) toast.info(`Now working in ${name}`);
  };
}

/**
 * The shell's property scope. Keeps the stored property valid (falls back to the
 * user's default when it disappears or access is withdrawn) and exposes the list.
 */
export function usePropertyScope() {
  const list = useMyProperties();
  const pid = usePropertyId();
  const props = list.data?.items ?? [];
  const current = props.find((p) => p.id === pid) ?? props.find((p) => p.id === list.data?.defaultPropertyId) ?? props[0] ?? null;
  return { list, props, current, pid };
}

/** Mount once in the shell: repairs an invalid selection and reacts to 403s on a property. */
export function PropertyScopeRuntime() {
  const { list, props, current, pid } = usePropertyScope();
  const switchTo = useSwitchProperty();
  const warned = useRef(false);
  useEffect(() => {
    if (!list.data) return;
    // stored id missing or no longer accessible: adopt the default quietly
    if (current && current.id !== pid) setPropertyId(current.id);
  }, [list.data, current, pid]);
  useEffect(
    () =>
      onPropertyDenied(({ message }) => {
        const fallback = props.find((p) => p.id !== pid) ?? null;
        if (warned.current) return;
        warned.current = true;
        window.setTimeout(() => (warned.current = false), 4000);
        toast.error("You don't have access to that property", message || "Switched you back to one you can work in.");
        switchTo(fallback?.id ?? null);
        void list.refetch();
      }),
    [props, pid, switchTo, list],
  );
  return null;
}

export function PropertySwitcher({ onNavigate }: { onNavigate?: () => void }) {
  const { me, loading, has } = useEntitlements();
  const { can } = useCan();
  const { props, current, list } = usePropertyScope();
  const switchTo = useSwitchProperty();
  const multi = has("multi_property");
  const group = me?.tenant.name ?? "";
  if (loading || !me)
    return (
      <div className="mx-3 mb-3 space-y-2 rounded-md border border-line bg-paper/70 px-3 py-3">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-4 w-24" />
      </div>
    );
  const name = current?.name ?? group;
  const sameName = !!current && current.name === group;
  const eyebrow = props.length > 1 ? (sameName ? `Group of ${props.length}` : group) : current && !sameName ? group : null;
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button
          className="group mx-3 mb-3 flex w-[calc(100%-24px)] items-start gap-2 rounded-md border border-line bg-paper/70 px-3 py-3 text-left transition-colors hover:border-line-strong data-[state=open]:border-line-strong"
          aria-label={`Property: ${name}. Switch property`}
          data-testid="property-switcher"
        >
          <span className="min-w-0 flex-1">
            {eyebrow && <span className="eyebrow block truncate text-[9.5px] text-ink-faint">{eyebrow}</span>}
            <span className="display-sm block truncate text-[15.5px] leading-tight text-ink" title={name}>
              {name}
            </span>
            <span className="mt-2 flex flex-wrap items-center gap-1.5">
              <PlanPlate name={me.subscription.planName} code={me.subscription.planCode} />
              <TrialPill sub={me.subscription} className="h-5 pl-1 pr-2 text-[11px]" />
              {props.length > 1 && !sameName && (
                <span className="font-mono text-[10.5px] text-ink-faint">
                  {props.findIndex((p) => p.id === current?.id) + 1} of {props.length}
                </span>
              )}
            </span>
          </span>
          <CaretUpDown size={14} className="mt-1 shrink-0 text-ink-faint group-hover:text-ink-muted" />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="start" sideOffset={6} className="z-50 w-[280px] rounded-md border border-line bg-surface p-1.5 shadow-float animate-[rise_160ms_ease-out]">
          <p className="eyebrow px-2.5 pb-1.5 pt-1 text-[10px]">{group}</p>
          {list.isLoading && <Skeleton className="mx-2 my-2 h-10" />}
          {props.map((p) => {
            const on = p.id === current?.id;
            return (
              <Menu.Item
                key={p.id}
                onSelect={() => {
                  if (!on) switchTo(p.id, p.name);
                  onNavigate?.();
                }}
                className={cn("flex cursor-pointer items-center gap-2.5 rounded-sm px-2.5 py-2 outline-none data-[highlighted]:bg-surface-2", on && "bg-surface-2/60")}
                data-testid={`property-option-${p.slug}`}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-line bg-paper font-mono text-[11px] text-ink-muted">{p.invoicePrefix ?? p.name.slice(0, 2).toUpperCase()}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-medium text-ink">{p.name}</span>
                  <span className="block truncate text-[11.5px] text-ink-muted">
                    {[p.area, p.city].filter(Boolean).join(", ")}
                    {p.roomCount != null ? ` · ${p.roomCount} rooms` : ""}
                  </span>
                </span>
                {on && <Check size={15} weight="bold" className="text-laterite" />}
              </Menu.Item>
            );
          })}
          <Menu.Separator className="my-1 h-px bg-line" />
          {multi && props.length > 1 && can("reports.read") && (
            <Menu.Item asChild>
              <Link href="/group" onClick={onNavigate} className="flex h-9 items-center gap-2.5 rounded-sm px-2.5 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2">
                <ChartBar size={16} weight="duotone" /> All properties
                <span className="ml-auto text-[11px] text-ink-faint">group reports</span>
              </Link>
            </Menu.Item>
          )}
          {can("settings.manage") && (
            <Menu.Item asChild>
              <Link href="/properties" onClick={onNavigate} className="flex h-9 items-center gap-2.5 rounded-sm px-2.5 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2">
                {multi ? <Buildings size={16} weight="duotone" /> : <Plus size={16} />}
                {multi ? "Manage properties" : "Add a property"}
                {!multi && <LockSimple size={12} weight="bold" className="ml-auto text-brass" />}
              </Link>
            </Menu.Item>
          )}
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
