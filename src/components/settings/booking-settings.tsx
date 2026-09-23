"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, ArrowSquareOut, CalendarX, ChatText, FloppyDisk, Globe, Info, ShieldCheck, Storefront, WarningCircle } from "@phosphor-icons/react";
import { useBookingSettings, qk3 } from "@/lib/api/hooks-m3";
import { bookingSettingsApi } from "@/lib/api/endpoints-m3";
import type { BookingSettings, CancellationPolicy } from "@/lib/api/types-m3";
import { useProperty, useRoomTypes } from "@/lib/api/hooks";
import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/store";
import { naira } from "@/lib/format";
import { addDays, formatDay, todayKey } from "@/lib/dates";
import { describePolicy, feeFor, HOUR_PRESETS, PCT_PRESETS } from "@/lib/policy";
import { config } from "@/lib/config";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Switch, Textarea } from "@/components/ui/form";
import { ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";

const hourLabel = (h: number) => (h === 0 ? "None" : h === 168 ? "1 week" : h % 24 === 0 ? `${h / 24} ${h === 24 ? "day" : "days"}` : `${h}h`);
const pctLabel = (p: number) => (p === 0 ? "Free" : p === 100 ? "1st night" : `${p}%`);

export function BookingSettingsView() {
  const q = useBookingSettings();
  const qc = useQueryClient();
  const { can } = useCan();
  const editable = can("booking.settings");
  const property = useProperty();
  const types = useRoomTypes();
  const [draft, setDraft] = useState<BookingSettings | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed the editable copy once loaded
    if (q.data && !draft) setDraft(q.data);
  }, [q.data, draft]);

  const save = useMutation({
    mutationFn: () =>
      bookingSettingsApi.update({
        onlineBookingEnabled: draft!.onlineBookingEnabled,
        allowPayAtHotel: draft!.allowPayAtHotel,
        cancellationPolicy: {
          freeCancellationHours: draft!.cancellationPolicy.freeCancellationHours,
          lateCancellationFeePct: draft!.cancellationPolicy.lateCancellationFeePct,
          noShowFeePct: draft!.cancellationPolicy.noShowFeePct,
        },
        preArrivalMessage: draft!.preArrivalMessage,
      }),
    onSuccess: (d) => {
      qc.setQueryData(qk3.bookingSettings, d);
      setDraft(d);
      toast.success("Booking settings saved", "Guests see the new policy on your pages and in every new quote.");
    },
    meta: { errorTitle: "Not saved" },
  });

  const sampleNight = useMemo(() => {
    const prices = (types.data ?? []).map((t) => t.basePriceKobo).filter((p) => p > 0);
    return prices.length ? Math.min(...prices) : 6_500_000;
  }, [types.data]);

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const dirty = !!draft && !!q.data && JSON.stringify(draft) !== JSON.stringify(q.data);
  const setPolicy = (p: Partial<CancellationPolicy>) => setDraft((d) => (d ? { ...d, cancellationPolicy: { ...d.cancellationPolicy, ...p } } : d));
  const noPayout = !draft?.payoutReady;

  return (
    <>
      <PageHeader
        eyebrow="The house"
        title={
          <>
            Online <em>booking</em>
          </>
        }
        description="Whether guests can book you online, how they may pay, and what happens when plans change. The same words appear on the marketplace, your booking site and every confirmation."
        actions={
          editable && (
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty} data-testid="save-booking-settings">
              <FloppyDisk size={15} weight="bold" /> Save changes
            </Button>
          )
        }
      />
      {!draft ? (
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-[520px] lg:col-span-7" />
          <Skeleton className="h-[420px] lg:col-span-5" />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="flex min-w-0 flex-col gap-5 lg:col-span-7">
            <Panel className="divide-y divide-line">
              <div className="px-5 py-5">
                <Switch
                  checked={draft.onlineBookingEnabled}
                  onChange={(v) => setDraft({ ...draft, onlineBookingEnabled: v })}
                  disabled={!editable}
                  label="Take bookings online"
                  description={
                    draft.onlineBookingEnabled
                      ? "Guests can book and pay on the marketplace and on your booking site. Rooms are held for 20 minutes while they pay."
                      : "Your pages still show rooms and prices, with a phone number instead of a Book button."
                  }
                />
              </div>
              <div className="px-5 py-5">
                <Switch
                  checked={draft.allowPayAtHotel}
                  onChange={(v) => setDraft({ ...draft, allowPayAtHotel: v })}
                  disabled={!editable || !draft.onlineBookingEnabled}
                  label="Let guests pay at the hotel"
                  description={
                    draft.allowPayAtHotel
                      ? "Confirmed at once with nothing paid. The whole bill is settled at your desk. Marketplace commission on these is invoiced to you monthly."
                      : "Every online booking is paid in full before it is confirmed."
                  }
                />
              </div>
              {noPayout && draft.onlineBookingEnabled && (
                <div className="flex items-start gap-3 bg-ochre-wash/60 px-5 py-4">
                  <WarningCircle size={18} weight="duotone" className="mt-px shrink-0 text-ochre" />
                  <p className="flex-1 text-[13px] leading-relaxed text-ink">
                    <strong className="font-medium">No payout account yet.</strong>{" "}
                    <span className="text-ink-muted">Until you add one, guests can only choose pay at the hotel.</span>
                  </p>
                  <Link href="/payouts" className="inline-flex shrink-0 items-center gap-1 text-[13px] font-medium text-laterite underline-offset-4 hover:underline">
                    Set up payouts <ArrowRight size={13} weight="bold" />
                  </Link>
                </div>
              )}
            </Panel>

            <Panel>
              <div className="flex items-start gap-3 border-b border-line px-5 py-4">
                <CalendarX size={20} weight="duotone" className="mt-0.5 text-laterite" />
                <div>
                  <h2 className="display-sm text-[19px] leading-tight text-ink">Cancellation policy</h2>
                  <p className="mt-1 text-[13px] text-ink-muted">Shown on your pages and in every quote from the moment you save. Fees are a share of the first night, room and tax.</p>
                </div>
              </div>
              <div className="flex flex-col gap-6 px-5 py-5">
                <PresetRow
                  label="Free cancellation until"
                  hint="How long before check-in a guest can cancel for a full refund."
                  value={draft.cancellationPolicy.freeCancellationHours}
                  presets={HOUR_PRESETS}
                  format={hourLabel}
                  unit="hours before"
                  max={720}
                  disabled={!editable}
                  onChange={(v) => setPolicy({ freeCancellationHours: v })}
                  testId="policy-hours"
                />
                <PresetRow
                  label="Late cancellation fee"
                  hint="Charged when a guest cancels after that point, as a share of the first night."
                  value={draft.cancellationPolicy.lateCancellationFeePct}
                  presets={PCT_PRESETS}
                  format={pctLabel}
                  unit="% of first night"
                  max={100}
                  disabled={!editable}
                  onChange={(v) => setPolicy({ lateCancellationFeePct: v })}
                  testId="policy-late"
                />
                <PresetRow
                  label="No-show fee"
                  hint="Charged when a guest never arrives."
                  value={draft.cancellationPolicy.noShowFeePct}
                  presets={PCT_PRESETS}
                  format={pctLabel}
                  unit="% of first night"
                  max={100}
                  disabled={!editable}
                  onChange={(v) => setPolicy({ noShowFeePct: v })}
                  testId="policy-noshow"
                />
              </div>
              <PolicyRuler policy={draft.cancellationPolicy} checkInTime={property.data?.checkInTime ?? "14:00"} />
            </Panel>

            <Panel className="px-5 py-5">
              <label htmlFor="pre-arrival" className="flex items-center gap-2 text-[14px] font-medium text-ink">
                <ChatText size={17} weight="duotone" className="text-laterite" /> A note before arrival
                <span className="font-normal text-ink-faint">optional</span>
              </label>
              <p className="mt-1 text-[12.5px] text-ink-muted">
                Added to the message guests get the day before they arrive, under directions and check-in time. Parking, the gate, who to ask for.
              </p>
              <Textarea
                id="pre-arrival"
                value={draft.preArrivalMessage}
                disabled={!editable}
                onChange={(e) => setDraft({ ...draft, preArrivalMessage: e.target.value.slice(0, 500) })}
                placeholder="Drive in through the second gate on Admiralty Way; security will direct you to guest parking."
                className="mt-3 min-h-20"
              />
              <p className="mt-1.5 text-right font-mono text-[11px] text-ink-faint">{draft.preArrivalMessage.length} / 500</p>
            </Panel>
          </div>

          <aside className="flex min-w-0 flex-col gap-4 self-start lg:sticky lg:top-20 lg:col-span-5">
            <GuestPreview
              policy={draft.cancellationPolicy}
              settings={draft}
              hotelName={property.data?.name ?? ""}
              checkInTime={property.data?.checkInTime ?? "14:00"}
              nightKobo={sampleNight}
            />
            <div className="flex flex-wrap gap-x-4 gap-y-1 px-1 text-[12.5px]">
              <a href={draft.bookingSiteUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-laterite underline-offset-4 hover:underline">
                Your booking site <ArrowSquareOut size={12} />
              </a>
              <span className="text-ink-muted">
                {draft.marketplaceListed ? `Listed on the marketplace, ${draft.commissionBps / 100}% commission` : "Not listed on the marketplace"}
              </span>
            </div>
            <p className="flex items-start gap-2 px-1 text-[12px] leading-relaxed text-ink-muted">
              <Info size={14} className="mt-px shrink-0" />
              Refunds go back the way the guest paid, less any fee. When you cancel a booking yourself, the guest always gets everything back.
            </p>
          </aside>
        </div>
      )}
    </>
  );
}

