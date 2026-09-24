"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowRight,
  CaretDown,
  CheckCircle,
  CircleHalf,
  DotsSixVertical,
  Image as ImageIcon,
  LockSimple,
  Moon,
  Plus,
  Sun,
  Trash,
  UploadSimple,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { contrastRatio, grade, inkOn, loadGoogleFont, parseHex } from "@/lib/m6-catalog";
import {
  FONT_PAIRINGS,
  SECTIONS,
  SITE_SURFACES,
  SWATCHES,
  TEMPLATES,
  accessibleVariant,
  googleFontUrl,
  sectionMeta,
  templateMeta,
  type SectionOptionField,
  type TemplateId,
} from "@/lib/m7-catalog";
import type { ColourMode, FontPairingInfo, ThemeBrand, ThemeSection } from "@/lib/api/types-m7";
import { arrayMove, useSortable } from "@/lib/use-sortable";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { PlanPlate, Segmented, Tip } from "@/components/ui/primitives";
import { CatalogIcon } from "@/components/m7/icon";
import { TemplateThumb } from "./template-thumb";

/* ---------------------------------------------------------------- */
/* Shared                                                            */
/* ---------------------------------------------------------------- */

export function PanelIntro({ title, children, locked }: { title: string; children?: React.ReactNode; locked?: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <h3 className="display-sm text-[18px] text-ink">{title}</h3>
        {locked}
      </div>
      {children && <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{children}</p>}
    </div>
  );
}

