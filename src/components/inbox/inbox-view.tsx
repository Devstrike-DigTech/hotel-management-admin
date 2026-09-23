"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  ArrowLeft,
  Broom,
  ChatCircleText,
  Check,
  CheckCircle,
  DotsThree,
  Flask,
  HandPalm,
  Lightning,
  MagnifyingGlass,
  SidebarSimple,
  UserCircle,
  UserPlus,
  Wrench,
  X,
} from "@phosphor-icons/react";
import { useCan } from "@/lib/permissions";
import { useMe, useRooms, useStaff } from "@/lib/api/hooks";
import { inboxApi } from "@/lib/api/endpoints-m5";
import { hkApi, mtApi } from "@/lib/api/endpoints-m4";
import { qk5, useConversation, useConversations, useInboxSummary, useQuickReplies } from "@/lib/api/hooks-m5";
import { useWhatsAppTemplates } from "@/lib/api/hooks-m4";
import type { ConversationDetail, ConversationListItem, MessageWire, TaskSuggestion } from "@/lib/api/types-m5";
import type { MaintenanceCategory, TaskPriority } from "@/lib/api/types-m4";
import { usePropertyScope } from "@/components/shell/property-switcher";
import { errorMessage, isApiError } from "@/lib/api/client";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { number } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/overlay";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { EmptyState, ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { ChipRadio } from "@/components/m2/bits";
import { Composer, GuestContext, MessageStream, ThreadList, WindowMeter } from "./parts";
import type { InboxMessage, InboxThread, QuickReply, WaTemplateOption } from "./model";

/* ---------- adapters ---------- */

function threadOf(c: ConversationListItem): InboxThread {
  return {
    id: c.id,
    guestName: c.guest.fullName,
    phone: c.guest.phone,
    guestId: c.guest.id,
    vip: c.guest.vip,
    loyaltyTier: c.guest.loyaltyTier,
    channel: "WHATSAPP",
    status: c.status === "PENDING" ? "SNOOZED" : c.status,
    unread: c.unreadCount,
    lastMessage: c.lastMessage ? { body: c.lastMessage.body, direction: c.lastMessage.direction === "INBOUND" ? "IN" : "OUT", at: c.lastMessage.at } : null,
    windowExpiresAt: c.window.open ? c.window.expiresAt : null,
    assignee: c.assignee,
    reservation: c.reservation
      ? { id: c.reservation.id, code: c.reservation.code, status: c.reservation.status, roomNumber: c.reservation.roomNumber, arrivalAt: `${c.reservation.arrivalDate}T13:00:00Z`, departureAt: `${c.reservation.departureDate}T11:00:00Z` }
      : null,
    waitingSince: c.overdue || c.slaDueAt ? (c.slaDueAt ? new Date(Date.parse(c.slaDueAt) - 15 * 60_000).toISOString() : null) : null,
  };
}

function messageOf(m: MessageWire, suggestions: TaskSuggestion[]): InboxMessage {
  const s = suggestions.find((x) => x.messageId === m.id);
  const kind: InboxMessage["kind"] =
    m.direction === "NOTE" ? "NOTE" : m.direction === "SYSTEM" ? "SYSTEM" : m.template ? "TEMPLATE" : m.direction === "OUTBOUND" && !m.sentBy ? "AUTOMATION" : "TEXT";
  return {
    id: m.id,
    direction: m.direction === "INBOUND" ? "IN" : "OUT",
    kind,
    body: m.body,
    at: m.createdAt,
    status: m.status === "OUTBOX" ? "SENT" : m.status,
    author: m.sentBy,
    templateName: m.template?.name.replace(/_/g, " ") ?? null,
    detected: s && s.status === "PENDING" ? { kind: s.kind, keyword: s.keyword } : null,
    task: s && s.status === "CREATED" ? { id: s.ticketId ?? s.housekeepingTaskId ?? "", kind: s.kind, label: s.kind === "MAINTENANCE" ? "Maintenance ticket" : "Housekeeping task" } : null,
    error: m.error,
  };
}

