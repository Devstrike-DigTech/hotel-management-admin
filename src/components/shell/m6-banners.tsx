"use client";

import { useEffect, useState } from "react";
import { CheckCircle, Eye, Info, PencilSimpleLine, SignOut, Warning, WarningOctagon, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/use-now";

/* ---------- impersonation ---------- */

export interface ImpersonationView {
  staffName: string;
  staffRole?: string | null;
  operatorName: string;
  reason: string;
  mode: "READ_ONLY" | "WRITE";
  expiresAt: string;
  writeReason?: string | null;
}

function left(ms: number) {
  if (ms <= 0) return "ended";
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return m >= 1 ? `${m} min left` : `${s}s left`;
}

/**
 * Persistent, never dismissible. Hatched brass edge so it cannot be mistaken
 * for a hotel notice; it says who, why, how long, and whether writes are off.
 */
export function ImpersonationBanner({ v, onEnd, ending }: { v: ImpersonationView; onEnd?: () => void; ending?: boolean }) {
  const now = useNow(1000);
  const ms = Date.parse(v.expiresAt) - now;
  const readOnly = v.mode === "READ_ONLY";
  return (
    <div role="region" aria-label="Support session" data-testid="impersonation-banner" data-mode={v.mode} className="border-b border-black/30 bg-[#1f2d48] text-[#ece3d2] dark:bg-[#141d30]">
      <div aria-hidden className="h-1 bg-[repeating-linear-gradient(135deg,#d6a94a_0_8px,#1f2d48_8px_14px)]" />
      <div className="mx-auto flex max-w-[1400px] flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 sm:px-6 lg:px-8">
        <span className="inline-flex items-center gap-2">
          <Eye size={17} weight="duotone" className="shrink-0 text-[#d6a94a]" />
          <span className="text-[13px]">
            <strong className="font-medium">{v.operatorName}</strong> <span className="text-[#ece3d2]/70">from Devstrike support is viewing as</span>{" "}
            <strong className="font-medium" data-testid="impersonated-as">
              {v.staffName}
            </strong>
            {v.staffRole && <span className="text-[#ece3d2]/70"> ({v.staffRole})</span>}
          </span>
        </span>
        <span className="hidden min-w-0 max-w-[36ch] truncate text-[12.5px] text-[#ece3d2]/70 md:inline" title={v.reason}>
          Reason: <span className="text-[#ece3d2]">{v.reason}</span>
        </span>
        <span className="ml-auto flex items-center gap-2.5">
          <span
            className={cn(
              "inline-flex h-6 items-center gap-1.5 rounded-xs border px-2 font-mono text-[10.5px] uppercase tracking-[0.12em]",
              readOnly ? "border-[#8ea3c9]/50 text-[#c9d5ea]" : "border-[#e26464]/70 bg-[#e26464]/15 text-[#f5b1a1]",
            )}
            data-testid="impersonation-mode"
          >
            {readOnly ? <Eye size={12} /> : <PencilSimpleLine size={12} />}
            {readOnly ? "Read only" : "Can make changes"}
          </span>
          <span className="font-mono text-[12px] tabular-nums text-[#d6a94a]" suppressHydrationWarning>
            {left(ms)}
          </span>
          {onEnd && (
            <button type="button" onClick={onEnd} disabled={ending} className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-[#ece3d2]/25 px-2.5 text-[12px] hover:bg-white/10 disabled:opacity-50">
              <SignOut size={13} /> End session
            </button>
          )}
        </span>
      </div>
    </div>
  );
}

/** Shown when a write is attempted during a read-only support session. */
export function ReadOnlyWriteNotice({ open, onClose, operatorName }: { open: boolean; onClose: () => void; operatorName?: string }) {
  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(onClose, 9000);
    return () => window.clearTimeout(id);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div role="alert" data-testid="readonly-write-blocked" className="fixed inset-x-3 bottom-24 z-[70] mx-auto max-w-md rounded-md border border-[#8ea3c9]/40 bg-[#1f2d48] p-4 text-[#ece3d2] shadow-float animate-[rise_220ms_cubic-bezier(0.22,1,0.36,1)] lg:bottom-6">
      <div className="flex gap-3">
        <WarningOctagon size={20} weight="duotone" className="mt-0.5 shrink-0 text-[#d6a94a]" />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium">Nothing was changed</p>
          <p className="mt-1 text-[13px] leading-snug text-[#ece3d2]/75">
            This support session{operatorName ? `, opened by ${operatorName},` : ""} is read-only. Changes need write access, which support must switch on with a second reason, and it is recorded in your audit log.
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Dismiss" className="self-start text-[#ece3d2]/60 hover:text-[#ece3d2]">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

/* ---------- announcements ---------- */

export type Severity = "INFO" | "SUCCESS" | "WARNING" | "CRITICAL" | "MAINTENANCE";

export interface AnnouncementView {
  id: string;
  title: string;
  body: string;
  severity: Severity;
  linkUrl?: string | null;
  linkLabel?: string | null;
  dismissible?: boolean;
}

const SEV: Record<Severity, { wrap: string; icon: React.ReactNode; tag: string }> = {
  INFO: { wrap: "border-[color-mix(in_oklab,var(--adire)_28%,transparent)] bg-adire-wash text-ink", icon: <Info size={17} weight="duotone" className="text-adire" />, tag: "Notice" },
  SUCCESS: { wrap: "border-[color-mix(in_oklab,var(--palm)_28%,transparent)] bg-palm-wash text-ink", icon: <CheckCircle size={17} weight="duotone" className="text-palm" />, tag: "Good news" },
  MAINTENANCE: { wrap: "border-[color-mix(in_oklab,var(--brass)_35%,transparent)] bg-brass-wash text-ink", icon: <Warning size={17} weight="duotone" className="text-brass" />, tag: "Maintenance" },
  WARNING: { wrap: "border-[color-mix(in_oklab,var(--ochre)_35%,transparent)] bg-ochre-wash text-ink", icon: <Warning size={17} weight="duotone" className="text-ochre" />, tag: "Heads up" },
  CRITICAL: { wrap: "border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-danger-wash text-ink", icon: <WarningOctagon size={17} weight="duotone" className="text-danger" />, tag: "Important" },
};

export function AnnouncementBar({ a, onDismiss, dismissing }: { a: AnnouncementView; onDismiss?: () => void; dismissing?: boolean }) {
  const s = SEV[a.severity] ?? SEV.INFO;
  const [open, setOpen] = useState(false);
  const long = a.body.length > 220 || a.body.includes("\n");
  return (
    <div role="status" data-testid="announcement" data-severity={a.severity} className={cn("border-b", s.wrap)}>
      <div className="mx-auto flex max-w-[1240px] items-start gap-3 px-4 py-2.5 sm:px-6 lg:px-10">
        <span className="mt-0.5 shrink-0">{s.icon}</span>
        <div className="min-w-0 flex-1 text-[13px] leading-snug">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">{s.tag}</span>
            <strong className="font-medium text-ink">{a.title}</strong>
          </p>
          <p className={cn("mt-0.5 whitespace-pre-line text-ink-muted", !open && long && "line-clamp-1")}>{a.body}</p>
          {(long || a.linkUrl) && (
            <p className="mt-1 flex gap-4 text-[12.5px]">
              {long && (
                <button type="button" onClick={() => setOpen((o) => !o)} className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                  {open ? "Less" : "Read all"}
                </button>
              )}
              {a.linkUrl && (
                <a href={a.linkUrl} target="_blank" rel="noreferrer" className="font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                  {a.linkLabel || "Learn more"}
                </a>
              )}
            </p>
          )}
        </div>
        {a.dismissible !== false && onDismiss && (
          <button type="button" aria-label={`Dismiss: ${a.title}`} onClick={onDismiss} disabled={dismissing} className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-ink-muted hover:bg-black/5 hover:text-ink" data-testid="dismiss-announcement">
            <X size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
