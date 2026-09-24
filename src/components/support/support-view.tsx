"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CaretRight, ChatCircleDots, Eye, Lifebuoy, Paperclip, PencilSimpleLine, Plus, X } from "@phosphor-icons/react";
import { useCan } from "@/lib/permissions";
import { useMe } from "@/lib/api/hooks";
import { supportApi } from "@/lib/api/endpoints-m6";
import { qk6, useSupportRequest, useSupportRequests, useSupportSessions } from "@/lib/api/hooks-m6";
import type { Attachment, ImpersonationSession, SlaState, SupportMessage, SupportRequest, SupportRequestDetail, SupportStatus } from "@/lib/api/types-m6";
import { errorMessage } from "@/lib/api/client";
import { formatDateTime, formatTime, initials, relativeTime, titleCase } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Textarea } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, Segmented, Skeleton } from "@/components/ui/primitives";
import { bytes } from "@/components/export/export-view";
import { CATEGORIES, openSupport } from "./new-request";

const STATUS: Record<SupportStatus, { label: string; tone: "adire" | "ochre" | "brass" | "palm" | "neutral" }> = {
  NEW: { label: "Sent", tone: "adire" },
  OPEN: { label: "Open", tone: "adire" },
  WAITING_ON_HOTEL: { label: "Waiting for you", tone: "brass" },
  RESOLVED: { label: "Resolved", tone: "palm" },
  CLOSED: { label: "Closed", tone: "neutral" },
};

export function StatusChip({ s }: { s: SupportStatus }) {
  const x = STATUS[s];
  return (
    <Badge tone={x.tone} dot>
      {x.label}
    </Badge>
  );
}

function SlaNote({ r, now }: { r: SupportRequest; now: number }) {
  if (r.firstRespondedAt) return <span className="text-ink-muted">First reply {relativeTime(r.firstRespondedAt, now)}</span>;
  const tone: Record<SlaState, string> = { ON_TRACK: "text-ink-muted", DUE_SOON: "text-ochre", BREACHED: "text-danger", MET: "text-ink-muted", MISSED: "text-ink-muted" };
  const due = Date.parse(r.firstResponseDueAt);
  return (
    <span className={tone[r.sla]} suppressHydrationWarning>
      {due > now ? `Reply due ${relativeTime(r.firstResponseDueAt, now)}` : `Reply was due ${relativeTime(r.firstResponseDueAt, now)}`}
    </span>
  );
}

type Filter = "open" | "done" | "all";
const FILTER: Record<Filter, SupportStatus[] | null> = { open: ["NEW", "OPEN", "WAITING_ON_HOTEL"], done: ["RESOLVED", "CLOSED"], all: null };

export function SupportView() {
  const { can } = useCan();
  const [tab, setTab] = useState<"requests" | "sessions">("requests");
  const sessions = can("support.sessions.view");
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Lifebuoy size={14} weight="duotone" /> Support
          </>
        }
        title={
          <>
            Ask us <em>anything</em>.
          </>
        }
        description="Requests go straight to our support team with the page you were on and your hotel's details. Replies come here and by email."
        actions={
          (
            <Button onClick={() => openSupport()} data-testid="new-support-request">
              <Plus size={15} weight="bold" /> New request
            </Button>
          )
        }
      />
      {sessions && (
        <Segmented
          className="mb-6"
          label="Show"
          value={tab}
          onChange={setTab}
          options={[
            { value: "requests", label: "Requests" },
            { value: "sessions", label: "Support sessions" },
          ]}
        />
      )}
      {tab === "requests" ? <Requests /> : <Sessions />}
    </>
  );
}

