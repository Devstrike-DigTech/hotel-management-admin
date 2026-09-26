"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, EyeSlash, SlidersHorizontal } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { conciergeApi } from "@/lib/api/endpoints-m8";
import { qk8, useConciergeSettings } from "@/lib/api/hooks-m8";
import type { ConciergeSettings } from "@/lib/api/types-m8";
import { naira, relativeTime } from "@/lib/format";
import { toast } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { AffixInput, Field, Input, Switch, Textarea } from "@/components/ui/form";
import { ErrorState, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { RequireCap } from "@/components/gating/require-cap";
import { DISCREET_HOLDERS, Masked, SealGlyph } from "./bits";
import { ConciergeTabs } from "./tabs";
import { AupAcceptedLine } from "./aup";

type Draft = Omit<ConciergeSettings, "propertyId" | "updatedAt" | "updatedBy">;
const draftOf = (s: ConciergeSettings): Draft => ({
  enabled: s.enabled,
  sla: s.sla,
  folioLabels: s.folioLabels,
  redactAfterDays: s.redactAfterDays,
  discreetVisibility: s.discreetVisibility,
  vendorSharing: s.vendorSharing,
  payments: s.payments,
  freeFormEnabled: s.freeFormEnabled,
  quoteValidityHours: s.quoteValidityHours,
  intro: s.intro,
});

export function ConciergeSettingsView() {
  return (
    <RequireCap cap="concierge.settings" what="Concierge settings">
      <Settings />
    </RequireCap>
  );
}

function Settings() {
  const q = useConciergeSettings();
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <SlidersHorizontal size={14} weight="duotone" /> Concierge
          </>
        }
        title={
          <>
            How the desk <em>behaves</em>.
          </>
        }
        description="Answer times, what the bill says for a private request, how long notes are kept, and who can see private requests."
      />
      <ConciergeTabs />
      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.data ? <Form key={q.data.updatedAt ?? "new"} initial={q.data} /> : <Skeleton className="h-[60vh]" />}
      <div className="mt-6">
        <AupAcceptedLine />
      </div>
    </>
  );
}

