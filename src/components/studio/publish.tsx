"use client";

import { ArrowCounterClockwise, ArrowRight, CheckCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatDateTime, relativeTime } from "@/lib/format";
import { pairingMeta, sectionMeta, templateMeta } from "@/lib/m7-catalog";
import type { ThemeContent, ThemeVersionItem } from "@/lib/api/types-m7";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, Sheet } from "@/components/ui/overlay";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { TemplateThumb } from "./template-thumb";

export interface Change {
  label: string;
  from?: React.ReactNode;
  to?: React.ReactNode;
  note?: string;
}

const MODE = { LIGHT: "Light", DARK: "Dark", SYSTEM: "Follows the guest's phone" } as const;

function Swatch({ hex }: { hex: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[12px]">
      <span className="h-3 w-3 rounded-full border border-black/10" style={{ background: hex }} />
      {hex.toUpperCase()}
    </span>
  );
}

/** What publishing the draft will change, in the order a person reads a page. */
export function themeChanges(live: ThemeContent | null, draft: ThemeContent): Change[] {
  if (!live) return [{ label: "First publish", note: "Your booking site goes out with this design." }];
  const out: Change[] = [];
  if (live.templateId !== draft.templateId) out.push({ label: "Template", from: templateMeta(live.templateId).name, to: templateMeta(draft.templateId).name });
  if (live.brand.primary.toUpperCase() !== draft.brand.primary.toUpperCase()) out.push({ label: "Primary colour", from: <Swatch hex={live.brand.primary} />, to: <Swatch hex={draft.brand.primary} /> });
  const ls = live.brand.secondary ?? "#B98A2E";
  const ds = draft.brand.secondary ?? "#B98A2E";
  if (ls.toUpperCase() !== ds.toUpperCase()) out.push({ label: "Secondary colour", from: <Swatch hex={ls} />, to: <Swatch hex={ds} /> });
  const lf = live.brand.fontPairingId ?? templateMeta(live.templateId).defaultFontPairing;
  const df = draft.brand.fontPairingId ?? templateMeta(draft.templateId).defaultFontPairing;
  if (lf !== df) out.push({ label: "Fonts", from: pairingMeta(lf).name, to: pairingMeta(df).name });
  if ((live.brand.logoAssetId ?? live.brand.logoUrl) !== (draft.brand.logoAssetId ?? draft.brand.logoUrl))
    out.push({ label: "Logo", note: !draft.brand.logoUrl && !draft.brand.logoAssetId ? "Removed; your name is shown instead" : live.brand.logoUrl || live.brand.logoAssetId ? "Replaced" : "Added" });
  if ((live.brand.faviconAssetId ?? live.brand.faviconUrl) !== (draft.brand.faviconAssetId ?? draft.brand.faviconUrl)) out.push({ label: "Favicon", note: draft.brand.faviconUrl || draft.brand.faviconAssetId ? "New icon in the browser tab" : "Removed" });
  if (live.colourMode !== draft.colourMode) out.push({ label: "Colour mode", from: MODE[live.colourMode], to: MODE[draft.colourMode] });

  const on = (t: ThemeContent) => new Map(t.sections.map((s) => [s.id, s]));
  const L = on(live);
  const D = on(draft);
  const name = (k: string) => (k.startsWith("custom-text") ? `Text block ${k.split("-").pop()}` : sectionMeta(k).name);
  const shown = [...D.values()].filter((s) => s.enabled && !L.get(s.id)?.enabled).map((s) => name(s.id));
  const hidden = [...L.values()].filter((s) => s.enabled && !D.get(s.id)?.enabled).map((s) => name(s.id));
  if (shown.length) out.push({ label: "Now shown", note: shown.join(", ") });
  if (hidden.length) out.push({ label: "Now hidden", note: hidden.join(", ") });
  const ord = (t: ThemeContent) => [...t.sections].filter((s) => s.enabled).sort((a, b) => a.order - b.order).map((s) => s.id);
  const lo = ord(live).filter((k) => D.get(k)?.enabled);
  const dor = ord(draft).filter((k) => L.get(k)?.enabled);
  if (lo.join() !== dor.join()) {
    const moved = dor.filter((k, i) => lo.indexOf(k) !== i).map(name);
    out.push({ label: "New order", note: moved.slice(0, 4).join(", ") + (moved.length > 4 ? ` and ${moved.length - 4} more` : "") });
  }
  const edited = [...D.values()].filter((s) => L.has(s.id) && JSON.stringify(L.get(s.id)!.options ?? {}) !== JSON.stringify(s.options ?? {})).map((s) => name(s.id));
  if (edited.length) out.push({ label: "Wording and options", note: edited.join(", ") });
  return out;
}

