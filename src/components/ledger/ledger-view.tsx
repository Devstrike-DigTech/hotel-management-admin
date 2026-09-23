"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowCounterClockwise,
  CalendarBlank,
  CaretLeft,
  CaretRight,
  CrosshairSimple,
  Keyboard,
  Plus,
} from "@phosphor-icons/react";
import * as Popover from "@radix-ui/react-popover";
import { useTapeChart } from "@/lib/api/hooks-m2";
import { reservationsApi } from "@/lib/api/endpoints-m2";
import { useDeskRefresh } from "@/lib/api/mutations-m2";
import { useCan } from "@/lib/permissions";
import { openNewReservation } from "@/lib/store-m2";
import { addDays, dayKeyOf, formatDay, todayKey, type DayKey } from "@/lib/dates";
import { ChannelBadge } from "@/components/m3/bits";
import { STAY_STATUS } from "@/lib/catalog-m2";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ErrorState, Segmented, Skeleton } from "@/components/ui/primitives";
import { ReservationPeek } from "@/components/reservations/peek";
import { Ledger, startLedgerMove, type LedgerHandle } from "./ledger";
import type { GroupBy, LedgerChange, LedgerRoom, LedgerStay } from "./model";

const ZOOM = [
  { value: "wide", width: 104, label: "Week" },
  { value: "mid", width: 58, label: "Fortnight" },
  { value: "tight", width: 34, label: "Month" },
] as const;
type Zoom = (typeof ZOOM)[number]["value"];

const SPAN = 60;

