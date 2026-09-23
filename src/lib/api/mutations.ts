"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { hotelApi } from "./endpoints";
import { qk } from "./hooks";
import type { Room, RoomStatus } from "./types";
import { ROOM_STATUS } from "@/lib/catalog";
import { toast } from "@/lib/store";

/**
 * Optimistic room status change: every cached room list flips immediately,
 * rolls back on failure, then re-syncs with the server.
 */
export function useRoomStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; status: RoomStatus; note?: string; number?: string }) =>
      hotelApi.setRoomStatus(v.id, v.status, v.note),
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
    onSuccess: (_r, v) => {
      toast.success(`Room ${v.number ?? ""} is now ${ROOM_STATUS[v.status].label.toLowerCase()}`.replace("  ", " "));
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: qk.roomsAll });
      void qc.invalidateQueries({ queryKey: qk.dashboard });
    },
    meta: { errorTitle: "Status not changed" },
  });
}
