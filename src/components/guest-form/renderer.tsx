"use client";

import { useRef, useState } from "react";
import { Paperclip, ShieldCheck, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import type { ExtraSelection, FormField, PickupAnswer, PublicBookingForm } from "@/lib/api/types-m7";
import { formApi } from "@/lib/api/endpoints-m7";
import { addDays, diffDays, todayKey } from "@/lib/dates";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { conditionHolds } from "@/components/form-builder/logic";
import { ExtrasPicker } from "./extras-picker";
import { PickupBlock, pickupProblems } from "./pickup-block";

export interface StayContext {
  arrival: string;
  departure: string;
  adults: number;
  children: number;
  phone?: string;
}

type Answers = Record<string, unknown>;

const isEmpty = (v: unknown) => v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);

/** Which answer fields the guest (or desk) sees now: on the form, not bound to the stay or guest, and their condition holds. */
export function visibleFields(form: PublicBookingForm, answers: Answers, stay: StayContext) {
  const ctx = { ...answers, adults: stay.adults, children: stay.children };
  const byKey = new Map(form.fields.map((f) => [f.key, f]));
  const shown = (f: FormField, depth = 0): boolean => {
    if (f.required === "HIDDEN") return false;
    if (!f.condition) return true;
    const ref = byKey.get(f.condition.fieldKey);
    if (ref && depth < 8 && !shown(ref, depth + 1) && !["adults", "children"].includes(ref.key)) return false;
    return conditionHolds(f, ctx);
  };
  return form.fields.filter((f) => shown(f));
}

/** Required answers and pickup details, checked before sending (the server checks again). */
export function checkAnswers(form: PublicBookingForm, answers: Answers, stay: StayContext, desk = true): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of visibleFields(form, answers, stay)) {
    if (f.boundTo) continue;
    const v = answers[f.key];
    if (f.type === "PICKUP") {
      const p = pickupProblems(v as PickupAnswer | undefined, form.pickup?.points ?? [], { desk, phone: stay.phone });
      if (Object.keys(p).length) out[f.key] = Object.values(p)[0];
      continue;
    }
    if (f.type === "EXTRA") continue;
    if (f.required === "REQUIRED" && (isEmpty(v) || (f.type === "CHECKBOX" && v !== true))) out[f.key] = `${f.label} is needed`;
    if (!isEmpty(v) && f.type === "EMAIL" && !/^\S+@\S+\.\S+$/.test(String(v))) out[f.key] = "Check the email address";
    if (!isEmpty(v) && f.validation?.pattern) {
      try {
        if (!new RegExp(f.validation.pattern).test(String(v))) out[f.key] = "That doesn't look right";
      } catch {
        /* the server checks patterns */
      }
    }
  }
  return out;
}

/** Only the answers the server stores: visible, not bound to the quote or guest block, with a value. */
export function cleanAnswers(form: PublicBookingForm, answers: Answers, stay: StayContext): Answers {
  const out: Answers = {};
  for (const f of visibleFields(form, answers, stay)) {
    if (f.boundTo || f.type === "EXTRA") continue;
    const v = answers[f.key];
    if (isEmpty(v)) continue;
    if (f.type === "PICKUP" && !(v as PickupAnswer).wanted) {
      out[f.key] = { wanted: false };
      continue;
    }
    out[f.key] = f.type === "NUMBER" ? Number(v) : v;
  }
  return out;
}

