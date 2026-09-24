"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bank, Check, CheckCircle, Circle, Clock, LockSimple, Minus, Rocket, Scroll } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useEntitlements } from "@/lib/auth";
import { hotelApi } from "@/lib/api/endpoints";
import { qk, useProperty, useRoomTypes } from "@/lib/api/hooks";
import { formApi, setupApi, siteApi } from "@/lib/api/endpoints-m7";
import { qk7, useBookingForm, useExtras, useFormPresets, usePickupPoints, usePreviewToken, useSetup, useSiteTheme } from "@/lib/api/hooks-m7";
import type { SetupProgress, SetupStep, SetupStepKey } from "@/lib/api/types-m7";
import { isApiError } from "@/lib/api/client";
import { PLAN_NAMES } from "@/lib/catalog";
import { PRESETS, templateMeta, type TemplateId } from "@/lib/m7-catalog";
import { formatDate, naira } from "@/lib/format";
import { toast } from "@/lib/store";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/form";
import { ErrorState, PageHeader, Panel, PlanPlate, Skeleton } from "@/components/ui/primitives";
import { NairaInput, Stepper } from "@/components/m2/bits";
import { CatalogIcon } from "@/components/m7/icon";
import { ColourPicker, TemplateGallery } from "@/components/studio/panels";