export function ChangeList({ changes, testId }: { changes: Change[]; testId?: string }) {
  return (
    <ul className="flex flex-col divide-y divide-dashed divide-line rounded-md border border-line" data-testid={testId}>
      {changes.map((c, i) => (
        <li key={i} className="grid grid-cols-[120px_minmax(0,1fr)] items-baseline gap-3 px-3.5 py-2.5 text-[13px] max-sm:grid-cols-1 max-sm:gap-1">
          <span className="eyebrow text-[10px]">{c.label}</span>
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-ink">
            {c.from !== undefined && <span className="text-ink-muted line-through decoration-ink-faint">{c.from}</span>}
            {c.from !== undefined && <ArrowRight size={12} className="text-ink-faint" />}
            {c.to !== undefined && <span className="font-medium">{c.to}</span>}
            {c.note && <span className={cn(c.to !== undefined && "text-ink-muted")}>{c.note}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function PublishDialog({
  open,
  onOpenChange,
  changes,
  onPublish,
  what,
  host,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  changes: Change[];
  onPublish: () => Promise<unknown>;
  what: string;
  host?: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Publish"
      title={`Put the new ${what} live?`}
      description={host ? <>Guests see it on <span className="font-mono text-ink">{host}</span> as soon as you publish. You can revert from the history.</> : "Guests see it as soon as you publish. You can revert from the history."}
      className="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Keep editing
          </Button>
          <Button
            loading={busy}
            data-testid="confirm-publish"
            onClick={async () => {
              setBusy(true);
              try {
                await onPublish();
                onOpenChange(false);
              } catch {
                /* surfaced by the mutation handler */
              } finally {
                setBusy(false);
              }
            }}
          >
            <CheckCircle size={15} weight="bold" /> Publish
          </Button>
        </>
      }
    >
      <p className="mb-2.5 text-[12.5px] text-ink-muted">{changes.length === 1 ? "1 change" : `${changes.length} changes`} since the last publish</p>
      <ChangeList changes={changes} testId="publish-diff" />
    </Dialog>
  );
}

export function ThemeHistorySheet({
  open,
  onOpenChange,
  items,
  loading,
  onRevert,
  primarySecondary,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  items: ThemeVersionItem[] | undefined;
  loading: boolean;
  onRevert: (id: string) => Promise<unknown>;
  primarySecondary: string;
}) {
  const [confirm, setConfirm] = useState<ThemeVersionItem | null>(null);
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange} eyebrow="Booking site" title="Published versions" description="The last 20 publishes. Reverting publishes that version again as a new one and resets the draft to it; the history is never rewritten.">
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : !items?.length ? (
          <EmptyState compact title="Nothing published yet" body="Your first publish starts the history." />
        ) : (
          <ol className="relative flex flex-col" data-testid="theme-history">
            <span aria-hidden className="absolute bottom-4 left-[27px] top-4 w-px bg-line" />
            {items.map((h) => (
              <li key={h.id} className="relative flex items-center gap-3 py-2">
                <span className="relative z-[1] h-10 w-14 shrink-0 overflow-hidden rounded-xs border border-line bg-surface">
                  <TemplateThumb id={h.templateId} primary={h.primary} secondary={primarySecondary} className="h-full w-full" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13.5px] text-ink">
                    <span className="font-mono text-[12px] text-ink-muted">v{h.version}</span>
                    <span className="font-medium">{templateMeta(h.templateId).name}</span>
                    {h.isCurrent && <span className="rounded-xs bg-palm-wash px-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-palm">Live</span>}
                  </p>
                  <p className="truncate text-[12px] text-ink-muted" title={formatDateTime(h.publishedAt)}>
                    {h.publishedBy?.fullName ?? "Someone"}, {relativeTime(h.publishedAt)}
                  </p>
                </div>
                {!h.isCurrent && (
                  <Button size="sm" variant="secondary" onClick={() => setConfirm(h)} data-testid={`revert-${h.version}`}>
                    <ArrowCounterClockwise size={13} /> Revert
                  </Button>
                )}
              </li>
            ))}
          </ol>
        )}
      </Sheet>
      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={`Make version ${confirm?.version ?? ""} live again?`}
        body="Guests see it straight away, and the studio draft goes back to it too."
        confirmLabel="Revert"
        onConfirm={() => (confirm ? onRevert(confirm.id) : undefined)}
      />
    </>
  );
}
