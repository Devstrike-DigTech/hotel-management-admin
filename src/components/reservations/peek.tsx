"use client";

import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowsOutCardinal,
  CalendarCheck,
  Door,
  IdentificationCard,
  Money,
  SignIn,
  Users,
  WarningCircle,
} from "@phosphor-icons/react";
import { useReservation } from "@/lib/api/hooks-m2";
import { reservationsApi } from "@/lib/api/endpoints-m2";
import { useDeskRefresh } from "@/lib/api/mutations-m2";
import { useCan } from "@/lib/permissions";
import { openPayment } from "@/lib/store-m2";
import { toast } from "@/lib/store";
import { formatDuration, lagosHHMM, stayWindow, todayKey } from "@/lib/dates";
import { formatPhone, naira } from "@/lib/format";
import { SOURCES } from "@/lib/catalog-m2";
import { Sheet } from "@/components/ui/overlay";
import { Button, ButtonLink } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/primitives";
import { BalancePill, Code, GuestName, KV, StayBadge } from "@/components/m2/bits";

/** Quick look at a reservation from the Ledger or Today, with the next sensible actions. */
export function ReservationPeek({
  id,
  onOpenChange,
  onMove,
}: {
  id: string | null;
  onOpenChange: (o: boolean) => void;
  onMove?: (id: string) => void;
}) {
  const q = useReservation(id);
  const r = q.data;
  const { can } = useCan();
  const refresh = useDeskRefresh();
  const confirm = useMutation({
    mutationFn: () => reservationsApi.confirm(id!),
    onSuccess: async (x) => {
      await refresh();
      toast.success(`${x.code} confirmed`);
    },
    meta: { errorTitle: "Not confirmed" },
  });

  const today = todayKey();
  const canCheckIn =
    !!r &&
    ["PENDING", "CONFIRMED"].includes(r.status) &&
    (r.stayType === "DAY_USE" ? r.arrivalDate === today : r.arrivalDate <= today && today < r.departureDate);
  return (
    <Sheet
      open={!!id}
      onOpenChange={onOpenChange}
      eyebrow={r ? <Code value={r.code} copy className="text-[11px] text-ink-muted" /> : "Reservation"}
      title={r ? <GuestName name={r.guest.fullName} vip={r.guest.vip} /> : <Skeleton className="h-7 w-48" />}
      description={r ? `${r.room ? `Room ${r.room.number}` : "No room yet"} · ${r.roomType.name}` : undefined}
      footer={
        r ? (
          <div className="flex w-full flex-wrap gap-2">
            <ButtonLink href={`/reservations/${r.id}`} variant="secondary" className="flex-1 sm:flex-none">
              Full record <ArrowRight size={14} weight="bold" />
            </ButtonLink>
            <div className="flex flex-1 flex-wrap justify-end gap-2">
              {r.status === "PENDING" && can("reservations.write") && (
                <Button variant="secondary" onClick={() => confirm.mutate()} loading={confirm.isPending}>
                  <CalendarCheck size={15} weight="duotone" /> Confirm
                </Button>
              )}
              {canCheckIn && can("frontdesk.act") && (
                <ButtonLink href={`/reservations/${r.id}/check-in`}>
                  <SignIn size={15} weight="bold" /> Check in
                </ButtonLink>
              )}
              {r.status === "CHECKED_IN" && can("frontdesk.act") && (
                <>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      openPayment({ folioId: r.folioId, label: r.guest.fullName, balanceKobo: r.balanceKobo, reservationCode: r.code })
                    }
                  >
                    <Money size={15} weight="duotone" /> Take payment
                  </Button>
                  <ButtonLink href={`/reservations/${r.id}?checkout=1`}>
                    <Door size={15} weight="duotone" /> Check out
                  </ButtonLink>
                </>
              )}
            </div>
          </div>
        ) : undefined
      }
    >
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !r ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <StayBadge status={r.status} />
            {r.stayType === "DAY_USE" && (
              <span className="hatch inline-flex h-[22px] items-center rounded-full border border-line-strong px-2 text-[11.5px] font-medium text-ink-muted">
                Day use
              </span>
            )}
            <BalancePill kobo={r.balanceKobo} />
          </div>

          {/* ticket-stub dates */}
          <div className="grid grid-cols-2 overflow-hidden rounded-md border border-line">
            <div className="border-r border-dashed border-line-strong px-4 py-3">
              <p className="eyebrow text-[10px]">In</p>
              <p className="display-sm mt-1 text-[18px] text-ink">{new Date(r.arrivalAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" })}</p>
              <p className="font-mono text-[12px] text-ink-muted">{lagosHHMM(r.arrivalAt)}</p>
            </div>
            <div className="px-4 py-3">
              <p className="eyebrow text-[10px]">Out</p>
              <p className="display-sm mt-1 text-[18px] text-ink">{new Date(r.departureAt).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Africa/Lagos" })}</p>
              <p className="font-mono text-[12px] text-ink-muted">
                {lagosHHMM(r.departureAt)}
                <span className="text-ink-faint">
                  {" "}
                  &middot; {r.stayType === "DAY_USE" ? formatDuration(+new Date(r.departureAt) - +new Date(r.arrivalAt)) : `${r.nights} ${r.nights === 1 ? "night" : "nights"}`}
                </span>
              </p>
            </div>
          </div>

          <dl className="divide-y divide-line">
            <KV k="Phone" v={<span className="font-mono">{formatPhone(r.guest.phone)}</span>} />
            <KV
              k="Guests"
              v={
                <span className="inline-flex items-center gap-1.5">
                  <Users size={13} className="text-ink-muted" />
                  {r.adults} {r.adults === 1 ? "adult" : "adults"}
                  {r.children ? `, ${r.children} ${r.children === 1 ? "child" : "children"}` : ""}
                </span>
              }
            />
            <KV k="Rate" v={<span className="font-mono">{naira(r.rateKobo)} / {r.stayType === "DAY_USE" ? "hour" : "night"}</span>} />
            <KV k="Source" v={SOURCES[r.source]} />
            <KV
              k="Register"
              v={
                r.registrationComplete ? (
                  <span className="inline-flex items-center gap-1.5 text-palm">
                    <IdentificationCard size={14} weight="duotone" /> complete
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-ochre">
                    <WarningCircle size={14} weight="duotone" /> to complete at check-in
                  </span>
                )
              }
            />
          </dl>
          {r.notes && <p className="rounded-md border border-dashed border-line-strong bg-paper/60 px-3.5 py-2.5 text-[13px] italic text-ink-muted">{r.notes}</p>}
          {onMove && ["PENDING", "CONFIRMED", "CHECKED_IN"].includes(r.status) && can("reservations.write") && (
            <button
              onClick={() => onMove(r.id)}
              className="inline-flex items-center gap-2 self-start text-[13px] font-medium text-laterite underline-offset-4 hover:underline"
            >
              <ArrowsOutCardinal size={15} /> {r.status === "CHECKED_IN" ? "Extend or change room on the ledger" : "Move on the ledger"}
            </button>
          )}
          <p className="text-[12px] text-ink-faint">{stayWindow(r.arrivalAt, r.departureAt)}</p>
        </div>
      )}
    </Sheet>
  );
}
