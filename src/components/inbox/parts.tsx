"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowSquareOut,
  Bed,
  Broom,
  CalendarBlank,
  Check,
  Checks,
  ClockCountdown,
  Crown,
  Lightning,
  Lock,
  NotePencil,
  PaperPlaneRight,
  Robot,
  Stack,
  WarningCircle,
  Wrench,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatPhone, formatTime, initials, naira, relativeTime } from "@/lib/format";
import { dayKeyOf, formatDay, todayKey, addDays } from "@/lib/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/primitives";
import {
  fillTemplate,
  windowLabel,
  windowLeft,
  type InboxMessage,
  type InboxThread,
  type QuickReply,
  type WaTemplateOption,
} from "./model";

/* ------------------------------------------------------------------ */
/* Thread list                                                         */
/* ------------------------------------------------------------------ */

export function ThreadList({
  threads,
  activeId,
  onOpen,
  now,
}: {
  threads: InboxThread[];
  activeId: string | null;
  onOpen: (id: string) => void;
  now: number;
}) {
  return (
    <ul className="flex flex-col" aria-label="Conversations">
      {threads.map((t) => {
        const on = t.id === activeId;
        const left = windowLeft(t.windowExpiresAt, now);
        const waitingMin = t.waitingSince ? (now - Date.parse(t.waitingSince)) / 60_000 : 0;
        return (
          <li key={t.id} className="border-b border-line last:border-b-0">
            <button
              type="button"
              onClick={() => onOpen(t.id)}
              aria-current={on ? "true" : undefined}
              className={cn("relative flex w-full gap-3 px-4 py-3 text-left transition-colors", on ? "bg-surface-2" : "hover:bg-surface-2/50")}
              data-testid={`thread-${t.phone}`}
            >
              {on && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r-xs bg-laterite" />}
              <span className={cn("relative grid h-10 w-10 shrink-0 place-items-center rounded-full border font-mono text-[12px]", t.unread ? "border-laterite bg-laterite-wash text-laterite" : "border-line-strong bg-paper text-ink-muted")}>
                {initials(t.guestName)}
                {t.loyaltyTier && (
                  <span className="absolute -bottom-1 -right-1 grid h-4 w-4 place-items-center rounded-full border border-surface bg-brass text-surface" title={t.loyaltyTier}>
                    <Crown size={9} weight="fill" />
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className={cn("truncate text-[14px]", t.unread ? "font-semibold text-ink" : "font-medium text-ink")}>{t.guestName}</span>
                  {t.reservation?.roomNumber && <span className="shrink-0 font-mono text-[11px] text-adire">{t.reservation.roomNumber}</span>}
                  <span className="ml-auto shrink-0 font-mono text-[11px] text-ink-faint" suppressHydrationWarning>
                    {t.lastMessage ? shortAgo(t.lastMessage.at, now) : ""}
                  </span>
                </span>
                <span className={cn("mt-0.5 line-clamp-2 text-[12.5px] leading-snug", t.unread ? "text-ink" : "text-ink-muted")}>
                  {t.lastMessage?.direction === "OUT" && <span className="text-ink-faint">You: </span>}
                  {t.lastMessage?.body ?? "No messages yet"}
                </span>
                <span className="mt-1.5 flex items-center gap-2">
                  {t.unread > 0 && (
                    <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-laterite px-1.5 font-mono text-[10.5px] text-laterite-ink" aria-label={`${t.unread} unread`}>
                      {t.unread}
                    </span>
                  )}
                  {waitingMin >= 15 && (
                    <span className={cn("inline-flex items-center gap-1 font-mono text-[10.5px]", waitingMin >= 30 ? "text-danger" : "text-ochre")}>
                      <ClockCountdown size={11} weight="bold" /> waiting {Math.round(waitingMin)}m
                    </span>
                  )}
                  <WindowDot ms={left} />
                  {t.assignee ? (
                    <span className="ml-auto truncate text-[11px] text-ink-faint">{t.assignee.fullName.split(" ")[0]}</span>
                  ) : (
                    <span className="ml-auto text-[11px] italic text-ink-faint">unassigned</span>
                  )}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function shortAgo(iso: string, now: number) {
  const m = Math.round((now - Date.parse(iso)) / 60_000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  return formatDay(dayKeyOf(iso), { day: "numeric", month: "short" });
}

function WindowDot({ ms }: { ms: number }) {
  const open = ms > 0;
  const low = open && ms < 2 * 3_600_000;
  return (
    <span className={cn("inline-flex items-center gap-1 font-mono text-[10.5px]", !open ? "text-ink-faint" : low ? "text-ochre" : "text-palm")} title={open ? `Free replies for ${windowLabel(ms)}` : "24-hour window closed: templates only"}>
      {open ? <span className={cn("h-1.5 w-1.5 rounded-full", low ? "bg-ochre" : "bg-palm")} /> : <Lock size={10} weight="bold" />}
      {open ? windowLabel(ms) : "template"}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* The 24-hour window                                                  */
/* ------------------------------------------------------------------ */

export function WindowMeter({ expiresAt, now }: { expiresAt: string | null; now: number }) {
  const ms = windowLeft(expiresAt, now);
  const frac = Math.min(1, ms / (24 * 3_600_000));
  const low = ms > 0 && ms < 2 * 3_600_000;
  return (
    <div className="flex items-center gap-3 text-[12px]" data-testid="window-meter">
      <span className={cn("inline-flex items-center gap-1.5 font-medium", ms <= 0 ? "text-ink-muted" : low ? "text-ochre" : "text-palm")}>
        {ms <= 0 ? <Lock size={13} weight="bold" /> : <ClockCountdown size={13} weight="bold" />}
        {ms <= 0 ? "Window closed" : `Free replies for ${windowLabel(ms)}`}
      </span>
      <span className="relative h-1 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
        <span className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-500" style={{ width: `${frac * 100}%`, background: ms <= 0 ? "transparent" : low ? "var(--ochre)" : "var(--palm)" }} />
      </span>
      <span className="text-ink-faint">24h</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Messages                                                            */
/* ------------------------------------------------------------------ */

export function MessageStream({
  messages,
  onMakeTask,
  canMakeTask,
}: {
  messages: InboxMessage[];
  onMakeTask?: (m: InboxMessage) => void;
  canMakeTask?: boolean;
}) {
  const end = useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1]?.id;
  useEffect(() => {
    // scroll the conversation pane, never the page
    const box = end.current?.closest<HTMLElement>("[data-scroll]");
    if (box) box.scrollTop = box.scrollHeight;
  }, [last]);
  const groups = useMemo(() => {
    const out: { day: string; items: InboxMessage[] }[] = [];
    for (const m of messages) {
      const d = dayKeyOf(m.at);
      const g = out[out.length - 1];
      if (g && g.day === d) g.items.push(m);
      else out.push({ day: d, items: [m] });
    }
    return out;
  }, [messages]);
  const today = todayKey();
  return (
    <div className="flex flex-col gap-1 px-4 py-4 sm:px-6">
      {groups.map((g) => (
        <section key={g.day} aria-label={formatDay(g.day)}>
          <div className="my-3 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="display-sm text-[13px] italic text-ink-muted">
              {g.day === today ? "Today" : g.day === addDays(today, -1) ? "Yesterday" : formatDay(g.day, { weekday: "long", day: "numeric", month: "long" })}
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>
          <ol className="flex flex-col gap-2">
            {g.items.map((m) => (
              <li key={m.id}>
                <Bubble m={m} onMakeTask={canMakeTask ? onMakeTask : undefined} />
              </li>
            ))}
          </ol>
        </section>
      ))}
      <div ref={end} />
    </div>
  );
}

function Bubble({ m, onMakeTask }: { m: InboxMessage; onMakeTask?: (m: InboxMessage) => void }) {
  if (m.kind === "SYSTEM")
    return (
      <p className="mx-auto max-w-md py-1 text-center text-[12px] text-ink-faint">
        {m.body} <span className="font-mono">{formatTime(m.at)}</span>
      </p>
    );
  if (m.kind === "NOTE")
    return (
      <div className="mx-auto w-full max-w-[560px] rounded-md border border-dashed border-[color-mix(in_oklab,var(--brass)_55%,transparent)] bg-brass-wash/50 px-3.5 py-2.5">
        <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-brass">
          <NotePencil size={11} weight="bold" /> Note, staff only &middot; {m.author?.fullName ?? ""} &middot; {formatTime(m.at)}
        </p>
        <p className="mt-1 whitespace-pre-wrap text-[13.5px] leading-relaxed text-ink">{m.body}</p>
      </div>
    );
  const out = m.direction === "OUT";
  return (
    <div className={cn("group flex flex-col", out ? "items-end" : "items-start")}>
      <div className={cn("relative max-w-[min(520px,82%)] rounded-md border px-3.5 pb-1.5 pt-2.5", out ? "border-[color-mix(in_oklab,var(--adire)_22%,transparent)] bg-adire-wash/70" : "border-line bg-surface")}>
        {(m.kind === "TEMPLATE" || m.kind === "AUTOMATION") && (
          <p className="mb-1 flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-muted">
            {m.kind === "AUTOMATION" ? <Robot size={11} weight="bold" /> : <Stack size={11} weight="bold" />}
            {m.kind === "AUTOMATION" ? "Automatic" : `Template${m.templateName ? `: ${m.templateName}` : ""}`}
          </p>
        )}
        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-ink">{m.body}</p>
        {m.detected && !m.task && (
          <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-xs bg-ochre-wash px-1.5 py-0.5 text-[11.5px] text-ochre">
            <Lightning size={11} weight="fill" /> sounds like {m.detected.kind === "MAINTENANCE" ? "a maintenance job" : "a housekeeping request"} ({m.detected.keyword})
          </p>
        )}
        {m.task && (
          <Link
            href={m.task.kind === "MAINTENANCE" ? `/maintenance/${m.task.id}` : `/housekeeping`}
            className="mt-1.5 inline-flex items-center gap-1.5 rounded-xs border border-line bg-paper px-1.5 py-0.5 text-[11.5px] text-ink-muted hover:text-ink"
          >
            {m.task.kind === "MAINTENANCE" ? <Wrench size={11} /> : <Broom size={11} />} {m.task.label}
          </Link>
        )}
        <p className={cn("mt-1 flex items-center justify-end gap-1 font-mono text-[10px] text-ink-faint")}>
          {out && m.author && <span className="mr-1 font-sans">{m.author.fullName.split(" ")[0]}</span>}
          {formatTime(m.at)}
          {out && <Tick status={m.status} />}
        </p>
        {m.error && (
          <p className="mt-1 flex items-center gap-1 text-[11.5px] text-danger">
            <WarningCircle size={12} /> {m.error}
          </p>
        )}
      </div>
      {!out && onMakeTask && !m.task && (
        <button
          type="button"
          onClick={() => onMakeTask(m)}
          className={cn(
            "mt-1 inline-flex h-7 items-center gap-1.5 rounded-sm px-1.5 text-[12px] text-ink-muted transition-opacity hover:bg-surface-2 hover:text-ink focus:opacity-100",
            m.detected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
          )}
          data-testid="make-task"
        >
          {m.detected?.kind === "MAINTENANCE" ? <Wrench size={13} /> : <Broom size={13} />} Make a task
        </button>
      )}
    </div>
  );
}

function Tick({ status }: { status?: string | null }) {
  if (status === "FAILED") return <WarningCircle size={12} className="text-danger" aria-label="failed" />;
  if (status === "READ") return <Checks size={12} weight="bold" className="text-adire" aria-label="read" />;
  if (status === "DELIVERED") return <Checks size={12} weight="bold" aria-label="delivered" />;
  if (status === "QUEUED") return <ClockCountdown size={11} aria-label="sending" />;
  return <Check size={12} weight="bold" aria-label="sent" />;
}

/* ------------------------------------------------------------------ */
/* Composer                                                            */
/* ------------------------------------------------------------------ */

export function Composer({
  windowOpen,
  quickReplies,
  templates,
  guestName,
  hotelName,
  onSend,
  onNote,
  onTemplate,
  sending,
  disabled,
}: {
  windowOpen: boolean;
  quickReplies: QuickReply[];
  templates: WaTemplateOption[];
  guestName: string;
  hotelName?: string;
  onSend: (body: string) => Promise<unknown> | void;
  onNote: (body: string) => Promise<unknown> | void;
  onTemplate: (name: string, params: Record<string, string>) => Promise<unknown> | void;
  sending?: boolean;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<"reply" | "note">("reply");
  const [text, setText] = useState("");
  const [tpl, setTpl] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, string>>({});
  const ta = useRef<HTMLTextAreaElement>(null);
  const approved = templates.filter((t) => t.status !== "REJECTED" && t.status !== "PENDING");
  const chosen = approved.find((t) => t.name === tpl) ?? null;
  const templateOnly = mode === "reply" && !windowOpen;

  useEffect(() => {
    if (!chosen) return;
    // prefill what we know: the guest's first name and the hotel's name
    const pre: Record<string, string> = {};
    for (const p of chosen.params) {
      const l = p.label.toLowerCase();
      if (/guest|name/.test(l) && !/hotel/.test(l)) pre[p.key] = guestName.split(" ")[0];
      else if (/hotel|property/.test(l) && hotelName) pre[p.key] = hotelName;
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- prefill once a template is picked
    setParams((cur) => ({ ...pre, ...cur }));
  }, [chosen, guestName, hotelName]);

  const submit = async () => {
    const body = text.trim();
    if (mode === "note") {
      if (!body) return;
      await onNote(body);
      setText("");
      return;
    }
    if (templateOnly || chosen) {
      if (!chosen) return;
      await onTemplate(chosen.name, params);
      setTpl(null);
      setParams({});
      return;
    }
    if (!body) return;
    await onSend(body);
    setText("");
  };

  return (
    <div className="border-t border-line bg-surface">
      <div className="flex items-center gap-1 px-3 pt-2">
        {(["reply", "note"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            aria-pressed={mode === m}
            className={cn("h-8 rounded-sm px-2.5 text-[12.5px] font-medium", mode === m ? (m === "note" ? "bg-brass-wash text-brass" : "bg-surface-2 text-ink") : "text-ink-muted hover:text-ink")}
          >
            {m === "reply" ? "Reply on WhatsApp" : "Note to staff"}
          </button>
        ))}
      </div>

      {mode === "reply" && !chosen && windowOpen && (
        <div className="scrollbar-thin flex gap-1.5 overflow-x-auto px-3 pt-2" aria-label="Quick replies">
          {quickReplies.map((q) => (
            <button
              key={q.id}
              type="button"
              onClick={() => {
                setText((t) => (t ? `${t.trimEnd()}\n${q.body}` : q.body));
                ta.current?.focus();
              }}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-line-strong px-3 text-[12.5px] text-ink-muted hover:border-ink-faint hover:text-ink"
            >
              <Lightning size={12} weight="fill" className="text-brass" /> {q.label}
            </button>
          ))}
        </div>
      )}

      {mode === "reply" && (templateOnly || chosen) ? (
        <div className="px-3 pb-3 pt-2">
          {templateOnly && !chosen && (
            <p className="mb-2 text-[12.5px] text-ink-muted">
              It&rsquo;s been more than 24 hours since {guestName.split(" ")[0]} last wrote, so WhatsApp only allows an approved template. Their reply opens the window again.
            </p>
          )}
          {!chosen ? (
            <ul className="grid gap-2 sm:grid-cols-2">
              {approved.map((t) => (
                <li key={t.name}>
                  <button type="button" onClick={() => setTpl(t.name)} className="flex h-full w-full flex-col gap-1 rounded-md border border-line bg-paper p-3 text-left hover:border-line-strong">
                    <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                      <Stack size={13} className="text-adire" /> {t.label}
                    </span>
                    <span className="line-clamp-2 text-[12px] leading-snug text-ink-muted">{t.body}</span>
                  </button>
                </li>
              ))}
              {approved.length === 0 && <li className="text-[12.5px] text-ink-muted">No approved templates yet. They are managed under Alerts & WhatsApp.</li>}
            </ul>
          ) : (
            <div className="rounded-md border border-line bg-paper p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                  <Stack size={13} className="text-adire" /> {chosen.label}
                </span>
                <button type="button" className="text-[12px] text-ink-muted hover:text-ink" onClick={() => setTpl(null)}>
                  Change
                </button>
              </div>
              {chosen.params.length > 0 && (
                <div className="mb-2 grid gap-2 sm:grid-cols-2">
                  {chosen.params.map((p) => (
                    <label key={p.key} className="flex flex-col gap-1 text-[11.5px] text-ink-muted">
                      {p.label}
                      <input value={params[p.key] ?? ""} placeholder={p.example} onChange={(e) => setParams((x) => ({ ...x, [p.key]: e.target.value }))} className="h-9 rounded-sm border border-line-strong bg-surface px-2 text-[14px] text-ink outline-none focus:border-laterite" />
                    </label>
                  ))}
                </div>
              )}
              <p className="whitespace-pre-wrap rounded-sm bg-adire-wash/60 px-3 py-2 text-[13px] leading-relaxed text-ink">{fillTemplate(chosen.body, params)}</p>
              <div className="mt-2 flex justify-end">
                <Button onClick={submit} loading={sending} disabled={disabled || chosen.params.some((p) => !params[p.key]?.trim())}>
                  <PaperPlaneRight size={15} weight="bold" /> Send template
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <form
          className="flex items-end gap-2 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <textarea
            ref={ta}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            rows={Math.min(6, Math.max(1, text.split("\n").length))}
            placeholder={mode === "note" ? "Only staff see notes" : `Message ${guestName.split(" ")[0]}`}
            aria-label={mode === "note" ? "Note to staff" : "Reply"}
            className={cn(
              "min-h-11 flex-1 resize-none rounded-md border px-3 py-2.5 text-[16px] leading-snug text-ink outline-none sm:text-[14px]",
              mode === "note" ? "border-[color-mix(in_oklab,var(--brass)_45%,transparent)] bg-brass-wash/30 focus:border-brass" : "border-line-strong bg-surface focus:border-laterite",
            )}
            data-testid="composer"
          />
          <Button type="submit" size="lg" className="h-11" loading={sending} disabled={disabled || !text.trim()} variant={mode === "note" ? "secondary" : "primary"} aria-label={mode === "note" ? "Add note" : "Send"}>
            {mode === "note" ? <NotePencil size={16} weight="bold" /> : <PaperPlaneRight size={16} weight="bold" />}
            <span className="hidden sm:inline">{mode === "note" ? "Add note" : "Send"}</span>
          </Button>
        </form>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Context sidebar                                                     */
/* ------------------------------------------------------------------ */

export function GuestContext({ thread, now, extra }: { thread: InboxThread; now: number; extra?: React.ReactNode }) {
  const r = thread.reservation;
  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full border border-line-strong bg-paper font-mono text-[14px] text-ink-muted">{initials(thread.guestName)}</span>
        <div className="min-w-0">
          <p className="display-sm truncate text-[19px] leading-tight text-ink">{thread.guestName}</p>
          <p className="font-mono text-[12px] text-ink-muted">{formatPhone(thread.phone)}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {thread.vip && <Badge tone="brass" icon={<Crown size={11} weight="fill" />}>VIP</Badge>}
        {thread.loyaltyTier && <Badge tone="brass" icon={<Crown size={11} weight="fill" />}>{thread.loyaltyTier}</Badge>}
        <Badge tone="palm">WhatsApp</Badge>
      </div>
      {r ? (
        <section className="rounded-md border border-line bg-paper">
          <header className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
            <span className="eyebrow text-[10px]">Reservation</span>
            <Link href={`/reservations/${r.id}`} className="inline-flex items-center gap-1 font-mono text-[12px] text-laterite hover:underline">
              {r.code} <ArrowSquareOut size={12} />
            </Link>
          </header>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-3.5 py-3 text-[13px]">
            <dt className="text-ink-muted">Status</dt>
            <dd className="text-right text-ink">{r.status.replace(/_/g, " ").toLowerCase()}</dd>
            <dt className="flex items-center gap-1.5 text-ink-muted">
              <Bed size={13} /> Room
            </dt>
            <dd className="text-right text-ink">
              {r.roomNumber ? <span className="font-mono">{r.roomNumber}</span> : <span className="text-ink-faint">not assigned</span>}
              {r.roomType ? <span className="text-ink-muted"> &middot; {r.roomType}</span> : null}
            </dd>
            <dt className="flex items-center gap-1.5 text-ink-muted">
              <CalendarBlank size={13} /> Stay
            </dt>
            <dd className="text-right text-ink">
              {formatDay(dayKeyOf(r.arrivalAt), { day: "numeric", month: "short" })} to {formatDay(dayKeyOf(r.departureAt), { day: "numeric", month: "short" })}
            </dd>
            {r.balanceKobo != null && (
              <>
                <dt className="text-ink-muted">Balance</dt>
                <dd className={cn("text-right font-mono", r.balanceKobo > 0 ? "text-ochre" : "text-palm")}>{r.balanceKobo > 0 ? `owes ${naira(r.balanceKobo)}` : "settled"}</dd>
              </>
            )}
          </dl>
          {r.specialRequests && <p className="border-t border-line px-3.5 py-2.5 text-[12.5px] italic text-ink-muted">&ldquo;{r.specialRequests}&rdquo;</p>}
        </section>
      ) : (
        <p className="rounded-md border border-dashed border-line-strong px-3.5 py-3 text-[12.5px] text-ink-muted">No reservation matched this number. It links itself when the guest books with the same phone.</p>
      )}
      {thread.waitingSince && (
        <p className="text-[12.5px] text-ink-muted" suppressHydrationWarning>
          Waiting for a reply since <span className="font-mono text-ink">{formatTime(thread.waitingSince)}</span> ({relativeTime(thread.waitingSince, now)}).
        </p>
      )}
      {extra}
    </div>
  );
}
