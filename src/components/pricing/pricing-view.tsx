"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowCounterClockwise,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  CalendarDots,
  ChartLineUp,
  Check,
  Lightning,
  Moon,
  Play,
  Plus,
  Robot,
  Snowflake,
  Trash,
  X,
} from "@phosphor-icons/react";
import { useCan } from "@/lib/permissions";
import { useRoomTypes } from "@/lib/api/hooks";
import { pricingApi } from "@/lib/api/endpoints-m5";
import { qk5, useCompetitors, useFrozenDates, useGuardrails, usePriceChanges, usePricingEvents, usePricingReport, usePricingSettings, useSuggestions } from "@/lib/api/hooks-m5";
import type { EventImpact, Guardrail, PricingEvent, PricingMode, Suggestion } from "@/lib/api/types-m5";
import { addDays, dayRange, formatDay, monthName, todayKey, weekday } from "@/lib/dates";
import { formatDateTime, naira, nairaCompact, number, percent } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { Field, Input, Select, Switch } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, PanelHeader, Segmented, Skeleton } from "@/components/ui/primitives";
import { NairaInput, ChipRadio } from "@/components/m2/bits";
import { FACTOR_LABEL, usePricingRefresh } from "./overlay";

type Tab = "suggestions" | "settings" | "events" | "history" | "earned";
const pct = (bps: number) => `${bps > 0 ? "+" : bps < 0 ? "−" : ""}${Math.abs(bps / 100).toFixed(bps % 100 ? 1 : 0)}%`;

export function PricingView() {
  const sp = useSearchParams();
  const router = useRouter();
  const tab = (sp.get("tab") as Tab) ?? "suggestions";
  const setTab = (t: Tab) => router.replace(t === "suggestions" ? "/dynamic-pricing" : `/dynamic-pricing?tab=${t}`, { scroll: false });
  const settings = usePricingSettings();
  const { can } = useCan();
  const refresh = usePricingRefresh();
  const run = useMutation({
    mutationFn: () => pricingApi.run({}),
    onSuccess: async (r) => {
      await refresh();
      toast.success(r.applied ? `${r.applied} prices applied by autopilot` : `${r.generated} suggestions ready`, r.skipped ? `${r.skipped} nights left alone (frozen, fixed by hand or too small a change).` : undefined);
    },
    meta: { errorTitle: "The run failed" },
  });
  const mode = settings.data?.mode;
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <ChartLineUp size={14} weight="duotone" /> Dynamic pricing
          </>
        }
        title={
          <>
            Rates that <em>read the room</em>.
          </>
        }
        description="Each night, every room type gets a suggested price from how full the house is, how fast it is filling against the usual pace, the day, the events in town and what the neighbours charge. Nothing moves outside the limits you set."
        actions={
          <>
            <Link href="/rates" className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink">
              <CalendarDots size={15} /> On the Almanac
            </Link>
            {can("pricing.manage") && (
              <Button variant="secondary" onClick={() => run.mutate()} loading={run.isPending}>
                <Play size={14} weight="fill" /> Run now
              </Button>
            )}
          </>
        }
      />
      {settings.data && (
        <div className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-md border border-line bg-surface px-4 py-2.5 text-[12.5px] text-ink-muted">
          <span className="inline-flex items-center gap-2">
            <ModeDot mode={settings.data.mode} />
            <span className="font-medium text-ink">{mode === "AUTOPILOT" ? "Autopilot" : mode === "SUGGEST" ? "Suggest only" : "Off"}</span>
          </span>
          <span>
            Last run {settings.data.lastRunAt ? formatDateTime(settings.data.lastRunAt) : "never"}; next {settings.data.nextRunAt ? formatDateTime(settings.data.nextRunAt) : "not scheduled"}
          </span>
          <span>{settings.data.horizonDays} nights ahead</span>
        </div>
      )}
      <Segmented
        label="Dynamic pricing sections"
        value={tab}
        onChange={setTab}
        className="mb-6"
        options={[
          { value: "suggestions", label: "Suggestions" },
          { value: "settings", label: "Guardrails & autopilot" },
          { value: "events", label: "Events" },
          { value: "history", label: "Changes" },
          { value: "earned", label: "What it earned" },
        ]}
      />
      {settings.isError ? (
        <ErrorState error={settings.error} onRetry={() => settings.refetch()} />
      ) : tab === "settings" ? (
        <Settings />
      ) : tab === "events" ? (
        <Events />
      ) : tab === "history" ? (
        <History />
      ) : tab === "earned" ? (
        <Earned />
      ) : (
        <Suggestions />
      )}
    </>
  );
}

function ModeDot({ mode }: { mode: PricingMode }) {
  return <span className={cn("h-2 w-2 rounded-full", mode === "AUTOPILOT" ? "bg-palm" : mode === "SUGGEST" ? "bg-adire" : "bg-ink-faint")} aria-hidden />;
}

/* ------------------------------------------------------------------ */

