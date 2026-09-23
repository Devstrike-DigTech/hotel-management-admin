"use client";

import {
  Armchair,
  Drop,
  GearSix,
  Lightning,
  Snowflake,
  Television,
  Wall,
  WifiHigh,
  Wrench,
  type Icon,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/dates";
import { useNow } from "@/lib/use-now";

export type MtCategory = "ELECTRICAL" | "PLUMBING" | "AC_HVAC" | "FURNITURE" | "APPLIANCE" | "GENERATOR" | "CIVIL" | "IT" | "OTHER";
export type MtPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type MtStatus = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "ON_HOLD" | "RESOLVED" | "CLOSED";

export const MT_CATEGORY: Record<MtCategory, { label: string; icon: Icon }> = {
  ELECTRICAL: { label: "Electrical", icon: Lightning },
  PLUMBING: { label: "Plumbing", icon: Drop },
  AC_HVAC: { label: "Air conditioning", icon: Snowflake },
  FURNITURE: { label: "Furniture", icon: Armchair },
  APPLIANCE: { label: "Appliance", icon: Television },
  GENERATOR: { label: "Generator", icon: GearSix },
  CIVIL: { label: "Building works", icon: Wall },
  IT: { label: "Wi-Fi and IT", icon: WifiHigh },
  OTHER: { label: "Other", icon: Wrench },
};
export const MT_CATEGORY_ORDER = Object.keys(MT_CATEGORY) as MtCategory[];

export const MT_PRIORITY: Record<MtPriority, { label: string; sla: string; hours: number; tone: string }> = {
  URGENT: { label: "Urgent", sla: "4 hours", hours: 4, tone: "var(--laterite)" },
  HIGH: { label: "High", sla: "24 hours", hours: 24, tone: "var(--ochre)" },
  NORMAL: { label: "Normal", sla: "3 days", hours: 72, tone: "var(--ink-faint)" },
  LOW: { label: "Low", sla: "7 days", hours: 168, tone: "var(--line-strong)" },
};
export const MT_PRIORITY_ORDER: MtPriority[] = ["URGENT", "HIGH", "NORMAL", "LOW"];

export const MT_STATUS: Record<MtStatus, { label: string; tone: "neutral" | "brass" | "adire" | "palm" | "ochre" | "danger" | "laterite" }> = {
  OPEN: { label: "Open", tone: "ochre" },
  ASSIGNED: { label: "Assigned", tone: "neutral" },
  IN_PROGRESS: { label: "In progress", tone: "brass" },
  ON_HOLD: { label: "On hold", tone: "adire" },
  RESOLVED: { label: "Resolved", tone: "palm" },
  CLOSED: { label: "Closed", tone: "neutral" },
};
export const MT_STATUS_ORDER: MtStatus[] = ["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "RESOLVED", "CLOSED"];
export const isOpenTicket = (s: MtStatus) => s !== "RESOLVED" && s !== "CLOSED";

export function CategoryIcon({ category, size = 15, className }: { category: MtCategory; size?: number; className?: string }) {
  const I = MT_CATEGORY[category]?.icon ?? Wrench;
  return <I size={size} weight="duotone" className={className} aria-label={MT_CATEGORY[category]?.label} />;
}

/** "3h 16m", "1d 21h", "5 days": coarser the further away it is. */
function span(ms: number) {
  const h = ms / 3600_000;
  if (h >= 72) return `${Math.round(h / 24)} days`;
  if (h >= 24) return `${Math.floor(h / 24)}d ${Math.floor(h % 24)}h`;
  return formatDuration(ms);
}

/**
 * SLA countdown: a ring that empties as the deadline nears, ochre in the last
 * quarter, danger once breached. Text always says it in words.
 */
export function SlaClock({
  dueAt,
  createdAt,
  resolvedAt,
  size = "sm",
}: {
  dueAt: string | null | undefined;
  createdAt: string;
  resolvedAt?: string | null;
  size?: "sm" | "lg";
}) {
  const now = useNow(size === "lg" ? 1_000 : 30_000);
  if (!dueAt) return null;
  const due = +new Date(dueAt);
  const start = +new Date(createdAt);
  const end = resolvedAt ? +new Date(resolvedAt) : now;
  const left = due - end;
  const frac = Math.max(0, Math.min(1, left / Math.max(1, due - start)));
  const breached = left < 0;
  const tone = resolvedAt ? (breached ? "var(--danger)" : "var(--palm)") : breached ? "var(--danger)" : frac < 0.25 ? "var(--ochre)" : "var(--ink-muted)";
  const text = resolvedAt
    ? breached
      ? `Fixed ${span(-left)} late`
      : `Fixed with ${span(left)} to spare`
    : breached
      ? `Breached ${span(-left)} ago`
      : `${span(left)} left`;
  const R = size === "lg" ? 26 : 6.5;
  const S = size === "lg" ? 64 : 16;
  const C = 2 * Math.PI * R;
  if (size === "lg") {
    const h = Math.floor(Math.max(0, left) / 3600_000);
    const m = Math.floor((Math.max(0, left) % 3600_000) / 60_000);
    const s = Math.floor((Math.max(0, left) % 60_000) / 1000);
    return (
      <div className="flex items-center gap-4" role="timer" aria-label={text}>
        <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden>
          <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke="var(--line)" strokeWidth={4} />
          <circle
            cx={S / 2}
            cy={S / 2}
            r={R}
            fill="none"
            stroke={tone}
            strokeWidth={4}
            strokeLinecap="round"
            strokeDasharray={`${C * (breached ? 1 : frac)} ${C}`}
            transform={`rotate(-90 ${S / 2} ${S / 2})`}
            style={{ transition: "stroke-dasharray 400ms" }}
          />
        </svg>
        <div>
          {resolvedAt ? (
            <p className="text-[15px] text-ink">{text}</p>
          ) : breached ? (
            <p className="font-mono text-[22px] leading-none text-danger">SLA breached</p>
          ) : (
            <p className="font-mono text-[26px] leading-none tracking-tight text-ink">
              {h}
              <span className="text-ink-faint">h</span> {String(m).padStart(2, "0")}
              <span className="text-ink-faint">m</span> <span className="text-[18px] text-ink-muted">{String(s).padStart(2, "0")}</span>
            </p>
          )}
          <p className="mt-1 text-[12px] text-ink-muted">{resolvedAt || breached ? text : "until the SLA runs out"}</p>
        </div>
      </div>
    );
  }
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono text-[11px]", breached && !resolvedAt ? "text-danger" : "text-ink-muted")} title={text}>
      <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`} aria-hidden>
        <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke="var(--line-strong)" strokeWidth={2} />
        <circle
          cx={S / 2}
          cy={S / 2}
          r={R}
          fill="none"
          stroke={tone}
          strokeWidth={2}
          strokeDasharray={`${C * (breached ? 1 : frac)} ${C}`}
          transform={`rotate(-90 ${S / 2} ${S / 2})`}
        />
      </svg>
      {breached && !resolvedAt ? `${span(-left)} over` : text}
    </span>
  );
}