export function FormAnswers({
  form,
  answers,
  onAnswers,
  extras,
  onExtras,
  stay,
  errors = {},
  showSystem = false,
  desk = true,
}: {
  form: PublicBookingForm;
  answers: Answers;
  onAnswers: (a: Answers) => void;
  extras: ExtraSelection[];
  onExtras: (e: ExtraSelection[]) => void;
  stay: StayContext;
  errors?: Record<string, string>;
  showSystem?: boolean;
  desk?: boolean;
}) {
  const visible = new Set(visibleFields(form, answers, stay).map((f) => f.key));
  const set = (k: string, v: unknown) => onAnswers({ ...answers, [k]: v });
  const nights = Math.max(1, diffDays(stay.arrival, stay.departure));
  const guests = stay.adults + stay.children;
  const sections = [...form.sections].sort((a, b) => a.order - b.order);
  return (
    <div className="flex flex-col gap-6" data-testid="form-answers">
      {sections.map((s) => {
        const fields = s.fieldKeys.map((k) => form.fields.find((f) => f.key === k)).filter((f): f is FormField => !!f && visible.has(f.key) && (showSystem || !f.boundTo));
        if (!fields.length) return null;
        return (
          <fieldset key={s.name} className="flex flex-col gap-4">
            <legend className="eyebrow mb-3">{s.name}</legend>
            {fields.map((f) => (
              <Control key={f.key} f={f} value={answers[f.key]} onChange={(v) => set(f.key, v)} error={errors[f.key]} form={form} extras={extras} onExtras={onExtras} nights={nights} guests={guests} stay={stay} desk={desk} />
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}

function Control({
  f,
  value,
  onChange,
  error,
  form,
  extras,
  onExtras,
  nights,
  guests,
  stay,
  desk,
}: {
  f: FormField;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
  form: PublicBookingForm;
  extras: ExtraSelection[];
  onExtras: (e: ExtraSelection[]) => void;
  nights: number;
  guests: number;
  stay: StayContext;
  desk: boolean;
}) {
  const id = `ans-${f.key}`;
  const hint = [f.helpText, f.guestPurpose].filter(Boolean).join(" · ") || undefined;
  const label = (
    <span className="inline-flex items-center gap-1.5">
      {f.label}
      {f.sensitive && <ShieldCheck size={12} weight="fill" className="text-adire" aria-label="Sensitive" />}
    </span>
  );
  const optional = f.required === "OPTIONAL" && !f.boundTo;
  if (f.boundTo)
    return (
      <Field label={label} hint="Taken from the stay and guest details">
        <div className="h-10 rounded-md border border-dashed border-line-strong bg-surface-2/40 px-3 text-[13px] leading-10 text-ink-faint">{f.key === "dates" ? `${stay.arrival} to ${stay.departure}` : f.key === "adults" ? stay.adults : f.key === "children" ? stay.children : ""}</div>
      </Field>
    );
  switch (f.type) {
    case "PICKUP":
      return (
        <PickupBlock
          value={value as PickupAnswer | undefined}
          onChange={onChange}
          points={(form.pickup?.points ?? []).filter((p) => !f.pickup?.pickupPointIds || f.pickup.pickupPointIds.includes(p.id))}
          companies={form.pickup?.transportCompanies ?? []}
          routes={form.pickup?.trainRoutes ?? []}
          arrival={stay.arrival}
          departure={stay.departure}
          guests={guests}
          guestPhone={stay.phone}
          directions={f.pickup?.directions ?? ["ARRIVAL", "DEPARTURE"]}
          desk={desk}
          label={f.label}
        />
      );
    case "EXTRA":
      return (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-ink">{f.label}</span>
          <ExtrasPicker extras={form.extras} value={extras} onChange={onExtras} nights={nights} guests={guests} categories={f.extra?.categories ?? null} label={f.label} />
        </div>
      );
    case "LONG_TEXT":
      return (
        <Field label={label} htmlFor={id} hint={hint} error={error} optional={optional}>
          <Textarea id={id} value={String(value ?? "")} maxLength={f.validation?.maxLength ?? 2000} placeholder={f.placeholder ?? undefined} onChange={(e) => onChange(e.target.value)} className="min-h-20" />
        </Field>
      );
    case "SELECT":
      return f.options.length <= 6 ? (
        <Field label={label} hint={hint} error={error} optional={optional}>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={f.label}>
            {f.options.map((o) => (
              <button key={o.value} type="button" role="radio" aria-checked={value === o.value} onClick={() => onChange(value === o.value ? null : o.value)} className={cn("h-8 rounded-sm border px-3 text-[13px] transition-colors", value === o.value ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink hover:border-ink-faint")}>
                {o.label}
              </button>
            ))}
          </div>
        </Field>
      ) : (
        <Field label={label} htmlFor={id} hint={hint} error={error} optional={optional}>
          <Select id={id} value={String(value ?? "")} onChange={(e) => onChange(e.target.value || null)}>
            <option value="">Choose</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
      );
    case "MULTI_SELECT": {
      const list = Array.isArray(value) ? (value as string[]) : [];
      return (
        <Field label={label} hint={hint} error={error} optional={optional}>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={f.label}>
            {f.options.map((o) => {
              const on = list.includes(o.value);
              return (
                <button key={o.value} type="button" aria-pressed={on} onClick={() => onChange(on ? list.filter((x) => x !== o.value) : [...list, o.value])} className={cn("h-8 rounded-sm border px-3 text-[13px] transition-colors", on ? "border-adire bg-adire text-paper" : "border-line-strong bg-surface text-ink hover:border-ink-faint")}>
                  {o.label}
                </button>
              );
            })}
          </div>
        </Field>
      );
    }
    case "YES_NO":
      return (
        <Field label={label} hint={hint} error={error} optional={optional}>
          <div className="flex gap-1.5" role="radiogroup" aria-label={f.label}>
            {[true, false].map((b) => (
              <button key={String(b)} type="button" role="radio" aria-checked={value === b} onClick={() => onChange(value === b ? null : b)} className={cn("h-9 w-20 rounded-sm border text-[13px]", value === b ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink")}>
                {b ? "Yes" : "No"}
              </button>
            ))}
          </div>
        </Field>
      );
    case "CHECKBOX":
      return (
        <div className="flex flex-col gap-1">
          <label className="flex cursor-pointer items-start gap-2.5 text-[13.5px] text-ink">
            <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--laterite)]" />
            <span>
              {f.label}
              {hint && <span className="block text-[12px] text-ink-muted">{hint}</span>}
            </span>
          </label>
          {error && <p className="text-[12.5px] text-danger">{error}</p>}
        </div>
      );
    case "FILE":
      return <FileControl f={f} value={value} onChange={onChange} error={error} hint={hint} />;
    case "DATE":
      return (
        <Field label={label} htmlFor={id} hint={hint} error={error} optional={optional}>
          <Input id={id} type="date" max={f.key === "dateOfBirth" ? addDays(todayKey(), -1) : undefined} value={String(value ?? "")} onChange={(e) => onChange(e.target.value || null)} className="w-48 font-mono" />
        </Field>
      );
    case "TIME":
      return (
        <Field label={label} htmlFor={id} hint={hint} error={error} optional={optional}>
          <Input id={id} type="time" value={String(value ?? "")} onChange={(e) => onChange(e.target.value || null)} className="w-32 font-mono" data-testid={id} />
        </Field>
      );
    default:
      return (
        <Field label={label} htmlFor={id} hint={hint} error={error} optional={optional}>
          <Input
            id={id}
            type={f.type === "NUMBER" ? "number" : f.type === "EMAIL" ? "email" : f.type === "PHONE" ? "tel" : "text"}
            inputMode={f.type === "NUMBER" ? "numeric" : f.type === "PHONE" ? "tel" : undefined}
            min={f.validation?.min}
            max={f.validation?.max}
            maxLength={f.validation?.maxLength}
            placeholder={f.placeholder ?? undefined}
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            className={cn((f.type === "NUMBER" || f.type === "PHONE") && "font-mono", f.type === "NUMBER" && "w-32")}
            data-testid={id}
          />
        </Field>
      );
  }
}

function FileControl({ f, value, onChange, error, hint }: { f: FormField; value: unknown; onChange: (v: unknown) => void; error?: string; hint?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const v = value as { uploadId: string; token: string; name?: string } | undefined;
  return (
    <Field label={f.label} hint={hint ?? `PDF or a photo, up to ${f.validation?.maxFileMB ?? 5} MB`} error={error ?? err}>
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant="secondary" loading={busy} onClick={() => ref.current?.click()}>
          <Paperclip size={13} /> {v ? "Replace" : "Attach a file"}
        </Button>
        {v && (
          <span className="inline-flex min-w-0 items-center gap-1 text-[12.5px] text-ink">
            <span className="truncate">{v.name ?? "Attached"}</span>
            <button type="button" aria-label="Remove the file" onClick={() => onChange(null)} className="text-ink-faint hover:text-danger">
              <X size={12} />
            </button>
          </span>
        )}
      </div>
      <input
        ref={ref}
        type="file"
        className="sr-only"
        tabIndex={-1}
        accept={(f.validation?.accept ?? ["pdf", "jpeg", "png", "webp"]).map((x) => (x === "pdf" ? "application/pdf" : `image/${x}`)).join(",")}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setErr(null);
          setBusy(true);
          try {
            const u = await formApi.upload(file, f.key);
            onChange({ uploadId: u.uploadId, token: u.token, name: u.name });
          } catch (x) {
            setErr(x instanceof Error ? x.message : "Upload failed");
          } finally {
            setBusy(false);
          }
        }}
      />
    </Field>
  );
}

/** The builder's front-desk preview: the draft, answerable, nothing sent. */
export function GuestFormPreview({ form }: { form: PublicBookingForm }) {
  const [answers, setAnswers] = useState<Answers>({});
  const [extras, setExtras] = useState<ExtraSelection[]>([]);
  const today = todayKey();
  const stay: StayContext = { arrival: addDays(today, 7), departure: addDays(today, 10), adults: 2, children: 1, phone: "0803 123 4567" };
  return <FormAnswers form={form} answers={answers} onAnswers={setAnswers} extras={extras} onExtras={setExtras} stay={stay} showSystem />;
}
