"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { ClockCounterClockwise, DownloadSimple, LockSimple } from "@phosphor-icons/react";
import { hotelApi } from "@/lib/api/endpoints";
import type { AuditLog } from "@/lib/api/types";
import { describeAudit } from "@/lib/audit";
import { useEntitlements } from "@/lib/auth";
import { formatDate, formatTime, LAGOS_TZ } from "@/lib/format";
import { openUpgrade } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";

const PAGE_SIZE = 30;

function dayKey(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: LAGOS_TZ }).format(new Date(iso));
}

function dayLabel(key: string) {
  const today = dayKey(new Date().toISOString());
  const yesterday = dayKey(new Date(Date.now() - 864e5).toISOString());
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return formatDate(`${key}T12:00:00+01:00`, { weekday: "long", day: "numeric", month: "long", year: undefined });
}

export function AuditView() {
  const { has } = useEntitlements();
  const q = useInfiniteQuery({
    queryKey: ["audit", "infinite"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => hotelApi.auditLogs(pageParam, PAGE_SIZE),
    getNextPageParam: (last, all) => {
      const loaded = all.reduce((n, p) => n + p.items.length, 0);
      return loaded < last.total && last.items.length > 0 ? all.length + 1 : undefined;
    },
  });

  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  const total = q.data?.pages[0]?.total ?? 0;
  const groups: { key: string; items: AuditLog[] }[] = [];
  for (const it of items) {
    const k = dayKey(it.createdAt);
    const g = groups[groups.length - 1];
    if (g && g.key === k) g.items.push(it);
    else groups.push({ key: k, items: [it] });
  }

  const exportCsv = () => {
    const rows = [["time", "actor", "action", "entity", "entityId", "metadata"]].concat(
      items.map((l) => [
        l.createdAt,
        l.actor?.fullName ?? "System",
        l.action,
        l.entityType,
        l.entityId ?? "",
        JSON.stringify(l.metadata ?? {}),
      ]),
    );
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${dayKey(new Date().toISOString())}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <ClockCounterClockwise size={14} weight="duotone" /> Audit log
          </>
        }
        title={
          <>
            Who did what, <em>and when</em>.
          </>
        }
        description="An append-only record of every change. Entries can't be edited or deleted, by anyone."
        actions={
          has("audit_export") ? (
            <Button variant="secondary" onClick={exportCsv} disabled={!items.length}>
              <DownloadSimple size={15} /> Export CSV
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => openUpgrade({ kind: "feature", feature: "audit_export" })}>
              <LockSimple size={14} weight="bold" className="text-brass" /> Export CSV
            </Button>
          )
        }
      />

      <Panel className="px-4 py-6 sm:px-8">
        {q.isLoading ? (
          <div className="flex flex-col gap-5">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex gap-4">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !items.length ? (
          <EmptyState glyph="river" title="Nothing recorded yet" body="As your team works, every change lands here with a name and a time." />
        ) : (
          <div className="flex flex-col gap-8">
            {groups.map((g) => (
              <section key={g.key} aria-label={dayLabel(g.key)}>
                <h2 className="sticky top-14 z-10 -mx-4 mb-3 flex items-center gap-3 bg-surface/95 px-4 py-2 backdrop-blur-[2px] sm:-mx-8 sm:px-8">
                  <span className="display-sm text-[17px] text-ink">{dayLabel(g.key)}</span>
                  <span className="h-px flex-1 bg-line" />
                  <span className="font-mono text-[11px] text-ink-faint">{g.items.length}</span>
                </h2>
                <ol>
                  {g.items.map((log, i) => {
                    const d = describeAudit(log);
                    const I = d.icon;
                    const last = i === g.items.length - 1;
                    return (
                      <li key={log.id} className="grid grid-cols-[44px_32px_minmax(0,1fr)] gap-x-3 sm:grid-cols-[56px_32px_minmax(0,1fr)] sm:gap-x-4">
                        <time dateTime={log.createdAt} className="pt-2 text-right font-mono text-[11.5px] text-ink-muted">
                          {formatTime(log.createdAt)}
                        </time>
                        <div className="relative flex justify-center">
                          {!last && <span aria-hidden className="absolute bottom-0 top-8 w-px bg-line" />}
                          <span
                            className="relative mt-0.5 grid h-8 w-8 place-items-center rounded-full border bg-surface"
                            style={{ borderColor: `color-mix(in oklab, ${d.tone} 35%, transparent)`, color: d.tone }}
                          >
                            <I size={15} weight="duotone" />
                          </span>
                        </div>
                        <div className="min-w-0 pb-5 pt-1.5">
                          <p className="text-[13.5px] leading-snug text-ink">
                            <span className="font-medium">{d.actor}</span> <span className="text-ink-muted">{d.verb}</span>{" "}
                            {d.object}
                            {d.detail && <span className="text-ink-muted"> &middot; {d.detail}</span>}
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-ink-faint">
                            {log.action}
                            {log.entityId ? ` · ${log.entityId.slice(0, 10)}` : ""}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            ))}
            <div className="flex flex-col items-center gap-2 border-t border-line pt-6">
              <p className="font-mono text-[11.5px] text-ink-faint">
                {items.length} of {total} entries
              </p>
              {q.hasNextPage && (
                <Button variant="secondary" size="sm" loading={q.isFetchingNextPage} onClick={() => q.fetchNextPage()}>
                  Load older entries
                </Button>
              )}
            </div>
          </div>
        )}
      </Panel>
    </>
  );
}
