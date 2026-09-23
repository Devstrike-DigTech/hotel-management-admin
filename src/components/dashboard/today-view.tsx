"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, ArrowUpRight, Broom, Coins, Plus, Rows, ShieldWarning, SunHorizon, MoonStars } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useEntitlements } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import { useCurrentShift, useFrontDeskToday } from "@/lib/api/hooks-m2";
import { openNewReservation } from "@/lib/store-m2";
import { lagosHHMM } from "@/lib/dates";
import { naira } from "@/lib/format";
import { ReservationPeek } from "@/components/reservations/peek";
import { FrontDeskBoard } from "./front-desk-board";
import { useDashboard, useMe, useRooms } from "@/lib/api/hooks";
import { useRoomStatus } from "@/lib/api/mutations";
import type { Room, RoomStatus } from "@/lib/api/types";
import { LIMIT_LABEL, ROOM_STATUS, ROOM_STATUS_ORDER, SUB_STATUS } from "@/lib/catalog";
import { daysUntil, firstName, formatDate, greeting, lagosHour, lagosLongDate, relativeTime } from "@/lib/format";
import { ButtonLink, Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageHeader, Panel, PanelHeader, PlanPlate, Skeleton, Meter } from "@/components/ui/primitives";
import { KeyRack, KeyRackSkeleton, RackLegend } from "@/components/keyrack/key-rack";
import { RoomSheet } from "@/components/keyrack/room-sheet";
import { StatusSwatch } from "@/components/keyrack/status-swatch";
import { OccupancyRing } from "@/components/charts/occupancy-ring";
import { ActivityFeed } from "./activity-feed";

