"use client";

import Link from "next/link";
import { useMaintenanceReport } from "@/lib/api/hooks-m4";
import { naira, percent } from "@/lib/format";
import { ErrorState, Panel, PanelHeader, Skeleton, Stat } from "@/components/ui/primitives";
import { CategoryIcon, MT_CATEGORY } from "./bits";

/** Open tickets by age, SLA breaches, cost by category and the rooms that keep breaking. */
export function MaintenanceReports() {
  const r = useMaintenanceReport();
  if (r.isError)
    return (
      <Panel>
        <ErrorState error={r.error} onRetry={() => r.refetch()} />
      </Panel>
    );
  if (!r.data) return <Skeleton className="h-80" />;
  const d = r.data;
  const maxAge = Math.max(1, ...d.openByAge.map((b) => b.count));
  const cost = [...d.costByCategory].sort((a, b) => (b.costKobo ?? 0) - (a.costKobo ?? 0));
  const maxCost = Math.max(1, ...cost.map((c) => c.costKobo ?? 0));
  const maxRoom = Math.max(1, ...d.problemRooms.map((p) => p.tickets));
  return (
    <div className="flex flex-col gap-5">
      <Panel className="grid grid-cols-2 gap-6 p-5 md:grid-cols-4">
        <Stat label="Opened, 30 days" value={d.createdInRange} sub={`${d.resolvedInRange} resolved`} />
        <Stat label="SLA kept" value={percent(1 - d.slaBreaches.rate)} sub={`${d.slaBreaches.count} breaches`} />
        <Stat label="Time to fix" value={d.meanTimeToResolveHours != null ? `${Math.round(d.meanTimeToResolveHours)}h` : "-"} sub="on average" />
        <Stat label="Room nights lost" value={d.blockedRoomNights} sub="out of order" />
      </Panel>
      <div className="grid gap-5 lg:grid-cols-3">
        <Panel>
          <PanelHeader eyebrow="Open now" title="How long they've waited" />
          <ul className="flex flex-col gap-3 px-5 py-4">
            {d.openByAge.map((b) => (
              <li key={b.bucket} className="grid grid-cols-[52px_1fr_28px] items-center gap-3">
                <span className="font-mono text-[12px] text-ink-muted">{b.bucket}</span>
                <span className="h-2.5 rounded-r-[3px]" style={{ width: `${(b.count / maxAge) * 100}%`, minWidth: b.count ? 4 : 0, background: b.bucket === "7d+" ? "var(--danger)" : "var(--ink-muted)" }} />
                <span className="text-right font-mono text-[12.5px] text-ink">{b.count}</span>
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <PanelHeader eyebrow="30 days" title="Cost by kind" />
          <ul className="flex flex-col gap-2.5 px-5 py-4">
            {cost.map((c) => (
              <li key={c.category}>
                <div className="flex items-center gap-2 text-[12.5px]">
                  <CategoryIcon category={c.category} size={13} className="text-ink-muted" />
                  <span className="text-ink">{MT_CATEGORY[c.category].label}</span>
                  <span className="ml-auto font-mono text-ink">{c.costKobo == null ? "-" : naira(c.costKobo)}</span>
                </div>
                <div className="mt-1 h-1.5 rounded-r-[2px] bg-laterite" style={{ width: `${((c.costKobo ?? 0) / maxCost) * 100}%`, minWidth: c.costKobo ? 3 : 0 }} />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel>
          <PanelHeader eyebrow="Rooms" title="The ones that keep breaking" />
          <ul className="flex flex-col gap-2.5 px-5 py-4">
            {d.problemRooms.slice(0, 8).map((p) => (
              <li key={p.room.id} className="grid grid-cols-[44px_1fr_auto] items-center gap-3">
                <Link href={`/maintenance?tab=tickets`} className="font-mono text-[15px] text-ink hover:text-laterite">
                  {p.room.number}
                </Link>
                <span className="flex h-2 gap-[2px]">
                  {Array.from({ length: p.tickets }, (_, i) => (
                    <span key={i} className="h-full rounded-[1px] bg-ochre" style={{ width: `${100 / maxRoom}%` }} />
                  ))}
                </span>
                <span className="font-mono text-[12px] text-ink-muted">
                  {p.tickets} {p.costKobo ? `· ${naira(p.costKobo)}` : ""}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}