function Ring({ pct, size = 56 }: { pct: number; size?: number }) {
  const r = size / 2 - 4;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${pct}% set up`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--laterite)" strokeWidth={4} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: "stroke-dashoffset 400ms ease-out" }} />
      <text x="50%" y="53%" dominantBaseline="middle" textAnchor="middle" className="fill-ink font-mono text-[13px]">
        {pct}%
      </text>
    </svg>
  );
}

function StepMark({ s, current }: { s: SetupStep; current: boolean }) {
  if (s.status === "DONE") return <CheckCircle size={20} weight="fill" className="text-palm" />;
  if (s.status === "SKIPPED") return <span className="grid h-5 w-5 place-items-center rounded-full border border-line-strong text-ink-faint"><Minus size={10} weight="bold" /></span>;
  if (s.status === "LOCKED") return <span className="grid h-5 w-5 place-items-center rounded-full border border-[color-mix(in_oklab,var(--brass)_45%,transparent)] text-brass"><LockSimple size={10} weight="bold" /></span>;
  return <Circle size={20} weight={current ? "duotone" : "regular"} className={current ? "text-laterite" : "text-ink-faint"} />;
}

export function SetupView() {
  const q = useSetup();
  const [open, setOpen] = useState<SetupStepKey | null>(null);
  const qc = useQueryClient();
  useEffect(() => {
    // open the first step still to do, once
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial step from the saved progress
    if (q.data && !open) setOpen(q.data.currentStep ?? "go_live");
  }, [q.data, open]);
  const save = (s: SetupProgress) => qc.setQueryData(qk7.setup, s);
  const mark = useMutation({
    mutationFn: (v: { key: SetupStepKey; status: "DONE" | "SKIPPED" | "TODO" }) => setupApi.step(v.key, v.status),
    onSuccess: (s, v) => {
      save(s);
      if (v.status !== "TODO") setOpen(s.currentStep ?? "go_live");
      void qc.invalidateQueries({ queryKey: ["dashboard"] });
    },
    meta: { errorTitle: "Progress not saved" },
  });

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data || !open)
    return (
      <>
        <PageHeader eyebrow="Setup" title={<Skeleton className="h-11 w-80" />} />
        <Skeleton className="h-[480px]" />
      </>
    );
  const p = q.data;
  const step = p.steps.find((s) => s.key === open)!;
  const idx = p.steps.findIndex((s) => s.key === open);
  const next = () => {
    const n = p.steps.slice(idx + 1).find((s) => s.status === "TODO") ?? p.steps.find((s) => s.status === "TODO");
    setOpen(n?.key ?? "go_live");
  };
  const done = () => (step.status === "DONE" ? next() : mark.mutate({ key: step.key, status: "DONE" }));

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Rocket size={14} weight="duotone" /> Setup
          </>
        }
        title={
          p.completedAt ? (
            <>
              You&rsquo;re <em>open for bookings</em>.
            </>
          ) : (
            <>
              Ready to take bookings <em>in eight steps</em>.
            </>
          )
        }
        description="Each step is saved as you go; come back to it any time from Today or the sidebar. Only rooms and going live can't be skipped."
      />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
        <Panel as="aside" className="self-start" aria-label="Steps">
          <div className="flex items-center gap-4 border-b border-line px-5 py-4">
            <Ring pct={p.progressPct} />
            <div>
              <p className="text-[14px] font-medium text-ink" data-testid="setup-progress">{p.steps.filter((s) => s.status === "DONE" || s.status === "SKIPPED").length} of 8 done</p>
              <p className={cn("text-[12px]", p.canTakeBookings ? "text-palm" : "text-ink-muted")}>{p.canTakeBookings ? "You can take bookings" : "Rooms first, then bookings"}</p>
            </div>
          </div>
          <ol className="flex flex-col p-2" data-testid="setup-steps">
            {p.steps.map((s) => (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => setOpen(s.key)}
                  aria-current={open === s.key ? "step" : undefined}
                  data-step={s.key}
                  data-status={s.status}
                  className={cn("flex w-full items-start gap-3 rounded-md px-3 py-2.5 text-left transition-colors", open === s.key ? "bg-surface-2" : "hover:bg-surface-2/60")}
                >
                  <span className="mt-0.5">
                    <StepMark s={s} current={p.currentStep === s.key} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-[10.5px] text-ink-faint">{String(s.order + 1).padStart(2, "0")}</span>
                      <span className={cn("truncate text-[13.5px]", s.status === "DONE" || s.status === "SKIPPED" ? "text-ink-muted" : "font-medium text-ink")}>{s.title}</span>
                    </span>
                    {s.summary && <span className="block truncate pl-6 text-[11.5px] text-ink-faint">{s.summary}</span>}
                    {s.status === "SKIPPED" && !s.summary && <span className="block pl-6 text-[11.5px] text-ink-faint">Skipped for now</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </Panel>

        <Panel className="self-start overflow-hidden" data-testid={`setup-step-${step.key}`}>
          <header className="flex flex-wrap items-start gap-3 border-b border-line px-6 py-5">
            <div className="min-w-0 flex-1">
              <p className="eyebrow mb-1">
                Step {step.order + 1} of 8 {step.required && <span className="text-laterite">&middot; needed to take bookings</span>}
              </p>
              <h2 className="display-sm text-[24px] leading-tight text-ink">{step.title}</h2>
              {step.description && <p className="mt-1 max-w-xl text-[13.5px] text-ink-muted">{step.description}</p>}
            </div>
            {step.status === "DONE" && (
              <span className="inline-flex items-center gap-1.5 text-[12.5px] text-palm">
                <Check size={14} weight="bold" /> {step.detected ? "Done: we found it set up" : "Done"}
              </span>
            )}
          </header>
          <div className="px-6 py-6">
            {step.status === "LOCKED" ? (
              <LockedStep step={step} />
            ) : (
              <StepBody k={step.key} progress={p} onSaved={save} />
            )}
          </div>
          {step.key !== "go_live" && step.status !== "LOCKED" && (
            <footer className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/40 px-6 py-3.5">
              {step.skippable && step.status === "TODO" && (
                <Button variant="ghost" onClick={() => mark.mutate({ key: step.key, status: "SKIPPED" })} data-testid="skip-step">
                  Skip for now
                </Button>
              )}
              {step.status !== "TODO" && (
                <Button variant="ghost" onClick={() => mark.mutate({ key: step.key, status: "TODO" })}>
                  Reopen this step
                </Button>
              )}
              <Button className="ml-auto" loading={mark.isPending} onClick={done} data-testid="step-done">
                {step.status === "DONE" ? "Next step" : "Done, next step"} <ArrowRight size={14} weight="bold" />
              </Button>
            </footer>
          )}
          {step.status === "LOCKED" && (
            <footer className="flex justify-end border-t border-line bg-surface-2/40 px-6 py-3.5">
              <Button variant="secondary" onClick={next}>
                Next step <ArrowRight size={14} weight="bold" />
              </Button>
            </footer>
          )}
        </Panel>
      </div>
    </>
  );
}

function LockedStep({ step }: { step: SetupStep }) {
  const plan = { code: step.requiredPlan ?? "growth", name: PLAN_NAMES[step.requiredPlan ?? "growth"] ?? "Growth" };
  return (
    <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_240px]">
      <div className="pointer-events-none select-none opacity-60" aria-hidden>
        <ul className="flex flex-col gap-2">
          {[
            ["Coffee", "Breakfast for two", "₦12,000 a night"],
            ["Clock", "Late check-out (until 16:00)", "₦15,000 per stay"],
            ["Bus", "Pickup from Jibowu Motor Park", "₦20,000 one way"],
            ["AirplaneLanding", "Pickup from MMIA", "₦35,000 one way"],
          ].map(([i, n, pr]) => (
            <li key={n} className="flex items-center gap-3 rounded-md border border-line px-3 py-2.5 text-[13px]">
              <CatalogIcon name={i} size={15} className="text-ink-muted" />
              <span className="flex-1 text-ink">{n}</span>
              <span className="font-mono text-ink-muted">{pr}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col items-start gap-3 rounded-md border border-dashed border-[color-mix(in_oklab,var(--brass)_55%,transparent)] bg-brass-wash/50 p-4">
        <PlanPlate name={plan.name} code={plan.code} />
        <p className="text-[13px] leading-snug text-ink">Sell breakfast, late check-out and pickups from airports and motor parks with every booking.</p>
        <ButtonLink href={`/billing?plan=${plan.code}#plans`} size="sm">
          See {plan.name}
        </ButtonLink>
      </div>
    </div>
  );
}

