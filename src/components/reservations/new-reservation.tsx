"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, CalendarBlank, Clock, Crown, MagnifyingGlass, MoonStars, Sun, UserCircleCheck, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useStore, toast } from "@/lib/store";
import { newReservationStore, type NewReservationPrefill } from "@/lib/store-m2";
import { useRoomTypes } from "@/lib/api/hooks";
import { useAvailability, useRoomAvailability } from "@/lib/api/hooks-m2";
import { guestsApi, reservationsApi } from "@/lib/api/endpoints-m2";
import { normalisePhone, useDeskRefresh } from "@/lib/api/mutations-m2";
import { isApiError } from "@/lib/api/client";
import type { Guest, StayType } from "@/lib/api/types-m2";
import { useEntitlements } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import { addDays, diffDays, formatDay, lagosIso, todayKey } from "@/lib/dates";
import { SOURCES, SOURCE_ORDER, type ReservationSource } from "@/lib/catalog-m2";
import { formatPhone, naira } from "@/lib/format";
import { Sheet } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Segmented, Skeleton } from "@/components/ui/primitives";
import { ChipRadio, NairaInput, Stepper } from "@/components/m2/bits";
import { LockedInline } from "@/components/gating/gate";
import type { StayQuote } from "@/lib/api/types-m4";
import { StayPricing, type PricingChoice } from "./stay-pricing";
import { useRenderedForm } from "@/lib/api/hooks-m7";
import type { ExtraSelection, PickupAnswer } from "@/lib/api/types-m7";
import { FormAnswers, checkAnswers, cleanAnswers, type StayContext } from "@/components/guest-form/renderer";
import { extrasTotal } from "@/components/guest-form/extras-picker";
import { transferPrice, transfersFromPickup } from "@/components/guest-form/pickup-block";

/** Mounted once in the shell; opened through `openNewReservation()`. */
export function NewReservationHost() {
  const prefill = useStore(newReservationStore);
  return (
    <Sheet
      open={!!prefill}
      onOpenChange={(o) => !o && newReservationStore.set(null)}
      eyebrow="Front desk"
      title="New reservation"
      width="sm:max-w-[640px]"
      description="Availability updates as you choose dates."
    >
      {prefill && <NewReservationForm key={JSON.stringify(prefill)} prefill={prefill} onDone={() => newReservationStore.set(null)} />}
    </Sheet>
  );
}

const TIMES = Array.from({ length: 29 }, (_, i) => {
  const m = 6 * 60 + i * 30;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
});

