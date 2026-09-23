"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, ArrowCounterClockwise, Plus, X } from "@phosphor-icons/react";
import { useChecklists, useHkSettings, qk4 } from "@/lib/api/hooks-m4";
import { hkApi } from "@/lib/api/endpoints-m4";
import { useRoomTypes } from "@/lib/api/hooks";
import type { Checklist, HkTaskType } from "@/lib/api/types-m4";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/form";
import { ErrorState, Panel, PanelHeader, Segmented, Skeleton } from "@/components/ui/primitives";
import { Stepper } from "@/components/m2/bits";
import { HK_TYPE } from "./model";

const TYPES: HkTaskType[] = ["CHECKOUT_CLEAN", "STAYOVER", "DEEP_CLEAN", "TURNDOWN"];

export function ChecklistSettings() {
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <ChecklistEditor />
      <HkSettingsPanel />
    </div>
  );
}

/** Checklist templates per task type, with an optional version per room type. */
function ChecklistEditor() {
  const lists = useChecklists();
  const types = useRoomTypes();
  const qc = useQueryClient();
  const [taskType, setTaskType] = useState<HkTaskType>("CHECKOUT_CLEAN");
  const [roomTypeId, setRoomTypeId] = useState<string | null>(null);
  const current: Checklist | undefined = useMemo(() => {
    const all = lists.data ?? [];
    return all.find((c) => c.taskType === taskType && c.roomTypeId === roomTypeId) ?? all.find((c) => c.taskType === taskType && c.roomTypeId === null);
  }, [lists.data, taskType, roomTypeId]);
  const inherits = !!current && current.roomTypeId !== roomTypeId;
  const [items, setItems] = useState<{ id?: string; label: string }[] | null>(null);
  const [draftKey, setDraftKey] = useState("");
  const k = `${taskType}|${roomTypeId}|${current?.updatedAt ?? ""}|${current?.id ?? ""}`;
  if (k !== draftKey && current) {
    setDraftKey(k);
    setItems(current.items.map((i) => ({ id: i.id, label: i.label })));
  }
  const [adding, setAdding] = useState("");
  const dirty = !!current && JSON.stringify(items?.map((i) => i.label)) !== JSON.stringify(current.items.map((i) => i.label));

  const save = useMutation({
    mutationFn: () => hkApi.saveChecklist({ roomTypeId, taskType, items: (items ?? []).filter((i) => i.label.trim().length >= 2).map((i) => ({ id: inherits ? undefined : i.id, label: i.label.trim() })) }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk4.hkChecklists });
      toast.success("Checklist saved", "New tasks use it from now on; tasks already raised keep theirs.");
    },
    meta: { errorTitle: "Checklist not saved" },
  });
  const reset = useMutation({
    mutationFn: () => hkApi.resetChecklist(current!.id!),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk4.hkChecklists });
      toast.success("Back to the default checklist");
    },
    meta: { errorTitle: "Not reset" },
  });

  const move = (i: number, d: -1 | 1) =>
    setItems((l) => {
      if (!l) return l;
      const n = [...l];
      const j = i + d;
      if (j < 0 || j >= n.length) return l;
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  return (
    <Panel>
      <PanelHeader eyebrow="Checklists" title="What a clean room means here" description="Housekeepers tick these on their phones; supervisors see anything left unticked." />
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
        <Segmented<HkTaskType> label="Task type" size="sm" value={taskType} onChange={setTaskType} options={TYPES.map((t) => ({ value: t, label: HK_TYPE[t].short }))} />
        <select
          aria-label="Room type"
          value={roomTypeId ?? ""}
          onChange={(e) => setRoomTypeId(e.target.value || null)}
          className="ml-auto h-8 rounded-sm border border-line-strong bg-surface px-2 text-[13px] text-ink outline-none focus:border-laterite"
        >
          <option value="">Every room type</option>
          {types.data?.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </div>
      {lists.isError ? (
        <ErrorState error={lists.error} onRetry={() => lists.refetch()} />
      ) : !items ? (
        <div className="p-5">
          <Skeleton className="h-40" />
        </div>
      ) : (
        <div className="px-5 py-4">
          {inherits && roomTypeId && <p className="mb-3 text-[12.5px] text-ink-muted">This room type uses the general checklist. Change it below to give it its own.</p>}
          {current?.isDefault && !roomTypeId && <p className="mb-3 text-[12.5px] text-ink-muted">The built-in checklist. Edit it to make it yours.</p>}
          <ol className="flex flex-col gap-1">
            {items.map((it, i) => (
              <li key={i} className="group flex items-center gap-2 rounded-sm border border-transparent px-1 py-0.5 hover:border-line hover:bg-surface-2/40">
                <span className="w-5 text-right font-mono text-[11px] text-ink-faint">{i + 1}</span>
                <input
                  value={it.label}
                  aria-label={`Item ${i + 1}`}
                  onChange={(e) => setItems((l) => l!.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))}
                  className="h-8 min-w-0 flex-1 bg-transparent px-1 text-[13.5px] text-ink outline-none focus:border-b focus:border-laterite"
                />
                <span className="flex opacity-40 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                  <Button variant="ghost" size="icon-sm" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                    <ArrowUp size={13} />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label="Move down" disabled={i === items.length - 1} onClick={() => move(i, 1)}>
                    <ArrowDown size={13} />
                  </Button>
                  <Button variant="ghost" size="icon-sm" aria-label={`Remove ${it.label}`} onClick={() => setItems((l) => l!.filter((_, j) => j !== i))}>
                    <X size={13} />
                  </Button>
                </span>
              </li>
            ))}
          </ol>
          <form
            className="mt-2 flex items-center gap-2 pl-7"
            onSubmit={(e) => {
              e.preventDefault();
              if (adding.trim().length < 2) return;
              setItems((l) => [...(l ?? []), { label: adding.trim() }]);
              setAdding("");
            }}
          >
            <input
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              placeholder="Add an item, e.g. Prayer mat folded"
              className="h-9 min-w-0 flex-1 rounded-sm border border-dashed border-line-strong bg-transparent px-2.5 text-[13.5px] text-ink outline-none focus:border-laterite"
            />
            <Button type="submit" size="sm" variant="secondary" disabled={adding.trim().length < 2}>
              <Plus size={13} weight="bold" /> Add
            </Button>
          </form>
        </div>
      )}
      <div className="flex items-center gap-2 border-t border-line px-5 py-3">
        {current && !current.isDefault && !inherits && current.id && (
          <Button variant="ghost" size="sm" onClick={() => reset.mutate()} loading={reset.isPending}>
            <ArrowCounterClockwise size={13} /> {roomTypeId ? "Use the general checklist" : "Back to the default"}
          </Button>
        )}
        <span className={cn("ml-auto text-[12px]", dirty ? "text-laterite" : "text-ink-faint")}>{dirty ? "Unsaved changes" : `${items?.length ?? 0} items`}</span>
        <Button size="sm" disabled={!dirty && !inherits} loading={save.isPending} onClick={() => save.mutate()}>
          {inherits && roomTypeId ? "Give this type its own" : "Save checklist"}
        </Button>
      </div>
    </Panel>
  );
}

function HkSettingsPanel() {
  const s = useHkSettings();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: hkApi.saveSettings,
    onSuccess: (d) => {
      qc.setQueryData(qk4.hkSettings, d);
      void qc.invalidateQueries({ queryKey: ["housekeeping", "board"] });
      toast.success("Housekeeping settings saved");
    },
    meta: { errorTitle: "Not saved" },
  });
  if (s.isError)
    return (
      <Panel>
        <ErrorState error={s.error} onRetry={() => s.refetch()} />
      </Panel>
    );
  if (!s.data) return <Skeleton className="h-72" />;
  const d = s.data;
  return (
    <Panel className="self-start">
      <PanelHeader eyebrow="Rules" title="How rooms flow" />
      <div className="flex flex-col gap-5 px-5 py-4">
        <Switch
          checked={d.requireInspection}
          onChange={(v) => m.mutate({ requireInspection: v })}
          label="Inspect before sale"
          description="A cleaned room stays dirty until a supervisor passes it."
        />
        <Switch
          checked={d.stayoverEnabled}
          onChange={(v) => m.mutate({ stayoverEnabled: v })}
          label="Daily stayover cleans"
          description={`Raised at ${d.stayoverTime} for every room with a guest staying on.`}
        />
        <div>
          <p className="text-[14px] font-medium text-ink">Deep clean every</p>
          <p className="text-[13px] text-ink-muted">Check-outs of a room before the turnaround becomes a deep clean.</p>
          <ul className="mt-3 flex flex-col gap-2">
            {d.deepCleanEveryStays.map((r) => (
              <li key={r.roomTypeId} className="flex items-center justify-between gap-3">
                <span className="text-[13px] text-ink">{r.roomTypeName}</span>
                <Stepper
                  label={`stays for ${r.roomTypeName}`}
                  value={r.every ?? 0}
                  min={0}
                  max={60}
                  suffix={r.every ? "stays" : "off"}
                  onChange={(v) => m.mutate({ deepCleanEveryStays: d.deepCleanEveryStays.map((x) => ({ roomTypeId: x.roomTypeId, every: x.roomTypeId === r.roomTypeId ? v || null : x.every })) })}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
