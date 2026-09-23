"use client";

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Room, RoomStatus } from "@/lib/api/types";
import { ROOM_STATUS, ROOM_STATUS_ORDER } from "@/lib/catalog";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { FOB_PATH } from "@/components/brand";
import { patternFill, StatusSwatch } from "./status-swatch";

/* ------------------------------------------------------------------------ */
/* The Key Rack: rooms as brass key fobs hanging on per-floor rails.         */
/* ------------------------------------------------------------------------ */

export function groupByFloor(rooms: Room[]) {
  const map = new Map<number, Room[]>();
  for (const r of rooms) {
    const list = map.get(r.floor) ?? [];
    list.push(r);
    map.set(r.floor, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a - b)
    .map(([floor, list]) => ({
      floor,
      rooms: list.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true })),
    }));
}

export function KeyRack({
  rooms,
  onSelect,
  selectedId,
  highlight,
  dense,
}: {
  rooms: Room[];
  onSelect: (room: Room) => void;
  selectedId?: string | null;
  highlight?: Set<RoomStatus> | null;
  dense?: boolean;
}) {
  const floors = useMemo(() => groupByFloor(rooms), [rooms]);
  const flat = useMemo(() => floors.flatMap((f) => f.rooms), [floors]);
  const [focusId, setFocusId] = useState<string | null>(null);
  const refs = useRef(new Map<string, HTMLButtonElement>());

  const activeId = focusId && flat.some((r) => r.id === focusId) ? focusId : flat[0]?.id;

  const moveTo = useCallback((id: string | undefined) => {
    if (!id) return;
    setFocusId(id);
    refs.current.get(id)?.focus();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent, room: Room) => {
    const fi = floors.findIndex((f) => f.floor === room.floor);
    const idx = floors[fi].rooms.findIndex((r) => r.id === room.id);
    const flatIdx = flat.findIndex((r) => r.id === room.id);
    switch (e.key) {
      case "ArrowRight":
        e.preventDefault();
        moveTo(flat[Math.min(flat.length - 1, flatIdx + 1)]?.id);
        break;
      case "ArrowLeft":
        e.preventDefault();
        moveTo(flat[Math.max(0, flatIdx - 1)]?.id);
        break;
      case "ArrowDown": {
        e.preventDefault();
        const next = floors[fi + 1];
        if (next) moveTo(next.rooms[Math.min(idx, next.rooms.length - 1)]?.id);
        break;
      }
      case "ArrowUp": {
        e.preventDefault();
        const prev = floors[fi - 1];
        if (prev) moveTo(prev.rooms[Math.min(idx, prev.rooms.length - 1)]?.id);
        break;
      }
      case "Home":
        e.preventDefault();
        moveTo(flat[0]?.id);
        break;
      case "End":
        e.preventDefault();
        moveTo(flat[flat.length - 1]?.id);
        break;
    }
  };

  return (
    <div
      role="grid"
      aria-label="Key rack: rooms by floor. Use arrow keys to move, Enter to change status."
      className="flex flex-col"
    >
      {floors.map(({ floor, rooms: list }) => (
        <div
          role="row"
          key={floor}
          className="flex items-stretch gap-3 border-b border-dashed border-line-strong/70 py-4 first:pt-2 last:border-b-0 sm:gap-5"
        >
          <div role="rowheader" className="flex w-11 shrink-0 flex-col items-center pt-1 sm:w-14">
            <FloorPlate floor={floor} />
            <span className="mt-1.5 font-mono text-[10px] text-ink-faint">{list.length} rm</span>
          </div>
          <div className="flex min-w-0 flex-1 flex-wrap">
            {list.map((room) => (
              <KeyTag
                key={room.id}
                room={room}
                dense={dense}
                tabIndex={room.id === activeId ? 0 : -1}
                selected={room.id === selectedId}
                dimmed={!!highlight && highlight.size > 0 && !highlight.has(room.status)}
                onFocus={() => setFocusId(room.id)}
                onKeyDown={(e) => onKeyDown(e, room)}
                onClick={() => onSelect(room)}
                refCb={(el) => {
                  if (el) refs.current.set(room.id, el);
                  else refs.current.delete(room.id);
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function FloorPlate({ floor }: { floor: number }) {
  return (
    <span
      className="relative grid h-9 w-full place-items-center rounded-xs border font-mono text-[15px] font-medium text-brass"
      style={{
        borderColor: "color-mix(in oklab, var(--brass) 55%, transparent)",
        background:
          "linear-gradient(180deg, color-mix(in oklab, var(--brass) 16%, transparent), color-mix(in oklab, var(--brass) 6%, transparent))",
      }}
      aria-label={`Floor ${floor}`}
    >
      <Screw className="left-[3px] top-[3px]" />
      <Screw className="right-[3px] top-[3px]" />
      {String(floor).padStart(2, "0")}
    </span>
  );
}

function Screw({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute h-[4px] w-[4px] rounded-full bg-[color-mix(in_oklab,var(--brass)_55%,transparent)]",
        className,
      )}
    />
  );
}

interface KeyTagProps {
  room: Room;
  tabIndex: number;
  selected?: boolean;
  dimmed?: boolean;
  dense?: boolean;
  onFocus: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onClick: () => void;
  refCb: (el: HTMLButtonElement | null) => void;
}

const KeyTag = memo(function KeyTag({
  room,
  tabIndex,
  selected,
  dimmed,
  dense,
  onFocus,
  onKeyDown,
  onClick,
  refCb,
}: KeyTagProps) {
  const m = ROOM_STATUS[room.status];
  const pat = patternFill(room.status);
  const [swingKey, setSwingKey] = useState(0);
  const prev = useRef(room.status);

  // swing when status changes (e.g. after an optimistic update)
  useEffect(() => {
    if (prev.current !== room.status) {
      prev.current = room.status;
      setSwingKey((k) => k + 1);
    }
  }, [room.status]);

  const label = `Room ${room.number}, ${room.roomType?.name ?? "room"}, ${m.label}${room.notes ? `. Note: ${room.notes}` : ""}`;
  const num = room.number.length > 4 ? room.number.slice(-4) : room.number;
  const fontSize = num.length >= 4 ? 10.5 : 12.5;

  return (
    <div role="gridcell" className={cn("rack-slot relative", dense ? "w-[50px]" : "w-[52px] sm:w-[60px] xl:w-[66px]")}>
      {/* brass rail segment */}
      <span aria-hidden className="rack-rail absolute inset-x-0 top-[4px] h-[3px]" />
      <TooltipPrimitive.Root delayDuration={320}>
        <TooltipPrimitive.Trigger asChild>
          <button
            ref={refCb}
            type="button"
            tabIndex={tabIndex}
            aria-label={label}
            aria-haspopup="dialog"
            onFocus={onFocus}
            onKeyDown={onKeyDown}
            onClick={onClick}
            className={cn(
              "group relative block w-full rounded-sm outline-none transition-opacity duration-200 focus-visible:outline-none",
              dimmed && "opacity-25 hover:opacity-80 focus-visible:opacity-100",
            )}
          >
            <svg viewBox="0 0 60 78" className="block w-full overflow-visible" aria-hidden>
              {/* peg */}
              <circle cx="30" cy="5.5" r="2.6" style={{ fill: "var(--rack-rail)" }} />
              <circle cx="29.3" cy="4.8" r="0.9" style={{ fill: "var(--surface)", fillOpacity: 0.6 }} />
              <g key={swingKey} className={cn("tag-swing", swingKey > 0 && "is-changed")}>
                {/* split ring over the peg */}
                <circle cx="30" cy="13" r="7.4" style={{ fill: "none", stroke: "var(--rack-rail)", strokeWidth: 1.4 }} />
                <g transform="translate(8 9)">
                  {/* soft cast shadow */}
                  <path d={FOB_PATH} transform="translate(1.2 2)" style={{ fill: "var(--ink)", fillOpacity: 0.07 }} />
                  <path
                    d={FOB_PATH}
                    className="transition-[stroke-width] duration-150"
                    style={{
                      fill: m.wash,
                      stroke: selected ? "var(--laterite)" : m.color,
                      strokeWidth: selected ? 2.6 : 1.3,
                    }}
                  />
                  {pat && <path d={FOB_PATH} style={{ fill: pat }} />}
                  {m.pattern === "ring" && (
                    <path
                      d={FOB_PATH}
                      transform="translate(22 30) scale(0.8 0.84) translate(-22 -30)"
                      style={{ fill: "none", stroke: m.color, strokeWidth: 1, strokeDasharray: "2.2 1.8" }}
                    />
                  )}
                  {/* band */}
                  <clipPath id={`band-${room.id}`}>
                    <path d={FOB_PATH} />
                  </clipPath>
                  <rect
                    x="0"
                    y="41"
                    width="44"
                    height="24"
                    clipPath={`url(#band-${room.id})`}
                    style={{ fill: m.color }}
                  />
                  {/* eyelet */}
                  <circle cx="22" cy="12" r="3.6" style={{ fill: "var(--rack)", stroke: "var(--rack-rail)", strokeWidth: 1.1 }} />
                  <text
                    x="22"
                    y="31.5"
                    textAnchor="middle"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize,
                      fontWeight: 600,
                      fill: "var(--ink)",
                      letterSpacing: "-0.02em",
                      paintOrder: "stroke",
                      stroke: m.wash,
                      strokeWidth: 3,
                    }}
                  >
                    {num}
                  </text>
                  <text
                    x="22"
                    y="51.5"
                    textAnchor="middle"
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 7,
                      fontWeight: 600,
                      letterSpacing: "0.12em",
                      fill: "var(--surface)",
                    }}
                  >
                    {m.short}
                  </text>
                </g>
              </g>
            </svg>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-x-[5px] bottom-0 top-[10px] rounded-md opacity-0 ring-2 ring-laterite ring-offset-2 ring-offset-[var(--rack)] group-focus-visible:opacity-100"
            />
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="bottom"
            sideOffset={4}
            collisionPadding={12}
            className="z-[60] w-56 rounded-md border border-line bg-surface p-3 shadow-float animate-[rise_160ms_ease-out]"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-mono text-[18px] leading-none text-ink">{room.number}</p>
                <p className="mt-1 text-[12.5px] text-ink-muted">{room.roomType?.name}</p>
              </div>
              <span
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{ background: m.wash, color: m.color }}
              >
                <StatusSwatch status={room.status} size={12} />
                {m.label}
              </span>
            </div>
            {room.notes ? (
              <p className="mt-2.5 border-l-2 border-brass pl-2 text-[12.5px] leading-snug text-ink">{room.notes}</p>
            ) : (
              <p className="mt-2.5 text-[12px] italic text-ink-faint">No notes on this key.</p>
            )}
            <p className="mt-2.5 flex items-center justify-between border-t border-line pt-2 text-[11px] text-ink-faint">
              <span>Floor {room.floor}</span>
              <span>Updated {relativeTime(room.updatedAt)}</span>
            </p>
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </div>
  );
});


/* ---------------- legend + filter ---------------- */

export function RackLegend({
  counts,
  active,
  onToggle,
  className,
}: {
  counts: Partial<Record<RoomStatus, number>>;
  active: Set<RoomStatus>;
  onToggle: (s: RoomStatus) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)} role="group" aria-label="Filter by status">
      {ROOM_STATUS_ORDER.map((s) => {
        const m = ROOM_STATUS[s];
        const on = active.has(s);
        return (
          <button
            key={s}
            type="button"
            aria-pressed={on}
            onClick={() => onToggle(s)}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-full border pl-2 pr-3 text-[12.5px] transition-colors duration-150",
              on ? "text-ink" : "border-line bg-surface text-ink-muted hover:border-line-strong hover:text-ink",
            )}
            style={on ? { borderColor: m.color, background: m.wash } : undefined}
          >
            <StatusSwatch status={s} size={16} />
            <span>{m.label}</span>
            <span className="font-mono text-[12px] text-ink">{counts[s] ?? 0}</span>
          </button>
        );
      })}
    </div>
  );
}

export function KeyRackSkeleton({ floors = 3, perFloor = 8 }: { floors?: number; perFloor?: number }) {
  return (
    <div className="flex flex-col" aria-busy aria-label="Loading rooms">
      {Array.from({ length: floors }, (_, f) => (
        <div key={f} className="flex gap-3 border-b border-dashed border-line py-4 last:border-b-0 sm:gap-5">
          <div className="shimmer h-9 w-11 rounded-xs sm:w-14" />
          <div className="flex flex-1 flex-wrap gap-2">
            {Array.from({ length: perFloor }, (_, i) => (
              <div
                key={i}
                className="shimmer h-[64px] w-[44px] rounded-b-[18px] rounded-t-md sm:h-[70px] sm:w-[50px]"
                style={{ animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
