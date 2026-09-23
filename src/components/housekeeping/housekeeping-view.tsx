"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Broom, Checks, ClipboardText, Lightning, MagnifyingGlass, Package, Scales, SealCheck, Stack, UsersThree } from "@phosphor-icons/react";
import { useHkBoard } from "@/lib/api/hooks-m4";
import { hkApi } from "@/lib/api/endpoints-m4";
import type { AssignSuggestion, HousekeepingTask } from "@/lib/api/types-m4";
import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/store";
import { formatDuration } from "@/lib/dates";
import { lagosLongDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { ErrorState, PageHeader, Panel, Segmented, Skeleton } from "@/components/ui/primitives";
import { HousekeepingBoard, WorkloadBar, type BoardGroup } from "./board";
import { HK_TYPE, type HkPerson, type HkTaskView } from "./model";
import { TaskSheet, useHkRefresh } from "./task-sheet";
import { InspectionQueue } from "./inspection";
import { LostFound } from "./lost-found";
import { ChecklistSettings } from "./checklists";

export function toView(t: HousekeepingTask): HkTaskView {
  return {
    id: t.id,
    roomId: t.room.id,
    roomNumber: t.room.number,
    floor: t.room.floor,
    roomTypeId: t.room.roomType?.id,
    roomTypeName: t.room.roomType?.name,
    type: t.type,
    priority: t.priority,
    status: t.status,
    assigneeId: t.assignee?.id ?? null,
    assigneeName: t.assignee?.fullName ?? null,
    startedAt: t.startedAt,
    doneAt: t.doneAt,
    checklistDone: t.checklistDone,
    checklistTotal: t.checklistTotal,
    arrival: t.arrivalToday ? { at: t.arrivalToday.arrivalAt, guestName: t.arrivalToday.guestName, code: t.arrivalToday.code } : null,
    dnd: t.skippedReason === "DND",
    notes: t.inspectionNote ?? t.notes,
    minutes: t.estimatedMinutes,
  };
}

type Tab = "board" | "inspection" | "lost" | "setup";

export function HousekeepingView() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) || "board";
  const setTab = (t: Tab) => router.replace(t === "board" ? "/housekeeping" : `/housekeeping?tab=${t}`, { scroll: false });
  const { can } = useCan();
  const board = useHkBoard();
  const refresh = useHkRefresh();
  const [group, setGroup] = useState<BoardGroup>("status");
  const [openId, setOpenId] = useState<string | null>(null);
  const [balance, setBalance] = useState<AssignSuggestion | null>(null);
  const [q, setQ] = useState("");
  const canAssign = can("housekeeping.assign");

  const people: HkPerson[] = useMemo(() => (board.data?.housekeepers ?? []).map((h) => ({ id: h.user.id, fullName: h.user.fullName, roleName: h.role })), [board.data]);
  const tasks = useMemo(() => {
    const all = (board.data?.tasks ?? []).filter((t) => t.status !== "SKIPPED" || tab === "board");
    const term = q.trim();
    return all.filter((t) => !term || t.room.number.includes(term)).map(toView);
  }, [board.data, q, tab]);
  const open = openId ? (board.data?.tasks.find((t) => t.id === openId) ?? null) : null;

  const assign = useMutation({
    mutationFn: (v: { taskIds: string[]; assigneeId: string | null }) => hkApi.assign({ taskIds: v.taskIds, assigneeId: v.assigneeId }),
    onSuccess: async (r, v) => {
      await refresh();
      const who = people.find((p) => p.id === v.assigneeId)?.fullName;
      const rooms = r.tasks.map((t) => t.room.number).join(", ");
      toast.success(who ? `Room ${rooms} to ${who}` : `Room ${rooms} unassigned`);
    },
    meta: { errorTitle: "Not assigned" },
  });

  const suggest = useMutation({
    mutationFn: () => hkApi.suggest(),
    onSuccess: (s) => setBalance(s),
    meta: { errorTitle: "No suggestion" },
  });
  const apply = useMutation({
    mutationFn: (s: AssignSuggestion) =>
      hkApi.apply(s.proposal.filter((p) => p.assigneeId !== p.currentAssigneeId).map((p) => ({ taskId: p.taskId, assigneeId: p.assigneeId }))),
    onSuccess: async (r) => {
      await refresh();
      toast.success(`${r.updated} ${r.updated === 1 ? "room" : "rooms"} reassigned`, "Everyone's list updates on their phone.");
      setBalance(null);
    },
    meta: { errorTitle: "Not applied" },
  });

  const c = board.data?.counts ?? {};
  const urgent = (board.data?.tasks ?? []).filter((t) => t.priority === "URGENT" && !["DONE", "INSPECTED", "SKIPPED"].includes(t.status)).length;
  const toDo = (c.OPEN ?? 0) + (c.ASSIGNED ?? 0) + (c.REJECTED ?? 0);
  const suggestion = balance ? new Map(balance.proposal.filter((p) => p.assigneeId !== p.currentAssigneeId).map((p) => [p.taskId, p.assigneeId])) : null;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Broom size={14} weight="duotone" /> Housekeeping &middot; {lagosLongDate()}
          </>
        }
        title={
          <>
            Turn rooms around <em>before the next arrival</em>.
          </>
        }
        description="Drag a room onto a name to hand it out. Urgent rooms have a guest arriving today. Cleaned rooms wait for a supervisor before they go back on sale."
        actions={
          canAssign && (
            <Button variant="secondary" loading={suggest.isPending} onClick={() => suggest.mutate()}>
              <Scales size={15} weight="duotone" /> Balance the load
            </Button>
          )
        }
      />

      {/* the day in four numbers */}
      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
        <Count label="To clean" value={board.data ? toDo : null} sub={`${c.REJECTED ?? 0} sent back`} />
        <Count label="Cleaning now" value={board.data ? (c.IN_PROGRESS ?? 0) : null} sub={`${people.length} on shift`} />
        <Count
          label="To inspect"
          value={board.data ? (board.data.inspectionQueue ?? 0) : null}
          sub={board.data?.requireInspection ? "inspection is on" : "inspection is off"}
          onClick={can("housekeeping.inspect") ? () => setTab("inspection") : undefined}
        />
        <Count label="Arrivals waiting" value={board.data ? urgent : null} sub="rooms not ready for a guest due today" tone={urgent ? "laterite" : undefined} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented<Tab>
          label="Housekeeping view"
          value={tab}
          onChange={setTab}
          options={[
            { value: "board", label: "Board", icon: <Stack size={14} weight="duotone" /> },
            ...(can("housekeeping.inspect") ? [{ value: "inspection" as Tab, label: `Inspection${board.data?.inspectionQueue ? ` ${board.data.inspectionQueue}` : ""}`, icon: <SealCheck size={14} weight="duotone" /> }] : []),
            { value: "lost", label: "Lost & found", icon: <Package size={14} weight="duotone" /> },
            ...(canAssign ? [{ value: "setup" as Tab, label: "Checklists", icon: <ClipboardText size={14} weight="duotone" /> }] : []),
          ]}
        />
        {tab === "board" && (
          <>
            <div className="relative ml-auto">
              <MagnifyingGlass size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value.replace(/\D/g, ""))}
                inputMode="numeric"
                placeholder="Room"
                aria-label="Find a room"
                className="h-8 w-24 rounded-sm border border-line-strong bg-surface pl-8 pr-2 font-mono text-[13px] text-ink outline-none focus:border-laterite"
              />
            </div>
            <Segmented<BoardGroup>
              label="Group the board"
              size="sm"
              value={group}
              onChange={setGroup}
              options={[
                { value: "status", label: "By status" },
                { value: "floor", label: "By floor" },
              ]}
            />
            {canAssign && <FloorAssign people={people} floors={[...new Set(tasks.map((t) => t.floor))].sort()} onAssign={(floor, id) => hkApi.assign({ floor, assigneeId: id }).then(refresh)} />}
          </>
        )}
      </div>

      {tab === "board" &&
        (board.isError ? (
          <Panel>
            <ErrorState error={board.error} onRetry={() => board.refetch()} />
          </Panel>
        ) : !board.data ? (
          <div className="grid gap-5 lg:grid-cols-[272px_1fr]">
            <Skeleton className="h-64" />
            <Skeleton className="h-96" />
          </div>
        ) : (
          <HousekeepingBoard
            tasks={tasks}
            people={people}
            group={group}
            canAssign={canAssign}
            suggestion={suggestion}
            onAssign={(ids, who) => assign.mutate({ taskIds: ids, assigneeId: who })}
            onOpen={(t) => setOpenId(t.id)}
          />
        ))}
      {tab === "inspection" && <InspectionQueue />}
      {tab === "lost" && <LostFound />}
      {tab === "setup" && <ChecklistSettings />}

      <TaskSheet task={open} people={people} onOpenChange={(o) => !o && setOpenId(null)} />

      <Dialog
        open={!!balance}
        onOpenChange={(o) => !o && setBalance(null)}
        eyebrow="Balance the load"
        title="A fairer day for everyone"
        description={
          balance
            ? `${formatDuration(balance.totalMinutes * 60_000)} of cleaning left, about ${formatDuration(balance.targetMinutesEach * 60_000)} each. Rooms already being cleaned stay where they are; rooms on one floor stay together where possible.`
            : undefined
        }
        className="max-w-xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBalance(null)}>
              Keep it as it is
            </Button>
            <Button loading={apply.isPending} disabled={!suggestion?.size} onClick={() => balance && apply.mutate(balance)}>
              <Lightning size={14} weight="duotone" /> Reassign {suggestion?.size ?? 0} {suggestion?.size === 1 ? "room" : "rooms"}
            </Button>
          </>
        }
      >
        {balance && (
          <ul className="flex flex-col gap-4">
            {balance.housekeepers.map((h) => {
              const mine = balance.proposal.filter((p) => p.assigneeId === h.user.id);
              const moved = mine.filter((p) => p.currentAssigneeId !== h.user.id);
              const byType: Partial<Record<keyof typeof HK_TYPE, number>> = {};
              for (const p of mine) byType[p.type] = (byType[p.type] ?? 0) + p.minutes;
              return (
                <li key={h.user.id}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="flex items-center gap-2 text-[14px] font-medium text-ink">
                      <UsersThree size={15} weight="duotone" className="text-ink-muted" /> {h.user.fullName}
                    </span>
                    <span className="font-mono text-[12.5px] text-ink">
                      {formatDuration(h.proposedMinutes * 60_000)} <span className="text-ink-faint">&middot; {h.taskCount} rooms</span>
                    </span>
                  </div>
                  <WorkloadBar byType={byType} total={h.proposedMinutes} />
                  <p className="mt-1.5 flex flex-wrap gap-1 text-[12px] text-ink-muted">
                    {mine.map((p) => (
                      <span
                        key={p.taskId}
                        className={cn("rounded-xs border px-1 font-mono text-[11px]", moved.includes(p) ? "border-laterite text-laterite" : "border-line text-ink-muted")}
                        title={moved.includes(p) ? "Moves to them" : "Already theirs"}
                      >
                        {p.roomNumber}
                      </span>
                    ))}
                    {!mine.length && "Nothing to add"}
                  </p>
                </li>
              );
            })}
            <li className="flex items-center gap-2 text-[11.5px] text-ink-faint">
              <span className="rounded-xs border border-laterite px-1 font-mono text-laterite">204</span> moves to them
              <span className="ml-2 rounded-xs border border-line px-1 font-mono">112</span> already theirs
              <Checks size={13} className="ml-auto" /> ghost chips on the board show the same
            </li>
          </ul>
        )}
      </Dialog>
    </>
  );
}

