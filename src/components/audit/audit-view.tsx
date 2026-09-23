"use client";

import { useState } from "react";
import { useInfiniteQuery, useMutation } from "@tanstack/react-query";
import { auditExportApi } from "@/lib/api/endpoints-m4";
import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/store";
import { addDays, diffDays, formatDay, todayKey } from "@/lib/dates";
import { Dialog } from "@/components/ui/overlay";
import { Field, Input } from "@/components/ui/form";
import { Segmented } from "@/components/ui/primitives";
import { ChipRadio } from "@/components/m2/bits";
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
  const { has, requiredPlan } = useEntitlements();
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

  const { can } = useCan();
  const [exporting, setExporting] = useState(false);

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
          !can("audit.export") ? null : has("audit_export") ? (
            <Button variant="secondary" onClick={() => setExporting(true)}>
              <DownloadSimple size={15} /> Export
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => openUpgrade({ kind: "feature", feature: "audit_export" })}>
              <LockSimple size={14} weight="bold" className="text-brass" /> Export
              <span className="text-[11px] text-ink-faint">{requiredPlan("audit_export").name}</span>
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
      <ExportDialog open={exporting} onOpenChange={setExporting} />
    </>
  );
}

type Preset = "7" | "30" | "month" | "custom";

/** Download a range of the audit trail as CSV or JSON. The export is itself audited. */
function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const today = todayKey();
  const [preset, setPreset] = useState<Preset>("30");
  const [from, setFrom] = useState(addDays(today, -29));
  const [to, setTo] = useState(today);
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const range =
    preset === "7" ? [addDays(today, -6), today] : preset === "30" ? [addDays(today, -29), today] : preset === "month" ? [today.slice(0, 8) + "01", today] : [from, to];
  const days = diffDays(range[0], range[1]) + 1;
  const m = useMutation({
    mutationFn: async () => {
      const res = await auditExportApi.download(range[0], range[1], format);
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const name = /filename="?([^";]+)"?/.exec(cd)?.[1] ?? `audit-${range[0]}-${range[1]}.${format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
      return name;
    },
    onSuccess: (name) => {
      toast.success(`${name} downloaded`, "The export is recorded in the audit log too.");
      onOpenChange(false);
    },
    meta: { errorTitle: "Export failed" },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Audit log"
      title="Export the trail"
      description="Every entry in the range, with who, what, when and from where. Up to a year at a time."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={m.isPending} disabled={days < 1 || days > 366} onClick={() => m.mutate()}>
            <DownloadSimple size={14} /> Download {format.toUpperCase()}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ChipRadio
          label="Range"
          value={preset}
          onChange={setPreset}
          options={[
            { value: "7", label: "Last 7 days" },
            { value: "30", label: "Last 30 days" },
            { value: "month", label: "This month" },
            { value: "custom", label: "Dates" },
          ]}
        />
        {preset === "custom" && (
          <div className="flex gap-3">
            <Field label="From" htmlFor="ax-from">
              <Input id="ax-from" type="date" max={to} value={from} onChange={(e) => e.target.value && setFrom(e.target.value)} className="font-mono" />
            </Field>
            <Field label="To" htmlFor="ax-to">
              <Input id="ax-to" type="date" min={from} max={today} value={to} onChange={(e) => e.target.value && setTo(e.target.value)} className="font-mono" />
            </Field>
          </div>
        )}
        <p className="text-[12.5px] text-ink-muted">
          {formatDay(range[0], { day: "numeric", month: "short", year: "numeric" })} to {formatDay(range[1], { day: "numeric", month: "short", year: "numeric" })}, <span className="font-mono">{days}</span> days
          {days > 366 && <span className="text-danger"> (a year at most)</span>}
        </p>
        <Segmented<"csv" | "json">
          label="Format"
          value={format}
          onChange={setFormat}
          options={[
            { value: "csv", label: "CSV for Excel" },
            { value: "json", label: "JSON" },
          ]}
        />
      </div>
    </Dialog>
  );
}
