"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useCan } from "@/lib/permissions";
import { PencilSimple } from "@phosphor-icons/react";
import type { Room, RoomStatus } from "@/lib/api/types";
import { ROOM_STATUS, ROOM_STATUS_ORDER } from "@/lib/catalog";
import { relativeTime } from "@/lib/format";
import { useRoomStatus } from "@/lib/api/mutations";
import { cn } from "@/lib/cn";
import { Sheet } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { FOB_PATH } from "@/components/brand";
import { patternFill, StatusSwatch } from "./status-swatch";

/** Side sheet to change a room's status. Optimistic: closes immediately, the rack flips at once. */
export function RoomSheet({
  room,
  onOpenChange,
  onEdit,
}: {
  room: Room | null;
  onOpenChange: (open: boolean) => void;
  onEdit?: (room: Room) => void;
}) {
  const [status, setStatus] = useState<RoomStatus>("VACANT_CLEAN");
  const [note, setNote] = useState("");
  const mutation = useRoomStatus();
  const { role } = useCan();
  // Housekeeping may only turn a dirty room clean (API-M2 section 10).
  const allowed = useCallback(
    (s: RoomStatus) => role !== "HOUSEKEEPING" || !room || s === room.status || (room.status === "VACANT_DIRTY" && s === "VACANT_CLEAN"),
    [role, room],
  );
  const allowedRef = useRef(allowed);
  useEffect(() => {
    allowedRef.current = allowed;
  }, [allowed]);

  const [lastId, setLastId] = useState<string | null>(null);
  if (room && room.id !== lastId) {
    setLastId(room.id);
    setStatus(room.status);
    setNote(room.notes ?? "");
  }

  useEffect(() => {
    if (!room) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "TEXTAREA" || t.tagName === "INPUT") return;
      const s = ROOM_STATUS_ORDER.find((k) => ROOM_STATUS[k].key === e.key);
      if (s && allowedRef.current(s)) {
        e.preventDefault();
        setStatus(s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [room]);

  const save = () => {
    if (!room) return;
    const changedNote = (note || "") !== (room.notes || "");
    if (status === room.status && !changedNote) {
      onOpenChange(false);
      return;
    }
    mutation.mutate({ id: room.id, status, note: changedNote ? note : undefined, number: room.number });
    onOpenChange(false);
  };

  const m = ROOM_STATUS[status];

  return (
    <Sheet
      open={!!room}
      onOpenChange={onOpenChange}
      eyebrow={room ? `Floor ${room.floor} · ${room.roomType?.name ?? ""}` : ""}
      title={
        <span className="flex items-baseline gap-2">
          Room <span className="font-mono text-[26px] tracking-tight">{room?.number}</span>
        </span>
      }
      description={room ? `Last changed ${relativeTime(room.updatedAt)}` : undefined}
      footer={
        <>
          {onEdit && room && (
            <Button variant="ghost" onClick={() => onEdit(room)} className="mr-auto">
              <PencilSimple size={15} />
              Edit room
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)} className={cn(!onEdit && "ml-auto")}>
            Cancel
          </Button>
          <Button onClick={save}>Save status</Button>
        </>
      }
    >
      {room && (
        <div className="flex flex-col gap-6">
          <div className="relative flex items-center gap-5 rounded-md border border-line bg-rack px-5 py-4">
            <span aria-hidden className="rack-rail absolute inset-x-0 top-3 h-[3px]" />
            <svg viewBox="0 0 60 78" width="68" height="88" aria-hidden className="relative shrink-0 overflow-visible">
              <circle cx="30" cy="5.5" r="2.6" style={{ fill: "var(--rack-rail)" }} />
              <g key={status} className="tag-swing is-changed">
                <circle cx="30" cy="13" r="7.4" style={{ fill: "none", stroke: "var(--rack-rail)", strokeWidth: 1.4 }} />
                <g transform="translate(8 9)">
                  <path
                    d={FOB_PATH}
                    style={{ fill: m.wash, stroke: m.color, strokeWidth: 1.3, transition: "fill 200ms, stroke 200ms" }}
                  />
                  {patternFill(status) && <path d={FOB_PATH} style={{ fill: patternFill(status)! }} />}
                  <clipPath id="sheet-band">
                    <path d={FOB_PATH} />
                  </clipPath>
                  <rect x="0" y="41" width="44" height="24" clipPath="url(#sheet-band)" style={{ fill: m.color }} />
                  <circle cx="22" cy="12" r="3.6" style={{ fill: "var(--rack)", stroke: "var(--rack-rail)", strokeWidth: 1.1 }} />
                  <text x="22" y="31.5" textAnchor="middle" style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600, fill: "var(--ink)" }}>
                    {room.number.slice(-4)}
                  </text>
                  <text x="22" y="51.5" textAnchor="middle" style={{ fontFamily: "var(--font-mono)", fontSize: 7, fontWeight: 600, letterSpacing: "0.12em", fill: "var(--surface)" }}>
                    {m.short}
                  </text>
                </g>
              </g>
            </svg>
            <div className="relative min-w-0 pt-2">
              <p className="display-sm text-[20px] leading-tight text-ink">{m.label}</p>
              <p className="text-[13px] text-ink-muted">{m.description}</p>
            </div>
          </div>

          <fieldset>
            <legend className="eyebrow mb-2.5">Set status</legend>
            <div role="radiogroup" className="flex flex-col gap-1.5">
              {ROOM_STATUS_ORDER.map((s) => {
                const sm = ROOM_STATUS[s];
                const on = status === s;
                const blocked = !allowed(s);
                return (
                  <label
                    key={s}
                    aria-disabled={blocked || undefined}
                    title={blocked ? "Housekeeping can only mark a dirty room clean" : undefined}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors duration-150",
                      blocked && "pointer-events-none opacity-40",
                      on ? "bg-surface" : "border-line hover:border-line-strong hover:bg-surface-2/50",
                    )}
                    style={on ? { borderColor: sm.color, boxShadow: `inset 3px 0 0 ${sm.color}` } : undefined}
                  >
                    <input
                      type="radio"
                      name="room-status"
                      value={s}
                      checked={on}
                      disabled={blocked}
                      onChange={() => setStatus(s)}
                      className="sr-only"
                    />
                    <StatusSwatch status={s} size={22} />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[14px] font-medium text-ink">{sm.label}</span>
                      <span className="block text-[12.5px] text-ink-muted">{sm.description}</span>
                    </span>
                    {room.status === s && <span className="text-[11px] text-ink-faint">current</span>}
                    <span className="kbd" aria-hidden>
                      {sm.key}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="room-note" className="text-[13px] font-medium text-ink">
              Note for the next shift
            </label>
            <Textarea
              id="room-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. AC remote missing, guest checking out late"
              rows={3}
            />
          </div>
        </div>
      )}
    </Sheet>
  );
}
