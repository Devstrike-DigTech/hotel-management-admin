"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { qk } from "./hooks";
import type { Room, RoomStatus } from "./types";
import { ROOM_STATUS } from "@/lib/catalog";
import { toast } from "@/lib/store";
import { useEntitlements } from "@/lib/auth";
import { deskAction } from "@/lib/offline/desk-action";

/**
 * Optimistic room status change: every cached room list flips immediately,
 * rolls back on failure, then re-syncs with the server. Offline (with the
 * offline_mode feature) the change is queued in the outbox and stays applied.
 */
export function useRoomStatus() {
  const qc = useQueryClient();
  const { has } = useEntitlements();
  return useMutation({
    mutationFn: (v: { id: string; status: RoomStatus; note?: string; number?: string }) =>
      deskAction<Room>({
        kind: "room-status",
        title: `Room ${v.number ?? ""} to ${ROOM_STATUS[v.status].label.toLowerCase()}`.replace("  ", " "),
        method: "PATCH",
        path: `/rooms/${v.id}/status`,
        body: { status: v.status, note: v.note || undefined },
        offlineAllowed: has("offline_mode"),
        invalidate: [["rooms"], ["dashboard"]],
      }),
    onMutate: async (v) => {
      await qc.cancelQueries({ queryKey: qk.roomsAll });
      const snapshots = qc.getQueriesData<Room[]>({ queryKey: qk.roomsAll });
      qc.setQueriesData<Room[]>({ queryKey: qk.roomsAll }, (old) =>
        old?.map((r) =>
          r.id === v.id
            ? { ...r, status: v.status, notes: v.note !== undefined ? v.note : r.notes, updatedAt: new Date().toISOString() }
            : r,
        ),
      );
      return { snapshots };
    },
    onError: (_e, _v, ctx) => {
      ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data));
    },
    onSuccess: (r, v) => {
      const label = `Room ${v.number ?? ""} is now ${ROOM_STATUS[v.status].label.toLowerCase()}`.replace("  ", " ");
      if (r.queued) toast.info(label, "Saved on this device; it syncs when the line returns.");
      else toast.success(label);
    },
    onSettled: (r) => {
      if (r?.queued) return;
      void qc.invalidateQueries({ queryKey: qk.roomsAll });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
      void qc.invalidateQueries({ queryKey: ["front-desk"] });
    },
    meta: { errorTitle: "Status not changed" },
  });
}
