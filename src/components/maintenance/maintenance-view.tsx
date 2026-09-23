"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { CalendarCheck, ChartBar, GasPump, Kanban, ListBullets, MagnifyingGlass, Plus, Prohibit, Wrench } from "@phosphor-icons/react";
import { useFuelSummary, useRoomBlocks, useTickets } from "@/lib/api/hooks-m4";
import { mtApi } from "@/lib/api/endpoints-m4";
import type { MaintenanceTicket, TicketStatus } from "@/lib/api/types-m4";
import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/store";
import { dayKeyOf, formatDay } from "@/lib/dates";
import { nairaCompact, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, Textarea } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, Segmented, Skeleton } from "@/components/ui/primitives";
import { ChipRadio, NairaInput } from "@/components/m2/bits";
import { CategoryIcon, MT_PRIORITY, MT_STATUS, SlaClock, isOpenTicket } from "./bits";
import { TicketDialog, useMtRefresh } from "./ticket-form";
import { Preventive } from "./preventive";
import { Diesel } from "./diesel";
import { MaintenanceReports } from "./reports";

type Tab = "tickets" | "preventive" | "diesel" | "reports";

export function MaintenanceView() {
  const params = useSearchParams();
  const router = useRouter();
  const tab = (params.get("tab") as Tab) || "tickets";
  const setTab = (t: Tab) => router.replace(t === "tickets" ? "/maintenance" : `/maintenance?tab=${t}`, { scroll: false });
  const { can } = useCan();
  const [creating, setCreating] = useState(params.get("new") === "1");
  const open = useTickets({ pageSize: 100 });
  const blocks = useRoomBlocks({ active: true });
  const fuel = useFuelSummary();
  const overdue = (open.data?.items ?? []).filter((t) => t.slaBreached).length;
  const activeBlocks = (blocks.data ?? []).filter((b) => b.active && !b.releasedAt);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Wrench size={14} weight="duotone" /> Maintenance
          </>
        }
        title={
          <>
            Fix it <em>before a guest finds it</em>.
          </>
        }
        description="Faults from the desk, housekeeping and guests in one queue, each with a clock by priority. Rooms out of order stop selling everywhere until they are fixed."
        actions={
          can("maintenance.report") && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={15} weight="bold" /> Report a fault
            </Button>
          )
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-4">
        <Tile label="Open tickets" value={open.data?.total ?? null} sub={open.data ? `${(open.data.items ?? []).filter((t) => t.priority === "URGENT").length} urgent` : ""} />
        <Tile label="Past their SLA" value={open.data ? overdue : null} sub="need attention now" tone={overdue ? "danger" : undefined} onClick={() => setTab("tickets")} />
        <Tile
          label="Rooms out of order"
          value={blocks.data ? activeBlocks.length : null}
          sub={activeBlocks.length ? activeBlocks.map((b) => b.room.number).join(", ") : "every room can sell"}
        />
        <Tile
          label="Diesel this month"
          value={fuel.data ? nairaCompact(fuel.data.costKobo) : null}
          sub={fuel.data ? `${Math.round(fuel.data.litres).toLocaleString("en-NG")} litres, ${fuel.data.litresPerDay} a day` : ""}
          onClick={() => setTab("diesel")}
        />
      </div>

      <Segmented<Tab>
        label="Maintenance view"
        className="mb-4"
        value={tab}
        onChange={setTab}
        options={[
          { value: "tickets", label: "Tickets", icon: <Wrench size={14} weight="duotone" /> },
          { value: "preventive", label: "Preventive", icon: <CalendarCheck size={14} weight="duotone" /> },
          { value: "diesel", label: "Diesel", icon: <GasPump size={14} weight="duotone" /> },
          { value: "reports", label: "Reports", icon: <ChartBar size={14} weight="duotone" /> },
        ]}
      />
      {tab === "tickets" && <Tickets />}
      {tab === "preventive" && <Preventive />}
      {tab === "diesel" && <Diesel />}
      {tab === "reports" && <MaintenanceReports />}
      <TicketDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

function Tile({ label, value, sub, tone, onClick }: { label: string; value: React.ReactNode; sub: string; tone?: "danger"; onClick?: () => void }) {
  const body = (
    <>
      <span className="display-sm text-[13.5px] italic text-ink-muted">{label}</span>
      {value === null ? <Skeleton className="mt-1 h-8 w-14" /> : <span className={cn("font-mono text-[30px] leading-none tracking-tight", tone === "danger" ? "text-danger" : "text-ink")}>{value}</span>}
      <span className="truncate text-[11.5px] text-ink-faint">{sub}</span>
    </>
  );
  const cls = "flex min-w-0 flex-col gap-1.5 bg-surface px-5 py-4 text-left";
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, "hover:bg-surface-2/60")}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

