/* Housekeeping view model and the pure logic behind the board. */

export type HkType = "CHECKOUT_CLEAN" | "STAYOVER" | "DEEP_CLEAN" | "TURNDOWN" | "INSPECTION" | "CUSTOM";
export type HkPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type HkStatus = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "DONE" | "INSPECTED" | "REJECTED" | "SKIPPED";

export const HK_TYPE: Record<HkType, { label: string; short: string; minutes: number }> = {
  CHECKOUT_CLEAN: { label: "Check-out clean", short: "Check-out", minutes: 35 },
  STAYOVER: { label: "Stayover", short: "Stayover", minutes: 20 },
  DEEP_CLEAN: { label: "Deep clean", short: "Deep", minutes: 90 },
  TURNDOWN: { label: "Turndown", short: "Turndown", minutes: 10 },
  INSPECTION: { label: "Inspection", short: "Inspect", minutes: 10 },
  CUSTOM: { label: "Other", short: "Other", minutes: 20 },
};

export const HK_STATUS: Record<HkStatus, { label: string; tone: "neutral" | "brass" | "adire" | "palm" | "ochre" | "danger" | "laterite" }> = {
  OPEN: { label: "Unassigned", tone: "ochre" },
  ASSIGNED: { label: "Assigned", tone: "neutral" },
  IN_PROGRESS: { label: "Cleaning", tone: "brass" },
  DONE: { label: "Awaiting inspection", tone: "adire" },
  INSPECTED: { label: "Inspected", tone: "palm" },
  REJECTED: { label: "Sent back", tone: "danger" },
  SKIPPED: { label: "Skipped", tone: "neutral" },
};

export const HK_PRIORITY_RANK: Record<HkPriority, number> = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };

export interface HkTaskView {
  id: string;
  roomId: string;
  roomNumber: string;
  floor: number;
  roomTypeId?: string;
  roomTypeName?: string;
  type: HkType;
  priority: HkPriority;
  status: HkStatus;
  assigneeId: string | null;
  assigneeName?: string | null;
  dueAt?: string | null;
  startedAt?: string | null;
  doneAt?: string | null;
  checklistDone: number;
  checklistTotal: number;
  arrival?: { at?: string | null; guestName?: string | null; code?: string | null } | null;
  dnd?: boolean;
  notes?: string | null;
  minutes?: number;
}

export interface HkPerson {
  id: string;
  fullName: string;
  roleName?: string;
}

export const taskMinutes = (t: HkTaskView) => t.minutes ?? HK_TYPE[t.type]?.minutes ?? 20;

export const isLive = (t: HkTaskView) => t.status !== "INSPECTED" && t.status !== "SKIPPED";
export const isOpenWork = (t: HkTaskView) => ["OPEN", "ASSIGNED", "IN_PROGRESS", "REJECTED"].includes(t.status);

export function byUrgency(a: HkTaskView, b: HkTaskView) {
  return (
    HK_PRIORITY_RANK[a.priority] - HK_PRIORITY_RANK[b.priority] ||
    (a.arrival?.at ?? "9").localeCompare(b.arrival?.at ?? "9") ||
    a.floor - b.floor ||
    a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true })
  );
}

/** Minutes of open work per housekeeper, split by task type. */
export function workload(tasks: HkTaskView[], people: HkPerson[]) {
  const map = new Map<string, { total: number; byType: Partial<Record<HkType, number>>; count: number; done: number }>();
  for (const p of people) map.set(p.id, { total: 0, byType: {}, count: 0, done: 0 });
  for (const t of tasks) {
    if (!t.assigneeId || !map.has(t.assigneeId)) continue;
    const w = map.get(t.assigneeId)!;
    if (isOpenWork(t)) {
      const m = taskMinutes(t);
      w.total += m;
      w.count++;
      w.byType[t.type] = (w.byType[t.type] ?? 0) + m;
    } else if (t.status === "DONE" || t.status === "INSPECTED") w.done++;
  }
  return map;
}

/**
 * Auto-balance: hand the unassigned work to whoever has the fewest minutes,
 * urgent rooms first, keeping each person on as few floors as possible.
 * Returns taskId -> assigneeId. The manager reviews it before anything is saved.
 */
export function suggestBalance(tasks: HkTaskView[], people: HkPerson[]): Map<string, string> {
  const out = new Map<string, string>();
  if (!people.length) return out;
  const load = workload(tasks, people);
  const floors = new Map<string, Set<number>>();
  for (const p of people) floors.set(p.id, new Set(tasks.filter((t) => t.assigneeId === p.id && isOpenWork(t)).map((t) => t.floor)));
  const todo = tasks.filter((t) => isOpenWork(t) && !t.assigneeId).sort(byUrgency);
  for (const t of todo) {
    const mins = taskMinutes(t);
    let best: string | null = null;
    let bestScore = Infinity;
    for (const p of people) {
      const l = load.get(p.id)!.total;
      // a small nudge towards someone already on this floor (about one stayover)
      const score = l - (floors.get(p.id)!.has(t.floor) ? 20 : 0);
      if (score < bestScore) {
        bestScore = score;
        best = p.id;
      }
    }
    if (!best) continue;
    out.set(t.id, best);
    load.get(best)!.total += mins;
    floors.get(best)!.add(t.floor);
  }
  return out;
}

/** A shift's worth of work, for the workload bar's scale. */
export const SHIFT_MINUTES = 7 * 60;
