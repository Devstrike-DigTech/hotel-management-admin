"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { hotelApi } from "@/lib/api/endpoints";
import { qk, useMe, useRoomTypes } from "@/lib/api/hooks";
import type { Room, RoomType } from "@/lib/api/types";
import { toast } from "@/lib/store";
import { naira } from "@/lib/format";
import { Dialog } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { FOB_PATH } from "@/components/brand";
import { WarningCircle } from "@phosphor-icons/react";

function useInvalidateRooms() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: qk.roomsAll });
    void qc.invalidateQueries({ queryKey: qk.dashboard });
    void qc.invalidateQueries({ queryKey: qk.me });
    void qc.invalidateQueries({ queryKey: qk.roomTypes });
  };
}

function NoTypesHint() {
  return (
    <div className="rounded-md border border-dashed border-line-strong bg-paper/60 p-4 text-[13.5px] text-ink-muted">
      You need at least one room type before adding rooms.{" "}
      <Link href="/rooms/types?new=1" className="font-medium text-laterite underline-offset-4 hover:underline">
        Create a room type
      </Link>
      .
    </div>
  );
}

function TypeSelect({
  types,
  value,
  onChange,
  id,
}: {
  types: RoomType[];
  value: string;
  onChange: (v: string) => void;
  id: string;
}) {
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} required>
      <option value="" disabled>
        Choose a room type
      </option>
      {types.map((t) => (
        <option key={t.id} value={t.id}>
          {t.name} &middot; {naira(t.basePriceKobo)}/night
        </option>
      ))}
    </Select>
  );
}

/* ---------------- add / edit single room ---------------- */

export function RoomFormDialog({
  open,
  onOpenChange,
  room,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  room?: Room | null;
}) {
  const types = useRoomTypes();
  const invalidate = useInvalidateRooms();
  const editing = !!room;
  const [number, setNumber] = useState(room?.number ?? "");
  const [floor, setFloor] = useState(String(room?.floor ?? 1));
  const [typeId, setTypeId] = useState(room?.roomType.id ?? "");
  const [notes, setNotes] = useState(room?.notes ?? "");
  const [key, setKey] = useState<string | null>(null);

  // reset when the target changes
  const k = `${open}-${room?.id ?? "new"}`;
  if (k !== key) {
    setKey(k);
    setNumber(room?.number ?? "");
    setFloor(String(room?.floor ?? 1));
    setTypeId(room?.roomType.id ?? types.data?.[0]?.id ?? "");
    setNotes(room?.notes ?? "");
  }

  const m = useMutation({
    mutationFn: () => {
      const body = { number: number.trim(), floor: Number(floor), roomTypeId: typeId, notes: notes.trim() || null };
      return editing ? hotelApi.updateRoom(room!.id, body) : hotelApi.createRoom(body);
    },
    onSuccess: () => {
      toast.success(editing ? `Room ${number} updated` : `Room ${number} is on the rack`);
      invalidate();
      onOpenChange(false);
    },
    meta: { errorTitle: editing ? "Room not updated" : "Room not added" },
  });

  const valid = number.trim() && Number(floor) >= 0 && typeId;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={editing ? "Edit room" : "New room"}
      title={editing ? <>Room <span className="font-mono">{room?.number}</span></> : "Hang a new key"}
      description={editing ? undefined : "Add a single room. For a whole floor, use bulk add."}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={m.isPending} disabled={!valid} onClick={() => m.mutate()}>
            {editing ? "Save changes" : "Add room"}
          </Button>
        </>
      }
    >
      {types.data && types.data.length === 0 ? (
        <NoTypesHint />
      ) : (
        <form
          className="grid gap-4 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (valid) m.mutate();
          }}
        >
          <Field label="Room number" htmlFor="rf-number">
            <Input
              id="rf-number"
              className="font-mono"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="204"
              autoFocus
              maxLength={8}
            />
          </Field>
          <Field label="Floor" htmlFor="rf-floor">
            <Input id="rf-floor" className="font-mono" type="number" min={0} value={floor} onChange={(e) => setFloor(e.target.value)} />
          </Field>
          <Field label="Room type" htmlFor="rf-type" className="sm:col-span-2">
            <TypeSelect id="rf-type" types={types.data ?? []} value={typeId} onChange={setTypeId} />
          </Field>
          <Field label="Notes" htmlFor="rf-notes" optional className="sm:col-span-2">
            <Textarea id="rf-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Connecting door to 205" />
          </Field>
          <button type="submit" hidden />
        </form>
      )}
    </Dialog>
  );
}

/* ---------------- bulk add a range ---------------- */

