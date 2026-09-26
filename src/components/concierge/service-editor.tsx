"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { DotsSixVertical, Hourglass, Plus, Question, ShieldCheck, Trash, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useEntitlements } from "@/lib/auth";
import { conciergeApi } from "@/lib/api/endpoints-m8";
import { qk8, useConciergeAccess, useQuestionLibrary, useVendors } from "@/lib/api/hooks-m8";
import type { ConciergeService, ScreenResult, ServiceCategory, ServiceInput, ServiceQuestion, ServiceVariant } from "@/lib/api/types-m8";
import type { FieldType } from "@/lib/api/types-m7";
import { FIELD_TYPES, fieldTypeMeta } from "@/lib/m7-catalog";
import { arrayMove, useSortable } from "@/lib/use-sortable";
import { naira } from "@/lib/format";
import { openUpgrade, toast } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { AffixInput, Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Segmented } from "@/components/ui/primitives";
import { Inspector } from "@/components/form-builder/inspector";
import { CatalogIcon } from "@/components/m7/icon";
import { CATEGORIES, DAYS, FULFILLERS, LOCATIONS, PRICING, SERVICE_CHANNELS } from "./catalog";
import { DISCREET_HOLDERS, SealGlyph } from "./bits";
import { Highlight } from "./highlight";

const QUESTION_TYPES: FieldType[] = ["SELECT", "MULTI_SELECT", "SHORT_TEXT", "LONG_TEXT", "NUMBER", "YES_NO", "CHECKBOX", "DATE", "TIME"];
const MAX_QUESTIONS = 12;
const opts = (...labels: string[]) => labels.map((l, i) => ({ value: `OPTION_${i + 1}`, label: l }));

function newQuestion(label: string, type: FieldType, order: number, used: Set<string>): ServiceQuestion {
  const base = `c_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 28) || "question"}`;
  let key = base;
  for (let i = 2; used.has(key); i++) key = `${base}_${i}`;
  return {
    key,
    source: "CUSTOM",
    libraryKey: null,
    recommended: false,
    type,
    label,
    helpText: null,
    placeholder: null,
    required: "OPTIONAL",
    options: fieldTypeMeta(type).hasOptions ? opts("Option 1", "Option 2") : [],
    validation: type === "NUMBER" ? { min: 1, max: 20 } : {},
    section: "About the request",
    order,
    channels: ["MARKETPLACE", "BOOKING_SITE", "FRONT_DESK"],
    condition: null,
    purpose: null,
    guestPurpose: null,
    sensitive: false,
  };
}

export const EMPTY_SERVICE: ServiceInput = {
  name: "",
  description: "",
  category: "WELLNESS",
  imageUrl: null,
  pricing: "FIXED",
  priceKobo: null,
  variants: [],
  durationMinutes: 60,
  leadTimeHours: 2,
  availability: { days: [0, 1, 2, 3, 4, 5, 6], from: "09:00", to: "21:00" },
  requiresSlot: true,
  slotCapacity: 1,
  location: "IN_ROOM",
  fulfilledBy: "STAFF",
  vendorId: null,
  discreetEligible: false,
  questions: [],
  taxable: true,
  channels: ["BOOKING_FLOW", "TRIP_PAGE", "FRONT_DESK"],
  active: true,
};

export function toInput(s: ConciergeService): ServiceInput {
  return {
    name: s.name,
    description: s.description,
    category: s.category,
    imageUrl: s.imageUrl,
    pricing: s.pricing,
    priceKobo: s.priceKobo,
    variants: s.variants,
    durationMinutes: s.durationMinutes,
    leadTimeHours: s.leadTimeHours,
    availability: s.availability,
    requiresSlot: s.requiresSlot,
    slotCapacity: s.slotCapacity,
    location: s.location,
    fulfilledBy: s.fulfilledBy,
    vendorId: s.vendor?.id ?? null,
    discreetEligible: s.discreetEligible,
    questions: s.questions,
    taxable: s.taxable,
    channels: s.channels,
    active: s.active,
  };
}

const naira2 = (k: number | null) => (k == null ? "" : String(k / 100));
const kobo = (s: string) => (s.trim() === "" ? null : Math.round(Number(s.replace(/[^\d.]/g, "")) * 100));

