"use client";

import { useMemo, useState } from "react";
import { AirplaneLanding, Checks, MoonStars, UserCircleDashed, Warning } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/dates";
import { formatTime, initials } from "@/lib/format";
import {
  HK_STATUS,
  HK_TYPE,
  SHIFT_MINUTES,
  byUrgency,
  isOpenWork,
  taskMinutes,
  workload,
  type HkPerson,
  type HkStatus,
  type HkTaskView,
  type HkType,
} from "./model";

const DND = "application/x-hk-task";

/** Series for the workload bar (validated categorical order; the legend names them). */
export const TYPE_SERIES: Partial<Record<HkType, string>> = {
  CHECKOUT_CLEAN: "var(--season-1)",
  STAYOVER: "var(--season-2)",
  DEEP_CLEAN: "var(--season-3)",
};
const typeColor = (t: HkType) => TYPE_SERIES[t] ?? "var(--ink-faint)";

export type BoardGroup = "status" | "floor";

const STATUS_COLUMNS: { key: string; title: string; hint: string; match: (t: HkTaskView) => boolean }[] = [
  { key: "open", title: "Unassigned", hint: "Drag to a name", match: (t) => t.status === "OPEN" || (!t.assigneeId && t.status === "REJECTED") },
  { key: "assigned", title: "Assigned", hint: "Waiting to start", match: (t) => t.status === "ASSIGNED" || (!!t.assigneeId && t.status === "REJECTED") },
  { key: "progress", title: "Cleaning", hint: "In the room now", match: (t) => t.status === "IN_PROGRESS" },
  { key: "done", title: "Done", hint: "Waiting for inspection first", match: (t) => t.status === "DONE" || t.status === "INSPECTED" },
];

