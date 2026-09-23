"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  Broom,
  Check,
  CloudArrowUp,
  Key,
  Printer,
  SealCheck,
  SignIn,
  WarningCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/store";
import { useMe } from "@/lib/api/hooks";
import { useCurrentShift, useReservation, useRoomAvailability } from "@/lib/api/hooks-m2";
import { guestsApi, reservationsApi } from "@/lib/api/endpoints-m2";
import { normalisePhone, useDeskRefresh } from "@/lib/api/mutations-m2";
import { errorMessage, isApiError } from "@/lib/api/client";
import type { CheckInInput, Gender, ReservationDetail, RoomAvailability } from "@/lib/api/types-m2";
import { deskAction } from "@/lib/offline/desk-action";
import { useOnline } from "@/lib/offline/network";
import { useEntitlements } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import { dayKeyOf, formatDay, lagosHHMM, todayKey } from "@/lib/dates";
import { formatPhone, naira } from "@/lib/format";
import { ID_TYPES, ID_TYPE_ORDER, PURPOSES, PURPOSE_ORDER, type IdType, type PaymentMethod, type Purpose } from "@/lib/catalog-m2";
import { Button, ButtonLink } from "@/components/ui/button";
import { Checkbox, Field, Textarea } from "@/components/ui/form";
import { ErrorState, Panel, Skeleton } from "@/components/ui/primitives";
import { StatusSwatch } from "@/components/keyrack/status-swatch";
import { AdireRule } from "@/components/motifs/adire";
import { ChipRadio, NairaInput } from "@/components/m2/bits";
import { IdCapture, type IdCaptureState } from "./id-capture";

export function CheckInView({ id }: { id: string }) {
  const q = useReservation(id);
  const search = useSearchParams();
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} className="py-24" />;
  if (!q.data)
    return (
      <div className="grid gap-6 lg:grid-cols-12">
        <Skeleton className="h-[720px] lg:col-span-8" />
        <Skeleton className="h-[420px] lg:col-span-4" />
      </div>
    );
  return <CheckIn r={q.data} registerOnly={search.get("register") === "1" || q.data.status === "CHECKED_IN"} />;
}

interface CardState {
  fullName: string;
  phone: string;
  email: string;
  gender: Gender | "";
  dateOfBirth: string;
  nationality: string;
  address: string;
  company: string;
  idType: IdType | "";
  idNumber: string;
  arrivingFrom: string;
  goingTo: string;
  purpose: Purpose | "";
  vehiclePlate: string;
  consent: boolean;
}

