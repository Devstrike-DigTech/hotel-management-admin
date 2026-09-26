"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CallBell, Power, Prohibit, ShieldCheck, WarningOctagon } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useMe } from "@/lib/api/hooks";
import { conciergeApi } from "@/lib/api/endpoints-m8";
import { qk8, useAup, useConciergeAccess, useConciergeGates } from "@/lib/api/hooks-m8";
import type { AupState, ConciergeGates } from "@/lib/api/types-m8";
import { formatDate, formatDateTime, lagosLongDate } from "@/lib/format";
import { toast } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/form";
import { ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { AdireGlyph } from "@/components/motifs/adire";
import { AUP_FALLBACK } from "./catalog";

/** The policy text: paragraphs, and "- " lines as a list of what is not allowed. */
export function PolicyText({ text, className }: { text: string; className?: string }) {
  const blocks = text.trim().split(/\n\s*\n/);
  return (
    <div className={cn("flex flex-col gap-3.5", className)}>
      {blocks.map((b, i) => {
        const lines = b.split("\n");
        const list = lines.filter((l) => /^\s*[-*]\s+/.test(l));
        if (list.length) {
          const lead = lines.filter((l) => !/^\s*[-*]\s+/.test(l)).join(" ");
          return (
            <div key={i}>
              {lead && <p className="mb-2">{lead}</p>}
              <ul className="flex flex-col gap-1.5">
                {list.map((l, j) => (
                  <li key={j} className="grid grid-cols-[22px_minmax(0,1fr)] gap-1">
                    <Prohibit size={15} className="mt-[4px] text-laterite" aria-hidden />
                    <span>{l.replace(/^\s*[-*]\s+/, "")}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        }
        if (/^#+\s/.test(b)) return <h3 key={i} className="display-sm pt-1 text-[18px] text-ink">{b.replace(/^#+\s/, "")}</h3>;
        return <p key={i}>{b}</p>;
      })}
    </div>
  );
}

/**
 * Concierge stays closed until the hotel has accepted the acceptable-use policy (once, timestamped),
 * says so plainly while the platform has it suspended, and offers to switch it on when it is off.
 */
export function AupGate({ children }: { children: React.ReactNode }) {
  const access = useConciergeAccess();
  const gates = useConciergeGates(access.ready);
  if (!access.ready || gates.isLoading) return <Skeleton className="h-96" />;
  if (gates.isError) return <ErrorState error={gates.error} onRetry={() => gates.refetch()} />;
  const g = gates.data!;
  if (g.suspended) return <Suspended g={g} />;
  if (!g.aup.accepted) return <AcceptPolicy />;
  return (
    <>
      {!g.enabled && <SwitchedOff />}
      {children}
    </>
  );
}

function Suspended({ g }: { g: ConciergeGates }) {
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <CallBell size={14} weight="duotone" /> Concierge
          </>
        }
        title={
          <>
            Concierge is <em>paused</em>.
          </>
        }
      />
      <Panel className="max-w-2xl border-[color-mix(in_oklab,var(--danger)_35%,transparent)]" data-testid="concierge-suspended">
        <div className="flex gap-4 p-6">
          <WarningOctagon size={28} weight="duotone" className="shrink-0 text-danger" />
          <div className="flex flex-col gap-2 text-[14px] leading-relaxed text-ink">
            <p className="font-medium">Our trust team switched concierge off for this hotel on {formatDate(g.suspended!.since)}.</p>
            <p className="rounded-sm bg-surface-2 px-3 py-2 text-ink-muted">&ldquo;{g.suspended!.reason}&rdquo;</p>
            <p className="text-ink-muted">Guests can&rsquo;t see your services or ask for anything new. Requests already under way can still be finished or cancelled. If you think this is a mistake, write to us from Support.</p>
          </div>
        </div>
      </Panel>
    </>
  );
}

function SwitchedOff() {
  const access = useConciergeAccess();
  const qc = useQueryClient();
  const on = useMutation({
    mutationFn: () => conciergeApi.saveSettings({ enabled: true }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk8.all });
      toast.success("Concierge is on", "Guests can see your live services.");
    },
    meta: { errorTitle: "Not switched on" },
  });
  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-md border border-line-strong bg-surface-2/60 px-4 py-3 text-[13px] text-ink" data-testid="concierge-off">
      <Power size={16} className="text-ink-muted" />
      <span className="flex-1">Concierge is switched off for this property. Guests don&rsquo;t see your services until it&rsquo;s on.</span>
      {access.settings && (
        <Button size="sm" onClick={() => on.mutate()} loading={on.isPending} data-testid="switch-on">
          Switch on
        </Button>
      )}
    </div>
  );
}

export function AcceptPolicy() {
  const qc = useQueryClient();
  const me = useMe();
  const access = useConciergeAccess();
  const aup = useAup();
  const [ok, setOk] = useState(false);
  const accept = useMutation({
    mutationFn: async (a: AupState) => {
      const x = await conciergeApi.acceptAup(a.version);
      await conciergeApi.saveSettings({ enabled: true }).catch(() => null);
      return x;
    },
    onSuccess: async (x) => {
      qc.setQueryData(qk8.aup, x);
      await qc.invalidateQueries({ queryKey: qk8.all });
      toast.success("Policy accepted", "Concierge is open. Start with your services.");
    },
    meta: { errorTitle: "Not accepted" },
  });
  if (aup.isError) return <ErrorState error={aup.error} onRetry={() => aup.refetch()} />;
  if (!aup.data) return <Skeleton className="h-96" />;
  const a = aup.data;
  const name = me.data?.user.fullName ?? "";
  const hotel = me.data?.tenant.name ?? "the hotel";
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <CallBell size={14} weight="duotone" /> Concierge
          </>
        }
        title={
          <>
            Before you begin, <em>the house rules</em>.
          </>
        }
        description="Concierge is for lawful services only. Read the policy once and accept it for the hotel; from then on, every new or changed service is checked against it."
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel as="article" className="relative overflow-hidden" data-testid="aup">
          <AdireGlyph kind="rings" size={120} className="pointer-events-none absolute -right-6 -top-6 text-line opacity-60" />
          <div className="relative border-b border-line px-6 py-5 sm:px-10">
            <p className="eyebrow">
              Acceptable use &middot; version <span className="font-mono normal-case tracking-normal">{a.version}</span>
            </p>
            <h2 className="display-sm mt-1.5 text-[24px] text-ink">{a.title || "Concierge acceptable-use policy"}</h2>
          </div>
          <PolicyText text={a.text || AUP_FALLBACK} className="relative max-h-[52vh] overflow-y-auto px-6 py-6 font-display text-[15.5px] leading-[1.65] text-ink sm:px-10" />
          <div className="relative border-t border-line bg-surface-2/40 px-6 py-5 sm:px-10">
            {access.settings ? (
              <div className="flex flex-col gap-4">
                <Checkbox checked={ok} onChange={setOk} label={<span data-testid="aup-check">I&rsquo;ve read this, and {hotel} will only offer and arrange services that follow it.</span>} />
                <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
                  <div className="min-w-[200px] flex-1">
                    <p className={cn("display-sm border-b border-ink-faint pb-1 text-[22px] italic transition-colors", ok ? "text-ink" : "text-transparent")} aria-hidden>
                      {name || " "}
                    </p>
                    <p className="mt-1 text-[11.5px] text-ink-muted">Accepted for the hotel by</p>
                  </div>
                  <div>
                    <p className="border-b border-ink-faint pb-1 font-mono text-[14px] text-ink">{lagosLongDate()}</p>
                    <p className="mt-1 text-[11.5px] text-ink-muted">Date</p>
                  </div>
                  <Button onClick={() => accept.mutate(a)} disabled={!ok} loading={accept.isPending} data-testid="accept-aup">
                    <ShieldCheck size={15} /> Accept and open concierge
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-[13.5px] text-ink-muted">An owner or manager accepts this for the hotel before concierge opens.</p>
            )}
          </div>
        </Panel>
        <aside className="flex flex-col gap-4 text-[13px] leading-relaxed text-ink-muted">
          {a.summary.length > 0 && (
            <Panel className="p-5">
              <p className="eyebrow mb-2">In short</p>
              <ul className="flex flex-col gap-1.5">
                {a.summary.map((s) => (
                  <li key={s} className="text-ink">
                    {s}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel className="p-5">
            <p className="eyebrow mb-2">How the check works</p>
            <p>A service&rsquo;s name, description, options and questions are read when you save. If a word may break the policy, the service waits for our trust team and is hidden from guests until then. Most services go live the moment you save.</p>
          </Panel>
          <Panel className="p-5">
            <p className="eyebrow mb-2">Guests&rsquo; own words</p>
            <p>Requests in a guest&rsquo;s own words are checked the same way. One that may break the policy is never priced or sent to a vendor; a manager decides, and the guest is told you&rsquo;ll get back to them.</p>
          </Panel>
        </aside>
      </div>
    </>
  );
}

export function AupAcceptedLine() {
  const gates = useConciergeGates();
  const g = gates.data;
  if (!g?.aup.accepted || !g.aup.acceptedAt) return null;
  return (
    <p className="flex items-center gap-1.5 text-[12px] text-ink-muted" data-testid="aup-accepted">
      <ShieldCheck size={13} className="text-palm" /> Acceptable-use policy {g.aup.version} accepted by {g.aup.acceptedBy?.fullName ?? "the hotel"} on <span className="font-mono">{formatDateTime(g.aup.acceptedAt)}</span>.
    </p>
  );
}