function Count({ label, value, sub, onClick, tone }: { label: string; value: number | null; sub: string; onClick?: () => void; tone?: "laterite" }) {
  const body = (
    <>
      <span className="display-sm text-[13.5px] italic text-ink-muted">{label}</span>
      {value === null ? <Skeleton className="mt-1 h-8 w-12" /> : <span className={cn("font-mono text-[32px] leading-none tracking-tight", tone === "laterite" ? "text-laterite" : "text-ink")}>{value}</span>}
      <span className="text-[11.5px] text-ink-faint">{sub}</span>
    </>
  );
  const cls = "flex flex-col gap-1.5 bg-surface px-5 py-4 text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, "transition-colors hover:bg-surface-2/60")}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/** Bulk: every unfinished room on a floor to one person. */
function FloorAssign({ people, floors, onAssign }: { people: HkPerson[]; floors: number[]; onAssign: (floor: number, id: string) => Promise<unknown> }) {
  const [floor, setFloor] = useState<number | "">("");
  const [who, setWho] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-1.5 rounded-md border border-line bg-surface p-0.5 pl-2 text-[12.5px] text-ink-muted">
      Floor
      <select aria-label="Floor" value={floor} onChange={(e) => setFloor(e.target.value ? Number(e.target.value) : "")} className="h-7 rounded-sm bg-surface-2/60 px-1.5 font-mono text-[12.5px] text-ink outline-none">
        <option value="">-</option>
        {floors.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      to
      <select aria-label="Housekeeper" value={who} onChange={(e) => setWho(e.target.value)} className="h-7 max-w-[130px] rounded-sm bg-surface-2/60 px-1.5 text-[12.5px] text-ink outline-none">
        <option value="">someone</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.fullName}
          </option>
        ))}
      </select>
      <Button
        size="sm"
        variant="ghost"
        className="h-7"
        disabled={floor === "" || !who}
        loading={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await onAssign(floor as number, who);
            toast.success(`Floor ${floor} to ${people.find((p) => p.id === who)?.fullName}`);
          } catch (e) {
            toast.error("Not assigned", (e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        Assign
      </Button>
    </div>
  );
}