/** The screen, as you type: the same check the server runs on save (API-M8 3.3). */
function useLiveScreen(texts: string[], enabled: boolean) {
  const [res, setRes] = useState<ScreenResult | null>(null);
  const key = JSON.stringify(texts);
  useEffect(() => {
    if (!enabled) return;
    const id = window.setTimeout(() => {
      conciergeApi
        .screen(JSON.parse(key) as string[])
        .then(setRes)
        .catch(() => setRes(null));
    }, 600);
    return () => window.clearTimeout(id);
  }, [key, enabled]);
  return enabled ? res : null;
}

/**
 * The service editor: the service on the left; on the right, what guests are asked, built with the
 * booking form's own inspector.
 */
export function ServiceEditor({ service, onClose }: { service: ConciergeService | null; onClose: () => void }) {
  const qc = useQueryClient();
  const access = useConciergeAccess();
  const vendors = useVendors();
  const library = useQuestionLibrary();
  const { has } = useEntitlements();
  const [d, setD] = useState<ServiceInput>(() => (service ? toInput(service) : EMPTY_SERVICE));
  const [price, setPrice] = useState(() => naira2(service?.priceKobo ?? null));
  const [sel, setSel] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState(false);
  const set = (p: Partial<ServiceInput>) => setD((x) => ({ ...x, ...p }));
  const qs = d.questions;
  const selected = qs.find((f) => f.key === sel) ?? null;
  const used = useMemo(() => new Set(qs.map((f) => f.key)), [qs]);
  const sort = useSortable({ count: qs.length, onMove: (a, b) => set({ questions: arrayMove(qs, a, b).map((f, i) => ({ ...f, order: i })) }) });
  const editable = access.catalogue;
  const screen = useLiveScreen([d.name, d.description, ...d.variants.map((v) => v.name), ...qs.flatMap((q) => [q.label, q.helpText ?? "", ...q.options.map((o) => o.label)])], editable && (d.name.length > 2 || d.description.length > 2));
  const av = d.availability ?? { days: [0, 1, 2, 3, 4, 5, 6], from: "00:00", to: "23:59" };

  const save = useMutation({
    mutationFn: () => {
      const body: ServiceInput = {
        ...d,
        name: d.name.trim(),
        description: d.description.trim(),
        priceKobo: d.pricing === "FREE" ? null : kobo(price),
        vendorId: d.fulfilledBy === "VENDOR" ? d.vendorId : null,
        questions: qs.map((f, i) => ({ ...f, order: i })),
        slotCapacity: d.requiresSlot ? d.slotCapacity : null,
      };
      return service ? conciergeApi.updateService(service.id, body) : conciergeApi.createService(body);
    },
    onSuccess: async (s) => {
      await qc.invalidateQueries({ queryKey: qk8.services });
      if (s.reviewStatus === "PENDING_REVIEW") toast.warning("Saved, waiting for review", "Something in the wording needs a look from our trust team. Guests won't see it until then.");
      else toast.success(service ? "Service saved" : "Service added", s.guestVisible ? "Guests can ask for it now." : "Saved. It isn't shown to guests yet.");
      for (const w of s.warnings ?? []) toast.warning("Check a question", w.message);
      onClose();
    },
    meta: { errorTitle: "Service not saved" },
  });
  const remove = useMutation({
    mutationFn: () => conciergeApi.removeService(service!.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk8.services });
      toast.success("Service removed");
      onClose();
    },
    meta: { errorTitle: "Not removed" },
  });

  const addQuestion = (q: ServiceQuestion) => {
    if (qs.length >= MAX_QUESTIONS) return;
    let key = q.key || "c_question";
    for (let i = 2; used.has(key); i++) key = `${q.key}_${i}`;
    const f = { ...q, key, source: "CUSTOM" as const, order: qs.length };
    set({ questions: [...qs, f] });
    setSel(f.key);
    setAdding(false);
  };
  const setVariant = (i: number, p: Partial<ServiceVariant>) => set({ variants: d.variants.map((v, j) => (j === i ? { ...v, ...p } : v)) });

  const needsPrice = d.pricing !== "FREE" && d.pricing !== "FROM" && !d.variants.length;
  const canSave = editable && d.name.trim().length >= 2 && (d.fulfilledBy === "STAFF" || !!d.vendorId) && (!needsPrice || (kobo(price) ?? 0) > 0) && d.variants.every((v) => v.name.trim() && v.priceKobo > 0);
  const flagged = service && service.reviewStatus !== "LIVE" ? service.review.flaggedTerms : [];

  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      eyebrow="Concierge catalogue"
      title={service ? service.name : "New service"}
      description="Guests see the name, description, price and questions. Everything is checked against the acceptable-use policy when you save."
      className="max-w-[1100px]"
      footer={
        editable ? (
          <>
            {service && (
              <Button variant="ghost" className="mr-auto hover:text-danger" onClick={() => setRemoving(true)}>
                <Trash size={14} /> Remove
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!canSave} data-testid="save-service">
              {service ? "Save service" : "Add service"}
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" data-testid="service-editor">
        <fieldset disabled={!editable} className="flex min-w-0 flex-col gap-4">
          {service && service.reviewStatus !== "LIVE" && (
            <div className="flex gap-2.5 rounded-md border border-[color-mix(in_oklab,var(--ochre)_45%,transparent)] bg-ochre-wash/50 px-3 py-2.5 text-[12.5px] leading-snug text-ink">
              <Hourglass size={16} weight="duotone" className="mt-px shrink-0 text-ochre" />
              <div>
                <p className="font-medium">{service.reviewStatus === "PENDING_REVIEW" ? "Waiting for our trust team" : service.reviewStatus === "REJECTED" ? "Not approved" : "Hidden by the platform"}</p>
                <p className="text-ink-muted">
                  {service.review.reason ? <>&ldquo;{service.review.reason}&rdquo; </> : null}
                  Hidden from guests. Saving sends it to be checked again.
                </p>
              </div>
            </div>
          )}
          <Field label="Name" htmlFor="svc-name">
            <Input id="svc-name" value={d.name} maxLength={80} onChange={(e) => set({ name: e.target.value })} placeholder="In-room massage" data-testid="svc-name" />
          </Field>
          <Field label="Description" htmlFor="svc-desc" hint="Plain words: what happens, who does it, how long.">
            <Textarea id="svc-desc" className="min-h-20" value={d.description} maxLength={600} onChange={(e) => set({ description: e.target.value })} placeholder="A licensed therapist brings the table and oils to your room." data-testid="svc-desc" />
          </Field>
          {(screen?.flagged || flagged.length > 0) && (
            <div className="-mt-1 rounded-md border border-[color-mix(in_oklab,var(--ochre)_45%,transparent)] bg-ochre-wash/40 px-3 py-2.5 text-[12.5px] leading-snug text-ink" data-testid="screen-warning">
              <p className="font-medium">This will wait for review before guests see it.</p>
              <p className="mt-0.5 text-ink-muted">
                {screen?.matches.length ? (
                  <>
                    Caught:{" "}
                    {screen.matches.map((m, i) => (
                      <span key={i}>
                        {i > 0 && ", "}&ldquo;<Highlight text={m.excerpt} terms={[m.term]} />&rdquo;
                      </span>
                    ))}
                    .
                  </>
                ) : (
                  <>Caught: {flagged.join(", ")}.</>
                )}{" "}
                If the service is lawful, reword it, or save it and our team will look at it.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink">Category</span>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label="Category">
              {CATEGORIES.map((c) => {
                const I = c.icon;
                const on = d.category === c.value;
                return (
                  <button key={c.value} type="button" role="radio" aria-checked={on} onClick={() => set({ category: c.value as ServiceCategory })} title={c.hint} data-testid={`cat-${c.value}`} className={cn("flex h-9 items-center gap-2 rounded-sm border px-2.5 text-left text-[12.5px]", on ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:text-ink")}>
                    <I size={14} weight={on ? "fill" : "duotone"} className="shrink-0" />
                    <span className="truncate">{c.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink">Price</span>
            <Segmented label="Pricing" size="sm" value={d.pricing} onChange={(v) => set({ pricing: v })} options={PRICING.map((p) => ({ value: p.value, label: p.label }))} />
            <p className="text-[12px] text-ink-muted">{PRICING.find((p) => p.value === d.pricing)?.hint}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {d.pricing !== "FREE" && (
              <Field label={d.pricing === "FROM" ? "From" : d.pricing === "PER_HOUR" ? "An hour" : d.pricing === "PER_PERSON" ? "A person" : "Price"} htmlFor="svc-price" optional={d.pricing === "FROM" || d.variants.length > 0}>
                <AffixInput id="svc-price" prefix="₦" inputMode="decimal" className="font-mono" value={price} onChange={(e) => setPrice(e.target.value)} data-testid="svc-price" />
              </Field>
            )}
            <Field label="Takes" htmlFor="svc-dur" optional>
              <AffixInput id="svc-dur" suffix="min" inputMode="numeric" className="font-mono" value={d.durationMinutes ?? ""} onChange={(e) => set({ durationMinutes: e.target.value ? Number(e.target.value) : null })} />
            </Field>
            <Field label="Notice" htmlFor="svc-lead">
              <AffixInput id="svc-lead" suffix="hours" inputMode="numeric" className="font-mono" value={d.leadTimeHours} onChange={(e) => set({ leadTimeHours: Number(e.target.value) || 0 })} />
            </Field>
            <div className="flex items-end pb-2">
              <Switch checked={d.taxable} onChange={(v) => set({ taxable: v })} label={<span className="text-[13px]">Our taxes apply</span>} />
            </div>
          </div>

          {d.pricing !== "FREE" && (
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink">
                Options <span className="font-normal text-ink-faint">optional, such as 60 or 90 minutes, half or full day</span>
              </span>
              {d.variants.map((v, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_110px_90px_32px] items-center gap-1.5">
                  <Input aria-label="Option name" value={v.name} maxLength={40} onChange={(e) => setVariant(i, { name: e.target.value })} placeholder="90 minutes" />
                  <AffixInput aria-label="Option price" prefix="₦" className="font-mono" inputMode="decimal" value={naira2(v.priceKobo)} onChange={(e) => setVariant(i, { priceKobo: kobo(e.target.value) ?? 0 })} />
                  <AffixInput aria-label="Option minutes" suffix="min" className="font-mono" inputMode="numeric" value={v.durationMinutes ?? ""} onChange={(e) => setVariant(i, { durationMinutes: e.target.value ? Number(e.target.value) : null })} />
                  <button type="button" onClick={() => set({ variants: d.variants.filter((_, j) => j !== i) })} aria-label={`Remove ${v.name || "option"}`} className="grid h-9 w-8 place-items-center text-ink-faint hover:text-danger">
                    <X size={13} />
                  </button>
                </div>
              ))}
              {d.variants.length < 10 && (
                <Button size="sm" variant="ghost" className="self-start" onClick={() => set({ variants: [...d.variants, { name: "", priceKobo: kobo(price) ?? 0, durationMinutes: d.durationMinutes }] })}>
                  <Plus size={13} /> Add an option
                </Button>
              )}
              {d.variants.length > 0 && (
                <p className="text-[11.5px] text-ink-muted">
                  Guests pick one: {d.variants.filter((v) => v.name).map((v) => `${v.name} ${naira(v.priceKobo)}`).join(", ")}.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink">When it&rsquo;s offered</span>
            <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Days">
              {DAYS.map((day, i) => {
                const on = av.days.includes(i);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      const next = on ? av.days.filter((x) => x !== i) : [...av.days, i].sort();
                      if (next.length) set({ availability: { ...av, days: next } });
                    }}
                    className={cn("h-8 w-11 rounded-sm border font-mono text-[11.5px]", on ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[13px] text-ink-muted">
              from
              <Input type="time" aria-label="From" className="w-[120px] font-mono" value={av.from} onChange={(e) => set({ availability: { ...av, from: e.target.value || "00:00" } })} />
              to
              <Input type="time" aria-label="To" className="w-[120px] font-mono" value={av.to} onChange={(e) => set({ availability: { ...av, to: e.target.value || "23:59" } })} />
            </div>
            <Switch checked={d.requiresSlot} onChange={(v) => set({ requiresSlot: v, slotCapacity: v ? (d.slotCapacity ?? 1) : null })} label={<span className="text-[13px]">Guests pick a start time</span>} description="Off for things like express laundry that only need a day." />
            {d.requiresSlot && (
              <Field label="At the same time" htmlFor="svc-cap" hint="How many requests one slot can take (therapists, cars).">
                <AffixInput id="svc-cap" suffix="at once" inputMode="numeric" className="w-40 font-mono" value={d.slotCapacity ?? ""} onChange={(e) => set({ slotCapacity: e.target.value ? Number(e.target.value) : null })} />
              </Field>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink">Where</span>
              <Segmented label="Where" size="sm" value={d.location} onChange={(v) => set({ location: v })} options={LOCATIONS} />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink">Done by</span>
              <Segmented label="Done by" size="sm" value={d.fulfilledBy} onChange={(v) => set({ fulfilledBy: v })} options={FULFILLERS} />
            </div>
          </div>
          {d.fulfilledBy === "VENDOR" && (
            <Field label="Vendor" htmlFor="svc-vendor" hint={vendors.data && !vendors.data.length ? "Add vendors in the Vendors tab first." : "Their contact details are never shown to guests."}>
              <Select id="svc-vendor" value={d.vendorId ?? ""} onChange={(e) => set({ vendorId: e.target.value || null })} data-testid="svc-vendor">
                <option value="">Choose a vendor</option>
                {(vendors.data ?? [])
                  .filter((v) => v.active)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
              </Select>
            </Field>
          )}

          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink">Offered</span>
            <div className="flex flex-wrap gap-1.5">
              {SERVICE_CHANNELS.map((c) => {
                const on = d.channels.includes(c.value);
                return (
                  <button key={c.value} type="button" aria-pressed={on} title={c.hint} disabled={on && d.channels.length === 1} onClick={() => set({ channels: on ? d.channels.filter((x) => x !== c.value) : [...d.channels, c.value] })} className={cn("h-8 rounded-sm border px-2.5 text-[12.5px]", on ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:text-ink")}>
                    {c.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={cn("rounded-md border px-4 py-3", d.discreetEligible ? "border-[color-mix(in_oklab,var(--brass)_45%,transparent)] bg-brass-wash/40" : "border-line")}>
            <Switch
              checked={d.discreetEligible}
              onChange={(v) => set({ discreetEligible: v })}
              label={
                <span className="inline-flex items-center gap-1.5 text-[13.5px]">
                  <SealGlyph size={14} className="text-brass" /> Guests may ask privately
                </span>
              }
              description={`A private request is seen only by ${DISCREET_HOLDERS}, and the bill uses your neutral wording.`}
            />
          </div>
          <Switch checked={d.active} onChange={(v) => set({ active: v })} label={<span className="text-[13.5px]">Offered to guests</span>} />
        </fieldset>

        <div className="flex min-w-0 flex-col gap-3 lg:border-l lg:border-line lg:pl-6">
          <div className="flex items-baseline gap-2">
            <h3 className="display-sm flex-1 text-[18px] text-ink">What guests are asked</h3>
            <span className="font-mono text-[12px] text-ink-muted">
              {qs.length}/{MAX_QUESTIONS}
            </span>
          </div>
          <p className="-mt-1 text-[12.5px] text-ink-muted">Time, party size and a note are always asked. Add only what you need to get it right.</p>
          <ol ref={(el) => sort.bindList(el)} className="flex flex-col gap-1.5" data-testid="service-questions">
            {qs.map((f, i) => (
              <li key={f.key} data-sort-row style={sort.rowStyle(i)} className={cn("flex items-center gap-1 rounded-md border bg-surface", sel === f.key ? "border-ink" : "border-line")}>
                <button type="button" {...sort.handle(i)} aria-label={`Move ${f.label}`} className="grid h-10 w-6 shrink-0 cursor-grab place-items-center text-ink-faint hover:text-ink">
                  <DotsSixVertical size={13} weight="bold" />
                </button>
                <button type="button" onClick={() => setSel(sel === f.key ? null : f.key)} className="flex min-w-0 flex-1 items-center gap-2 py-2 text-left" data-testid="question-row">
                  <CatalogIcon name={fieldTypeMeta(f.type).icon} size={15} className="shrink-0 text-ink-muted" />
                  <span className="truncate text-[13px] text-ink">{f.label}</span>
                  {f.required === "REQUIRED" && <span className="text-[11px] text-laterite">required</span>}
                  {f.condition && <span className="text-[11px] text-adire">conditional</span>}
                </button>
                {editable && (
                  <button
                    type="button"
                    onClick={() => {
                      set({ questions: qs.filter((x) => x.key !== f.key) });
                      if (sel === f.key) setSel(null);
                    }}
                    aria-label={`Remove ${f.label}`}
                    className="grid h-10 w-9 shrink-0 place-items-center text-ink-faint hover:text-danger"
                  >
                    <Trash size={14} />
                  </button>
                )}
              </li>
            ))}
            {!qs.length && (
              <li className="flex items-center gap-2 rounded-md border border-dashed border-line-strong px-3 py-4 text-[12.5px] text-ink-muted">
                <Question size={16} className="text-ink-faint" /> No extra questions.
              </li>
            )}
          </ol>
          {editable &&
            (adding ? (
              <div className="rounded-md border border-line bg-surface-2/40 p-3" data-testid="add-question-panel">
                <div className="mb-2 flex items-center">
                  <p className="eyebrow flex-1">Ready-made</p>
                  <button type="button" onClick={() => setAdding(false)} aria-label="Close" className="text-ink-faint hover:text-ink">
                    <X size={14} />
                  </button>
                </div>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {(library.data ?? [])
                    .filter((s) => !qs.some((q) => q.label === s.label))
                    .map((s) => (
                      <button key={s.key} type="button" onClick={() => addQuestion(s)} className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-line-strong bg-surface px-2.5 text-[12.5px] text-ink hover:border-ink-faint" data-testid="suggested-question">
                        <Plus size={11} /> {s.label}
                      </button>
                    ))}
                </div>
                <p className="eyebrow mb-2">Your own, by kind of answer</p>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {FIELD_TYPES.filter((t) => QUESTION_TYPES.includes(t.type)).map((t) => (
                    <button key={t.type} type="button" onClick={() => addQuestion(newQuestion(t.label, t.type, qs.length, used))} className="flex h-9 items-center gap-1.5 rounded-sm border border-line-strong bg-surface px-2 text-[12px] text-ink hover:border-ink-faint">
                      <CatalogIcon name={t.icon} size={13} className="text-ink-muted" /> {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <Button size="sm" variant="secondary" className="self-start" onClick={() => setAdding(true)} disabled={qs.length >= MAX_QUESTIONS} data-testid="add-question">
                <Plus size={13} /> Add a question
              </Button>
            ))}
          {selected && (
            <div className="mt-1 overflow-hidden rounded-md border border-line">
              <Inspector
                field={selected}
                fields={qs}
                onChange={(p) => set({ questions: qs.map((f) => (f.key === selected.key ? { ...f, ...p } : f)) })}
                onRemove={() => {
                  set({ questions: qs.filter((x) => x.key !== selected.key) });
                  setSel(null);
                }}
                canConditions={has("form_conditional_logic")}
                canFiles={false}
                onLocked={(feature) => openUpgrade({ kind: "feature", feature, requiredPlan: "growth" })}
                pickupPoints={undefined}
                editable={editable}
                context="service"
              />
            </div>
          )}
          <p className="mt-auto flex items-start gap-2 pt-3 text-[12px] leading-snug text-ink-muted">
            <ShieldCheck size={15} weight="duotone" className="mt-px shrink-0 text-palm" />
            Checked against the acceptable-use policy when you save. Most services go live at once; anything that needs a look waits, hidden from guests, for our trust team.
          </p>
        </div>
      </div>
      <ConfirmDialog open={removing} onOpenChange={setRemoving} title={`Remove ${service?.name ?? "this service"}?`} body="If guests have asked for it, switch it off instead; past requests keep their record." confirmLabel="Remove service" danger onConfirm={() => remove.mutateAsync()} />
    </Dialog>
  );
}
