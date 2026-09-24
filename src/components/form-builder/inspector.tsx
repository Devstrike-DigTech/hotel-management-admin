"use client";

import { useEffect, useState } from "react";
import { DotsSixVertical, GitBranch, IdentificationCard, LockSimple, Plus, Prohibit, PushPin, Trash, WarningCircle, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import type { Channel, ConditionOp, ExtraCategory, FormField, LabelCheck, PickupPoint } from "@/lib/api/types-m7";
import { formApi } from "@/lib/api/endpoints-m7";
import { CHANNELS, EXTRA_CATEGORIES, fieldTypeMeta, idLikeCheck, kindMeta } from "@/lib/m7-catalog";
import { arrayMove, useSortable } from "@/lib/use-sortable";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/primitives";
import { CatalogIcon } from "@/components/m7/icon";
import { OP_LABEL, canBeReferenced, needsValue, operatorsFor, sectionOrder, slugValue, wouldCycle } from "./logic";

function Block({ title, children, aside }: { title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="border-b border-line px-5 py-4 last:border-b-0">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="eyebrow flex-1">{title}</h3>
        {aside}
      </div>
      <div className="flex flex-col gap-3.5">{children}</div>
    </section>
  );
}

/** Warn on ID-like labels at once; the server has the last word (check-label). */
export function useLabelCheck(label: string, help: string | null) {
  const local = idLikeCheck(`${label} ${help ?? ""}`);
  const [server, setServer] = useState<LabelCheck | null>(null);
  useEffect(() => {
    if (!label.trim()) return;
    const id = window.setTimeout(() => {
      formApi
        .checkLabel(label, help ?? undefined)
        .then(setServer)
        .catch(() => setServer(null));
    }, 450);
    return () => window.clearTimeout(id);
  }, [label, help]);
  if (server && server.level !== "OK" && server.message) return { level: server.level === "BLOCK" ? ("block" as const) : ("warn" as const), message: server.message };
  if (server?.level === "OK" && !local) return null;
  return local;
}

export function Inspector({
  field,
  fields,
  onChange,
  onRemove,
  canConditions,
  canFiles,
  onLocked,
  issue,
  pickupPoints,
  editable,
}: {
  field: FormField;
  fields: FormField[];
  onChange: (patch: Partial<FormField>) => void;
  onRemove: () => void;
  canConditions: boolean;
  canFiles: boolean;
  onLocked: (feature: string) => void;
  issue?: string;
  pickupPoints: PickupPoint[] | undefined;
  editable: boolean;
}) {
  const meta = fieldTypeMeta(field.type);
  const sys = field.source === "SYSTEM";
  const lock = field.locked ?? { remove: sys, hide: sys, type: sys, channels: false };
  const check = useLabelCheck(field.label, field.helpText);
  const sections = sectionOrder(fields);
  const [newSection, setNewSection] = useState("");
  const addOn = field.type === "EXTRA" || field.type === "PICKUP";
  const text = field.type === "SHORT_TEXT" || field.type === "LONG_TEXT";

  const reqOptions = [
    { value: "REQUIRED" as const, label: "Required" },
    { value: "OPTIONAL" as const, label: field.key === "email" ? "For online pay" : "Optional" },
    { value: "HIDDEN" as const, label: "Hidden" },
  ].filter((o) => !(addOn && o.value === "REQUIRED") && !(lock.hide && o.value === "HIDDEN"));

  return (
    <div className={cn(!editable && "pointer-events-none opacity-70")} data-testid="inspector" data-field={field.key}>
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-md border", sys ? "border-line bg-surface-2 text-ink-muted" : "border-[color-mix(in_oklab,var(--laterite)_30%,transparent)] bg-laterite-wash/60 text-laterite")}>
          <CatalogIcon name={meta.icon} size={17} weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="eyebrow">{sys ? "Always on" : field.source === "LIBRARY" ? (field.recommended ? "Recommended" : "From the library") : "Your question"}</p>
          <p className="truncate text-[14px] font-medium text-ink">{meta.label}</p>
          {field.mapsTo && <p className="mt-0.5 truncate font-mono text-[10.5px] text-ink-faint">fills {field.mapsTo}</p>}
        </div>
        {!lock.remove && (
          <Button variant="ghost" size="icon-sm" aria-label={`Remove ${field.label}`} onClick={onRemove} data-testid="remove-field" className="hover:bg-danger-wash hover:text-danger">
            <Trash size={15} />
          </Button>
        )}
        {sys && <PushPin size={14} weight="fill" className="mt-1 text-ink-faint" aria-label="Can't be removed" />}
      </div>

      <Block title="Question">
        <Field label="Label" htmlFor="insp-label" error={issue ?? (check?.level === "block" ? check.message : null)}>
          <Input id="insp-label" value={field.label} maxLength={sys ? 40 : 80} onChange={(e) => onChange({ label: e.target.value })} aria-invalid={!!issue || check?.level === "block"} data-testid="insp-label" />
        </Field>
        {check?.level === "warn" && (
          <div className="flex gap-2.5 rounded-md border border-[color-mix(in_oklab,var(--ochre)_40%,transparent)] bg-ochre-wash/60 px-3 py-2.5" data-testid="id-warning">
            <IdentificationCard size={18} weight="duotone" className="mt-0.5 shrink-0 text-ochre" />
            <div className="text-[12.5px] leading-snug text-ink">
              <p>{check.message}</p>
              <p className="mt-1 text-ink-muted">The register card at check-in already asks for the ID type and number, with a photo. This field is marked sensitive.</p>
            </div>
          </div>
        )}
        {check?.level === "block" && (
          <p className="-mt-1.5 flex items-start gap-1.5 text-[12px] leading-snug text-danger" data-testid="bvn-blocked">
            <Prohibit size={13} weight="bold" className="mt-px shrink-0" /> This isn&rsquo;t saved until the label changes.
          </p>
        )}
        <Field label="Help text" htmlFor="insp-help" optional hint="Under the question, in small type.">
          <Input id="insp-help" value={field.helpText ?? ""} maxLength={200} onChange={(e) => onChange({ helpText: e.target.value || null })} />
        </Field>
        {(text || field.type === "NUMBER" || field.type === "PHONE" || field.type === "EMAIL") && (
          <Field label="Placeholder" htmlFor="insp-ph" optional>
            <Input id="insp-ph" value={field.placeholder ?? ""} maxLength={80} onChange={(e) => onChange({ placeholder: e.target.value || null })} />
          </Field>
        )}
      </Block>

      <Block title="Answer">
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink">Guests must answer</span>
          <Segmented label="Required" value={field.required} onChange={(v) => onChange({ required: v })} options={reqOptions} size="sm" />
          {field.key === "email" && field.required === "OPTIONAL" && <p className="text-[12px] text-ink-muted">Asked for when the guest pays online; optional when they pay at the hotel.</p>}
          {addOn && <p className="text-[12px] text-ink-muted">Extras and pickups are always a choice, never required.</p>}
        </div>
        {(field.type === "SELECT" || field.type === "MULTI_SELECT") && <OptionsEditor field={field} onChange={onChange} />}
        <ValidationEditor field={field} onChange={onChange} canFiles={canFiles} />
        {field.type === "PICKUP" && <PickupConfig field={field} onChange={onChange} points={pickupPoints} />}
        {field.type === "EXTRA" && <ExtraConfig field={field} onChange={onChange} />}
      </Block>

      <Block
        title="Show when"
        aside={
          !canConditions ? (
            <button type="button" onClick={() => onLocked("form_conditional_logic")} className="inline-flex items-center gap-1 text-[11px] font-medium text-brass">
              <LockSimple size={11} weight="bold" /> Growth
            </button>
          ) : undefined
        }
      >
        <ConditionEditor field={field} fields={fields} onChange={onChange} enabled={canConditions && !sys} />
      </Block>

      <Block title="Where it appears">
        <Field label="Section" htmlFor="insp-section">
          <Select
            id="insp-section"
            value={sections.includes(field.section) ? field.section : "__new"}
            onChange={(e) => {
              if (e.target.value !== "__new") onChange({ section: e.target.value });
              else setNewSection(" ");
            }}
          >
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
            <option value="__new">New section&hellip;</option>
          </Select>
        </Field>
        {newSection && (
          <div className="flex gap-2">
            <Input autoFocus placeholder="Before you arrive" maxLength={40} value={newSection.trim() ? newSection : ""} onChange={(e) => setNewSection(e.target.value || " ")} aria-label="New section name" />
            <Button
              variant="secondary"
              onClick={() => {
                if (newSection.trim()) onChange({ section: newSection.trim() });
                setNewSection("");
              }}
            >
              Move
            </Button>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink">Asked on</span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Channels">
            {CHANNELS.map((c) => {
              const on = field.channels.includes(c.value);
              const last = on && field.channels.length === 1;
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={on}
                  disabled={lock.channels || last}
                  title={last ? "A field needs at least one channel" : c.hint}
                  onClick={() => onChange({ channels: on ? field.channels.filter((x) => x !== c.value) : ([...field.channels, c.value] as Channel[]) })}
                  data-testid={`channel-${c.value}`}
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-sm border px-2.5 text-[12.5px] transition-colors disabled:cursor-not-allowed",
                    on ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink-muted hover:text-ink",
                    lock.channels && "opacity-60",
                  )}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </Block>

      <Block title="Privacy (NDPA)">
        <Field label="Why you ask" htmlFor="insp-purpose" optional hint="For your team and your records. Guests never see it.">
          <Textarea id="insp-purpose" className="min-h-16" maxLength={300} value={field.purpose ?? ""} placeholder="The police register asks for it" onChange={(e) => onChange({ purpose: e.target.value || null })} />
        </Field>
        <Field label="What the guest sees" htmlFor="insp-gpurpose" optional hint="A short line under the question.">
          <Input id="insp-gpurpose" maxLength={140} value={field.guestPurpose ?? ""} placeholder="So the kitchen can plan your breakfast" onChange={(e) => onChange({ guestPurpose: e.target.value || null })} />
        </Field>
        <Switch
          checked={field.sensitive || !!field.idLike}
          disabled={!!field.idLike}
          onChange={(v) => onChange({ sensitive: v })}
          label={<span className="text-[13px]">Sensitive</span>}
          description="Masked in lists and exports, never in emails, left out of the partner API without guest access."
        />
      </Block>
    </div>
  );
}

function OptionsEditor({ field, onChange }: { field: FormField; onChange: (p: Partial<FormField>) => void }) {
  const opts = field.options;
  const sort = useSortable({ count: opts.length, onMove: (a, b) => onChange({ options: arrayMove(opts, a, b) }) });
  const set = (i: number, label: string) => {
    const used = new Set(opts.filter((_, j) => j !== i).map((o) => o.value));
    let v = slugValue(label);
    for (let k = 2; used.has(v); k++) v = `${slugValue(label)}_${k}`;
    // keep the stored value once answers may exist: only fresh options follow the label
    const fresh = /^OPTION(_\d+)?$/.test(opts[i].value);
    onChange({ options: opts.map((o, j) => (j === i ? { value: fresh ? v : o.value, label } : o)) });
  };
  return (
    <div className="flex flex-col gap-1.5" data-testid="options-editor">
      <span className="text-[13px] font-medium text-ink">Options</span>
      <ol ref={(el) => sort.bindList(el)} className="flex flex-col gap-1">
        {opts.map((o, i) => (
          <li key={o.value} data-sort-row style={sort.rowStyle(i)} className="flex items-center gap-1 rounded-sm bg-surface">
            <button type="button" {...sort.handle(i)} aria-label={`Move ${o.label}`} className="grid h-9 w-5 shrink-0 cursor-grab place-items-center text-ink-faint hover:text-ink">
              <DotsSixVertical size={13} weight="bold" />
            </button>
            <Input value={o.label} onChange={(e) => set(i, e.target.value)} className="h-9" aria-label={`Option ${i + 1}`} data-testid={`option-${i}`} maxLength={60} />
            <button type="button" disabled={opts.length <= 1} onClick={() => onChange({ options: opts.filter((_, j) => j !== i) })} aria-label={`Remove ${o.label}`} className="grid h-9 w-8 shrink-0 place-items-center rounded-sm text-ink-faint hover:text-danger disabled:opacity-30">
              <X size={13} />
            </button>
          </li>
        ))}
      </ol>
      <Button
        size="sm"
        variant="secondary"
        className="self-start"
        disabled={opts.length >= 30}
        data-testid="add-option"
        onClick={() => {
          const used = new Set(opts.map((o) => o.value));
          let n = opts.length + 1;
          while (used.has(`OPTION_${n}`)) n++;
          onChange({ options: [...opts, { value: `OPTION_${n}`, label: `Option ${n}` }] });
        }}
      >
        <Plus size={13} /> Add an option
      </Button>
    </div>
  );
}

const PATTERNS = [
  { label: "No pattern", value: "" },
  { label: "Nigerian plate (ABC 123 DE)", value: "^[A-Za-z]{3}\\s?\\d{3}\\s?[A-Za-z]{2}$" },
  { label: "Letters and numbers only", value: "^[A-Za-z0-9 ]+$" },
  { label: "Digits only", value: "^\\d+$" },
];

function ValidationEditor({ field, onChange, canFiles }: { field: FormField; onChange: (p: Partial<FormField>) => void; canFiles: boolean }) {
  const v = field.validation ?? {};
  const set = (p: Partial<typeof v>) => onChange({ validation: { ...v, ...p } });
  const num = (s: string) => (s === "" ? undefined : Number(s));
  if (field.type === "NUMBER" || field.type === "MULTI_SELECT")
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label={field.type === "NUMBER" ? "Lowest" : "Pick at least"} optional>
          <Input type="number" inputMode="numeric" className="font-mono" value={v.min ?? ""} onChange={(e) => set({ min: num(e.target.value) })} />
        </Field>
        <Field label={field.type === "NUMBER" ? "Highest" : "Pick at most"} optional>
          <Input type="number" inputMode="numeric" className="font-mono" value={v.max ?? ""} onChange={(e) => set({ max: num(e.target.value) })} />
        </Field>
      </div>
    );
  if (field.type === "SHORT_TEXT" || field.type === "LONG_TEXT")
    return (
      <div className="flex flex-col gap-3">
        <Field label="Longest answer" optional hint={`Up to ${field.type === "SHORT_TEXT" ? 200 : 2000} characters.`}>
          <Input type="number" inputMode="numeric" className="w-28 font-mono" placeholder={field.type === "SHORT_TEXT" ? "120" : "500"} value={v.maxLength ?? ""} onChange={(e) => set({ maxLength: num(e.target.value) })} />
        </Field>
        {field.type === "SHORT_TEXT" && field.source === "CUSTOM" && (
          <Field label="Shape of the answer" optional>
            <Select value={PATTERNS.some((p) => p.value === (v.pattern ?? "")) ? (v.pattern ?? "") : "__custom"} onChange={(e) => set({ pattern: e.target.value === "__custom" ? v.pattern : e.target.value || undefined })}>
              {PATTERNS.map((p) => (
                <option key={p.label} value={p.value}>
                  {p.label}
                </option>
              ))}
              {v.pattern && !PATTERNS.some((p) => p.value === v.pattern) && <option value="__custom">Custom: {v.pattern}</option>}
            </Select>
          </Field>
        )}
      </div>
    );
  if (field.type === "FILE")
    return (
      <div className={cn("flex flex-col gap-3", !canFiles && "opacity-60")}>
        <Field label="Largest file" hint="1 to 10 MB.">
          <Input type="number" min={1} max={10} className="w-24 font-mono" value={v.maxFileMB ?? 5} onChange={(e) => set({ maxFileMB: Math.min(10, Math.max(1, Number(e.target.value) || 5)) })} />
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-medium text-ink">Accept</span>
          <div className="flex gap-1.5">
            {(["pdf", "jpeg", "png", "webp"] as const).map((t) => {
              const acc = v.accept ?? ["pdf", "jpeg", "png", "webp"];
              const on = acc.includes(t);
              return (
                <button key={t} type="button" aria-pressed={on} disabled={on && acc.length === 1} onClick={() => set({ accept: on ? acc.filter((x) => x !== t) : [...acc, t] })} className={cn("h-7 rounded-sm border px-2 font-mono text-[11px] uppercase", on ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}>
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  return null;
}

function ConditionEditor({ field, fields, onChange, enabled }: { field: FormField; fields: FormField[]; onChange: (p: Partial<FormField>) => void; enabled: boolean }) {
  const c = field.condition;
  const refs = fields.filter((f) => f.key !== field.key && canBeReferenced(f) && f.required !== "HIDDEN" && !wouldCycle(field.key, f.key, fields));
  if (!c)
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="text-[12.5px] leading-snug text-ink-muted">{enabled ? "Always shown. Show it only after a certain answer, so guests see fewer questions." : field.source === "SYSTEM" ? "Always-on questions are always shown." : "Questions that appear after a certain answer are on Growth."}</p>
        <Button
          size="sm"
          variant="secondary"
          disabled={!enabled || !refs.length}
          data-testid="add-condition"
          onClick={() => {
            const r = refs[refs.length - 1];
            const op = operatorsFor(r.type)[0];
            onChange({ condition: { fieldKey: r.key, operator: op, value: needsValue(op) ? (r.options[0]?.value ?? "") : undefined } });
          }}
        >
          <GitBranch size={13} /> Add a rule
        </Button>
      </div>
    );
  const ref = fields.find((f) => f.key === c.fieldKey);
  const ops = ref ? operatorsFor(ref.type) : (["NOT_EMPTY"] as ConditionOp[]);
  const blank = "rule-blank appearance-none bg-transparent font-medium text-ink outline-none focus-visible:rounded-xs focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-laterite";
  const value = c.value;
  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[14px] leading-[2] text-ink-muted" data-testid="rule-sentence">
        Show <span className="font-medium text-ink">{field.label || "this question"}</span> when{" "}
        <select
          aria-label="Question the rule looks at"
          className={cn(blank, "max-w-[200px]")}
          value={c.fieldKey}
          disabled={!enabled}
          data-testid="rule-field"
          onChange={(e) => {
            const r = fields.find((f) => f.key === e.target.value)!;
            const op = operatorsFor(r.type)[0];
            onChange({ condition: { fieldKey: r.key, operator: op, value: needsValue(op) ? (r.options[0]?.value ?? "") : undefined } });
          }}
        >
          {refs.map((r) => (
            <option key={r.key} value={r.key}>
              {r.label}
            </option>
          ))}
        </select>{" "}
        <select aria-label="Comparison" className={blank} value={c.operator} disabled={!enabled} data-testid="rule-op" onChange={(e) => {
          const op = e.target.value as ConditionOp;
          onChange({ condition: { ...c, operator: op, value: needsValue(op) ? (op === "IN" ? (ref?.options[0] ? [ref.options[0].value] : []) : (ref?.options[0]?.value ?? "")) : undefined } });
        }}>
          {ops.map((o) => (
            <option key={o} value={o}>
              {ref?.type === "CHECKBOX" && o === "IS_TRUE" ? "is ticked" : ref?.type === "CHECKBOX" && o === "IS_FALSE" ? "is not ticked" : OP_LABEL[o]}
            </option>
          ))}
        </select>
        {needsValue(c.operator) && (
          <>
            {" "}
            {ref && ref.options.length && c.operator !== "IN" ? (
              <select aria-label="Answer" className={blank} value={String(value ?? "")} disabled={!enabled} data-testid="rule-value" onChange={(e) => onChange({ condition: { ...c, value: e.target.value } })}>
                {ref.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : c.operator !== "IN" ? (
              <input aria-label="Answer" className={cn(blank, "w-28")} value={String(value ?? "")} disabled={!enabled} data-testid="rule-value" onChange={(e) => onChange({ condition: { ...c, value: e.target.value } })} placeholder="an answer" />
            ) : null}
          </>
        )}
      </p>
      {c.operator === "IN" && ref && (
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Any of these answers">
          {ref.options.map((o) => {
            const list = Array.isArray(value) ? value : [];
            const on = list.includes(o.value);
            return (
              <button key={o.value} type="button" aria-pressed={on} disabled={!enabled} onClick={() => onChange({ condition: { ...c, value: on ? list.filter((x) => x !== o.value) : [...list, o.value] } })} className={cn("h-7 rounded-full border px-2.5 text-[12px]", on ? "border-adire bg-adire text-paper" : "border-line-strong text-ink-muted")}>
                {o.label}
              </button>
            );
          })}
        </div>
      )}
      {ref && ref.required === "HIDDEN" && (
        <p className="flex items-center gap-1.5 text-[12px] text-ochre">
          <WarningCircle size={13} weight="fill" /> {ref.label} is hidden, so this question never shows.
        </p>
      )}
      {ref && !field.channels.every((ch) => ref.channels.includes(ch)) && (
        <p className="flex items-center gap-1.5 text-[12px] text-ochre">
          <WarningCircle size={13} weight="fill" /> {ref.label} isn&rsquo;t asked on every channel this question is.
        </p>
      )}
      <Button size="sm" variant="ghost" className="self-start" disabled={!enabled} onClick={() => onChange({ condition: null })} data-testid="remove-condition">
        <X size={13} /> Always show it
      </Button>
    </div>
  );
}

function PickupConfig({ field, onChange, points }: { field: FormField; onChange: (p: Partial<FormField>) => void; points: PickupPoint[] | undefined }) {
  const cfg = field.pickup ?? { directions: ["ARRIVAL", "DEPARTURE"], pickupPointIds: null };
  const dirs = cfg.directions;
  const active = (points ?? []).filter((p) => p.active);
  const ids = cfg.pickupPointIds;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink">Offer</span>
        <Switch checked={dirs.includes("ARRIVAL")} onChange={(v) => onChange({ pickup: { ...cfg, directions: v ? [...new Set([...dirs, "ARRIVAL" as const])] : dirs.filter((d) => d !== "ARRIVAL") } })} label={<span className="text-[13px]">Arrival pickup</span>} />
        <Switch checked={dirs.includes("DEPARTURE")} onChange={(v) => onChange({ pickup: { ...cfg, directions: v ? [...new Set([...dirs, "DEPARTURE" as const])] : dirs.filter((d) => d !== "DEPARTURE") } })} label={<span className="text-[13px]">Departure drop-off</span>} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink">From which places</span>
        <Switch checked={ids === null} onChange={(v) => onChange({ pickup: { ...cfg, pickupPointIds: v ? null : active.map((p) => p.id) } })} label={<span className="text-[13px]">Every active pickup point</span>} />
        {ids !== null && (
          <ul className="flex flex-col gap-1 pl-1">
            {active.map((p) => {
              const on = ids.includes(p.id);
              return (
                <li key={p.id}>
                  <label className="flex items-center gap-2 text-[12.5px] text-ink">
                    <input type="checkbox" className="accent-[var(--laterite)]" checked={on} onChange={() => onChange({ pickup: { ...cfg, pickupPointIds: on ? ids.filter((x) => x !== p.id) : [...ids, p.id] } })} />
                    <CatalogIcon name={kindMeta(p.kind).icon} size={13} className="text-ink-muted" />
                    {p.shortName ?? p.name}
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function ExtraConfig({ field, onChange }: { field: FormField; onChange: (p: Partial<FormField>) => void }) {
  const cats = field.extra?.categories ?? null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink">Categories offered</span>
      <div className="flex flex-wrap gap-1.5">
        {EXTRA_CATEGORIES.filter((c) => c.value !== "TRANSPORT").map((c) => {
          const on = cats === null || cats.includes(c.value);
          return (
            <button
              key={c.value}
              type="button"
              aria-pressed={on}
              onClick={() => {
                const all = EXTRA_CATEGORIES.filter((x) => x.value !== "TRANSPORT").map((x) => x.value);
                const cur = cats ?? all;
                const next = on ? cur.filter((x) => x !== c.value) : [...cur, c.value];
                onChange({ extra: { categories: next.length === all.length ? null : (next as ExtraCategory[]) } });
              }}
              className={cn("inline-flex h-7 items-center gap-1.5 rounded-sm border px-2 text-[12px]", on ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}
            >
              <CatalogIcon name={c.icon} size={12} /> {c.label}
            </button>
          );
        })}
      </div>
      <p className="text-[12px] text-ink-muted">Pickups are asked for in their own block.</p>
    </div>
  );
}
