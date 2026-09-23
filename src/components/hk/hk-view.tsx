"use client";

import { useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { AirplaneLanding, ArrowLeft, CaretDown, Check, CheckCircle, CloudArrowUp, MoonStars, Play, Timer, Wrench } from "@phosphor-icons/react";
import { useMyTasks, qk4 } from "@/lib/api/hooks-m4";
import type { HousekeepingTask, MyTasks } from "@/lib/api/types-m4";
import { useEntitlements, useLogout } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import { deskAction } from "@/lib/offline/desk-action";
import { useNetwork } from "@/lib/offline/network";
import { isApiError } from "@/lib/api/client";
import { toast } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { formatDuration } from "@/lib/dates";
import { firstName, formatTime, lagosLongDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/brand";
import { OutboxChip } from "@/components/offline/offline";
import { ThemeToggle } from "@/components/shell/theme-toggle";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/primitives";
import { HK_TYPE } from "@/components/housekeeping/model";
import { IssueDialog } from "@/components/housekeeping/task-sheet";

type Act = "start" | "finish" | "skip" | "tick";

/**
 * The housekeeper's phone: my rooms in order, one tap to start, big checklist
 * ticks, one tap to finish. Every action carries an Idempotency-Key and goes
 * through the outbox, so a lost signal on the third floor loses nothing.
 */
export function HkView() {
  const { me, has } = useEntitlements();
  const { can } = useCan();
  const q = useMyTasks();
  const qc = useQueryClient();
  const net = useNetwork();
  const logout = useLogout();
  const [openId, setOpenId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [issueFor, setIssueFor] = useState<HousekeepingTask | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const offlineOk = has("offline_mode");

  const tasks = q.data?.tasks ?? [];
  const active = tasks.find((t) => t.status === "IN_PROGRESS") ?? null;
  const todo = tasks.filter((t) => ["OPEN", "ASSIGNED", "REJECTED"].includes(t.status));
  const done = tasks.filter((t) => ["DONE", "INSPECTED", "SKIPPED"].includes(t.status));
  const total = tasks.length;
  const minutesLeft = q.data?.summary.minutesLeft ?? 0;

  /** Apply a change to the cached list at once; the server's answer (or the outbox) follows. */
  const patchLocal = (id: string, fn: (t: HousekeepingTask) => HousekeepingTask) =>
    qc.setQueryData<MyTasks>(qk4.hkMine, (d) => (d ? { ...d, tasks: d.tasks.map((t) => (t.id === id ? fn(t) : t)) } : d));

  const run = async (t: HousekeepingTask, act: Act, items?: { id: string; done: boolean }[]) => {
    const n = t.room.number;
    const spec =
      act === "start"
        ? { method: "POST" as const, path: `/housekeeping/tasks/${t.id}/start`, body: {}, title: `Start room ${n}` }
        : act === "finish"
          ? { method: "POST" as const, path: `/housekeeping/tasks/${t.id}/finish`, body: { checklist: t.checklist.map((c) => ({ id: c.id, done: c.done })) }, title: `Finish room ${n}` }
          : act === "skip"
            ? { method: "POST" as const, path: `/housekeeping/tasks/${t.id}/skip`, body: { reason: "DND" }, title: `Room ${n}: do not disturb` }
            : { method: "PUT" as const, path: `/housekeeping/tasks/${t.id}/checklist`, body: { items: items ?? [] }, title: `Checklist, room ${n}` };
    const before = qc.getQueryData<MyTasks>(qk4.hkMine);
    // optimistic
    patchLocal(t.id, (x) =>
      act === "start"
        ? { ...x, status: "IN_PROGRESS", startedAt: new Date().toISOString() }
        : act === "finish"
          ? { ...x, status: "DONE", doneAt: new Date().toISOString() }
          : act === "skip"
            ? { ...x, status: "SKIPPED", skippedReason: "DND" }
            : x,
    );
    if (act !== "tick") setBusy(t.id);
    try {
      const r = await deskAction<HousekeepingTask>({
        kind: "housekeeping",
        title: spec.title,
        subtitle: HK_TYPE[t.type].label,
        method: spec.method,
        path: spec.path,
        body: spec.body,
        offlineAllowed: offlineOk,
        invalidate: [["housekeeping"], ["rooms"]],
      });
      if (r.queued) {
        if (act !== "tick") toast.info(`Saved on this phone`, `${spec.title} will send when the signal is back.`);
      } else {
        patchLocal(t.id, () => r.result);
        if (act === "finish") toast.success(r.result.status === "DONE" ? `Room ${n} done` : `Room ${n} is clean`, r.result.status === "DONE" ? "A supervisor will inspect it." : undefined);
        if (act !== "tick") void qc.invalidateQueries({ queryKey: ["housekeeping"] });
      }
      if (act === "finish" || act === "skip") setOpenId(null);
      if (act === "start") setOpenId(t.id);
    } catch (e) {
      if (before) qc.setQueryData(qk4.hkMine, before);
      toast.error(act === "tick" ? "Tick not saved" : "Not saved", isApiError(e) ? e.message : undefined);
    } finally {
      setBusy(null);
    }
  };

  const tick = (t: HousekeepingTask, id: string) => {
    const next = t.checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c));
    patchLocal(t.id, (x) => ({ ...x, checklist: next, checklistDone: next.filter((c) => c.done).length }));
    void run({ ...t, checklist: next }, "tick", [{ id, done: next.find((c) => c.id === id)!.done }]);
  };

  const focus = openId ? tasks.find((t) => t.id === openId) : active;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[520px] flex-col">
      {/* header */}
      <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_oklab,var(--paper)_92%,transparent)] px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-[6px]">
        <div className="flex items-center gap-3">
          {can("housekeeping.assign") || can("reservations.view") ? (
            <Link href="/housekeeping" aria-label="Back to the board" className="grid h-10 w-10 place-items-center rounded-full text-ink-muted hover:bg-surface-2">
              <ArrowLeft size={20} />
            </Link>
          ) : (
            <LogoMark size={26} />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[16px] font-medium text-ink">
              {me ? `Hello, ${firstName(me.user.fullName)}` : " "}
            </p>
            <p className="text-[12.5px] text-ink-muted">{lagosLongDate()}</p>
          </div>
          <OutboxChip />
          <ThemeToggle compact className="hidden min-[380px]:inline-flex" />
        </div>
        {q.data && total > 0 && (
          <div className="mt-3">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-ink">
                <span className="font-mono text-[15px]">{done.length}</span> of <span className="font-mono text-[15px]">{total}</span> rooms
              </span>
              <span className="font-mono text-ink-muted">{minutesLeft ? `${formatDuration(minutesLeft * 60_000)} left` : "all done"}</span>
            </div>
            <div className="mt-1.5 flex h-2 gap-[3px]" aria-hidden>
              {tasks.map((t) => (
                <span
                  key={t.id}
                  className={cn(
                    "h-full flex-1 rounded-[2px]",
                    ["DONE", "INSPECTED"].includes(t.status) ? "bg-palm" : t.status === "SKIPPED" ? "bg-line-strong" : t.status === "IN_PROGRESS" ? "bg-brass" : t.priority === "URGENT" ? "bg-laterite/35" : "bg-surface-2",
                  )}
                />
              ))}
            </div>
          </div>
        )}
      </header>

      {!net.online && (
        <p className="flex items-center gap-2 bg-ochre-wash px-4 py-2.5 text-[13px] text-ink">
          <CloudArrowUp size={16} className="text-ochre" />
          {offlineOk ? "No signal. Keep going; everything saves on this phone and sends later." : "No signal. Your plan doesn't include offline mode, so wait for the signal."}
        </p>
      )}

      <main className="flex-1 px-4 pb-40 pt-4">
        {q.isError && !q.data ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : !q.data ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[84px] rounded-lg" />
            ))}
          </div>
        ) : total === 0 ? (
          <EmptyState glyph="frond" title="No rooms for you yet" body="Your supervisor hands rooms out in the morning. Pull down to refresh, or check back in a few minutes." />
        ) : (
          <>
            {focus && !["DONE", "INSPECTED", "SKIPPED"].includes(focus.status) && (
              <Focus
                t={focus}
                onTick={(id) => tick(focus, id)}
                onStart={() => run(focus, "start")}
                onSkip={() => run(focus, "skip")}
                onIssue={can("maintenance.report") && has("maintenance") ? () => setIssueFor(focus) : undefined}
                onClose={focus.status === "IN_PROGRESS" ? undefined : () => setOpenId(null)}
                busy={busy === focus.id}
              />
            )}
            <h2 className="eyebrow mb-2 mt-6 px-1">{todo.length ? "Next" : "Nothing left to start"}</h2>
            <ul className="flex flex-col gap-2.5">
              {todo
                .filter((t) => t.id !== focus?.id)
                .map((t) => (
                  <li key={t.id}>
                    <Card t={t} onOpen={() => setOpenId(t.id)} onStart={() => run(t, "start")} busy={busy === t.id} blocked={!!active} />
                  </li>
                ))}
            </ul>
            {done.length > 0 && (
              <section className="mt-6">
                <button type="button" onClick={() => setShowDone((s) => !s)} className="flex w-full items-center justify-between px-1 py-2" aria-expanded={showDone}>
                  <span className="eyebrow">Done today &middot; {done.length}</span>
                  <CaretDown size={14} className={cn("text-ink-muted transition-transform", showDone && "rotate-180")} />
                </button>
                {showDone && (
                  <ul className="flex flex-col gap-1.5">
                    {done.map((t) => (
                      <li key={t.id} className="flex items-center gap-3 rounded-md border border-line bg-surface/60 px-4 py-3">
                        <span className="font-mono text-[20px] text-ink-muted">{t.room.number}</span>
                        <span className="flex-1 text-[13px] text-ink-muted">{HK_TYPE[t.type].label}</span>
                        <span className={cn("text-[12.5px]", t.status === "INSPECTED" ? "text-palm" : t.status === "SKIPPED" ? "text-ink-faint" : "text-adire")}>
                          {t.status === "INSPECTED" ? "Passed" : t.status === "SKIPPED" ? "Do not disturb" : "Waiting for inspection"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </>
        )}
      </main>

      {/* the thumb bar: finish the room you're in */}
      {active && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-[color-mix(in_oklab,var(--surface)_96%,transparent)] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-3 backdrop-blur-[6px]">
          <div className="mx-auto max-w-[488px]">
            <FinishBar t={active} onFinish={() => run(active, "finish")} busy={busy === active.id} />
          </div>
        </div>
      )}
      {!active && (
        <div className="px-4 pb-6 text-center">
          <button type="button" onClick={() => void logout()} className="text-[12.5px] text-ink-faint underline-offset-4 hover:underline">
            Sign out
          </button>
        </div>
      )}
      {issueFor && <IssueDialog open onOpenChange={(o) => !o && setIssueFor(null)} task={issueFor} />}
    </div>
  );
}

function Card({ t, onOpen, onStart, busy, blocked }: { t: HousekeepingTask; onOpen: () => void; onStart: () => void; busy: boolean; blocked: boolean }) {
  const urgent = t.priority === "URGENT";
  return (
    <div
      className={cn(
        "flex min-h-[84px] items-center gap-3 overflow-hidden rounded-lg border bg-surface pl-4 pr-3",
        urgent ? "border-[color-mix(in_oklab,var(--laterite)_45%,transparent)] shadow-[inset_4px_0_0_var(--laterite)]" : t.status === "REJECTED" ? "border-[color-mix(in_oklab,var(--danger)_35%,transparent)] shadow-[inset_4px_0_0_var(--danger)]" : "border-line",
      )}
      data-testid={`hk-card-${t.room.number}`}
    >
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-4 py-3 text-left">
        <span className="font-mono text-[30px] leading-none text-ink">{t.room.number}</span>
        <span className="min-w-0">
          <span className="block text-[14.5px] text-ink">{HK_TYPE[t.type].label}</span>
          {urgent && t.arrivalToday ? (
            <span className="flex items-center gap-1 text-[12.5px] text-laterite">
              <AirplaneLanding size={13} weight="bold" /> Guest arrives {formatTime(t.arrivalToday.arrivalAt)}
            </span>
          ) : t.status === "REJECTED" ? (
            <span className="block truncate text-[12.5px] text-danger">Sent back: {t.inspectionNote}</span>
          ) : (
            <span className="block text-[12.5px] text-ink-muted">
              Floor {t.room.floor} &middot; about {t.estimatedMinutes} min
            </span>
          )}
        </span>
      </button>
      <button
        type="button"
        onClick={onStart}
        disabled={busy || blocked}
        aria-label={`Start room ${t.room.number}`}
        title={blocked ? "Finish the room you're in first" : undefined}
        className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-2 text-ink transition-[transform,background-color] active:scale-95 enabled:hover:border-laterite enabled:hover:text-laterite disabled:opacity-40"
      >
        <Play size={20} weight="fill" />
      </button>
    </div>
  );
}

function Focus({
  t,
  onTick,
  onStart,
  onSkip,
  onIssue,
  onClose,
  busy,
}: {
  t: HousekeepingTask;
  onTick: (id: string) => void;
  onStart: () => void;
  onSkip: () => void;
  onIssue?: () => void;
  onClose?: () => void;
  busy: boolean;
}) {
  const now = useNow(15_000);
  const working = t.status === "IN_PROGRESS";
  return (
    <section className={cn("overflow-hidden rounded-xl border bg-surface", working ? "border-[color-mix(in_oklab,var(--brass)_50%,transparent)]" : "border-line-strong")} aria-label={`Room ${t.room.number}`}>
      <div className="flex items-start gap-4 px-5 pb-4 pt-5">
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{working ? "You're in" : "Room"}</p>
          <p className="font-mono text-[56px] leading-none tracking-tight text-ink">{t.room.number}</p>
          <p className="mt-2 text-[15px] text-ink">
            {HK_TYPE[t.type].label} <span className="text-ink-muted">&middot; {t.room.roomType.name}</span>
          </p>
        </div>
        {working && t.startedAt ? (
          <span className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-brass-wash px-3 py-1.5 font-mono text-[14px] text-brass">
            <Timer size={15} weight="duotone" /> {formatDuration(now - +new Date(t.startedAt))}
          </span>
        ) : onClose ? (
          <button type="button" onClick={onClose} className="text-[13px] text-ink-muted underline-offset-4 hover:underline">
            Close
          </button>
        ) : null}
      </div>
      {t.arrivalToday && (
        <p className="mx-5 mb-4 flex items-center gap-2 rounded-md bg-laterite-wash px-3 py-2.5 text-[14px] text-ink">
          <AirplaneLanding size={17} weight="duotone" className="text-laterite" /> {t.arrivalToday.guestName} arrives at <span className="font-mono">{formatTime(t.arrivalToday.arrivalAt)}</span>
        </p>
      )}
      {t.status === "REJECTED" && t.inspectionNote && (
        <p className="mx-5 mb-4 rounded-md bg-danger-wash px-3 py-2.5 text-[14px] text-ink">
          <span className="font-medium">Fix this:</span> {t.inspectionNote}
        </p>
      )}
      {working ? (
        <ul className="border-t border-line" aria-label="Checklist">
          {t.checklist.map((c) => (
            <li key={c.id} className="border-b border-line last:border-b-0">
              <button
                type="button"
                role="checkbox"
                aria-checked={c.done}
                onClick={() => onTick(c.id)}
                className="flex min-h-[58px] w-full items-center gap-4 px-5 text-left transition-colors active:bg-surface-2"
              >
                <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-md border-2 transition-colors", c.done ? "border-palm bg-palm text-paper" : "border-line-strong")}>
                  {c.done && <Check size={18} weight="bold" />}
                </span>
                <span className={cn("text-[15.5px] leading-snug", c.done ? "text-ink-muted" : "text-ink")}>{c.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col gap-2 px-5 pb-5">
          <button
            type="button"
            onClick={onStart}
            disabled={busy}
            className="flex h-16 w-full items-center justify-center gap-3 rounded-lg bg-laterite text-[18px] font-medium text-laterite-ink transition-transform active:scale-[0.99] disabled:opacity-60"
          >
            <Play size={22} weight="fill" /> Start room {t.room.number}
          </button>
          {t.type === "STAYOVER" && (
            <button type="button" onClick={onSkip} className="flex h-14 w-full items-center justify-center gap-2 rounded-lg border border-line-strong text-[15px] text-ink">
              <MoonStars size={18} weight="duotone" /> Do not disturb sign is up
            </button>
          )}
        </div>
      )}
      {onIssue && (
        <div className="border-t border-line px-5 py-3">
          <button type="button" onClick={onIssue} className="flex h-11 items-center gap-2 text-[14px] text-ink-muted hover:text-ink">
            <Wrench size={17} weight="duotone" /> Something broken? Report it with a photo
          </button>
        </div>
      )}
    </section>
  );
}

function FinishBar({ t, onFinish, busy }: { t: HousekeepingTask; onFinish: () => void; busy: boolean }) {
  const left = t.checklist.filter((c) => !c.done).length;
  return (
    <div className="flex items-center gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-ink-muted">Room {t.room.number}</p>
        <p className={cn("text-[14px]", left ? "text-ochre" : "text-palm")}>{left ? `${left} ${left === 1 ? "item" : "items"} not ticked` : "Checklist complete"}</p>
      </div>
      <button
        type="button"
        onClick={onFinish}
        disabled={busy}
        className="flex h-16 min-w-[58%] items-center justify-center gap-2.5 rounded-lg bg-palm px-5 text-[18px] font-medium text-paper transition-transform active:scale-[0.99] disabled:opacity-60 dark:text-[#0f1a14]"
      >
        <CheckCircle size={22} weight="fill" /> Finish room
      </button>
    </div>
  );
}