function NewReservationForm({ prefill, onDone }: { prefill: NewReservationPrefill; onDone: () => void }) {
  const router = useRouter();
  const refresh = useDeskRefresh();
  const { has } = useEntitlements();
  const { can } = useCan();
  const types = useRoomTypes();
  const today = todayKey();

  const [stayType, setStayType] = useState<StayType>(prefill.stayType ?? "NIGHTLY");
  const [arrival, setArrival] = useState(prefill.arrival && prefill.arrival >= addDays(today, -1) ? prefill.arrival : today);
  const [nights, setNights] = useState(prefill.arrival && prefill.departure ? Math.max(1, diffDays(prefill.arrival, prefill.departure)) : 1);
  const [startTime, setStartTime] = useState("12:00");
  const [hours, setHours] = useState(3);
  const [roomTypeId, setRoomTypeId] = useState(prefill.roomTypeId ?? "");
  const [roomId, setRoomId] = useState(prefill.roomId ?? "");
  const [phone, setPhone] = useState(prefill.phone ?? "");
  const [found, setFound] = useState<Guest | null>(null);
  const [lookup, setLookup] = useState<"idle" | "looking" | "none">("idle");
  const [fullName, setFullName] = useState(prefill.guestName ?? "");
  const [email, setEmail] = useState("");
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [source, setSource] = useState<ReservationSource>("WALK_IN");
  const [status, setStatus] = useState<"CONFIRMED" | "PENDING">("CONFIRMED");
  const [notes, setNotes] = useState("");
  const [rate, setRate] = useState<number | null>(null);
  const [pricing, setPricing] = useState<PricingChoice>({ ratePlanId: null, promoCode: null, corporateAccountId: null });
  const [quote, setQuote] = useState<StayQuote | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [extrasSel, setExtrasSel] = useState<ExtraSelection[]>([]);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const phoneRef = useRef<HTMLInputElement>(null);
  // the hotel's published booking form, as the front desk sees it (API-M7 2.4)
  const deskForm = useRenderedForm("FRONT_DESK", "published", can("reservations.write"));
  const form = deskForm.data && deskForm.data.fields.some((f) => !f.boundTo) ? deskForm.data : null;

  const departure = addDays(arrival, nights);
  const dayUse = stayType === "DAY_USE";
  const arrivalAt = dayUse ? lagosIso(arrival, startTime) : undefined;
  const departureAt = dayUse ? new Date(+new Date(arrivalAt!) + hours * 3600_000).toISOString() : undefined;

  // availability per type over the nights of the stay (the last night is departure - 1)
  const avail = useAvailability(arrival, dayUse ? arrival : addDays(departure, -1));
  const typeAvail = useMemo(() => {
    const m = new Map<string, { min: number; nights: number[] }>();
    for (const t of avail.data?.roomTypes ?? []) {
      const n = t.days.map((d) => d.available);
      m.set(t.roomType.id, { min: n.length ? Math.min(...n) : 0, nights: n });
    }
    return m;
  }, [avail.data]);

  const roomQ = roomTypeId
    ? dayUse
      ? { roomTypeId, stayType, arrivalAt, departureAt }
      : { roomTypeId, stayType, arrivalDate: arrival, departureDate: departure }
    : null;
  const rooms = useRoomAvailability(roomQ);
  const selectedType = types.data?.find((t) => t.id === roomTypeId);
  const unitRate = rate ?? (dayUse ? selectedType?.hourlyPriceKobo : selectedType?.basePriceKobo) ?? 0;
  const units = dayUse ? hours : nights;

  // clear a pre-picked room that is no longer free
  useEffect(() => {
    if (!roomId || !rooms.data) return;
    const r = rooms.data.rooms.find((x) => x.id === roomId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- drop a stale room choice after availability changes
    if (!r || !r.free) setRoomId("");
  }, [rooms.data, roomId]);

  // look the guest up by phone (debounced)
  useEffect(() => {
    if (prefill.guestId) return;
    const norm = normalisePhone(phone);
    if (!norm) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset lookup when the number is incomplete
      setFound(null);
      setLookup("idle");
      return;
    }
    setLookup("looking");
    const id = window.setTimeout(() => {
      guestsApi
        .lookup(norm)
        .then((g) => {
          setFound(g);
          setLookup("idle");
        })
        .catch(() => {
          setFound(null);
          setLookup("none");
        });
    }, 350);
    return () => window.clearTimeout(id);
  }, [phone, prefill.guestId]);

  const stayCtx: StayContext = { arrival, departure: dayUse ? arrival : departure, adults, children, phone: normalisePhone(phone) ?? undefined };
  const pickupField = form?.fields.find((f) => f.type === "PICKUP");
  const pickupAnswer = pickupField ? (answers[pickupField.key] as PickupAnswer | undefined) : undefined;
  const transfers = transfersFromPickup(pickupAnswer);
  const addOnsKobo =
    (form ? extrasTotal(form.extras, extrasSel, { nights: dayUse ? 1 : nights, guests: adults + children }) : 0) +
    transfers.reduce((sum, t) => {
      const p = form?.pickup?.points.find((x) => x.id === t.pickupPointId);
      return sum + (p ? transferPrice(p, t.direction, t.vehicleOptionId) : 0);
    }, 0);

  const create = useMutation({
    mutationFn: () => {
      const e: Record<string, string> = {};
      if (!roomTypeId) e.roomTypeId = "Choose a room type";
      const norm = normalisePhone(phone);
      if (!prefill.guestId && !found) {
        if (!norm) e.phone = "Enter a Nigerian number like 0803 123 4567, or +44 for abroad";
        if (fullName.trim().length < 2) e.fullName = "Enter the guest's full name";
      }
      setErrors(e);
      const fe = form ? checkAnswers(form, answers, stayCtx, true) : {};
      setFormErrors(fe);
      if (Object.keys(e).length || Object.keys(fe).length) throw new Error("Check the highlighted fields");
      return reservationsApi.create({
        ...(form
          ? {
              formAnswers: cleanAnswers(form, answers, stayCtx),
              extras: extrasSel.length ? extrasSel : undefined,
              transfers: transfers.length ? transfers.map((t) => ({ ...t, details: pickupAnswer?.details, luggage: pickupAnswer?.luggage ?? null, contactPhone: pickupAnswer?.contactPhone ?? null })) : undefined,
            }
          : {}),
        roomTypeId,
        roomId: roomId || undefined,
        stayType,
        ...(dayUse ? { arrivalAt, departureAt } : { arrivalDate: arrival, departureDate: departure }),
        guestId: prefill.guestId ?? found?.id,
        guest:
          prefill.guestId || found
            ? undefined
            : { fullName: fullName.trim(), phone: norm!, email: email.trim() || undefined, consent: true },
        adults,
        children,
        source,
        status,
        notes: notes.trim() || undefined,
        rateKobo: rate ?? undefined,
        ...(dayUse
          ? {}
          : {
              ratePlanId: pricing.ratePlanId ?? quote?.ratePlan.id ?? undefined,
              promoCode: pricing.promoCode && quote?.promo ? pricing.promoCode : undefined,
              corporateAccountId: pricing.corporateAccountId ?? undefined,
              source: pricing.corporateAccountId && source === "WALK_IN" ? ("CORPORATE" as ReservationSource) : source,
            }),
      });
    },
    onSuccess: async (r) => {
      await refresh();
      toast.success(`${r.code} booked`, `${r.guest.fullName}, ${r.room ? `room ${r.room.number}` : r.roomType.name}`, {
        label: "Open",
        onClick: () => router.push(`/reservations/${r.id}`),
      });
      onDone();
    },
    meta: { errorTitle: "Reservation not saved" },
    onError: (e) => {
      if (isApiError(e) && e.code === "ROOM_UNAVAILABLE") void refresh([["availability"]]);
      if (isApiError(e) && e.code === "VALIDATION_ERROR") {
        // answers.<key>[...] and transfers[i] issues land on their question (API-M7 0.4)
        const issues = (e.details as { issues?: { path: string; fieldKey: string | null; message: string }[] })?.issues ?? [];
        const fe: Record<string, string> = {};
        for (const i of issues) {
          const key = i.fieldKey ?? /^answers\.([^.[\]]+)/.exec(i.path)?.[1] ?? (/^transfers\[/.test(i.path) ? pickupField?.key : undefined);
          if (key && !fe[key]) fe[key] = i.message;
        }
        setFormErrors(fe);
      }
    },
  });

  return (
    <form
      className="flex flex-col gap-7 pb-2"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
      onKeyDown={(e) => {
        if ((e.metaKey || e.ctrlKey) && e.key === "Enter") create.mutate();
      }}
    >
      {/* 01 stay */}
      <Section n="01" title="The stay">
        <Segmented<StayType>
          label="Stay type"
          value={stayType}
          onChange={(v) => {
            if (v === "DAY_USE" && !has("hourly_bookings")) return;
            setStayType(v);
          }}
          options={[
            { value: "NIGHTLY", label: "Overnight", icon: <MoonStars size={14} weight="duotone" /> },
            { value: "DAY_USE", label: "Day use", icon: <Sun size={14} weight="duotone" /> },
          ]}
        />
        {!has("hourly_bookings") && stayType === "NIGHTLY" && (
          <p className="mt-2 text-[12px] text-ink-faint">Day use (by the hour) needs hourly bookings on your plan.</p>
        )}
        {dayUse && !has("hourly_bookings") && <LockedInline feature="hourly_bookings" className="mt-3" />}
        <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto]">
          <Field label={dayUse ? "Date" : "Arrival"} htmlFor="nr-arrival">
            <div className="relative">
              <CalendarBlank size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
              <Input
                id="nr-arrival"
                type="date"
                min={addDays(today, -1)}
                value={arrival}
                onChange={(e) => e.target.value && setArrival(e.target.value)}
                className="pl-9 font-mono"
              />
            </div>
          </Field>
          {dayUse ? (
            <div className="flex gap-3">
              <Field label="From" htmlFor="nr-time">
                <div className="relative">
                  <Clock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                  <select
                    id="nr-time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="h-10 appearance-none rounded-md border border-line-strong bg-surface pl-9 pr-3 font-mono text-[14px] text-ink outline-none focus:border-laterite"
                  >
                    {TIMES.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </Field>
              <Field label="Hours">
                <Stepper label="hours" value={hours} onChange={setHours} min={2} max={12} suffix="h" />
              </Field>
            </div>
          ) : (
            <Field label="Nights">
              <Stepper label="nights" value={nights} onChange={setNights} min={1} max={60} />
            </Field>
          )}
        </div>
        <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-muted">
          <ArrowRight size={13} />
          {dayUse ? (
            <span>
              {formatDay(arrival)}, <span className="font-mono text-ink">{startTime}</span> to{" "}
              <span className="font-mono text-ink">{departureAt ? new Date(departureAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Africa/Lagos" }) : ""}</span>
            </span>
          ) : (
            <span>
              In <span className="text-ink">{formatDay(arrival)}</span>, out <span className="text-ink">{formatDay(departure)}</span>
            </span>
          )}
        </p>
      </Section>

      {/* 02 room */}
      <Section n="02" title="Room" error={errors.roomTypeId}>
        <div className="flex flex-col gap-1.5" role="radiogroup" aria-label="Room type">
          {types.isLoading
            ? Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-[58px] w-full" />)
            : types.data?.map((t) => {
                const a = typeAvail.get(t.id);
                const price = dayUse ? t.hourlyPriceKobo : t.basePriceKobo;
                const full = a ? a.min <= 0 : false;
                const disabled = full || (dayUse && !t.hourlyPriceKobo);
                const on = t.id === roomTypeId;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={disabled}
                    onClick={() => {
                      setRoomTypeId(t.id);
                      setRoomId("");
                    }}
                    className={cn(
                      "group flex items-center gap-4 rounded-md border px-3.5 py-2.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      on ? "border-laterite bg-laterite-wash/60 shadow-[inset_3px_0_0_var(--laterite)]" : "border-line hover:border-line-strong hover:bg-surface-2/50",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-ink">{t.name}</span>
                      <span className="block text-[12px] text-ink-muted">
                        {price ? (
                          <>
                            <span className="font-mono text-ink">{naira(price)}</span> {dayUse ? "an hour" : "a night"}
                          </>
                        ) : (
                          "No hourly rate set"
                        )}
                        {t.capacity ? <> &middot; sleeps {t.capacity}</> : null}
                      </span>
                    </span>
                    {a && (
                      <span className="flex items-end gap-[2px]" aria-hidden title="Rooms left each night">
                        {a.nights.slice(0, 14).map((n, i) => (
                          <span
                            key={i}
                            className="w-[5px] rounded-[1px]"
                            style={{
                              height: 6 + Math.min(n, 8) * 2,
                              background: n <= 0 ? "var(--danger)" : n <= 1 ? "var(--ochre)" : "var(--palm)",
                              opacity: 0.8,
                            }}
                          />
                        ))}
                      </span>
                    )}
                    <span
                      className={cn(
                        "w-[64px] shrink-0 text-right font-mono text-[12.5px]",
                        !a ? "text-ink-faint" : a.min <= 0 ? "text-danger" : a.min <= 1 ? "text-ochre" : "text-palm",
                      )}
                    >
                      {avail.isFetching && !a ? "..." : !a ? "" : a.min <= 0 ? "full" : `${a.min} left`}
                    </span>
                  </button>
                );
              })}
        </div>

        {roomTypeId && (
          <div className="mt-4">
            <p className="mb-2 text-[12.5px] text-ink-muted">Assign a room now, or leave it for check-in.</p>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Room">
              <RoomChip on={!roomId} onClick={() => setRoomId("")}>
                Any room
              </RoomChip>
              {rooms.data?.rooms
                .filter((r) => r.free)
                .map((r) => (
                  <RoomChip key={r.id} on={roomId === r.id} onClick={() => setRoomId(r.id)} title={r.clean ? "Clean" : "Needs cleaning"}>
                    <span className={cn("h-1.5 w-1.5 rounded-full", r.clean ? "bg-palm" : "bg-ochre")} aria-hidden />
                    <span className="font-mono">{r.number}</span>
                  </RoomChip>
                ))}
              {rooms.data && !rooms.data.rooms.some((r) => r.free) && (
                <span className="self-center text-[12.5px] text-danger">No room of this type is free for these dates.</span>
              )}
            </div>
          </div>
        )}
      </Section>

      {roomTypeId && !dayUse && (
        <Section n="02b" title="Price">
          <StayPricing
            roomTypeId={roomTypeId}
            arrival={arrival}
            departure={departure}
            adults={adults}
            kids={children}
            phone={normalisePhone(phone)}
            value={pricing}
            onChange={setPricing}
            onQuote={setQuote}
          />
        </Section>
      )}

      {/* 03 guest */}
      <Section n="03" title="Guest">
        {prefill.guestId ? (
          <GuestCard name={prefill.guestName ?? "Selected guest"} />
        ) : (
          <div className="flex flex-col gap-4">
            <Field label="Phone" htmlFor="nr-phone" error={errors.phone} hint="We look returning guests up by phone.">
              <div className="relative">
                <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <Input
                  ref={phoneRef}
                  id="nr-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder="0803 123 4567"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  aria-invalid={!!errors.phone}
                  className="pl-9 font-mono"
                />
                {lookup === "looking" && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11.5px] text-ink-faint">looking up</span>
                )}
              </div>
            </Field>
            {found ? (
              <GuestCard
                name={found.fullName}
                vip={found.vip}
                sub={`${found.stayCount} ${found.stayCount === 1 ? "stay" : "stays"}${found.company ? ` · ${found.company}` : ""} · ${formatPhone(found.phone)}`}
                onClear={() => {
                  setFound(null);
                  setPhone("");
                  phoneRef.current?.focus();
                }}
              />
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" htmlFor="nr-name" error={errors.fullName}>
                  <Input id="nr-name" value={fullName} onChange={(e) => setFullName(e.target.value)} aria-invalid={!!errors.fullName} autoComplete="off" />
                </Field>
                <Field label="Email" htmlFor="nr-email" optional>
                  <Input id="nr-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
                </Field>
              </div>
            )}
            {lookup === "none" && !found && <p className="-mt-2 text-[12px] text-ink-faint">New guest. The register is completed at check-in.</p>}
          </div>
        )}
      </Section>

      {form && (
        <Section n="03b" title="What we ask" error={Object.keys(formErrors).length ? "Some answers need a look" : undefined}>
          <FormAnswers form={form} answers={answers} onAnswers={setAnswers} extras={extrasSel} onExtras={setExtrasSel} stay={stayCtx} errors={formErrors} desk />
        </Section>
      )}

      {/* 04 details */}
      <Section n="04" title="Details">
        <div className="flex flex-wrap gap-6">
          <Field label="Adults">
            <Stepper label="adults" value={adults} onChange={setAdults} min={1} max={10} />
          </Field>
          <Field label="Children">
            <Stepper label="children" value={children} onChange={setChildren} min={0} max={10} />
          </Field>
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <span className="text-[13px] font-medium text-ink">Booked through</span>
          <ChipRadio label="Source" value={source} onChange={setSource} options={SOURCE_ORDER.map((s) => ({ value: s, label: SOURCES[s] }))} />
        </div>
        <div className="mt-5 flex flex-col gap-2">
          <span className="text-[13px] font-medium text-ink">Status</span>
          <ChipRadio
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "CONFIRMED", label: "Confirmed" },
              { value: "PENDING", label: "Pending (hold)" },
            ]}
          />
        </div>
        {can("rate.override") && (
          <Field label="Rate" htmlFor="nr-rate" optional className="mt-5" hint={`Leave empty for the standard ${dayUse ? "hourly" : "nightly"} rate.`}>
            <NairaInput id="nr-rate" kobo={rate} onChange={setRate} placeholder={selectedType ? String(Math.round(((dayUse ? selectedType.hourlyPriceKobo : selectedType.basePriceKobo) ?? 0) / 100)) : "0"} />
          </Field>
        )}
        <Field label="Notes" htmlFor="nr-notes" optional className="mt-5">
          <Textarea id="nr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Late arrival, airport pickup, cot for a child ..." className="min-h-20" />
        </Field>
      </Section>

      {/* summary */}
      <div className="sticky bottom-0 -mx-6 -mb-5 flex flex-wrap items-center gap-3 border-t border-line bg-surface/95 px-6 py-3.5 backdrop-blur-[4px]">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-ink-muted">
            {units} {dayUse ? (units === 1 ? "hour" : "hours") : units === 1 ? "night" : "nights"}
            {selectedType ? ` · ${selectedType.name}` : ""} &middot; {quote && !dayUse && rate == null ? `${quote.ratePlan.name}, with tax` : "before tax"}
          </p>
          <p className="font-mono text-[20px] leading-tight text-ink">{naira((quote && !dayUse && rate == null ? quote.breakdown.totalKobo : unitRate * units) + addOnsKobo)}</p>
          {addOnsKobo > 0 && <p className="text-[11.5px] text-ink-muted" data-testid="addons-total">with {naira(addOnsKobo)} of extras and pickups, before their tax</p>}
        </div>
        <Button type="submit" size="lg" loading={create.isPending} disabled={dayUse && !has("hourly_bookings")}>
          Book it
          <span className="kbd hidden border-[color-mix(in_oklab,var(--laterite-ink)_35%,transparent)] bg-transparent text-[color-mix(in_oklab,var(--laterite-ink)_80%,transparent)] sm:inline">
            ⌘↵
          </span>
        </Button>
      </div>
    </form>
  );
}