export function HousekeepingBoard({
  tasks,
  people,
  group,
  onAssign,
  onOpen,
  canAssign,
  suggestion,
}: {
  tasks: HkTaskView[];
  people: HkPerson[];
  group: BoardGroup;
  onAssign: (taskIds: string[], assigneeId: string | null) => void;
  onOpen: (t: HkTaskView) => void;
  canAssign: boolean;
  /** taskId -> assigneeId, previewed as ghost chips */
  suggestion?: Map<string, string> | null;
}) {
  const [over, setOver] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const load = useMemo(() => workload(tasks, people), [tasks, people]);
  const nameOf = useMemo(() => new Map(people.map((p) => [p.id, p.fullName])), [people]);

  const columns = useMemo(() => {
    if (group === "status")
      return STATUS_COLUMNS.map((c) => {
        const items = tasks.filter(c.match).sort((a, b) => Number(a.status === "INSPECTED") - Number(b.status === "INSPECTED") || byUrgency(a, b));
        const waiting = items.filter((t) => t.status === "DONE").length;
        return { ...c, items, hint: c.key === "done" ? (waiting ? `${waiting} to inspect` : "All inspected") : c.hint };
      });
    const floors = [...new Set(tasks.map((t) => t.floor))].sort((a, b) => a - b);
    return floors.map((f) => ({
      key: `f${f}`,
      title: `Floor ${f}`,
      hint: `${tasks.filter((t) => t.floor === f && isOpenWork(t)).length} still to do`,
      match: () => true,
      items: tasks.filter((t) => t.floor === f).sort((a, b) => Number(!isOpenWork(a)) - Number(!isOpenWork(b)) || byUrgency(a, b)),
    }));
  }, [tasks, group]);

  const drop = (target: string | null) => (e: React.DragEvent) => {
    e.preventDefault();
    const id = e.dataTransfer.getData(DND);
    setOver(null);
    setDragging(null);
    if (id) onAssign([id], target);
  };
  const dragOver = (key: string) => (e: React.DragEvent) => {
    if (!canAssign || !e.dataTransfer.types.includes(DND)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (over !== key) setOver(key);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[248px_minmax(0,1fr)]">
      {/* the team: drop targets with their workload */}
      <aside aria-label="Housekeepers" className="flex flex-col gap-2 lg:sticky lg:top-20 lg:self-start">
        <div className="flex items-baseline justify-between px-1">
          <h2 className="eyebrow">The team today</h2>
          <span className="text-[11.5px] text-ink-faint">of a {SHIFT_MINUTES / 60}h shift</span>
        </div>
        <WorkloadLegend />
        <ul className="flex flex-col gap-2">
          {people.map((p) => {
            const w = load.get(p.id)!;
            const ghost = suggestion ? [...suggestion.entries()].filter(([, a]) => a === p.id).map(([id]) => tasks.find((t) => t.id === id)!).filter(Boolean) : [];
            const ghostMin = ghost.reduce((s, t) => s + taskMinutes(t), 0);
            const k = `p:${p.id}`;
            return (
              <li
                key={p.id}
                onDragOver={dragOver(k)}
                onDragLeave={() => setOver((o) => (o === k ? null : o))}
                onDrop={drop(p.id)}
                className={cn(
                  "rounded-md border bg-surface px-3 py-2.5 transition-[border-color,background-color,box-shadow] duration-150",
                  over === k ? "border-laterite bg-laterite-wash/50 shadow-[0_0_0_3px_color-mix(in_oklab,var(--laterite)_18%,transparent)]" : dragging ? "border-dashed border-line-strong" : "border-line",
                )}
                data-testid={`hk-person-${p.fullName}`}
              >
                <div className="flex items-center gap-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-2 font-mono text-[11px] text-ink">{initials(p.fullName)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-ink">{p.fullName}</p>
                    <p className="text-[11.5px] text-ink-muted">
                      <span className="font-mono">{w.count}</span> {w.count === 1 ? "room" : "rooms"} to do
                      {w.done ? (
                        <>
                          {" "}
                          &middot; <span className="font-mono">{w.done}</span> done
                        </>
                      ) : null}
                      {ghost.length ? <span className="text-laterite"> +{ghost.length} suggested</span> : null}
                    </p>
                  </div>
                  <span className="font-mono text-[12px] text-ink">{w.total ? formatDuration(w.total * 60_000) : "free"}</span>
                </div>
                <WorkloadBar byType={w.byType} total={w.total} extra={ghostMin} />
              </li>
            );
          })}
          {!people.length && <li className="rounded-md border border-dashed border-line px-3 py-4 text-[12.5px] text-ink-muted">No housekeepers yet. Add staff with a housekeeping role.</li>}
        </ul>
        {canAssign && (
          <div
            onDragOver={dragOver("none")}
            onDragLeave={() => setOver((o) => (o === "none" ? null : o))}
            onDrop={drop(null)}
            className={cn(
              "flex items-center gap-2 rounded-md border border-dashed px-3 py-2.5 text-[12.5px] transition-colors",
              over === "none" ? "border-laterite bg-laterite-wash/50 text-ink" : "border-line text-ink-faint",
              !dragging && "hidden lg:flex",
            )}
          >
            <UserCircleDashed size={16} /> Drop here to unassign
          </div>
        )}
      </aside>

      {/* the board */}
      <div className="scrollbar-thin -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
        <div className="grid auto-cols-[minmax(196px,1fr)] grid-flow-col gap-3">
          {columns.map((col) => (
            <section key={col.key} aria-label={col.title} className="flex min-w-0 flex-col rounded-lg border border-line bg-paper/60">
              <header className="flex items-baseline gap-2 border-b border-line px-3 py-2.5">
                <h3 className="display-sm text-[15px] text-ink">{col.title}</h3>
                <span className="font-mono text-[12px] text-ink-muted">{col.items.length}</span>
                <span className="ml-auto truncate text-[11px] text-ink-faint">{col.hint}</span>
              </header>
              <ul className="flex min-h-[120px] flex-col gap-1.5 p-2">
                {col.items.map((t) => (
                  <li key={t.id}>
                    <TaskCard
                      t={t}
                      assignee={t.assigneeId ? (nameOf.get(t.assigneeId) ?? t.assigneeName ?? null) : null}
                      suggested={suggestion?.get(t.id) ? nameOf.get(suggestion.get(t.id)!) : undefined}
                      draggable={canAssign && isOpenWork(t) && t.status !== "IN_PROGRESS"}
                      onDragStart={(e) => {
                        e.dataTransfer.setData(DND, t.id);
                        e.dataTransfer.effectAllowed = "move";
                        setDragging(t.id);
                      }}
                      onDragEnd={() => {
                        setDragging(null);
                        setOver(null);
                      }}
                      onOpen={() => onOpen(t)}
                      showStatus={group === "floor"}
                      dragging={dragging === t.id}
                    />
                  </li>
                ))}
                {!col.items.length && <li className="grid flex-1 place-items-center py-6 text-[12px] text-ink-faint">Nothing here</li>}
              </ul>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export function WorkloadLegend() {
  const items: [string, string][] = [
    ["Check-out", typeColor("CHECKOUT_CLEAN")],
    ["Stayover", typeColor("STAYOVER")],
    ["Deep", typeColor("DEEP_CLEAN")],
    ["Other", "var(--ink-faint)"],
  ];
  return (
    <p className="flex flex-wrap gap-x-3 gap-y-1 px-1 text-[11px] text-ink-muted" aria-label="Workload colours">
      {items.map(([l, c]) => (
        <span key={l} className="inline-flex items-center gap-1">
          <span className="h-2 w-2 rounded-[2px]" style={{ background: c }} aria-hidden />
          {l}
        </span>
      ))}
    </p>
  );
}

/** Minutes of work against a shift, split by task type, with a marker at the shift's end. */
export function WorkloadBar({ byType, total, extra = 0 }: { byType: Partial<Record<HkType, number>>; total: number; extra?: number }) {
  const scale = Math.max(SHIFT_MINUTES, total + extra);
  const order: HkType[] = ["CHECKOUT_CLEAN", "STAYOVER", "DEEP_CLEAN", "TURNDOWN", "INSPECTION", "CUSTOM"];
  const over = total + extra > SHIFT_MINUTES;
  return (
    <div className="mt-2.5">
      <div
        className="relative flex h-2 gap-[2px] overflow-hidden rounded-[2px] bg-surface-2"
        role="meter"
        aria-label="Workload"
        aria-valuemin={0}
        aria-valuemax={SHIFT_MINUTES}
        aria-valuenow={total}
        aria-valuetext={`${formatDuration(total * 60_000)} of ${SHIFT_MINUTES / 60} hours`}
      >
        {order.map((k) =>
          byType[k] ? <span key={k} className="h-full first:rounded-l-[2px]" style={{ width: `${(byType[k]! / scale) * 100}%`, background: typeColor(k) }} /> : null,
        )}
        {extra > 0 && (
          <span className="hatch h-full text-laterite" style={{ width: `${(extra / scale) * 100}%`, background: "color-mix(in oklab, var(--laterite) 18%, transparent)" }} />
        )}
        <span className="absolute inset-y-0 w-px bg-ink" style={{ left: `${(SHIFT_MINUTES / scale) * 100}%` }} aria-hidden />
      </div>
      {over && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-danger">
          <Warning size={11} weight="bold" /> {formatDuration((total + extra - SHIFT_MINUTES) * 60_000)} over the shift
        </p>
      )}
    </div>
  );
}

function TaskCard({
  t,
  assignee,
  suggested,
  draggable,
  onDragStart,
  onDragEnd,
  onOpen,
  showStatus,
  dragging,
}: {
  t: HkTaskView;
  assignee: string | null;
  suggested?: string;
  draggable: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: () => void;
  onOpen: () => void;
  showStatus: boolean;
  dragging: boolean;
}) {
  const urgent = t.priority === "URGENT";
  const done = t.status === "DONE" || t.status === "INSPECTED";
  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      data-testid={`hk-task-${t.roomNumber}`}
      aria-label={`Room ${t.roomNumber}, ${HK_TYPE[t.type].label}, ${HK_STATUS[t.status].label}${assignee ? `, ${assignee}` : ""}${urgent ? ", urgent: arrival today" : ""}`}
      className={cn(
        "group relative flex w-full flex-col gap-1.5 overflow-hidden rounded-md border bg-surface px-3 py-2.5 text-left transition-[border-color,box-shadow,opacity,transform] duration-150",
        draggable && "cursor-grab active:cursor-grabbing",
        urgent && !done ? "border-[color-mix(in_oklab,var(--laterite)_45%,transparent)]" : "border-line hover:border-line-strong",
        dragging && "rotate-[-1.5deg] opacity-60",
        done && "bg-surface/70",
      )}
      style={{ boxShadow: `inset 3px 0 0 ${urgent && !done ? "var(--laterite)" : t.priority === "HIGH" && !done ? "var(--ochre)" : "transparent"}` }}
    >
      <span className="flex items-center gap-2">
        <span className={cn("font-mono text-[17px] leading-none", done ? "text-ink-muted" : "text-ink")}>{t.roomNumber}</span>
        <span className="h-2 w-2 rounded-[2px]" style={{ background: typeColor(t.type) }} aria-hidden />
        <span className="truncate text-[12px] text-ink-muted">{HK_TYPE[t.type].short}</span>
        {t.dnd && (
          <span className="inline-flex items-center gap-0.5 text-[10.5px] text-adire" title="Do not disturb">
            <MoonStars size={11} weight="fill" /> DND
          </span>
        )}
        <span className="ml-auto flex items-center gap-1.5">
          {showStatus && <span className="text-[10.5px] text-ink-faint">{HK_STATUS[t.status].label}</span>}
          {assignee ? (
            <span className="grid h-6 w-6 place-items-center rounded-full border border-line-strong bg-surface-2 font-mono text-[9.5px] text-ink" title={assignee}>
              {initials(assignee)}
            </span>
          ) : suggested ? (
            <span className="grid h-6 w-6 place-items-center rounded-full border border-dashed border-laterite font-mono text-[9.5px] text-laterite" title={`Suggested: ${suggested}`}>
              {initials(suggested)}
            </span>
          ) : null}
        </span>
      </span>
      {urgent && t.arrival && !done && (
        <span className="flex items-center gap-1.5 text-[11.5px] text-laterite">
          <AirplaneLanding size={12} weight="bold" />
          <span className="truncate">
            Arrival{t.arrival.at ? ` ${formatTime(t.arrival.at)}` : " today"}
            {t.arrival.guestName ? <span className="text-ink-muted"> &middot; {t.arrival.guestName}</span> : null}
          </span>
        </span>
      )}
      {t.status === "REJECTED" && <span className="text-[11.5px] text-danger">Sent back{t.notes ? `: ${t.notes}` : ""}</span>}
      {t.checklistTotal > 0 && (t.status === "IN_PROGRESS" || done) && (
        <span className="flex items-center gap-2">
          <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
            <span className="absolute inset-y-0 left-0 rounded-full bg-palm" style={{ width: `${(t.checklistDone / t.checklistTotal) * 100}%` }} />
          </span>
          <span className="inline-flex items-center gap-0.5 font-mono text-[10.5px] text-ink-muted">
            <Checks size={11} /> {t.checklistDone}/{t.checklistTotal}
          </span>
        </span>
      )}
      {t.status === "IN_PROGRESS" && t.startedAt && <span className="text-[11px] text-ink-faint">started {formatTime(t.startedAt)}</span>}
    </button>
  );
}

export const statusOrder: HkStatus[] = ["OPEN", "ASSIGNED", "IN_PROGRESS", "DONE", "INSPECTED", "REJECTED", "SKIPPED"];
