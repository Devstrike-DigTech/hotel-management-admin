"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ChatText, CheckCircle, Pause, Play, Prohibit, Wrench, ArrowCounterClockwise, Lock, UserCircle, Camera, Coins, Flag } from "@phosphor-icons/react";
import { useTicket } from "@/lib/api/hooks-m4";
import { useStaff } from "@/lib/api/hooks";
import { mtApi } from "@/lib/api/endpoints-m4";
import type { TicketEvent, TicketStatus } from "@/lib/api/types-m4";
import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/store";
import { dayKeyOf, formatDay, prettyDates } from "@/lib/dates";
import { formatDateTime, formatPhone, naira, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Select, Textarea } from "@/components/ui/form";
import { Badge, ErrorState, Panel, Skeleton } from "@/components/ui/primitives";
import { KV } from "@/components/m2/bits";
import { CategoryIcon, MT_CATEGORY, MT_PRIORITY, MT_PRIORITY_ORDER, MT_STATUS, SlaClock, isOpenTicket } from "./bits";
import { BlockDialog, useMtRefresh } from "./ticket-form";
import { ResolveDialog } from "./maintenance-view";

export function TicketDetail({ id }: { id: string }) {
  const q = useTicket(id);
  const staff = useStaff();
  const { can } = useCan();
  const refresh = useMtRefresh();
  const [comment, setComment] = useState("");
  const [resolving, setResolving] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const manage = can("maintenance.manage");
  const work = can("maintenance.work") || manage;

  const status = useMutation({
    mutationFn: (s: TicketStatus) => mtApi.status(id, { status: s }),
    onSuccess: async (t) => {
      await refresh();
      toast.success(`${t.number} ${MT_STATUS[t.status].label.toLowerCase()}`);
    },
    meta: { errorTitle: "Status not changed" },
  });
  const patch = useMutation({
    mutationFn: (b: Parameters<typeof mtApi.update>[1]) => mtApi.update(id, b),
    onSuccess: async () => {
      await refresh();
      toast.success("Ticket updated");
    },
    meta: { errorTitle: "Not updated" },
  });
  const say = useMutation({
    mutationFn: () => mtApi.comment(id, comment.trim()),
    onSuccess: async () => {
      setComment("");
      await refresh();
    },
    meta: { errorTitle: "Comment not added" },
  });
  const release = useMutation({
    mutationFn: () => mtApi.releaseBlock(q.data!.block!.id),
    onSuccess: async () => {
      await refresh();
      toast.success(`Room ${q.data?.room?.number} released`, "It needs a clean before it sells.");
    },
    meta: { errorTitle: "Not released" },
  });

  if (q.isError)
    return (
      <Panel>
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </Panel>
    );
  if (!q.data)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-12 w-96" />
        <Skeleton className="h-72" />
      </div>
    );
  const t = q.data;
  const open = isOpenTicket(t.status);
  const blockLive = t.block && !t.block.releasedAt && new Date(t.block.to) > new Date();
  const techs = (staff.data ?? []).filter((s) => s.isActive !== false && ["MAINTENANCE", "MANAGER", "OWNER", "CUSTOM"].includes(s.role));

  return (
    <>
      <Link href="/maintenance" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> Maintenance
      </Link>
      <header className="mb-7 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="eyebrow mb-2 flex items-center gap-2">
            <CategoryIcon category={t.category} size={14} /> {MT_CATEGORY[t.category].label} &middot; <span className="font-mono">{t.number}</span>
          </p>
          <h1 className="display text-[32px] leading-[1.05] text-ink md:text-[40px]">{t.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-[14px] text-ink-muted">
            {t.room ? (
              <>
                Room <span className="font-mono text-ink">{t.room.number}</span> &middot; {t.room.roomType.name}
              </>
            ) : (
              t.area
            )}
            <Badge tone={MT_STATUS[t.status].tone} dot>
              {MT_STATUS[t.status].label}
            </Badge>
            <span className="inline-flex items-center gap-1 text-[12.5px]" style={{ color: MT_PRIORITY[t.priority].tone === "var(--line-strong)" ? "var(--ink-muted)" : MT_PRIORITY[t.priority].tone }}>
              <Flag size={12} weight="fill" /> {MT_PRIORITY[t.priority].label}
            </span>
          </p>
        </div>
        {work && (
          <div className="flex flex-wrap gap-2">
            {open && t.status !== "IN_PROGRESS" && (
              <Button variant="secondary" loading={status.isPending && status.variables === "IN_PROGRESS"} onClick={() => status.mutate("IN_PROGRESS")}>
                <Play size={13} weight="fill" /> Start work
              </Button>
            )}
            {open && t.status !== "ON_HOLD" && (
              <Button variant="ghost" loading={status.isPending && status.variables === "ON_HOLD"} onClick={() => status.mutate("ON_HOLD")}>
                <Pause size={13} weight="fill" /> On hold
              </Button>
            )}
            {open && (
              <Button onClick={() => setResolving(true)}>
                <CheckCircle size={15} weight="duotone" /> Mark fixed
              </Button>
            )}
            {t.status === "RESOLVED" && manage && (
              <Button variant="secondary" onClick={() => status.mutate("CLOSED")}>
                <Lock size={14} /> Close
              </Button>
            )}
            {!open && manage && (
              <Button variant="ghost" onClick={() => status.mutate("OPEN")}>
                <ArrowCounterClockwise size={14} /> Reopen
              </Button>
            )}
          </div>
        )}
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex flex-col gap-6">
          {t.description && (
            <Panel className="px-5 py-4">
              <p className="whitespace-pre-line text-[14.5px] leading-relaxed text-ink">{t.description}</p>
              <p className="mt-3 text-[12px] text-ink-faint">
                Reported by {t.reportedBy?.fullName ?? "someone"} {relativeTime(t.createdAt)}
              </p>
            </Panel>
          )}
          {t.photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {t.photos.map((p) => (
                <a key={p.key} href={p.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="Photo of the fault" className="h-28 w-28 rounded-md border border-line object-cover" />
                </a>
              ))}
            </div>
          )}
          <Panel>
            <header className="border-b border-line px-5 py-3.5">
              <h2 className="display-sm text-[19px] text-ink">What happened</h2>
            </header>
            <ol className="relative px-5 py-5">
              <span className="absolute bottom-8 left-[33px] top-8 w-px bg-line" aria-hidden />
              {[...t.timeline].reverse().map((e) => (
                <TimelineItem key={e.id} e={e} />
              ))}
            </ol>
            {can("maintenance.report") && (
              <form
                className="flex flex-col gap-2 border-t border-line px-5 py-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (comment.trim()) say.mutate();
                }}
              >
                <label htmlFor="tk-comment" className="sr-only">
                  Add a note
                </label>
                <Textarea id="tk-comment" className="min-h-16" value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a note: parts ordered, vendor called, guest moved" />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" variant="secondary" disabled={!comment.trim()} loading={say.isPending}>
                    <ChatText size={14} /> Add note
                  </Button>
                </div>
              </form>
            )}
          </Panel>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <Panel className="p-5">
            <p className="eyebrow mb-3">Service level &middot; {MT_PRIORITY[t.priority].sla}</p>
            <SlaClock dueAt={t.slaDueAt} createdAt={t.createdAt} resolvedAt={t.resolvedAt} size="lg" />
            <p className="mt-3 text-[12px] text-ink-faint">Due {formatDateTime(t.slaDueAt)}</p>
          </Panel>

          {t.room && (
            <Panel className={cn("p-5", blockLive && "border-[color-mix(in_oklab,var(--danger)_35%,transparent)]")}>
              <p className="eyebrow mb-2 flex items-center gap-1.5">
                <Prohibit size={12} weight="bold" /> Out of order
              </p>
              {blockLive && t.block ? (
                <>
                  <p className="text-[14px] text-ink">
                    Room <span className="font-mono">{t.room.number}</span> is not selling until{" "}
                    <span className="font-medium">{formatDay(dayKeyOf(t.block.to), { weekday: "short", day: "numeric", month: "short" })}</span>.
                  </p>
                  <p className="mt-1 text-[12.5px] text-ink-muted">{t.block.reason}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    {manage && (
                      <Button size="sm" variant="secondary" onClick={() => setReleasing(true)}>
                        Release the room now
                      </Button>
                    )}
                    <Link href={`/ledger?room=${t.room.number}`} className="text-[12.5px] font-medium text-laterite hover:underline">
                      See it on the Ledger
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[13px] text-ink-muted">Room {t.room.number} is selling as normal.</p>
                  {manage && open && (
                    <Button size="sm" variant="secondary" className="mt-3" onClick={() => setBlocking(true)}>
                      Take it out of order
                    </Button>
                  )}
                </>
              )}
            </Panel>
          )}

          <Panel className="p-5">
            <p className="eyebrow mb-3">Who&rsquo;s on it</p>
            {manage ? (
              <div className="flex flex-col gap-3">
                <label className="text-[12.5px] text-ink-muted" htmlFor="tk-who">
                  Technician
                </label>
                <Select id="tk-who" value={t.assignee?.id ?? ""} onChange={(e) => patch.mutate({ assigneeId: e.target.value || null })}>
                  <option value="">Nobody yet</option>
                  {techs.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName}
                    </option>
                  ))}
                </Select>
                <label className="text-[12.5px] text-ink-muted" htmlFor="tk-pri">
                  Priority
                </label>
                <Select id="tk-pri" value={t.priority} onChange={(e) => patch.mutate({ priority: e.target.value as typeof t.priority })}>
                  {MT_PRIORITY_ORDER.map((p) => (
                    <option key={p} value={p}>
                      {MT_PRIORITY[p].label}, fix within {MT_PRIORITY[p].sla}
                    </option>
                  ))}
                </Select>
              </div>
            ) : (
              <p className="text-[14px] text-ink">{t.assignee?.fullName ?? "Nobody yet"}</p>
            )}
            {(t.vendorName || t.vendorPhone) && (
              <dl className="mt-3 border-t border-line pt-2">
                <KV k="Vendor" v={t.vendorName ?? "-"} />
                {t.vendorPhone && (
                  <KV
                    k="Phone"
                    v={
                      <a className="font-mono text-laterite hover:underline" href={`tel:${t.vendorPhone}`}>
                        {formatPhone(t.vendorPhone)}
                      </a>
                    }
                  />
                )}
              </dl>
            )}
          </Panel>

          {(t.costKobo != null || t.resolutionNote) && (
            <Panel className="p-5">
              <p className="eyebrow mb-2">The fix</p>
              {t.resolutionNote && <p className="text-[13.5px] text-ink">{t.resolutionNote}</p>}
              {t.costKobo != null && <p className="mt-2 font-mono text-[18px] text-ink">{naira(t.costKobo)}</p>}
            </Panel>
          )}
        </aside>
      </div>

      <ResolveDialog t={resolving ? t : null} onOpenChange={setResolving} />
      {t.room && <BlockDialog open={blocking} onOpenChange={setBlocking} ticketId={t.id} roomId={t.room.id} roomNumber={t.room.number} reason={t.title} />}
      <ConfirmDialog
        open={releasing}
        onOpenChange={setReleasing}
        title={`Release room ${t.room?.number ?? ""}?`}
        body="It becomes dirty and gets a cleaning task; it sells again once housekeeping has turned it."
        confirmLabel="Release room"
        onConfirm={() => release.mutateAsync()}
      />
    </>
  );
}