function StepBody({ k, progress, onSaved }: { k: SetupStepKey; progress: SetupProgress; onSaved: (s: SetupProgress) => void }) {
  switch (k) {
    case "hotel_type":
      return <HotelTypeStep current={progress.hotelType} onSaved={onSaved} />;
    case "brand":
      return <BrandStep />;
    case "rooms":
      return <RoomsStep />;
    case "booking_form":
      return <FormStep />;
    case "extras":
      return <ExtrasStep />;
    case "payments":
      return (
        <LinkStep icon={<Bank size={22} weight="duotone" />} title="Where online payments go" body="Choose the bank account Paystack pays into. We check the account name with the bank before saving it." href="/payouts" cta="Set up the payout account" />
      );
    case "policies":
      return <PoliciesStep />;
    case "go_live":
      return <GoLiveStep progress={progress} onSaved={onSaved} />;
  }
}

function HotelTypeStep({ current, onSaved }: { current: string | null; onSaved: (s: SetupProgress) => void }) {
  const presets = useFormPresets();
  const [applyTemplate, setApplyTemplate] = useState(true);
  const qc = useQueryClient();
  const pick = useMutation({
    mutationFn: (id: string) => setupApi.hotelType(id, { applyFormPreset: true, applyTemplate }),
    onSuccess: (s) => {
      onSaved(s);
      void qc.invalidateQueries({ queryKey: qk7.form });
      void qc.invalidateQueries({ queryKey: qk7.theme });
      toast.success("Saved", "The booking form and site are set up to match. Change anything later.");
    },
    meta: { errorTitle: "Not saved" },
  });
  const list = PRESETS.map((p) => ({ ...p, api: presets.data?.find((x) => x.id === p.id) }));
  return (
    <div className="flex flex-col gap-5">
      <div role="radiogroup" aria-label="Kind of place" className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((p) => {
          const on = current === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              disabled={pick.isPending}
              onClick={() => pick.mutate(p.id)}
              data-testid={`preset-${p.id}`}
              className={cn("flex items-start gap-3 rounded-md border p-3.5 text-left transition-colors", on ? "border-ink bg-surface shadow-[0_0_0_1px_var(--ink)]" : "border-line hover:border-line-strong")}
            >
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-md border", on ? "border-laterite bg-laterite-wash text-laterite" : "border-line text-ink-muted")}>
                <CatalogIcon name={p.icon} size={18} weight="duotone" />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-medium text-ink">{p.name}</span>
                <span className="block text-[12px] leading-snug text-ink-muted">{p.hint}</span>
                {p.api?.suggestedTemplateId && <span className="mt-1 block font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint">{templateMeta(p.api.suggestedTemplateId).name} template</span>}
              </span>
            </button>
          );
        })}
      </div>
      <Switch checked={applyTemplate} onChange={setApplyTemplate} label={<span className="text-[13px]">Also switch the booking site to the matching template</span>} description="Only if your plan includes it. Nothing goes live until the last step." />
    </div>
  );
}

