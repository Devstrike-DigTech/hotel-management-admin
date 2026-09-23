"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { Broom, CheckCircle, Play } from "@phosphor-icons/react";
import { housekeepingApi } from "@/lib/api/endpoints-m2";
import { useDeskRefresh } from "@/lib/api/mutations-m2";
import type { HousekeepingTaskM2 } from "@/lib/api/types-m2";
import { toast } from "@/lib/store";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, ErrorState, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";

const REASON: Record<HousekeepingTaskM2["reason"], string> = {
  CHECKOUT: "After check-out",
  ROOM_MOVE: "After a room move",
  MANUAL: "Added by hand",
};

/** Turnaround tasks raised by check-outs and room moves; Done marks the room clean. */
export function HousekeepingTasks({ enabled }: { enabled: boolean }) {
  const refresh = useDeskRefresh();
  const q = useQuery({ queryKey: ["housekeeping", "tasks"], queryFn: () => housekeepingApi.tasks(), enabled, refetchInterval: 45_000 });
  const m = useMutation({
    mutationFn: (v: { t: HousekeepingTaskM2; status: HousekeepingTaskM2["status"] }) => housekeepingApi.update(v.t.id, v.status),
    onSuccess: async (_r, v) => {
      await refresh([["housekeeping"]]);
      toast.success(v.status === "DONE" ? `Room ${v.t.room.number} is clean` : `Started room ${v.t.room.number}`);
    },
    meta: { errorTitle: "Task not updated" },
  });
  const list = [...(q.data ?? [])].sort((a, b) => Number(b.status === "IN_PROGRESS") - Number(a.status === "IN_PROGRESS") || a.createdAt.localeCompare(b.createdAt));
  return (
    <Panel className="mt-6">
      <PanelHeader eyebrow="Turnarounds" title="Tasks" description="Raised automatically when a guest checks out or moves rooms." />
      {q.isLoading ? (
        <div className="p-5">
          <Skeleton className="h-10" />
        </div>
      ) : q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : list.length ? (
        <ul className="divide-y divide-line">
          {list.map((t) => (
            <li key={t.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
              <span className={cn("grid h-9 w-9 place-items-center rounded-full", t.status === "IN_PROGRESS" ? "bg-brass-wash text-brass" : "bg-ochre-wash text-ochre")}>
                <Broom size={17} weight="duotone" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-ink">
                  Room <span className="font-mono">{t.room.number}</span>
                  <span className="ml-2 text-[12.5px] text-ink-muted">{REASON[t.reason]}</span>
                  {t.reservationCode && <span className="ml-2 font-mono text-[11.5px] text-ink-faint">{t.reservationCode}</span>}
                </p>
                <p className="text-[12px] text-ink-faint">
                  raised {relativeTime(t.createdAt)}
                  {t.notes ? ` · ${t.notes}` : ""}
                </p>
              </div>
              {t.status === "IN_PROGRESS" && <Badge tone="brass" dot>In progress</Badge>}
              <div className="flex gap-1.5">
                {t.status === "PENDING" && (
                  <Button size="sm" variant="ghost" onClick={() => m.mutate({ t, status: "IN_PROGRESS" })}>
                    <Play size={13} weight="fill" /> Start
                  </Button>
                )}
                <Button size="sm" variant="secondary" onClick={() => m.mutate({ t, status: "DONE" })} loading={m.isPending && m.variables?.t.id === t.id && m.variables.status === "DONE"}>
                  <CheckCircle size={14} weight="duotone" /> Done
                </Button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact glyph="frond" title="Nothing to turn around" body="Tasks appear here when a guest checks out." />
      )}
    </Panel>
  );
}
