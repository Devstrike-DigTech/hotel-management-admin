"use client";

import { Check, LockSimple, Plus, PushPin } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import type { FieldType, FormField, LibraryResponse } from "@/lib/api/types-m7";
import { FIELD_TYPES, LIBRARY, fieldTypeMeta } from "@/lib/m7-catalog";
import { Meter, PlanPlate, Skeleton, Tip } from "@/components/ui/primitives";
import { Switch } from "@/components/ui/form";
import { CatalogIcon } from "@/components/m7/icon";
import { DND_MIME, type DropPayload } from "./canvas";

function Group({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-4 last:border-b-0">
      <h3 className="eyebrow mb-0.5">{title}</h3>
      {hint && <p className="mb-2.5 text-[12px] leading-snug text-ink-muted">{hint}</p>}
      {children}
    </section>
  );
}

const drag = (p: DropPayload) => (e: React.DragEvent) => {
  e.dataTransfer.setData(DND_MIME, JSON.stringify(p));
  e.dataTransfer.effectAllowed = "copy";
};

export function LibraryPane({
  lib,
  fields,
  onAdd,
  onToggleRecommended,
  onSelect,
  onLocked,
  limit,
  editable,
  planFor,
}: {
  lib: LibraryResponse | undefined;
  fields: FormField[];
  onAdd: (p: DropPayload) => void;
  onToggleRecommended: (key: string, on: boolean) => void;
  onSelect: (key: string) => void;
  onLocked: (feature: string) => void;
  /** max_custom_form_fields: used / max (-1 unlimited) */
  limit: { used: number; max: number };
  editable: boolean;
  planFor: (feature: string) => { code: string; name: string };
}) {
  if (!lib)
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
    );
  const full = limit.max >= 0 && limit.used >= limit.max;
  const system = fields.filter((f) => f.source === "SYSTEM");
  return (
    <div data-testid="field-library">
      {limit.max >= 0 && (
        <div className="border-b border-line bg-surface-2/40 px-4 py-3" data-testid="field-limit">
          <Meter label="Extra fields on your plan" used={limit.used} max={limit.max} />
          {full && (
            <button type="button" onClick={() => onLocked("form_fields_unlimited")} className="mt-2 inline-flex items-center gap-1.5 text-[12px] font-medium text-brass hover:underline">
              <LockSimple size={12} weight="bold" /> Unlimited fields on {planFor("form_fields_unlimited").name}
            </button>
          )}
        </div>
      )}

      <Group title="Always on" hint="Every booking needs these. Reword them; you can't remove them.">
        <ul className="flex flex-col">
          {system.map((f) => (
            <li key={f.key}>
              <button type="button" onClick={() => onSelect(f.key)} className="flex w-full items-center gap-2 rounded-sm px-1.5 py-1.5 text-left text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink">
                <CatalogIcon name={fieldTypeMeta(f.type).icon} size={14} />
                <span className="min-w-0 flex-1 truncate">{f.label}</span>
                <PushPin size={11} weight="fill" className="text-ink-faint" />
              </button>
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Recommended" hint="On by default. Arrival time lands on the arrivals list.">
        <ul className="flex flex-col gap-2">
          {lib.recommended.map((r) => {
            const f = fields.find((x) => x.key === r.key);
            const on = !!f && f.required !== "HIDDEN";
            return (
              <li key={r.key} className="flex items-center gap-2 px-1.5">
                <CatalogIcon name={fieldTypeMeta(r.type).icon} size={14} className="text-ink-muted" />
                <button type="button" className="min-w-0 flex-1 truncate text-left text-[13px] text-ink" onClick={() => f && onSelect(f.key)}>
                  {r.label}
                </button>
                <Switch checked={on} disabled={!editable} onChange={(v) => onToggleRecommended(r.key, v)} ariaLabel={`${r.label} on the form`} />
              </li>
            );
          })}
        </ul>
      </Group>

      <Group title="Library" hint="Ready-made questions. Drag onto the form, or tap Add.">
        <ul className="flex flex-col gap-1">
          {lib.library.map((item) => {
            const locked = !item.available;
            const blocked = !locked && full && !item.alreadyAdded;
            const icon = LIBRARY.find((l) => l.libraryKey === item.libraryKey)?.icon ?? fieldTypeMeta(item.fields[0]?.type ?? "SHORT_TEXT").icon;
            const p: DropPayload = { kind: "library", id: item.libraryKey };
            return (
              <li key={item.libraryKey}>
                <div
                  draggable={editable && !locked && !blocked && !item.alreadyAdded}
                  onDragStart={drag(p)}
                  className={cn(
                    "group flex items-center gap-2 rounded-sm border border-transparent px-1.5 py-1.5",
                    !item.alreadyAdded && !locked && editable && "cursor-grab hover:border-line hover:bg-surface",
                  )}
                  data-library={item.libraryKey}
                >
                  <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-sm border", item.alreadyAdded ? "border-line text-ink-faint" : "border-line bg-surface text-ink-muted")}>
                    <CatalogIcon name={icon} size={14} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block truncate text-[13px]", item.alreadyAdded ? "text-ink-muted" : "text-ink")}>{item.name}</span>
                    <span className="block truncate text-[11px] text-ink-faint">{item.fields.length > 1 ? `${item.fields.length} questions` : item.description}</span>
                  </span>
                  {item.alreadyAdded ? (
                    <span className="inline-flex items-center gap-1 pr-1 text-[11px] text-palm">
                      <Check size={12} weight="bold" /> Added
                    </span>
                  ) : locked ? (
                    <button type="button" onClick={() => onLocked(item.feature ?? "paid_extras")} className="inline-flex items-center gap-1 text-[11px] font-medium text-brass" aria-label={`${item.name} is on ${planFor(item.feature ?? "paid_extras").name}`}>
                      <LockSimple size={11} weight="bold" /> {planFor(item.feature ?? "paid_extras").name}
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!editable}
                      onClick={() => (blocked ? onLocked("form_fields_unlimited") : onAdd(p))}
                      aria-label={`Add ${item.name}`}
                      data-testid={`add-${item.libraryKey}`}
                      className="grid h-7 w-7 place-items-center rounded-sm border border-line bg-surface text-ink-muted hover:border-laterite hover:text-laterite disabled:opacity-40"
                    >
                      {blocked ? <LockSimple size={12} /> : <Plus size={13} weight="bold" />}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </Group>

      <Group title="Your own question" hint="Pick the kind of answer you want.">
        <div className="grid grid-cols-2 gap-1.5">
          {(lib.customTypes.length ? lib.customTypes : FIELD_TYPES.filter((t) => t.type !== "EXTRA" && t.type !== "PICKUP").map((t) => ({ type: t.type, label: t.label, feature: t.feature ?? null, available: true }))).map((t) => {
            const meta = fieldTypeMeta(t.type as FieldType);
            const locked = !t.available;
            const p: DropPayload = { kind: "type", id: t.type };
            return (
              <Tip key={t.type} content={locked ? `On ${planFor(t.feature ?? "form_file_uploads").name}` : meta.hint}>
                <button
                  type="button"
                  draggable={editable && !locked && !full}
                  onDragStart={drag(p)}
                  disabled={!editable}
                  onClick={() => (locked ? onLocked(t.feature ?? "form_file_uploads") : full ? onLocked("form_fields_unlimited") : onAdd(p))}
                  data-testid={`add-type-${t.type}`}
                  className={cn(
                    "flex h-9 min-w-0 items-center gap-1.5 rounded-sm border border-line bg-surface px-2 text-left text-[12px] text-ink transition-colors hover:border-line-strong disabled:opacity-50",
                    (locked || full) && "text-ink-muted",
                  )}
                >
                  <CatalogIcon name={meta.icon} size={13} className={locked || full ? "text-ink-faint" : "text-laterite"} />
                  <span className="min-w-0 flex-1 truncate">{meta.label}</span>
                  {locked && <LockSimple size={11} className="shrink-0 text-brass" />}
                </button>
              </Tip>
            );
          })}
        </div>
        {lib.customTypes.some((t) => !t.available) && (
          <p className="mt-2.5 flex items-center gap-1.5 text-[11px] text-ink-faint">
            <PlanPlate name={planFor("form_file_uploads").name} code={planFor("form_file_uploads").code} /> adds file uploads
          </p>
        )}
      </Group>
    </div>
  );
}