function BrandStep() {
  const theme = useSiteTheme();
  const qc = useQueryClient();
  const saveDraft = useMutation({
    mutationFn: siteApi.saveDraft,
    onSuccess: (s) => qc.setQueryData(qk7.theme, s),
    meta: { errorTitle: "Not saved" },
  });
  const [primary, setPrimary] = useState<string | null>(null);
  useEffect(() => {
    if (!primary || !theme.data || primary === theme.data.draft.brand.primary) return;
    const id = window.setTimeout(() => saveDraft.mutate({ brand: { primary } }), 600);
    return () => window.clearTimeout(id);
  }, [primary, theme.data, saveDraft]);
  if (!theme.data) return <Skeleton className="h-64" />;
  const d = theme.data.draft;
  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
      <div className="flex flex-col gap-4">
        <ColourPicker label="Your colour" role="primary" value={primary ?? d.brand.primary} onChange={setPrimary} testId="setup-primary" />
        <p className="text-[12.5px] text-ink-muted">
          Logo, a second colour, fonts and sections are in the{" "}
          <Link href="/site#brand" className="font-medium text-laterite hover:underline">
            Brand Studio
          </Link>
          .
        </p>
      </div>
      <TemplateGallery
        value={d.templateId}
        published={theme.data.published?.templateId}
        primary={primary ?? d.brand.primary}
        secondary={d.brand.secondary ?? "#B98A2E"}
        isAvailable={(id) => theme.data!.gates.templates.find((t) => t.id === id)?.available ?? templateMeta(id).starter}
        lockPlan={{ code: theme.data.gates.requiredPlans.site_templates_all ?? "growth", name: PLAN_NAMES[theme.data.gates.requiredPlans.site_templates_all ?? "growth"] ?? "Growth" }}
        onPick={(id: TemplateId) => saveDraft.mutate({ templateId: id, resetSections: true })}
        onLocked={() => toast.info("That template is on a higher plan", "Editorial and Essentials are on every plan.")}
      />
    </div>
  );
}

