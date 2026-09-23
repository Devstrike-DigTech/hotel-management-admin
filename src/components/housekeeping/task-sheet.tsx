"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AirplaneLanding, CheckCircle, MoonStars, Play, SealCheck, Wrench, XCircle } from "@phosphor-icons/react";
import { hkApi } from "@/lib/api/endpoints-m4";
import type { HousekeepingTask, MaintenanceCategory } from "@/lib/api/types-m4";
import { useCan } from "@/lib/permissions";
import { useEntitlements } from "@/lib/auth";
import { toast } from "@/lib/store";
import { formatTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Sheet, Dialog } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea, Switch } from "@/components/ui/form";
import { Badge } from "@/components/ui/primitives";
import { KV } from "@/components/m2/bits";
import { HK_STATUS, HK_TYPE, type HkPerson } from "./model";
import { MT_CATEGORY, MT_CATEGORY_ORDER } from "@/components/maintenance/bits";

export function useHkRefresh() {
  const qc = useQueryClient();
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ["housekeeping"] }),
      qc.invalidateQueries({ queryKey: ["rooms"] }),
      qc.invalidateQueries({ queryKey: ["dashboard"] }),
      qc.invalidateQueries({ queryKey: ["maintenance"] }),
    ]);
}

/** One task: who, what, the checklist, and the next action for whoever is looking. */
export function TaskSheet({ task, people, onOpenChange }: { task: HousekeepingTask | null; people: HkPerson[]; onOpenChange: (o: boolean) => void }) {
  const { can } = useCan();
  const refresh = useHkRefresh();
  const [failing, setFailing] = useState(false);
  const [note, setNote] = useState("");
  const [issue, setIssue] = useState(false);

  const act = useMutation({
    mutationFn: async (a: { kind: "start" | "finish" | "skip" | "pass" | "fail" | "assign"; assigneeId?: string | null }) => {
      const t = task!;
      if (a.kind === "assign") return hkApi.patch(t.id, { assigneeId: a.assigneeId ?? null });
      if (a.kind === "start") return hkApi.start(t.id);
      if (a.kind === "finish") return hkApi.finish(t.id);
      if (a.kind === "skip") return hkApi.skip(t.id, "DND");
      return hkApi.inspect(t.id, a.kind === "pass" ? "PASS" : "FAIL", note);
    },
    onSuccess: async (t, a) => {
      await refresh();
      const n = t.room.number;
      toast.success(
        a.kind === "pass"
          ? `Room ${n} passed. It's clean and back on sale.`
          : a.kind === "fail"
            ? `Room ${n} sent back`
            : a.kind === "assign"
              ? t.assignee
                ? `Room ${n} to ${t.assignee.fullName}`
                : `Room ${n} unassigned`
              : a.kind === "finish"
                ? t.status === "DONE"
                  ? `Room ${n} done, waiting for inspection`
                  : `Room ${n} is clean`
                : a.kind === "skip"
                  ? `Room ${n} skipped`
                  : `Started room ${n}`,
      );
      if (a.kind === "fail") {
        setFailing(false);
        setNote("");
      }
      if (a.kind !== "assign") onOpenChange(false);
    },
    meta: { errorTitle: "Task not updated" },
  });

  const t = task;
  const open = !!t;
  const canAssign = can("housekeeping.assign");
  const canInspect = can("housekeeping.inspect");
  const canWork = can("housekeeping.work");

  return (
    <>
      <Sheet
        open={open}
        onOpenChange={onOpenChange}
        eyebrow={t ? HK_TYPE[t.type].label : ""}
        title={t ? <span className="font-mono">Room {t.room.number}</span> : ""}
        description={t ? `${t.room.roomType.name} · floor ${t.room.floor}` : undefined}
        width="sm:max-w-[460px]"
        footer={
          t && (
            <div className="flex w-full flex-wrap justify-end gap-2">
              {can("maintenance.report") && (
                <Button variant="ghost" size="sm" className="mr-auto" onClick={() => setIssue(true)}>
                  <Wrench size={14} /> Report a fault
                </Button>
              )}
              {canWork && ["OPEN", "ASSIGNED", "REJECTED"].includes(t.status) && (
                <>
                  {t.type === "STAYOVER" && (
                    <Button variant="secondary" size="sm" loading={act.isPending && act.variables?.kind === "skip"} onClick={() => act.mutate({ kind: "skip" })}>
                      <MoonStars size={14} /> Do not disturb
                    </Button>
                  )}
                  <Button size="sm" loading={act.isPending && act.variables?.kind === "start"} onClick={() => act.mutate({ kind: "start" })}>
                    <Play size={13} weight="fill" /> Start
                  </Button>
                </>
              )}
              {canWork && t.status === "IN_PROGRESS" && (
                <Button size="sm" loading={act.isPending && act.variables?.kind === "finish"} onClick={() => act.mutate({ kind: "finish" })}>
                  <CheckCircle size={14} weight="duotone" /> Finish
                </Button>
              )}
              {canInspect && t.status === "DONE" && (
                <>
                  <Button variant="secondary" size="sm" onClick={() => setFailing(true)}>
                    <XCircle size={14} /> Send back
                  </Button>
                  <Button size="sm" loading={act.isPending && act.variables?.kind === "pass"} onClick={() => act.mutate({ kind: "pass" })}>
                    <SealCheck size={14} weight="duotone" /> Pass inspection
                  </Button>
                </>
              )}
            </div>
          )
        }
      >
        {t && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={HK_STATUS[t.status].tone} dot>
                {HK_STATUS[t.status].label}
              </Badge>
              {t.priority === "URGENT" && <Badge tone="laterite">Urgent</Badge>}
              {t.priority === "HIGH" && <Badge tone="ochre">High</Badge>}
              {t.skippedReason && <Badge tone="adire">{t.skippedReason === "DND" ? "Do not disturb" : t.skippedReason}</Badge>}
            </div>
            {t.arrivalToday && (
              <div className="flex items-start gap-3 rounded-md border border-[color-mix(in_oklab,var(--laterite)_35%,transparent)] bg-laterite-wash/50 px-3.5 py-3">
                <AirplaneLanding size={18} weight="duotone" className="mt-0.5 text-laterite" />
                <p className="text-[13px] text-ink">
                  <span className="font-medium">{t.arrivalToday.guestName}</span> arrives today at <span className="font-mono">{formatTime(t.arrivalToday.arrivalAt)}</span>{" "}
                  <span className="font-mono text-[11.5px] text-ink-muted">{t.arrivalToday.code}</span>
                </p>
              </div>
            )}
            {t.status === "REJECTED" && t.inspectionNote && (
              <p className="rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-wash px-3.5 py-3 text-[13px] text-ink">
                <span className="font-medium">Sent back{t.inspectedBy ? ` by ${t.inspectedBy.fullName}` : ""}:</span> {t.inspectionNote}
              </p>
            )}
            {canAssign ? (
              <Field label="Housekeeper" htmlFor="task-assignee">
                <Select
                  id="task-assignee"
                  value={t.assignee?.id ?? ""}
                  disabled={act.isPending || ["DONE", "INSPECTED", "SKIPPED"].includes(t.status)}
                  onChange={(e) => act.mutate({ kind: "assign", assigneeId: e.target.value || null })}
                >
                  <option value="">Nobody yet</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.fullName}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : (
              <KV k="Housekeeper" v={t.assignee?.fullName ?? "Nobody yet"} />
            )}
            <dl className="divide-y divide-line border-y border-line">
              <KV k="Estimated" v={<span className="font-mono">{t.estimatedMinutes} min</span>} />
              {t.startedAt && <KV k="Started" v={<span className="font-mono">{formatTime(t.startedAt)}</span>} />}
              {t.doneAt && <KV k="Finished" v={<span className="font-mono">{formatTime(t.doneAt)}</span>} />}
              {t.inspectedAt && <KV k="Inspected" v={`${formatTime(t.inspectedAt)} by ${t.inspectedBy?.fullName ?? ""}`} />}
              <KV k="Raised" v={`${relativeTime(t.createdAt)}${t.reservationCode ? ` · ${t.reservationCode}` : ""}`} />
            </dl>
            <section>
              <h3 className="eyebrow mb-2 flex justify-between">
                Checklist
                <span className="font-mono normal-case tracking-normal">
                  {t.checklistDone}/{t.checklistTotal}
                </span>
              </h3>
              <ul className="flex flex-col gap-1">
                {t.checklist.map((c) => (
                  <li key={c.id} className={cn("flex items-center gap-2.5 text-[13px]", c.done ? "text-ink" : "text-ink-muted")}>
                    <span className={cn("grid h-4 w-4 place-items-center rounded-xs border", c.done ? "border-palm bg-palm text-paper" : "border-line-strong")}>
                      {c.done && (
                        <svg viewBox="0 0 12 12" className="h-2.5 w-2.5">
                          <path d="M2 6.5 4.8 9 10 3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      )}
                    </span>
                    {c.label}
                  </li>
                ))}
              </ul>
            </section>
            {t.notes && <KV k="Notes" v={t.notes} />}
            {t.photos.length > 0 && (
              <div className="flex gap-2">
                {t.photos.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={p.key} src={p.url} alt="Photo from the room" className="h-20 w-20 rounded-sm border border-line object-cover" />
                ))}
              </div>
            )}
          </div>
        )}
      </Sheet>
      <Dialog
        open={failing}
        onOpenChange={setFailing}
        eyebrow="Inspection"
        title={`Send room ${t?.room.number ?? ""} back`}
        description="The room stays dirty and goes back to the housekeeper's list with your note."
        footer={
          <>
            <Button variant="secondary" onClick={() => setFailing(false)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={note.trim().length < 3} loading={act.isPending} onClick={() => act.mutate({ kind: "fail" })}>
              Send back
            </Button>
          </>
        }
      >
        <Field label="What needs fixing" htmlFor="insp-note">
          <Textarea id="insp-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Hair in the shower tray; minibar short one water" autoFocus />
        </Field>
      </Dialog>
      {t && <IssueDialog open={issue} onOpenChange={setIssue} task={t} />}
    </>
  );
}

