"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { SealCheck, XCircle, Clock, Warning } from "@phosphor-icons/react";
import { useInspections } from "@/lib/api/hooks-m4";
import { hkApi } from "@/lib/api/endpoints-m4";
import type { HousekeepingTask } from "@/lib/api/types-m4";
import { toast } from "@/lib/store";
import { formatTime, relativeTime } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { formatDuration } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/form";
import { EmptyState, ErrorState, Panel, Skeleton } from "@/components/ui/primitives";
import { HK_TYPE } from "./model";
import { useHkRefresh } from "./task-sheet";

/** Cleaned rooms waiting for a supervisor, oldest first. Pass puts the room back on sale. */
export function InspectionQueue() {
  const q = useInspections();
  if (q.isError)
    return (
      <Panel>
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </Panel>
    );
  if (!q.data)
    return (
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    );
  if (!q.data.length)
    return (
      <Panel>
        <EmptyState glyph="eye" title="Nothing waiting for inspection" body="Rooms appear here the moment a housekeeper finishes them." />
      </Panel>
    );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {q.data.map((t) => (
        <InspectCard key={t.id} t={t} />
      ))}
    </div>
  );
}

function InspectCard({ t }: { t: HousekeepingTask }) {
  const refresh = useHkRefresh();
  const now = useNow(30_000);
  const [failing, setFailing] = useState(false);
  const [note, setNote] = useState("");
  const m = useMutation({
    mutationFn: (pass: boolean) => hkApi.inspect(t.id, pass ? "PASS" : "FAIL", pass ? undefined : note.trim()),
    onSuccess: async (_r, pass) => {
      await refresh();
      toast.success(pass ? `Room ${t.room.number} is clean and on sale` : `Room ${t.room.number} sent back to ${t.assignee?.fullName ?? "housekeeping"}`);
    },
    meta: { errorTitle: "Inspection not saved" },
  });
  const missed = t.checklist.filter((c) => !c.done);
  const waited = t.doneAt ? now - +new Date(t.doneAt) : 0;
  return (
    <Panel as="article" className={cn("flex flex-col", t.arrivalToday && "border-[color-mix(in_oklab,var(--laterite)_40%,transparent)]")} data-testid={`inspect-${t.room.number}`}>
      <header className="flex items-start gap-4 border-b border-line px-5 py-4">
        <span className="font-mono text-[34px] leading-none text-ink">{t.room.number}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] text-ink">
            {HK_TYPE[t.type].label} <span className="text-ink-muted">&middot; {t.room.roomType.name}</span>
          </p>
          <p className="text-[12px] text-ink-muted">
            {t.assignee?.fullName ?? "Someone"} finished at <span className="font-mono">{t.doneAt ? formatTime(t.doneAt) : "-"}</span>
          </p>
        </div>
        <span className={cn("inline-flex items-center gap-1 font-mono text-[11.5px]", waited > 45 * 60_000 ? "text-ochre" : "text-ink-muted")} title="Waiting for inspection">
          <Clock size={12} /> {formatDuration(waited)}
        </span>
      </header>
      {t.arrivalToday && (
        <p className="border-b border-line bg-laterite-wash/40 px-5 py-2 text-[12.5px] text-ink">
          <span className="font-medium">{t.arrivalToday.guestName}</span> arrives at <span className="font-mono">{formatTime(t.arrivalToday.arrivalAt)}</span>. Inspect this one first.
        </p>
      )}
      <div className="flex-1 px-5 py-4">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow">Checklist</span>
          <span className={cn("font-mono text-[12px]", missed.length ? "text-ochre" : "text-palm")}>
            {t.checklistDone}/{t.checklistTotal}
          </span>
        </div>
        {missed.length ? (
          <ul className="mt-2 flex flex-col gap-1">
            {missed.map((c) => (
              <li key={c.id} className="flex items-center gap-2 text-[12.5px] text-ink">
                <Warning size={12} weight="fill" className="text-ochre" /> Not ticked: {c.label}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[12.5px] text-ink-muted">Every item ticked.</p>
        )}
        {t.notes && <p className="mt-3 text-[12.5px] text-ink-muted">&ldquo;{t.notes}&rdquo;</p>}
        {t.photos.length > 0 && (
          <div className="mt-3 flex gap-2">
            {t.photos.map((p) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={p.key} src={p.url} alt="From the room" className="h-16 w-16 rounded-sm border border-line object-cover" />
            ))}
          </div>
        )}
        {failing && (
          <div className="mt-4">
            <label htmlFor={`fail-${t.id}`} className="text-[13px] font-medium text-ink">
              What needs fixing
            </label>
            <Textarea id={`fail-${t.id}`} className="mt-1.5 min-h-16" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Towels missing; bin not emptied" autoFocus />
          </div>
        )}
      </div>
      <footer className="flex items-center gap-2 border-t border-line bg-surface-2/40 px-5 py-3">
        <span className="mr-auto text-[11.5px] text-ink-faint">raised {relativeTime(t.createdAt)}</span>
        {failing ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => setFailing(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="danger" disabled={note.trim().length < 3} loading={m.isPending && !m.variables} onClick={() => m.mutate(false)}>
              Send back
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="secondary" onClick={() => setFailing(true)}>
              <XCircle size={14} /> Send back
            </Button>
            <Button size="sm" loading={m.isPending && m.variables} onClick={() => m.mutate(true)}>
              <SealCheck size={14} weight="duotone" /> Pass
            </Button>
          </>
        )}
      </footer>
    </Panel>
  );
}