function CheckIn({ r, registerOnly }: { r: ReservationDetail; registerOnly: boolean }) {
  const router = useRouter();
  const me = useMe();
  const refresh = useDeskRefresh();
  const online = useOnline();
  const { has } = useEntitlements();
  const { can } = useCan();
  const g = r.guest;
  const [card, setCard] = useState<CardState>({
    fullName: g.fullName,
    phone: g.phone ? formatPhone(g.phone) : "",
    email: g.email ?? "",
    gender: g.gender ?? "",
    dateOfBirth: g.dateOfBirth ?? "",
    nationality: g.nationality || "Nigerian",
    address: g.address ?? "",
    company: g.company ?? "",
    idType: g.idType ?? "",
    idNumber: "",
    arrivingFrom: r.registration?.arrivingFrom ?? "",
    goingTo: r.registration?.goingTo ?? "",
    purpose: r.registration?.purpose ?? "",
    vehiclePlate: r.registration?.vehiclePlate ?? g.vehiclePlate ?? "",
    consent: !!g.consentAt,
  });
  const set = <K extends keyof CardState>(k: K, v: CardState[K]) => setCard((c) => ({ ...c, [k]: v }));
  const [idState, setIdState] = useState<IdCaptureState>({ status: "empty" });
  const [roomId, setRoomId] = useState(r.room?.id ?? "");
  const [registerLater, setRegisterLater] = useState(false);
  const [deposit, setDeposit] = useState<number | null>(null);
  const [depositMethod, setDepositMethod] = useState<PaymentMethod>("CASH");
  const [depositRef, setDepositRef] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [showErrors, setShowErrors] = useState(false);
  const [done, setDone] = useState<{ queued: boolean; room: string } | null>(null);

  const rooms = useRoomAvailability(
    registerOnly
      ? null
      : r.stayType === "DAY_USE"
        ? { roomTypeId: r.roomType.id, stayType: "DAY_USE", arrivalAt: r.arrivalAt, departureAt: r.departureAt, excludeReservationId: r.id, forCheckIn: true }
        : { roomTypeId: r.roomType.id, stayType: "NIGHTLY", arrivalDate: r.arrivalDate, departureDate: r.departureDate, excludeReservationId: r.id, forCheckIn: true },
  );
  const shift = useCurrentShift(can("shift.own"));
  // check-in now: offer rooms that are ready; a manager may also pick a dirty one with a reason
  const allRooms = rooms.data?.rooms ?? [];
  const readyRooms = allRooms.filter(isReady).sort(byNumber);
  const overridable = can("override") ? allRooms.filter((x) => !isReady(x) && isDirtyOnly(x)).sort(byNumber) : [];
  const notReady = allRooms.filter((x) => !isReady(x) && !overridable.includes(x)).sort(byNumber);
  const chosen = [...readyRooms, ...overridable].find((x) => x.id === roomId);
  const dirty = chosen && !isReady(chosen);
  const hasId = !!card.idType && (card.idNumber.trim().length >= 4 || !!g.idNumberMasked);

  const missing = useMemo(() => {
    const m: string[] = [];
    if (!card.arrivingFrom.trim()) m.push("arrivingFrom");
    if (!card.goingTo.trim()) m.push("goingTo");
    if (!card.purpose) m.push("purpose");
    if (!card.idType) m.push("idType");
    if (!hasId) m.push("idNumber");
    return m;
  }, [card, hasId]);
  const invalid = (k: string) => showErrors && !registerLater && missing.includes(k);

  const uploadId = async () => {
    if (idState.status !== "ready" && idState.status !== "error") return;
    const { file, name, preview } = idState;
    setIdState({ status: "uploading", file, name, preview });
    try {
      await guestsApi.uploadIdImage(g.id, file, name);
      setIdState({ status: "uploaded", preview, name });
    } catch (e) {
      setIdState({ status: "error", file, name, preview, message: errorMessage(e) });
    }
  };

  const guestPatch = () => {
    const patch: NonNullable<CheckInInput["guest"]> = {};
    if (card.fullName.trim() && card.fullName.trim() !== g.fullName) patch.fullName = card.fullName.trim();
    const ph = normalisePhone(card.phone);
    if (ph && ph !== g.phone) patch.phone = ph;
    if (card.email.trim() !== (g.email ?? "")) patch.email = card.email.trim() || undefined;
    if (card.gender && card.gender !== g.gender) patch.gender = card.gender;
    if (card.dateOfBirth && card.dateOfBirth !== g.dateOfBirth) patch.dateOfBirth = card.dateOfBirth;
    if (card.nationality.trim() && card.nationality !== g.nationality) patch.nationality = card.nationality.trim();
    if (card.address.trim() !== (g.address ?? "")) patch.address = card.address.trim() || undefined;
    if (card.company.trim() !== (g.company ?? "")) patch.company = card.company.trim() || undefined;
    if (card.idType && card.idType !== g.idType) patch.idType = card.idType;
    if (card.idNumber.trim()) patch.idNumber = card.idNumber.trim();
    if (card.vehiclePlate.trim()) patch.vehiclePlate = card.vehiclePlate.trim();
    if (card.consent && !g.consentAt) patch.consent = true;
    return Object.keys(patch).length ? patch : undefined;
  };

  const registration = () =>
    missing.some((k) => ["arrivingFrom", "goingTo", "purpose"].includes(k))
      ? undefined
      : {
          arrivingFrom: card.arrivingFrom.trim(),
          goingTo: card.goingTo.trim(),
          purpose: card.purpose as Purpose,
          vehiclePlate: card.vehiclePlate.trim() || undefined,
        };

  const checkIn = useMutation({
    mutationFn: async () => {
      setShowErrors(true);
      if (!chosen) throw new Error("Choose a room that is ready for the guest");
      if (missing.length && !registerLater) throw new Error("Complete the register card, or tick “complete it later”");
      if (!card.consent) throw new Error("The guest needs to consent to the register being kept");
      if (dirty && !overrideReason.trim()) throw new Error("Give a reason for checking into a room that isn't clean");
      const room = chosen;
      const body: CheckInInput = {
        roomId: chosen.id,
        guest: guestPatch(),
        registration: registration(),
        registerLater: missing.length ? true : undefined,
        deposit: deposit ? { amountKobo: deposit, method: depositMethod, reference: depositRef.trim() || undefined } : undefined,
        override: dirty ? { reason: overrideReason.trim() } : undefined,
      };
      const res = await deskAction<ReservationDetail>({
        kind: "check-in",
        title: `Check in ${card.fullName}`,
        subtitle: `${r.code} · room ${room?.number ?? ""}`,
        method: "POST",
        path: `/reservations/${r.id}/check-in`,
        body: body as Record<string, unknown>,
        offlineAllowed: has("offline_mode"),
        invalidate: [["reservations"], ["folio"]],
      });
      if (!res.queued) void uploadId();
      return { res, room: room?.number ?? "" };
    },
    onSuccess: async ({ res, room }) => {
      if (!res.queued) await refresh();
      setDone({ queued: res.queued, room });
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "REGISTRATION_INCOMPLETE") setShowErrors(true);
    },
    meta: { errorTitle: "Not checked in" },
  });

  const saveRegister = useMutation({
    mutationFn: async () => {
      setShowErrors(true);
      const reg = registration();
      if (!reg || !hasId) throw new Error("Fill in the travel details and the guest's ID");
      await reservationsApi.registration(r.id, { ...reg, guest: guestPatch() });
      await uploadId();
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Register completed", `${card.fullName}, room ${r.room?.number ?? ""}`);
      router.push(`/reservations/${r.id}`);
    },
    meta: { errorTitle: "Register not saved" },
  });

  if (done) return <CheckedIn r={r} done={done} name={card.fullName} idState={idState} onRetryId={uploadId} />;

  const staff = me.data?.user.fullName ?? "";
  const nights = r.stayType === "DAY_USE" ? null : r.nights;

  return (
    <>
      <Link href={`/reservations/${r.id}`} className="no-print mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> {r.code}
      </Link>
      <div className="no-print mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">{registerOnly ? "Guest register" : "Check in"} &middot; {r.code}</p>
          <h1 className="display text-[34px] leading-[1.02] text-ink md:text-[44px]">
            {registerOnly ? (
              <>
                Complete the <em>register</em>
              </>
            ) : (
              <>
                Welcome, <em>{card.fullName.split(" ")[0]}</em>.
              </>
            )}
          </h1>
        </div>
        <Button variant="ghost" onClick={() => window.print()}>
          <Printer size={16} weight="duotone" /> Print card
        </Button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-12">
        {/* ---------------- the card ---------------- */}
        <form
          className="register-card relative overflow-hidden rounded-[4px] lg:col-span-8"
          onSubmit={(e) => {
            e.preventDefault();
            if (registerOnly) saveRegister.mutate();
            else checkIn.mutate();
          }}
          aria-label="Guest registration card"
        >
          <div className="perforation" aria-hidden />
          <div className="px-5 pb-6 pt-3 sm:px-8 sm:pb-8">
            {/* masthead */}
            <div className="flex items-start justify-between gap-4 border-b-2 border-double border-[color-mix(in_oklab,var(--laterite)_55%,transparent)] pb-3">
              <div className="min-w-0">
                <p className="display-sm truncate text-[20px] leading-tight text-ink sm:text-[24px]" style={{ fontVariationSettings: '"opsz" 72, "SOFT" 60' }}>
                  {me.data?.tenant.name}
                </p>
                <p className="card-label mt-1 text-laterite">Guest registration card</p>
              </div>
              <div className="stamp shrink-0 rotate-[-2deg] px-3 py-1.5 text-center text-laterite">
                <p className="card-label text-[8.5px] text-laterite">No.</p>
                <p className="font-mono text-[14px] font-semibold tracking-wider">{r.code}</p>
              </div>
            </div>

            <CardSection title="The guest">
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-6">
                <CardField label="Full name" className="sm:col-span-4" value={card.fullName} onChange={(v) => set("fullName", v)} autoComplete="off" />
                <CardField label="Nationality" className="sm:col-span-2" value={card.nationality} onChange={(v) => set("nationality", v)} />
                <CardField label="Phone" className="sm:col-span-2" value={card.phone} onChange={(v) => set("phone", v)} mono type="tel" placeholder={formatPhone(g.phone)} />
                <CardField label="Email" className="sm:col-span-2" value={card.email} onChange={(v) => set("email", v)} type="email" />
                <CardField label="Date of birth" className="sm:col-span-2" value={card.dateOfBirth} onChange={(v) => set("dateOfBirth", v)} type="date" mono />
                <div className="sm:col-span-6">
                  <p className="card-label mb-2">Sex</p>
                  <Boxes
                    value={card.gender}
                    onChange={(v) => set("gender", v)}
                    options={[
                      { value: "MALE", label: "Male" },
                      { value: "FEMALE", label: "Female" },
                      { value: "UNDISCLOSED", label: "Prefer not to say" },
                    ]}
                    label="Sex"
                  />
                </div>
                <CardField label="Home address" className="sm:col-span-4" value={card.address} onChange={(v) => set("address", v)} />
                <CardField label="Company" className="sm:col-span-2" value={card.company} onChange={(v) => set("company", v)} />
              </div>
            </CardSection>

            <CardSection title="Means of identification">
              <div className="grid gap-6 sm:grid-cols-[1fr_200px]">
                <div className="flex flex-col gap-4">
                  <div>
                    <p className={cn("card-label mb-2", invalid("idType") && "text-danger")}>Type</p>
                    <Boxes value={card.idType} onChange={(v) => set("idType", v)} options={ID_TYPE_ORDER.map((t) => ({ value: t, label: ID_TYPES[t] }))} label="ID type" />
                  </div>
                  <CardField
                    label={g.idNumberMasked ? `ID number (on file: ${g.idNumberMasked})` : "ID number"}
                    value={card.idNumber}
                    onChange={(v) => set("idNumber", v)}
                    mono
                    invalid={invalid("idNumber")}
                    placeholder={g.idNumberMasked ? "Leave blank to keep the number on file" : card.idType === "NIN" ? "11 digits" : ""}
                    autoComplete="off"
                  />
                  <p className="text-[11.5px] leading-snug text-ink-faint">
                    ID numbers are encrypted at rest and shown masked everywhere else. Revealing one is logged.
                  </p>
                </div>
                <IdCapture
                  state={idState}
                  hasExisting={g.hasIdImage}
                  onFile={(file, name, preview) => setIdState({ status: "ready", file, name, preview })}
                />
              </div>
            </CardSection>

            <CardSection title="Travel">
              <div className="grid gap-x-6 gap-y-4 sm:grid-cols-6">
                <CardField label="Arriving from" className="sm:col-span-3" value={card.arrivingFrom} onChange={(v) => set("arrivingFrom", v)} invalid={invalid("arrivingFrom")} list="places" />
                <CardField label="Going to" className="sm:col-span-3" value={card.goingTo} onChange={(v) => set("goingTo", v)} invalid={invalid("goingTo")} list="places" />
                <div className="sm:col-span-4">
                  <p className={cn("card-label mb-2", invalid("purpose") && "text-danger")}>Purpose of visit</p>
                  <Boxes value={card.purpose} onChange={(v) => set("purpose", v)} options={PURPOSE_ORDER.map((p) => ({ value: p, label: PURPOSES[p] }))} label="Purpose" />
                </div>
                <CardField label="Vehicle reg. no." className="sm:col-span-2" value={card.vehiclePlate} onChange={(v) => set("vehiclePlate", v.toUpperCase())} mono placeholder="LND-123XA" />
              </div>
              <datalist id="places">
                {["Lagos", "Abuja", "Ibadan", "Port Harcourt", "Enugu", "Benin City", "Kano", "Abeokuta", "Owerri", "Calabar", "Accra", "London"].map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </CardSection>

            <CardSection title="The stay">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
                <Printed label="Room" value={r.room?.number ?? (chosen?.number || "-")} big />
                <Printed label="Arrival" value={`${formatDay(r.arrivalDate, { day: "numeric", month: "short" })} ${lagosHHMM(r.arrivalAt)}`} />
                <Printed label="Departure" value={`${formatDay(r.departureDate, { day: "numeric", month: "short" })} ${lagosHHMM(r.departureAt)}`} />
                <Printed label={nights ? "Nights" : "Hours"} value={String(nights ?? r.hours ?? "")} />
                <Printed label="Guests" value={`${r.adults}${r.children ? ` + ${r.children}` : ""}`} />
              </div>
              <p className="mt-3 font-mono text-[12px] text-ink-muted">
                Rate {naira(r.rateKobo)} per {r.stayType === "DAY_USE" ? "hour" : "night"}, plus applicable taxes.
              </p>
            </CardSection>

            <div className="mt-6 border-t border-dashed border-line-strong pt-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input type="checkbox" className="peer sr-only" checked={card.consent} onChange={(e) => set("consent", e.target.checked)} />
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center border-[1.5px] peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-laterite",
                    card.consent ? "border-ink" : showErrors ? "border-danger" : "border-ink-muted",
                  )}
                >
                  {card.consent && <Check size={13} weight="bold" className="text-ink" />}
                </span>
                <span className="text-[12.5px] leading-snug text-ink-muted">
                  I confirm these details are correct and consent to {me.data?.tenant.name ?? "the hotel"} keeping them in its guest register, as the law
                  requires, under the Nigeria Data Protection Act.
                </span>
              </label>
              {showErrors && !card.consent && (
                <p role="alert" className="mt-2 pl-[30px] text-[12.5px] text-danger">
                  The guest must agree before the register can be kept.
                </p>
              )}
              <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <p className="card-label">Received by</p>
                  <p className="mt-1 text-[14px] italic text-ink" style={{ fontFamily: "var(--font-display)" }}>
                    {staff}
                  </p>
                </div>
                <AdireRule className="h-2.5 w-40 text-[color-mix(in_oklab,var(--laterite)_45%,transparent)]" count={10} />
              </div>
            </div>

            {registerOnly && (
              <div className="no-print mt-6 flex justify-end">
                <Button type="submit" size="lg" loading={saveRegister.isPending}>
                  <SealCheck size={16} weight="bold" /> Save register
                </Button>
              </div>
            )}
          </div>
        </form>

        {/* ---------------- room + money ---------------- */}
        {!registerOnly && (
          <aside className="no-print flex flex-col gap-4 lg:sticky lg:top-20 lg:col-span-4">
            <Panel>
              <div className="border-b border-line px-5 py-4">
                <p className="eyebrow mb-1">Key</p>
                <h2 className="display-sm text-[19px] text-ink">Choose a room</h2>
                <p className="mt-0.5 text-[12.5px] text-ink-muted">{r.roomType.name}, free for the whole stay.</p>
              </div>
              <div className="px-5 py-4">
                {rooms.isLoading ? (
                  <Skeleton className="h-24 w-full" />
                ) : (
                  <div className="flex flex-col gap-4">
                    {readyRooms.length > 0 ? (
                      <RoomGrid label="Room" rooms={readyRooms} value={roomId} onPick={setRoomId} />
                    ) : (
                      <p className="text-[12.5px] text-ink-muted">
                        No {r.roomType.name} is ready right now.
                        {overridable.length ? " A manager can check in to one that still needs cleaning." : " Move the booking on the Ledger, or wait for housekeeping."}
                      </p>
                    )}
                    {overridable.length > 0 && (
                      <div>
                        <p className="mb-2 text-[11.5px] font-medium text-ochre">Needs cleaning (manager override)</p>
                        <RoomGrid label="Needs cleaning" rooms={overridable} value={roomId} onPick={setRoomId} />
                      </div>
                    )}
                    {notReady.length > 0 && (
                      <div>
                        <p className="eyebrow mb-1.5 text-[9.5px]">Not ready</p>
                        <ul className="flex flex-col gap-1">
                          {notReady.map((x) => (
                            <li key={x.id} className="flex items-center gap-2 text-[12.5px] text-ink-muted">
                              <StatusSwatch status={x.status} size={12} />
                              <span className="w-9 font-mono text-ink">{x.number}</span>
                              <span>{notReadyText(x)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
                {dirty && (
                  <div className="mt-4 rounded-md border border-[color-mix(in_oklab,var(--ochre)_45%,transparent)] bg-ochre-wash/70 p-3">
                    <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                      <Broom size={14} weight="duotone" className="text-ochre" /> Room {chosen?.number} isn&rsquo;t marked clean
                    </p>
                    <Textarea
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Why check in anyway? e.g. Inspected by supervisor, status not updated"
                      className="mt-2 min-h-16 bg-surface text-[13px]"
                      aria-label="Override reason"
                    />
                    <p className="mt-1.5 text-[11.5px] text-ink-muted">Logged in the audit trail and shown to the owner in Revenue Guard.</p>
                  </div>
                )}
              </div>
            </Panel>

            <Panel>
              <div className="border-b border-line px-5 py-4">
                <p className="eyebrow mb-1">Optional</p>
                <h2 className="display-sm text-[19px] text-ink">Deposit</h2>
              </div>
              <div className="flex flex-col gap-3 px-5 py-4">
                <NairaInput kobo={deposit} onChange={setDeposit} aria-label="Deposit amount" placeholder={new Intl.NumberFormat("en-NG").format(Math.round(r.estimatedTotalKobo / 100))} />
                <ChipRadio
                  label="Deposit method"
                  value={depositMethod}
                  onChange={setDepositMethod}
                  options={[
                    { value: "CASH", label: "Cash" },
                    { value: "TRANSFER", label: "Transfer" },
                    { value: "POS", label: "POS" },
                  ]}
                />
                {deposit && depositMethod !== "CASH" ? (
                  <Field label={depositMethod === "TRANSFER" ? "Transfer reference" : "POS slip no."} htmlFor="dep-ref" optional>
                    <input id="dep-ref" value={depositRef} onChange={(e) => setDepositRef(e.target.value)} className="card-field font-mono" />
                  </Field>
                ) : null}
                {deposit && online && shift.data === null ? (
                  <p className="text-[12px] text-ochre">Open your shift first to take a deposit (My shift).</p>
                ) : null}
              </div>
            </Panel>

            {missing.length > 0 && (
              <Panel className="px-5 py-4">
                <Checkbox checked={registerLater} onChange={setRegisterLater} label="Complete the register card later" />
                <p className="mt-1.5 pl-[26px] text-[12px] text-ink-muted">
                  {missing.length} {missing.length === 1 ? "field is" : "fields are"} missing. Revenue Guard flags it after an hour.
                </p>
              </Panel>
            )}

            <Button size="lg" className="h-12 text-[15px]" onClick={() => checkIn.mutate()} loading={checkIn.isPending} data-testid="confirm-checkin">
              {!online && has("offline_mode") ? <CloudArrowUp size={17} weight="bold" /> : <SignIn size={17} weight="bold" />}
              {!online && has("offline_mode") ? "Save check-in offline" : `Check in${chosen ? ` to ${chosen.number}` : ""}`}
            </Button>
            {showErrors && missing.length > 0 && !registerLater && (
              <p className="flex items-center gap-1.5 text-[12.5px] text-danger" role="alert">
                <WarningCircle size={14} /> The card is missing {missing.length} {missing.length === 1 ? "field" : "fields"}.
              </p>
            )}
          </aside>
        )}
      </div>
    </>
  );
}

function CheckedIn({
  r,
  done,
  name,
  idState,
  onRetryId,
}: {
  r: ReservationDetail;
  done: { queued: boolean; room: string };
  name: string;
  idState: IdCaptureState;
  onRetryId: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-lg flex-col items-center py-10 text-center">
      <div className="relative mb-6 grid h-32 w-32 place-items-center">
        <span className="absolute inset-0 rounded-full bg-palm-wash" />
        <span className="absolute inset-3 rounded-full border border-dashed border-[color-mix(in_oklab,var(--palm)_45%,transparent)]" />
        <span className="relative animate-[swing_1200ms_cubic-bezier(0.22,1,0.36,1)] [transform-origin:50%_0%]">
          <Key size={46} weight="duotone" className="text-palm" />
        </span>
      </div>
      <p className="eyebrow mb-2">{done.queued ? "Saved offline" : "Checked in"}</p>
      <h1 className="display text-[40px] leading-none text-ink">
        Room <em>{done.room}</em>
      </h1>
      <p className="mt-3 text-[14.5px] text-ink-muted">
        {done.queued
          ? `${name}'s check-in is saved on this device and will sync, with the right time, when the line returns.`
          : `Hand ${name.split(" ")[0]} the key. The first night is on the folio.`}
      </p>
      {idState.status === "error" && (
        <p className="mt-3 text-[12.5px] text-danger">
          The ID photo didn&rsquo;t upload.{" "}
          <button className="underline" onClick={onRetryId}>
            Try again
          </button>
        </p>
      )}
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <ButtonLink href={`/reservations/${r.id}`} variant="secondary">
          Open the folio
        </ButtonLink>
        <ButtonLink href="/today">Back to Today</ButtonLink>
      </div>
    </div>
  );
}

type PickRoom = RoomAvailability["rooms"][number];

/** checkInReady from the API (M2.1), with a conservative fallback. */
function isReady(x: PickRoom) {
  return x.checkInReady ?? (x.free && x.clean && x.status !== "OCCUPIED" && x.status !== "OUT_OF_ORDER");
}
/** Free for the stay and only held back because it isn't clean yet. */
function isDirtyOnly(x: PickRoom) {
  return x.reason ? x.reason === "DIRTY" : x.free && !x.clean && x.status === "VACANT_DIRTY";
}
function byNumber(a: PickRoom, b: PickRoom) {
  return a.number.localeCompare(b.number, undefined, { numeric: true });
}
function notReadyText(x: PickRoom) {
  switch (x.reason) {
    case "OCCUPIED":
      if (!x.occupiedUntil) return "occupied";
      return `occupied, guest leaves ${
        dayKeyOf(x.occupiedUntil) === todayKey() ? "today" : formatDay(dayKeyOf(x.occupiedUntil), { day: "numeric", month: "short" })
      } at ${lagosHHMM(x.occupiedUntil)}`;
    case "BOOKED":
      return "booked for part of this stay";
    case "OUT_OF_ORDER":
      return "out of order";
    case "DIRTY":
      return "needs cleaning";
    default:
      return x.status === "OCCUPIED" ? "occupied" : !x.clean ? "needs cleaning" : "not free for this stay";
  }
}

function RoomGrid({ label, rooms, value, onPick }: { label: string; rooms: PickRoom[]; value: string; onPick: (id: string) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
      {rooms.map((x) => {
        const on = x.id === value;
        return (
          <button
            key={x.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onPick(x.id)}
            title={isReady(x) ? "Clean and ready" : "Needs cleaning: a manager's reason is required"}
            className={cn(
              "flex items-center justify-center gap-1.5 rounded-md border py-2.5 font-mono text-[15px] transition-colors",
              on ? "border-laterite bg-laterite-wash text-ink shadow-[inset_0_-2px_0_var(--laterite)]" : "border-line-strong bg-surface text-ink hover:border-ink-faint",
            )}
          >
            <StatusSwatch status={x.status} size={13} />
            {x.number}
          </button>
        );
      })}
    </div>
  );
}

function CardSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="mt-6">
      <legend className="mb-3 flex w-full items-center gap-3">
        <span className="display-sm whitespace-nowrap text-[14px] italic text-laterite">{title}</span>
        <span className="h-px flex-1 bg-[color-mix(in_oklab,var(--laterite)_25%,transparent)]" />
      </legend>
      {children}
    </fieldset>
  );
}

function CardField({
  label,
  value,
  onChange,
  className,
  mono,
  type = "text",
  invalid,
  placeholder,
  autoComplete,
  list,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
  mono?: boolean;
  type?: string;
  invalid?: boolean;
  placeholder?: string;
  autoComplete?: string;
  list?: string;
}) {
  const id = `card-${label.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <div className={className}>
      <label htmlFor={id} className={cn("card-label", invalid && "text-danger")}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        placeholder={placeholder}
        autoComplete={autoComplete}
        list={list}
        className={cn("card-field placeholder:text-[13px]", mono && "font-mono")}
      />
    </div>
  );
}

/** Tick-box row like a printed form. */
function Boxes<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T | "";
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-x-5 gap-y-2">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)} className="group inline-flex items-center gap-2 text-[13.5px] text-ink">
            <span
              aria-hidden
              className={cn(
                "grid h-[18px] w-[18px] place-items-center border-[1.5px] transition-colors",
                on ? "border-ink" : "border-ink-muted group-hover:border-ink",
              )}
            >
              {on && <Check size={13} weight="bold" className="animate-[fade_120ms_ease-out]" />}
            </span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function Printed({ label, value, big }: { label: string; value: string; big?: boolean }) {
  return (
    <div>
      <p className="card-label">{label}</p>
      <p className={cn("mt-1 border-b border-line-strong pb-1 font-mono text-ink", big ? "text-[22px] leading-none" : "text-[14px]")}>{value}</p>
    </div>
  );
}
