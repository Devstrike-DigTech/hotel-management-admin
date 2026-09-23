"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { ArrowRight, CalendarBlank, DoorOpen, Warning } from "@phosphor-icons/react";
import { mtApi } from "@/lib/api/endpoints-m4";
import { useRooms, useStaff } from "@/lib/api/hooks";
import { isApiError } from "@/lib/api/client";
import type { BlockConflict, MaintenanceCategory, TaskPriority } from "@/lib/api/types-m4";
import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/store";
import { addDays, dayKeyOf, formatDay, lagosIso, stayWindow, todayKey } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { ChipRadio } from "@/components/m2/bits";
import { MT_CATEGORY, MT_CATEGORY_ORDER, MT_PRIORITY, MT_PRIORITY_ORDER } from "./bits";

const AREAS = ["Generator house", "Pool", "Lobby", "Kitchen", "Car park", "Roof", "Laundry"];

export function useMtRefresh() {
  const qc = useQueryClient();
  return () =>
    Promise.all(
      [["maintenance"], ["room-blocks"], ["rooms"], ["tape-chart"], ["availability"], ["dashboard"], ["housekeeping"], ["rates"]].map((queryKey) =>
        qc.invalidateQueries({ queryKey }),
      ),
    );
}

/** New ticket, optionally taking the room out of order for a window. */
export function TicketDialog({ open, onOpenChange, roomId: presetRoom }: { open: boolean; onOpenChange: (o: boolean) => void; roomId?: string }) {
  const router = useRouter();
  const refresh = useMtRefresh();
  const { can } = useCan();
  const rooms = useRooms();
  const staff = useStaff();
  const today = todayKey();
  const [where, setWhere] = useState<"room" | "area">("room");
  const [roomId, setRoomId] = useState(presetRoom ?? "");
  const [area, setArea] = useState("");
  const [category, setCategory] = useState<MaintenanceCategory>("AC_HVAC");
  const [priority, setPriority] = useState<TaskPriority>("NORMAL");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [vendor, setVendor] = useState("");
  const [blocks, setBlocks] = useState(false);
  const [until, setUntil] = useState(addDays(today, 2));
  const [conflicts, setConflicts] = useState<BlockConflict[] | null>(null);
  const now = useNow(60_000);

  const manage = can("maintenance.manage");
  const create = useMutation({
    mutationFn: (force: boolean) =>
      mtApi.create({
        ...(where === "room" ? { roomId } : { area: area.trim() }),
        category,
        priority,
        title: title.trim(),
        description: description.trim() || undefined,
        assigneeId: manage && assigneeId ? assigneeId : undefined,
        vendorName: manage && vendor.trim() ? vendor.trim() : undefined,
        blocksRoom: where === "room" && blocks ? true : undefined,
        outOfOrderFrom: where === "room" && blocks ? new Date().toISOString() : undefined,
        outOfOrderTo: where === "room" && blocks ? lagosIso(until, "12:00") : undefined,
        force: force || undefined,
      }),
    onSuccess: async (t) => {
      await refresh();
      toast.success(`${t.number} opened`, t.block ? `Room ${t.room?.number} is out of order until ${formatDay(dayKeyOf(t.block.to), { day: "numeric", month: "short" })}.` : undefined, {
        label: "Open",
        onClick: () => router.push(`/maintenance/${t.id}`),
      });
      onOpenChange(false);
      setConflicts(null);
      setTitle("");
      setDescription("");
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "BLOCK_CONFLICT") setConflicts((e.details?.conflicts as BlockConflict[]) ?? []);
    },
    meta: { errorTitle: "Ticket not opened", silentCodes: ["BLOCK_CONFLICT"] },
  });

  const room = rooms.data?.find((r) => r.id === roomId);
  const valid = title.trim().length >= 3 && (where === "room" ? !!roomId : area.trim().length >= 2);
  const techs = (staff.data ?? []).filter((s) => s.isActive !== false && ["MAINTENANCE", "MANAGER", "OWNER"].includes(s.role));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setConflicts(null);
      }}
      eyebrow="Maintenance"
      title={conflicts ? `Room ${room?.number ?? ""} has bookings in that window` : "Report a fault"}
      description={
        conflicts
          ? "Taking the room out of order would leave these guests without it. Move them first, or block anyway: their bookings lose the room and go back to the unassigned list."
          : "It lands with maintenance at once, with an SLA by priority."
      }
      className="max-w-xl"
      footer={
        conflicts ? (
          <>
            <Button variant="secondary" onClick={() => setConflicts(null)}>
              Change the dates
            </Button>
            <Button variant="danger" loading={create.isPending} disabled={conflicts.some((c) => c.status === "CHECKED_IN")} onClick={() => create.mutate(true)}>
              Block anyway
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button disabled={!valid} loading={create.isPending} onClick={() => create.mutate(false)}>
              {blocks && where === "room" ? "Open ticket and block room" : "Open ticket"}
            </Button>
          </>
        )
      }
    >
      {conflicts ? (
        <ConflictList conflicts={conflicts} />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-3">
            <ChipRadio
              label="Where"
              value={where}
              onChange={setWhere}
              options={[
                { value: "room", label: "A room" },
                { value: "area", label: "Somewhere else" },
              ]}
            />
          </div>
          {where === "room" ? (
            <Field label="Room" htmlFor="mt-room">
              <Select id="mt-room" value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                <option value="">Choose a room</option>
                {rooms.data?.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.number} &middot; {r.roomType.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="Where" htmlFor="mt-area">
              <Input id="mt-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="Generator house" list="mt-areas" />
              <datalist id="mt-areas">
                {AREAS.map((a) => (
                  <option key={a} value={a} />
                ))}
              </datalist>
            </Field>
          )}
          <Field label="What's wrong" htmlFor="mt-title">
            <Input id="mt-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="AC leaking water onto the carpet" />
          </Field>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
            {MT_CATEGORY_ORDER.map((c) => {
              const I = MT_CATEGORY[c].icon;
              return (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={category === c}
                  onClick={() => setCategory(c)}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-sm border px-2.5 text-[12.5px] transition-colors",
                    category === c ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:text-ink",
                  )}
                >
                  <I size={14} weight="duotone" /> {MT_CATEGORY[c].label}
                </button>
              );
            })}
          </div>
          <div>
            <span className="mb-2 block text-[13px] font-medium text-ink">Priority</span>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4" role="radiogroup" aria-label="Priority">
              {MT_PRIORITY_ORDER.map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={priority === p}
                  onClick={() => setPriority(p)}
                  className={cn(
                    "flex flex-col items-start rounded-md border px-3 py-2 text-left transition-colors",
                    priority === p ? "border-laterite bg-laterite-wash/50" : "border-line hover:border-line-strong",
                  )}
                  style={{ boxShadow: `inset 3px 0 0 ${MT_PRIORITY[p].tone}` }}
                >
                  <span className="text-[13px] font-medium text-ink">{MT_PRIORITY[p].label}</span>
                  <span className="font-mono text-[11px] text-ink-muted">fix within {MT_PRIORITY[p].sla}</span>
                </button>
              ))}
            </div>
          </div>
          <Field label="Details" htmlFor="mt-desc" optional>
            <Textarea id="mt-desc" className="min-h-16" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="When it started, what the guest said, what you tried" />
          </Field>
          {manage && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Technician" htmlFor="mt-who" optional>
                <Select id="mt-who" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
                  <option value="">Not yet</option>
                  {techs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Or a vendor" htmlFor="mt-vendor" optional>
                <Input id="mt-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="CoolAir Services Lekki" />
              </Field>
            </div>
          )}
          {manage && where === "room" && (
            <div className="rounded-md border border-line bg-surface-2/40 p-4">
              <Switch checked={blocks} onChange={setBlocks} label="Take the room out of order" description="It stops selling for these nights everywhere: the desk, the booking site and the marketplace." />
              {blocks && (
                <div className="mt-4 flex flex-wrap items-end gap-3">
                  <Field label="Out of order until" htmlFor="mt-until" hint={`From now to ${formatDay(until)} at noon, ${Math.max(1, Math.round((+new Date(lagosIso(until, "12:00")) - now) / 864e5))} nights.`}>
                    <div className="relative">
                      <CalendarBlank size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                      <Input id="mt-until" type="date" min={addDays(today, 1)} value={until} onChange={(e) => e.target.value && setUntil(e.target.value)} className="w-[180px] pl-8 font-mono" />
                    </div>
                  </Field>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Dialog>
  );
}

export function ConflictList({ conflicts }: { conflicts: BlockConflict[] }) {
  return (
    <ul className="flex flex-col gap-2.5">
      {conflicts.map((c) => (
        <li key={c.reservationId} className="rounded-md border border-line bg-surface px-4 py-3">
          <div className="flex items-baseline gap-3">
            <span className="font-mono text-[12.5px] text-ink">{c.code}</span>
            <span className="text-[14px] text-ink">{c.guestName}</span>
            <span className="ml-auto text-[12px] text-ink-muted">{stayWindow(c.arrivalAt, c.departureAt)}</span>
          </div>
          {c.status === "CHECKED_IN" ? (
            <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-danger">
              <Warning size={13} weight="fill" /> In the house now. Move the guest to another room before blocking this one.
            </p>
          ) : c.suggestions.length ? (
            <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-muted">
              <DoorOpen size={14} weight="duotone" /> Free for the same nights:
              {c.suggestions.map((s) => (
                <span key={s.roomId} className="rounded-xs border border-[color-mix(in_oklab,var(--palm)_40%,transparent)] bg-palm-wash px-1.5 font-mono text-[12px] text-palm">
                  {s.number}
                </span>
              ))}
              <a href={`/reservations/${c.reservationId}`} className="ml-auto inline-flex items-center gap-1 text-laterite hover:underline">
                Open booking <ArrowRight size={11} />
              </a>
            </p>
          ) : (
            <p className="mt-1.5 text-[12.5px] text-ochre">No free room of the same type for these nights.</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Block an existing ticket's room (or extend its block). */
export function BlockDialog({ open, onOpenChange, ticketId, roomId, roomNumber, reason }: { open: boolean; onOpenChange: (o: boolean) => void; ticketId: string; roomId: string; roomNumber: string; reason: string }) {
  const refresh = useMtRefresh();
  const today = todayKey();
  const [until, setUntil] = useState(addDays(today, 2));
  const [why, setWhy] = useState(reason);
  const [conflicts, setConflicts] = useState<BlockConflict[] | null>(null);
  const m = useMutation({
    mutationFn: (force: boolean) => mtApi.createBlock({ roomId, from: new Date().toISOString(), to: lagosIso(until, "12:00"), reason: why.trim() || reason, ticketId, force: force || undefined }),
    onSuccess: async (b) => {
      await refresh();
      toast.success(`Room ${roomNumber} is out of order`, b.displaced?.length ? `${b.displaced.length} booking${b.displaced.length === 1 ? "" : "s"} lost the room; reassign from the Ledger.` : `Until ${formatDay(until)}.`);
      setConflicts(null);
      onOpenChange(false);
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "BLOCK_CONFLICT") setConflicts((e.details?.conflicts as BlockConflict[]) ?? []);
    },
    meta: { errorTitle: "Room not blocked", silentCodes: ["BLOCK_CONFLICT"] },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setConflicts(null);
      }}
      eyebrow={`Room ${roomNumber}`}
      title={conflicts ? "Guests are booked into this room" : "Take the room out of order"}
      description={conflicts ? "Move them first, or block anyway and reassign them from the Ledger." : "Availability, quotes, the booking site and the Ledger all stop selling it for these nights."}
      className="max-w-xl"
      footer={
        conflicts ? (
          <>
            <Button variant="secondary" onClick={() => setConflicts(null)}>
              Change the dates
            </Button>
            <Button variant="danger" loading={m.isPending} disabled={conflicts.some((c) => c.status === "CHECKED_IN")} onClick={() => m.mutate(true)}>
              Block anyway
            </Button>
          </>
        ) : (
          <>
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button loading={m.isPending} onClick={() => m.mutate(false)}>
              Block room {roomNumber}
            </Button>
          </>
        )
      }
    >
      {conflicts ? (
        <ConflictList conflicts={conflicts} />
      ) : (
        <div className="flex flex-col gap-4">
          <Field label="Until" htmlFor="blk-until" hint={`It comes back at noon on ${formatDay(until)}, needing a clean.`}>
            <Input id="blk-until" type="date" min={addDays(today, 1)} value={until} onChange={(e) => e.target.value && setUntil(e.target.value)} className="w-[200px] font-mono" />
          </Field>
          <Field label="Reason" htmlFor="blk-why">
            <Input id="blk-why" value={why} onChange={(e) => setWhy(e.target.value)} />
          </Field>
        </div>
      )}
    </Dialog>
  );
}