/** Photo of an issue -> maintenance ticket, from the room the housekeeper is in. */
export function IssueDialog({ open, onOpenChange, task, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; task: HousekeepingTask; onDone?: () => void }) {
  const refresh = useHkRefresh();
  const { has } = useEntitlements();
  const { can } = useCan();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<MaintenanceCategory>("PLUMBING");
  const [blocks, setBlocks] = useState(false);
  const [photo, setPhoto] = useState<File | null>(null);
  const m = useMutation({
    mutationFn: async () => {
      let keys: string[] | undefined;
      if (photo) {
        const up = await hkApi.uploadPhoto(task.id, photo);
        keys = up.photos.slice(-1).map((p) => p.key);
      }
      return hkApi.issue(task.id, { title: title.trim(), category, blocksRoom: blocks || undefined, photoKeys: keys });
    },
    onSuccess: async (tk) => {
      await refresh();
      toast.success(`${tk.number} reported`, "Maintenance can see it now.");
      setTitle("");
      setPhoto(null);
      onOpenChange(false);
      onDone?.();
    },
    meta: { errorTitle: "Fault not reported" },
  });
  if (!has("maintenance")) return null;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={`Room ${task.room.number}`}
      title="Report a fault"
      description="It goes straight to maintenance, linked to this room."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={title.trim().length < 3} loading={m.isPending} onClick={() => m.mutate()}>
            Report it
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="What's wrong" htmlFor="issue-title">
          <Input id="issue-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Shower mixer dripping" autoFocus />
        </Field>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Category">
          {MT_CATEGORY_ORDER.map((c) => {
            const I = MT_CATEGORY[c].icon;
            return (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={category === c}
                onClick={() => setCategory(c)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-sm border px-2.5 text-[12.5px]",
                  category === c ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:text-ink",
                )}
              >
                <I size={14} weight="duotone" /> {MT_CATEGORY[c].label}
              </button>
            );
          })}
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-md border border-dashed border-line-strong px-3 py-3 text-[13px] text-ink-muted hover:border-ink-faint">
          <input type="file" accept="image/*" capture="environment" className="sr-only" onChange={(e) => setPhoto(e.target.files?.[0] ?? null)} />
          <span className="grid h-9 w-9 place-items-center rounded-full bg-surface-2">
            <Wrench size={16} />
          </span>
          {photo ? <span className="text-ink">{photo.name}</span> : "Add a photo (optional)"}
        </label>
        {can("maintenance.manage") && <Switch checked={blocks} onChange={setBlocks} label="Take the room out of order" description="Maintenance sets how long when they pick it up." />}
      </div>
    </Dialog>
  );
}

