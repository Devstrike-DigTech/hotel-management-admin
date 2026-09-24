"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, DotsSixVertical, GitBranch, LockSimple, PencilSimple, Prohibit, PushPin, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import type { Channel, FormField } from "@/lib/api/types-m7";
import { fieldTypeMeta, kindMeta, PICKUP_KINDS } from "@/lib/m7-catalog";
import { arrayMove, useSortable } from "@/lib/use-sortable";
import { Tip } from "@/components/ui/primitives";
import { CatalogIcon } from "@/components/m7/icon";
import { conditionParts, sectionOrder } from "./logic";

type Row = { kind: "section"; name: string } | { kind: "field"; field: FormField };

export interface DropPayload {
  kind: "library" | "type" | "recommended";
  id: string;
}
export const DND_MIME = "application/x-form-field";

const REQ_TONE = {
  REQUIRED: "border-[color-mix(in_oklab,var(--laterite)_35%,transparent)] bg-laterite-wash text-laterite",
  OPTIONAL: "border-line bg-surface-2 text-ink-muted",
  HIDDEN: "border-dashed border-line-strong bg-transparent text-ink-faint",
} as const;
const REQ_LABEL = { REQUIRED: "Required", OPTIONAL: "Optional", HIDDEN: "Hidden" } as const;

function rowsOf(fields: FormField[]): Row[] {
  const sorted = [...fields].sort((a, b) => a.order - b.order);
  const out: Row[] = [];
  for (const s of sectionOrder(sorted)) {
    out.push({ kind: "section", name: s });
    for (const f of sorted.filter((x) => x.section === s)) out.push({ kind: "field", field: f });
  }
  return out;
}

/** Rebuild fields (section and order) from a row list after a move. */
function fromRows(rows: Row[]): FormField[] {
  let section = "";
  const out: FormField[] = [];
  for (const r of rows) {
    if (r.kind === "section") section = r.name;
    else out.push({ ...r.field, section, order: out.length });
  }
  return out;
}