/** Guest-facing templates; the registry wins when it lists them, these bodies are the fallback. */
const GUEST_TEMPLATES: WaTemplateOption[] = [
  { name: "guest_message", label: "A message from the hotel", body: "Hello {{1}}, this is {{2}}. {{3}} Reply to this message to chat with us.", params: [{ key: "1", label: "Guest's first name" }, { key: "2", label: "Hotel name" }, { key: "3", label: "Your message", example: "Your room is ready early." }] },
  { name: "pre_arrival_confirm", label: "Confirm arrival time", body: "Hello {{1}}, we look forward to welcoming you at {{2}} on {{3}}. Reply 1 to confirm your arrival time.", params: [{ key: "1", label: "Guest's first name" }, { key: "2", label: "Hotel name" }, { key: "3", label: "Arrival date", example: "Friday 2 October" }] },
  { name: "in_stay_welcome", label: "In-stay welcome", body: "Welcome to {{1}}, {{2}}. You are in room {{3}}. Reply to this message with any request and our team will help.", params: [{ key: "1", label: "Hotel name" }, { key: "2", label: "Guest's first name" }, { key: "3", label: "Room number" }] },
];

type Filter = "open" | "unread" | "mine" | "unassigned" | "closed";

export function InboxView() {
  const router = useRouter();
  const sp = useSearchParams();
  const qc = useQueryClient();
  const { can } = useCan();
  const me = useMe();
  const scope = usePropertyScope();
  const now = useNow(15_000);
  const [filter, setFilter] = useState<Filter>("open");
  const [q, setQ] = useState("");
  const activeId = sp.get("c");
  const [showContext, setShowContext] = useState(true);
  const [task, setTask] = useState<{ message: InboxMessage; suggestion: TaskSuggestion | null } | null>(null);
  const [sim, setSim] = useState(false);

  const query = {
    status: filter === "closed" ? "CLOSED" : "OPEN,PENDING",
    unread: filter === "unread" || undefined,
    mine: filter === "mine" || undefined,
    assigneeId: filter === "unassigned" ? "none" : undefined,
    q: q.trim() || undefined,
    pageSize: 50,
  };
  const list = useConversations(query);
  const summary = useInboxSummary();
  const conv = useConversation(activeId);
  const quick = useQuickReplies();
  const tpl = useWhatsAppTemplates(can("settings.manage") || can("guard.view"));
  const threads = useMemo(() => (list.data?.items ?? []).map(threadOf), [list.data]);
  const active = conv.data ?? null;
  const thread = active ? threadOf(active) : (threads.find((t) => t.id === activeId) ?? null);
  const messages = useMemo(() => (active ? active.messages.map((m) => messageOf(m, active.suggestions)) : []), [active]);
  const templates: WaTemplateOption[] = useMemo(() => {
    const reg = tpl.data?.templates ?? [];
    return GUEST_TEMPLATES.map((g) => {
      const r = reg.find((x) => x.name === (g.name as string));
      return r ? { ...g, body: r.body, params: r.params.map((p) => ({ key: String(p.index), label: p.name.replace(/_/g, " "), example: p.example })), status: r.status === "APPROVED" ? "APPROVED" : undefined } : g;
    });
  }, [tpl.data]);
  const quickReplies: QuickReply[] = (quick.data ?? []).map((r) => ({ id: r.id, label: r.title, body: r.body }));
  const canReply = can("inbox.reply");

  const open = (id: string) => {
    const u = new URLSearchParams(sp.toString());
    u.set("c", id);
    router.replace(`/inbox?${u.toString()}`, { scroll: false });
  };
  const close = () => router.replace("/inbox", { scroll: false });

  // opening a conversation marks it read
  useEffect(() => {
    if (!active || !active.unreadCount) return;
    void inboxApi.read(active.id).then(() => {
      void qc.invalidateQueries({ queryKey: ["inbox", "list"] });
      void qc.invalidateQueries({ queryKey: qk5.inboxSummary });
    });
  }, [active, qc]);

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: qk5.conversation(activeId ?? "") }), qc.invalidateQueries({ queryKey: ["inbox", "list"] }), qc.invalidateQueries({ queryKey: qk5.inboxSummary })]);
  const appendMessage = (m: MessageWire) =>
    qc.setQueryData<ConversationDetail>(qk5.conversation(activeId ?? ""), (c) => (c ? { ...c, messages: [...c.messages, m], lastMessage: { direction: m.direction, body: m.body.slice(0, 120), at: m.createdAt } } : c));

  const send = useMutation({
    mutationFn: (body: string) => inboxApi.send(activeId!, { body }),
    onSuccess: (m) => {
      appendMessage(m);
      void refresh();
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "WHATSAPP_WINDOW_CLOSED") {
        toast.warning("The 24-hour window has closed", "WhatsApp only allows an approved template now.");
        void refresh();
      } else toast.error("Not sent", errorMessage(e));
    },
    meta: { silent: true },
  });
  const note = useMutation({ mutationFn: (body: string) => inboxApi.note(activeId!, body), onSuccess: (m) => { appendMessage(m); void refresh(); }, meta: { errorTitle: "Note not added" } });
  const template = useMutation({
    mutationFn: ({ name, params }: { name: string; params: Record<string, string> }) => {
      const t = templates.find((x) => x.name === name);
      return inboxApi.template(activeId!, name, (t?.params ?? []).map((p) => params[p.key] ?? ""));
    },
    onSuccess: (m) => {
      appendMessage(m);
      void refresh();
      toast.success("Template sent", "Their reply opens a new 24-hour window.");
    },
    meta: { errorTitle: "Template not sent" },
  });
  const patch = useMutation({
    mutationFn: (b: { status?: "OPEN" | "PENDING" | "CLOSED"; assigneeId?: string | null }) => inboxApi.patch(activeId!, b),
    onSuccess: (_r, b) => {
      void refresh();
      if (b.status === "CLOSED") toast.success("Conversation closed", "It opens again when the guest writes.");
    },
    meta: { errorTitle: "Not changed" },
  });
  const staff = useStaff();
  const canAssignOthers = can("inbox.manage") && can("staff.manage");

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <ChatCircleText size={14} weight="duotone" /> Guest inbox
          </>
        }
        title={
          <>
            Every guest, <em>one thread</em>.
          </>
        }
        description="WhatsApp messages from guests, matched to their stay. Reply freely within 24 hours of their last message; after that, with an approved template."
        actions={
          <>
            {summary.data && (
              <div className="flex items-center gap-4 text-[12.5px] text-ink-muted">
                <span>
                  <span className="font-mono text-[15px] text-ink">{number(summary.data.unread)}</span> unread
                </span>
                <span className={cn(summary.data.overdue && "text-danger")}>
                  <span className={cn("font-mono text-[15px]", summary.data.overdue ? "text-danger" : "text-ink")}>{number(summary.data.overdue)}</span> past the reply time
                </span>
              </div>
            )}
            {process.env.NODE_ENV !== "production" && (
              <Button variant="ghost" size="sm" onClick={() => setSim(true)} title="Development only">
                <Flask size={15} /> Simulate a guest
              </Button>
            )}
          </>
        }
      />

      <Panel className="flex h-[calc(100dvh-230px)] min-h-[560px] overflow-hidden md:h-[calc(100dvh-250px)]">
        {/* list */}
        <div className={cn("flex w-full shrink-0 flex-col border-line md:w-[330px] md:border-r", activeId && "hidden md:flex")}>
          <div className="border-b border-line p-3">
            <label className="relative flex items-center">
              <MagnifyingGlass size={15} className="pointer-events-none absolute left-2.5 text-ink-muted" />
              <span className="sr-only">Search conversations</span>
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone or booking code" className="h-9 w-full rounded-md border border-line-strong bg-surface pl-8 pr-2 text-[16px] outline-none focus:border-laterite sm:text-[13.5px]" />
            </label>
            <div className="scrollbar-thin mt-2 flex gap-1 overflow-x-auto" role="radiogroup" aria-label="Show">
              {(
                [
                  ["open", "Open", summary.data?.open],
                  ["unread", "Unread", summary.data?.unread],
                  ["mine", "Mine", summary.data?.mine],
                  ["unassigned", "Unassigned", summary.data?.unassigned],
                  ["closed", "Closed", undefined],
                ] as [Filter, string, number | undefined][]
              ).map(([k, label, n]) => (
                <button key={k} role="radio" aria-checked={filter === k} onClick={() => setFilter(k)} className={cn("inline-flex h-7 shrink-0 items-center gap-1 rounded-full border px-2.5 text-[12px] font-medium", filter === k ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:text-ink")}>
                  {label}
                  {n ? <span className={cn("font-mono text-[10.5px]", filter === k ? "text-paper/70" : "text-ink-faint")}>{n}</span> : null}
                </button>
              ))}
            </div>
          </div>
          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            {list.isLoading ? (
              <div className="flex flex-col gap-2 p-3">
                {Array.from({ length: 6 }, (_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : list.isError ? (
              <ErrorState error={list.error} onRetry={() => list.refetch()} />
            ) : threads.length === 0 ? (
              <EmptyState compact glyph="river" title={filter === "open" ? "Nothing waiting" : "No conversations here"} body={filter === "open" ? "When a guest writes to the hotel's WhatsApp number, the message lands here." : undefined} />
            ) : (
              <ThreadList threads={threads} activeId={activeId} onOpen={open} now={now} />
            )}
          </div>
        </div>

        {/* thread */}
        <div className={cn("min-w-0 flex-1 flex-col", activeId ? "flex" : "hidden md:flex")}>
          {!activeId ? (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState glyph="rings" title="Pick a conversation" body="The guest's stay, balance and loyalty tier sit beside the thread, so you can answer without leaving it." />
            </div>
          ) : !thread ? (
            conv.isError ? (
              <ErrorState error={conv.error} onRetry={() => conv.refetch()} />
            ) : (
              <div className="flex flex-col gap-3 p-6">
                <Skeleton className="h-10 w-60" />
                <Skeleton className="h-24" />
                <Skeleton className="h-24" />
              </div>
            )
          ) : (
            <>
              <header className="flex items-center gap-3 border-b border-line px-4 py-3">
                <button type="button" onClick={close} className="grid h-9 w-9 place-items-center rounded-md text-ink-muted hover:bg-surface-2 md:hidden" aria-label="Back to conversations">
                  <ArrowLeft size={17} />
                </button>
                <div className="min-w-0 flex-1">
                  <h2 className="display-sm truncate text-[19px] leading-tight text-ink" data-testid="thread-title">
                    {thread.guestName}
                  </h2>
                  <p className="truncate text-[12px] text-ink-muted">
                    {thread.reservation ? (
                      <>
                        <span className="font-mono">{thread.reservation.code}</span>
                        {thread.reservation.roomNumber ? ` · room ${thread.reservation.roomNumber}` : ""}
                      </>
                    ) : (
                      "No stay linked"
                    )}
                    {thread.assignee ? ` · with ${thread.assignee.fullName}` : " · unassigned"}
                  </p>
                </div>
                {canReply && !thread.assignee && me.data && (
                  <Button size="sm" variant="secondary" onClick={() => patch.mutate({ assigneeId: me.data!.user.id })} className="hidden sm:inline-flex">
                    <HandPalm size={14} /> Take it
                  </Button>
                )}
                <Menu.Root>
                  <Menu.Trigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Conversation actions">
                      <DotsThree size={20} weight="bold" />
                    </Button>
                  </Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Content align="end" sideOffset={4} className="z-50 min-w-56 rounded-md border border-line bg-surface p-1 shadow-float">
                      {me.data && (
                        <MenuItem onSelect={() => patch.mutate({ assigneeId: me.data!.user.id })} icon={<UserCircle size={15} />}>
                          Assign to me
                        </MenuItem>
                      )}
                      {canAssignOthers &&
                        (staff.data ?? [])
                          .filter((s) => s.isActive !== false && s.id !== me.data?.user.id && ["OWNER", "MANAGER", "FRONT_DESK"].includes(s.role))
                          .slice(0, 8)
                          .map((s) => (
                            <MenuItem key={s.id} onSelect={() => patch.mutate({ assigneeId: s.id })} icon={<UserPlus size={15} />}>
                              Assign to {s.fullName}
                            </MenuItem>
                          ))}
                      {thread.assignee && (
                        <MenuItem onSelect={() => patch.mutate({ assigneeId: null })} icon={<X size={15} />}>
                          Unassign
                        </MenuItem>
                      )}
                      <Menu.Separator className="my-1 h-px bg-line" />
                      {thread.status !== "CLOSED" ? (
                        <>
                          <MenuItem onSelect={() => patch.mutate({ status: "PENDING" })} icon={<Check size={15} />}>
                            Waiting for the guest
                          </MenuItem>
                          <MenuItem onSelect={() => patch.mutate({ status: "CLOSED" })} icon={<CheckCircle size={15} />}>
                            Close conversation
                          </MenuItem>
                        </>
                      ) : (
                        <MenuItem onSelect={() => patch.mutate({ status: "OPEN" })} icon={<ChatCircleText size={15} />}>
                          Reopen
                        </MenuItem>
                      )}
                    </Menu.Content>
                  </Menu.Portal>
                </Menu.Root>
                <Button variant="ghost" size="icon" aria-label={showContext ? "Hide guest details" : "Show guest details"} aria-pressed={showContext} onClick={() => setShowContext((v) => !v)} className="hidden lg:inline-flex">
                  <SidebarSimple size={18} className="-scale-x-100" />
                </Button>
              </header>
              <div className="border-b border-line px-4 py-2">
                <WindowMeter expiresAt={thread.windowExpiresAt} now={now} />
              </div>
              {active && active.suggestions.some((s) => s.status === "PENDING") && (
                <div className="flex flex-col gap-2 border-b border-line bg-ochre-wash/40 px-4 py-2.5">
                  {active.suggestions
                    .filter((s) => s.status === "PENDING")
                    .map((s) => (
                      <SuggestionBar key={s.id} s={s} onMake={() => setTask({ message: messages.find((m) => m.id === s.messageId) ?? messages[messages.length - 1], suggestion: s })} convId={active.id} />
                    ))}
                </div>
              )}
              <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto bg-paper/60" data-scroll>
                {!active ? <Skeleton className="m-6 h-32" /> : <MessageStream messages={messages} canMakeTask={canReply} onMakeTask={(m) => setTask({ message: m, suggestion: active.suggestions.find((s) => s.messageId === m.id && s.status === "PENDING") ?? null })} />}
              </div>
              {canReply ? (
                <Composer
                  windowOpen={!!thread.windowExpiresAt}
                  quickReplies={quickReplies}
                  templates={templates}
                  guestName={thread.guestName}
                  hotelName={scope.current?.name}
                  onSend={(b) => send.mutateAsync(b)}
                  onNote={(b) => note.mutateAsync(b)}
                  onTemplate={(name, params) => template.mutateAsync({ name, params })}
                  sending={send.isPending || note.isPending || template.isPending}
                />
              ) : (
                <p className="border-t border-line px-4 py-3 text-[12.5px] text-ink-muted">Your role can read the inbox but not reply.</p>
              )}
            </>
          )}
        </div>

        {/* context */}
        {thread && showContext && (
          <aside className="scrollbar-thin hidden w-[300px] shrink-0 overflow-y-auto border-l border-line bg-surface lg:block" aria-label="Guest and stay">
            <GuestContext
              thread={thread}
              now={now}
              extra={
                active && (
                  <>
                    {active.context.loyalty && (
                      <section className="rounded-md border border-[color-mix(in_oklab,var(--brass)_40%,transparent)] bg-brass-wash/40 px-3.5 py-3">
                        <p className="eyebrow text-[10px]">Loyalty</p>
                        <p className="mt-1 text-[13.5px] text-ink">
                          {active.context.loyalty.tier} &middot; <span className="font-mono">{number(active.context.loyalty.points)}</span> points
                        </p>
                        <p className="font-mono text-[11.5px] text-ink-muted">{active.context.loyalty.memberNo}</p>
                      </section>
                    )}
                    {active.context.balanceKobo != null && active.context.balanceKobo > 0 && <p className="text-[12.5px] text-ochre">Owes {new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(active.context.balanceKobo / 100)} on the folio.</p>}
                  </>
                )
              }
            />
          </aside>
        )}
      </Panel>

      <MakeTaskDialog state={task} thread={thread} onClose={() => setTask(null)} onDone={() => { setTask(null); void refresh(); }} convId={activeId} />
      <SimulateDialog open={sim} onOpenChange={setSim} onSent={(id) => { void qc.invalidateQueries({ queryKey: ["inbox"] }); if (id) open(id); }} />
    </>
  );
}

function MenuItem({ onSelect, icon, children }: { onSelect: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Menu.Item onSelect={onSelect} className="flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2.5 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2">
      {icon}
      {children}
    </Menu.Item>
  );
}

function SuggestionBar({ s, onMake, convId }: { s: TaskSuggestion; onMake: () => void; convId: string }) {
  const qc = useQueryClient();
  const dismiss = useMutation({
    mutationFn: () => inboxApi.dismissSuggestion(s.id),
    onSuccess: () => void qc.invalidateQueries({ queryKey: qk5.conversation(convId) }),
    meta: { errorTitle: "Not dismissed" },
  });
  const I = s.kind === "MAINTENANCE" ? Wrench : Broom;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]" data-testid="task-suggestion">
      <Lightning size={14} weight="fill" className="text-ochre" />
      <span className="min-w-0 flex-1 text-ink">
        Sounds like {s.kind === "MAINTENANCE" ? "a maintenance job" : "a housekeeping request"}
        {s.room ? <> for room <span className="font-mono">{s.room.number}</span></> : null}: <span className="text-ink-muted">&ldquo;{s.summary}&rdquo;</span>
      </span>
      <Button size="sm" onClick={onMake} data-testid="accept-suggestion">
        <I size={14} /> Make the {s.kind === "MAINTENANCE" ? "ticket" : "task"}
      </Button>
      <Button size="sm" variant="ghost" onClick={() => dismiss.mutate()} loading={dismiss.isPending}>
        Not needed
      </Button>
    </div>
  );
}

const MT_CATS: { value: MaintenanceCategory; label: string }[] = [
  { value: "AC_HVAC", label: "AC" },
  { value: "PLUMBING", label: "Plumbing" },
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "APPLIANCE", label: "Appliance" },
  { value: "IT", label: "Wi-Fi / TV" },
  { value: "FURNITURE", label: "Furniture" },
  { value: "OTHER", label: "Other" },
];

/** A housekeeping task or maintenance ticket from a guest's message (from a suggestion, or by hand). */
function MakeTaskDialog({ state, thread, onClose, onDone, convId }: { state: { message: InboxMessage; suggestion: TaskSuggestion | null } | null; thread: InboxThread | null; onClose: () => void; onDone: () => void; convId: string | null }) {
  const rooms = useRooms({});
  const [kind, setKind] = useState<"HOUSEKEEPING" | "MAINTENANCE">("HOUSEKEEPING");
  const [roomId, setRoomId] = useState("");
  const [text, setText] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("HIGH");
  const [cat, setCat] = useState<MaintenanceCategory>("OTHER");
  const [last, setLast] = useState<string | null>(null);
  if (state && state.message.id !== last) {
    setLast(state.message.id);
    const k = state.suggestion?.kind ?? state.message.detected?.kind ?? "HOUSEKEEPING";
    setKind(k);
    setText(state.suggestion?.summary ?? state.message.body.slice(0, 200));
    setCat(state.suggestion?.category ?? "OTHER");
    setPriority("HIGH");
    const num = state.suggestion?.room?.number ?? thread?.reservation?.roomNumber;
    setRoomId(rooms.data?.find((r) => r.number === num)?.id ?? state.suggestion?.room?.id ?? "");
  }
  const make = useMutation({
    mutationFn: async () => {
      if (state?.suggestion) return inboxApi.acceptSuggestion(state.suggestion.id, { roomId: roomId || undefined, priority, note: text });
      if (kind === "HOUSEKEEPING") {
        if (!roomId) throw new Error("Choose the room");
        await hkApi.create({ roomId, type: "CUSTOM", priority, notes: text });
      } else {
        await mtApi.create({ roomId: roomId || undefined, category: cat, priority, title: text.slice(0, 80), description: `From a guest message: "${state?.message.body ?? ""}"` });
      }
      if (convId) await inboxApi.note(convId, `${kind === "HOUSEKEEPING" ? "Housekeeping task" : "Maintenance ticket"} created: ${text.slice(0, 80)}`);
      return null;
    },
    onSuccess: () => {
      toast.success(kind === "HOUSEKEEPING" ? "Housekeeping has it" : "Ticket raised", state?.suggestion && thread?.windowExpiresAt ? "The guest was told you're on it." : undefined);
      onDone();
    },
    meta: { errorTitle: "Not created" },
  });
  return (
    <Dialog
      open={!!state}
      onOpenChange={(o) => !o && onClose()}
      eyebrow="From the guest's message"
      title={kind === "HOUSEKEEPING" ? "A housekeeping task" : "A maintenance ticket"}
      description={state ? <span className="italic">&ldquo;{state.message.body}&rdquo;</span> : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => make.mutate()} loading={make.isPending} data-testid="make-task-confirm">
            {kind === "HOUSEKEEPING" ? "Send to housekeeping" : "Raise the ticket"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {!state?.suggestion && (
          <ChipRadio
            label="Who handles it"
            value={kind}
            onChange={setKind}
            options={[
              { value: "HOUSEKEEPING", label: "Housekeeping" },
              { value: "MAINTENANCE", label: "Maintenance" },
            ]}
          />
        )}
        <Field label="Room" optional={kind === "MAINTENANCE"}>
          <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
            <option value="">{kind === "MAINTENANCE" ? "Not a room (an area)" : "Choose the room"}</option>
            {(rooms.data ?? []).map((r) => (
              <option key={r.id} value={r.id}>
                {r.number} &middot; {r.roomType.name}
              </option>
            ))}
          </Select>
        </Field>
        {kind === "MAINTENANCE" && !state?.suggestion && <ChipRadio label="What kind" value={cat} onChange={setCat} options={MT_CATS} />}
        <Field label="What to do">
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={500} />
        </Field>
        <ChipRadio
          label="Priority"
          value={priority}
          onChange={setPriority}
          options={[
            { value: "NORMAL", label: "Normal" },
            { value: "HIGH", label: "Soon" },
            { value: "URGENT", label: "Now" },
          ]}
        />
      </div>
    </Dialog>
  );
}

/** Development only: run the real inbound pipeline as if WhatsApp had delivered a message. */
function SimulateDialog({ open, onOpenChange, onSent }: { open: boolean; onOpenChange: (o: boolean) => void; onSent: (id: string | null) => void }) {
  const [phone, setPhone] = useState("+2348030000001");
  const [name, setName] = useState("");
  const [body, setBody] = useState("Good evening, please can we get extra towels in the room?");
  const m = useMutation({
    mutationFn: () => inboxApi.devInbound({ phone: phone.trim(), body: body.trim(), name: name.trim() || undefined }),
    onSuccess: (r) => {
      onOpenChange(false);
      if (!r.routed) toast.warning("Not routed", "No hotel with the inbox matched that phone number.");
      onSent(r.conversationId);
    },
    meta: { errorTitle: "Not delivered" },
  });
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Development"
      title="Simulate a guest message"
      description="Runs the real inbound pipeline: routing by phone, the 24-hour window and keyword suggestions."
      footer={
        <Button className="w-full" onClick={() => m.mutate()} loading={m.isPending} disabled={!phone.trim() || !body.trim()}>
          Deliver the message
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Guest phone">
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="font-mono" />
        </Field>
        <Field label="Name" optional hint="Used when the phone belongs to no guest yet">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Message">
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
        </Field>
      </div>
    </Sheet>
  );
}
