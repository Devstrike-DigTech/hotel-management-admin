"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowSquareOut, Buildings, Plus, Storefront, Trash, X } from "@phosphor-icons/react";
import { hotelApi } from "@/lib/api/endpoints";
import { qk, useProperty } from "@/lib/api/hooks";
import type { Property } from "@/lib/api/types";
import { useEntitlements } from "@/lib/auth";
import { NIGERIAN_STATES } from "@/lib/catalog";
import { config } from "@/lib/config";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { TagInput } from "@/components/ui/tag-input";
import { Gate, LockedInline } from "@/components/gating/gate";

type Form = Omit<Property, "id" | "slug" | "images" | "coverImageUrl">;

const SECTIONS = [
  { id: "details", label: "Details" },
  { id: "times", label: "Check-in & out" },
  { id: "amenities", label: "Amenities" },
  { id: "policies", label: "House rules" },
  { id: "marketplace", label: "Marketplace" },
  { id: "branding", label: "Branding" },
];

const AMENITY_SUGGESTIONS = [
  "Wi-Fi",
  "24-hour power",
  "Swimming pool",
  "Breakfast",
  "Airport shuttle",
  "Gym",
  "Restaurant",
  "Bar",
  "Parking",
  "Laundry",
  "Security",
  "Conference room",
];

const ACCENTS = ["#B4452A", "#2F5A43", "#22324F", "#B98A2E", "#7A3B5C", "#1F6F78", "#5B4A3A", "#A32B2B"];

function pick(p: Property): Form {
  return {
    name: p.name ?? "",
    tagline: p.tagline ?? "",
    description: p.description ?? "",
    address: p.address ?? "",
    city: p.city ?? "",
    state: p.state ?? "",
    area: p.area ?? "",
    phone: p.phone ?? "",
    email: p.email ?? "",
    checkInTime: p.checkInTime ?? "14:00",
    checkOutTime: p.checkOutTime ?? "12:00",
    amenities: p.amenities ?? [],
    policies: p.policies ?? [],
    accentColor: p.accentColor ?? null,
    logoUrl: p.logoUrl ?? null,
    listedOnMarketplace: !!p.listedOnMarketplace,
  };
}

export function PropertyView() {
  const property = useProperty();
  if (property.isLoading)
    return (
      <>
        <PageHeader eyebrow="Property" title={<Skeleton className="h-11 w-72" />} />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-64 w-full rounded-lg" />
          <Skeleton className="h-40 w-full rounded-lg" />
        </div>
      </>
    );
  if (property.isError || !property.data)
    return (
      <Panel>
        <ErrorState error={property.error} onRetry={() => property.refetch()} />
      </Panel>
    );
  return <PropertyForm key={property.data.id + (property.dataUpdatedAt ?? 0)} initial={property.data} />;
}