export function FormCanvas({
  fields,
  selected,
  onSelect,
  onChange,
  onDrop,
  lens,
  issues,
  warnings,
  editable,
}: {
  fields: FormField[];
  selected: string | null;
  onSelect: (key: string) => void;
  onChange: (fields: FormField[]) => void;
  onDrop: (p: DropPayload, section: string, index: number) => void;
  lens: Channel | "ALL";
  issues: Record<string, string>;
  warnings: Record<string, string>;
  editable: boolean;
}) {
  const rows = rowsOf(fields);
  const [announce, setAnnounce] = useState("");
  const [dropAt, setDropAt] = useState<number | null>(null);
  const listEl = useRef<HTMLOListElement | null>(null);
  const sort = useSortable({
    count: rows.length,
    canDrop: (_from, to) => to > 0,
    onMove: (from, to) => {
      const next = arrayMove(rows, from, to);
      onChange(fromRows(next));
      const r = rows[from];
      if (r.kind === "field") {
        const sec = [...next.slice(0, to + 1)].reverse().find((x) => x.kind === "section") as { name: string } | undefined;
        setAnnounce(`${r.field.label} moved${sec ? ` to ${sec.name}` : ""}`);
      }
    },
  });
  const sections = sectionOrder(fields);

  const moveSection = (name: string, dir: -1 | 1) => {
    const order = [...sections];
    const i = order.indexOf(name);
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    const sorted = [...fields].sort((a, b) => a.order - b.order);
    onChange(order.flatMap((s) => sorted.filter((f) => f.section === s)).map((f, k) => ({ ...f, order: k })));
  };
  const renameSection = (from: string, to: string) => {
    const name = to.trim().slice(0, 40);
    if (!name || name === from) return;
    onChange(fields.map((f) => (f.section === from ? { ...f, section: name } : f)));
  };

  /* library drag and drop (desktop); taps use the library's Add buttons */
  const indexAt = (y: number) => {
    const els = Array.from(listEl.current?.querySelectorAll<HTMLElement>(":scope > [data-sort-row]") ?? []);
    for (let i = 0; i < els.length; i++) {
      const r = els[i].getBoundingClientRect();
      if (y < r.top + r.height / 2) return Math.max(1, i);
    }
    return els.length;
  };

  return (
    <div
      className="relative"
      onDragOver={(e) => {
        if (!editable || !e.dataTransfer.types.includes(DND_MIME)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
        setDropAt(indexAt(e.clientY));
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropAt(null);
      }}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData(DND_MIME);
        const at = dropAt ?? rows.length;
        setDropAt(null);
        if (!raw) return;
        e.preventDefault();
        const before = rows.slice(0, at);
        const sec = [...before].reverse().find((x) => x.kind === "section") as { name: string } | undefined;
        const fieldIndex = before.filter((x) => x.kind === "field").length;
        onDrop(JSON.parse(raw) as DropPayload, sec?.name ?? sections[0] ?? "About you", fieldIndex);
      }}
    >
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <ol
        ref={(el) => {
          listEl.current = el;
          sort.bindList(el);
        }}
        className="flex flex-col gap-1.5"
        data-testid="form-canvas"
      >
        {rows.map((r, i) => {
          const line = dropAt === i && <span aria-hidden className="pointer-events-none absolute -top-[5px] left-0 right-0 h-[2px] rounded-full bg-laterite" />;
          if (r.kind === "section") {
            const si = sections.indexOf(r.name);
            return (
              <li key={`s-${r.name}`} data-sort-row style={sort.rowStyle(i)} className={cn("relative flex items-center gap-2 pb-1", i > 0 ? "mt-5" : "mt-0")} data-section={r.name}>
                {line}
                <span className="font-mono text-[10.5px] text-laterite">{String(si + 1).padStart(2, "0")}</span>
                <SectionName name={r.name} editable={editable} onRename={(to) => renameSection(r.name, to)} />
                <span className="h-px flex-1 bg-[repeating-linear-gradient(90deg,var(--line-strong)_0_4px,transparent_4px_8px)]" aria-hidden />
                {editable && (
                  <span className="flex gap-0.5">
                    <button type="button" aria-label={`Move ${r.name} up`} disabled={si === 0} onClick={() => moveSection(r.name, -1)} className="grid h-6 w-6 place-items-center rounded-sm text-ink-faint hover:bg-surface-2 hover:text-ink disabled:opacity-30">
                      <ArrowUp size={12} />
                    </button>
                    <button type="button" aria-label={`Move ${r.name} down`} disabled={si === sections.length - 1} onClick={() => moveSection(r.name, 1)} className="grid h-6 w-6 place-items-center rounded-sm text-ink-faint hover:bg-surface-2 hover:text-ink disabled:opacity-30">
                      <ArrowDown size={12} />
                    </button>
                  </span>
                )}
              </li>
            );
          }
          const f = r.field;
          const on = f.key === selected;
          const offLens = lens !== "ALL" && !f.channels.includes(lens);
          const hidden = f.required === "HIDDEN";
          const cond = conditionParts(f, fields);
          const meta = fieldTypeMeta(f.type);
          const issue = issues[f.key];
          const warn = warnings[f.key];
          return (
            <li key={f.key} data-sort-row style={sort.rowStyle(i)} className="relative" data-field={f.key}>
              {line}
              <div
                role="button"
                tabIndex={0}
                aria-pressed={on}
                aria-label={`${f.label}, ${meta.label}, ${REQ_LABEL[f.required]}`}
                onClick={() => onSelect(f.key)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(f.key);
                  }
                }}
                className={cn(
                  "group relative flex gap-2 rounded-md border bg-surface py-2.5 pl-1.5 pr-3 outline-none transition-[border-color,box-shadow,opacity] duration-150",
                  on ? "border-laterite shadow-[inset_3px_0_0_var(--laterite),0_0_0_1px_var(--laterite)]" : issue ? "border-danger" : "border-line hover:border-line-strong",
                  sort.dragging === i && "shadow-float",
                  (offLens || hidden) && !on && "opacity-55",
                  hidden && "hatch text-ink-faint",
                )}
              >
                {editable ? (
                  <button
                    type="button"
                    {...sort.handle(i)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Move ${f.label}. Use the arrow keys.`}
                    className="mt-0.5 grid h-7 w-5 shrink-0 cursor-grab place-items-center rounded-sm text-ink-faint hover:bg-surface-2 hover:text-ink active:cursor-grabbing"
                  >
                    <DotsSixVertical size={15} weight="bold" />
                  </button>
                ) : (
                  <span className="w-5 shrink-0" />
                )}
                <span className={cn("mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-sm border", f.source === "SYSTEM" ? "border-line bg-surface-2 text-ink-muted" : "border-[color-mix(in_oklab,var(--laterite)_30%,transparent)] bg-laterite-wash/60 text-laterite")}>
                  <CatalogIcon name={meta.icon} size={14} weight="duotone" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={cn("truncate text-[14px] font-medium", hidden ? "text-ink-faint line-through decoration-ink-faint/50" : "text-ink")}>{f.label}</span>
                    {f.source === "SYSTEM" && (
                      <Tip content="Always on the form">
                        <PushPin size={11} weight="fill" className="shrink-0 text-ink-faint" />
                      </Tip>
                    )}
                    {f.sensitive && (
                      <Tip content="Sensitive: masked in lists, never in emails">
                        <ShieldCheck size={12} weight="fill" className="shrink-0 text-adire" />
                      </Tip>
                    )}
                  </div>
                  <Faux f={f} />
                  {cond && (
                    <p className="mt-1.5 flex items-center gap-1 text-[11.5px] leading-snug text-adire" data-testid={`cond-${f.key}`}>
                      <GitBranch size={12} weight="bold" className="shrink-0" />
                      <span className="min-w-0">
                        when <b className="font-medium">{cond.ref}</b> {cond.op}
                        {cond.value && (
                          <>
                            {" "}
                            <b className="font-medium">{cond.value}</b>
                          </>
                        )}
                      </span>
                    </p>
                  )}
                  {(issue || warn) && (
                    <p className={cn("mt-1.5 flex items-start gap-1 text-[11.5px] leading-snug", issue ? "text-danger" : "text-ochre")}>
                      {issue ? <Prohibit size={12} weight="bold" className="mt-px shrink-0" /> : <WarningCircle size={12} weight="fill" className="mt-px shrink-0" />}
                      {issue ?? warn}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={cn("inline-flex h-5 items-center rounded-full border px-2 text-[10.5px] font-medium", REQ_TONE[f.required])}>
                    {f.key === "email" && f.required === "OPTIONAL" ? "For online pay" : REQ_LABEL[f.required]}
                  </span>
                  <ChannelDots channels={f.channels} lens={lens} />
                </div>
                {on && editable && f.source !== "SYSTEM" && (
                  <span className="pointer-events-none absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-laterite text-laterite-ink shadow-float" aria-hidden>
                    <PencilSimple size={10} weight="bold" />
                  </span>
                )}
                {!editable && <LockSimple size={12} className="absolute right-2 top-2 text-ink-faint" aria-hidden />}
              </div>
            </li>
          );
        })}
      </ol>
      {dropAt !== null && dropAt >= rows.length && <span aria-hidden className="mt-1 block h-[2px] rounded-full bg-laterite" />}
    </div>
  );
}

function SectionName({ name, editable, onRename }: { name: string; editable: boolean; onRename: (to: string) => void }) {
  const [edit, setEdit] = useState(false);
  if (!edit || !editable)
    return (
      <button type="button" disabled={!editable} onClick={() => setEdit(true)} className="display-sm text-[16px] text-ink hover:text-laterite disabled:hover:text-ink" title={editable ? "Rename section" : undefined}>
        {name}
      </button>
    );
  return (
    <input
      autoFocus
      defaultValue={name}
      maxLength={40}
      aria-label="Section name"
      onBlur={(e) => {
        onRename(e.target.value);
        setEdit(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setEdit(false);
      }}
      className="display-sm w-48 border-b border-laterite bg-transparent text-[16px] text-ink outline-none"
    />
  );
}

const CH_SHORT: Record<Channel, string> = { MARKETPLACE: "M", BOOKING_SITE: "S", FRONT_DESK: "D" };
const CH_NAME: Record<Channel, string> = { MARKETPLACE: "Marketplace", BOOKING_SITE: "Booking site", FRONT_DESK: "Front desk" };

export function ChannelDots({ channels, lens }: { channels: Channel[]; lens: Channel | "ALL" }) {
  return (
    <Tip content={`Shown on: ${channels.map((c) => CH_NAME[c]).join(", ") || "nowhere"}`}>
      <span className="flex gap-0.5" aria-label={`Shown on ${channels.map((c) => CH_NAME[c]).join(", ")}`}>
        {(Object.keys(CH_SHORT) as Channel[]).map((c) => {
          const has = channels.includes(c);
          return (
            <span
              key={c}
              className={cn(
                "grid h-4 w-4 place-items-center rounded-[3px] font-mono text-[8.5px] font-medium",
                has ? (lens === c ? "bg-ink text-paper" : "bg-surface-2 text-ink-muted") : "border border-dashed border-line-strong text-ink-faint/60",
              )}
            >
              {CH_SHORT[c]}
            </span>
          );
        })}
      </span>
    </Tip>
  );
}

/** A small drawing of the answer control, so the canvas reads like the form. */
function Faux({ f }: { f: FormField }) {
  const box = "mt-1.5 h-7 rounded-sm border border-line bg-paper/60 px-2 text-[11.5px] leading-7 text-ink-faint";
  switch (f.type) {
    case "SELECT":
    case "MULTI_SELECT":
      return (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {f.options.slice(0, 4).map((o) => (
            <span key={o.value} className={cn("h-6 rounded-full border border-line px-2 text-[11px] leading-6 text-ink-muted", f.type === "MULTI_SELECT" && "rounded-[3px]")}>
              {o.label}
            </span>
          ))}
          {f.options.length > 4 && <span className="h-6 px-1 text-[11px] leading-6 text-ink-faint">+{f.options.length - 4}</span>}
        </div>
      );
    case "YES_NO":
      return (
        <div className="mt-1.5 flex gap-1">
          <span className="h-6 w-12 rounded-sm border border-line text-center text-[11px] leading-6 text-ink-muted">Yes</span>
          <span className="h-6 w-12 rounded-sm border border-line text-center text-[11px] leading-6 text-ink-muted">No</span>
        </div>
      );
    case "CHECKBOX":
      return (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-ink-faint">
          <span className="h-3.5 w-3.5 rounded-[3px] border border-line-strong" /> {f.helpText ?? "Tick to agree"}
        </p>
      );
    case "PICKUP":
      return (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {PICKUP_KINDS.slice(0, 4).map((k) => (
            <span key={k.value} className="inline-flex h-6 items-center gap-1 rounded-sm border border-line px-1.5 text-[11px] text-ink-muted">
              <CatalogIcon name={kindMeta(k.value).icon} size={11} /> {k.label}
            </span>
          ))}
        </div>
      );
    case "EXTRA":
      return <p className="mt-1.5 text-[11.5px] text-ink-faint">Breakfast, early check-in, celebrations&hellip; with a running total</p>;
    case "FILE":
      return <div className={cn(box, "border-dashed")}>PDF or photo, up to {f.validation.maxFileMB ?? 5} MB</div>;
    case "LONG_TEXT":
      return <div className={cn(box, "h-10")}>{f.placeholder ?? f.helpText ?? ""}</div>;
    case "DATE":
      return f.key === "dates" ? <div className={cn(box, "font-mono")}>In &ndash; Out</div> : <div className={cn(box, "w-36 font-mono")}>DD / MM / YYYY</div>;
    case "TIME":
      return <div className={cn(box, "w-24 font-mono")}>HH : MM</div>;
    case "PHONE":
      return <div className={cn(box, "font-mono")}>+234 &nbsp;803 123 4567</div>;
    case "NUMBER":
      return <div className={cn(box, "w-20 font-mono")}>0</div>;
    default:
      return <div className={box}>{f.placeholder ?? ""}</div>;
  }
}
