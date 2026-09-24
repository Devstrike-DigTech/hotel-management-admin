"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Buildings, Clock, Hourglass, MapPin, Plus, Signpost, Trash, UsersThree, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useCan } from "@/lib/permissions";
import { pickupApi } from "@/lib/api/endpoints-m7";
import { qk7, usePickupPoints, useTransportCompanies } from "@/lib/api/hooks-m7";
import type { PickupKind, PickupPoint, PickupPointInput, VehicleOption } from "@/lib/api/types-m7";
import { isApiError } from "@/lib/api/client";
import { PICKUP_KINDS, VEHICLE_PRESETS, kindMeta } from "@/lib/m7-catalog";
import { naira } from "@/lib/format";
import { hhmmToMinutes } from "@/lib/dates";
import { toast } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Sheet } from "@/components/ui/overlay";
import { Field, Input, Switch, Textarea } from "@/components/ui/form";
import { EmptyState, ErrorState, PageHeader, Panel, PanelHeader, Skeleton, Tip } from "@/components/ui/primitives";
import { NairaInput, Stepper } from "@/components/m2/bits";
import { CatalogIcon } from "@/components/m7/icon";

const blank = (kind: PickupKind = "AIRPORT"): PickupPointInput => ({
  name: "",
  shortName: null,
  kind,
  city: "",
  address: null,
  priceKobo: 0,
  dropOffPriceKobo: null,
  vehicleOptions: [{ name: "Saloon car", maxPassengers: 3, priceKobo: null }],
  leadTimeHours: 6,
  operatingHours: null,
  notesForGuest: null,
  taxable: true,
  active: true,
});

/** The day as a 24-hour ruler with the drivers' working window drawn on it. */
export function HoursRuler({ hours, className }: { hours: { open: string; close: string } | null; className?: string }) {
  const pct = (t: string) => (hhmmToMinutes(t) / 1440) * 100;
  const spans: [number, number][] = !hours ? [[0, 100]] : hours.close < hours.open ? [[0, pct(hours.close)], [pct(hours.open), 100]] : [[pct(hours.open), pct(hours.close)]];
  return (
    <div className={cn("flex flex-col gap-1", className)} aria-label={hours ? `Drivers work ${hours.open} to ${hours.close}` : "Drivers work around the clock"}>
      <div className="relative h-2 overflow-hidden rounded-xs bg-surface-2">
        {spans.map(([a, b], i) => (
          <span key={i} className="absolute inset-y-0 bg-palm/70" style={{ left: `${a}%`, width: `${b - a}%` }} />
        ))}
        {[25, 50, 75].map((x) => (
          <span key={x} className="absolute inset-y-0 w-px bg-surface" style={{ left: `${x}%` }} />
        ))}
      </div>
      <div className="flex justify-between font-mono text-[9.5px] text-ink-faint">
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>24</span>
      </div>
    </div>
  );
}

