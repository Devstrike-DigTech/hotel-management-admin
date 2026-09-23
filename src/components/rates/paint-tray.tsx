"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarBlank, PaintBrush, PushPin, Prohibit, Stack, Trash, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatDay, type DayKey } from "@/lib/dates";
import { naira } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Field, Input, Switch } from "@/components/ui/form";
import { Segmented } from "@/components/ui/primitives";
import { NairaInput, Stepper } from "@/components/m2/bits";
import { DOW_LABEL, SLOT_VAR, describeAdjustment, spanNights, type AdjustmentType, type AlmanacRule, type AlmanacType } from "./model";

export type PaintDraft =
  | { kind: "rule"; rule: AlmanacRule; isNew: boolean }
  | { kind: "override"; priceKobo: number | null }
  | { kind: "restrict"; minNights: number | null; closedToArrival: boolean; stopSell: boolean };

type Tab = "rule" | "override" | "restrict";

const NAMES = ["Weekend", "Detty December", "Easter", "Eid week", "Conference week", "Independence Day", "Low season"];
const QUICK = [-15, -10, 10, 20, 35];

/**
 * The paint tray: what to do with the selected nights. Every change is
 * reported through `onDraft` so the grid previews the prices before saving.
 */
export function PaintTray({
  from,
  to,
  types,
  selectedTypeIds,
  editing,
  rules,
  onDraft,
  onSave,
  onDelete,
  onClose,
  saving,
  canManage,
}: {
  from: DayKey;
  to: DayKey;
  types: AlmanacType[];
  selectedTypeIds: string[];
  editing: AlmanacRule | null;
  rules: AlmanacRule[];
  onDraft: (d: PaintDraft | null) => void;
  onSave: (d: PaintDraft) => void;
  onDelete?: (r: AlmanacRule) => void;
  onClose: () => void;
  saving: boolean;
  canManage: boolean;
}) {
  const [tab, setTab] = useState<Tab>("rule");
  const nextSlot = useMemo(() => {
    const used = new Set(rules.map((r) => r.slot));
    for (let s = 1; s <= 5; s++) if (!used.has(s)) return s;
    return (rules.length % 5) + 1;
  }, [rules]);

  const [name, setName] = useState(editing?.name ?? "");
  const [adjType, setAdjType] = useState<AdjustmentType>(editing?.adjustment.type ?? "PERCENT");
  const [pct, setPct] = useState<number>(editing?.adjustment.type === "PERCENT" ? editing.adjustment.value : 10);
  const [amount, setAmount] = useState<number | null>(editing && editing.adjustment.type !== "PERCENT" ? Math.abs(editing.adjustment.value) : null);
  const [lower, setLower] = useState(editing ? editing.adjustment.value < 0 : false);
  const [dows, setDows] = useState<number[]>(editing?.daysOfWeek ?? []);
  const [priority, setPriority] = useState(editing?.priority ?? Math.max(10, ...rules.map((r) => r.priority + 10)));
  const [typeIds, setTypeIds] = useState<string[]>(editing ? (editing.roomTypeIds.length ? editing.roomTypeIds : types.map((t) => t.id)) : selectedTypeIds);
  const [dateFrom, setDateFrom] = useState(editing?.dateFrom ?? from);
  const [dateTo, setDateTo] = useState(editing?.dateTo ?? to);
  const [override, setOverride] = useState<number | null>(null);
  const [minNights, setMinNights] = useState(1);
  const [cta, setCta] = useState(false);
  const [stopSell, setStopSell] = useState(false);

  const allTypes = typeIds.length === types.length;
  const rule: AlmanacRule = {
    id: editing?.id ?? "__draft__",
    name: name.trim() || "New season",
    slot: editing?.slot ?? nextSlot,
    roomTypeIds: allTypes ? [] : typeIds,
    dateFrom,
    dateTo: dateTo < dateFrom ? dateFrom : dateTo,
    daysOfWeek: dows.length === 7 ? [] : dows,
    adjustment:
      adjType === "PERCENT"
        ? { type: "PERCENT", value: lower ? -Math.abs(pct) : Math.abs(pct) }
        : adjType === "AMOUNT"
          ? { type: "AMOUNT", value: (lower ? -1 : 1) * (amount ?? 0) }
          : { type: "FIXED", value: amount ?? 0 },
    priority,
  };

  const draft: PaintDraft | null =
    tab === "rule"
      ? { kind: "rule", rule, isNew: !editing }
      : tab === "override"
        ? { kind: "override", priceKobo: override }
        : { kind: "restrict", minNights: minNights > 1 ? minNights : null, closedToArrival: cta, stopSell };

  const key = JSON.stringify(draft);
  useEffect(() => {
    onDraft(draft);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the serialised draft is the dependency
  }, [key]);
  useEffect(() => () => onDraft(null), [onDraft]);

  const overlaps = rules.filter(
    (r) => r.id !== rule.id && r.dateTo >= rule.dateFrom && r.dateFrom <= rule.dateTo && (!rule.roomTypeIds.length || !r.roomTypeIds.length || r.roomTypeIds.some((x) => rule.roomTypeIds.includes(x))),
  );
  const nights = spanNights(from, to);
  const invalid =
    tab === "rule" ? !name.trim() || !typeIds.length || (adjType !== "PERCENT" && !amount) || (adjType === "PERCENT" && !pct) : tab === "override" ? false : false;

  return (
    <div className="border-t border-line bg-[color-mix(in_oklab,var(--surface)_70%,var(--paper))]" role="region" aria-label="Paint the selected nights">
      <div className="flex flex-wrap items-center gap-3 border-b border-dashed border-line px-4 py-3 sm:px-5">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-laterite-wash text-laterite">
          <PaintBrush size={16} weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium text-ink">
            {editing ? (
              <>Editing {editing.name}</>
            ) : (
              <>
                {selectedTypeIds.length === types.length ? "Every room type" : `${selectedTypeIds.length} room ${selectedTypeIds.length === 1 ? "type" : "types"}`}, {nights}{" "}
                {nights === 1 ? "night" : "nights"}
              </>
            )}
          </p>
          <p className="text-[12px] text-ink-muted">
            {formatDay(editing?.dateFrom ?? from)} to {formatDay(editing?.dateTo ?? to)}
            {!editing && <> &middot; prices in the grid show what this would do</>}
          </p>
        </div>
        {!editing && (
          <Segmented<Tab>
            label="What to paint"
            size="sm"
            value={tab}
            onChange={setTab}
            options={[
              { value: "rule", label: "Season", icon: <Stack size={13} weight="duotone" /> },
              { value: "override", label: "Price", icon: <PushPin size={13} weight="duotone" /> },
              { value: "restrict", label: "Restrictions", icon: <Prohibit size={13} weight="duotone" /> },
            ]}
          />
        )}
        <Button variant="ghost" size="icon-sm" aria-label="Close without saving" onClick={onClose}>
          <X size={15} />
        </Button>
      </div>

      <div className="px-4 py-4 sm:px-5">
        {tab === "rule" && (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-4">
              <Field label="Season name" htmlFor="rule-name">
                <div className="flex items-center gap-2">
                  <span className="h-5 w-1.5 shrink-0 rounded-full" style={{ background: SLOT_VAR(rule.slot) }} aria-hidden />
                  <Input id="rule-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Detty December" autoFocus={!editing} />
                </div>
              </Field>
              {!editing && (
                <div className="-mt-2 flex flex-wrap gap-1">
                  {NAMES.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setName(n)}
                      className="h-6 rounded-full border border-line px-2 text-[11.5px] text-ink-muted hover:border-line-strong hover:text-ink"
                    >
                      {n}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium text-ink">Price change</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Segmented<AdjustmentType>
                    label="Adjustment type"
                    size="sm"
                    value={adjType}
                    onChange={setAdjType}
                    options={[
                      { value: "PERCENT", label: "%" },
                      { value: "AMOUNT", label: "₦ more or less" },
                      { value: "FIXED", label: "Fixed ₦" },
                    ]}
                  />
                  {adjType !== "FIXED" && (
                    <Segmented<"up" | "down">
                      label="Direction"
                      size="sm"
                      value={lower ? "down" : "up"}
                      onChange={(v) => setLower(v === "down")}
                      options={[
                        { value: "up", label: "Raise" },
                        { value: "down", label: "Lower" },
                      ]}
                    />
                  )}
                </div>
                {adjType === "PERCENT" ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex h-10 w-[112px] items-stretch overflow-hidden rounded-md border border-line-strong bg-surface focus-within:border-laterite">
                      <span className="grid w-8 place-items-center border-r border-line bg-surface-2/60 font-mono text-[14px] text-ink-muted">{lower ? "−" : "+"}</span>
                      <input
                        aria-label="Percent"
                        inputMode="numeric"
                        value={pct || ""}
                        onChange={(e) => setPct(Math.min(300, Number(e.target.value.replace(/\D/g, "")) || 0))}
                        className="w-full bg-transparent px-2 font-mono text-[16px] text-ink outline-none sm:text-[14px]"
                      />
                      <span className="grid w-7 place-items-center font-mono text-[13px] text-ink-muted">%</span>
                    </div>
                    {QUICK.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => {
                          setPct(Math.abs(q));
                          setLower(q < 0);
                        }}
                        className={cn(
                          "h-7 rounded-sm border px-2 font-mono text-[12px]",
                          (lower ? -pct : pct) === q ? "border-ink bg-ink text-paper" : "border-line text-ink-muted hover:border-line-strong hover:text-ink",
                        )}
                      >
                        {q > 0 ? `+${q}` : `−${Math.abs(q)}`}%
                      </button>
                    ))}
                  </div>
                ) : (
                  <NairaInput kobo={amount} onChange={setAmount} aria-label={adjType === "FIXED" ? "Fixed nightly price" : "Amount"} className="max-w-[220px]" />
                )}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium text-ink">Which nights</span>
                <div className="flex flex-wrap gap-1" role="group" aria-label="Days of the week">
                  {[1, 2, 3, 4, 5, 6, 0].map((d) => {
                    const on = !dows.length || dows.includes(d);
                    return (
                      <button
                        key={d}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          const cur = dows.length ? dows : [0, 1, 2, 3, 4, 5, 6];
                          const next = cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d];
                          setDows(next.length === 7 ? [] : next.length ? next : [d]);
                        }}
                        className={cn(
                          "h-8 w-10 rounded-sm border font-mono text-[11.5px] transition-colors",
                          on ? "border-ink/70 bg-surface-2 font-medium text-ink" : "border-dashed border-line-strong text-ink-faint hover:text-ink",
                        )}
                      >
                        {DOW_LABEL[d]}
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-3 text-[12px]">
                  <button type="button" className="text-ink-muted underline-offset-4 hover:text-ink hover:underline" onClick={() => setDows([])}>
                    Every night
                  </button>
                  <button type="button" className="text-ink-muted underline-offset-4 hover:text-ink hover:underline" onClick={() => setDows([5, 6])}>
                    Fri and Sat
                  </button>
                  <button type="button" className="text-ink-muted underline-offset-4 hover:text-ink hover:underline" onClick={() => setDows([0, 1, 2, 3, 4])}>
                    Sun to Thu
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[13px] font-medium text-ink">Room types</span>
                <div className="flex flex-wrap gap-1.5">
                  {types.map((t) => {
                    const on = typeIds.includes(t.id);
                    return (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setTypeIds(on ? typeIds.filter((x) => x !== t.id) : [...typeIds, t.id])}
                        className={cn(
                          "h-8 rounded-sm border px-2.5 text-[12.5px] transition-colors",
                          on ? "border-ink/70 bg-surface-2 font-medium text-ink" : "border-dashed border-line-strong text-ink-faint hover:text-ink",
                        )}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-3">
                <Field label="From" htmlFor="rule-from">
                  <div className="relative">
                    <CalendarBlank size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                    <Input id="rule-from" type="date" value={dateFrom} onChange={(e) => e.target.value && setDateFrom(e.target.value)} className="pl-8 font-mono text-[13px]" />
                  </div>
                </Field>
                <Field label="To" htmlFor="rule-to">
                  <div className="relative">
                    <CalendarBlank size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-muted" />
                    <Input id="rule-to" type="date" min={dateFrom} value={dateTo} onChange={(e) => e.target.value && setDateTo(e.target.value)} className="pl-8 font-mono text-[13px]" />
                  </div>
                </Field>
                <Field label="Priority">
                  <Stepper label="priority" value={priority} onChange={setPriority} min={0} max={999} />
                </Field>
              </div>
              {overlaps.length > 0 && (
                <p className="text-[12px] leading-snug text-ink-muted">
                  Overlaps{" "}
                  {overlaps.map((o, i) => (
                    <span key={o.id}>
                      {i > 0 && ", "}
                      <span className="inline-flex items-center gap-1 text-ink">
                        <span className="h-2 w-2 rounded-[2px]" style={{ background: SLOT_VAR(o.slot) }} aria-hidden />
                        {o.name}
                      </span>{" "}
                      <span className="font-mono">(p{o.priority})</span>
                    </span>
                  ))}
                  . Where they meet, the higher priority wins
                  {overlaps.every((o) => o.priority < priority) ? `: this one` : overlaps.some((o) => o.priority > priority) ? `, so some nights keep the other price` : ""}.
                </p>
              )}
            </div>
          </div>
        )}

        {tab === "override" && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-6">
            <Field label="Price for each of these nights" htmlFor="ov-price" hint="A fixed price beats every season on these nights. Leave empty to clear fixed prices.">
              <NairaInput id="ov-price" kobo={override} onChange={setOverride} large className="max-w-[280px]" autoFocus />
            </Field>
          </div>
        )}

        {tab === "restrict" && (
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Minimum stay" hint="For arrivals on these nights.">
              <Stepper label="minimum nights" value={minNights} onChange={setMinNights} min={1} max={14} suffix={minNights === 1 ? "night" : "nights"} />
            </Field>
            <div className="pt-6">
              <Switch checked={cta} onChange={setCta} label="Closed to arrival" description="Guests can stay through, but not check in." />
            </div>
            <div className="pt-6">
              <Switch checked={stopSell} onChange={setStopSell} label="Stop sell" description="Nothing sells on these nights, anywhere." />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 sm:px-5">
        {tab === "rule" && (
          <p className="mr-auto text-[12px] text-ink-muted">
            <span className="text-ink">{rule.name}</span> {describeAdjustment(rule.adjustment, naira)}, priority <span className="font-mono">{rule.priority}</span>
          </p>
        )}
        {tab !== "rule" && <span className="mr-auto" />}
        {editing && onDelete && canManage && (
          <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-wash hover:text-danger" onClick={() => onDelete(editing)}>
            <Trash size={14} /> Delete season
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onClose}>
          Cancel
        </Button>
        <Button size="sm" disabled={!canManage || invalid || !draft} loading={saving} onClick={() => draft && onSave(draft)}>
          {tab === "rule" ? (editing ? "Save season" : "Paint season") : tab === "override" ? (override == null ? "Clear fixed prices" : "Fix the price") : "Apply restrictions"}
        </Button>
      </div>
    </div>
  );
}
