"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarBlank, Clock, Hourglass, Plus, ShoppingBag, Trash } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useCan } from "@/lib/permissions";
import { extrasApi } from "@/lib/api/endpoints-m7";
import { qk7, useExtras } from "@/lib/api/hooks-m7";
import type { Channel, Extra, ExtraInput, ExtraKind, ExtraPricing } from "@/lib/api/types-m7";
import { isApiError } from "@/lib/api/client";
import { EXTRA_CATEGORIES, EXTRA_PRICING, extraPrice, pricingUnit, type ExtraCategory } from "@/lib/m7-catalog";
import { naira } from "@/lib/format";
import { toast } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Sheet } from "@/components/ui/overlay";
import { Field, Input, Switch, Textarea } from "@/components/ui/form";
import { EmptyState, ErrorState, PageHeader, Panel, Segmented, Skeleton, Tip } from "@/components/ui/primitives";
import { NairaInput, Stepper } from "@/components/m2/bits";
import { CatalogIcon } from "@/components/m7/icon";
import { ChannelDots } from "@/components/form-builder/canvas";
import { ALL_CHANNELS } from "@/components/form-builder/logic";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const blank = (): ExtraInput => ({
  name: "",
  description: "",
  imageUrl: null,
  category: "FOOD",
  kind: "STANDARD",
  pricing: "PER_STAY",
  priceKobo: 0,
  maxUnits: null,
  taxable: true,
  channels: [...ALL_CHANNELS],
  availability: { validFrom: null, validTo: null, daysOfWeek: null, minNights: null, earlyFrom: null, lateUntil: null },
  dailyCap: null,
  leadTimeHours: 0,
  active: true,
});

