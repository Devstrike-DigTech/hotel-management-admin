"use client";

import { useMemo } from "react";
import { Clock, Info, Suitcase, WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import type { PickupAnswer, PublicPickupPoint, TrainRoute, TransferSelection, TransportCompany } from "@/lib/api/types-m7";
import { PICKUP_KINDS, kindMeta } from "@/lib/m7-catalog";
import { naira } from "@/lib/format";
import { addDays, dayKeyOf, lagosHHMM, lagosIso } from "@/lib/dates";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Stepper } from "@/components/m2/bits";
import { CatalogIcon } from "@/components/m7/icon";

export function transferPrice(p: PublicPickupPoint, direction: "ARRIVAL" | "DEPARTURE", vehicleOptionId?: string | null) {
  const v = p.vehicleOptions.find((x) => x.id === vehicleOptionId);
  return v?.priceKobo ?? (direction === "DEPARTURE" ? (p.dropOffPriceKobo ?? p.priceKobo) : p.priceKobo);
}

/** The transfers a PICKUP answer asks for (they travel with the booking; API-M7 4.3). */
export function transfersFromPickup(a: PickupAnswer | undefined): TransferSelection[] {
  if (!a?.wanted || !a.pickupPointId || !a.scheduledAt) return [];
  const out: TransferSelection[] = [{ direction: "ARRIVAL", pickupPointId: a.pickupPointId, vehicleOptionId: a.vehicleOptionId ?? null, passengers: a.passengers ?? 1, scheduledAt: a.scheduledAt }];
  const d = a.departure;
  if (d?.wanted && d.scheduledAt) {
    out.push({
      direction: "DEPARTURE",
      pickupPointId: d.sameAsArrival ? a.pickupPointId : (d.pickupPointId ?? a.pickupPointId),
      vehicleOptionId: d.sameAsArrival ? (a.vehicleOptionId ?? null) : (d.vehicleOptionId ?? null),
      passengers: a.passengers ?? 1,
      scheduledAt: d.scheduledAt,
    });
  }
  return out;
}

function inHours(hhmm: string, oh: { open: string; close: string } | null) {
  if (!oh) return true;
  if (oh.close < oh.open) return hhmm >= oh.open || hhmm <= oh.close;
  return hhmm >= oh.open && hhmm <= oh.close;
}

/** Friendly checks the server repeats (lead time is not enforced at the desk). */
export function pickupProblems(a: PickupAnswer | undefined, points: PublicPickupPoint[], opts: { desk: boolean; phone?: string }) {
  const out: Record<string, string> = {};
  if (!a?.wanted) return out;
  const p = points.find((x) => x.id === a.pickupPointId);
  if (!p) {
    out.point = "Choose where to meet the guest.";
    return out;
  }
  const d = (a.details ?? {}) as Record<string, string | null>;
  if (p.kind === "AIRPORT") {
    if (!d.airline || d.airline.trim().length < 2) out.airline = "Which airline?";
    if (!d.flightNumber || !/^[A-Z0-9]{2}\s?\d{1,4}[A-Z]?$/i.test(d.flightNumber.trim())) out.flightNumber = "Enter the flight number, e.g. P4 7121";
  } else if (p.kind === "MOTOR_PARK") {
    if (!d.transportCompanyId && !d.transportCompanyOther) out.company = "Which transport company?";
    if (!d.departureCity || d.departureCity.trim().length < 2) out.departureCity = "Coming from which city?";
  } else if (p.kind === "TRAIN_STATION") {
    if (!d.trainRouteId && !d.routeOther) out.route = "Which route?";
  } else if (!d.details || d.details.trim().length < 3) out.details = "Tell the driver where and how to meet.";
  if (!a.scheduledAt) out.scheduledAt = "When does the guest arrive there?";
  else {
    const hhmm = lagosHHMM(a.scheduledAt);
    if (!inHours(hhmm, p.operatingHours)) out.scheduledAt = `Our drivers work at ${p.shortName ?? p.name} between ${p.operatingHours!.open} and ${p.operatingHours!.close}.`;
    else if (!opts.desk && Date.parse(a.scheduledAt) < Date.now() + p.leadTimeHours * 3600_000) out.scheduledAt = `Pickups from ${p.shortName ?? p.name} need ${p.leadTimeHours} hours' notice.`;
  }
  const v = p.vehicleOptions.find((x) => x.id === a.vehicleOptionId);
  const max = v?.maxPassengers ?? 4;
  if ((a.passengers ?? 1) > max) out.passengers = `A ${v?.name ?? "standard car"} takes up to ${max} passengers.`;
  return out;
}

