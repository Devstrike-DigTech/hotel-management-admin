import type { Channel, ConditionOp, FieldType, FormField } from "@/lib/api/types-m7";
import { fieldTypeMeta } from "@/lib/m7-catalog";

export const ALL_CHANNELS: Channel[] = ["MARKETPLACE", "BOOKING_SITE", "FRONT_DESK"];

/** Fields that can be referenced by a condition (API-M7 2.1: not FILE, EXTRA or PICKUP). */
export function canBeReferenced(f: FormField) {
  return !["FILE", "EXTRA", "PICKUP"].includes(f.type) && f.key !== "dates" && f.key !== "policyConsent";
}

export const OP_LABEL: Record<ConditionOp, string> = {
  EQUALS: "is",
  NOT_EQUALS: "is not",
  IN: "is one of",
  IS_TRUE: "is yes",
  IS_FALSE: "is no",
  NOT_EMPTY: "is filled in",
};

export function operatorsFor(t: FieldType): ConditionOp[] {
  if (t === "YES_NO" || t === "CHECKBOX") return ["IS_TRUE", "IS_FALSE"];
  if (t === "SELECT") return ["EQUALS", "NOT_EQUALS", "IN", "NOT_EMPTY"];
  if (t === "MULTI_SELECT") return ["IN", "NOT_EMPTY"];
  return ["NOT_EMPTY", "EQUALS", "NOT_EQUALS"];
}

export function needsValue(op: ConditionOp) {
  return op === "EQUALS" || op === "NOT_EQUALS" || op === "IN";
}

function optLabel(f: FormField | undefined, v: string) {
  return f?.options.find((o) => o.value === v)?.label ?? v;
}

/** "Show Flight number when Arriving by is Air" in parts, so the UI can style the blanks. */
export function conditionParts(field: FormField, all: FormField[]): { subject: string; ref: string; op: string; value: string | null } | null {
  const c = field.condition;
  if (!c) return null;
  const ref = all.find((f) => f.key === c.fieldKey);
  let value: string | null = null;
  if (needsValue(c.operator)) {
    const v = c.value;
    value = Array.isArray(v) ? v.map((x) => optLabel(ref, x)).join(" or ") : v === undefined || v === null || v === "" ? "…" : optLabel(ref, String(v));
  }
  const op = ref?.type === "CHECKBOX" && c.operator === "IS_TRUE" ? "is ticked" : ref?.type === "CHECKBOX" && c.operator === "IS_FALSE" ? "is not ticked" : OP_LABEL[c.operator];
  return { subject: field.label, ref: ref?.label ?? c.fieldKey, op, value };
}

export function conditionSentence(field: FormField, all: FormField[]): string | null {
  const p = conditionParts(field, all);
  if (!p) return null;
  return `Show ${p.subject} when ${p.ref} ${p.op}${p.value ? ` ${p.value}` : ""}`;
}

/** Does a condition hold for these answers (numbers of adults / children count as answers)? */
export function conditionHolds(field: FormField, answers: Record<string, unknown>): boolean {
  const c = field.condition;
  if (!c) return true;
  const v = answers[c.fieldKey];
  const s = (x: unknown) => (typeof x === "boolean" || typeof x === "number" ? String(x) : (x as string) ?? "");
  switch (c.operator) {
    case "EQUALS":
      return s(v) === s(c.value);
    case "NOT_EQUALS":
      return s(v) !== s(c.value);
    case "IN": {
      const set = Array.isArray(c.value) ? c.value : [String(c.value ?? "")];
      return Array.isArray(v) ? v.some((x) => set.includes(String(x))) : set.includes(s(v));
    }
    case "IS_TRUE":
      return v === true;
    case "IS_FALSE":
      return v !== true;
    case "NOT_EMPTY":
      return !(v === null || v === undefined || v === "" || v === false || v === 0 || (Array.isArray(v) && v.length === 0));
  }
}

/** Keys that would form a cycle if `key` depended on `ref`. */
export function wouldCycle(key: string, ref: string, all: FormField[]): boolean {
  let cur: string | undefined = ref;
  const seen = new Set<string>();
  while (cur && !seen.has(cur)) {
    if (cur === key) return true;
    seen.add(cur);
    cur = all.find((f) => f.key === cur)?.condition?.fieldKey;
  }
  return false;
}

export function slugValue(label: string) {
  return (
    label
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 60) || "OPTION"
  );
}

let seq = 0;
/** A new custom field of a type; the server assigns its final "c_<slug>" key. */
export function newCustomField(type: FieldType, section: string): FormField {
  const meta = fieldTypeMeta(type);
  seq += 1;
  const label =
    type === "SELECT" ? "Choose one" : type === "MULTI_SELECT" ? "Choose any" : type === "YES_NO" ? "A yes or no question" : type === "CHECKBOX" ? "I agree" : type === "FILE" ? "Upload a document" : meta.label;
  return {
    key: `new_${Date.now().toString(36)}_${seq}`,
    source: "CUSTOM",
    libraryKey: null,
    recommended: false,
    type,
    label,
    helpText: null,
    placeholder: null,
    required: "OPTIONAL",
    options: meta.hasOptions ? [{ value: "OPTION_1", label: "Option 1" }, { value: "OPTION_2", label: "Option 2" }] : [],
    validation: type === "FILE" ? { maxFileMB: 5, accept: ["pdf", "jpeg", "png", "webp"] } : {},
    section,
    order: 0,
    channels: [...ALL_CHANNELS],
    condition: null,
    purpose: null,
    guestPurpose: null,
    sensitive: false,
    locked: { remove: false, hide: false, type: false, channels: false },
  };
}

export function isNewKey(key: string) {
  return key.startsWith("new_");
}

/** What the API counts toward max_custom_form_fields (API-M7 0.1). */
export function countsTowardLimit(f: FormField) {
  return (f.source === "LIBRARY" || f.source === "CUSTOM") && f.required !== "HIDDEN" && !f.recommended;
}

/** Sections in the order of their first field. */
export function sectionOrder(fields: FormField[]): string[] {
  const out: string[] = [];
  for (const f of [...fields].sort((a, b) => a.order - b.order)) if (!out.includes(f.section)) out.push(f.section);
  return out;
}

/** A stable key for a new custom field, from its label at the first save: "c_<slug>". */
export function keyFor(label: string, taken: Set<string>) {
  const base = `c_${label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "field"}`;
  let k = base;
  for (let i = 2; taken.has(k); i++) k = `${base}_${i}`;
  return k;
}

/**
 * Strip server-computed props and give new fields their keys before sending the
 * draft back. Returns the renames so conditions and the selection follow them.
 */
export function toInput(fields: FormField[]): { fields: FormField[]; renamed: Record<string, string> } {
  const taken = new Set(fields.filter((f) => !isNewKey(f.key)).map((f) => f.key));
  const renamed: Record<string, string> = {};
  for (const f of fields)
    if (isNewKey(f.key)) {
      const k = keyFor(f.label, taken);
      taken.add(k);
      renamed[f.key] = k;
    }
  const out = fields.map((f, i) => {
    const { conditionText: _c, mapsTo: _m, boundTo: _b, idLike: _i, ...rest } = f;
    void _c;
    void _m;
    void _b;
    void _i;
    const condition = rest.condition && renamed[rest.condition.fieldKey] ? { ...rest.condition, fieldKey: renamed[rest.condition.fieldKey] } : rest.condition;
    return { ...rest, key: renamed[f.key] ?? f.key, condition, order: i };
  });
  return { fields: out, renamed };
}