const KANBAN: TicketStatus[] = ["OPEN", "ASSIGNED", "IN_PROGRESS", "ON_HOLD", "RESOLVED"];
const DND = "application/x-ticket";

function Tickets() {
  const { can } = useCan();
  const [layout, setLayout] = useState<"list" | "board">("board");
  const [scope, setScope] = useState<"open" | "overdue" | "all">("open");
  const [q, setQ] = useState("");
  const tickets = useTickets({ status: scope === "all" ? "all" : undefined, overdue: scope === "overdue" || undefined, q: q || undefined, pageSize: 100 });
  const resolved = useTickets({ status: "RESOLVED", pageSize: 12 }, layout === "board");
  const refresh = useMtRefresh();
  const [resolving, setResolving] = useState<MaintenanceTicket | null>(null);
  const [over, setOver] = useState<TicketStatus | null>(null);
  const move = useMutation({
    mutationFn: (v: { t: MaintenanceTicket; status: TicketStatus }) => mtApi.status(v.t.id, { status: v.status }),
    onSuccess: async (t) => {
      await refresh();
      toast.success(`${t.number} ${MT_STATUS[t.status].label.toLowerCase()}`);
    },
    meta: { errorTitle: "Ticket not moved" },
  });
  const canMove = can("maintenance.work") || can("maintenance.manage");

  const items = tickets.data?.items ?? [];
  const boardItems = [...items.filter((t) => t.status !== "RESOLVED" && t.status !== "CLOSED"), ...(resolved.data?.items ?? [])];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <ChipRadio
          label="Which tickets"
          value={scope}
          onChange={setScope}
          options={[
            { value: "open", label: "Open" },
            { value: "overdue", label: "Past SLA" },
            { value: "all", label: "All" },
          ]}
        />
        <div className="relative ml-auto">
          <MagnifyingGlass size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Room, MT number or words"
            aria-label="Search tickets"
            className="h-8 w-56 rounded-sm border border-line-strong bg-surface pl-8 pr-2 text-[13px] text-ink outline-none focus:border-laterite"
          />
        </div>
        <Segmented<"list" | "board">
          label="Layout"
          size="sm"
          value={layout}
          onChange={setLayout}
          options={[
            { value: "board", label: "Board", icon: <Kanban size={13} /> },
            { value: "list", label: "List", icon: <ListBullets size={13} /> },
          ]}
        />
      </div>
      {tickets.isError ? (
        <Panel>
          <ErrorState error={tickets.error} onRetry={() => tickets.refetch()} />
        </Panel>
      ) : !tickets.data ? (
        <Skeleton className="h-80" />
      ) : layout === "list" || scope !== "open" ? (
        <Panel className="overflow-hidden">
          {items.length ? (
            <ul className="divide-y divide-line">
              {items.map((t) => (
                <li key={t.id}>
                  <TicketRow t={t} />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState glyph="cross" title={scope === "overdue" ? "Nothing past its SLA" : "No tickets here"} body="Everything reported is on time." />
          )}
        </Panel>
      ) : (
        <div className="scrollbar-thin -mx-4 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          <div className="grid min-w-[1000px] grid-cols-5 gap-3">
            {KANBAN.map((s) => {
              const col = boardItems.filter((t) => t.status === s);
              return (
                <section
                  key={s}
                  aria-label={MT_STATUS[s].label}
                  onDragOver={(e) => {
                    if (!canMove || !e.dataTransfer.types.includes(DND)) return;
                    e.preventDefault();
                    setOver(s);
                  }}
                  onDragLeave={() => setOver((o) => (o === s ? null : o))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setOver(null);
                    const t = boardItems.find((x) => x.id === e.dataTransfer.getData(DND));
                    if (!t || t.status === s) return;
                    if (s === "RESOLVED") setResolving(t);
                    else move.mutate({ t, status: s });
                  }}
                  className={cn("flex flex-col rounded-lg border bg-paper/60 transition-colors", over === s ? "border-laterite bg-laterite-wash/30" : "border-line")}
                >
                  <header className="flex items-baseline gap-2 border-b border-line px-3 py-2.5">
                    <h3 className="display-sm text-[15px] text-ink">{MT_STATUS[s].label}</h3>
                    <span className="font-mono text-[12px] text-ink-muted">{col.length}</span>
                  </header>
                  <ul className="flex min-h-[160px] flex-col gap-1.5 p-2">
                    {col.map((t) => (
                      <li key={t.id}>
                        <KanbanCard t={t} draggable={canMove} />
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      )}
      <ResolveDialog t={resolving} onOpenChange={(o) => !o && setResolving(null)} />
    </>
  );
}

function KanbanCard({ t, draggable }: { t: MaintenanceTicket; draggable: boolean }) {
  return (
    <Link
      href={`/maintenance/${t.id}`}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData(DND, t.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "flex flex-col gap-1.5 rounded-md border bg-surface px-3 py-2.5 transition-colors hover:border-line-strong",
        draggable && "cursor-grab active:cursor-grabbing",
        t.slaBreached && isOpenTicket(t.status) ? "border-[color-mix(in_oklab,var(--danger)_40%,transparent)]" : "border-line",
      )}
      style={{ boxShadow: `inset 3px 0 0 ${MT_PRIORITY[t.priority].tone}` }}
      data-testid={`ticket-${t.number}`}
    >
      <span className="flex items-center gap-2">
        <CategoryIcon category={t.category} size={14} className="text-ink-muted" />
        <span className="font-mono text-[10.5px] text-ink-faint">{t.number}</span>
        <span className="ml-auto font-mono text-[12px] text-ink">{t.room ? t.room.number : ""}</span>
      </span>
      <span className="line-clamp-2 text-[13px] leading-snug text-ink">{t.title}</span>
      {!t.room && t.area && <span className="text-[11.5px] text-ink-muted">{t.area}</span>}
      {t.block && !t.block.releasedAt && (
        <span className="inline-flex items-center gap-1 text-[11px] text-danger">
          <Prohibit size={11} weight="bold" /> Out of order to {formatDay(dayKeyOf(t.block.to), { day: "numeric", month: "short" })}
        </span>
      )}
      <span className="flex items-center justify-between gap-2">
        {isOpenTicket(t.status) ? <SlaClock dueAt={t.slaDueAt} createdAt={t.createdAt} /> : <span className="text-[11px] text-ink-faint">fixed {relativeTime(t.resolvedAt)}</span>}
        {t.assignee && <span className="truncate text-[11px] text-ink-muted">{t.assignee.fullName.split(" ")[0]}</span>}
      </span>
    </Link>
  );
}

function TicketRow({ t }: { t: MaintenanceTicket }) {
  return (
    <Link href={`/maintenance/${t.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-5 py-3.5 hover:bg-surface-2/40">
      <span className="grid h-9 w-9 place-items-center rounded-full border border-line bg-surface-2 text-ink-muted">
        <CategoryIcon category={t.category} size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] text-ink">{t.title}</p>
        <p className="font-mono text-[11.5px] text-ink-faint">
          {t.number} &middot; {t.room ? `Room ${t.room.number}` : t.area} &middot; {relativeTime(t.createdAt)}
          {t.block && !t.block.releasedAt && <span className="text-danger"> &middot; out of order</span>}
        </p>
      </div>
      <Badge tone={MT_STATUS[t.status].tone} dot>
        {MT_STATUS[t.status].label}
      </Badge>
      <span className="w-[170px] text-right">{isOpenTicket(t.status) ? <SlaClock dueAt={t.slaDueAt} createdAt={t.createdAt} /> : <SlaClock dueAt={t.slaDueAt} createdAt={t.createdAt} resolvedAt={t.resolvedAt} />}</span>
    </Link>
  );
}

export function ResolveDialog({ t, onOpenChange }: { t: MaintenanceTicket | null; onOpenChange: (o: boolean) => void }) {
  const refresh = useMtRefresh();
  const [note, setNote] = useState("");
  const [cost, setCost] = useState<number | null>(null);
  const m = useMutation({
    mutationFn: () => mtApi.status(t!.id, { status: "RESOLVED", resolutionNote: note.trim(), costKobo: cost ?? undefined }),
    onSuccess: async (r) => {
      await refresh();
      toast.success(`${r.number} resolved`, r.room && t?.block ? `Room ${r.room.number} is back, waiting for a clean.` : undefined);
      setNote("");
      setCost(null);
      onOpenChange(false);
    },
    meta: { errorTitle: "Not resolved" },
  });
  return (
    <Dialog
      open={!!t}
      onOpenChange={onOpenChange}
      eyebrow={t?.number}
      title="Mark it fixed"
      description={t?.block && !t.block.releasedAt ? `Room ${t.room?.number} comes back into sale after a clean.` : "Say what was done, so the next person knows."}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={note.trim().length < 3} loading={m.isPending} onClick={() => m.mutate()}>
            Resolve
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="What was done" htmlFor="res-note">
          <Textarea id="res-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Cleared the drain line, replaced the pump" autoFocus />
        </Field>
        <Field label="Cost" htmlFor="res-cost" optional hint="Parts and vendor, for the cost-by-category report.">
          <NairaInput id="res-cost" kobo={cost} onChange={setCost} className="max-w-[220px]" />
        </Field>
      </div>
    </Dialog>
  );
}
