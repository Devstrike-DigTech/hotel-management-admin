"use client";

/* Upgrade previews for the M4 features: the real components, fed sample data. */

import { addDays, todayKey, weekday } from "@/lib/dates";
import { AlmanacGrid } from "@/components/rates/almanac";
import type { AlmanacCell, AlmanacData, AlmanacRule } from "@/components/rates/model";
import { applyAdjustment, ruleCovers } from "@/components/rates/model";
import { HousekeepingBoard } from "@/components/housekeeping/board";
import type { HkTaskView } from "@/components/housekeeping/model";
import { AgingBar } from "@/components/ledger-city/aging";
import { CategoryIcon, SlaClock } from "@/components/maintenance/bits";
import { PERMISSION_GROUPS } from "@/lib/permission-catalog";
import { PermissionMatrix, type RoleView } from "@/components/roles/matrix";

const noop = () => {};
import { useNow } from "@/lib/use-now";

export function AlmanacPreview() {
  const from = todayKey();
  const days = Array.from({ length: 21 }, (_, i) => addDays(from, i));
  const types = [
    { id: "a", name: "Standard Queen", basePriceKobo: 5_500_000, rooms: 12 },
    { id: "b", name: "Deluxe King", basePriceKobo: 8_500_000, rooms: 9 },
    { id: "c", name: "Palm Suite", basePriceKobo: 16_000_000, rooms: 3 },
  ];
  const rules: AlmanacRule[] = [
    { id: "w", name: "Weekend", slot: 2, roomTypeIds: [], dateFrom: from, dateTo: addDays(from, 60), daysOfWeek: [5, 6], adjustment: { type: "PERCENT", value: 10 }, priority: 10 },
    { id: "c", name: "Conference week", slot: 1, roomTypeIds: [], dateFrom: addDays(from, 8), dateTo: addDays(from, 13), daysOfWeek: [], adjustment: { type: "PERCENT", value: 25 }, priority: 40 },
  ];
  const cells = new Map<string, Map<string, AlmanacCell>>();
  for (const t of types) {
    const m = new Map<string, AlmanacCell>();
    for (const d of days) {
      const best = rules.filter((r) => ruleCovers(r, t.id, d)).sort((a, b) => b.priority - a.priority)[0];
      m.set(d, { date: d, baseKobo: t.basePriceKobo, priceKobo: best ? applyAdjustment(t.basePriceKobo, best.adjustment) : t.basePriceKobo, ruleId: best?.id ?? null, overrideKobo: null, minNights: d === addDays(from, 9) ? 2 : null, closedToArrival: d === addDays(from, 12) });
    }
    cells.set(t.id, m);
  }
  const data: AlmanacData = {
    from,
    days,
    types,
    cells,
    rules,
    demand: new Map(days.map((d, i) => [d, { date: d, occupancy: Math.min(0.97, 0.45 + (weekday(d) >= 5 ? 0.25 : 0) + (i >= 8 && i <= 13 ? 0.3 : 0) - i * 0.005) }])),
  };
  return (
    <div className="overflow-hidden rounded-md border border-line">
      <AlmanacGrid data={data} selection={{ r0: 0, r1: 2, c0: 15, c1: 17 }} onSelectionChange={noop} onCommit={noop} today={from} />
    </div>
  );
}

export function HousekeepingBoardPreview() {
  const t = (id: string, roomNumber: string, floor: number, type: HkTaskView["type"], status: HkTaskView["status"], assigneeId: string | null, extra: Partial<HkTaskView> = {}): HkTaskView => ({
    id,
    roomId: id,
    roomNumber,
    floor,
    type,
    status,
    priority: "NORMAL",
    assigneeId,
    checklistDone: status === "IN_PROGRESS" ? 4 : status === "DONE" ? 10 : 0,
    checklistTotal: 10,
    ...extra,
  });
  const tasks = [
    t("1", "104", 1, "CHECKOUT_CLEAN", "OPEN", null, { priority: "URGENT", arrival: { guestName: "Chiamaka Obi" } }),
    t("2", "207", 2, "STAYOVER", "OPEN", null),
    t("3", "112", 1, "CHECKOUT_CLEAN", "ASSIGNED", "a"),
    t("4", "203", 2, "DEEP_CLEAN", "IN_PROGRESS", "b", { startedAt: new Date().toISOString() }),
    t("5", "301", 3, "CHECKOUT_CLEAN", "DONE", "a"),
  ];
  return (
    <HousekeepingBoard
      tasks={tasks}
      people={[
        { id: "a", fullName: "Musa Abdullahi" },
        { id: "b", fullName: "Blessing Nwosu" },
      ]}
      group="status"
      onAssign={noop}
      onOpen={noop}
      canAssign={false}
    />
  );
}

export function MaintenancePreview() {
  const now = useNow(60_000);
  const rows = [
    { n: "MT-000121", t: "AC leaking onto the carpet", where: "Room 106", c: "AC_HVAC" as const, due: now + 5 * 3600e3, created: now - 19 * 3600e3, block: true },
    { n: "MT-000120", t: "Generator not changing over", where: "Generator house", c: "GENERATOR" as const, due: now - 2 * 3600e3, created: now - 6 * 3600e3 },
    { n: "MT-000118", t: "Shower mixer dripping", where: "Room 203", c: "PLUMBING" as const, due: now + 46 * 3600e3, created: now - 26 * 3600e3 },
  ];
  return (
    <ul className="divide-y divide-line rounded-md border border-line bg-surface">
      {rows.map((r) => (
        <li key={r.n} className="flex items-center gap-3 px-4 py-3">
          <CategoryIcon category={r.c} size={18} className="text-ink-muted" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13.5px] text-ink">{r.t}</p>
            <p className="font-mono text-[11px] text-ink-faint">
              {r.n} &middot; {r.where}
              {r.block && <span className="ml-2 text-danger">out of order 2 nights</span>}
            </p>
          </div>
          <SlaClock dueAt={new Date(r.due).toISOString()} createdAt={new Date(r.created).toISOString()} />
        </li>
      ))}
    </ul>
  );
}

export function CityLedgerPreview() {
  return (
    <div className="flex flex-col gap-5">
      <AgingBar buckets={{ CURRENT: 186_000_000, D31_60: 163_000_000, D61_90: 100_000_000, D90_PLUS: 81_000_000 }} />
      <ul className="divide-y divide-line rounded-md border border-line bg-surface text-[13px]">
        {[
          ["Deltaline Oilfield Services Ltd", "₦3,920,000", "78% of limit"],
          ["Crestmark Bank Plc", "₦540,000", "18% of limit"],
          ["Hope Bridge Foundation", "₦1,380,000", "92% of limit"],
        ].map(([n, v, l]) => (
          <li key={n} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-ink">{n}</span>
            <span className="font-mono text-ink">
              {v} <span className="ml-2 text-[11px] text-ink-faint">{l}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RolesPreview() {
  const groups = PERMISSION_GROUPS.slice(0, 3);
  const roles: RoleView[] = [
    { id: "fd", name: "Front desk", system: true, permissions: ["reservations.view", "reservations.create", "reservations.edit", "frontdesk.checkin", "frontdesk.checkout", "folio.view", "folio.charge"], staffCount: 3 },
    { id: "na", name: "Night Auditor", system: false, permissions: ["reservations.view", "frontdesk.checkin", "frontdesk.checkout", "folio.view"], staffCount: 1 },
  ];
  return <PermissionMatrix roles={roles} groups={groups} mine={new Set()} draft={{}} onToggle={noop} canEdit={false} />;
}