export function TodayView() {
  const me = useMe();
  const dash = useDashboard();
  const rooms = useRooms();
  const { can, ready } = useCan();
  const { has } = useEntitlements();
  const deskOn = ready && can("reservations.read") && has("front_desk");
  const desk = useFrontDeskToday(deskOn);
  const [peek, setPeek] = useState<string | null>(null);
  const [selected, setSelected] = useState<Room | null>(null);
  const [filter, setFilter] = useState<Set<RoomStatus>>(new Set());

  const counts = useMemo(() => {
    const c: Partial<Record<RoomStatus, number>> = {};
    rooms.data?.forEach((r) => (c[r.status] = (c[r.status] ?? 0) + 1));
    return c;
  }, [rooms.data]);
  const total = rooms.data?.length ?? dash.data?.rooms.total ?? 0;
  const byStatus = rooms.data ? counts : (dash.data?.rooms.byStatus ?? {});

  const occupied = byStatus.OCCUPIED ?? 0;
  const dirty = byStatus.VACANT_DIRTY ?? 0;
  const ooo = byStatus.OUT_OF_ORDER ?? 0;
  const clean = byStatus.VACANT_CLEAN ?? 0;
  const reserved = byStatus.RESERVED ?? 0;
  const night = lagosHour() >= 18 || lagosHour() < 5;

  const toggle = (s: RoomStatus) =>
    setFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  const selectedLive = selected ? (rooms.data?.find((r) => r.id === selected.id) ?? selected) : null;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            {night ? <MoonStars size={14} weight="duotone" /> : <SunHorizon size={14} weight="duotone" />}
            <span suppressHydrationWarning>{lagosLongDate()}</span>
            <span className="text-ink-faint">&middot; Lagos</span>
          </>
        }
        title={
          me.data ? (
            <span suppressHydrationWarning>
              {greeting()}, <em>{firstName(me.data.user.fullName)}</em>.
            </span>
          ) : (
            <Skeleton className="h-11 w-80" />
          )
        }
        description={
          total > 0 ? (
            <>
              <span className="font-mono text-ink">{occupied}</span> of <span className="font-mono text-ink">{total}</span>{" "}
              rooms are occupied{reserved ? <> and <span className="font-mono text-ink">{reserved}</span> held for arrivals</> : null}.{" "}
              {dirty > 0 ? (
                <>
                  <span className="font-mono text-ink">{dirty}</span> {dirty === 1 ? "key is" : "keys are"} waiting on
                  housekeeping.
                </>
              ) : (
                "Every vacant room is ready to sell."
              )}
            </>
          ) : rooms.isLoading ? (
            <Skeleton className="h-4 w-96 max-w-full" />
          ) : undefined
        }
        actions={
          deskOn ? (
            <>
              <ButtonLink href="/ledger" variant="secondary">
                <Rows size={15} weight="duotone" />
                The Ledger
              </ButtonLink>
              {can("reservations.write") && (
                <Button onClick={() => openNewReservation({})}>
                  <Plus size={15} weight="bold" />
                  New reservation
                </Button>
              )}
            </>
          ) : (
            <ButtonLink href="/rooms">
              Open key rack
              <ArrowRight size={15} weight="bold" />
            </ButtonLink>
          )
        }
      />

      {/* headline ledger */}
      {deskOn ? (
        <Panel className="mb-6 grid grid-cols-2 divide-line md:grid-cols-5 md:divide-x [&>*]:border-line max-md:[&>*:nth-child(-n+4)]:border-b max-md:[&>*:nth-child(odd)]:border-r max-md:[&>*:last-child]:col-span-2">
          <LedgerStat label="Arriving" value={desk.data?.counts.arrivals ?? 0} loading={desk.isLoading} sub={`${desk.data?.counts.arrivalsPending ?? 0} still to come`} />
          <LedgerStat label="In the house" value={desk.data?.counts.inHouse ?? 0} loading={desk.isLoading} sub={`${occupied} of ${total} rooms occupied`} swatch="OCCUPIED" />
          <LedgerStat label="Leaving" value={desk.data?.counts.departures ?? 0} loading={desk.isLoading} sub={`${desk.data?.counts.departuresPending ?? 0} still to go`} />
          <LedgerStat label="Ready to sell" value={clean} loading={rooms.isLoading} sub={`${dirty} dirty, ${ooo} out of order`} swatch="VACANT_CLEAN" />
          <FlagsStat count={desk.data?.openFlags ?? null} loading={desk.isLoading} canSee={can("guard.read")} />
        </Panel>
      ) : (
        <Panel className="mb-6 grid grid-cols-2 divide-line md:grid-cols-4 md:divide-x [&>*]:border-line max-md:[&>*:nth-child(-n+2)]:border-b max-md:[&>*:nth-child(odd)]:border-r">
          <LedgerStat label="Rooms on the rack" value={total} loading={rooms.isLoading} sub="on your plan" />
          <LedgerStat label="Ready to sell" value={clean} loading={rooms.isLoading} sub="vacant and clean" swatch="VACANT_CLEAN" />
          <LedgerStat label="Needs attention" value={dirty + ooo} loading={rooms.isLoading} sub={`${dirty} dirty, ${ooo} out of order`} swatch={dirty + ooo > 0 ? "VACANT_DIRTY" : undefined} />
          <LedgerStat label="Team" value={dash.data?.staffCount ?? me.data?.entitlements.usage.staff ?? 0} loading={dash.isLoading} sub="staff with access" />
        </Panel>
      )}

      {deskOn && (
        <div className="mb-6">
          <FrontDeskBoard data={desk.data} loading={desk.isLoading} onPeek={setPeek} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        {/* key rack */}
        <Panel className="flex flex-col overflow-hidden lg:col-span-8">
          <PanelHeader
            eyebrow={
              <span className="flex items-center gap-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-[breathe_2s_ease-in-out_infinite] rounded-full bg-palm" />
                </span>
                Live board
              </span>
            }
            title="The key rack"
            description={
              <>
                <span className="sm:hidden">Tap a key to change its status.</span>
                <span className="hidden sm:inline">Hover a key for notes. Click, or press Enter, to change its status.</span>
              </>
            }
            actions={
              <Link href="/rooms" className="inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink">
                All rooms <ArrowUpRight size={13} />
              </Link>
            }
          />
          <div className="border-b border-line bg-surface px-5 py-3">
            <RackLegend counts={counts} active={filter} onToggle={toggle} />
          </div>
          <div className="relative flex-1 bg-rack px-4 pb-4 pt-2 sm:px-5">
            <RackScrews />
            {rooms.isLoading ? (
              <KeyRackSkeleton />
            ) : rooms.isError ? (
              <ErrorState error={rooms.error} onRetry={() => rooms.refetch()} />
            ) : !rooms.data?.length ? (
              <EmptyState
                glyph="ladder"
                title="No keys on the rack yet"
                body="Add your rooms floor by floor. A range like 101 to 120 takes one step."
                action={
                  <ButtonLink href="/rooms?new=bulk">
                    <Plus size={15} weight="bold" /> Add rooms
                  </ButtonLink>
                }
              />
            ) : (
              <KeyRack rooms={rooms.data} onSelect={setSelected} selectedId={selected?.id} highlight={filter} />
            )}
          </div>
        </Panel>

        <div className="flex flex-col gap-6 lg:col-span-4">
          {can("shift.own") && <ShiftCard />}
          {/* tonight */}
          <Panel>
            <PanelHeader eyebrow="Tonight" title="Occupancy" />
            <div className="flex items-center gap-5 px-5 py-5">
              {rooms.isLoading ? (
                <Skeleton className="h-[132px] w-[132px] rounded-full" />
              ) : (
                <OccupancyRing byStatus={byStatus} total={total} size={132} />
              )}
              <ul className="flex min-w-0 flex-1 flex-col gap-2">
                {ROOM_STATUS_ORDER.map((s) => (
                  <li key={s} className="flex items-center gap-2 text-[13px]">
                    <StatusSwatch status={s} size={14} />
                    <span className="truncate text-ink-muted">{ROOM_STATUS[s].label}</span>
                    <span className="ml-auto font-mono text-ink">{byStatus[s] ?? 0}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          <PlanUsage />
        </div>

        {/* activity + housekeeping queue */}
        <Panel className="lg:col-span-8">
          <PanelHeader
            eyebrow="Ledger"
            title="Recent activity"
            actions={
              <Link href="/audit" className="inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink">
                Audit log <ArrowUpRight size={13} />
              </Link>
            }
          />
          <div className="px-5 py-5">
            {dash.isLoading ? (
              <div className="flex flex-col gap-4">
                {Array.from({ length: 4 }, (_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-2 pt-1">
                      <Skeleton className="h-3.5 w-2/3" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                ))}
              </div>
            ) : dash.isError ? (
              <ErrorState error={dash.error} onRetry={() => dash.refetch()} />
            ) : dash.data?.recentActivity?.length ? (
              <ActivityFeed items={dash.data.recentActivity} />
            ) : (
              <EmptyState compact glyph="river" title="A quiet ledger" body="Changes to rooms, staff and settings will be written here." />
            )}
          </div>
        </Panel>

        <HousekeepingQueue rooms={rooms.data} loading={rooms.isLoading} onOpen={setSelected} />
      </div>

      <RoomSheet room={selectedLive} onOpenChange={(o) => !o && setSelected(null)} />
      <ReservationPeek id={peek} onOpenChange={(o) => !o && setPeek(null)} />
    </>
  );
}

function FlagsStat({ count, loading, canSee }: { count: number | null; loading: boolean; canSee: boolean }) {
  const inner = (
    <>
      <span className="display-sm flex items-center gap-2 text-[14.5px] italic text-ink-muted">
        <ShieldWarning size={15} weight="duotone" className={count ? "text-laterite" : ""} />
        Revenue Guard
      </span>
      {loading ? (
        <Skeleton className="h-9 w-16" />
      ) : (
        <span className={cn("font-mono text-[34px] leading-none tracking-tight md:text-[40px]", count ? "text-laterite" : "text-ink")}>
          {count ?? "-"}
        </span>
      )}
      <span className="text-[12.5px] text-ink-muted">{count === null ? "not on your plan" : count ? "open flags to review" : "nothing to review"}</span>
    </>
  );
  if (canSee && count !== null)
    return (
      <Link href="/guard" className="relative flex flex-col gap-2 px-5 py-5 transition-colors hover:bg-surface-2/50 md:px-6" data-testid="flags-stat">
        {inner}
      </Link>
    );
  return <div className="relative flex flex-col gap-2 px-5 py-5 md:px-6">{inner}</div>;
}

function ShiftCard() {
  const shift = useCurrentShift();
  const s = shift.data;
  return (
    <Panel className="overflow-hidden">
      <div className="flex items-start gap-3 px-5 py-4">
        <span
          className={cn(
            "mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full border",
            s ? "border-[color-mix(in_oklab,var(--palm)_40%,transparent)] bg-palm-wash text-palm" : "border-line-strong bg-surface-2 text-ink-muted",
          )}
        >
          <Coins size={18} weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow mb-0.5">Your till</p>
          {shift.isLoading ? (
            <Skeleton className="h-5 w-40" />
          ) : s ? (
            <>
              <p className="text-[14px] font-medium text-ink" suppressHydrationWarning>
                Shift open since <span className="font-mono">{lagosHHMM(s.openedAt)}</span>
              </p>
              <p className="text-[12.5px] text-ink-muted">
                Float <span className="font-mono">{naira(s.openingFloatKobo)}</span>. Totals stay hidden until you count.
              </p>
            </>
          ) : (
            <>
              <p className="text-[14px] font-medium text-ink">No shift open</p>
              <p className="text-[12.5px] text-ink-muted">Open one before taking cash, transfer or POS.</p>
            </>
          )}
        </div>
      </div>
      <div className="border-t border-line bg-surface-2/40 px-5 py-2.5">
        <Link href="/shifts" className="inline-flex items-center gap-1 text-[13px] font-medium text-laterite hover:underline">
          {s ? "Close my shift" : "Open a shift"} <ArrowRight size={13} weight="bold" />
        </Link>
      </div>
    </Panel>
  );
}

function LedgerStat({
  label,
  value,
  sub,
  loading,
  swatch,
}: {
  label: string;
  value: number;
  sub?: string;
  loading?: boolean;
  swatch?: RoomStatus;
}) {
  return (
    <div className="relative flex flex-col gap-2 px-5 py-5 md:px-6">
      <span className="display-sm flex items-center gap-2 text-[14.5px] italic text-ink-muted">
        {swatch && <StatusSwatch status={swatch} size={14} />}
        {label}
      </span>
      {loading ? (
        <Skeleton className="h-9 w-16" />
      ) : (
        <span className="flex items-baseline gap-2 font-mono text-[34px] leading-none tracking-tight text-ink md:text-[40px]">
          {value}
        </span>
      )}
      {sub && <span className="text-[12.5px] text-ink-muted">{sub}</span>}
    </div>
  );
}

function RackScrews() {
  return (
    <>
      {["left-2 top-2", "right-2 top-2", "left-2 bottom-2", "right-2 bottom-2"].map((pos) => (
        <span
          key={pos}
          aria-hidden
          className={`absolute ${pos} grid h-2.5 w-2.5 place-items-center rounded-full border border-line-strong bg-surface-2`}
        >
          <span className="h-px w-1.5 rotate-45 bg-ink-faint" />
        </span>
      ))}
    </>
  );
}

function PlanUsage() {
  const me = useMe();
  if (me.isLoading || !me.data)
    return (
      <Panel className="p-5">
        <Skeleton className="mb-4 h-5 w-32" />
        <Skeleton className="mb-3 h-3 w-full" />
        <Skeleton className="mb-3 h-3 w-full" />
        <Skeleton className="h-3 w-full" />
      </Panel>
    );
  const { subscription: sub, entitlements: ent } = me.data;
  const left = sub.status === "TRIALING" ? daysUntil(sub.trialEndsAt) : null;
  return (
    <Panel>
      <PanelHeader
        eyebrow="Your plan"
        title={
          <span className="flex items-center gap-2">
            {sub.planName} <PlanPlate name={SUB_STATUS[sub.status]?.label ?? sub.status} code={sub.planCode} />
          </span>
        }
        description={
          left !== null
            ? `${left} ${left === 1 ? "day" : "days"} left, trial ends ${formatDate(sub.trialEndsAt)}`
            : sub.currentPeriodEnd
              ? sub.status === "ACTIVE"
                ? `Renews ${formatDate(sub.currentPeriodEnd)}`
                : `Period ended ${formatDate(sub.currentPeriodEnd)}`
              : undefined
        }
      />
      <div className="flex flex-col gap-4 px-5 py-5">
        {(["max_rooms", "max_staff", "max_properties"] as const).map((k) => (
          <Meter
            key={k}
            label={LIMIT_LABEL[k].label}
            used={k === "max_rooms" ? ent.usage.rooms : k === "max_staff" ? ent.usage.staff : ent.usage.properties}
            max={ent.limits[k]}
          />
        ))}
        <ButtonLink href="/billing#plans" variant="secondary" size="sm" className="mt-1 self-start">
          Compare plans <ArrowRight size={13} weight="bold" />
        </ButtonLink>
      </div>
    </Panel>
  );
}

function HousekeepingQueue({
  rooms,
  loading,
  onOpen,
}: {
  rooms: Room[] | undefined;
  loading: boolean;
  onOpen: (r: Room) => void;
}) {
  const setStatus = useRoomStatus();
  const queue = (rooms ?? [])
    .filter((r) => r.status === "VACANT_DIRTY" || r.status === "OUT_OF_ORDER")
    .sort((a, b) => (a.status === b.status ? a.number.localeCompare(b.number, undefined, { numeric: true }) : a.status === "VACANT_DIRTY" ? -1 : 1));
  return (
    <Panel className="lg:col-span-4">
      <PanelHeader eyebrow="To turn around" title="Housekeeping queue" />
      <div className="px-2 py-2">
        {loading ? (
          <div className="space-y-2 p-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : queue.length === 0 ? (
          <EmptyState compact glyph="frond" title="Nothing waiting" body="Every vacant room is clean and ready to sell." />
        ) : (
          <ul className="flex flex-col">
            {queue.map((r) => (
              <li key={r.id} className="group flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-surface-2/60">
                <StatusSwatch status={r.status} size={20} />
                <button onClick={() => onOpen(r)} className="min-w-0 flex-1 text-left">
                  <span className="font-mono text-[14px] text-ink">{r.number}</span>
                  <span className="ml-2 text-[12.5px] text-ink-muted">{ROOM_STATUS[r.status].label}</span>
                  {r.notes && <span className="block truncate text-[12px] text-ink-faint">{r.notes}</span>}
                  {!r.notes && <span className="block text-[12px] text-ink-faint">since {relativeTime(r.updatedAt)}</span>}
                </button>
                {r.status === "VACANT_DIRTY" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setStatus.mutate({ id: r.id, status: "VACANT_CLEAN", number: r.number })}
                    aria-label={`Mark room ${r.number} clean`}
                  >
                    <Broom size={14} weight="duotone" />
                    Clean
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
