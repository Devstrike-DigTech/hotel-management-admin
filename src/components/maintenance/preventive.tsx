"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CaretLeft, CaretRight, Play, Plus } from "@phosphor-icons/react";
import { useScheduleCalendar, useSchedules, qk4 } from "@/lib/api/hooks-m4";
import { mtApi } from "@/lib/api/endpoints-m4";
import { useRooms } from "@/lib/api/hooks";
import type { MaintenanceCategory } from "@/lib/api/types-m4";
import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/store";
import { addDays, dayKeyOf, formatDay, monthName, todayKey, weekday } from "@/lib/dates";
import { relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, Input, Select, Switch } from "@/components/ui/form";
import { EmptyState, ErrorState, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { Stepper } from "@/components/m2/bits";
import { CategoryIcon, MT_CATEGORY, MT_CATEGORY_ORDER } from "./bits";
import { useMtRefresh } from "./ticket-form";

/** Servicing that comes round again: a month calendar of due dates and the schedules behind it. */
export function Preventive() {
  const { can } = useCan();
  const today = todayKey();
  const [month, setMonth] = useState(today.slice(0, 8) + "01");
  const first = month;
  const lead = (weekday(first) + 6) % 7; // weeks start on Monday
  const gridFrom = addDays(first, -lead);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridFrom, i));
  const cal = useScheduleCalendar(days[0], days[41]);
  const list = useSchedules();
  const refresh = useMtRefresh();
  const [creating, setCreating] = useState(false);
  const byDate = useMemo(() => new Map((cal.data ?? []).map((d) => [d.date, d.schedules])), [cal.data]);
  const qc = useQueryClient();
  const run = useMutation({
    mutationFn: mtApi.runSchedules,
    onSuccess: async (r) => {
      await refresh();
      toast.success(r.created ? `${r.created} ${r.created === 1 ? "ticket" : "tickets"} raised` : "Nothing due yet");
    },
    meta: { errorTitle: "Not run" },
  });
  const toggle = useMutation({
    mutationFn: (v: { id: string; active: boolean }) => mtApi.updateSchedule(v.id, { active: v.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["maintenance"] }),
    meta: { errorTitle: "Not saved" },
  });
  const nextMonth = (n: number) => {
    const [y, m] = month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + n, 1));
    setMonth(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`);
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <Panel className="overflow-hidden">
        <header className="flex items-center gap-2 border-b border-line px-5 py-3">
          <h2 className="display-sm text-[19px] text-ink">
            {monthName(first)} <span className="text-ink-muted">{first.slice(0, 4)}</span>
          </h2>
          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => nextMonth(-1)}>
              <CaretLeft size={14} />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setMonth(today.slice(0, 8) + "01")}>
              This month
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => nextMonth(1)}>
              <CaretRight size={14} />
            </Button>
          </div>
        </header>
        <div className="grid grid-cols-7 border-b border-line bg-surface-2/40">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <span key={d} className="eyebrow px-2 py-1.5 text-[9.5px]">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7" role="grid" aria-label="Servicing due by date">
          {days.map((d) => {
            const inMonth = d.slice(0, 7) === first.slice(0, 7);
            const due = byDate.get(d) ?? [];
            return (
              <div
                key={d}
                role="gridcell"
                aria-label={`${formatDay(d, { weekday: "long", day: "numeric", month: "long" })}${due.length ? `: ${due.map((s) => s.title).join(", ")}` : ""}`}
                className={cn("min-h-[88px] border-b border-r border-line p-1.5 [&:nth-child(7n)]:border-r-0", !inMonth && "bg-surface-2/30")}
              >
                <span className={cn("font-mono text-[11.5px]", d === today ? "rounded-xs bg-laterite px-1 text-laterite-ink" : inMonth ? "text-ink-muted" : "text-ink-faint")}>{Number(d.slice(8))}</span>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {due.slice(0, 3).map((s) => (
                    <li key={s.id} className="flex items-center gap-1 truncate rounded-[3px] border border-line bg-surface px-1 py-0.5 text-[10.5px] text-ink" title={`${s.title}${s.roomCount ? `, ${s.roomCount} rooms` : s.area ? `, ${s.area}` : ""}`}>
                      <CategoryIcon category={s.category} size={11} className="shrink-0 text-ink-muted" />
                      <span className="truncate">{s.title}</span>
                    </li>
                  ))}
                  {due.length > 3 && <li className="text-[10px] text-ink-faint">+{due.length - 3} more</li>}
                </ul>
              </div>
            );
          })}
        </div>
        {cal.isFetching && !cal.data && <Skeleton className="h-2" />}
      </Panel>

      <Panel className="self-start">
        <PanelHeader
          eyebrow="Schedules"
          title="Servicing that repeats"
          actions={
            can("maintenance.manage") && (
              <>
                <Button size="sm" variant="ghost" loading={run.isPending} onClick={() => run.mutate()} title="Raise tickets for anything due now">
                  <Play size={12} weight="fill" /> Run
                </Button>
                <Button size="sm" onClick={() => setCreating(true)}>
                  <Plus size={13} weight="bold" /> New
                </Button>
              </>
            )
          }
        />
        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : !list.data ? (
          <div className="p-5">
            <Skeleton className="h-32" />
          </div>
        ) : !list.data.length ? (
          <EmptyState compact glyph="ladder" title="No servicing planned" body="Add AC servicing every 90 days or generator servicing every 10, and tickets raise themselves." />
        ) : (
          <ul className="divide-y divide-line">
            {list.data.map((s) => (
              <li key={s.id} className={cn("flex items-start gap-3 px-5 py-3.5", !s.active && "opacity-60")}>
                <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-ink-muted">
                  <CategoryIcon category={s.category} size={15} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] text-ink">{s.title}</p>
                  <p className="text-[12px] text-ink-muted">
                    Every <span className="font-mono">{s.everyDays}</span> days &middot; {s.rooms.length ? `${s.rooms.length} rooms` : s.area}
                  </p>
                  <p className="text-[12px] text-ink-muted">
                    Next <span className="text-ink">{formatDay(dayKeyOf(s.nextDueAt), { weekday: "short", day: "numeric", month: "short" })}</span>
                    {s.lastRunAt && <> &middot; last {relativeTime(s.lastRunAt)}</>}
                  </p>
                </div>
                {can("maintenance.manage") && <Switch checked={s.active} ariaLabel={`${s.title} active`} onChange={(v) => toggle.mutate({ id: s.id, active: v })} />}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <ScheduleDialog open={creating} onOpenChange={setCreating} onSaved={() => qc.invalidateQueries({ queryKey: qk4.mt })} />
    </div>
  );
}

function ScheduleDialog({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; onSaved: () => void }) {
  const rooms = useRooms();
  const [title, setTitle] = useState("AC servicing");
  const [category, setCategory] = useState<MaintenanceCategory>("AC_HVAC");
  const [every, setEvery] = useState(90);
  const [next, setNext] = useState(addDays(todayKey(), 7));
  const [scope, setScope] = useState<"all" | "area">("all");
  const [area, setArea] = useState("Generator house");
  const [checklist, setChecklist] = useState("Clean filters, Check gas pressure, Clear drain line");
  const m = useMutation({
    mutationFn: () =>
      mtApi.createSchedule({
        title: title.trim(),
        category,
        everyDays: every,
        nextDueAt: next,
        roomIds: scope === "all" ? rooms.data?.map((r) => r.id) : undefined,
        area: scope === "area" ? area.trim() : undefined,
        checklist: checklist.split(",").map((s) => s.trim()).filter(Boolean),
      }),
    onSuccess: (s) => {
      onSaved();
      toast.success(`${s.title} planned`, `First due ${formatDay(dayKeyOf(s.nextDueAt))}.`);
      onOpenChange(false);
    },
    meta: { errorTitle: "Schedule not saved" },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Preventive maintenance"
      title="Plan repeating servicing"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={title.trim().length < 3} loading={m.isPending} onClick={() => m.mutate()}>
            Save schedule
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="What" htmlFor="sc-title">
          <Input id="sc-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kind" htmlFor="sc-cat">
            <Select id="sc-cat" value={category} onChange={(e) => setCategory(e.target.value as MaintenanceCategory)}>
              {MT_CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>
                  {MT_CATEGORY[c].label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Every">
            <Stepper label="days" value={every} onChange={setEvery} min={1} max={730} suffix="days" />
          </Field>
        </div>
        <Field label="First due" htmlFor="sc-next">
          <Input id="sc-next" type="date" value={next} onChange={(e) => e.target.value && setNext(e.target.value)} className="w-[200px] font-mono" />
        </Field>
        <div className="flex gap-2">
          <button type="button" onClick={() => setScope("all")} className={cn("h-8 rounded-full border px-3 text-[12.5px]", scope === "all" ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}>
            Every room ({rooms.data?.length ?? 0})
          </button>
          <button type="button" onClick={() => setScope("area")} className={cn("h-8 rounded-full border px-3 text-[12.5px]", scope === "area" ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}>
            A place
          </button>
        </div>
        {scope === "area" && (
          <Field label="Where" htmlFor="sc-area">
            <Input id="sc-area" value={area} onChange={(e) => setArea(e.target.value)} />
          </Field>
        )}
        <Field label="Checklist" htmlFor="sc-list" hint="Separate items with commas; they go into each ticket.">
          <Input id="sc-list" value={checklist} onChange={(e) => setChecklist(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
