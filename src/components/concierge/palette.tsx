"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { CallBell, ChartBar, ListBullets, LockSimple, Plus, SlidersHorizontal, Storefront } from "@phosphor-icons/react";
import { useEntitlements } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import { useConciergeRequests } from "@/lib/api/hooks-m8";
import { STATUS } from "./catalog";
import { SealGlyph } from "./bits";

/**
 * The palette's concierge entries. Requests are found by number or room; a private request never
 * shows its service or guest here unless the viewer holds concierge.discreet (the API masks it,
 * and so does this list; hidden ones are not returned at all).
 */
export function ConciergePaletteGroups({ part, open, term, run, itemCls, groupCls }: { part: "hits" | "actions"; open: boolean; term: string; run: (fn: () => void) => void; itemCls: string; groupCls: string }) {
  const router = useRouter();
  const { can } = useCan();
  const { has } = useEntitlements();
  const on = has("concierge");
  const view = can("concierge.view");
  const t = term.trim();
  const found = useConciergeRequests({ q: t, pageSize: 5 }, part === "hits" && open && on && view && t.length >= 2);
  if (!view) return null;
  const go = (href: string) => run(() => router.push(href));
  const icon = (I: typeof CallBell) => <I size={17} weight="duotone" className="text-ink-muted group-data-[selected=true]:text-laterite" />;
  const lock = !on && <LockSimple size={12} weight="bold" className="text-brass" aria-label="on a higher plan" />;

  if (part === "hits") {
    const hits = t.length >= 2 ? (found.data?.items ?? []) : [];
    if (!hits.length) return null;
    return (
      <Command.Group heading="Concierge requests" className={groupCls}>
        {hits.map((r) => {
          // only words the viewer may read go into the item's searchable value
          const value = `concierge request ${r.number} ${r.roomNumber ?? ""} ${r.masked ? "private" : `${r.title} ${r.guestName ?? ""}`} ${t}`;
          return (
            <Command.Item key={r.id} value={value} onSelect={() => go(`/concierge/requests/${r.id}`)} className={itemCls} data-testid="palette-concierge-hit">
              {r.discreet ? <SealGlyph size={17} className="text-brass" /> : icon(CallBell)}
              <span className="min-w-0 truncate">
                <span className="font-mono">{r.number}</span> <span className="text-ink-muted">{r.masked ? "Private request" : r.title}</span>
              </span>
              <span className="ml-auto shrink-0 text-[12px] text-ink-faint">
                {r.roomNumber ? `room ${r.roomNumber} · ` : ""}
                {STATUS[r.status].label.toLowerCase()}
              </span>
            </Command.Item>
          );
        })}
      </Command.Group>
    );
  }

  return (
    <Command.Group heading="Concierge" className={groupCls}>
      <Command.Item value="concierge board requests new quote answer guest services" onSelect={() => go("/concierge")} className={itemCls}>
        {icon(CallBell)}
        <span>Concierge board</span>
        {lock}
      </Command.Item>
      {can("concierge.work") && (
        <Command.Item value="new concierge request for a guest front desk on behalf phone" onSelect={() => go("/concierge?new=1")} className={itemCls}>
          {icon(Plus)}
          <span>New concierge request</span>
          {lock}
          <span className="ml-auto text-[12px] text-ink-faint">for a guest</span>
        </Command.Item>
      )}
      {can("concierge.catalogue") && (
        <Command.Item value="add a concierge service catalogue massage chef barber car tour babysitting" onSelect={() => go("/concierge/services?new=1")} className={itemCls}>
          {icon(ListBullets)}
          <span>Add a concierge service</span>
          {lock}
        </Command.Item>
      )}
      <Command.Item value="concierge vendors spa chef car hire photographer tour operator commission" onSelect={() => go("/concierge/vendors")} className={itemCls}>
        {icon(Storefront)}
        <span>Concierge vendors</span>
        {lock}
      </Command.Item>
      {can("concierge.reports") && (
        <Command.Item value="concierge reports revenue response time ratings commission export" onSelect={() => go("/concierge/reports")} className={itemCls}>
          {icon(ChartBar)}
          <span>Concierge reports</span>
          {lock}
        </Command.Item>
      )}
      {can("concierge.settings") && (
        <Command.Item value="concierge settings answer time sla neutral bill wording redaction private visibility" onSelect={() => go("/concierge/settings")} className={itemCls}>
          {icon(SlidersHorizontal)}
          <span>Concierge settings</span>
          {lock}
        </Command.Item>
      )}
    </Command.Group>
  );
}
