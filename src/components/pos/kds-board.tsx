"use client";

import { useMemo } from "react";
import { ArrowCounterClockwise, Bed, CheckFat, CookingPot, ForkKnife, HandPalm, Wine } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { ageTone, type KdsStatus, type KdsTicket } from "./model";

const LANES: { status: KdsStatus; label: string; hint: string }[] = [
  { status: "NEW", label: "New", hint: "just in" },
  { status: "PREPARING", label: "On the fire", hint: "cooking" },
  { status: "READY", label: "Ready", hint: "at the pass" },
];

const ACTION: Record<KdsStatus, { label: string; icon: React.ReactNode } | null> = {
  NEW: { label: "Start", icon: <CookingPot size={22} weight="bold" /> },
  PREPARING: { label: "Bump ready", icon: <CheckFat size={22} weight="fill" /> },
  READY: { label: "Served", icon: <HandPalm size={22} weight="bold" /> },
  SERVED: null,
};

const TONE = {
  fine: { band: "var(--palm)", text: "var(--palm)" },
  warn: { band: "var(--ochre)", text: "var(--ochre)" },
  late: { band: "var(--danger)", text: "var(--danger)" },
};

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  // past an hour, minutes and seconds stop being useful at a glance
  if (m >= 60) return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
  return `${m}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * The kitchen display: three lanes, oldest ticket first, each with a running
 * clock that turns ochre at the warning time and red when late. One large
 * button per ticket moves it on; readable from the pass, two metres away.
 */
export function KdsBoard({
  tickets,
  now,
  onAdvance,
  onRecall,
  busyId,
  warnMin = 10,
  lateMin = 18,
  compact,
}: {
  tickets: KdsTicket[];
  now: number;
  onAdvance: (t: KdsTicket) => void;
  onRecall?: (t: KdsTicket) => void;
  busyId?: string | null;
  warnMin?: number;
  lateMin?: number;
  compact?: boolean;
}) {
  const byLane = useMemo(() => {
    const m: Record<KdsStatus, KdsTicket[]> = { NEW: [], PREPARING: [], READY: [], SERVED: [] };
    for (const t of tickets) m[t.status]?.push(t);
    for (const k of Object.keys(m) as KdsStatus[]) m[k].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return m;
  }, [tickets]);

  return (
    <div className={cn("grid min-h-0 flex-1 gap-3", compact ? "grid-cols-1" : "grid-cols-3")}>
      {LANES.map((lane) => (
        <section key={lane.status} aria-label={lane.label} className="flex min-h-0 flex-col rounded-lg border border-line bg-[color-mix(in_oklab,var(--surface)_70%,var(--paper))]">
          <header className="flex items-baseline justify-between border-b border-line px-4 py-3">
            <h2 className="display-sm text-[22px] text-ink">{lane.label}</h2>
            <span className="font-mono text-[22px] text-ink-muted" aria-label={`${byLane[lane.status].length} tickets`}>
              {byLane[lane.status].length}
            </span>
          </header>
          <ol className="scrollbar-thin flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
            {byLane[lane.status].length === 0 && <li className="px-2 py-10 text-center text-[16px] text-ink-faint">Nothing {lane.hint}.</li>}
            {byLane[lane.status].map((t) => {
              // at the pass the clock counts how long food has been waiting to go out
              const age = now - Date.parse(t.status === "READY" && t.readyAt ? t.readyAt : t.createdAt);
              const tone = t.status === "READY" ? ageTone(age, 4, 8) : ageTone(age, warnMin, lateMin);
              const act = ACTION[t.status];
              const I = t.kind === "ROOM" ? Bed : t.kind === "TAB" ? Wine : ForkKnife;
              return (
                <li key={t.id} data-testid={`kds-${t.id}`} className="shrink-0 overflow-hidden rounded-md border border-line-strong bg-surface animate-[rise_220ms_cubic-bezier(0.22,1,0.36,1)]">
                  <div className="flex items-center gap-3 px-4 py-2.5" style={{ boxShadow: `inset 0 4px 0 ${TONE[tone].band}` }}>
                    <I size={24} weight="duotone" className="shrink-0 text-ink-muted" />
                    <div className="min-w-0 flex-1">
                      <p className="display-sm truncate text-[26px] leading-tight text-ink">{t.label}</p>
                      <p className="truncate font-mono text-[13px] tracking-[0.06em] text-ink-muted" title={t.outletName}>
                        {t.number ?? `KOT ${t.kot}`}
                        {t.server ? ` · ${t.server}` : ` · ${t.outletName}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-[30px] leading-none tracking-tight" style={{ color: TONE[tone].text }} aria-label={`${Math.floor(age / 60000)} minutes`}>
                        {clock(age)}
                      </p>
                      {t.status === "READY" ? (
                        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">at the pass</p>
                      ) : tone === "late" ? (
                        <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em] text-danger">late</p>
                      ) : null}
                    </div>
                  </div>
                  {t.note && <p className="mx-4 mb-1 rounded-sm bg-ochre-wash px-2.5 py-1.5 text-[16px] italic text-ink">{t.note}</p>}
                  <ul className="flex flex-col gap-2 px-4 pb-3 pt-1.5">
                    {t.lines.map((l) => (
                      <li key={l.key} className={cn("flex gap-3", l.voided && "opacity-70")}>
                        <span className={cn("w-9 shrink-0 text-right font-mono text-[24px] leading-tight", l.voided ? "text-danger line-through" : "text-ink")}>{l.qty}</span>
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-[21px] font-medium leading-tight", l.voided ? "text-danger line-through" : "text-ink")}>
                            {l.name}
                            {l.voided && <span className="ml-2 rounded-xs border border-danger px-1 align-middle font-mono text-[12px] no-underline">VOID</span>}
                          </span>
                          {l.modifiers.length > 0 && <span className="mt-0.5 block text-[16px] leading-snug text-ink-muted">{l.modifiers.join(" · ")}</span>}
                          {l.note && <span className="mt-0.5 block text-[16px] italic leading-snug text-ochre">&ldquo;{l.note}&rdquo;</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                  <div className="flex border-t border-line">
                    {act && (
                      <button
                        type="button"
                        onClick={() => onAdvance(t)}
                        disabled={busyId === t.id}
                        data-testid={`kds-advance-${t.id}`}
                        className={cn(
                          "flex h-16 flex-1 items-center justify-center gap-2.5 text-[20px] font-medium transition-colors disabled:opacity-50",
                          t.status === "PREPARING" ? "bg-palm text-surface hover:opacity-90" : t.status === "NEW" ? "bg-surface-2 text-ink hover:bg-line" : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                        )}
                        aria-label={`${act.label}: ${t.label}, ${t.number ?? `KOT ${t.kot}`}`}
                      >
                        {act.icon}
                        {act.label}
                      </button>
                    )}
                    {onRecall && t.status !== "NEW" && (
                      <button
                        type="button"
                        onClick={() => onRecall(t)}
                        aria-label={`Send ${t.label} back a step`}
                        className="grid h-16 w-16 shrink-0 place-items-center border-l border-line text-ink-muted hover:bg-surface-2 hover:text-ink"
                      >
                        <ArrowCounterClockwise size={22} />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </div>
  );
}