const EVENT_ICON: Record<TicketEvent["kind"], React.ReactNode> = {
  CREATED: <Wrench size={13} weight="duotone" />,
  STATUS: <Play size={12} weight="fill" />,
  ASSIGNED: <UserCircle size={14} weight="duotone" />,
  COMMENT: <ChatText size={13} weight="duotone" />,
  PHOTO: <Camera size={13} weight="duotone" />,
  BLOCK: <Prohibit size={13} weight="bold" />,
  COST: <Coins size={13} weight="duotone" />,
};

function TimelineItem({ e }: { e: TicketEvent }) {
  const text =
    e.kind === "CREATED"
      ? "Reported"
      : e.kind === "STATUS"
        ? `Moved to ${(MT_STATUS[e.to as TicketStatus]?.label ?? e.to ?? "").toLowerCase()}`
        : e.kind === "ASSIGNED"
          ? e.to
            ? `Assigned to ${e.to}`
            : "Unassigned"
          : e.kind === "BLOCK"
            ? prettyDates(e.to ?? "Room taken out of order")
            : e.kind === "COST"
              ? `Cost ${e.to}`
              : e.kind === "PHOTO"
                ? "Photo added"
                : "Note";
  return (
    <li className="relative flex gap-4 pb-5 last:pb-0">
      <span
        className={cn(
          "relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border bg-surface",
          e.kind === "BLOCK" ? "border-[color-mix(in_oklab,var(--danger)_45%,transparent)] text-danger" : e.to === "RESOLVED" ? "border-palm text-palm" : "border-line-strong text-ink-muted",
        )}
      >
        {e.to === "RESOLVED" ? <CheckCircle size={14} weight="fill" /> : EVENT_ICON[e.kind]}
      </span>
      <div className="min-w-0 flex-1 pt-0.5">
        <p className="text-[13.5px] text-ink">
          {text}
          <span className="ml-2 text-[12px] text-ink-faint">
            {e.by?.fullName ?? "System"} &middot; {relativeTime(e.at)}
          </span>
        </p>
        {e.note && <p className={cn("mt-1 text-[13px] leading-relaxed", e.kind === "COMMENT" ? "rounded-md bg-surface-2/60 px-3 py-2 text-ink" : "text-ink-muted")}>{e.note}</p>}
      </div>
    </li>
  );
}