function Suggestions() {
  const today = todayKey();
  const q = useSuggestions({ from: today, to: addDays(today, 120), status: "PENDING" });
  const { can } = useCan();
  const refresh = usePricingRefresh();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const list = useMemo(() => q.data ?? [], [q.data]);
  const byDate = useMemo(() => {
    const m = new Map<string, Suggestion[]>();
    for (const s of list) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [list]);
  const bulk = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: "ACCEPT" | "REJECT" }) => pricingApi.bulk(ids, action),
    onSuccess: async (r) => {
      await refresh();
      setPicked(new Set());
      toast.success(r.accepted ? `${r.accepted} prices applied` : `${r.rejected} set aside`, r.failed.length ? `${r.failed.length} could not be applied: ${r.failed[0].reason}` : undefined);
    },
    meta: { errorTitle: "Not applied" },
  });
  const one = useMutation({
    mutationFn: async ({ s, accept }: { s: Suggestion; accept: boolean }): Promise<unknown> => (accept ? pricingApi.accept(s.id) : pricingApi.reject(s.id)),
    onSuccess: async () => {
      await refresh();
    },
    meta: { errorTitle: "Not applied" },
  });
  const manage = can("pricing.manage");
  const upliftIfAll = list.reduce((s, x) => s + (x.suggestedKobo - x.currentKobo), 0);
  if (q.isLoading) return <Skeleton className="h-80" />;
  if (!list.length)
    return (
      <Panel>
        <EmptyState glyph="arcs" title="No suggestions waiting" body="Suggestions come from the nightly run at 03:00, or press Run now. On autopilot they are applied at once and show under Changes." />
      </Panel>
    );
  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
        <p className="text-[13px] text-ink">
          <span className="font-mono">{list.length}</span> nights to decide. Accepted as they are, room rates across them move by <span className={cn("font-mono", upliftIfAll >= 0 ? "text-palm" : "text-ochre")}>{upliftIfAll >= 0 ? "+" : "−"}{naira(Math.abs(upliftIfAll))}</span> a room.
        </p>
        {manage && (
          <div className="ml-auto flex gap-1.5">
            <Button size="sm" variant="ghost" disabled={!picked.size} onClick={() => bulk.mutate({ ids: [...picked], action: "REJECT" })}>
              Set aside {picked.size || ""}
            </Button>
            <Button size="sm" disabled={!picked.size} loading={bulk.isPending} onClick={() => bulk.mutate({ ids: [...picked], action: "ACCEPT" })}>
              <Check size={13} weight="bold" /> Accept {picked.size || ""}
            </Button>
          </div>
        )}
      </div>
      <div className="scrollbar-thin max-h-[70vh] overflow-y-auto">
        {byDate.map(([date, rows]) => (
          <section key={date}>
            <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-line bg-surface-2/95 px-5 py-1.5 backdrop-blur-[4px]">
              {manage && (
                <input
                  type="checkbox"
                  aria-label={`Select every suggestion for ${formatDay(date)}`}
                  className="h-4 w-4 accent-[var(--laterite)]"
                  checked={rows.every((r) => picked.has(r.id))}
                  onChange={(e) => setPicked((p) => { const n = new Set(p); rows.forEach((r) => (e.target.checked ? n.add(r.id) : n.delete(r.id))); return n; })}
                />
              )}
              <span className="display-sm text-[14px] italic text-ink">{formatDay(date, { weekday: "long", day: "numeric", month: "long" })}</span>
              <span className="font-mono text-[11px] text-ink-muted">{rows[0].occupancy.daysOut === 0 ? "tonight" : rows[0].occupancy.daysOut === 1 ? "tomorrow" : `${rows[0].occupancy.daysOut} days out`}</span>
            </header>
            <ul>
              {rows.map((s) => {
                const up = s.suggestedKobo > s.currentKobo;
                return (
                  <li key={s.id} className="grid grid-cols-[auto_1fr] items-start gap-3 border-b border-line px-5 py-3 last:border-b-0 sm:grid-cols-[auto_170px_200px_1fr_auto]">
                    {manage ? <input type="checkbox" aria-label={`Select ${s.roomType.name}`} className="mt-1 h-4 w-4 accent-[var(--laterite)]" checked={picked.has(s.id)} onChange={(e) => setPicked((p) => { const n = new Set(p); if (e.target.checked) n.add(s.id); else n.delete(s.id); return n; })} /> : <span />}
                    <span className="text-[13.5px] font-medium text-ink">{s.roomType.name}</span>
                    <span className="col-start-2 flex items-baseline gap-2 sm:col-start-auto">
                      <span className="font-mono text-[13px] text-ink-muted line-through">{nairaCompact(s.currentKobo)}</span>
                      <span className={cn("font-mono text-[15px]", up ? "text-palm" : "text-ochre")}>{naira(s.suggestedKobo)}</span>
                      <span className={cn("inline-flex items-center font-mono text-[11.5px]", up ? "text-palm" : "text-ochre")}>
                        {up ? <ArrowUpRight size={11} weight="bold" /> : <ArrowDownRight size={11} weight="bold" />}
                        {pct(s.changeBps)}
                      </span>
                    </span>
                    <span className="col-start-2 min-w-0 sm:col-start-auto">
                      <span className="block text-[13px] leading-snug text-ink">{s.reason}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {s.factors.map((f) => (
                          <span key={f.code + f.label} className={cn("inline-flex h-5 items-center rounded-xs border px-1.5 font-mono text-[10.5px]", f.effectBps >= 0 ? "border-[color-mix(in_oklab,var(--palm)_35%,transparent)] text-palm" : "border-[color-mix(in_oklab,var(--ochre)_40%,transparent)] text-ochre")} title={f.label}>
                            {FACTOR_LABEL[f.code]} {pct(f.effectBps)}
                          </span>
                        ))}
                        <span className="inline-flex h-5 items-center px-1 text-[11px] text-ink-faint">confidence {s.confidence.toLowerCase()}</span>
                      </span>
                    </span>
                    {manage && (
                      <span className="col-start-2 flex gap-1 sm:col-start-auto">
                        <Button size="sm" variant="ghost" aria-label="Set aside" onClick={() => one.mutate({ s, accept: false })}>
                          <X size={14} />
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => one.mutate({ s, accept: true })} loading={one.isPending && one.variables?.s.id === s.id}>
                          <Check size={13} weight="bold" /> Accept
                        </Button>
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

const MODES: { mode: PricingMode; title: string; body: string; icon: React.ReactNode }[] = [
  { mode: "OFF", title: "Off", body: "No suggestions. Prices come only from the Almanac.", icon: <X size={18} /> },
  { mode: "SUGGEST", title: "Suggest", body: "Ghost prices on the Almanac; a manager accepts or sets each aside.", icon: <Lightning size={18} weight="duotone" /> },
  { mode: "AUTOPILOT", title: "Autopilot", body: "Applied within your guardrails at 03:00 and when bookings spike. Every change logged with its reason.", icon: <Robot size={18} weight="duotone" /> },
];

function Settings() {
  const qc = useQueryClient();
  const { can } = useCan();
  const manage = can("pricing.manage");
  const s = usePricingSettings();
  const g = useGuardrails();
  const types = useRoomTypes();
  const today = todayKey();
  const frozen = useFrozenDates(today, addDays(today, 365));
  const comps = useCompetitors(today, addDays(today, 90));
  const [d, setD] = useState(s.data);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- adopt saved settings
    setD(s.data);
  }, [s.data]);
  const save = useMutation({
    mutationFn: (b: Parameters<typeof pricingApi.saveSettings>[0]) => pricingApi.saveSettings(b),
    onSuccess: (r) => {
      qc.setQueryData(qk5.pricingSettings, r);
      toast.success(r.mode === "AUTOPILOT" ? "Autopilot on" : r.mode === "SUGGEST" ? "Suggestions on" : "Dynamic pricing off", r.mode === "AUTOPILOT" ? "Prices move within the guardrails below; see every change under Changes." : undefined);
    },
    meta: { errorTitle: "Not saved" },
  });
  const [freeze, setFreeze] = useState({ from: addDays(today, 7), to: addDays(today, 7), type: "", note: "" });
  const addFreeze = useMutation({ mutationFn: () => pricingApi.freeze({ dateFrom: freeze.from, dateTo: freeze.to, roomTypeId: freeze.type || null, note: freeze.note }), onSuccess: () => { void qc.invalidateQueries({ queryKey: qk5.pricing }); setFreeze((f) => ({ ...f, note: "" })); toast.success("Dates frozen", "The engine will leave them alone."); }, meta: { errorTitle: "Not frozen" } });
  const unfreeze = useMutation({ mutationFn: (id: string) => pricingApi.unfreeze(id), onSuccess: () => void qc.invalidateQueries({ queryKey: qk5.pricing }), meta: { errorTitle: "Not removed" } });
  const [comp, setComp] = useState({ name: "", date: today, rate: null as number | null });
  const addComp = useMutation({ mutationFn: () => pricingApi.saveCompetitors([{ competitorName: comp.name.trim(), date: comp.date, rateKobo: comp.rate ?? 0 }]), onSuccess: () => { void qc.invalidateQueries({ queryKey: qk5.pricing }); setComp((c) => ({ ...c, rate: null })); }, meta: { errorTitle: "Not saved" } });
  const delComp = useMutation({ mutationFn: (id: string) => pricingApi.deleteCompetitor(id), onSuccess: () => void qc.invalidateQueries({ queryKey: qk5.pricing }), meta: { errorTitle: "Not removed" } });
  if (!d) return <Skeleton className="h-96" />;
  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <PanelHeader eyebrow="Mode" title="Who moves the price" />
        <div role="radiogroup" aria-label="Mode" className="grid gap-3 p-5 md:grid-cols-3">
          {MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              role="radio"
              aria-checked={d.mode === m.mode}
              disabled={!manage}
              onClick={() => save.mutate({ mode: m.mode })}
              className={cn("flex flex-col items-start gap-2 rounded-md border p-4 text-left transition-colors disabled:cursor-default", d.mode === m.mode ? "border-ink bg-surface shadow-[0_0_0_1px_var(--ink)]" : "border-line-strong bg-paper hover:border-ink-faint")}
              data-testid={`mode-${m.mode}`}
            >
              <span className="flex w-full items-center gap-2 text-ink">
                {m.icon}
                <span className="text-[15px] font-medium">{m.title}</span>
                {d.mode === m.mode && <Check size={15} weight="bold" className="ml-auto text-laterite" />}
              </span>
              <span className="text-[12.5px] leading-snug text-ink-muted">{m.body}</span>
            </button>
          ))}
        </div>
        <div className="grid gap-4 border-t border-line p-5 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nights ahead" hint="14 to 365">
            <Input inputMode="numeric" value={d.horizonDays} disabled={!manage} onChange={(e) => setD({ ...d, horizonDays: Number(e.target.value.replace(/\D/g, "") || 0) })} />
          </Field>
          <Field label="Smallest change" hint="percent; smaller moves are not suggested">
            <Input inputMode="numeric" value={d.minChangeBps / 100} disabled={!manage} onChange={(e) => setD({ ...d, minChangeBps: Number(e.target.value.replace(/[^\d.]/g, "") || 0) * 100 })} />
          </Field>
          <Field label="A booking spike is" hint="rooms for one night booked within 24 hours">
            <Input inputMode="numeric" value={d.paceSpikeRooms} disabled={!manage || !d.paceSpikeEnabled} onChange={(e) => setD({ ...d, paceSpikeRooms: Number(e.target.value.replace(/\D/g, "") || 0) })} />
          </Field>
          <div className="flex items-end">
            <Switch checked={d.paceSpikeEnabled} disabled={!manage} onChange={(v) => setD({ ...d, paceSpikeEnabled: v })} label="Re-price on a spike" description="Autopilot only; at most once an hour." />
          </div>
        </div>
        {manage && (
          <div className="flex justify-end border-t border-line px-5 py-3">
            <Button disabled={JSON.stringify(d) === JSON.stringify(s.data)} loading={save.isPending} onClick={() => save.mutate({ horizonDays: d.horizonDays, minChangeBps: d.minChangeBps, paceSpikeEnabled: d.paceSpikeEnabled, paceSpikeRooms: d.paceSpikeRooms })}>
              Save
            </Button>
          </div>
        )}
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader eyebrow="Guardrails" title="The limits, per room type" description="The engine never goes below the floor or above the ceiling, and never moves a price further than the daily step in one run." />
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left">
                {["Room type", "On", "Floor", "Ceiling", "Most in a day", ""].map((h) => (
                  <th key={h} className="eyebrow px-5 py-2.5 text-[10px] font-normal">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>{(g.data ?? []).map((r) => <GuardrailRow key={r.roomType.id} g={r} manage={manage} />)}</tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <PanelHeader eyebrow={<span className="inline-flex items-center gap-1.5"><Snowflake size={12} /> Don&rsquo;t touch</span>} title="Frozen dates" description="Weddings, group blocks and contracts: nights the engine leaves alone. Prices you fix by hand are never changed either." />
          <ul className="divide-y divide-line">
            {(frozen.data ?? []).map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                <span className="w-28 font-mono text-ink">{formatDay(f.date, { day: "numeric", month: "short", weekday: "short" })}</span>
                <span className="text-ink-muted">{f.roomTypeId ? (types.data?.find((t) => t.id === f.roomTypeId)?.name ?? "one type") : "every type"}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{f.note}</span>
                {manage && (
                  <Button size="icon-sm" variant="ghost" aria-label="Unfreeze" onClick={() => unfreeze.mutate(f.id)}>
                    <Trash size={14} />
                  </Button>
                )}
              </li>
            ))}
            {frozen.data && !frozen.data.length && <li className="px-5 py-4 text-[13px] text-ink-muted">Nothing frozen.</li>}
          </ul>
          {manage && (
            <div className="grid gap-2 border-t border-line p-5 sm:grid-cols-[1fr_1fr_1.2fr]">
              <Field label="From">
                <Input type="date" value={freeze.from} onChange={(e) => setFreeze({ ...freeze, from: e.target.value, to: e.target.value > freeze.to ? e.target.value : freeze.to })} />
              </Field>
              <Field label="To">
                <Input type="date" value={freeze.to} min={freeze.from} onChange={(e) => setFreeze({ ...freeze, to: e.target.value })} />
              </Field>
              <Field label="Room type">
                <Select value={freeze.type} onChange={(e) => setFreeze({ ...freeze, type: e.target.value })}>
                  <option value="">Every type</option>
                  {(types.data ?? []).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Why" className="sm:col-span-2">
                <Input value={freeze.note} onChange={(e) => setFreeze({ ...freeze, note: e.target.value })} placeholder="Wedding block at a contract rate" />
              </Field>
              <div className="flex items-end">
                <Button className="w-full" onClick={() => addFreeze.mutate()} loading={addFreeze.isPending}>
                  <Snowflake size={14} /> Freeze
                </Button>
              </div>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader eyebrow="Competitors" title="What the neighbours charge" description="Optional. When the middle of their prices is more than 10% away from yours, the suggestion moves half the gap, at most 10%." />
          <ul className="divide-y divide-line">
            {(comps.data ?? []).map((c) => (
              <li key={c.id} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                <span className="w-28 font-mono text-ink">{formatDay(c.date, { day: "numeric", month: "short", weekday: "short" })}</span>
                <span className="min-w-0 flex-1 truncate text-ink">{c.competitorName}</span>
                <span className="font-mono text-ink">{naira(c.rateKobo)}</span>
                {manage && (
                  <Button size="icon-sm" variant="ghost" aria-label="Remove" onClick={() => delComp.mutate(c.id)}>
                    <Trash size={14} />
                  </Button>
                )}
              </li>
            ))}
            {comps.data && !comps.data.length && <li className="px-5 py-4 text-[13px] text-ink-muted">No prices entered.</li>}
          </ul>
          {manage && (
            <div className="grid gap-2 border-t border-line p-5 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-end">
              <Field label="Hotel">
                <Input value={comp.name} onChange={(e) => setComp({ ...comp, name: e.target.value })} placeholder="Eko Hotels" />
              </Field>
              <Field label="Night">
                <Input type="date" value={comp.date} onChange={(e) => setComp({ ...comp, date: e.target.value })} />
              </Field>
              <Field label="Their price">
                <NairaInput kobo={comp.rate} onChange={(v) => setComp({ ...comp, rate: v })} />
              </Field>
              <Button onClick={() => addComp.mutate()} loading={addComp.isPending} disabled={!comp.name.trim() || !comp.rate}>
                Add
              </Button>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function GuardrailRow({ g, manage }: { g: Guardrail; manage: boolean }) {
  const qc = useQueryClient();
  const [floor, setFloor] = useState<number | null>(g.floorKobo);
  const [ceil, setCeil] = useState<number | null>(g.ceilingKobo);
  const [step, setStep] = useState(String(g.maxDailyChangeBps / 100));
  const [on, setOn] = useState(g.enabled);
  const dirty = floor !== g.floorKobo || ceil !== g.ceilingKobo || Number(step) * 100 !== g.maxDailyChangeBps || on !== g.enabled;
  const bad = floor != null && ceil != null && floor >= ceil;
  const save = useMutation({ mutationFn: () => pricingApi.saveGuardrail(g.roomType.id, { enabled: on, floorKobo: floor ?? 0, ceilingKobo: ceil ?? 0, maxDailyChangeBps: Math.round(Number(step) * 100) }), onSuccess: () => { void qc.invalidateQueries({ queryKey: qk5.guardrails }); toast.success(`${g.roomType.name} guardrails saved`); }, meta: { errorTitle: "Not saved" } });
  return (
    <tr className="border-b border-line last:border-b-0">
      <td className="px-5 py-2.5">
        <span className="block font-medium text-ink">{g.roomType.name}</span>
        <span className="font-mono text-[11.5px] text-ink-muted">base {naira(g.roomType.basePriceKobo)}</span>
      </td>
      <td className="px-5 py-2.5">
        <Switch checked={on} onChange={setOn} disabled={!manage} ariaLabel={`Dynamic pricing for ${g.roomType.name}`} />
      </td>
      <td className="w-44 px-5 py-2.5">
        <NairaInput kobo={floor} onChange={setFloor} aria-label="Floor" />
        <span className="font-mono text-[10.5px] text-ink-faint">{percent(g.roomType.basePriceKobo ? (floor ?? 0) / g.roomType.basePriceKobo : 0)} of base</span>
      </td>
      <td className="w-44 px-5 py-2.5">
        <NairaInput kobo={ceil} onChange={setCeil} aria-label="Ceiling" />
        <span className="font-mono text-[10.5px] text-ink-faint">{percent(g.roomType.basePriceKobo ? (ceil ?? 0) / g.roomType.basePriceKobo : 0)} of base</span>
      </td>
      <td className="w-36 px-5 py-2.5">
        <div className="flex items-center gap-1">
          <Input inputMode="numeric" value={step} onChange={(e) => setStep(e.target.value.replace(/[^\d.]/g, ""))} className="w-20 font-mono" aria-label="Most change in a day, percent" disabled={!manage} />
          <span className="text-ink-muted">%</span>
        </div>
      </td>
      <td className="px-5 py-2.5 text-right">
        {manage && dirty && (
          <Button size="sm" onClick={() => save.mutate()} loading={save.isPending} disabled={bad}>
            Save
          </Button>
        )}
        {bad && <span className="block text-[11.5px] text-danger">floor must be below ceiling</span>}
      </td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */

const IMPACT: Record<EventImpact, { label: string; bps: number; tone: "palm" | "brass" | "laterite" | "danger" }> = {
  LOW: { label: "Low", bps: 500, tone: "palm" },
  MEDIUM: { label: "Medium", bps: 1000, tone: "brass" },
  HIGH: { label: "High", bps: 1800, tone: "laterite" },
  VERY_HIGH: { label: "Very high", bps: 3000, tone: "danger" },
};
const IMPACT_VAR: Record<EventImpact, string> = { LOW: "var(--palm)", MEDIUM: "var(--brass)", HIGH: "var(--laterite)", VERY_HIGH: "var(--danger)" };

function Events() {
  const qc = useQueryClient();
  const { can } = useCan();
  const manage = can("pricing.manage");
  const today = todayKey();
  const [start, setStart] = useState(today.slice(0, 7));
  const from = `${start}-01`;
  const months = [0, 1, 2].map((i) => {
    const d = new Date(`${from}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + i);
    return d.toISOString().slice(0, 7);
  });
  const to = addDays(`${months[2]}-28`, 4);
  const ev = usePricingEvents(from, addDays(to, 30));
  const events = (ev.data ?? []).filter((e) => e.dateTo >= from && e.dateFrom <= to);
  const [edit, setEdit] = useState<Partial<PricingEvent> | null>(null);
  const [del, setDel] = useState<PricingEvent | null>(null);
  const save = useMutation({
    mutationFn: (e: Partial<PricingEvent>) =>
      e.id
        ? pricingApi.updateEvent(e.id, e.kind === "NATIONAL" ? { upliftBps: e.upliftBps, disabled: e.disabled } : { name: e.name, dateFrom: e.dateFrom, dateTo: e.dateTo, impact: e.impact, upliftBps: e.upliftBps, city: e.city, note: e.note, disabled: e.disabled })
        : pricingApi.createEvent({ name: e.name ?? "", dateFrom: e.dateFrom ?? today, dateTo: e.dateTo ?? e.dateFrom ?? today, impact: e.impact, upliftBps: e.upliftBps, city: e.city ?? null, note: e.note }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk5.pricing });
      setEdit(null);
      toast.success("Event saved", "Suggestions take it into account from the next run.");
    },
    meta: { errorTitle: "Not saved" },
  });
  const toggle = useMutation({ mutationFn: (e: PricingEvent) => pricingApi.updateEvent(e.id, { disabled: !e.disabled }), onSuccess: () => void qc.invalidateQueries({ queryKey: qk5.pricing }), meta: { errorTitle: "Not changed" } });
  const remove = useMutation({ mutationFn: (e: PricingEvent) => pricingApi.deleteEvent(e.id), onSuccess: () => void qc.invalidateQueries({ queryKey: qk5.pricing }), meta: { errorTitle: "Not removed" } });
  const shift = (n: number) => {
    const d = new Date(`${from}T12:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + n);
    setStart(d.toISOString().slice(0, 7));
  };
  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
      <Panel className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <Button size="sm" variant="ghost" onClick={() => shift(-1)} aria-label="Earlier">
            <ArrowRight size={14} className="rotate-180" />
          </Button>
          <span className="display-sm text-[16px] text-ink">
            {monthName(from)} to {monthName(`${months[2]}-01`)} {months[2].slice(0, 4)}
          </span>
          <Button size="sm" variant="ghost" onClick={() => shift(1)} aria-label="Later">
            <ArrowRight size={14} />
          </Button>
          {manage && (
            <Button size="sm" className="ml-auto" onClick={() => setEdit({ kind: "CUSTOM", name: "", dateFrom: addDays(today, 14), dateTo: addDays(today, 14), impact: "MEDIUM", upliftBps: 1000, city: "Lagos", note: "" })} data-testid="add-event">
              <Plus size={13} weight="bold" /> Event
            </Button>
          )}
        </div>
        <div className="grid gap-px bg-line md:grid-cols-3">
          {months.map((m) => (
            <MonthGrid key={m} month={m} events={events} today={today} onPick={(e) => manage && setEdit(e)} />
          ))}
        </div>
        <div className="flex flex-wrap gap-4 border-t border-line px-5 py-2.5 text-[11.5px] text-ink-muted">
          {(Object.keys(IMPACT) as EventImpact[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="h-2 w-4 rounded-[2px]" style={{ background: IMPACT_VAR[k] }} /> {IMPACT[k].label} ({pct(IMPACT[k].bps)})
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <Moon size={12} /> moon-dependent date
          </span>
        </div>
      </Panel>
      <Panel className="self-start overflow-hidden">
        <PanelHeader eyebrow="In these months" title={`${events.length} events`} />
        <ul className="divide-y divide-line">
          {events.map((e) => (
            <li key={e.id} className={cn("flex items-start gap-3 px-5 py-3", e.disabled && "opacity-55")}>
              <span className="mt-1 h-8 w-1 shrink-0 rounded-full" style={{ background: IMPACT_VAR[e.impact] }} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-[13.5px] font-medium text-ink">
                  {e.name}
                  {e.moonDependent && <Moon size={12} className="text-ink-muted" aria-label="date depends on the moon" />}
                </p>
                <p className="text-[12px] text-ink-muted">
                  {formatDay(e.dateFrom, { day: "numeric", month: "short" })}
                  {e.dateTo !== e.dateFrom ? ` to ${formatDay(e.dateTo, { day: "numeric", month: "short" })}` : ""} &middot; <span className="font-mono">{pct(e.upliftBps)}</span> &middot; {e.kind === "NATIONAL" ? "national" : (e.city ?? "custom")}
                </p>
                {e.note && <p className="mt-0.5 text-[12px] italic text-ink-muted">{e.note}</p>}
              </div>
              {manage && (
                <div className="flex shrink-0 items-center gap-1">
                  <Switch checked={!e.disabled} onChange={() => toggle.mutate(e)} ariaLabel={`Use ${e.name}`} />
                  {e.kind === "CUSTOM" && (
                    <Button size="icon-sm" variant="ghost" aria-label={`Remove ${e.name}`} onClick={() => setDel(e)}>
                      <Trash size={14} />
                    </Button>
                  )}
                </div>
              )}
            </li>
          ))}
          {ev.isLoading && <Skeleton className="m-5 h-40" />}
        </ul>
      </Panel>
      <Dialog
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        title={edit?.id ? edit.name ?? "Event" : "A new event"}
        description={edit?.kind === "NATIONAL" ? "A national date: you can change its uplift or switch it off for this hotel." : "Concerts, conferences, football: anything that fills Lagos hotels."}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button onClick={() => edit && save.mutate(edit)} loading={save.isPending} disabled={!edit?.name?.trim()} data-testid="save-event">
              Save event
            </Button>
          </>
        }
      >
        {edit && (
          <div className="flex flex-col gap-4">
            {edit.kind !== "NATIONAL" && (
              <>
                <Field label="Name">
                  <Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Davido at the Eko Convention Centre" />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="From">
                    <Input type="date" value={edit.dateFrom ?? ""} onChange={(e) => setEdit({ ...edit, dateFrom: e.target.value, dateTo: (edit.dateTo ?? "") < e.target.value ? e.target.value : edit.dateTo })} />
                  </Field>
                  <Field label="To">
                    <Input type="date" value={edit.dateTo ?? ""} min={edit.dateFrom} onChange={(e) => setEdit({ ...edit, dateTo: e.target.value })} />
                  </Field>
                </div>
                <ChipRadio label="Impact" value={(edit.impact ?? "MEDIUM") as EventImpact} onChange={(v) => setEdit({ ...edit, impact: v, upliftBps: IMPACT[v].bps })} options={(Object.keys(IMPACT) as EventImpact[]).map((k) => ({ value: k, label: IMPACT[k].label }))} />
              </>
            )}
            <Field label="Uplift" hint="percent added to the suggestion on these nights">
              <Input inputMode="numeric" value={(edit.upliftBps ?? 0) / 100} onChange={(e) => setEdit({ ...edit, upliftBps: Number(e.target.value.replace(/[^\d.]/g, "") || 0) * 100 })} className="w-28 font-mono" />
            </Field>
            {edit.kind !== "NATIONAL" && (
              <Field label="Note" optional>
                <Input value={edit.note ?? ""} onChange={(e) => setEdit({ ...edit, note: e.target.value })} />
              </Field>
            )}
          </div>
        )}
      </Dialog>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Remove ${del?.name ?? "this event"}?`} confirmLabel="Remove" danger onConfirm={() => (del ? remove.mutateAsync(del) : undefined)} />
    </div>
  );
}

function MonthGrid({ month, events, today, onPick }: { month: string; events: PricingEvent[]; today: string; onPick: (e: PricingEvent) => void }) {
  const first = `${month}-01`;
  const days = dayRange(first, 31).filter((d) => d.startsWith(month));
  const lead = (weekday(first) + 6) % 7; // weeks start on Monday
  return (
    <div className="bg-surface p-4">
      <p className="display-sm mb-2 text-[15px] italic text-ink">{monthName(first)}</p>
      <div className="grid grid-cols-7 gap-px text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="pb-1 font-mono text-[9.5px] text-ink-faint">
            {d}
          </span>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <span key={`l${i}`} />
        ))}
        {days.map((d) => {
          const hits = events.filter((e) => d >= e.dateFrom && d <= e.dateTo && !e.disabled);
          const top = hits.sort((a, b) => b.upliftBps - a.upliftBps)[0];
          return (
            <button
              key={d}
              type="button"
              onClick={() => top && onPick(top)}
              disabled={!top}
              title={hits.map((h) => `${h.name} ${pct(h.upliftBps)}`).join("\n") || undefined}
              className={cn("relative flex h-9 flex-col items-center justify-center rounded-[3px] font-mono text-[11.5px] disabled:cursor-default", d === today ? "text-laterite" : d < today ? "text-ink-faint" : "text-ink", top && "hover:ring-1 hover:ring-ink-faint")}
              style={top ? { background: `color-mix(in oklab, ${IMPACT_VAR[top.impact]} 16%, var(--surface))` } : undefined}
            >
              {Number(d.slice(8))}
              {top && <span className="absolute inset-x-1.5 bottom-1 h-[3px] rounded-full" style={{ background: IMPACT_VAR[top.impact] }} />}
              {top?.moonDependent && <Moon size={8} className="absolute right-0.5 top-0.5 text-ink-muted" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function History() {
  const [source, setSource] = useState("");
  const [page, setPage] = useState(1);
  const q = usePriceChanges({ source: source || undefined, page, pageSize: 30 });
  const { can } = useCan();
  const refresh = usePricingRefresh();
  const [rev, setRev] = useState<string | null>(null);
  const revert = useMutation({ mutationFn: (id: string) => pricingApi.revert(id), onSuccess: async () => { await refresh(); toast.success("Reverted", "The night is back at its earlier price."); }, meta: { errorTitle: "Not reverted" } });
  const pages = Math.max(1, Math.ceil((q.data?.total ?? 0) / 30));
  return (
    <Panel className="overflow-hidden">
      <div className="flex gap-1.5 border-b border-line p-3 sm:px-5">
        {[
          ["", "Every change"],
          ["ACCEPTED", "Accepted"],
          ["AUTOPILOT", "Autopilot"],
          ["REVERT", "Reverted"],
        ].map(([k, l]) => (
          <button key={k || "all"} type="button" aria-pressed={source === k} onClick={() => { setSource(k); setPage(1); }} className={cn("h-8 rounded-full border px-3 text-[12.5px] font-medium", source === k ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:text-ink")}>
            {l}
          </button>
        ))}
      </div>
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[820px] text-[13px]">
          <thead>
            <tr className="border-b border-line text-left">
              {["Night", "Room type", "Price", "Why", "By", ""].map((h) => (
                <th key={h} className="eyebrow px-4 py-2.5 text-[10px] font-normal">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(q.data?.items ?? []).map((c) => (
              <tr key={c.id} className={cn("border-b border-line last:border-b-0", c.reverted && "opacity-55")}>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-ink">{formatDay(c.date, { day: "numeric", month: "short", weekday: "short" })}</td>
                <td className="px-4 py-2.5 text-ink">{c.roomType.name}</td>
                <td className="whitespace-nowrap px-4 py-2.5 font-mono">
                  <span className="text-ink-muted">{nairaCompact(c.fromKobo)}</span>
                  <ArrowRight size={11} className="mx-1 inline text-ink-faint" />
                  <span className={c.toKobo > c.fromKobo ? "text-palm" : "text-ochre"}>{nairaCompact(c.toKobo)}</span>
                </td>
                <td className="max-w-[340px] px-4 py-2.5 text-[12.5px] text-ink">{c.reason}</td>
                <td className="whitespace-nowrap px-4 py-2.5">
                  {c.source === "AUTOPILOT" ? (
                    <Badge tone="palm" icon={<Robot size={11} />}>
                      Autopilot
                    </Badge>
                  ) : c.source === "REVERT" ? (
                    <Badge tone="neutral" icon={<ArrowCounterClockwise size={11} />}>
                      {c.by?.fullName.split(" ")[0] ?? "Reverted"}
                    </Badge>
                  ) : (
                    <Badge tone="adire">{c.by?.fullName ?? "Accepted"}</Badge>
                  )}
                  <span className="mt-0.5 block font-mono text-[10.5px] text-ink-faint">{formatDateTime(c.createdAt)}</span>
                </td>
                <td className="px-4 py-2.5 text-right">
                  {can("pricing.manage") && c.source !== "REVERT" && !c.reverted && c.date >= todayKey() && (
                    <Button size="sm" variant="ghost" onClick={() => setRev(c.id)}>
                      <ArrowCounterClockwise size={13} /> Revert
                    </Button>
                  )}
                  {c.reverted && <span className="text-[12px] italic text-ink-muted">reverted</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {q.data && !q.data.items.length && <EmptyState compact glyph="arcs" title="No changes yet" />}
      {pages > 1 && (
        <div className="flex justify-end gap-1 border-t border-line px-4 py-2">
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
      <ConfirmDialog open={!!rev} onOpenChange={(o) => !o && setRev(null)} title="Put the earlier price back?" body="Bookings already made keep the price they were quoted." confirmLabel="Revert" onConfirm={() => (rev ? revert.mutateAsync(rev) : undefined)} />
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

function Earned() {
  const today = todayKey();
  const [range, setRange] = useState<"90" | "180" | "365">("180");
  const from = addDays(today, -Number(range));
  const q = usePricingReport(from, today);
  const r = q.data;
  const max = r ? Math.max(1, ...r.byMonth.map((m) => Math.max(m.actualRevenueKobo, m.barRevenueKobo))) : 1;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <Segmented
          size="sm"
          label="Period"
          value={range}
          onChange={setRange}
          options={[
            { value: "90", label: "90 days" },
            { value: "180", label: "6 months" },
            { value: "365", label: "12 months" },
          ]}
        />
      </div>
      {!r ? (
        <Skeleton className="h-80" />
      ) : (
        <>
          <Panel className="overflow-hidden">
            <div className="grid lg:grid-cols-[1.1fr_1fr]">
              <div className="border-b border-line p-6 lg:border-b-0 lg:border-r">
                <Badge tone="brass">Estimate</Badge>
                <p className="display mt-4 text-[30px] leading-[1.12] text-ink sm:text-[36px]" data-testid="pricing-uplift">
                  About <span className="font-mono text-[0.88em] tracking-tight text-palm">{naira(r.upliftKobo)}</span> more than the earlier prices would have made.
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
                  {number(r.roomNightsSold)} room nights sold at a dynamic price across {number(r.nightsRepriced)} repriced nights: {naira(r.actualRevenueKobo)} against {naira(r.barRevenueKobo)} at the price before the change, <span className="font-mono text-ink">{r.upliftPct > 0 ? "+" : ""}{r.upliftPct}%</span>.
                </p>
                <p className="mt-4 border-l-2 border-brass pl-3 text-[12.5px] italic leading-relaxed text-ink-muted">{r.disclaimer}</p>
              </div>
              <div className="p-6">
                <p className="eyebrow mb-4">By month</p>
                <ul className="flex flex-col gap-4">
                  {r.byMonth.map((m) => (
                    <li key={m.month}>
                      <div className="mb-1 flex items-baseline justify-between text-[12.5px]">
                        <span className="text-ink">{monthName(`${m.month}-01`)}</span>
                        <span className="font-mono text-palm">+{nairaCompact(m.upliftKobo)}</span>
                      </div>
                      <div className="relative h-5" aria-hidden>
                        <span className="absolute inset-y-0 left-0 rounded-[2px] border border-dashed border-ink-faint" style={{ width: `${(m.barRevenueKobo / max) * 100}%` }} />
                        <span className="absolute inset-y-[5px] left-0 rounded-[2px] bg-palm" style={{ width: `${(m.actualRevenueKobo / max) * 100}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex gap-4 text-[11.5px] text-ink-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-4 rounded-[2px] bg-palm" /> sold at the dynamic price
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-4 rounded-[2px] border border-dashed border-ink-faint" /> the same nights at the earlier price
                  </span>
                </div>
                <table className="sr-only">
                  <caption>Revenue by month, actual and at the earlier price</caption>
                  <tbody>
                    {r.byMonth.map((m) => (
                      <tr key={m.month}>
                        <td>{m.month}</td>
                        <td>{naira(m.actualRevenueKobo)}</td>
                        <td>{naira(m.barRevenueKobo)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </Panel>
          <div className="grid gap-5 md:grid-cols-2">
            <Panel>
              <PanelHeader eyebrow="By room type" title="Where it came from" />
              <ul className="divide-y divide-line">
                {r.byRoomType.map((t) => (
                  <li key={t.roomType.id} className="flex items-center gap-3 px-5 py-3 text-[13px]">
                    <span className="flex-1 text-ink">{t.roomType.name}</span>
                    <span className="font-mono text-ink-muted">{t.roomNightsSold} nights</span>
                    <span className="w-24 text-right font-mono text-palm">+{naira(t.upliftKobo)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
            <Panel>
              <PanelHeader eyebrow="By who decided" title="Accepted and autopilot" />
              <ul className="divide-y divide-line">
                {r.bySource.map((s) => (
                  <li key={s.source} className="flex items-center gap-3 px-5 py-3 text-[13px]">
                    {s.source === "AUTOPILOT" ? <Robot size={16} className="text-palm" /> : <Check size={16} className="text-adire" />}
                    <span className="flex-1 text-ink">{s.source === "AUTOPILOT" ? "Autopilot" : "Accepted by a manager"}</span>
                    <span className="font-mono text-ink-muted">{s.roomNightsSold} nights</span>
                    <span className="w-24 text-right font-mono text-palm">+{naira(s.upliftKobo)}</span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
