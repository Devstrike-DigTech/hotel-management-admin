"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarX,
  Door,
  IdentificationCard,
  MoonStars,
  NotePencil,
  Printer,
  SignIn,
  UserCircle,
  WarningCircle,
} from "@phosphor-icons/react";
import { useFolio, useReservation } from "@/lib/api/hooks-m2";
import { reservationsApi } from "@/lib/api/endpoints-m2";
import { useDeskRefresh } from "@/lib/api/mutations-m2";
import type { ReservationDetail } from "@/lib/api/types-m2";
import { useCan } from "@/lib/permissions";
import { useNow } from "@/lib/use-now";
import { toast } from "@/lib/store";
import { formatDuration, lagosHHMM, todayKey } from "@/lib/dates";
import { formatDate, formatDateTime, formatPhone, naira, relativeTime } from "@/lib/format";
import { ID_TYPES, PURPOSES, SOURCES } from "@/lib/catalog-m2";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, Textarea } from "@/components/ui/form";
import { ErrorState, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { BalancePill, Code, GuestName, KV, NairaInput, SourceTag, StayBadge } from "@/components/m2/bits";
import { FolioPanel } from "@/components/folio/folio-panel";
import { HoldCountdown } from "@/components/m3/bits";
import { OnlineBookingCard, paidOnline } from "@/components/reservations/online-card";
import { NotificationLog } from "@/components/notifications/notification-log";
import { CheckOutDialog } from "./check-out";

export function ReservationDetailView({ id }: { id: string }) {
  const q = useReservation(id);
  const search = useSearchParams();
  const [checkout, setCheckout] = useState(false);
  const [cancel, setCancel] = useState<"cancel" | "no-show" | null>(null);
  const { can } = useCan();
  const refresh = useDeskRefresh();
  const nowMs = useNow(15_000);
  const r = q.data;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open check-out when linked with ?checkout=1
    if (search.get("checkout") === "1" && r?.status === "CHECKED_IN") setCheckout(true);
  }, [search, r?.status]);

  const confirm = useMutation({
    mutationFn: () => reservationsApi.confirm(id),
    onSuccess: async () => {
      await refresh();
      toast.success("Confirmed");
    },
    meta: { errorTitle: "Not confirmed" },
  });
  const convert = useMutation({
    mutationFn: () => reservationsApi.convertToNightly(id),
    onSuccess: async () => {
      await refresh();
      toast.success("Now an overnight stay", "Tonight's room charge has been posted.");
    },
    meta: { errorTitle: "Not converted" },
  });

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} className="py-24" />;
  if (!r)
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-12 w-80" />
        <div className="grid gap-6 lg:grid-cols-12">
          <Skeleton className="h-96 lg:col-span-8" />
          <Skeleton className="h-96 lg:col-span-4" />
        </div>
      </div>
    );

  const today = todayKey();
  const canCheckIn =
    ["PENDING", "CONFIRMED"].includes(r.status) &&
    (r.stayType === "DAY_USE" ? r.arrivalDate === today : r.arrivalDate <= today && today < r.departureDate);
  const act = can("frontdesk.act");
  // an unpaid online hold belongs to the guest's checkout: no manual confirm or check-in until it is paid or lapses
  const onlineHold = !!r.online && r.status === "PENDING" && !!r.holdExpiresAt && +new Date(r.holdExpiresAt) > nowMs;

  return (
    <>
      <Link href="/reservations" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> Reservations
      </Link>
      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <div className="mb-3 flex flex-wrap items-center gap-2.5">
            <Code value={r.code} copy className="text-[13px] text-ink" />
            <StayBadge status={r.status} />
            {r.stayType === "DAY_USE" && (
              <span className="hatch inline-flex h-[22px] items-center rounded-full border border-line-strong px-2 text-[11.5px] font-medium text-ink-muted">Day use</span>
            )}
            <SourceTag source={r.source} />
            {r.status === "PENDING" && r.holdExpiresAt && <HoldCountdown expiresAt={r.holdExpiresAt} />}
          </div>
          <h1 className="display text-[34px] leading-[1.02] text-ink md:text-[44px]">
            <GuestName name={r.guest.fullName} vip={r.guest.vip} />
          </h1>
          <p className="mt-2 text-[14.5px] text-ink-muted">
            {r.room ? (
              <>
                Room <span className="font-mono text-ink">{r.room.number}</span>
              </>
            ) : (
              "No room assigned"
            )}{" "}
            &middot; {r.roomType.name} &middot;{" "}
            {r.stayType === "DAY_USE"
              ? `${lagosHHMM(r.arrivalAt)} to ${lagosHHMM(r.departureAt)}`
              : `${r.nights} ${r.nights === 1 ? "night" : "nights"}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {r.status === "PENDING" && !onlineHold && can("reservations.write") && (
            <Button variant="secondary" onClick={() => confirm.mutate()} loading={confirm.isPending}>
              <CalendarCheck size={15} weight="duotone" /> Confirm
            </Button>
          )}
          {["PENDING", "CONFIRMED"].includes(r.status) && can("reservations.write") && (
            <Button variant="ghost" onClick={() => setCancel(r.arrivalDate <= today ? "no-show" : "cancel")}>
              <CalendarX size={15} weight="duotone" /> {r.arrivalDate <= today ? "No-show / cancel" : "Cancel"}
            </Button>
          )}
          {r.status === "CHECKED_IN" && r.stayType === "DAY_USE" && act && (
            <Button variant="secondary" onClick={() => convert.mutate()} loading={convert.isPending}>
              <MoonStars size={15} weight="duotone" /> Make it overnight
            </Button>
          )}
          {canCheckIn && act && !onlineHold && (
            <ButtonLink href={`/reservations/${r.id}/check-in`} size="lg">
              <SignIn size={16} weight="bold" /> Check in
            </ButtonLink>
          )}
          {r.status === "CHECKED_IN" && act && (
            <Button size="lg" onClick={() => setCheckout(true)} data-testid="check-out">
              <Door size={16} weight="bold" /> Check out
            </Button>
          )}
        </div>
      </div>

      {r.status === "CHECKED_IN" && !r.registrationComplete && (
        <div className="mb-6 flex flex-wrap items-center gap-3 rounded-md border border-[color-mix(in_oklab,var(--ochre)_40%,transparent)] bg-ochre-wash px-4 py-3">
          <WarningCircle size={18} weight="duotone" className="text-ochre" />
          <p className="flex-1 text-[13.5px] text-ink">
            The guest register isn&rsquo;t complete. <span className="text-ink-muted">Revenue Guard flags it an hour after check-in.</span>
          </p>
          <ButtonLink href={`/reservations/${r.id}/check-in?register=1`} size="sm" variant="secondary">
            <NotePencil size={14} /> Complete register
          </ButtonLink>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-8">
          {r.online && r.status === "PENDING" && r.holdExpiresAt && (
            <Panel className="px-5 py-4" data-testid="hold-panel">
              <HoldCountdown expiresAt={r.holdExpiresAt} variant="block" />
            </Panel>
          )}
          <FolioPanel folioId={r.folioId} title="Guest folio" reservationCode={r.code} />
          <Invoices folioId={r.folioId} />
          <NotificationLog reservationId={r.id} />
        </div>
        <aside className="flex flex-col gap-6 lg:col-span-4">
          {r.online && <OnlineBookingCard r={r} />}
          <StayCard r={r} />
          <GuestCard r={r} />
          <RegisterCard r={r} />
          {r.notes && (
            <Panel className="px-5 py-4">
              <p className="eyebrow mb-2">Notes</p>
              <p className="text-[13.5px] italic leading-relaxed text-ink-muted">{r.notes}</p>
            </Panel>
          )}
          <p className="px-1 text-[12px] text-ink-faint">
            Booked {relativeTime(r.createdAt)}
            {r.createdBy ? ` by ${r.createdBy.fullName}` : ""}
            {r.clientCreatedAt ? ", recorded offline" : ""}.
          </p>
        </aside>
      </div>

      {(r.status === "CHECKED_IN" || checkout) && <CheckOutDialog reservation={r} open={checkout} onOpenChange={setCheckout} />}
      <CancelDialog r={r} mode={cancel} onOpenChange={(o) => !o && setCancel(null)} />
    </>
  );
}

function StayCard({ r }: { r: ReservationDetail }) {
  return (
    <Panel className="overflow-hidden">
      <div className="grid grid-cols-2">
        <div className="border-r border-dashed border-line-strong px-5 py-4">
          <p className="eyebrow text-[10px]">Arrival</p>
          <p className="display-sm mt-1.5 text-[20px] leading-tight text-ink">{formatDate(r.arrivalAt, { weekday: "short", day: "numeric", month: "short", year: undefined })}</p>
          <p className="font-mono text-[12px] text-ink-muted">{lagosHHMM(r.arrivalAt)}</p>
        </div>
        <div className="px-5 py-4">
          <p className="eyebrow text-[10px]">Departure</p>
          <p className="display-sm mt-1.5 text-[20px] leading-tight text-ink">{formatDate(r.departureAt, { weekday: "short", day: "numeric", month: "short", year: undefined })}</p>
          <p className="font-mono text-[12px] text-ink-muted">{lagosHHMM(r.departureAt)}</p>
        </div>
      </div>
      <dl className="divide-y divide-line border-t border-line px-5 py-1">
        <KV k={r.stayType === "DAY_USE" ? "Length" : "Nights"} v={<span className="font-mono">{r.stayType === "DAY_USE" ? formatDuration(+new Date(r.departureAt) - +new Date(r.arrivalAt)) : r.nights}</span>} />
        {r.ratePlan && <KV k="Rate plan" v={<span>{r.ratePlan.name}{r.ratePlan.includesBreakfast ? ", breakfast" : ""}{r.ratePlan.nonRefundable ? ", no refunds" : ""}</span>} />}
        {r.nightlyRates && r.nightlyRates.length > 1 && new Set(r.nightlyRates.map((n) => n.rateKobo)).size > 1 ? (
          <div className="py-1.5">
            <dt className="text-[13px] text-ink-muted">Nightly rates</dt>
            <dd className="mt-1 flex flex-col gap-0.5">
              {r.nightlyRates.map((n) => (
                <span key={n.date} className="flex justify-between text-[12.5px]">
                  <span className="text-ink-muted">
                    {formatDate(`${n.date}T12:00:00+01:00`, { weekday: "short", day: "numeric", month: "short", year: undefined })}
                    {n.ruleName && <span className="text-ink-faint"> &middot; {n.ruleName}</span>}
                  </span>
                  <span className="font-mono text-ink">{naira(n.rateKobo)}</span>
                </span>
              ))}
            </dd>
          </div>
        ) : (
          <KV k="Rate" v={<span className="font-mono">{naira(r.rateKobo)} / {r.stayType === "DAY_USE" ? "hr" : "night"}</span>} />
        )}
        {r.promo && <KV k="Promo" v={<span><span className="font-mono">{r.promo.code}</span> <span className="font-mono text-palm">−{naira(r.promo.discountKobo)}</span></span>} />}
        {r.corporateAccount && <KV k="Company" v={<a href={`/corporate?open=${r.corporateAccount.id}`} className="hover:text-laterite">{r.corporateAccount.name}</a>} />}
        <KV k="Estimate" v={<span className="font-mono">{naira(r.estimatedTotalKobo)}</span>} />
        <KV k="Guests" v={`${r.adults} ${r.adults === 1 ? "adult" : "adults"}${r.children ? `, ${r.children} ${r.children === 1 ? "child" : "children"}` : ""}`} />
        <KV k="Source" v={r.online ? <SourceTag source={r.source} size="sm" /> : SOURCES[r.source]} />
        <KV k="Balance" v={<BalancePill kobo={r.balanceKobo} />} />
        {r.checkedInAt && <KV k="Checked in" v={<span className="font-mono text-[12.5px]">{formatDateTime(r.checkedInAt)}</span>} />}
        {r.checkedOutAt && <KV k="Checked out" v={<span className="font-mono text-[12.5px]">{formatDateTime(r.checkedOutAt)}</span>} />}
        {r.cancelReason && <KV k="Cancelled" v={r.cancelReason} />}
      </dl>
    </Panel>
  );
}

function GuestCard({ r }: { r: ReservationDetail }) {
  const g = r.guest;
  return (
    <Panel>
      <PanelHeader
        eyebrow="Guest"
        title={<GuestName name={g.fullName} vip={g.vip} />}
        actions={
          <ButtonLink href={`/guests/${g.id}`} size="sm" variant="ghost">
            <UserCircle size={15} /> Profile
          </ButtonLink>
        }
      />
      <dl className="divide-y divide-line px-5 py-1">
        <KV k="Phone" v={<span className="font-mono">{formatPhone(g.phone)}</span>} />
        {g.email && <KV k="Email" v={<span className="break-all">{g.email}</span>} />}
        {g.company && <KV k="Company" v={g.company} />}
        <KV
          k="ID"
          v={
            g.idType ? (
              <span className="inline-flex items-center gap-1.5">
                <IdentificationCard size={14} className="text-ink-muted" />
                {ID_TYPES[g.idType].split(" ")[0]} <span className="font-mono">{g.idNumberMasked}</span>
              </span>
            ) : (
              <span className="text-ink-faint">not captured</span>
            )
          }
        />
        <KV k="Stays" v={<span className="font-mono">{g.stayCount}</span>} />
      </dl>
    </Panel>
  );
}

function RegisterCard({ r }: { r: ReservationDetail }) {
  const reg = r.registration;
  return (
    <Panel>
      <PanelHeader eyebrow="Guest register" title={reg ? "Registered" : "Not yet registered"} />
      {reg ? (
        <dl className="divide-y divide-line px-5 py-1">
          <KV k="Arriving from" v={reg.arrivingFrom} />
          <KV k="Going to" v={reg.goingTo} />
          <KV k="Purpose" v={PURPOSES[reg.purpose]} />
          {reg.vehiclePlate && <KV k="Vehicle" v={<span className="font-mono">{reg.vehiclePlate}</span>} />}
          {reg.completedBy && <KV k="Taken by" v={reg.completedBy.fullName} />}
        </dl>
      ) : (
        <p className="px-5 py-4 text-[13px] text-ink-muted">The register card is filled in at check-in.</p>
      )}
    </Panel>
  );
}

function Invoices({ folioId }: { folioId: string }) {
  const f = useFolio(folioId);
  const list = f.data?.invoices ?? [];
  if (!list.length) return null;
  return (
    <Panel>
      <PanelHeader eyebrow="Documents" title="Invoices" />
      <ul className="divide-y divide-line">
        {list.map((i) => (
          <li key={i.id} className="flex items-center gap-3 px-5 py-3">
            <span className={cn("font-mono text-[13px]", i.kind === "FINAL" ? "text-ink" : "text-ink-muted")}>{i.number}</span>
            <span className="text-[12px] text-ink-faint">{i.kind === "FINAL" ? "Final" : "Proforma"} &middot; {formatDate(i.issuedAt)}</span>
            <span className="ml-auto font-mono text-[13px] text-ink">{naira(i.totalKobo)}</span>
            <Button size="icon-sm" variant="ghost" aria-label={`Print ${i.number}`} onClick={() => window.open(`/print/invoice/${i.id}`, "_blank", "noopener")}>
              <Printer size={15} />
            </Button>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

function CancelDialog({ r, mode, onOpenChange }: { r: ReservationDetail; mode: "cancel" | "no-show" | null; onOpenChange: (o: boolean) => void }) {
  const refresh = useDeskRefresh();
  const { can } = useCan();
  const [kind, setKind] = useState<"cancel" | "no-show">("cancel");
  const [reason, setReason] = useState("");
  const [fee, setFee] = useState<number | null>(null);
  const k = mode === "no-show" ? kind : "cancel";
  const paid = paidOnline(r);
  const m = useMutation({
    mutationFn: () =>
      k === "cancel" ? reservationsApi.cancel(r.id, reason.trim() || "Cancelled at the desk", fee ?? undefined) : reservationsApi.noShow(r.id, reason.trim() || undefined, fee ?? undefined),
    onSuccess: async () => {
      await refresh();
      toast.success(k === "cancel" ? `${r.code} cancelled` : `${r.code} marked no-show`, fee ? `A ${naira(fee)} fee was posted to the folio.` : undefined);
      onOpenChange(false);
    },
    meta: { errorTitle: "Not changed" },
  });
  if (paid > 0 && k === "cancel") return <RefundCancelDialog r={r} paid={paid} open={!!mode} onOpenChange={onOpenChange} allowed={can("cancel.refund")} onNoShow={mode === "no-show" ? () => setKind("no-show") : undefined} />;
  return (
    <Dialog
      open={!!mode}
      onOpenChange={onOpenChange}
      eyebrow={r.code}
      title={k === "cancel" ? "Cancel this reservation?" : "Mark as no-show?"}
      description="The room is released at once. You can post a fee to the folio."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Keep it
          </Button>
          <Button variant="danger" onClick={() => m.mutate()} loading={m.isPending}>
            {k === "cancel" ? "Cancel reservation" : "Mark no-show"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {mode === "no-show" && (
          <div className="flex gap-2">
            {(["no-show", "cancel"] as const).map((x) => (
              <button
                key={x}
                type="button"
                onClick={() => setKind(x)}
                className={cn("h-8 rounded-full border px-3 text-[12.5px] font-medium", kind === x ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}
              >
                {x === "no-show" ? "Didn't arrive" : "Guest cancelled"}
              </button>
            ))}
          </div>
        )}
        <Field label="Reason" htmlFor="cx-reason" optional={k === "no-show"}>
          <Textarea id="cx-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-16" />
        </Field>
        {r.status === "PENDING" && r.holdExpiresAt ? (
          <p className="text-[12.5px] text-ink-muted">This is an unpaid online hold. Cancelling releases the room; the guest is told and nothing is charged.</p>
        ) : (
          <Field label="Fee" htmlFor="cx-fee" optional hint={`One night is ${naira(r.rateKobo)}.`}>
            <NairaInput id="cx-fee" kobo={fee} onChange={setFee} />
          </Field>
        )}
      </div>
    </Dialog>
  );
}

/** Hotel-initiated cancel of a booking paid online: always a full refund. */
function RefundCancelDialog({
  r,
  paid,
  open,
  onOpenChange,
  allowed,
  onNoShow,
}: {
  r: ReservationDetail;
  paid: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  allowed: boolean;
  onNoShow?: () => void;
}) {
  const refresh = useDeskRefresh();
  const [reason, setReason] = useState("");
  const [sure, setSure] = useState(false);
  const commission = r.online?.commission.collectedKobo ?? 0;
  const m = useMutation({
    mutationFn: () => reservationsApi.cancel(r.id, reason.trim() || "Cancelled by the hotel"),
    onSuccess: async () => {
      await refresh();
      toast.success(`${r.code} cancelled`, `${naira(paid)} is on its way back to the guest. They have been told by email and SMS.`);
      onOpenChange(false);
    },
    meta: { errorTitle: "Not cancelled" },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={`${r.code} · paid online`}
      title="Cancel and refund in full?"
      description="When the hotel cancels, the guest gets back everything they paid. No fee, whatever the policy says."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Keep the booking
          </Button>
          <Button variant="danger" onClick={() => m.mutate()} loading={m.isPending} disabled={!allowed || !sure || reason.trim().length < 3} data-testid="confirm-refund-cancel">
            Cancel and refund {naira(paid)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <dl className="rounded-md border border-line bg-surface-2/40 px-4 py-3 text-[13.5px]">
          <div className="flex justify-between py-1">
            <dt className="text-ink-muted">Guest paid online</dt>
            <dd className="font-mono text-ink">{naira(paid)}</dd>
          </div>
          <div className="flex justify-between py-1">
            <dt className="text-ink-muted">Refunded to their card or account</dt>
            <dd className="font-mono text-palm">{naira(paid)}</dd>
          </div>
          {commission > 0 && (
            <div className="flex justify-between py-1">
              <dt className="text-ink-muted">Commission given back to you</dt>
              <dd className="font-mono text-ink">{naira(commission)}</dd>
            </div>
          )}
        </dl>
        {!allowed ? (
          <p className="rounded-sm bg-brass-wash px-3 py-2 text-[13px] text-ink">Only an owner or manager can cancel a booking that was paid online.</p>
        ) : (
          <>
            <Field label="Reason, for the guest and the audit log" htmlFor="rf-reason">
              <Textarea id="rf-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-16" placeholder="Burst pipe on the second floor; we couldn't offer an equal room." />
            </Field>
            <label className="flex items-start gap-2.5 text-[13px] text-ink">
              <input type="checkbox" checked={sure} onChange={(e) => setSure(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--danger)]" />
              I understand the refund can&rsquo;t be taken back.
            </label>
          </>
        )}
        {onNoShow && (
          <button type="button" onClick={onNoShow} className="self-start text-[12.5px] text-ink-muted underline-offset-4 hover:underline">
            The guest didn&rsquo;t arrive? Mark a no-show instead.
          </button>
        )}
      </div>
    </Dialog>
  );
}
