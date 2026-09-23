"use client";

import type { AuditLog } from "@/lib/api/types";
import { describeAudit } from "@/lib/audit";
import { formatDateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";

export function ActivityFeed({ items, className }: { items: AuditLog[]; className?: string }) {
  return (
    <ol className={cn("relative", className)}>
      {items.map((log, i) => {
        const d = describeAudit(log);
        const I = d.icon;
        return (
          <li key={log.id} className="relative flex gap-3.5 pb-5 last:pb-0">
            {i < items.length - 1 && (
              <span aria-hidden className="absolute left-[15px] top-8 bottom-0 w-px bg-line" />
            )}
            <span
              className="relative grid h-8 w-8 shrink-0 place-items-center rounded-full border bg-surface"
              style={{ borderColor: `color-mix(in oklab, ${d.tone} 35%, transparent)`, color: d.tone }}
            >
              <I size={15} weight="duotone" />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <p className="text-[13.5px] leading-snug text-ink">
                <span className="font-medium">{d.actor}</span> <span className="text-ink-muted">{d.verb}</span>{" "}
                {d.object && <span>{d.object}</span>}
                {d.detail && <span className="text-ink-muted"> &middot; {d.detail}</span>}
              </p>
              <time dateTime={log.createdAt} title={formatDateTime(log.createdAt)} className="font-mono text-[11px] text-ink-faint">
                {relativeTime(log.createdAt)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