export function LockNote({ plan, onUpgrade, children }: { plan: { code: string; name: string }; onUpgrade: () => void; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-md border border-dashed border-[color-mix(in_oklab,var(--brass)_55%,transparent)] bg-brass-wash/50 px-3.5 py-3">
      <LockSimple size={16} weight="bold" className="mt-0.5 shrink-0 text-brass" />
      <p className="min-w-0 flex-1 text-[12.5px] leading-snug text-ink">{children}</p>
      <button type="button" onClick={onUpgrade} className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-medium text-brass hover:underline">
        {plan.name} <ArrowRight size={12} weight="bold" />
      </button>
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Templates                                                         */
/* ---------------------------------------------------------------- */

export function TemplateGallery({
  value,
  published,
  primary,
  secondary,
  isAvailable,
  onPick,
  onLocked,
  lockPlan,
}: {
  value: string;
  published?: string | null;
  primary: string;
  secondary: string;
  isAvailable: (id: string) => boolean;
  onPick: (id: TemplateId) => void;
  onLocked: (id: TemplateId) => void;
  lockPlan: { code: string; name: string };
}) {
  return (
    <div role="radiogroup" aria-label="Template" className="grid grid-cols-1 gap-3 min-[420px]:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
      {TEMPLATES.map((t) => {
        const on = t.id === value;
        const ok = isAvailable(t.id);
        return (
          <button
            key={t.id}
            type="button"
            role="radio"
            aria-checked={on}
            data-testid={`template-${t.id}`}
            data-locked={!ok || undefined}
            onClick={() => (ok ? onPick(t.id) : onLocked(t.id))}
            className={cn(
              "group relative flex flex-col overflow-hidden rounded-md border bg-surface text-left transition-[border-color,box-shadow] duration-150",
              on ? "border-ink shadow-[0_0_0_1px_var(--ink)]" : "border-line hover:border-line-strong",
            )}
          >
            <div className="relative aspect-[4/3] overflow-hidden border-b border-line">
              <TemplateThumb id={t.id} primary={primary} secondary={secondary} className={cn("h-full w-full transition-transform duration-300 ease-out group-hover:scale-[1.02]", !ok && "opacity-45 grayscale-[0.6]")} />
              {!ok && (
                <span className="absolute inset-0 grid place-items-center">
                  <span className="inline-flex items-center gap-1.5 rounded-sm border border-[color-mix(in_oklab,var(--brass)_45%,transparent)] bg-surface/95 px-2 py-1 text-[11.5px] font-medium text-brass shadow-float">
                    <LockSimple size={12} weight="bold" /> {lockPlan.name}
                  </span>
                </span>
              )}
              <span className="absolute left-2 top-2 flex gap-1">
                {on && published !== t.id && <span className="rounded-xs bg-ink px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-paper">Draft</span>}
                {published === t.id && <span className={cn("rounded-xs px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em]", on ? "bg-ink text-paper" : "border border-line bg-surface/95 text-ink-muted")}>Live</span>}
              </span>
            </div>
            <div className="flex flex-col gap-0.5 px-3 py-2.5">
              <span className="flex items-center gap-2 text-[14px] font-medium text-ink">
                {t.name}
                {on && <CheckCircle size={14} weight="fill" className="text-laterite" />}
              </span>
              <span className="text-[12px] leading-snug text-ink-muted">{t.bestFor}</span>
              <span className="mt-1.5 flex flex-wrap gap-1">
                {t.traits.map((x) => (
                  <span key={x} className="rounded-xs bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] text-ink-muted">
                    {x}
                  </span>
                ))}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Colours, logo and mode                                            */
/* ---------------------------------------------------------------- */

function ContrastChip({ fg, bg, label, testId }: { fg: string; bg: string; label: string; testId?: string }) {
  const r = contrastRatio(fg, bg);
  const g = grade(r);
  const ok = g === "AA" || g === "AAA";
  const Icon = ok ? CheckCircle : g === "AA large" ? WarningCircle : XCircle;
  return (
    <div className="flex min-w-0 flex-col gap-1.5" data-testid={testId} data-grade={g}>
      <span className="grid h-10 place-items-center rounded-xs border border-line text-[15px] font-medium" style={{ background: bg, color: fg }} aria-hidden>
        Aa
      </span>
      <span className="truncate text-[11px] text-ink-muted">{label}</span>
      <span className={cn("inline-flex items-center gap-1 font-mono text-[11px]", ok ? "text-palm" : g === "AA large" ? "text-ochre" : "text-danger")}>
        <Icon size={12} weight="fill" />
        {r ? r.toFixed(1) : "--"}
      </span>
    </div>
  );
}

export function ColourPicker({
  label,
  role,
  value,
  onChange,
  disabled,
  testId,
  applied,
}: {
  label: string;
  role: "primary" | "secondary";
  value: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
  testId?: string;
  /** the server's accessible variants for this colour, once the draft is saved */
  applied?: { onFill: string; light: string; dark: string } | null;
}) {
  const id = useId();
  const [text, setText] = useState(value);
  useEffect(() => {
    // follow outside changes (swatches, discard) without fighting the typist
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mirror the prop into the text box
    setText(value);
  }, [value]);
  const valid = !!parseHex(value);
  const lightText = applied?.light ?? accessibleVariant(value, SITE_SURFACES.light);
  const darkText = applied?.dark ?? accessibleVariant(value, SITE_SURFACES.dark);
  const onFill = applied?.onFill ?? inkOn(value);
  const adjustedLight = valid && lightText.toUpperCase() !== value.toUpperCase();
  const adjustedDark = valid && darkText.toUpperCase() !== value.toUpperCase();
  return (
    <div className="flex flex-col gap-3" data-testid={testId ? `${testId}-picker` : undefined}>
      <div className="flex items-end gap-3">
        <label htmlFor={id} className="relative block h-14 w-14 shrink-0 overflow-hidden rounded-md border border-line-strong shadow-[inset_0_0_0_3px_var(--surface)]" style={{ background: valid ? value : "transparent" }}>
          <span className="sr-only">{label} colour picker</span>
          <input
            type="color"
            value={valid ? normalise(value) : "#000000"}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            disabled={disabled}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            aria-label={`${label} colour picker`}
          />
        </label>
        <div className="min-w-0 flex-1">
          <p className="mb-1 text-[13px] font-medium text-ink">{label}</p>
          <input
            id={id}
            value={text}
            disabled={disabled}
            data-testid={testId}
            spellCheck={false}
            maxLength={7}
            aria-invalid={!parseHex(text)}
            onChange={(e) => {
              const v = e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`;
              setText(v.toUpperCase());
              if (parseHex(v) && v.length === 7) onChange(v.toUpperCase());
            }}
            onBlur={() => setText(value)}
            className="h-9 w-full rounded-md border border-line-strong bg-surface px-3 font-mono text-[14px] uppercase text-ink outline-none focus:border-laterite aria-[invalid=true]:border-danger"
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={`Suggested ${label.toLowerCase()} colours`}>
        {SWATCHES.map((s) => (
          <Tip key={s.hex} content={s.name}>
            <button
              type="button"
              disabled={disabled}
              onClick={() => onChange(s.hex)}
              aria-label={s.name}
              aria-pressed={s.hex === value.toUpperCase()}
              className={cn("h-6 w-6 rounded-full border border-black/10 transition-transform hover:scale-110", s.hex === value.toUpperCase() && "ring-2 ring-ink ring-offset-2 ring-offset-surface")}
              style={{ background: s.hex }}
            />
          </Tip>
        ))}
      </div>
      {valid && (
        <div className="rounded-md border border-line bg-surface-2/40 p-3">
          <div className="grid grid-cols-3 gap-2.5">
            <ContrastChip fg={onFill} bg={value} label={role === "primary" ? "Button text" : "Badge text"} testId={testId ? `${testId}-on` : undefined} />
            <ContrastChip fg={lightText} bg={SITE_SURFACES.light} label="On light pages" testId={testId ? `${testId}-light` : undefined} />
            <ContrastChip fg={darkText} bg={SITE_SURFACES.dark} label="On dark pages" testId={testId ? `${testId}-dark` : undefined} />
          </div>
          {(adjustedLight || adjustedDark) && (
            <p className="mt-3 flex items-start gap-2 border-t border-dashed border-line pt-2.5 text-[12px] leading-snug text-ink-muted" data-testid={testId ? `${testId}-adjusted` : undefined}>
              <span className="mt-0.5 flex shrink-0 items-center gap-0.5" aria-hidden>
                <span className="h-3 w-3 rounded-full" style={{ background: value }} />
                <ArrowRight size={10} />
                <span className="h-3 w-3 rounded-full" style={{ background: adjustedLight ? lightText : darkText }} />
              </span>
              <span>
                {value} is too faint for text {adjustedLight && adjustedDark ? "on light and dark pages" : adjustedLight ? "on light pages" : "on dark pages"}, so links and headings use{" "}
                <span className="font-mono text-ink">{adjustedLight ? lightText : darkText}</span>
                {adjustedLight && adjustedDark ? <> and <span className="font-mono text-ink">{darkText}</span></> : null}. Buttons keep your colour.
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function normalise(v: string) {
  const rgb = parseHex(v);
  if (!rgb) return "#000000";
  return `#${rgb.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

export function AssetDrop({
  label,
  hint,
  url,
  onFile,
  onClear,
  busy,
  kind,
  disabled,
}: {
  label: string;
  hint: string;
  url: string | null;
  onFile: (f: File) => void;
  onClear: () => void;
  busy?: boolean;
  kind: "logo" | "favicon";
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new image gets a fresh chance to load
    setBroken(false);
  }, [url]);
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[13px] font-medium text-ink">{label}</span>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f && !disabled) onFile(f);
        }}
        className={cn(
          "flex items-center gap-3 rounded-md border border-dashed p-2.5 transition-colors",
          over ? "border-laterite bg-laterite-wash/40" : "border-line-strong bg-surface",
        )}
      >
        <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-sm border border-line bg-[repeating-conic-gradient(var(--surface-2)_0_25%,var(--surface)_0_50%)] bg-[length:10px_10px]", kind === "logo" ? "h-12 w-20" : "h-12 w-12")}>
          {url && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element -- uploaded asset on the API host
            <img src={url} alt="" className="max-h-10 max-w-[72px] object-contain" onError={() => setBroken(true)} />
          ) : (
            <ImageIcon size={18} className="text-ink-faint" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] leading-snug text-ink-muted">{broken ? "That image doesn't load; upload it again." : hint}</p>
          <div className="mt-1.5 flex gap-2">
            <Button size="sm" variant="secondary" loading={busy} disabled={disabled} onClick={() => ref.current?.click()}>
              <UploadSimple size={13} /> {url ? "Replace" : "Upload"}
            </Button>
            {url && (
              <Button size="sm" variant="ghost" disabled={disabled} onClick={onClear}>
                Remove
              </Button>
            )}
          </div>
        </div>
        <input
          ref={ref}
          type="file"
          accept={kind === "logo" ? "image/png,image/webp,image/jpeg" : "image/png,image/x-icon,image/vnd.microsoft.icon"}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = "";
          }}
        />
      </div>
    </div>
  );
}

export function ColourModeControl({ value, onChange, disabled }: { value: ColourMode; onChange: (m: ColourMode) => void; disabled?: boolean }) {
  return (
    <div className={cn(disabled && "pointer-events-none opacity-55")}>
      <Segmented<ColourMode>
        label="Colour mode"
        value={value}
        onChange={onChange}
        options={[
          { value: "LIGHT", label: "Light", icon: <Sun size={13} /> },
          { value: "DARK", label: "Dark", icon: <Moon size={13} /> },
          { value: "SYSTEM", label: "Follow the phone", icon: <CircleHalf size={13} /> },
        ]}
      />
    </div>
  );
}

/** The chosen colours at work: a button, a link and a tag on both page tones. */
export function PaletteProof({ brand, heading, body }: { brand: ThemeBrand; heading: string; body: string }) {
  const tone = (bg: string, dark: boolean) => {
    const p = accessibleVariant(brand.primary, bg);
    const s = accessibleVariant(brand.secondary ?? (dark ? "#D6A94A" : "#B98A2E"), bg);
    return (
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3" style={{ background: bg, color: dark ? "#EFE8DC" : "#1B1A17", fontFamily: `"${body}", sans-serif` }}>
        <span className="truncate text-[15px] leading-tight" style={{ fontFamily: `"${heading}", serif`, color: p }}>
          Deluxe King
        </span>
        <span className="text-[10.5px] opacity-70">from ₦85,000 a night</span>
        <span className="flex items-center gap-2">
          <span className="rounded-[3px] px-2 py-1 text-[10.5px] font-medium" style={{ background: brand.primary, color: inkOn(brand.primary) }}>
            Book now
          </span>
          <span className="text-[10.5px] underline underline-offset-2" style={{ color: s }}>
            See photos
          </span>
        </span>
      </div>
    );
  };
  return (
    <div className="flex overflow-hidden rounded-md border border-line" aria-label="How your colours read on light and dark pages">
      {tone(SITE_SURFACES.light, false)}
      {tone(SITE_SURFACES.dark, true)}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Font pairings                                                     */
/* ---------------------------------------------------------------- */

export interface PairingChoice {
  id: string;
  name: string;
  heading: string;
  body: string;
  note: string;
  url: string | null;
  headingStack: string;
  bodyStack: string;
}

/** The API's pairings (with their CSS stacks and one Google Fonts URL), or the catalogue while they load. */
export function pairingChoices(api?: FontPairingInfo[]): PairingChoice[] {
  if (api?.length)
    return api.map((p) => ({ id: p.id, name: p.name, heading: p.heading.family, body: p.body.family, note: p.mood, url: p.googleFontsUrl, headingStack: p.heading.cssStack, bodyStack: p.body.cssStack }));
  return FONT_PAIRINGS.map((p) => ({
    id: p.id,
    name: p.name,
    heading: p.heading,
    body: p.body,
    note: p.note,
    url: null,
    headingStack: p.heading === "system-ui" ? "system-ui, sans-serif" : `"${p.heading}", ${p.headingCategory === "sans" ? "sans-serif" : "serif"}`,
    bodyStack: p.body === "system-ui" ? "system-ui, sans-serif" : `"${p.body}", sans-serif`,
  }));
}

export function usePairingFonts(list: PairingChoice[]) {
  useEffect(() => {
    for (const p of list) {
      if (p.url) loadGoogleFont(`pair-${p.id}`, p.url);
      else if (p.heading !== "system-ui") {
        loadGoogleFont(p.heading, googleFontUrl(p.heading));
        loadGoogleFont(p.body, googleFontUrl(p.body));
      }
    }
  }, [list]);
}

export function FontPairingPicker({
  pairings,
  value,
  templateDefault,
  canChoose,
  onPick,
  onLocked,
  hotelName,
  lockPlan,
}: {
  pairings: PairingChoice[];
  value: string | null;
  templateDefault: string;
  canChoose: boolean;
  onPick: (id: string | null) => void;
  onLocked: () => void;
  hotelName: string;
  lockPlan: { code: string; name: string };
}) {
  usePairingFonts(pairings);
  const current = value ?? templateDefault;
  return (
    <div role="radiogroup" aria-label="Font pairing" className="flex flex-col gap-2.5">
      {pairings.map((p) => {
        const on = p.id === current;
        const isDefault = p.id === templateDefault;
        const locked = !canChoose && !isDefault;
        return (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={on}
            data-testid={`pairing-${p.id}`}
            onClick={() => (locked ? onLocked() : onPick(isDefault ? null : p.id))}
            className={cn(
              "group relative flex flex-col gap-2 overflow-hidden rounded-md border bg-surface px-4 pb-3 pt-3.5 text-left transition-[border-color,box-shadow]",
              on ? "border-ink shadow-[0_0_0_1px_var(--ink)]" : "border-line hover:border-line-strong",
              locked && "opacity-60",
            )}
          >
            <span className="block truncate text-[24px] leading-[1.08] text-ink" style={{ fontFamily: p.headingStack }}>
              {hotelName}
            </span>
            <span className="block text-[13px] leading-snug text-ink-muted" style={{ fontFamily: p.bodyStack }}>
              Twelve quiet rooms, a garden bar and breakfast until eleven. Pickups from the airport and Jibowu.
            </span>
            <span className="mt-1 flex items-center gap-2 border-t border-dashed border-line pt-2">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11.5px] font-medium text-ink">{p.name}</span>
                <span className="block truncate text-[11px] text-ink-muted">{p.note}</span>
              </span>
              {isDefault && <span className="shrink-0 font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-faint">Template default</span>}
              {locked && (
                <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-brass">
                  <LockSimple size={11} weight="bold" /> {lockPlan.name}
                </span>
              )}
              {on && <CheckCircle size={15} weight="fill" className="shrink-0 text-laterite" />}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- */
/* Sections                                                          */
/* ---------------------------------------------------------------- */

function sectionTitle(s: ThemeSection) {
  const meta = sectionMeta(s.key);
  if (s.key !== "custom-text") return meta.name;
  const t = String((s.options as { title?: string }).title ?? "").trim();
  return t || `${meta.name} ${s.id.split("-").pop()}`;
}

export function SectionList({
  sections,
  onChange,
  allowed,
  disabled,
  optionsOnly,
}: {
  sections: ThemeSection[];
  onChange: (s: ThemeSection[]) => void;
  /** keys the template can render */
  allowed: string[] | null;
  /** plan without site_sections: order and switches are locked, wording still editable */
  disabled?: boolean;
  optionsOnly?: boolean;
}) {
  const ordered = [...sections].sort((a, b) => a.order - b.order);
  const [open, setOpen] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const renumber = (list: ThemeSection[]) => list.map((s, i) => ({ ...s, order: i }));
  const structure = !disabled && !optionsOnly;
  const sort = useSortable({
    count: ordered.length,
    onMove: (from, to) => {
      if (!structure) return;
      onChange(renumber(arrayMove(ordered, from, to)));
      setAnnounce(`${sectionTitle(ordered[from])} moved to position ${to + 1} of ${ordered.length}`);
    },
  });
  const customCount = ordered.filter((s) => s.key === "custom-text").length;
  const missing = SECTIONS.filter((m) => m.key !== "custom-text" && !ordered.some((s) => s.key === m.key) && (!allowed || allowed.includes(m.key)));
  const patch = (id: string, p: Partial<ThemeSection>) => onChange(ordered.map((s) => (s.id === id ? { ...s, ...p } : s)));

  return (
    <div className={cn(disabled && "pointer-events-none select-none opacity-60")} aria-disabled={disabled || undefined}>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      <ol ref={(el) => sort.bindList(el)} className="flex flex-col gap-1.5" data-testid="section-list">
        {ordered.map((s, i) => {
          const meta = sectionMeta(s.key);
          const isOpen = open === s.id;
          const hasOptions = meta.options.length > 0;
          const title = sectionTitle(s);
          return (
            <li
              key={s.id}
              data-sort-row
              data-section={s.id}
              style={sort.rowStyle(i)}
              className={cn("rounded-md border bg-surface", sort.dragging === i ? "border-ink shadow-float" : "border-line", !s.enabled && "bg-surface-2/40")}
            >
              <div className="flex items-center gap-2 py-2 pl-1.5 pr-2.5">
                {structure ? (
                  <button
                    type="button"
                    {...sort.handle(i)}
                    aria-label={`Move ${title}, position ${i + 1} of ${ordered.length}. Use the arrow keys.`}
                    className="grid h-8 w-6 shrink-0 cursor-grab place-items-center rounded-sm text-ink-faint hover:bg-surface-2 hover:text-ink active:cursor-grabbing"
                  >
                    <DotsSixVertical size={16} weight="bold" />
                  </button>
                ) : (
                  <span className="w-6 shrink-0 text-center font-mono text-[11px] text-ink-faint">{i + 1}</span>
                )}
                <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-sm border border-line", s.enabled ? "text-laterite" : "text-ink-faint")}>
                  <CatalogIcon name={meta.icon} size={14} weight="duotone" />
                </span>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => hasOptions && setOpen(isOpen ? null : s.id)} aria-expanded={hasOptions ? isOpen : undefined}>
                  <span className={cn("block truncate text-[13.5px] font-medium", s.enabled ? "text-ink" : "text-ink-muted")}>{title}</span>
                  <span className="block truncate text-[11.5px] text-ink-muted">{meta.description}</span>
                </button>
                {hasOptions && (
                  <button type="button" onClick={() => setOpen(isOpen ? null : s.id)} aria-label={`${isOpen ? "Close" : "Open"} ${title} options`} className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-ink-muted hover:bg-surface-2">
                    <CaretDown size={13} className={cn("transition-transform", isOpen && "rotate-180")} />
                  </button>
                )}
                {meta.fixed || !structure ? (
                  <Tip content={meta.fixed ? "Always shown" : s.enabled ? "Shown" : "Hidden"}>
                    <span className="grid h-[22px] w-[38px] shrink-0 place-items-center text-ink-faint">
                      <LockSimple size={13} />
                    </span>
                  </Tip>
                ) : (
                  <Switch checked={s.enabled} onChange={(v) => patch(s.id, { enabled: v })} ariaLabel={`Show ${title}`} />
                )}
              </div>
              {isOpen && (
                <div className="border-t border-dashed border-line px-3.5 pb-3.5 pt-3">
                  <SectionOptions fields={meta.options} values={s.options} onChange={(o) => patch(s.id, { options: o })} />
                  {s.key === "custom-text" && structure && (
                    <Button size="sm" variant="ghost" className="mt-2 text-danger" onClick={() => onChange(renumber(ordered.filter((x) => x.id !== s.id)))}>
                      <Trash size={13} /> Remove this block
                    </Button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>
      {structure && (
        <div className="mt-3 flex flex-wrap gap-2">
          {customCount < 3 && (!allowed || allowed.includes("custom-text")) && (
            <Button
              size="sm"
              variant="secondary"
              data-testid="add-text-block"
              onClick={() => {
                const n = [1, 2, 3].find((k) => !ordered.some((s) => s.id === `custom-text-${k}`)) ?? customCount + 1;
                const id = `custom-text-${n}`;
                onChange(renumber([...ordered, { id, key: "custom-text", enabled: true, order: ordered.length, options: { title: "", body: "" } }]));
                setOpen(id);
              }}
            >
              <Plus size={13} /> Text block <span className="font-mono text-[11px] text-ink-faint">{customCount}/3</span>
            </Button>
          )}
          {missing.map((m) => (
            <Button key={m.key} size="sm" variant="ghost" onClick={() => onChange(renumber([...ordered, { id: m.key, key: m.key, enabled: true, order: ordered.length, options: defaultOptions(m.key) }]))}>
              <Plus size={13} /> {m.name}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function defaultOptions(key: string): Record<string, unknown> {
  const meta = sectionMeta(key);
  return meta.options.some((o) => o.kind === "items") ? { items: [] } : {};
}

function SectionOptions({ fields, values, onChange }: { fields: SectionOptionField[]; values: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  if (!fields.length) return null;
  const set = (k: string, v: unknown) => onChange({ ...values, [k]: v === "" ? undefined : v });
  return (
    <div className="flex flex-col gap-3">
      {fields.map((f) => {
        const v = values[f.key];
        if (f.kind === "items") return <ItemsEditor key={f.key} field={f} items={(Array.isArray(v) ? v : []) as Record<string, string>[]} onChange={(items) => onChange({ ...values, items })} />;
        if (f.kind === "toggle") return <Switch key={f.key} checked={v === undefined ? f.defaultOn !== false : v !== false} onChange={(x) => set(f.key, x)} label={<span className="text-[13px]">{f.label}</span>} />;
        if (f.kind === "select")
          return (
            <Field key={f.key} label={f.label}>
              <Select value={String(v ?? f.choices[0].value)} onChange={(e) => set(f.key, f.key === "months" ? Number(e.target.value) : e.target.value)}>
                {f.choices.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          );
        if (f.kind === "number")
          return (
            <Field key={f.key} label={f.label} hint={f.min != null ? `${f.min} to ${f.max}` : undefined}>
              <Input type="number" inputMode="numeric" min={f.min} max={f.max} value={v == null ? "" : String(v)} onChange={(e) => set(f.key, e.target.value === "" ? undefined : Number(e.target.value))} className="w-28 font-mono" />
            </Field>
          );
        if (f.kind === "textarea")
          return (
            <Field key={f.key} label={f.label} hint={f.max ? `${String(v ?? "").length} / ${f.max}` : undefined}>
              <Textarea value={String(v ?? "")} maxLength={f.max} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
            </Field>
          );
        return (
          <Field key={f.key} label={f.label}>
            <Input value={String(v ?? "")} maxLength={f.max} placeholder={f.placeholder} onChange={(e) => set(f.key, e.target.value)} />
          </Field>
        );
      })}
    </div>
  );
}

/** A reorderable list of small records: highlights, experiences, FAQ items. */
function ItemsEditor({ field, items, onChange }: { field: Extract<SectionOptionField, { kind: "items" }>; items: Record<string, string>[]; onChange: (v: Record<string, string>[]) => void }) {
  const sort = useSortable({ count: items.length, onMove: (a, b) => onChange(arrayMove(items, a, b)) });
  const blank = Object.fromEntries(field.itemFields.map((f) => [f.key, ""]));
  return (
    <div className="flex flex-col gap-2" data-testid={`items-${field.noun}`}>
      <span className="text-[13px] font-medium text-ink">{field.label}</span>
      <ol ref={(el) => sort.bindList(el)} className="flex flex-col gap-2">
        {items.map((it, i) => (
          <li key={i} data-sort-row style={sort.rowStyle(i)} className="flex gap-1.5 rounded-sm border border-line bg-surface p-2">
            <button type="button" {...sort.handle(i)} aria-label={`Move ${field.noun} ${i + 1}`} className="grid w-5 shrink-0 cursor-grab place-items-center text-ink-faint hover:text-ink">
              <DotsSixVertical size={14} weight="bold" />
            </button>
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {field.itemFields.map((f) =>
                f.multiline ? (
                  <Textarea key={f.key} value={it[f.key] ?? ""} maxLength={f.max} placeholder={f.placeholder} aria-label={`${f.label} ${i + 1}`} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, [f.key]: e.target.value } : x)))} className="min-h-16" />
                ) : (
                  <Input key={f.key} value={it[f.key] ?? ""} maxLength={f.max} placeholder={f.placeholder} aria-label={`${f.label} ${i + 1}`} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, [f.key]: e.target.value } : x)))} className="h-9" />
                ),
              )}
            </div>
            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={`Remove ${field.noun} ${i + 1}`} className="grid h-7 w-7 shrink-0 place-items-center rounded-sm text-ink-faint hover:bg-danger-wash hover:text-danger">
              <Trash size={13} />
            </button>
          </li>
        ))}
      </ol>
      <Button size="sm" variant="secondary" className="self-start" onClick={() => onChange([...items, { ...blank }])} disabled={items.length >= field.max} data-testid={`add-${field.noun}`}>
        <Plus size={13} /> Add a {field.noun} <span className="font-mono text-[11px] text-ink-faint">{items.length}/{field.max}</span>
      </Button>
    </div>
  );
}

export function PlanTag({ plan }: { plan: { code: string; name: string } }) {
  return <PlanPlate name={plan.name} code={plan.code} />;
}

export { templateMeta };