export function PickupBlock({
  value,
  onChange,
  points,
  companies,
  routes,
  arrival,
  departure,
  guests,
  guestPhone,
  directions,
  desk,
  errors,
  label,
}: {
  value: PickupAnswer | undefined;
  onChange: (v: PickupAnswer) => void;
  points: PublicPickupPoint[];
  companies: TransportCompany[];
  routes: TrainRoute[];
  arrival: string;
  departure: string;
  guests: number;
  guestPhone?: string;
  directions: ("ARRIVAL" | "DEPARTURE")[];
  desk: boolean;
  errors?: Record<string, string>;
  label: string;
}) {
  const a: PickupAnswer = useMemo(() => value ?? { wanted: false }, [value]);
  const set = (p: Partial<PickupAnswer>) => onChange({ ...a, ...p });
  const point = points.find((x) => x.id === a.pickupPointId);
  const d = (a.details ?? {}) as Record<string, string | null | undefined>;
  const setD = (p: Record<string, string | null>) => set({ details: { ...d, ...p } });
  const problems = useMemo(() => ({ ...pickupProblems(a, points, { desk }), ...(errors ?? {}) }), [a, points, desk, errors]);
  const byKind = PICKUP_KINDS.map((k) => ({ ...k, points: points.filter((p) => p.kind === k.value) })).filter((k) => k.points.length);
  const time = a.scheduledAt ? lagosHHMM(a.scheduledAt) : "";
  const date = a.scheduledAt ? dayKeyOf(a.scheduledAt) : arrival;
  const setWhen = (day: string, hhmm: string) => set({ scheduledAt: hhmm ? lagosIso(day, hhmm) : undefined });
  const arrivalOn = directions.includes("ARRIVAL");
  const departureOn = directions.includes("DEPARTURE");
  const dep = a.departure ?? { wanted: false, sameAsArrival: true };
  const depTime = dep.scheduledAt ? lagosHHMM(dep.scheduledAt) : "";
  const vehicle = point?.vehicleOptions.find((v) => v.id === a.vehicleOptionId);
  const arrivalPrice = point ? transferPrice(point, "ARRIVAL", a.vehicleOptionId) : 0;
  const depPoint = dep.sameAsArrival ? point : points.find((x) => x.id === dep.pickupPointId);
  const depPrice = depPoint && dep.wanted ? transferPrice(depPoint, "DEPARTURE", dep.sameAsArrival ? a.vehicleOptionId : dep.vehicleOptionId) : 0;

  if (!arrivalOn && !departureOn) return null;
  return (
    <div className="flex flex-col gap-4 rounded-md border border-line bg-surface-2/30 p-4" data-testid="pickup-block">
      <Switch checked={a.wanted} onChange={(v) => set({ wanted: v, passengers: a.passengers ?? guests, contactPhone: a.contactPhone ?? guestPhone ?? null })} label={label} description="A driver meets the guest at the airport, motor park, station or jetty." />
      {a.wanted && (
        <>
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Where to meet">
            {byKind.map((k) => (
              <div key={k.value} className="flex flex-col gap-1.5">
                <span className="eyebrow flex items-center gap-1.5 text-[10px]">
                  <CatalogIcon name={k.icon} size={12} /> {k.plural}
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {k.points.map((p) => {
                    const on = p.id === a.pickupPointId;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        data-testid={`pickup-point-${p.id}`}
                        onClick={() => set({ pickupPointId: p.id, vehicleOptionId: p.vehicleOptions[0]?.id ?? null, details: {} })}
                        className={cn("inline-flex min-h-9 items-center gap-2 rounded-sm border px-2.5 py-1 text-left text-[12.5px] transition-colors", on ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink hover:border-ink-faint")}
                      >
                        <span>{p.shortName ?? p.name}</span>
                        <span className={cn("font-mono text-[11px]", on ? "text-paper/70" : "text-ink-muted")}>{naira(p.priceKobo)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {problems.point && <p className="text-[12px] text-danger">{problems.point}</p>}
          </div>

          {point && (
            <>
              {point.notesForGuest && (
                <p className="flex items-start gap-2 text-[12.5px] leading-snug text-ink-muted">
                  <Info size={14} className="mt-0.5 shrink-0 text-adire" /> {point.notesForGuest}
                </p>
              )}
              <div className="grid gap-3 sm:grid-cols-2">
                {point.kind === "AIRPORT" && (
                  <>
                    <Field label="Airline" error={problems.airline}>
                      <Input value={d.airline ?? ""} onChange={(e) => setD({ airline: e.target.value })} placeholder="Air Peace" data-testid="pickup-airline" />
                    </Field>
                    <Field label="Flight number" error={problems.flightNumber}>
                      <Input value={d.flightNumber ?? ""} onChange={(e) => setD({ flightNumber: e.target.value.toUpperCase() })} placeholder="P4 7121" className="font-mono" data-testid="pickup-flight" />
                    </Field>
                    <Field label="Terminal" optional>
                      <Input value={d.terminal ?? ""} onChange={(e) => setD({ terminal: e.target.value || null })} placeholder="Terminal 1" />
                    </Field>
                  </>
                )}
                {point.kind === "MOTOR_PARK" && (
                  <>
                    <Field label="Transport company" error={problems.company}>
                      <Select
                        value={d.transportCompanyId ?? (d.transportCompanyOther != null ? "__other" : "")}
                        onChange={(e) => (e.target.value === "__other" ? setD({ transportCompanyId: null, transportCompanyOther: "" }) : setD({ transportCompanyId: e.target.value || null, transportCompanyOther: null }))}
                        data-testid="pickup-company"
                      >
                        <option value="">Choose the company</option>
                        {companies.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                        <option value="__other">Other&hellip;</option>
                      </Select>
                    </Field>
                    {d.transportCompanyOther != null && !d.transportCompanyId && (
                      <Field label="Which company?">
                        <Input value={d.transportCompanyOther ?? ""} onChange={(e) => setD({ transportCompanyOther: e.target.value })} placeholder="A local line" />
                      </Field>
                    )}
                    <Field label="Coming from" error={problems.departureCity}>
                      <Input value={d.departureCity ?? ""} onChange={(e) => setD({ departureCity: e.target.value })} placeholder="Abuja" data-testid="pickup-from-city" />
                    </Field>
                    <Field label="Ticket or booking number" optional>
                      <Input value={d.ticketReference ?? ""} onChange={(e) => setD({ ticketReference: e.target.value || null })} className="font-mono" placeholder="GIG-554120" />
                    </Field>
                    <Field label="The bus" optional hint="Colour, make, livery">
                      <Input value={d.vehicleDescription ?? ""} onChange={(e) => setD({ vehicleDescription: e.target.value || null })} placeholder="White Hiace, GIGM colours" />
                    </Field>
                  </>
                )}
                {point.kind === "TRAIN_STATION" && (
                  <>
                    <Field label="Route" error={problems.route}>
                      <Select value={d.trainRouteId ?? (d.routeOther != null ? "__other" : "")} onChange={(e) => (e.target.value === "__other" ? setD({ trainRouteId: null, routeOther: "" }) : setD({ trainRouteId: e.target.value || null, routeOther: null }))}>
                        <option value="">Choose the route</option>
                        {routes.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.name.replace(" - ", "–")}
                          </option>
                        ))}
                        <option value="__other">Other&hellip;</option>
                      </Select>
                    </Field>
                    {d.routeOther != null && !d.trainRouteId ? (
                      <Field label="Which route?">
                        <Input value={d.routeOther ?? ""} onChange={(e) => setD({ routeOther: e.target.value })} />
                      </Field>
                    ) : (
                      <Field label="Train or service" optional>
                        <Select value={d.trainService ?? ""} onChange={(e) => setD({ trainService: e.target.value || null })}>
                          <option value="">Not sure</option>
                          {(routes.find((r) => r.id === d.trainRouteId)?.services ?? []).map((s) => (
                            <option key={s} value={s}>
                              {s} service
                            </option>
                          ))}
                        </Select>
                      </Field>
                    )}
                  </>
                )}
                {(point.kind === "JETTY" || point.kind === "OTHER") && (
                  <Field label="Details for the driver" error={problems.details} className="sm:col-span-2">
                    <Textarea value={d.details ?? ""} onChange={(e) => setD({ details: e.target.value })} className="min-h-16" placeholder="Boat from Ikorodu, arriving at the Marina jetty steps" />
                  </Field>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <Field label={point.kind === "AIRPORT" ? "Landing" : point.kind === "MOTOR_PARK" ? "Expected at the park" : "Arriving"} error={problems.scheduledAt} hint={point.operatingHours ? `Drivers work ${point.operatingHours.open} to ${point.operatingHours.close}.` : undefined}>
                  <div className="flex gap-2">
                    <Input type="date" value={date} min={addDays(arrival, -1)} max={arrival} onChange={(e) => setWhen(e.target.value, time)} className="font-mono" aria-label="Arrival date" />
                    <div className="relative w-32 shrink-0">
                      <Clock size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                      <Input type="time" value={time} onChange={(e) => setWhen(date, e.target.value)} className="pl-8 font-mono" aria-label="Arrival time" data-testid="pickup-time" />
                    </div>
                  </div>
                </Field>
                <Field label="Passengers" error={problems.passengers}>
                  <Stepper label="passengers" value={a.passengers ?? guests} onChange={(n) => set({ passengers: n })} min={1} max={60} />
                </Field>
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                {point.vehicleOptions.length > 0 && (
                  <Field label="Vehicle">
                    <Select value={a.vehicleOptionId ?? ""} onChange={(e) => set({ vehicleOptionId: e.target.value || null })}>
                      {point.vehicleOptions.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name} &middot; up to {v.maxPassengers} &middot; {naira(v.priceKobo ?? point.priceKobo)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <Field label="Luggage" optional>
                  <div className="flex items-center gap-2">
                    <Suitcase size={15} className="text-ink-muted" />
                    <Stepper label="bags" value={a.luggage ?? 0} onChange={(n) => set({ luggage: n })} min={0} max={20} />
                  </div>
                </Field>
              </div>
              <Field label="Phone on the day" hint={guestPhone ? "The guest's number unless you change it." : undefined}>
                <Input type="tel" value={a.contactPhone ?? ""} onChange={(e) => set({ contactPhone: e.target.value || null })} className="font-mono" placeholder="0803 123 4567" />
              </Field>

              {departureOn && (
                <div className="flex flex-col gap-3 border-t border-dashed border-line pt-3">
                  <Switch checked={dep.wanted} onChange={(v) => set({ departure: { ...dep, wanted: v, sameAsArrival: dep.sameAsArrival ?? true } })} label={<span className="text-[13.5px]">Drop-off on departure too</span>} />
                  {dep.wanted && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Switch checked={dep.sameAsArrival} onChange={(v) => set({ departure: { ...dep, sameAsArrival: v, pickupPointId: v ? undefined : a.pickupPointId } })} label={<span className="text-[13px]">Same place and vehicle</span>} />
                      <Field label="Leave the hotel at">
                        <div className="flex gap-2">
                          <Input type="date" value={dep.scheduledAt ? dayKeyOf(dep.scheduledAt) : departure} onChange={(e) => set({ departure: { ...dep, scheduledAt: depTime ? lagosIso(e.target.value, depTime) : undefined } })} className="font-mono" aria-label="Departure date" />
                          <Input type="time" value={depTime} onChange={(e) => set({ departure: { ...dep, scheduledAt: e.target.value ? lagosIso(dep.scheduledAt ? dayKeyOf(dep.scheduledAt) : departure, e.target.value) : undefined } })} className="w-28 font-mono" aria-label="Departure time" />
                        </div>
                      </Field>
                      {!dep.sameAsArrival && (
                        <Field label="Drop-off at">
                          <Select value={dep.pickupPointId ?? ""} onChange={(e) => set({ departure: { ...dep, pickupPointId: e.target.value } })}>
                            {points.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.shortName ?? p.name}
                              </option>
                            ))}
                          </Select>
                        </Field>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="flex items-baseline justify-between border-t border-line pt-3 text-[13px]">
                <span className="text-ink-muted">
                  <CatalogIcon name={kindMeta(point.kind).icon} size={13} className="mr-1.5 inline" />
                  {point.shortName ?? point.name}, {vehicle?.name ?? "standard car"}
                  {dep.wanted ? ", both ways" : ""}
                </span>
                <span className="font-mono text-ink" data-testid="pickup-price">
                  {naira(arrivalPrice + depPrice)}
                </span>
              </div>
              {!desk && point.leadTimeHours > 0 && (
                <p className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                  <WarningCircle size={13} /> Book at least {point.leadTimeHours} hours ahead.
                </p>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