function Requests() {
  const [filter, setFilter] = useState<Filter>("open");
  const [page, setPage] = useState(1);
  // the list API filters by one status; a hotel has few requests, so filter the page here
  const q = useSupportRequests({ page });
  const items = (q.data?.items ?? []).filter((r) => !FILTER[filter] || FILTER[filter]!.includes(r.status));
  const { can } = useCan();
  const now = useNow(60_000);
  const all = can("support.view_all");
  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
        <Segmented
          size="sm"
          label="Filter"
          value={filter}
          onChange={(v) => {
            setFilter(v);
            setPage(1);
          }}
          options={[
            { value: "open", label: "Open" },
            { value: "done", label: "Resolved" },
            { value: "all", label: "All" },
          ]}
        />
        <span className="ml-auto text-[12px] text-ink-muted">{all ? "Everyone's requests at this hotel" : "Your requests"}</span>
      </div>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="m-5 h-40" />
      ) : items.length === 0 ? (
        <EmptyState compact glyph="eye" title={filter === "open" ? "Nothing open" : "No requests"} body="When something is unclear or broken, a request reaches a person, not a bot." />
      ) : (
        <>
          <ul className="divide-y divide-line" data-testid="support-list">
            {items.map((r) => (
              <li key={r.id}>
                <Link href={`/support/${r.id}`} className="grid gap-1.5 px-5 py-3.5 transition-colors hover:bg-surface-2/50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center" data-testid="support-row">
                  <div className="min-w-0">
                    <p className="flex items-center gap-2">
                      {r.unread && <span className="h-2 w-2 shrink-0 rounded-full bg-laterite" aria-label="New reply" />}
                      <span className={cn("truncate text-[14px] text-ink", r.unread && "font-semibold")}>{r.subject}</span>
                    </p>
                    <p className="mt-0.5 flex flex-wrap gap-x-3 text-[12px] text-ink-muted">
                      <span className="font-mono">{r.number}</span>
                      <span>{CATEGORIES.find((c) => c.v === r.category)?.label ?? r.category}</span>
                      {all && <span>{r.openedBy.fullName}</span>}
                      <span suppressHydrationWarning>{relativeTime(r.lastMessageAt, now)}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 text-[12px]">
                    {(r.status === "NEW" || r.status === "OPEN") && <SlaNote r={r} now={now} />}
                    <StatusChip s={r.status} />
                    <CaretRight size={13} className="hidden text-ink-faint sm:block" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
          {q.data.total > q.data.pageSize && (
            <div className="flex items-center justify-between border-t border-line px-5 py-2.5 text-[12.5px] text-ink-muted">
              <span>
                {q.data.total} requests
              </span>
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                  Newer
                </Button>
                <Button size="sm" variant="ghost" disabled={page * q.data.pageSize >= q.data.total} onClick={() => setPage(page + 1)}>
                  Older
                </Button>
              </span>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

function Sessions() {
  const q = useSupportSessions();
  const me = useMe();
  const qc = useQueryClient();
  const now = useNow(30_000);
  const [end, setEnd] = useState<ImpersonationSession | null>(null);
  const owner = me.data?.user.role === "OWNER";
  const stop = useMutation({
    mutationFn: (id: string) => supportApi.endSession(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk6.sessions });
      toast.success("Support session ended", "Their access stopped straight away.");
    },
    meta: { errorTitle: "Not ended" },
  });
  return (
    <Panel className="overflow-hidden">
      <p className="border-b border-line px-5 py-3 text-[12.5px] leading-relaxed text-ink-muted">
        When our team needs to see what you see, they open a time-limited session as one of your staff, with a reason. It is read-only unless they switch on changes with a second reason. Every change is in your audit log.
      </p>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="m-5 h-32" />
      ) : q.data.items.length === 0 ? (
        <EmptyState compact glyph="eye" title="No support sessions" body="Nobody from our team has viewed your hotel." />
      ) : (
        <ul className="divide-y divide-line" data-testid="support-sessions">
          {q.data.items.map((x) => {
            const active = !x.endedAt && Date.parse(x.expiresAt) > now;
            return (
              <li key={x.id} className="grid gap-2 px-5 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[13.5px] text-ink">
                    {x.mode === "WRITE" ? <PencilSimpleLine size={15} className="text-danger" /> : <Eye size={15} className="text-adire" />}
                    <span className="font-medium">{x.platformUser.fullName}</span>
                    <span className="text-ink-muted">as</span>
                    <span>{x.staff.fullName}</span>
                    {active && (
                      <Badge tone="danger" dot>
                        Active now
                      </Badge>
                    )}
                    {x.mode === "WRITE" && <Badge tone="ochre">Made changes possible</Badge>}
                  </p>
                  <p className="mt-0.5 text-[12.5px] text-ink-muted">&ldquo;{x.reason}&rdquo;</p>
                  <p className="mt-0.5 font-mono text-[11.5px] text-ink-faint">
                    {formatDateTime(x.startedAt)} to {x.endedAt ? formatTime(x.endedAt) : formatTime(x.expiresAt)} &middot; {x.requests} requests, {x.writes} changes
                    {x.endedBy === "HOTEL_OWNER" ? " · ended by the owner" : ""}
                  </p>
                </div>
                {active && owner && (
                  <Button size="sm" variant="secondary" onClick={() => setEnd(x)}>
                    <X size={13} /> End it now
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <ConfirmDialog open={!!end} onOpenChange={(o) => !o && setEnd(null)} title="End this support session?" body="Our team loses access at once. They can ask you again if they still need to look." confirmLabel="End session" danger onConfirm={() => (end ? stop.mutateAsync(end.id) : undefined)} />
    </Panel>
  );
}

/* ---------------- thread ---------------- */

export function SupportThread({ id }: { id: string }) {
  const q = useSupportRequest(id);
  const qc = useQueryClient();
  const now = useNow(60_000);
  const [closing, setClosing] = useState(false);
  const setData = (r: Partial<SupportRequestDetail>) => qc.setQueryData(qk6.supportOne(id), (x: SupportRequestDetail | undefined) => (x ? { ...x, ...r } : x));
  const close = useMutation({
    mutationFn: () => supportApi.close(id),
    onSuccess: (r) => {
      setData(r);
      void qc.invalidateQueries({ queryKey: qk6.supportAll });
    },
    meta: { errorTitle: "Not closed" },
  });
  const reopen = useMutation({
    mutationFn: () => supportApi.reopen(id),
    onSuccess: (r) => {
      setData(r);
      void qc.invalidateQueries({ queryKey: qk6.supportAll });
    },
    meta: { errorTitle: "Not reopened" },
  });
  const r = q.data;
  return (
    <>
      <Link href="/support" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> All requests
      </Link>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !r ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="min-w-0">
            <header className="mb-5">
              <p className="eyebrow flex items-center gap-2">
                <span className="font-mono">{r.number}</span> <span className="text-ink-faint">&middot;</span> {CATEGORIES.find((c) => c.v === r.category)?.label}
              </p>
              <h1 className="display mt-2 text-[28px] leading-tight text-ink md:text-[34px]" data-testid="support-title">
                {r.subject}
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-[12.5px]">
                <span data-testid="support-status">
                  <StatusChip s={r.status} />
                </span>
                {(r.status === "NEW" || r.status === "OPEN") && <SlaNote r={r} now={now} />}
              </div>
            </header>
            <ol className="flex flex-col gap-4" data-testid="support-thread">
              {r.messages.filter((m) => !m.internal).map((m) => (
                <Message key={m.id} m={m} />
              ))}
            </ol>
            {r.status !== "CLOSED" ? (
              <Reply id={id} status={r.status} />
            ) : (
              <Panel className="mt-6 flex flex-wrap items-center gap-3 p-4">
                <p className="flex-1 text-[13px] text-ink-muted">This request is closed. Reopen it if the problem is back.</p>
                <Button variant="secondary" onClick={() => reopen.mutate()} loading={reopen.isPending}>
                  Reopen
                </Button>
              </Panel>
            )}
          </div>
          <aside className="flex flex-col gap-4 self-start lg:sticky lg:top-20">
            <Panel className="p-4 text-[12.5px]">
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1.5">
                <dt className="text-ink-muted">Opened</dt>
                <dd className="text-ink">{formatDateTime(r.createdAt)}</dd>
                <dt className="text-ink-muted">By</dt>
                <dd className="truncate text-ink">{r.openedBy.fullName}</dd>
                <dt className="text-ink-muted">Priority</dt>
                <dd className="text-ink">{r.priority.charAt(0) + r.priority.slice(1).toLowerCase()}</dd>
                <dt className="text-ink-muted">Reply within</dt>
                <dd className="text-ink">{r.slaHours} hours</dd>
              </dl>
            </Panel>
            <Panel className="p-4">
              <p className="eyebrow mb-2">Context we received</p>
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 text-[12px]">
                <dt className="text-ink-muted">Page</dt>
                <dd className="truncate font-mono text-ink" title={r.context.pageUrl ?? ""}>
                  {r.context.pageUrl ?? "--"}
                </dd>
                <dt className="text-ink-muted">Property</dt>
                <dd className="truncate text-ink">{r.context.propertyName ?? r.property?.name ?? "--"}</dd>
                <dt className="text-ink-muted">Role</dt>
                <dd className="truncate text-ink">{titleCase((r.context.userRole ?? r.openedBy.role).replace(/_/g, " ").toLowerCase())}</dd>
                <dt className="text-ink-muted">App</dt>
                <dd className="truncate font-mono text-ink">{r.context.appVersion ?? "--"}</dd>
              </dl>
            </Panel>
            {r.status !== "CLOSED" && (
              <Button variant="ghost" className="self-start text-ink-muted" onClick={() => setClosing(true)} data-testid="support-close">
                Close this request
              </Button>
            )}
          </aside>
          <ConfirmDialog open={closing} onOpenChange={setClosing} title="Close this request?" body="Close it when it's sorted. You can reopen it later." confirmLabel="Close request" onConfirm={() => close.mutateAsync()} />
        </div>
      )}
    </>
  );
}

function Message({ m }: { m: SupportMessage }) {
  const ours = m.author.kind === "HOTEL";
  return (
    <li className={cn("flex gap-3", ours && "flex-row-reverse")} data-author={m.author.kind}>
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-full border font-mono text-[11px]", ours ? "border-line-strong bg-surface text-ink" : "border-[#1f2d48] bg-[#1f2d48] text-[#ece3d2] dark:border-[#8ea3c9]/40 dark:bg-[#1d2537]")}>
        {ours ? initials(m.author.fullName) : <Lifebuoy size={15} weight="duotone" />}
      </span>
      <div className={cn("min-w-0 max-w-[82%]", ours && "items-end text-right")}>
        <p className={cn("mb-1 flex items-baseline gap-2 text-[12px]", ours && "justify-end")}>
          <span className="font-medium text-ink">{m.author.fullName}</span>
          {!ours && <span className="text-ink-muted">Support</span>}
          <span className="font-mono text-ink-faint">{formatDateTime(m.createdAt)}</span>
        </p>
        <div className={cn("whitespace-pre-wrap rounded-md border px-4 py-3 text-left text-[13.5px] leading-relaxed text-ink", ours ? "border-line bg-surface" : "border-[color-mix(in_oklab,var(--adire)_22%,transparent)] bg-adire-wash/60")}>{m.body}</div>
        {m.attachments.length > 0 && (
          <ul className={cn("mt-1.5 flex flex-wrap gap-1.5", ours && "justify-end")}>
            {m.attachments.map((a) => (
              <li key={a.key}>
                <a href={a.url} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-line bg-surface px-2 text-[12px] text-ink hover:border-line-strong">
                  <Paperclip size={12} /> {a.name} <span className="text-ink-muted">{bytes(a.size)}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

function Reply({ id, status }: { id: string; status: SupportStatus }) {
  const qc = useQueryClient();
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const up = useMutation({ mutationFn: supportApi.upload, onSuccess: (a) => setFiles((f) => [...f, a]), meta: { errorTitle: "Not attached" } });
  const send = useMutation({
    mutationFn: () => supportApi.reply(id, { body: body.trim(), attachmentKeys: files.map((f) => f.key) }),
    onSuccess: (m) => {
      qc.setQueryData(qk6.supportOne(id), (x: SupportRequestDetail | undefined) => (x ? { ...x, status: x.status === "WAITING_ON_HOTEL" || x.status === "RESOLVED" ? "OPEN" : x.status, messages: [...x.messages, m] } : x));
      void qc.invalidateQueries({ queryKey: qk6.supportOne(id) });
      void qc.invalidateQueries({ queryKey: qk6.supportAll });
      setBody("");
      setFiles([]);
    },
    onError: (e) => setErr(errorMessage(e)),
    meta: { silent: true },
  });
  return (
    <form
      className="mt-6 rounded-md border border-line bg-surface focus-within:border-laterite"
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        if (body.trim()) send.mutate();
      }}
    >
      {status === "WAITING_ON_HOTEL" && (
        <p className="flex items-center gap-2 border-b border-line bg-brass-wash/60 px-4 py-2 text-[12.5px] text-ink">
          <ChatCircleDots size={15} className="text-brass" /> Support is waiting for your answer.
        </p>
      )}
      <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a reply" className="min-h-28 border-0 shadow-none focus:shadow-none" aria-label="Reply" data-testid="support-reply" maxLength={5000} />
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 px-3 pb-2">
          {files.map((f) => (
            <li key={f.key} className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-line bg-surface-2/60 pl-2 pr-1 text-[12px] text-ink">
              <Paperclip size={12} /> {f.name}
              <button type="button" aria-label={`Remove ${f.name}`} className="grid h-5 w-5 place-items-center rounded-xs text-ink-muted hover:text-ink" onClick={() => setFiles(files.filter((x) => x.key !== f.key))}>
                <X size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-center gap-2 border-t border-line px-3 py-2">
        <input ref={ref} type="file" className="sr-only" accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/csv" onChange={(e) => e.target.files?.[0] && up.mutate(e.target.files[0])} />
        <Button size="sm" variant="ghost" onClick={() => ref.current?.click()} loading={up.isPending}>
          <Paperclip size={14} /> Attach
        </Button>
        {err && <span className="text-[12.5px] text-danger">{err}</span>}
        <Button type="submit" size="sm" className="ml-auto" loading={send.isPending} disabled={!body.trim()} data-testid="support-send-reply">
          Send reply
        </Button>
      </div>
    </form>
  );
}