export function PickupsView() {
  const q = usePickupPoints();
  const { can } = useCan();
  const manage = can("extras.manage");
  const qc = useQueryClient();
  const [edit, setEdit] = useState<{ id: string | null; draft: PickupPointInput } | null>(null);
  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => pickupApi.update(id, { active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk7.pickups }),
    meta: { errorTitle: "Not changed" },
  });
  const groups = PICKUP_KINDS.map((k) => ({ ...k, points: (q.data ?? []).filter((p) => p.kind === k.value) })).filter((g) => g.points.length);
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Signpost size={14} weight="duotone" /> Pickup points
          </>
        }
        title={
          <>
            Meet them <em>where they land</em>.
          </>
        }
        description="Airports, motor parks, train stations and jetties where your driver meets guests. Road travellers tell you their bus company and expected time at the park; flyers give their flight."
        actions={
          manage && (
            <Button onClick={() => setEdit({ id: null, draft: blank() })} data-testid="new-pickup">
              <Plus size={15} weight="bold" /> New pickup point
            </Button>
          )
        }
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex flex-col gap-7">
            {!q.data.length && (
              <Panel>
                <EmptyState glyph="river" title="No pickup points yet" body="Add the airport or the motor park your guests come through most, with a price for the car." action={manage && <Button onClick={() => setEdit({ id: null, draft: blank("MOTOR_PARK") })}>Add a motor park</Button>} />
              </Panel>
            )}
            {groups.map((g) => (
              <section key={g.value}>
                <h2 className="mb-3 flex items-center gap-2">
                  <span className="grid h-7 w-7 place-items-center rounded-sm border border-line bg-surface text-laterite">
                    <CatalogIcon name={g.icon} size={15} weight="duotone" />
                  </span>
                  <span className="display-sm text-[19px] text-ink">{g.plural}</span>
                  <span className="text-[12px] text-ink-muted">&middot; {g.detail}</span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {g.points.map((p) => (
                    <li key={p.id}>
                      <PointRow p={p} manage={manage} onOpen={() => setEdit({ id: p.id, draft: toInput(p) })} onToggle={(v) => toggle.mutate({ id: p.id, active: v })} />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
          <Companies manage={manage} />
        </div>
      )}
      {edit && <PointEditor key={edit.id ?? "new"} id={edit.id} initial={edit.draft} onClose={() => setEdit(null)} />}
    </>
  );
}

function toInput(p: PickupPoint): PickupPointInput {
  const { id: _i, propertyId: _p, createdAt: _c, updatedAt: _u, ...rest } = p;
  void _i;
  void _p;
  void _c;
  void _u;
  return rest;
}

export function PointRow({ p, manage, onOpen, onToggle }: { p: PickupPoint; manage: boolean; onOpen: () => void; onToggle: (v: boolean) => void }) {
  return (
    <article className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 rounded-lg border bg-surface px-4 py-3.5 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_150px_auto]", p.active ? "border-line" : "border-dashed border-line-strong bg-surface-2/40")} data-pickup={p.name}>
      <button type="button" onClick={onOpen} className="min-w-0 text-left" aria-label={`Edit ${p.name}`}>
        <p className={cn("truncate text-[14.5px] font-medium", p.active ? "text-ink" : "text-ink-muted")}>
          {p.name}
          {p.shortName && <span className="ml-2 font-mono text-[11px] text-ink-faint">{p.shortName}</span>}
        </p>
        <p className="truncate text-[12px] text-ink-muted">
          <MapPin size={11} className="mr-1 inline" />
          {[p.address, p.city].filter(Boolean).join(", ") || "No address"}
        </p>
      </button>
      <div className="order-3 col-span-2 flex min-w-0 flex-wrap gap-1 md:order-none md:col-span-1">
        {(p.vehicleOptions.length ? p.vehicleOptions : [{ name: "Standard car", maxPassengers: 4, priceKobo: null }]).map((v, i) => (
          <Tip key={i} content={`Up to ${v.maxPassengers} passengers`}>
            <span className="inline-flex h-6 items-center gap-1 rounded-sm border border-line px-1.5 text-[11px] text-ink-muted">
              {v.name} <span className="font-mono text-ink">{naira(v.priceKobo ?? p.priceKobo)}</span>
            </span>
          </Tip>
        ))}
      </div>
      <div className="order-4 col-span-2 flex flex-col gap-1 md:order-none md:col-span-1">
        <HoursRuler hours={p.operatingHours} />
        <p className="flex items-center gap-1 text-[11px] text-ink-muted">
          <Hourglass size={11} /> {p.leadTimeHours} h notice
        </p>
      </div>
      <Switch checked={p.active} disabled={!manage} onChange={onToggle} ariaLabel={`${p.name} offered`} />
    </article>
  );
}

function Companies({ manage }: { manage: boolean }) {
  const q = useTransportCompanies();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const add = useMutation({
    mutationFn: () => pickupApi.addCompany(name.trim()),
    onSuccess: () => {
      setName("");
      void qc.invalidateQueries({ queryKey: qk7.companies });
    },
    meta: { errorTitle: "Company not added" },
  });
  const remove = useMutation({ mutationFn: (id: string) => pickupApi.removeCompany(id), onSuccess: () => qc.invalidateQueries({ queryKey: qk7.companies }), meta: { errorTitle: "Not removed" } });
  const platform = (q.data ?? []).filter((c) => c.source === "PLATFORM");
  const mine = (q.data ?? []).filter((c) => c.source === "HOTEL");
  return (
    <Panel as="aside" className="self-start" data-testid="transport-companies">
      <PanelHeader eyebrow="Road travellers" title="Transport companies" description="Guests coming by bus pick their company, so the driver knows which gate to wait at." />
      <div className="flex flex-col gap-4 p-5">
        <div className="flex flex-wrap gap-1">
          {platform.map((c) => (
            <span key={c.id} className="rounded-sm bg-surface-2 px-1.5 py-0.5 text-[11.5px] text-ink-muted">
              {c.name}
            </span>
          ))}
        </div>
        <div className="border-t border-dashed border-line pt-4">
          <p className="mb-2 text-[12.5px] font-medium text-ink">Your local lines</p>
          {mine.length ? (
            <ul className="mb-3 flex flex-col gap-1">
              {mine.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-[13px] text-ink">
                  <Buildings size={13} className="text-ink-muted" />
                  <span className="flex-1">{c.name}</span>
                  {manage && (
                    <button type="button" onClick={() => remove.mutate(c.id)} aria-label={`Remove ${c.name}`} className="text-ink-faint hover:text-danger">
                      <X size={13} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mb-3 text-[12px] text-ink-muted">None yet. Guests can always type &ldquo;Other&rdquo;.</p>
          )}
          {manage && (
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim().length >= 2) add.mutate();
              }}
            >
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ibeju-Lekki Shuttle" aria-label="Company name" maxLength={60} />
              <Button type="submit" variant="secondary" loading={add.isPending} disabled={name.trim().length < 2}>
                Add
              </Button>
            </form>
          )}
        </div>
      </div>
    </Panel>
  );
}

function PointEditor({ id, initial, onClose }: { id: string | null; initial: PickupPointInput; onClose: () => void }) {
  const qc = useQueryClient();
  const { can } = useCan();
  const manage = can("extras.manage");
  const [d, setD] = useState<PickupPointInput>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (p: Partial<PickupPointInput>) => setD((x) => ({ ...x, ...p }));
  const setV = (i: number, p: Partial<VehicleOption>) => set({ vehicleOptions: d.vehicleOptions.map((v, j) => (j === i ? { ...v, ...p } : v)) });
  const km = kindMeta(d.kind);

  const save = useMutation({
    mutationFn: () => {
      const e: Record<string, string> = {};
      if (d.name.trim().length < 2) e.name = "Name the place";
      if (!d.city.trim()) e.city = "Which city?";
      if (d.priceKobo <= 0) e.price = "Set the one-way price";
      if (d.operatingHours && (!d.operatingHours.open || !d.operatingHours.close)) e.hours = "Set both times, or choose round the clock";
      setErrors(e);
      if (Object.keys(e).length) throw new Error("Check the highlighted fields");
      const body = { ...d, name: d.name.trim(), shortName: d.shortName?.trim() || null, city: d.city.trim(), vehicleOptions: d.vehicleOptions.filter((v) => v.name.trim()) };
      return id ? pickupApi.update(id, body) : pickupApi.create(body);
    },
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: qk7.pickups });
      toast.success(id ? `${p.shortName ?? p.name} saved` : `Guests can be met at ${p.shortName ?? p.name}`);
      onClose();
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "VALIDATION_ERROR") {
        const f = (e.details as { fields?: Record<string, string[]> })?.fields ?? {};
        setErrors(Object.fromEntries(Object.entries(f).map(([k, v]) => [k === "priceKobo" ? "price" : k, v[v.length - 1]])));
      }
    },
    meta: { errorTitle: "Pickup point not saved" },
  });
  const remove = useMutation({
    mutationFn: () => pickupApi.remove(id!),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk7.pickups });
      toast.success("Pickup point deleted");
      onClose();
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "EXTRA_IN_USE") toast.warning("Transfers use this point", "Switch it off instead; booked pickups keep it.");
    },
    meta: { silentCodes: ["EXTRA_IN_USE"], errorTitle: "Not deleted" },
  });

  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      eyebrow={id ? "Edit pickup point" : "New pickup point"}
      title={d.name || km.label}
      width="sm:max-w-[580px]"
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
            <Button onClick={() => save.mutate()} loading={save.isPending} data-testid="save-pickup">
              Save
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-ink">Kind of place</span>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3" role="radiogroup" aria-label="Kind of place">
            {PICKUP_KINDS.map((k) => (
              <button key={k.value} type="button" role="radio" aria-checked={d.kind === k.value} onClick={() => set({ kind: k.value })} data-testid={`kind-${k.value}`} className={cn("flex items-center gap-2 rounded-md border px-3 py-2.5 text-left text-[13px]", d.kind === k.value ? "border-ink bg-surface shadow-[0_0_0_1px_var(--ink)]" : "border-line hover:border-line-strong")}>
                <CatalogIcon name={k.icon} size={16} weight="duotone" className={d.kind === k.value ? "text-laterite" : "text-ink-muted"} />
                {k.label}
              </button>
            ))}
          </div>
          <p className="rounded-sm bg-surface-2/70 px-3 py-2 text-[12px] leading-snug text-ink-muted">
            <span className="font-medium text-ink">Guests are asked for:</span> {km.detail.toLowerCase()}, passengers, luggage and a phone for the day.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field label="Name" htmlFor="pp-name" error={errors.name}>
            <Input id="pp-name" value={d.name} maxLength={100} onChange={(e) => set({ name: e.target.value })} placeholder={d.kind === "MOTOR_PARK" ? "Jibowu Motor Park" : d.kind === "AIRPORT" ? "Murtala Muhammed International Airport" : "Mobolaji Johnson Station"} data-testid="pickup-name" />
          </Field>
          <Field label="Short name" htmlFor="pp-short" optional>
            <Input id="pp-short" value={d.shortName ?? ""} maxLength={20} onChange={(e) => set({ shortName: e.target.value || null })} placeholder="MMIA" className="font-mono" />
          </Field>
          <Field label="City" htmlFor="pp-city" error={errors.city}>
            <Input id="pp-city" value={d.city} onChange={(e) => set({ city: e.target.value })} placeholder="Lagos" data-testid="pickup-city" />
          </Field>
          <Field label="Address" htmlFor="pp-addr" optional className="sm:col-span-2">
            <Input id="pp-addr" value={d.address ?? ""} onChange={(e) => set({ address: e.target.value || null })} placeholder="Ikorodu Road, Jibowu, Yaba" />
          </Field>
        </div>

        <div className="flex flex-col gap-3 rounded-md border border-line p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Pickup, one way" error={errors.price}>
              <NairaInput kobo={d.priceKobo || null} onChange={(k) => set({ priceKobo: k ?? 0 })} aria-label="Pickup price" />
            </Field>
            <Field label="Drop-off, one way" optional hint="Empty: same as the pickup.">
              <NairaInput kobo={d.dropOffPriceKobo} onChange={(k) => set({ dropOffPriceKobo: k })} aria-label="Drop-off price" />
            </Field>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-ink">Vehicles</span>
            <ul className="flex flex-col gap-1.5">
              {d.vehicleOptions.map((v, i) => (
                <li key={i} className="grid grid-cols-[minmax(0,1fr)_88px_minmax(0,130px)_28px] items-center gap-1.5">
                  <Input value={v.name} onChange={(e) => setV(i, { name: e.target.value })} aria-label={`Vehicle ${i + 1}`} className="h-9" />
                  <div className="relative">
                    <UsersThree size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-ink-muted" />
                    <Input type="number" min={1} max={60} value={v.maxPassengers} onChange={(e) => setV(i, { maxPassengers: Math.max(1, Number(e.target.value) || 1) })} className="h-9 pl-7 font-mono" aria-label="Most passengers" />
                  </div>
                  <NairaInput kobo={v.priceKobo} onChange={(k) => setV(i, { priceKobo: k })} placeholder={String(Math.round(d.priceKobo / 100))} className="h-9" aria-label="Price for this vehicle" />
                  <button type="button" onClick={() => set({ vehicleOptions: d.vehicleOptions.filter((_, j) => j !== i) })} aria-label={`Remove ${v.name}`} className="grid h-9 place-items-center text-ink-faint hover:text-danger">
                    <X size={13} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-1.5">
              {VEHICLE_PRESETS.filter((p) => !d.vehicleOptions.some((v) => v.name === p.name)).map((p) => (
                <Button key={p.name} size="sm" variant="ghost" onClick={() => set({ vehicleOptions: [...d.vehicleOptions, { name: p.name, maxPassengers: p.maxPassengers, priceKobo: null }] })}>
                  <Plus size={12} /> {p.name}
                </Button>
              ))}
            </div>
            <p className="text-[11.5px] text-ink-muted">Leave a vehicle&rsquo;s price empty to use the pickup price. With no vehicles, guests get a standard car for up to 4.</p>
          </div>
          <Switch checked={d.taxable} onChange={(v) => set({ taxable: v })} label={<span className="text-[13px]">Charge tax on transfers</span>} />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Notice needed" hint="Online guests must book this far ahead. The desk can always add one.">
            <div className="flex items-center gap-2">
              <Hourglass size={15} className="text-ink-muted" />
              <Stepper label="hours" value={d.leadTimeHours} onChange={(n) => set({ leadTimeHours: n })} min={0} max={72} suffix="h" />
            </div>
          </Field>
          <div className="flex flex-col gap-2">
            <Switch checked={!d.operatingHours} onChange={(v) => set({ operatingHours: v ? null : { open: "06:00", close: "22:00" } })} label={<span className="text-[13px]">Drivers go round the clock</span>} />
            {d.operatingHours && (
              <div className="flex items-center gap-2">
                <Clock size={14} className="text-ink-muted" />
                <Input type="time" value={d.operatingHours.open} onChange={(e) => set({ operatingHours: { ...d.operatingHours!, open: e.target.value } })} className="h-9 w-28 font-mono" aria-label="From" />
                <span className="text-ink-muted">to</span>
                <Input type="time" value={d.operatingHours.close} onChange={(e) => set({ operatingHours: { ...d.operatingHours!, close: e.target.value } })} className="h-9 w-28 font-mono" aria-label="Until" />
              </div>
            )}
            <HoursRuler hours={d.operatingHours} />
            {errors.hours && <p className="text-[12px] text-danger">{errors.hours}</p>}
          </div>
        </div>
        <Field label="Note for the guest" htmlFor="pp-note" optional hint="In the booking form and the driver message.">
          <Textarea id="pp-note" value={d.notesForGuest ?? ""} maxLength={300} onChange={(e) => set({ notesForGuest: e.target.value || null })} className="min-h-16" placeholder={d.kind === "MOTOR_PARK" ? "Tell us your bus company; our driver waits at their gate with a sign in your name." : "Our driver waits at the arrivals exit with a sign in your name."} />
        </Field>
        <Switch checked={d.active} onChange={(v) => set({ active: v })} label={<span className="text-[13.5px]">Offered to guests</span>} />
      </div>
      <ConfirmDialog open={confirmDelete} onOpenChange={setConfirmDelete} title={`Delete ${d.name}?`} body="If any transfer uses it, we'll ask you to switch it off instead." confirmLabel="Delete" danger onConfirm={() => remove.mutateAsync()} />
    </Sheet>
  );
}