export function ExtrasView() {
  const q = useExtras();
  const { can } = useCan();
  const manage = can("extras.manage");
  const [edit, setEdit] = useState<{ id: string | null; draft: ExtraInput } | null>(null);
  const [stay, setStay] = useState({ nights: 2, guests: 2 });
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => extrasApi.update(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk7.extras }),
    meta: { errorTitle: "Not changed" },
  });

  const groups = useMemo(() => EXTRA_CATEGORIES.map((c) => ({ ...c, items: (q.data ?? []).filter((e) => e.category === c.value).sort((a, b) => a.sortOrder - b.sortOrder) })).filter((g) => g.items.length), [q.data]);
  const active = (q.data ?? []).filter((e) => e.active);
  const sold = (q.data ?? []).reduce((s, e) => s + (e.soldLast30Days ?? 0), 0);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <ShoppingBag size={14} weight="duotone" /> Extras
          </>
        }
        title={
          <>
            Everything <em>besides the room</em>.
          </>
        }
        description="Breakfast, early check-in, a birthday cake on the bed. Guests add them while they book; the desk adds them later. They land on the folio as their own lines, with tax."
        actions={
          manage && (
            <Button onClick={() => setEdit({ id: null, draft: blank() })} data-testid="new-extra">
              <Plus size={15} weight="bold" /> New extra
            </Button>
          )
        }
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-96" />
      ) : !q.data.length ? (
        <Panel>
          <EmptyState title="No extras yet" body="Start with breakfast or a late check-out: the two things guests ask for most." action={manage && <Button onClick={() => setEdit({ id: null, draft: blank() })}>Add the first extra</Button>} />
        </Panel>
      ) : (
        <div className="flex flex-col gap-8">
          <Panel className="flex flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
            <p className="text-[13px] text-ink-muted">
              <span className="font-mono text-[20px] text-ink">{active.length}</span> on sale &middot; <span className="font-mono text-ink">{sold}</span> sold in 30 days
            </p>
            <div className="ml-auto flex flex-wrap items-center gap-3 text-[13px] text-ink-muted">
              <span>Prices for a stay of</span>
              <Stepper label="nights" value={stay.nights} onChange={(n) => setStay((s) => ({ ...s, nights: n }))} min={1} max={14} suffix="nights" />
              <Stepper label="guests" value={stay.guests} onChange={(n) => setStay((s) => ({ ...s, guests: n }))} min={1} max={10} suffix="guests" />
            </div>
          </Panel>
          {groups.map((g) => (
            <section key={g.value}>
              <h2 className="mb-3 flex items-center gap-2">
                <CatalogIcon name={g.icon} size={16} className="text-laterite" />
                <span className="display-sm text-[19px] text-ink">{g.label}</span>
                <span className="font-mono text-[11px] text-ink-faint">{g.items.length}</span>
              </h2>
              <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.items.map((e) => (
                  <li key={e.id}>
                    <ExtraCard e={e} stay={stay} manage={manage} onOpen={() => setEdit({ id: e.id, draft: toInput(e) })} onToggle={(v) => toggle.mutate({ id: e.id, active: v })} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      {edit && <ExtraEditor key={edit.id ?? "new"} id={edit.id} initial={edit.draft} onClose={() => setEdit(null)} stay={stay} />}
    </>
  );
}

function toInput(e: Extra): ExtraInput {
  const { id: _i, propertyId: _p, createdAt: _c, updatedAt: _u, soldLast30Days: _s, ...rest } = e;
  void _i;
  void _p;
  void _c;
  void _u;
  void _s;
  return rest;
}

export function ExtraCard({ e, stay, manage, onOpen, onToggle }: { e: Extra; stay: { nights: number; guests: number }; manage: boolean; onOpen: () => void; onToggle: (v: boolean) => void }) {
  const total = extraPrice(e.pricing, e.priceKobo, { nights: stay.nights, guests: stay.guests, units: 1 });
  const notes = [
    e.kind === "EARLY_CHECK_IN" && e.availability.earlyFrom ? `from ${e.availability.earlyFrom}` : null,
    e.kind === "LATE_CHECK_OUT" && e.availability.lateUntil ? `until ${e.availability.lateUntil}` : null,
    e.leadTimeHours ? `${e.leadTimeHours} h notice` : null,
    e.dailyCap ? `${e.dailyCap} a day` : null,
    e.pricing === "PER_UNIT" && e.maxUnits ? `up to ${e.maxUnits}` : null,
  ].filter(Boolean);
  return (
    <article className={cn("group relative flex h-full flex-col rounded-lg border bg-surface transition-colors", e.active ? "border-line hover:border-line-strong" : "border-dashed border-line-strong bg-surface-2/40")} data-extra={e.name}>
      <button type="button" onClick={onOpen} className="flex flex-1 flex-col gap-2 p-4 pr-16 text-left" aria-label={`Edit ${e.name}`}>
        <span className={cn("text-[15px] font-medium leading-snug", e.active ? "text-ink" : "text-ink-muted")}>{e.name}</span>
        {e.description && <span className="line-clamp-2 text-[12.5px] leading-snug text-ink-muted">{e.description}</span>}
        <span className="mt-auto flex items-baseline gap-1.5 pt-2">
          <span className="font-mono text-[20px] leading-none text-ink">{naira(e.priceKobo)}</span>
          <span className="text-[12px] text-ink-muted">{pricingUnit(e.pricing)}</span>
        </span>
        {e.pricing !== "PER_STAY" && e.pricing !== "PER_UNIT" && (
          <span className="text-[11.5px] text-ink-faint">
            <span className="font-mono">{naira(total)}</span> for {stay.nights} {stay.nights === 1 ? "night" : "nights"}, {stay.guests} {stay.guests === 1 ? "guest" : "guests"}
          </span>
        )}
      </button>
      <div className="absolute right-3 top-3">
        <Switch checked={e.active} disabled={!manage} onChange={onToggle} ariaLabel={`${e.name} on sale`} />
      </div>
      <footer className="flex items-center gap-2 border-t border-dashed border-line px-4 py-2 text-[11.5px] text-ink-muted">
        <ChannelDots channels={e.channels} lens="ALL" />
        <span className="min-w-0 flex-1 truncate">{notes.join(" · ")}</span>
        <Tip content="Sold in the last 30 days">
          <span className="font-mono text-ink">{e.soldLast30Days}</span>
        </Tip>
      </footer>
    </article>
  );
}

function ExtraEditor({ id, initial, onClose, stay }: { id: string | null; initial: ExtraInput; onClose: () => void; stay: { nights: number; guests: number } }) {
  const qc = useQueryClient();
  const { can } = useCan();
  const manage = can("extras.manage");
  const [d, setD] = useState<ExtraInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (p: Partial<ExtraInput>) => setD((x) => ({ ...x, ...p }));
  const av = d.availability;
  const setAv = (p: Partial<ExtraInput["availability"]>) => set({ availability: { ...av, ...p } });

  const save = useMutation({
    mutationFn: () => {
      const e: Record<string, string> = {};
      if (d.name.trim().length < 2) e.name = "Give it a name guests understand";
      if (d.priceKobo <= 0) e.price = "Set a price";
      if (d.pricing === "PER_UNIT" && !d.maxUnits) e.maxUnits = "How many can one booking take?";
      if (!d.channels.length) e.channels = "Sell it somewhere";
      setErrors(e);
      if (Object.keys(e).length) throw new Error("Check the highlighted fields");
      const body = { ...d, name: d.name.trim(), maxUnits: d.pricing === "PER_UNIT" ? d.maxUnits : null };
      return id ? extrasApi.update(id, body) : extrasApi.create(body);
    },
    onSuccess: (x) => {
      void qc.invalidateQueries({ queryKey: qk7.extras });
      toast.success(id ? `${x.name} saved` : `${x.name} is on sale`);
      onClose();
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "VALIDATION_ERROR") {
        const f = (e.details as { fields?: Record<string, string[]> })?.fields ?? {};
        setErrors(Object.fromEntries(Object.entries(f).map(([k, v]) => [k === "priceKobo" ? "price" : k, v[v.length - 1]])));
      }
    },
    meta: { errorTitle: "Extra not saved" },
  });
  const remove = useMutation({
    mutationFn: () => extrasApi.remove(id!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk7.extras });
      toast.success("Extra deleted");
      onClose();
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "EXTRA_IN_USE") toast.warning("Bookings use this extra", "Switch it off instead: it stays on those bookings and leaves the menu.");
    },
    meta: { silentCodes: ["EXTRA_IN_USE"], errorTitle: "Not deleted" },
  });

  const example = extraPrice(d.pricing, d.priceKobo, { nights: stay.nights, guests: stay.guests, units: Math.min(2, d.maxUnits ?? 2) });

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      eyebrow={id ? "Edit extra" : "New extra"}
      title={d.name || "An extra"}
      width="sm:max-w-[560px]"
      footer={
        <>
          {id && manage && (
            <Button variant="ghost" className="mr-auto text-danger" onClick={() => setConfirmDelete(true)}>
              <Trash size={14} /> Delete
            </Button>
          )}
          <Button variant="secondary" onClick={onClose} className={cn(!id && "ml-auto")}>
            Cancel
          </Button>
          {manage && (
            <Button onClick={() => save.mutate()} loading={save.isPending} data-testid="save-extra">
              {id ? "Save" : "Put it on sale"}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <Field label="Name" htmlFor="ex-name" error={errors.name}>
          <Input id="ex-name" value={d.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} placeholder="Breakfast for two" data-testid="extra-name" />
        </Field>
        <Field label="Description" htmlFor="ex-desc" optional hint={`${d.description.length} / 400`}>
          <Textarea id="ex-desc" value={d.description} maxLength={400} onChange={(e) => set({ description: e.target.value })} className="min-h-16" placeholder="Akara, yam and egg sauce or a full English, with fresh juice." />
        </Field>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-ink">Category</span>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
            {EXTRA_CATEGORIES.map((c) => (
              <button key={c.value} type="button" role="radio" aria-checked={d.category === c.value} onClick={() => set({ category: c.value as ExtraCategory })} className={cn("inline-flex h-8 items-center gap-1.5 rounded-sm border px-2.5 text-[12.5px]", d.category === c.value ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:text-ink")}>
                <CatalogIcon name={c.icon} size={13} /> {c.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-ink">What it is</span>
          <Segmented<ExtraKind>
            label="Kind"
            value={d.kind}
            onChange={(k) => set({ kind: k, category: k === "STANDARD" ? d.category : "EARLY_LATE", pricing: k === "STANDARD" ? d.pricing : "PER_STAY" })}
            options={[
              { value: "STANDARD", label: "Something extra" },
              { value: "EARLY_CHECK_IN", label: "Early check-in" },
              { value: "LATE_CHECK_OUT", label: "Late check-out" },
            ]}
          />
          {d.kind !== "STANDARD" && (
            <div className="flex items-end gap-3">
              <Field label={d.kind === "EARLY_CHECK_IN" ? "Room ready from" : "Stay until"}>
                <Input type="time" value={(d.kind === "EARLY_CHECK_IN" ? av.earlyFrom : av.lateUntil) ?? ""} onChange={(e) => setAv(d.kind === "EARLY_CHECK_IN" ? { earlyFrom: e.target.value || null } : { lateUntil: e.target.value || null })} className="w-32 font-mono" />
              </Field>
              <p className="pb-2.5 text-[12px] leading-snug text-ink-muted">Only offered when a room of that type is free the night {d.kind === "EARLY_CHECK_IN" ? "before arrival" : "of departure"}.</p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-3 rounded-md border border-line p-4">
          <span className="text-[13px] font-medium text-ink">Price</span>
          <div role="radiogroup" aria-label="How it is priced" className="grid grid-cols-1 gap-1 sm:grid-cols-2">
            {EXTRA_PRICING.map((p) => (
              <label key={p.value} className={cn("flex cursor-pointer items-center gap-2 rounded-sm border px-2.5 py-2 text-[12.5px]", d.pricing === p.value ? "border-ink bg-surface" : "border-transparent hover:bg-surface-2")}>
                <input type="radio" name="pricing" className="accent-[var(--laterite)]" checked={d.pricing === p.value} onChange={() => set({ pricing: p.value as ExtraPricing })} disabled={d.kind !== "STANDARD" && p.value !== "PER_STAY"} />
                {p.label}
              </label>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={`Price ${pricingUnit(d.pricing)}`} error={errors.price}>
              <NairaInput kobo={d.priceKobo || null} onChange={(k) => set({ priceKobo: k ?? 0 })} aria-label="Price" />
            </Field>
            {d.pricing === "PER_UNIT" && (
              <Field label="Most per booking" error={errors.maxUnits}>
                <Stepper label="units" value={d.maxUnits ?? 1} onChange={(n) => set({ maxUnits: n })} min={1} max={50} />
              </Field>
            )}
          </div>
          {d.priceKobo > 0 && (
            <p className="text-[12.5px] text-ink-muted" data-testid="extra-example">
              A {stay.nights}-night stay for {stay.guests}: <span className="font-mono text-ink">{naira(example)}</span> before tax
              {d.pricing === "PER_PERSON_PER_NIGHT" && (
                <span className="font-mono text-ink-faint">
                  {" "}
                  ({naira(d.priceKobo)} &times; {stay.guests} &times; {stay.nights})
                </span>
              )}
            </p>
          )}
          <Switch checked={d.taxable} onChange={(v) => set({ taxable: v })} label={<span className="text-[13px]">Charge tax on it</span>} description="VAT, consumption tax and service charge, as set in Taxes & charges." />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-ink">Sold on</span>
          <div className="flex flex-wrap gap-1.5">
            {(["MARKETPLACE", "BOOKING_SITE", "FRONT_DESK"] as Channel[]).map((c) => {
              const on = d.channels.includes(c);
              return (
                <button key={c} type="button" aria-pressed={on} onClick={() => set({ channels: on ? d.channels.filter((x) => x !== c) : [...d.channels, c] })} className={cn("h-8 rounded-sm border px-2.5 text-[12.5px]", on ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}>
                  {c === "MARKETPLACE" ? "Marketplace" : c === "BOOKING_SITE" ? "Booking site" : "Front desk"}
                </button>
              );
            })}
          </div>
          {errors.channels && <p className="text-[12px] text-danger">{errors.channels}</p>}
        </div>

        <details className="group rounded-md border border-line">
          <summary className="flex items-center gap-2 px-4 py-3 text-[13px] font-medium text-ink">
            <CalendarBlank size={14} /> When it can be booked
            <span className="ml-auto text-[12px] font-normal text-ink-muted">{[d.leadTimeHours ? `${d.leadTimeHours} h notice` : null, d.dailyCap ? `${d.dailyCap} a day` : null, av.daysOfWeek ? `${av.daysOfWeek.length} days a week` : null].filter(Boolean).join(" · ") || "Any time"}</span>
          </summary>
          <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
            <Field label="Notice needed" hint="Hours before arrival. The desk can still add it.">
              <div className="flex items-center gap-2">
                <Hourglass size={15} className="text-ink-muted" />
                <Stepper label="hours" value={d.leadTimeHours} onChange={(n) => set({ leadTimeHours: n })} min={0} max={168} suffix="h" />
              </div>
            </Field>
            <Field label="Most a day" optional hint="Across all bookings. Empty: no limit.">
              <Input type="number" min={1} value={d.dailyCap ?? ""} onChange={(e) => set({ dailyCap: e.target.value ? Number(e.target.value) : null })} className="w-28 font-mono" />
            </Field>
            <Field label="From" optional>
              <Input type="date" value={av.validFrom ?? ""} onChange={(e) => setAv({ validFrom: e.target.value || null })} className="font-mono" />
            </Field>
            <Field label="Until" optional>
              <Input type="date" value={av.validTo ?? ""} onChange={(e) => setAv({ validTo: e.target.value || null })} className="font-mono" />
            </Field>
            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <span className="text-[13px] font-medium text-ink">Arrival days</span>
              <div className="flex flex-wrap gap-1">
                {DAYS.map((name, i) => {
                  const list = av.daysOfWeek ?? [0, 1, 2, 3, 4, 5, 6];
                  const on = list.includes(i);
                  return (
                    <button key={name} type="button" aria-pressed={on} onClick={() => {
                      const next = on ? list.filter((x) => x !== i) : [...list, i].sort();
                      setAv({ daysOfWeek: next.length === 7 ? null : next.length ? next : list });
                    }} className={cn("h-8 w-11 rounded-sm border font-mono text-[11.5px]", on ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-faint")}>
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>
            <Field label="Shortest stay" optional>
              <div className="flex items-center gap-2">
                <Input type="number" min={1} value={av.minNights ?? ""} onChange={(e) => setAv({ minNights: e.target.value ? Number(e.target.value) : null })} className="w-24 font-mono" placeholder="1" />
                <span className="text-[12.5px] text-ink-muted">nights</span>
              </div>
            </Field>
          </div>
        </details>
        <Switch checked={d.active} onChange={(v) => set({ active: v })} label={<span className="text-[13.5px]">On sale</span>} description={<span className="inline-flex items-center gap-1"><Clock size={12} /> Switched off, it disappears from new bookings and stays on existing ones.</span>} />
      </div>
      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title={`Delete ${d.name}?`} body="If any booking has it, we'll ask you to switch it off instead." confirmLabel="Delete" danger onConfirm={() => remove.mutateAsync()} />
    </Sheet>
  );
}