function RoomsStep() {
  const types = useRoomTypes();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | null>(null);
  const [cap, setCap] = useState(2);
  const [bulk, setBulk] = useState({ typeId: "", floor: 1, from: 101, to: 110 });
  const addType = useMutation({
    mutationFn: () => hotelApi.createRoomType({ name: name.trim(), basePriceKobo: price ?? 0, capacity: cap }),
    onSuccess: (t) => {
      void qc.invalidateQueries({ queryKey: qk.roomTypes });
      void qc.invalidateQueries({ queryKey: qk7.setup });
      setName("");
      setPrice(null);
      setBulk((b) => ({ ...b, typeId: t.id }));
      toast.success(`${t.name} added`);
    },
    meta: { errorTitle: "Room type not added" },
  });
  const addRooms = useMutation({
    mutationFn: () => hotelApi.bulkRooms({ roomTypeId: bulk.typeId, floor: bulk.floor, from: bulk.from, to: bulk.to }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.rooms({}) });
      void qc.invalidateQueries({ queryKey: qk.roomTypes });
      void qc.invalidateQueries({ queryKey: qk7.setup });
      toast.success(`Rooms ${bulk.from} to ${bulk.to} added`);
    },
    meta: { errorTitle: "Rooms not added" },
  });
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="flex flex-col gap-3">
        <p className="eyebrow">Room types</p>
        {types.data?.length ? (
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
            {types.data.map((t) => (
              <li key={t.id} className="flex items-center justify-between px-3.5 py-2.5 text-[13px]">
                <span className="text-ink">{t.name}</span>
                <span className="text-ink-muted">
                  <span className="font-mono text-ink">{naira(t.basePriceKobo)}</span> &middot; {t.roomCount ?? 0} rooms
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-muted">No room types yet.</p>
        )}
        <form className="grid gap-3 rounded-md border border-dashed border-line-strong p-3.5 sm:grid-cols-[1fr_140px]" onSubmit={(e) => { e.preventDefault(); if (name.trim() && price) addType.mutate(); }}>
          <Field label="New room type">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Deluxe King" />
          </Field>
          <Field label="A night">
            <NairaInput kobo={price} onChange={setPrice} aria-label="Price a night" />
          </Field>
          <Field label="Sleeps">
            <Stepper label="guests" value={cap} onChange={setCap} min={1} max={10} />
          </Field>
          <Button type="submit" variant="secondary" className="self-end" loading={addType.isPending} disabled={!name.trim() || !price}>
            Add the type
          </Button>
        </form>
      </div>
      <div className="flex flex-col gap-3">
        <p className="eyebrow">Rooms in bulk</p>
        <div className="grid grid-cols-2 gap-3 rounded-md border border-line p-3.5">
          <Field label="Type" className="col-span-2">
            <select value={bulk.typeId} onChange={(e) => setBulk({ ...bulk, typeId: e.target.value })} className="h-10 rounded-md border border-line-strong bg-surface px-3 text-[14px]">
              <option value="">Choose a room type</option>
              {types.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Floor">
            <Stepper label="floor" value={bulk.floor} onChange={(n) => setBulk({ ...bulk, floor: n, from: n * 100 + 1, to: n * 100 + 10 })} min={0} max={40} />
          </Field>
          <div className="flex items-end gap-2">
            <Field label="From">
              <Input type="number" value={bulk.from} onChange={(e) => setBulk({ ...bulk, from: Number(e.target.value) })} className="w-20 font-mono" />
            </Field>
            <Field label="To">
              <Input type="number" value={bulk.to} onChange={(e) => setBulk({ ...bulk, to: Number(e.target.value) })} className="w-20 font-mono" />
            </Field>
          </div>
          <Button className="col-span-2" variant="secondary" loading={addRooms.isPending} disabled={!bulk.typeId || bulk.to < bulk.from} onClick={() => addRooms.mutate()}>
            Add {Math.max(0, bulk.to - bulk.from + 1)} rooms
          </Button>
        </div>
        <p className="text-[12px] text-ink-muted">
          Details, photos and hourly rates live in{" "}
          <Link href="/rooms/types" className="text-laterite hover:underline">
            Room types
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

function FormStep() {
  const form = useBookingForm();
  const qc = useQueryClient();
  const toggle = useMutation({
    mutationFn: (v: { key: string; on: boolean }) => formApi.saveDraft(form.data!.draft.fields.map((f) => (f.key === v.key ? { ...f, required: v.on ? "OPTIONAL" : "HIDDEN" } : f))),
    onSuccess: (s) => qc.setQueryData(qk7.form, s),
    meta: { errorTitle: "Not saved" },
  });
  if (!form.data) return <Skeleton className="h-48" />;
  const fields = form.data.draft.fields;
  const asked = fields.filter((f) => f.source !== "SYSTEM" && f.required !== "HIDDEN");
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_280px]">
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-ink-muted">Besides name, phone, dates and guests, your form asks:</p>
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {fields
            .filter((f) => f.source !== "SYSTEM")
            .map((f) => (
              <li key={f.key} className="flex items-center gap-3 px-3.5 py-2.5">
                <span className={cn("flex-1 text-[13.5px]", f.required === "HIDDEN" ? "text-ink-faint line-through" : "text-ink")}>{f.label}</span>
                {f.recommended && <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-faint">Recommended</span>}
                <Switch checked={f.required !== "HIDDEN"} onChange={(on) => toggle.mutate({ key: f.key, on })} ariaLabel={`Ask ${f.label}`} />
              </li>
            ))}
        </ul>
        <p className="text-[12px] text-ink-muted">{asked.length} questions. Guests fill in the form in about a minute.</p>
      </div>
      <div className="flex flex-col gap-3 rounded-md bg-surface-2/50 p-4">
        <p className="text-[13px] text-ink">Add your own questions, conditions and where each is asked in the form builder.</p>
        <ButtonLink href="/settings/booking-form" variant="secondary" size="sm">
          Open the form builder <ArrowRight size={13} />
        </ButtonLink>
      </div>
    </div>
  );
}

function ExtrasStep() {
  const extras = useExtras();
  const points = usePickupPoints();
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Link href="/extras" className="group flex flex-col gap-2 rounded-md border border-line p-4 hover:border-line-strong">
        <CatalogIcon name="ShoppingBag" size={20} className="text-laterite" />
        <span className="text-[14px] font-medium text-ink">Extras</span>
        <span className="text-[12.5px] text-ink-muted">{extras.data ? `${extras.data.filter((e) => e.active).length} on sale` : "Breakfast, late check-out, cakes"}</span>
        <span className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-medium text-laterite">Manage <ArrowRight size={12} /></span>
      </Link>
      <Link href="/pickup-points" className="group flex flex-col gap-2 rounded-md border border-line p-4 hover:border-line-strong">
        <CatalogIcon name="Bus" size={20} className="text-laterite" />
        <span className="text-[14px] font-medium text-ink">Pickup points</span>
        <span className="text-[12.5px] text-ink-muted">{points.data ? `${points.data.filter((e) => e.active).length} places: airports, motor parks, stations` : "Airports, motor parks, stations, jetties"}</span>
        <span className="mt-1 inline-flex items-center gap-1 text-[12.5px] font-medium text-laterite">Manage <ArrowRight size={12} /></span>
      </Link>
    </div>
  );
}

function LinkStep({ icon, title, body, href, cta }: { icon: React.ReactNode; title: string; body: string; href: string; cta: string }) {
  return (
    <div className="flex max-w-xl items-start gap-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-line bg-surface-2 text-laterite">{icon}</span>
      <div className="flex flex-col items-start gap-2">
        <p className="text-[14px] font-medium text-ink">{title}</p>
        <p className="text-[13px] text-ink-muted">{body}</p>
        <ButtonLink href={href} variant="secondary" size="sm">
          {cta} <ArrowRight size={13} />
        </ButtonLink>
      </div>
    </div>
  );
}

function PoliciesStep() {
  const prop = useProperty();
  const qc = useQueryClient();
  const [times, setTimes] = useState<{ in: string; out: string } | null>(null);
  const save = useMutation({
    mutationFn: () => hotelApi.updateProperty({ checkInTime: times!.in, checkOutTime: times!.out }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk.property });
      toast.success("Times saved");
    },
    meta: { errorTitle: "Not saved" },
  });
  const t = times ?? { in: prop.data?.checkInTime ?? "14:00", out: prop.data?.checkOutTime ?? "12:00" };
  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="flex flex-col gap-3">
        <p className="eyebrow flex items-center gap-1.5">
          <Clock size={12} /> Check-in and check-out
        </p>
        <div className="flex items-end gap-3">
          <Field label="Check-in from">
            <Input type="time" value={t.in} onChange={(e) => setTimes({ ...t, in: e.target.value })} className="w-32 font-mono" />
          </Field>
          <Field label="Check-out by">
            <Input type="time" value={t.out} onChange={(e) => setTimes({ ...t, out: e.target.value })} className="w-32 font-mono" />
          </Field>
          <Button variant="secondary" disabled={!times} loading={save.isPending} onClick={() => save.mutate()}>
            Save
          </Button>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="eyebrow flex items-center gap-1.5">
          <Scroll size={12} /> Cancellation and taxes
        </p>
        <Link href="/settings/booking" className="flex items-center justify-between rounded-md border border-line px-3.5 py-3 text-[13px] text-ink hover:border-line-strong">
          Cancellation policy and pay at the hotel <ArrowRight size={13} className="text-ink-muted" />
        </Link>
        <Link href="/settings/taxes" className="flex items-center justify-between rounded-md border border-line px-3.5 py-3 text-[13px] text-ink hover:border-line-strong">
          VAT, consumption tax and service charge <ArrowRight size={13} className="text-ink-muted" />
        </Link>
      </div>
    </div>
  );
}