function PresetRow({
  label,
  hint,
  value,
  presets,
  format,
  unit,
  max,
  disabled,
  onChange,
  testId,
}: {
  label: string;
  hint: string;
  value: number;
  presets: number[];
  format: (v: number) => string;
  unit: string;
  max: number;
  disabled?: boolean;
  onChange: (v: number) => void;
  testId: string;
}) {
  const custom = !presets.includes(value);
  return (
    <fieldset className="flex flex-col gap-2.5" data-testid={testId}>
      <legend className="mb-2.5 text-[14px] font-medium text-ink">{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-1.5">
          {presets.map((p) => {
            const on = p === value;
            return (
              <button
                key={p}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={disabled}
                onClick={() => onChange(p)}
                className={cn(
                  "inline-flex h-8 items-center rounded-full border px-3 text-[12.5px] font-medium transition-colors disabled:opacity-50",
                  on ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink-muted hover:border-ink-faint hover:text-ink",
                )}
              >
                {format(p)}
              </button>
            );
          })}
        </div>
        <label className={cn("flex h-8 items-stretch overflow-hidden rounded-md border bg-surface", custom ? "border-ink" : "border-line-strong")}>
          <span className="sr-only">{label}, exact value</span>
          <input
            inputMode="numeric"
            value={value}
            disabled={disabled}
            onChange={(e) => {
              const n = parseInt(e.target.value.replace(/[^\d]/g, "") || "0", 10);
              onChange(Math.max(0, Math.min(max, n)));
            }}
            className="w-14 bg-transparent px-2 text-right font-mono text-[13px] text-ink outline-none"
          />
          <span className="flex items-center border-l border-line bg-surface-2/60 px-2 text-[11.5px] text-ink-muted">{unit}</span>
        </label>
      </div>
      <p className="text-[12.5px] text-ink-muted">{hint}</p>
    </fieldset>
  );
}

/** Booked, free window, fee window, check-in, no-show: the policy as a line. */
function PolicyRuler({ policy, checkInTime }: { policy: CancellationPolicy; checkInTime: string }) {
  const span = Math.max(96, policy.freeCancellationHours * 1.6, 72);
  const deadlinePct = Math.max(0, Math.min(100, 100 - (policy.freeCancellationHours / span) * 100));
  const lateFree = policy.lateCancellationFeePct <= 0;
  return (
    <div className="border-t border-line px-5 pb-6 pt-5" aria-hidden>
      <p className="eyebrow mb-7 text-[10px]">On a timeline</p>
      <div className="relative mx-1 h-2">
        <span className="absolute inset-y-0 left-0 rounded-l-xs bg-palm" style={{ width: `${deadlinePct}%`, opacity: 0.75 }} />
        <span
          className="absolute inset-y-0 rounded-r-xs"
          style={{ left: `${deadlinePct}%`, right: 0, background: lateFree ? "var(--palm)" : "var(--ochre)", opacity: lateFree ? 0.75 : 0.85 }}
        />
        {!lateFree && policy.freeCancellationHours > 0 && (
          <span className="absolute -top-6 -translate-x-1/2 whitespace-nowrap font-mono text-[10.5px] text-ink" style={{ left: `${deadlinePct}%` }}>
            {hourLabel(policy.freeCancellationHours)} before
          </span>
        )}
        {policy.freeCancellationHours > 0 && <span className="absolute -top-1.5 h-5 w-[2px] -translate-x-1/2 bg-ink" style={{ left: `${deadlinePct}%` }} />}
        <span className="absolute -top-1.5 right-0 h-5 w-[2px] bg-laterite" />
        <span className="absolute -top-6 right-0 whitespace-nowrap font-mono text-[10.5px] text-laterite">check-in {checkInTime}</span>
      </div>
      <div className="mt-3 flex justify-between gap-4 text-[12px]">
        <span className="text-ink">Full refund</span>
        {!lateFree && <span className="text-ink">Fee: {feeLabel(policy.lateCancellationFeePct)}</span>}
        <span className="text-ink-muted">No-show: {policy.noShowFeePct ? feeLabel(policy.noShowFeePct) : "no charge"}</span>
      </div>
    </div>
  );
}
const feeLabel = (p: number) => (p === 100 ? "first night" : `${p}% of a night`);

/** The policy in the guest's words, as it reads on the hotel page and in the quote. */
function GuestPreview({
  policy,
  settings,
  hotelName,
  checkInTime,
  nightKobo,
}: {
  policy: CancellationPolicy;
  settings: BookingSettings;
  hotelName: string;
  checkInTime: string;
  nightKobo: number;
}) {
  const { headline, lines } = describePolicy(policy);
  // a worked example: arriving a week from now
  const arrive = addDays(todayKey(), 7);
  const deadlineDay = addDays(arrive, -Math.floor(policy.freeCancellationHours / 24));
  const remH = policy.freeCancellationHours % 24;
  const [hh, mm] = checkInTime.split(":").map(Number);
  const deadlineTime = `${String((((hh - remH) % 24) + 24) % 24).padStart(2, "0")}:${String(mm || 0).padStart(2, "0")}`;
  const lateFee = feeFor(policy.lateCancellationFeePct, nightKobo);
  const noShow = feeFor(policy.noShowFeePct, nightKobo);
  const total = nightKobo * 2;
  return (
    <Panel className="overflow-hidden" data-testid="policy-preview">
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface-2/50 px-5 py-2.5">
        <p className="eyebrow text-[10px]">What the guest sees</p>
        <span className="font-mono text-[10.5px] text-ink-faint">{config.appDomain}</span>
      </div>
      <div className="px-5 pb-5 pt-4">
        <p className="text-[12px] text-ink-muted">{hotelName || "Your hotel"} &middot; Cancellation</p>
        <p className="display-sm mt-1 flex items-start gap-2 text-[20px] leading-snug text-ink" data-testid="policy-headline">
          <ShieldCheck size={20} weight="duotone" className="mt-1 shrink-0 text-palm" />
          {headline}
        </p>
        <ul className="mt-3 flex flex-col gap-1.5 text-[13.5px] leading-relaxed text-ink">
          {lines.map((l) => (
            <li key={l} className="flex gap-2">
              <span aria-hidden className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-ink-faint" />
              {l}
            </li>
          ))}
        </ul>
        <div className="mt-4 rounded-md border border-dashed border-line-strong px-4 py-3">
          <p className="text-[12px] text-ink-muted">
            For example: 2 nights at {naira(nightKobo)}, arriving {formatDay(arrive, { weekday: "long", day: "numeric", month: "short" })} at{" "}
            <span className="font-mono">{checkInTime}</span>, paid {naira(total)}.
          </p>
          <dl className="mt-2 flex flex-col gap-1 text-[13px]">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-muted">
                {policy.lateCancellationFeePct <= 0 ? "Cancel any time" : policy.freeCancellationHours > 0 ? (
                  <>
                    Cancel by {formatDay(deadlineDay, { weekday: "short", day: "numeric", month: "short" })} <span className="font-mono">{deadlineTime}</span>
                  </>
                ) : (
                  <>Cancel before check-in</>
                )}
              </dt>
              <dd className="font-mono text-palm">refund {naira(total)}</dd>
            </div>
            {policy.lateCancellationFeePct > 0 && (
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-ink-muted">Cancel after that</dt>
                <dd className="font-mono text-ink">refund {naira(total - lateFee)}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-muted">Don&rsquo;t arrive</dt>
              <dd className="font-mono text-ink">{noShow ? `charged ${naira(noShow)}` : "no charge"}</dd>
            </div>
          </dl>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5 text-[12px]">
          <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5", settings.onlineBookingEnabled ? "border-line-strong text-ink" : "border-line text-ink-faint line-through")}>
            <Storefront size={13} /> Book online
          </span>
          <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5", settings.onlineBookingEnabled && settings.allowPayAtHotel ? "border-line-strong text-ink" : "border-line text-ink-faint line-through")}>
            <Globe size={13} /> Pay at the hotel
          </span>
        </div>
      </div>
    </Panel>
  );
}