export function BulkAddDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const types = useRoomTypes();
  const me = useMe();
  const invalidate = useInvalidateRooms();
  const [floor, setFloor] = useState("1");
  const [from, setFrom] = useState("101");
  const [to, setTo] = useState("110");
  const [prefix, setPrefix] = useState("");
  const [typeId, setTypeId] = useState("");
  const effectiveType = typeId || types.data?.[0]?.id || "";

  const count = Math.max(0, Number(to) - Number(from) + 1);
  const valid = effectiveType && Number.isInteger(Number(from)) && Number.isInteger(Number(to)) && count > 0 && count <= 200;
  const numbers = useMemo(() => {
    if (!valid) return [];
    return Array.from({ length: Math.min(count, 60) }, (_, i) => `${prefix}${Number(from) + i}`);
  }, [valid, count, from, prefix]);

  const max = me.data?.entitlements.limits.max_rooms;
  const used = me.data?.entitlements.usage.rooms ?? 0;
  const remaining = max === undefined || max < 0 ? Infinity : max - used;
  const over = count > remaining;

  const m = useMutation({
    mutationFn: () =>
      hotelApi.bulkRooms({
        roomTypeId: effectiveType,
        floor: Number(floor),
        from: Number(from),
        to: Number(to),
        prefix: prefix || undefined,
      }),
    onSuccess: () => {
      toast.success(`${count} rooms added to floor ${floor}`, `${prefix}${from} to ${prefix}${to} are on the rack.`);
      invalidate();
      onOpenChange(false);
    },
    meta: { errorTitle: "Rooms not added" },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Bulk add"
      title="Add a floor of rooms"
      description="Give a number range and we'll hang a key for each one."
      className="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={m.isPending} disabled={!valid} onClick={() => m.mutate()}>
            Add {count > 0 ? count : ""} {count === 1 ? "room" : "rooms"}
          </Button>
        </>
      }
    >
      {types.data && types.data.length === 0 ? (
        <NoTypesHint />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Floor" htmlFor="bk-floor">
              <Input id="bk-floor" type="number" min={0} className="font-mono" value={floor} onChange={(e) => setFloor(e.target.value)} />
            </Field>
            <Field label="From" htmlFor="bk-from">
              <Input id="bk-from" type="number" className="font-mono" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="To" htmlFor="bk-to">
              <Input id="bk-to" type="number" className="font-mono" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
            <Field label="Prefix" htmlFor="bk-prefix" optional>
              <Input id="bk-prefix" className="font-mono" maxLength={3} value={prefix} onChange={(e) => setPrefix(e.target.value.toUpperCase())} placeholder="A" />
            </Field>
          </div>
          <Field label="Room type" htmlFor="bk-type">
            <TypeSelect id="bk-type" types={types.data ?? []} value={effectiveType} onChange={setTypeId} />
          </Field>

          <div>
            <p className="eyebrow mb-2 flex items-center justify-between">
              <span>Preview</span>
              <span className="normal-case tracking-normal">
                <span className="font-mono text-ink">{count}</span> {count === 1 ? "key" : "keys"}
              </span>
            </p>
            <div className="relative rounded-md border border-line bg-rack px-3 pb-3 pt-4">
              <span aria-hidden className="rack-rail absolute inset-x-3 top-3 h-[2px]" />
              {numbers.length ? (
                <div className="relative flex flex-wrap gap-x-1 gap-y-2">
                  {numbers.map((n) => (
                    <MiniTag key={n} label={n} />
                  ))}
                  {count > numbers.length && (
                    <span className="self-center pl-1 font-mono text-[12px] text-ink-muted">+{count - numbers.length} more</span>
                  )}
                </div>
              ) : (
                <p className="py-3 text-center text-[13px] text-ink-muted">Enter a valid range, up to 200 rooms.</p>
              )}
            </div>
          </div>

          {over && Number.isFinite(remaining) && (
            <p className="flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--ochre)_35%,transparent)] bg-ochre-wash px-3 py-2.5 text-[13px] text-ink">
              <WarningCircle size={16} weight="duotone" className="mt-px shrink-0 text-ochre" />
              <span>
                Your plan has room for <span className="font-mono">{Math.max(0, remaining)}</span> more. Adding{" "}
                <span className="font-mono">{count}</span> will ask you to upgrade.
              </span>
            </p>
          )}
        </div>
      )}
    </Dialog>
  );
}

function MiniTag({ label }: { label: string }) {
  return (
    <svg viewBox="0 0 44 64" width="30" height="44" aria-label={`Room ${label}`} className="animate-[rise_200ms_ease-out]">
      <path d={FOB_PATH} style={{ fill: "var(--palm-wash)", stroke: "var(--palm)", strokeWidth: 2 }} />
      <circle cx="22" cy="12" r="4" style={{ fill: "var(--rack)", stroke: "var(--rack-rail)", strokeWidth: 1.4 }} />
      <text
        x="22"
        y="35"
        textAnchor="middle"
        style={{ fontFamily: "var(--font-mono)", fontSize: label.length > 3 ? 11 : 13, fontWeight: 600, fill: "var(--ink)" }}
      >
        {label.slice(-4)}
      </text>
    </svg>
  );
}