function GoLiveStep({ progress, onSaved }: { progress: SetupProgress; onSaved: (s: SetupProgress) => void }) {
  const theme = useSiteTheme();
  const form = useBookingForm();
  const prop = useProperty();
  const preview = usePreviewToken(true);
  const { has } = useEntitlements();
  const [publishTheme, setPublishTheme] = useState(true);
  const [publishForm, setPublishForm] = useState(true);
  const [list, setList] = useState<boolean | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const qc = useQueryClient();
  const go = useMutation({
    mutationFn: () => setupApi.goLive({ publishTheme, publishForm, listOnMarketplace: (list ?? prop.data?.listedOnMarketplace ?? true) && has("marketplace_listing") }),
    onSuccess: (s) => {
      onSaved(s);
      void qc.invalidateQueries({ queryKey: qk7.theme });
      void qc.invalidateQueries({ queryKey: qk7.form });
      void qc.invalidateQueries({ queryKey: qk.property });
      toast.success("You're live", "Your booking site and form are published.");
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "SETUP_INCOMPLETE") setMissing(((e.details as { missing?: string[] })?.missing ?? []).map((k) => progress.steps.find((s) => s.key === k)?.title ?? k));
    },
    meta: { silentCodes: ["SETUP_INCOMPLETE"], errorTitle: "Not live yet" },
  });
  const liveDone = progress.steps.find((s) => s.key === "go_live")?.status === "DONE";
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <a href={preview.data?.urls.site ?? "#"} target="_blank" rel="noreferrer" className="flex flex-col gap-1 rounded-md border border-line p-4 hover:border-line-strong">
          <span className="eyebrow">Preview</span>
          <span className="text-[14px] font-medium text-ink">The booking site</span>
          <span className="text-[12px] text-ink-muted">{theme.data ? `${templateMeta(theme.data.draft.templateId).name}, as a guest sees it` : ""}</span>
        </a>
        <a href={preview.data?.urls.booking ?? "#"} target="_blank" rel="noreferrer" className="flex flex-col gap-1 rounded-md border border-line p-4 hover:border-line-strong">
          <span className="eyebrow">Preview</span>
          <span className="text-[14px] font-medium text-ink">The booking form</span>
          <span className="text-[12px] text-ink-muted">{form.data ? `${form.data.draft.fields.filter((f) => f.required !== "HIDDEN").length} questions` : ""}</span>
        </a>
        <div className="flex flex-col gap-1 rounded-md border border-line p-4">
          <span className="eyebrow">Address</span>
          <span className="truncate font-mono text-[13px] text-ink">{theme.data?.siteUrl.replace(/^https?:\/\//, "")}</span>
        </div>
      </div>
      <div className="flex flex-col gap-3 rounded-md border border-line p-4">
        <Switch checked={publishTheme} onChange={setPublishTheme} label={<span className="text-[13.5px]">Publish the booking site design</span>} description={theme.data?.hasUnpublishedChanges ? "The draft has changes that aren't live yet." : "Nothing new to publish."} />
        <Switch checked={publishForm} onChange={setPublishForm} label={<span className="text-[13.5px]">Publish the booking form</span>} description={form.data?.hasUnpublishedChanges ? form.data.diff.summary : "Nothing new to publish."} />
        <Switch checked={list ?? prop.data?.listedOnMarketplace ?? true} onChange={setList} disabled={!has("marketplace_listing")} label={<span className="text-[13.5px]">List us on the marketplace</span>} description="Guests searching the city find you there too." />
      </div>
      {missing.length > 0 && <p className="text-[13px] text-danger">Finish these first: {missing.join(", ")}.</p>}
      <div className="flex items-center gap-3">
        <Button size="lg" loading={go.isPending} onClick={() => go.mutate()} data-testid="go-live" disabled={!progress.canTakeBookings && !progress.steps.find((s) => s.key === "rooms" && s.status === "DONE")}>
          <Rocket size={16} weight="bold" /> {liveDone ? "Publish again" : "Go live"}
        </Button>
        {liveDone && progress.completedAt && <span className="text-[13px] text-palm">Live since {formatDate(progress.completedAt)}</span>}
      </div>
    </div>
  );
}