function Section({ n, title, children, error }: { n: string; title: string; children: React.ReactNode; error?: string }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline gap-3 border-b border-dashed border-line pb-2">
        <span className="font-mono text-[11px] text-laterite">{n}</span>
        <h3 className="display-sm text-[17px] text-ink">{title}</h3>
        {error && (
          <span role="alert" className="ml-auto text-[12.5px] text-danger">
            {error}
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function RoomChip({ on, onClick, children, title }: { on: boolean; onClick: () => void; children: React.ReactNode; title?: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      title={title}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-sm border px-2.5 text-[13px] transition-colors",
        on ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink hover:border-ink-faint",
      )}
    >
      {children}
    </button>
  );
}

function GuestCard({ name, vip, sub, onClear }: { name: string; vip?: boolean; sub?: string; onClear?: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-md border border-[color-mix(in_oklab,var(--palm)_35%,transparent)] bg-palm-wash/60 px-3.5 py-3">
      <UserCircleCheck size={22} weight="duotone" className="shrink-0 text-palm" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-[14px] font-medium text-ink">
          {name}
          {vip && <Crown size={13} weight="fill" className="text-brass" aria-label="VIP" />}
        </p>
        {sub && <p className="truncate text-[12.5px] text-ink-muted">Returning guest &middot; {sub}</p>}
      </div>
      {onClear && (
        <button type="button" onClick={onClear} className="grid h-7 w-7 place-items-center rounded-sm text-ink-muted hover:bg-surface hover:text-ink" aria-label="Not this guest">
          <X size={14} />
        </button>
      )}
    </div>
  );
}

