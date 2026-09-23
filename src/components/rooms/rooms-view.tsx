"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FunnelSimple, Key, Plus, Rows, Table as TableIcon, X } from "@phosphor-icons/react";
import { useRoomTypes, useRooms, qk } from "@/lib/api/hooks";
import { hotelApi } from "@/lib/api/endpoints";
import type { Room, RoomStatus } from "@/lib/api/types";
import { ROOM_STATUS } from "@/lib/catalog";
import { relativeTime } from "@/lib/format";
import { toast } from "@/lib/store";
import { RowMenu, Th } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { EmptyState, ErrorState, PageHeader, Panel, Segmented, Skeleton } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlay";
import { KeyRack, KeyRackSkeleton, RackLegend } from "@/components/keyrack/key-rack";
import { RoomSheet } from "@/components/keyrack/room-sheet";
import { StatusSwatch } from "@/components/keyrack/status-swatch";
import { BulkAddDialog, RoomFormDialog } from "./room-dialogs";

type View = "rack" | "table";
const VIEW_KEY = "admin.rooms.view";

function readView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "table" ? "table" : "rack";
  } catch {
    return "rack";
  }
}

export function RoomsView() {
  const params = useSearchParams();
  const router = useRouter();
  const rooms = useRooms();
  const types = useRoomTypes();
  const qc = useQueryClient();

  const [view, setViewState] = useState<View>(() => (typeof window === "undefined" ? "rack" : readView()));
  const setView = (v: View) => {
    setViewState(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };
  const [floor, setFloor] = useState<string>("");
  const [typeId, setTypeId] = useState<string>("");
  const [statuses, setStatuses] = useState<Set<RoomStatus>>(new Set());
  const [selected, setSelected] = useState<Room | null>(null);
  const [editing, setEditing] = useState<Room | null>(null);
  const [deleting, setDeleting] = useState<Room | null>(null);

  const action = params.get("new");
  const closeAction = () => router.replace("/rooms", { scroll: false });

  const floors = useMemo(
    () => [...new Set((rooms.data ?? []).map((r) => r.floor))].sort((a, b) => a - b),
    [rooms.data],
  );

  const counts = useMemo(() => {
    const c: Partial<Record<RoomStatus, number>> = {};
    rooms.data
      ?.filter((r) => (floor === "" || r.floor === Number(floor)) && (!typeId || r.roomType.id === typeId))
      .forEach((r) => (c[r.status] = (c[r.status] ?? 0) + 1));
    return c;
  }, [rooms.data, floor, typeId]);

  const filtered = useMemo(
    () =>
      (rooms.data ?? []).filter(
        (r) =>
          (floor === "" || r.floor === Number(floor)) &&
          (!typeId || r.roomType.id === typeId) &&
          (view === "rack" || statuses.size === 0 || statuses.has(r.status)),
      ),
    [rooms.data, floor, typeId, statuses, view],
  );

  const toggleStatus = (s: RoomStatus) =>
    setStatuses((prev) => {
      const n = new Set(prev);
      if (n.has(s)) n.delete(s);
      else n.add(s);
      return n;
    });

  const del = useMutation({
    mutationFn: (r: Room) => hotelApi.deleteRoom(r.id),
    onSuccess: (_d, r) => {
      toast.success(`Room ${r.number} removed`);
      void qc.invalidateQueries({ queryKey: qk.roomsAll });
      void qc.invalidateQueries({ queryKey: qk.me });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
    },
    meta: { errorTitle: "Room not removed" },
  });

  const filtersOn = floor !== "" || typeId !== "" || statuses.size > 0;
  const selectedLive = selected ? (rooms.data?.find((r) => r.id === selected.id) ?? selected) : null;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Key size={14} weight="duotone" /> Rooms
          </>
        }
        title={
          <>
            Every key, <em>every floor</em>.
          </>
        }
        description="The live state of your house. Change a status from the rack, or switch to the table to edit in detail."
        actions={
          <>
            <Button variant="secondary" onClick={() => router.push("/rooms?new=bulk", { scroll: false })}>
              <Rows size={15} weight="bold" />
              Bulk add
            </Button>
            <Button onClick={() => router.push("/rooms?new=room", { scroll: false })}>
              <Plus size={15} weight="bold" />
              Add room
            </Button>
          </>
        }
      />

      {/* toolbar */}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: "rack", label: "Key rack", icon: <Key size={14} weight="duotone" /> },
            { value: "table", label: "Table", icon: <TableIcon size={14} weight="duotone" /> },
          ]}
        />
        <div className="flex flex-1 flex-wrap items-center gap-2 md:justify-end">
          <span className="hidden items-center gap-1.5 text-[12.5px] text-ink-muted sm:inline-flex">
            <FunnelSimple size={14} /> Filter
          </span>
          <div className="w-[128px]">
            <Select aria-label="Floor" value={floor} onChange={(e) => setFloor(e.target.value)} className="h-9 text-[13px]">
              <option value="">All floors</option>
              {floors.map((f) => (
                <option key={f} value={f}>
                  Floor {f}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-[170px]">
            <Select aria-label="Room type" value={typeId} onChange={(e) => setTypeId(e.target.value)} className="h-9 text-[13px]">
              <option value="">All room types</option>
              {types.data?.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </div>
          {filtersOn && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFloor("");
                setTypeId("");
                setStatuses(new Set());
              }}
            >
              <X size={13} /> Clear
            </Button>
          )}
        </div>
      </div>

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <RackLegend counts={counts} active={statuses} onToggle={toggleStatus} />
          <span className="font-mono text-[12px] text-ink-muted">
            {rooms.isLoading ? "" : `${view === "rack" ? filtered.length : filtered.length} of ${rooms.data?.length ?? 0} rooms`}
          </span>
        </div>

        {rooms.isError ? (
          <ErrorState error={rooms.error} onRetry={() => rooms.refetch()} />
        ) : view === "rack" ? (
          <div className="relative bg-rack px-4 pb-5 pt-3 sm:px-6">
            {rooms.isLoading ? (
              <KeyRackSkeleton floors={3} perFloor={10} />
            ) : filtered.length === 0 ? (
              <RoomsEmpty filtersOn={filtersOn} onAdd={() => router.push("/rooms?new=bulk", { scroll: false })} />
            ) : (
              <KeyRack rooms={filtered} onSelect={setSelected} selectedId={selected?.id} highlight={statuses} />
            )}
          </div>
        ) : rooms.isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-9 w-full" style={{ animationDelay: `${i * 70}ms` }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <RoomsEmpty filtersOn={filtersOn} onAdd={() => router.push("/rooms?new=bulk", { scroll: false })} />
        ) : (
          <RoomsTable rooms={filtered} onStatus={setSelected} onEdit={setEditing} onDelete={setDeleting} />
        )}
      </Panel>

      <RoomSheet
        room={selectedLive}
        onOpenChange={(o) => !o && setSelected(null)}
        onEdit={(r) => {
          setSelected(null);
          setEditing(r);
        }}
      />
      <RoomFormDialog open={action === "room"} onOpenChange={(o) => !o && closeAction()} />
      <RoomFormDialog open={!!editing} room={editing} onOpenChange={(o) => !o && setEditing(null)} />
      <BulkAddDialog open={action === "bulk"} onOpenChange={(o) => !o && closeAction()} />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Remove room ${deleting?.number ?? ""}?`}
        body="The key comes off the rack. Past records that mention this room are kept in the audit log."
        confirmLabel="Remove room"
        danger
        onConfirm={() => (deleting ? del.mutateAsync(deleting) : undefined)}
      />
    </>
  );
}

function RoomsEmpty({ filtersOn, onAdd }: { filtersOn: boolean; onAdd: () => void }) {
  return filtersOn ? (
    <EmptyState glyph="dots" title="No rooms match" body="Try another floor, type or status." />
  ) : (
    <EmptyState
      glyph="ladder"
      title="No keys on the rack yet"
      body="Add a whole floor in one go, like 101 to 120, then fine-tune each room."
      action={
        <Button onClick={onAdd}>
          <Rows size={15} weight="bold" /> Bulk add rooms
        </Button>
      }
    />
  );
}

function RoomsTable({
  rooms,
  onStatus,
  onEdit,
  onDelete,
}: {
  rooms: Room[];
  onStatus: (r: Room) => void;
  onEdit: (r: Room) => void;
  onDelete: (r: Room) => void;
}) {
  const sorted = [...rooms].sort(
    (a, b) => a.floor - b.floor || a.number.localeCompare(b.number, undefined, { numeric: true }),
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] border-collapse text-left text-[13.5px]">
        <thead>
          <tr className="border-b border-line text-ink-muted">
            <Th className="w-24 pl-5">Room</Th>
            <Th className="w-20">Floor</Th>
            <Th>Type</Th>
            <Th>Status</Th>
            <Th>Notes</Th>
            <Th className="w-32">Updated</Th>
            <Th className="w-14 pr-5">
              <span className="sr-only">Actions</span>
            </Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const m = ROOM_STATUS[r.status];
            return (
              <tr key={r.id} className="group border-b border-line last:border-b-0 hover:bg-surface-2/50">
                <td className="py-2.5 pl-5 font-mono text-[14.5px] text-ink">{r.number}</td>
                <td className="py-2.5 font-mono text-ink-muted">{String(r.floor).padStart(2, "0")}</td>
                <td className="py-2.5 text-ink">{r.roomType?.name}</td>
                <td className="py-2.5">
                  <button
                    onClick={() => onStatus(r)}
                    className="inline-flex h-7 items-center gap-1.5 rounded-full border pl-1.5 pr-2.5 text-[12px] font-medium transition-colors hover:brightness-95"
                    style={{ background: m.wash, color: m.color, borderColor: `color-mix(in oklab, ${m.color} 30%, transparent)` }}
                    aria-label={`Room ${r.number}: ${m.label}. Change status`}
                  >
                    <StatusSwatch status={r.status} size={14} />
                    {m.label}
                  </button>
                </td>
                <td className="max-w-[260px] truncate py-2.5 text-ink-muted" title={r.notes ?? undefined}>
                  {r.notes || <span className="text-ink-faint">&ndash;</span>}
                </td>
                <td className="py-2.5 font-mono text-[12px] text-ink-muted">{relativeTime(r.updatedAt)}</td>
                <td className="py-2.5 pr-5 text-right">
                  <RowMenu onEdit={() => onEdit(r)} onDelete={() => onDelete(r)} label={`Room ${r.number}`} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