function Form({ initial }: { initial: ConciergeSettings }) {
  const qc = useQueryClient();
  const base = draftOf(initial);
  const [d, setD] = useState<Draft>(base);
  const set = (p: Partial<Draft>) => setD((x) => ({ ...x, ...p }));
  const dirty = JSON.stringify(d) !== JSON.stringify(base);
  const num = (v: string) => Number(v.replace(/\D/g, "")) || 0;
  const save = useMutation({
    mutationFn: () => conciergeApi.saveSettings(d),
    onSuccess: async (s) => {
      qc.setQueryData(qk8.settings, s);
      await qc.invalidateQueries({ queryKey: qk8.gates });
      toast.success("Concierge settings saved");
    },
    meta: { errorTitle: "Settings not saved" },
  });
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Panel>
          <div className="px-5 py-4">
            <Switch checked={d.enabled} onChange={(v) => set({ enabled: v })} label={<span className="text-[15px]">Concierge is on for this property</span>} description="Off: guests don't see your services and can't ask for anything new. Requests under way carry on." />
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="First answer" description="How soon a guest hears back. Late requests turn laterite on the board, and a manager is told." />
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
            <Field label="During the stay" htmlFor="sla-in">
              <AffixInput id="sla-in" suffix="min" inputMode="numeric" className="font-mono" value={d.sla.inStayMinutes} onChange={(e) => set({ sla: { ...d.sla, inStayMinutes: num(e.target.value) } })} data-testid="sla-in" />
            </Field>
            <Field label="Before arrival" htmlFor="sla-pre">
              <AffixInput id="sla-pre" suffix="min" inputMode="numeric" className="font-mono" value={d.sla.preArrivalMinutes} onChange={(e) => set({ sla: { ...d.sla, preArrivalMinutes: num(e.target.value) } })} />
            </Field>
            <Field label="Tell a manager after" htmlFor="sla-esc" hint="0 tells them the moment it's late.">
              <AffixInput id="sla-esc" suffix="min late" inputMode="numeric" className="font-mono" value={d.sla.escalateAfterMinutes} onChange={(e) => set({ sla: { ...d.sla, escalateAfterMinutes: num(e.target.value) } })} />
            </Field>
          </div>
          <SlaRuler inStay={d.sla.inStayMinutes} esc={d.sla.escalateAfterMinutes} />
        </Panel>

        <Panel>
          <PanelHeader title="On the bill" description="A private request goes on the folio, invoice and receipt with neutral wording. The real service stays in the request, for the people allowed to see it and in the guest's own data export." />
          <div className="grid gap-5 px-5 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-4">
              <Field label="In the room" htmlFor="folio-in" hint="Massage, barber, room set-up.">
                <Input id="folio-in" maxLength={60} value={d.folioLabels.inRoom} onChange={(e) => set({ folioLabels: { ...d.folioLabels, inRoom: e.target.value } })} data-testid="folio-in-room" />
              </Field>
              <Field label="Anything else" htmlFor="folio-other" hint="Car, tours, table bookings.">
                <Input id="folio-other" maxLength={60} value={d.folioLabels.other} onChange={(e) => set({ folioLabels: { ...d.folioLabels, other: e.target.value } })} />
              </Field>
            </div>
            <div className="self-start rounded-md border border-line bg-paper px-4 py-3 font-mono text-[12px] text-ink" aria-label="How the bill reads">
              <p className="mb-2 border-b border-dashed border-line-strong pb-1.5 text-[10.5px] uppercase tracking-[0.14em] text-ink-muted">Folio &middot; room 204</p>
              <p className="flex justify-between gap-2">
                <span>Room night</span>
                <span>{naira(8500000)}</span>
              </p>
              <p className="flex justify-between gap-2">
                <span>Breakfast for two</span>
                <span>{naira(1200000)}</span>
              </p>
              <p className="flex justify-between gap-2 text-laterite">
                <span className="truncate">{d.folioLabels.inRoom || "In-room service"} (CR-000118)</span>
                <span>{naira(4500000)}</span>
              </p>
              <p className="flex justify-between gap-2 text-laterite">
                <span className="truncate">{d.folioLabels.other || "Guest service"} (CR-000121)</span>
                <span>{naira(6000000)}</span>
              </p>
            </div>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Private requests" description={`Everyone who holds "See private requests" (by default ${DISCREET_HOLDERS}) sees them in full. Choose what everyone else sees.`} />
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-2" role="radiogroup" aria-label="What other staff see">
            {(
              [
                { v: "MASKED", title: "A private line", body: "The room and who has it; nothing about what, or who asked." },
                { v: "HIDDEN", title: "Nothing at all", body: "Left out of their lists and searches; Today shows a count." },
              ] as const
            ).map((o) => (
              <button key={o.v} type="button" role="radio" aria-checked={d.discreetVisibility === o.v} onClick={() => set({ discreetVisibility: o.v })} data-testid={`visibility-${o.v}`} className={cn("flex flex-col gap-2 rounded-md border p-4 text-left", d.discreetVisibility === o.v ? "border-ink ring-1 ring-ink" : "border-line-strong hover:border-ink-faint")}>
                <span className="text-[14px] font-medium text-ink">{o.title}</span>
                <span className="text-[12.5px] text-ink-muted">{o.body}</span>
                <span className="mt-1 rounded-sm border border-line bg-surface-2/50 px-3 py-2 text-[12.5px]">
                  {o.v === "MASKED" ? (
                    <span className="flex flex-wrap items-center gap-1.5 text-ink">
                      <EyeSlash size={13} className="text-ink-muted" /> Private request &middot; Room <span className="font-mono">204</span> &middot; <Masked width="6ch" />
                    </span>
                  ) : (
                    <span className="text-ink-faint">Not listed</span>
                  )}
                </span>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3 text-[12.5px] text-ink-muted">
            <SealGlyph size={14} className="text-brass" /> Every time someone opens a private request, the audit log records it.
            <Link href="/staff/roles" className="ml-auto inline-flex items-center gap-1 text-laterite hover:underline">
              Who can see them <ArrowRight size={12} />
            </Link>
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Vendors, guests and records" />
          <div className="flex flex-col gap-4 px-5 py-4">
            <Switch checked={d.vendorSharing.guestSurname} onChange={(v) => set({ vendorSharing: { ...d.vendorSharing, guestSurname: v } })} label={<span className="text-[13.5px]">Vendors may be told the guest&rsquo;s surname</span>} description="Off: job messages carry the first name only. Never the guest's phone." />
            <Switch checked={d.vendorSharing.roomNumber} onChange={(v) => set({ vendorSharing: { ...d.vendorSharing, roomNumber: v } })} label={<span className="text-[13.5px]">Vendors may be told the room number</span>} description="Off: they ask for the guest at the front desk." />
            <Switch checked={d.freeFormEnabled} onChange={(v) => set({ freeFormEnabled: v })} label={<span className="text-[13.5px]">Guests may ask for something not on the menu</span>} description="Checked like everything else; anything doubtful waits for a manager." />
            <div className="grid gap-4 sm:grid-cols-2">
              <Switch checked={d.payments.online} onChange={(v) => set({ payments: { ...d.payments, online: v } })} label={<span className="text-[13.5px]">Pay online</span>} />
              <Switch checked={d.payments.folio} onChange={(v) => set({ payments: { ...d.payments, folio: v } })} label={<span className="text-[13.5px]">Add to the bill</span>} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Quotes hold for" htmlFor="qv">
                <AffixInput id="qv" suffix="hours" inputMode="numeric" className="font-mono" value={d.quoteValidityHours} onChange={(e) => set({ quoteValidityHours: num(e.target.value) })} />
              </Field>
              <Field label="Blank out notes" htmlFor="redact" hint="Days after a request is closed. Amounts and dates stay.">
                <AffixInput id="redact" suffix="days after" inputMode="numeric" className="font-mono" value={d.redactAfterDays} onChange={(e) => set({ redactAfterDays: num(e.target.value) })} data-testid="redact-days" />
              </Field>
            </div>
            <Field label="Welcome line for guests" htmlFor="intro" optional hint="Above your services on the booking site and trip page.">
              <Textarea id="intro" className="min-h-14" maxLength={300} value={d.intro ?? ""} onChange={(e) => set({ intro: e.target.value || null })} placeholder="Anything we can arrange for your stay? Ask, and we'll take care of it." />
            </Field>
          </div>
        </Panel>
      </div>

      <aside className="lg:sticky lg:top-20 lg:self-start">
        <Panel className="p-5">
          <p className="text-[13px] text-ink-muted">{dirty ? "You have changes." : initial.updatedAt ? `Saved ${relativeTime(initial.updatedAt)}${initial.updatedBy ? ` by ${initial.updatedBy.fullName}` : ""}.` : "Defaults."}</p>
          <Button className="mt-3 w-full" disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()} data-testid="save-concierge-settings">
            Save settings
          </Button>
          {dirty && (
            <Button variant="ghost" className="mt-1 w-full" onClick={() => setD(base)}>
              Undo changes
            </Button>
          )}
        </Panel>
      </aside>
    </div>
  );
}

/** The answer window, then the grace before a manager is told, on one ruler. */
function SlaRuler({ inStay, esc }: { inStay: number; esc: number }) {
  const span = Math.max(30, Math.round((inStay + esc) * 1.6));
  const pct = (m: number) => `${Math.min(100, (m / span) * 100)}%`;
  return (
    <div className="px-5 pb-5" aria-hidden>
      <div className="relative h-2 overflow-hidden rounded-xs bg-surface-2">
        <div className="absolute inset-y-0 left-0 bg-palm/75" style={{ width: pct(inStay) }} />
        {esc > 0 && <div className="absolute inset-y-0 bg-ochre/75" style={{ left: pct(inStay), width: pct(esc) }} />}
        <div className="absolute inset-y-0 right-0 bg-laterite/65" style={{ left: pct(inStay + esc) }} />
      </div>
      <div className="relative mt-1 h-4 font-mono text-[10.5px] text-ink-faint">
        <span className="absolute left-0">0</span>
        <span className="absolute -translate-x-1/2" style={{ left: pct(inStay) }}>
          {inStay}
        </span>
        {esc > 0 && (
          <span className="absolute -translate-x-1/2" style={{ left: pct(inStay + esc) }}>
            {inStay + esc}
          </span>
        )}
        <span className="absolute right-0">{span} min</span>
      </div>
      <p className="mt-1 flex flex-wrap gap-x-4 text-[11.5px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-xs bg-palm" /> on time
        </span>
        {esc > 0 && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-xs bg-ochre" /> late
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-xs bg-laterite" /> a manager is told
        </span>
      </p>
    </div>
  );
}