export function LedgerView() {
  const today = todayKey();
  const [from, setFrom] = useState<DayKey>(() => addDays(today, -7));
  const to = addDays(from, SPAN - 1);
  const [zoom, setZoom] = useState<Zoom>("mid");
  const [groupBy, setGroupBy] = useState<GroupBy>("floor");
  const [peek, setPeek] = useState<string | null>(null);
  const [undoCount, setUndoCount] = useState(0);
  const ledger = useRef<LedgerHandle>(null);
  const q = useTapeChart(from, to);
  // deep link: /ledger?room=308 scrolls to that room (maintenance links here)
  const wantRoom = useSearchParams().get("room");
  const jumped = useRef<string | null>(null);
  useEffect(() => {
    if (!wantRoom || !q.data || jumped.current === wantRoom) return;
    const r = q.data.rooms.find((x) => x.number === wantRoom);
    if (!r) return;
    jumped.current = wantRoom;
    const id = window.setTimeout(() => ledger.current?.scrollToRoom(r.id, "auto"), 60);
    return () => window.clearTimeout(id);
  }, [wantRoom, q.data]);
  const refresh = useDeskRefresh();
  const { can } = useCan();
  const editable = can("reservations.write");

  const rooms: LedgerRoom[] = useMemo(
    () =>
      (q.data?.rooms ?? []).map((r) => ({
        id: r.id,
        number: r.number,
        floor: r.floor,
        roomTypeId: r.roomType.id,
        roomTypeName: r.roomType.name,
        status: r.status,
      })),
    [q.data],
  );
  const stays: LedgerStay[] = useMemo(
    () =>
      [...(q.data?.stays ?? []), ...(q.data?.unassigned ?? [])].map((s) => ({
        id: s.reservationId,
        code: s.code,
        roomId: s.roomId,
        roomTypeId: s.roomTypeId,
        guestName: s.guestName,
        arrivalAt: s.arrivalAt,
        departureAt: s.departureAt,
        status: s.status,
        stayType: s.stayType,
        balanceKobo: s.balanceKobo,
        vip: s.vip,
        adults: s.adults,
        source: s.source,
        paymentMode: s.paymentMode ?? null,
        holdExpiresAt: s.holdExpiresAt ?? null,
      })),
    [q.data],
  );

  const onChange = useCallback(
    async (c: LedgerChange) => {
      const { stay } = c;
      if (stay.status === "CHECKED_IN" && c.roomId && c.roomId !== stay.roomId) {
        await reservationsApi.moveRoom(stay.id, c.roomId, "Moved on the ledger");
      } else if (stay.stayType === "DAY_USE") {
        await reservationsApi.update(stay.id, {
          ...(stay.status === "CHECKED_IN" ? {} : { arrivalAt: c.arrivalAt, roomId: c.roomId }),
          departureAt: c.departureAt,
        });
      } else {
        await reservationsApi.update(stay.id, {
          ...(stay.status === "CHECKED_IN" ? {} : { arrivalDate: dayKeyOf(c.arrivalAt), roomId: c.roomId }),
          departureDate: dayKeyOf(c.departureAt),
        });
      }
      await refresh();
    },
    [refresh],
  );

  const dw = ZOOM.find((z) => z.value === zoom)!.width;
  const width = dw;

  const shift = (days: number) => setFrom((f) => addDays(f, days));
  const legend = (["CONFIRMED", "PENDING", "CHECKED_IN", "CHECKED_OUT"] as const).map((s) => ({ s, m: STAY_STATUS[s] }));

  return (
    <div className="flex flex-col">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow mb-2 whitespace-nowrap">
            Reservations &middot; {formatDay(from, { day: "numeric", month: "short" })} to {formatDay(to, { day: "numeric", month: "short" })}
          </p>
          <h1 className="display text-[34px] leading-none text-ink md:text-[42px]">
            The <em>Ledger</em>
          </h1>
        </div>
        <div className="flex items-center gap-2">
          {editable && (
            <Button variant="secondary" onClick={() => ledger.current?.undo()} disabled={!undoCount} aria-label="Undo last move">
              <ArrowCounterClockwise size={15} weight="bold" />
              <span className="hidden sm:inline">Undo</span>
              {undoCount > 0 && <span className="font-mono text-[11px] text-ink-faint">{undoCount}</span>}
            </Button>
          )}
          <ShortcutsHelp />
          {editable && (
            <Button onClick={() => openNewReservation({})}>
              <Plus size={15} weight="bold" /> New reservation
            </Button>
          )}
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-md border border-line bg-surface">
          <button onClick={() => shift(-14)} className="grid h-8 w-8 place-items-center text-ink-muted hover:text-ink" aria-label="Two weeks earlier">
            <CaretLeft size={14} weight="bold" />
          </button>
          <button
            onClick={() => {
              const target = addDays(today, -7);
              if (target !== from) setFrom(target);
              window.setTimeout(() => ledger.current?.scrollToDay(today), 60);
            }}
            className="flex h-8 items-center gap-1.5 border-x border-line px-2.5 text-[12.5px] font-medium text-ink hover:bg-surface-2"
          >
            <CrosshairSimple size={13} /> Today
          </button>
          <button onClick={() => shift(14)} className="grid h-8 w-8 place-items-center text-ink-muted hover:text-ink" aria-label="Two weeks later">
            <CaretRight size={14} weight="bold" />
          </button>
        </div>
        <label className="relative inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 text-[12.5px] font-medium text-ink hover:bg-surface-2">
          <CalendarBlank size={14} className="text-ink-muted" />
          Jump to
          <input
            type="date"
            aria-label="Jump to date"
            className="absolute inset-0 cursor-pointer opacity-0"
            value=""
            onChange={(e) => {
              const k = e.target.value;
              if (!k) return;
              if (k < from || k > addDays(to, -10)) setFrom(addDays(k, -7));
              window.setTimeout(() => ledger.current?.scrollToDay(k), 80);
            }}
          />
        </label>
        <Segmented<Zoom>
          label="Zoom"
          size="sm"
          value={zoom}
          onChange={setZoom}
          options={ZOOM.map((z) => ({ value: z.value, label: z.label }))}
          className="hidden sm:inline-flex"
        />
        <Segmented<GroupBy>
          label="Group rooms by"
          size="sm"
          value={groupBy}
          onChange={setGroupBy}
          options={[
            { value: "floor", label: "Floor" },
            { value: "type", label: "Type" },
          ]}
        />
        <div className="ml-auto hidden flex-wrap items-center gap-x-4 gap-y-1 text-[11.5px] text-ink-muted xl:flex">
          {legend.map(({ s, m }) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-4 rounded-[2px]"
                style={{
                  background: m.wash,
                  border: `1px ${s === "PENDING" ? "dashed" : "solid"} color-mix(in oklab, ${m.color} 45%, transparent)`,
                  boxShadow: `inset 2px 0 0 ${m.color}`,
                }}
              />
              {m.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="hatch h-2.5 w-1.5 rounded-[1px] border border-line-strong text-adire" />
            Day use
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="relative h-2.5 w-4 rounded-[2px] border border-line-strong bg-surface">
              <span className="absolute right-0 top-0 h-0 w-0 border-l-[5px] border-t-[5px] border-l-transparent" style={{ borderTopColor: "var(--ochre)" }} />
            </span>
            Owes
          </span>
          <span className="inline-flex items-center gap-1.5">
            <ChannelBadge source="MARKETPLACE" size="sm" />
            <ChannelBadge source="BOOKING_SITE" size="sm" />
            <span>booked online</span>
          </span>
        </div>
      </div>

      {q.isError && !q.data ? (
        <div className="rounded-lg border border-line bg-surface">
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </div>
      ) : !q.data ? (
        <div className="rounded-lg border border-line bg-surface p-4">
          <div className="flex flex-col gap-2">
            {Array.from({ length: 12 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-6" style={{ width: `${30 + ((i * 37) % 60)}%`, marginLeft: `${(i * 13) % 20}%` }} />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <Ledger
          ref={ledger}
          key={from}
          initialDay={today >= from && today <= addDays(from, 14) ? today : addDays(from, 7)}
          rooms={rooms}
          stays={stays}
          from={from}
          days={SPAN}
          dayWidth={width}
          groupBy={groupBy}
          checkInTime={q.data.checkInTime}
          checkOutTime={q.data.checkOutTime}
          blocks={q.data.blocks}
          editable={editable}
          onChange={onChange}
          onCreate={(p) => openNewReservation({ roomId: p.roomId, roomTypeId: p.roomTypeId, arrival: p.arrival, departure: p.departure })}
          onOpen={(s) => setPeek(s.id)}
          onUndoChange={setUndoCount}
          style={{ height: "max(440px, calc(100dvh - 250px))" }}
          className={cn(q.isFetching && "[&_[role=region]]:opacity-95")}
        />
      )}

      <ReservationPeek
        id={peek}
        onOpenChange={(o) => !o && setPeek(null)}
        onMove={(id) => {
          setPeek(null);
          window.setTimeout(() => startLedgerMove(id), 250);
        }}
      />
    </div>
  );
}

function ShortcutsHelp() {
  const rows: [string, string][] = [
    ["Tab", "Move between stays"],
    ["Enter", "Open a stay"],
    ["M", "Move the focused stay"],
    ["Arrows", "Change dates / room while moving"],
    ["Shift + Arrows", "Shorter or longer"],
    ["Enter / Esc", "Save / cancel the move"],
    ["Ctrl or Cmd + Z", "Undo the last move"],
  ];
  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label="Keyboard shortcuts" className="hidden sm:inline-flex">
          <Keyboard size={18} weight="duotone" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-72 rounded-md border border-line bg-surface p-3 shadow-float animate-[rise_160ms_ease-out]"
        >
          <p className="eyebrow mb-2">Keyboard</p>
          <dl className="flex flex-col gap-1.5">
            {rows.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 text-[12.5px]">
                <dt className="text-ink-muted">{v}</dt>
                <dd className="kbd">{k}</dd>
              </div>
            ))}
          </dl>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