function PropertyForm({ initial }: { initial: Property }) {
  const qc = useQueryClient();
  const { has } = useEntitlements();
  const brandingAllowed = has("booking_site_branding");
  const base = pick(initial);
  const [form, setForm] = useState<Form>(base);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  const changed = (Object.keys(form) as (keyof Form)[]).filter(
    (k) => JSON.stringify(form[k]) !== JSON.stringify(base[k]),
  );
  const dirty = changed.length > 0;

  const save = useMutation({
    mutationFn: () => {
      const patch: Partial<Property> = {};
      for (const k of changed) {
        if (!brandingAllowed && (k === "accentColor" || k === "logoUrl")) continue;
        (patch as Record<string, unknown>)[k] = form[k];
      }
      return hotelApi.updateProperty(patch);
    },
    onSuccess: (p) => {
      qc.setQueryData(qk.property, p);
      void qc.invalidateQueries({ queryKey: qk.me });
      toast.success("Property saved", "Your booking page updates within a minute.");
    },
    meta: { errorTitle: "Property not saved" },
  });

  const publicUrl = `${config.webUrl}/hotels/${initial.slug}`;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Buildings size={14} weight="duotone" /> Property
          </>
        }
        title={
          <>
            {initial.name}, <em>as guests see it</em>.
          </>
        }
        description="These details feed your booking page and the marketplace listing."
        actions={
          <a
            href={publicUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink hover:bg-surface-2"
          >
            View booking page <ArrowSquareOut size={15} />
          </a>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[180px_minmax(0,1fr)]">
        <nav aria-label="Sections" className="hidden lg:block">
          <ol className="sticky top-24 flex flex-col gap-0.5 border-l border-line">
            {SECTIONS.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="-ml-px flex items-center gap-2.5 border-l border-transparent py-1.5 pl-4 text-[13px] text-ink-muted hover:border-ink hover:text-ink"
                >
                  <span className="font-mono text-[10.5px] text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="flex min-w-0 flex-col gap-6 pb-24">
          <Section id="details" n={1} title="Details" description="Name, story and how to reach you.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Hotel name" htmlFor="pp-name">
                <Input id="pp-name" value={form.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Tagline" htmlFor="pp-tag" hint="One line under your name.">
                <Input id="pp-tag" value={form.tagline ?? ""} onChange={(e) => set("tagline", e.target.value)} />
              </Field>
              <Field label="Description" htmlFor="pp-desc" className="sm:col-span-2">
                <Textarea id="pp-desc" rows={4} value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
              </Field>
              <Field label="Street address" htmlFor="pp-addr" className="sm:col-span-2">
                <Input id="pp-addr" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} />
              </Field>
              <Field label="Area" htmlFor="pp-area" hint="e.g. Lekki Phase 1, Wuse II">
                <Input id="pp-area" value={form.area ?? ""} onChange={(e) => set("area", e.target.value)} />
              </Field>
              <Field label="City" htmlFor="pp-city">
                <Input id="pp-city" value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
              </Field>
              <Field label="State" htmlFor="pp-state">
                <Select id="pp-state" value={form.state ?? ""} onChange={(e) => set("state", e.target.value)}>
                  <option value="">Choose a state</option>
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Front desk phone" htmlFor="pp-phone">
                <Input id="pp-phone" className="font-mono" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
              </Field>
              <Field label="Reservations email" htmlFor="pp-email" className="sm:col-span-2">
                <Input id="pp-email" type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
              </Field>
            </div>
          </Section>

          <Section id="times" n={2} title="Check-in & check-out" description="The turnaround window is when housekeeping resets rooms.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Check-out by" htmlFor="pp-out">
                <Input id="pp-out" type="time" className="font-mono" value={form.checkOutTime ?? ""} onChange={(e) => set("checkOutTime", e.target.value)} />
              </Field>
              <Field label="Check-in from" htmlFor="pp-in">
                <Input id="pp-in" type="time" className="font-mono" value={form.checkInTime ?? ""} onChange={(e) => set("checkInTime", e.target.value)} />
              </Field>
            </div>
            <DayRuler checkIn={form.checkInTime ?? "14:00"} checkOut={form.checkOutTime ?? "12:00"} />
          </Section>

          <Section id="amenities" n={3} title="Amenities" description="What guests can expect across the property.">
            <TagInput value={form.amenities} onChange={(v) => set("amenities", v)} placeholder="Add an amenity" />
            <div className="mt-3 flex flex-wrap gap-1.5">
              {AMENITY_SUGGESTIONS.filter((a) => !form.amenities.some((x) => x.toLowerCase() === a.toLowerCase())).map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={() => set("amenities", [...form.amenities, a])}
                  className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 text-[12px] text-ink-muted hover:border-ink-faint hover:text-ink"
                >
                  <Plus size={11} weight="bold" /> {a}
                </button>
              ))}
            </div>
          </Section>

          <Section id="policies" n={4} title="House rules" description="Shown on your booking page before guests pay.">
            <ol className="flex flex-col gap-2">
              {form.policies.map((p, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-2.5 w-6 shrink-0 font-mono text-[11px] text-ink-faint">{String(i + 1).padStart(2, "0")}</span>
                  <Input
                    aria-label={`Rule ${i + 1}`}
                    value={p}
                    onChange={(e) => set("policies", form.policies.map((x, j) => (j === i ? e.target.value : x)))}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Remove rule ${i + 1}`}
                    onClick={() => set("policies", form.policies.filter((_, j) => j !== i))}
                  >
                    <Trash size={15} />
                  </Button>
                </li>
              ))}
            </ol>
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => set("policies", [...form.policies, ""])}>
              <Plus size={13} weight="bold" /> Add a rule
            </Button>
          </Section>

          <Section id="marketplace" n={5} title="Marketplace" description={`List ${form.name || "your hotel"} where guests browse hotels across Nigeria.`}>
            <Gate feature="marketplace_listing">
              <div className="flex items-start gap-4 rounded-md border border-line bg-paper/60 p-4">
                <Storefront size={22} weight="duotone" className="mt-0.5 shrink-0 text-laterite" />
                <div className="flex-1">
                  <Switch
                    checked={form.listedOnMarketplace}
                    onChange={(v) => set("listedOnMarketplace", v)}
                    label="Show on the marketplace"
                    description={
                      form.listedOnMarketplace
                        ? "Guests can find you by city, price and amenities."
                        : "Only people with your direct link can book."
                    }
                  />
                  <a href={publicUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-mono text-[12px] text-ink-muted hover:text-ink">
                    {publicUrl.replace(/^https?:\/\//, "")} <ArrowSquareOut size={12} />
                  </a>
                </div>
              </div>
            </Gate>
          </Section>

          <Section id="branding" n={6} title="Branding" description="Your colour and logo on your booking site.">
            <Gate
              feature="booking_site_branding"
              fallback={
                <div className="flex flex-col gap-4">
                  <LockedInline feature="booking_site_branding" text="Put your own colour and logo on your booking site." />
                  <BrandPreview name={form.name} accent="#8c8375" logo={null} muted />
                </div>
              }
            >
              <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <div className="flex flex-col gap-5">
                  <Field label="Accent colour" htmlFor="pp-accent">
                    <div className="flex flex-wrap items-center gap-2">
                      {ACCENTS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          aria-label={`Use ${c}`}
                          aria-pressed={form.accentColor?.toLowerCase() === c.toLowerCase()}
                          onClick={() => set("accentColor", c)}
                          className={cn(
                            "h-7 w-7 rounded-full border-2 transition-transform hover:scale-110",
                            form.accentColor?.toLowerCase() === c.toLowerCase() ? "border-ink" : "border-surface",
                          )}
                          style={{ background: c, boxShadow: "0 0 0 1px var(--line-strong)" }}
                        />
                      ))}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="color"
                        aria-label="Custom colour"
                        value={/^#[0-9a-f]{6}$/i.test(form.accentColor ?? "") ? form.accentColor! : "#b4452a"}
                        onChange={(e) => set("accentColor", e.target.value.toUpperCase())}
                        className="h-10 w-12 cursor-pointer rounded-md border border-line-strong bg-surface p-1"
                      />
                      <Input
                        id="pp-accent"
                        className="font-mono uppercase"
                        value={form.accentColor ?? ""}
                        onChange={(e) => set("accentColor", e.target.value || null)}
                        placeholder="#B4452A"
                        maxLength={7}
                      />
                    </div>
                  </Field>
                  <Field label="Logo URL" htmlFor="pp-logo" hint="A square PNG or SVG works best.">
                    <div className="flex gap-2">
                      <Input id="pp-logo" value={form.logoUrl ?? ""} onChange={(e) => set("logoUrl", e.target.value || null)} placeholder="https://" />
                      {form.logoUrl && (
                        <Button variant="ghost" size="icon" aria-label="Remove logo" onClick={() => set("logoUrl", null)}>
                          <X size={15} />
                        </Button>
                      )}
                    </div>
                  </Field>
                </div>
                <BrandPreview name={form.name} accent={form.accentColor ?? "#B4452A"} logo={form.logoUrl} />
              </div>
            </Gate>
          </Section>
        </div>
      </div>

      {/* save bar */}
      <div
        className={cn(
          "fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-30 flex justify-center px-4 transition-all duration-200 lg:bottom-6 lg:left-[252px]",
          dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0",
        )}
        aria-hidden={!dirty}
      >
        <div className="flex w-full max-w-xl items-center gap-3 rounded-lg border border-line bg-ink px-4 py-3 text-paper shadow-float">
          <span className="h-2 w-2 shrink-0 rounded-full bg-brass" aria-hidden />
          <p className="flex-1 text-[13.5px]">
            {changed.length} unsaved {changed.length === 1 ? "change" : "changes"}
          </p>
          <button
            onClick={() => setForm(base)}
            className="h-8 rounded-sm px-3 text-[13px] text-paper/75 hover:bg-paper/10 hover:text-paper"
            tabIndex={dirty ? 0 : -1}
          >
            Discard
          </button>
          <Button size="sm" loading={save.isPending} onClick={() => save.mutate()} tabIndex={dirty ? 0 : -1}>
            Save changes
          </Button>
        </div>
      </div>
    </>
  );
}

function Section({
  id,
  n,
  title,
  description,
  children,
}: {
  id: string;
  n: number;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Panel as="section" id={id} className="scroll-mt-24" aria-labelledby={`${id}-title`}>
      <header className="flex items-baseline gap-3 border-b border-line px-5 py-4 sm:px-6">
        <span className="font-mono text-[11px] text-ink-faint">{String(n).padStart(2, "0")}</span>
        <div>
          <h2 id={`${id}-title`} className="display-sm text-[19px] text-ink">
            {title}
          </h2>
          {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
        </div>
      </header>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </Panel>
  );
}

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** A 24-hour ruler: check-out marker, turnaround window, check-in marker. */
function DayRuler({ checkIn, checkOut }: { checkIn: string; checkOut: string }) {
  const out = toMin(checkOut);
  const inn = toMin(checkIn);
  const pct = (m: number) => (m / 1440) * 100;
  const gap = inn - out;
  return (
    <div className="mt-6" aria-label={`Turnaround window: ${gap > 0 ? `${Math.floor(gap / 60)}h ${gap % 60}m` : "none"}`}>
      <div className="relative h-14">
        <div className="absolute inset-x-0 top-6 h-px bg-line-strong" />
        {Array.from({ length: 25 }, (_, h) => (
          <div key={h} className="absolute top-4" style={{ left: `${(h / 24) * 100}%` }}>
            <div className={cn("w-px bg-line-strong", h % 6 === 0 ? "h-4" : "h-2 translate-y-1")} />
            {h % 6 === 0 && (
              <span className="absolute left-0 top-5 -translate-x-1/2 font-mono text-[10px] text-ink-faint">
                {String(h).padStart(2, "0")}:00
              </span>
            )}
          </div>
        ))}
        {gap > 0 && (
          <div
            className="hatch absolute top-[18px] h-3 rounded-xs border border-ochre bg-ochre-wash text-ochre"
            style={{ left: `${pct(out)}%`, width: `${pct(gap)}%` }}
          />
        )}
        <Marker at={pct(out)} label="Out" time={checkOut} tone="var(--laterite)" side="left" />
        <Marker at={pct(inn)} label="In" time={checkIn} tone="var(--palm)" side="right" />
      </div>
      <p className="mt-2 text-[12.5px] text-ink-muted">
        {gap > 0 ? (
          <>
            Housekeeping has <span className="font-mono text-ink">{Math.floor(gap / 60)}h{gap % 60 ? ` ${gap % 60}m` : ""}</span> to turn rooms around.
          </>
        ) : (
          <span className="text-danger">Check-in is before check-out. Rooms won&rsquo;t have time to be cleaned.</span>
        )}
      </p>
    </div>
  );
}

function Marker({
  at,
  label,
  time,
  tone,
  side,
}: {
  at: number;
  label: string;
  time: string;
  tone: string;
  side: "left" | "right";
}) {
  return (
    <div
      className={cn("absolute top-0 flex flex-col", side === "left" ? "-translate-x-full items-end" : "items-start")}
      style={{ left: `${at}%` }}
    >
      <span
        className={cn("block whitespace-nowrap px-1 font-mono text-[10px] font-medium text-paper", side === "left" ? "rounded-l-xs" : "rounded-r-xs")}
        style={{ background: tone }}
      >
        {label} {time}
      </span>
      <span className="block h-3 w-px" style={{ background: tone }} />
    </div>
  );
}

function BrandPreview({ name, accent, logo, muted }: { name: string; accent: string; logo: string | null; muted?: boolean }) {
  return (
    <figure className={cn("overflow-hidden rounded-md border border-line bg-surface", muted && "opacity-60 grayscale")}>
      <div className="flex items-center gap-1.5 border-b border-line bg-surface-2 px-3 py-2">
        <span className="h-2 w-2 rounded-full bg-line-strong" />
        <span className="h-2 w-2 rounded-full bg-line-strong" />
        <span className="h-2 w-2 rounded-full bg-line-strong" />
        <span className="ml-2 truncate font-mono text-[10px] text-ink-faint">booking page preview</span>
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2.5">
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logo} alt="" className="h-8 w-8 rounded-sm object-cover" />
          ) : (
            <span className="grid h-8 w-8 place-items-center rounded-sm font-mono text-[12px] font-semibold text-white" style={{ background: accent }}>
              {name.slice(0, 1)}
            </span>
          )}
          <span className="display-sm text-[16px] text-ink">{name || "Your hotel"}</span>
        </div>
        <div className="mt-4 h-2 w-3/4 rounded-xs bg-surface-2" />
        <div className="mt-2 h-2 w-1/2 rounded-xs bg-surface-2" />
        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-[13px] text-ink">from ₦65,000</span>
          <span className="rounded-sm px-3 py-1.5 text-[12px] font-medium text-white" style={{ background: accent }}>
            Book a room
          </span>
        </div>
      </div>
      <figcaption className="sr-only">Preview of your booking page with the chosen accent colour</figcaption>
    </figure>
  );
}
