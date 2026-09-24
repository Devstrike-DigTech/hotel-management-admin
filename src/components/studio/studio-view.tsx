"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowSquareOut,
  CheckCircle,
  ClockCounterClockwise,
  Eye,
  Layout,
  PaintBrush,
  PencilSimple,
  Rows,
  TextAa,
  WarningCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useEntitlements } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import { usePropertyScope } from "@/components/shell/property-switcher";
import { siteApi } from "@/lib/api/endpoints-m7";
import { qk7, useFontPairings, usePreviewToken, useSiteTemplates, useSiteTheme, useThemeVersions } from "@/lib/api/hooks-m7";
import { isApiError } from "@/lib/api/client";
import { handleMutationError } from "@/components/providers";
import { PLAN_NAMES } from "@/lib/catalog";
import type { SiteThemeState, ThemeBrand, ThemeContent, ThemeDraftInput } from "@/lib/api/types-m7";
import { openUpgrade, toast } from "@/lib/store";
import { relativeTime } from "@/lib/format";
import { templateMeta, type TemplateId } from "@/lib/m7-catalog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/overlay";
import { ErrorState, Segmented, Skeleton } from "@/components/ui/primitives";
import { AdireGlyph } from "@/components/motifs/adire";
import {
  AssetDrop,
  ColourModeControl,
  ColourPicker,
  FontPairingPicker,
  LockNote,
  PaletteProof,
  PanelIntro,
  SectionList,
  pairingChoices,
  TemplateGallery,
} from "./panels";
import { DeviceToggle, PreviewFrame, type Device } from "./preview-frame";
import { PublishDialog, ThemeHistorySheet, themeChanges } from "./publish";

type Tab = "template" | "brand" | "type" | "sections";
const TABS: { v: Tab; label: string; icon: React.ReactNode }[] = [
  { v: "template", label: "Template", icon: <Layout size={15} /> },
  { v: "brand", label: "Colours & logo", icon: <PaintBrush size={15} /> },
  { v: "type", label: "Type", icon: <TextAa size={15} /> },
  { v: "sections", label: "Sections", icon: <Rows size={15} /> },
];

function content(v: ThemeContent): ThemeContent {
  return { templateId: v.templateId, brand: v.brand, sections: v.sections, colourMode: v.colourMode, applied: v.applied, fontPairing: v.fontPairing };
}

type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: number } | { kind: "error"; message: string };

export function StudioView() {
  const q = useSiteTheme();
  const { can } = useCan();
  const manage = can("site.manage");
  if (q.isError) return <div className="p-6"><ErrorState error={q.error} onRetry={() => q.refetch()} title="Brand Studio didn't load" /></div>;
  if (!q.data) return <StudioSkeleton />;
  return <Studio key={q.data.themeId} state={q.data} manage={manage} />;
}

function StudioSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col lg:min-h-0">
      <div className="h-[68px] border-b border-line bg-surface" />
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[420px] shrink-0 flex-col gap-3 border-r border-line bg-surface p-5 lg:flex">
          <Skeleton className="h-9" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
        <div className="studio-stage flex-1" />
      </div>
    </div>
  );
}

const planOf = (code: string | undefined) => ({ code: code ?? "growth", name: PLAN_NAMES[code ?? "growth"] ?? "Growth" });

function Studio({ state, manage }: { state: SiteThemeState; manage: boolean }) {
  const qc = useQueryClient();
  const { me } = useEntitlements();
  const scope = usePropertyScope();
  const templates = useSiteTemplates();
  const pairingsQ = useFontPairings();
  const [d, setD] = useState<ThemeContent>(() => content(state.draft));
  const [tab, setTab] = useState<Tab>("template");
  const [device, setDevice] = useState<Device>("desktop");
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [version, setVersion] = useState(0);
  const [publishOpen, setPublishOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [uploading, setUploading] = useState<"logo" | "favicon" | null>(null);
  const pending = useRef(0);
  const timer = useRef<number | null>(null);
  const patchRef = useRef<ThemeDraftInput>({});

  const preview = usePreviewToken(true);
  const versions = useThemeVersions(historyOpen);
  const live = state.published ? content(state.published) : null;
  const gates = state.gates;
  const canAll = !!gates.features.site_templates_all;
  const canSections = !!gates.features.site_sections;
  const canFonts = !!gates.features.site_fonts;
  const hotelName = scope.current?.name ?? me?.tenant.name ?? "Your hotel";
  const host = state.siteUrl?.replace(/^https?:\/\//, "").replace(/\/$/, "") || "your booking site";
  const pairings = useMemo(() => pairingChoices(pairingsQ.data), [pairingsQ.data]);

  useEffect(() => {
    const read = () => {
      const h = window.location.hash.replace("#", "") as Tab;
      if (TABS.some((t) => t.v === h)) setTab(h);
    };
    read();
    // links such as /site#type from the palette change only the hash
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const go = (t: Tab) => {
    setTab(t);
    try {
      window.history.replaceState(null, "", `#${t}`);
    } catch {
      /* ignore */
    }
  };

  const apply = useCallback((s: SiteThemeState) => qc.setQueryData(qk7.theme, s), [qc]);

  const flush = useCallback(async () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const body = patchRef.current;
    patchRef.current = {};
    if (!Object.keys(body).length) return;
    const mine = ++pending.current;
    setSave({ kind: "saving" });
    try {
      const s = await siteApi.saveDraft(body);
      apply(s);
      if (mine === pending.current && !Object.keys(patchRef.current).length) {
        // nothing newer typed meanwhile: take the server's draft (sections for the template, applied colours)
        setD(content(s.draft));
        setSave({ kind: "saved", at: Date.now() });
        setVersion((v) => v + 1);
      }
    } catch (e) {
      if (mine === pending.current) {
        handleMutationError(e, { errorTitle: "Draft not saved" });
        setSave({ kind: "error", message: isApiError(e) && e.isEntitlement ? "Not on your plan" : "Not saved" });
        // show the server's draft again so the studio never pretends
        void qc.invalidateQueries({ queryKey: qk7.theme }).then(() => {
          const s = qc.getQueryData<SiteThemeState>(qk7.theme);
          if (s) setD(content(s.draft));
        });
      }
    }
  }, [apply, qc]);

  const change = (local: Partial<ThemeContent>, patch: ThemeDraftInput) => {
    if (!manage) return;
    setD((cur) => ({ ...cur, ...local }));
    const prev = patchRef.current;
    patchRef.current = { ...prev, ...patch, ...(patch.brand || prev.brand ? { brand: { ...prev.brand, ...patch.brand } } : {}) };
    setSave({ kind: "saving" });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 650);
  };
  const setBrand = (b: Partial<ThemeBrand>) => change({ brand: { ...d.brand, ...b } }, { brand: b });
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const changes = useMemo(() => {
    const c = themeChanges(live, d);
    return c.length ? c : state.changes.map((x) => ({ label: "Change", note: x }));
  }, [live, d, state.changes]);
  const dirty = state.hasUnpublishedChanges || save.kind === "saving";

  const publish = useMutation({
    mutationFn: async () => {
      if (timer.current || Object.keys(patchRef.current).length) await flush();
      return siteApi.publish();
    },
    onSuccess: (s) => {
      apply(s);
      setD(content(s.draft));
      void qc.invalidateQueries({ queryKey: qk7.themeVersions });
      toast.success("Your booking site is updated", `${templateMeta(s.published?.templateId).name} is live on ${host}.`);
      setVersion((v) => v + 1);
    },
    meta: { errorTitle: "Not published" },
  });
  const discard = useMutation({
    mutationFn: siteApi.discard,
    onSuccess: (s) => {
      apply(s);
      setD(content(s.draft));
      setVersion((v) => v + 1);
      toast.info("Draft discarded", "The studio shows what guests see now.");
    },
    meta: { errorTitle: "Draft not discarded" },
  });
  const revert = useMutation({
    mutationFn: (id: string) => siteApi.revert(id),
    onSuccess: (s) => {
      apply(s);
      setD(content(s.draft));
      void qc.invalidateQueries({ queryKey: qk7.themeVersions });
      toast.success(`Version ${s.published?.version ?? ""} is live`);
      setVersion((v) => v + 1);
    },
    meta: { errorTitle: "Not reverted" },
  });

  const upload = async (kind: "logo" | "favicon", f: File) => {
    const cap = kind === "logo" ? 2 * 1024 * 1024 : 256 * 1024;
    if (f.size > cap) {
      toast.error("That file is too big", kind === "logo" ? "Logos can be up to 2 MB." : "Tab icons can be up to 256 KB.");
      return;
    }
    setUploading(kind);
    try {
      const a = await siteApi.upload(kind, f);
      setBrand(kind === "logo" ? { logoAssetId: a.id, logoUrl: a.url } : { faviconAssetId: a.id, faviconUrl: a.url });
    } catch (e) {
      toast.error("Upload failed", e instanceof Error ? e.message : undefined);
    } finally {
      setUploading(null);
    }
  };

  const tplInfo = templates.data?.find((t) => t.id === d.templateId);
  const isAvailable = (id: string) => gates.templates.find((t) => t.id === id)?.available ?? (canAll || templateMeta(id).starter);
  const templatesPlan = planOf(gates.requiredPlans.site_templates_all);
  const sectionsPlan = planOf(gates.requiredPlans.site_sections);
  const fontsPlan = planOf(gates.requiredPlans.site_fonts);
  const defaultPairing = tplInfo?.defaultFontPairingId ?? templateMeta(d.templateId).defaultFontPairing;
  const pairing = pairings.find((p) => p.id === (d.brand.fontPairingId ?? defaultPairing)) ?? pairings[0];
  const appliedFor = (role: "primary" | "secondary") => {
    const a = d.applied;
    if (!a) return null;
    const chosen = role === "primary" ? a.chosen.primary : a.chosen.secondary;
    const now = role === "primary" ? d.brand.primary : d.brand.secondary;
    if (!chosen || !now || chosen.toUpperCase() !== now.toUpperCase()) return null;
    return role === "primary"
      ? { onFill: a.light.onPrimary, light: a.light.primaryText, dark: a.dark.primaryText }
      : { onFill: a.light.onSecondary, light: a.light.secondaryText, dark: a.dark.secondaryText };
  };

  const pickTemplate = (id: TemplateId) => {
    const t = templates.data?.find((x) => x.id === id);
    const local: Partial<ThemeContent> = { templateId: id };
    const patch: ThemeDraftInput = { templateId: id, resetSections: true };
    if (t) local.sections = t.defaultSections;
    if (!canFonts && d.brand.fontPairingId) {
      local.brand = { ...d.brand, fontPairingId: null };
      patch.brand = { fontPairingId: null };
    }
    if (!canSections && t) {
      local.colourMode = t.defaultColourMode;
      patch.colourMode = t.defaultColourMode;
    }
    change(local, patch);
  };

  const statusLine =
    save.kind === "saving" ? (
      <span className="inline-flex items-center gap-1.5 text-ink-muted">
        <span className="h-1.5 w-1.5 animate-[breathe_1s_ease-in-out_infinite] rounded-full bg-ochre" /> Saving the draft
      </span>
    ) : save.kind === "error" ? (
      <span className="inline-flex items-center gap-1.5 text-danger">
        <WarningCircle size={13} weight="fill" /> {save.message}
        <button type="button" className="underline underline-offset-2" onClick={() => void flush()}>
          Retry
        </button>
      </span>
    ) : state.hasUnpublishedChanges ? (
      <span className="inline-flex items-center gap-1.5 text-ink-muted" data-testid="studio-status">
        <span className="h-1.5 w-1.5 rounded-full bg-ochre" /> Draft saved{save.kind === "saved" ? "" : state.draft.updatedAt ? `, ${relativeTime(state.draft.updatedAt)}` : ""} &middot; not live yet
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-ink-muted" data-testid="studio-status">
        <CheckCircle size={13} weight="fill" className="text-palm" /> Live{state.published?.publishedAt ? `, published ${relativeTime(state.published.publishedAt)}` : ""}
      </span>
    );

  const controls = (
    <div className="flex min-h-0 flex-1 flex-col">
      <nav aria-label="Studio sections" className="scrollbar-thin flex shrink-0 gap-0.5 overflow-x-auto border-b border-line px-3">
        {TABS.map((t) => (
          <button
            key={t.v}
            type="button"
            onClick={() => go(t.v)}
            aria-current={tab === t.v ? "page" : undefined}
            data-testid={`studio-tab-${t.v}`}
            className={cn(
              "-mb-px inline-flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-2.5 text-[13px] font-medium",
              tab === t.v ? "border-laterite text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </nav>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-4 pb-10 pt-5 sm:px-5">
        {!manage && (
          <p className="mb-4 rounded-md border border-line bg-surface-2/60 px-3 py-2 text-[12.5px] text-ink-muted">You can look around; changing the booking site is for owners and managers.</p>
        )}
        {tab === "template" && (
          <>
            <PanelIntro title="Choose a template">Six layouts over the same rooms, rates and photos. Switching keeps your colours, logo and wording.</PanelIntro>
            {!canAll && (
              <LockNote plan={templatesPlan} onUpgrade={() => openUpgrade({ kind: "feature", feature: "site_templates_all", requiredPlan: templatesPlan.code })}>
                Your plan includes Editorial and Essentials. All six are on {templatesPlan.name}.
              </LockNote>
            )}
            <TemplateGallery
              value={d.templateId}
              published={live?.templateId}
              primary={d.brand.primary}
              secondary={d.brand.secondary ?? "#B98A2E"}
              isAvailable={isAvailable}
              lockPlan={templatesPlan}
              onPick={pickTemplate}
              onLocked={() => openUpgrade({ kind: "feature", feature: "site_templates_all", requiredPlan: templatesPlan.code, message: "Boutique, Business, Resort and Heritage come with this plan." })}
            />
          </>
        )}
        {tab === "brand" && (
          <div className="flex flex-col gap-6">
            <div>
              <PanelIntro title="Logo and icon">A logo on a transparent background works on light and dark pages. Without one, we set your name in the template&rsquo;s type.</PanelIntro>
              <div className="flex flex-col gap-4">
                <AssetDrop kind="logo" label="Logo" hint="PNG, SVG or WebP, up to 2 MB." url={d.brand.logoUrl} busy={uploading === "logo"} disabled={!manage} onFile={(f) => void upload("logo", f)} onClear={() => setBrand({ logoAssetId: null, logoUrl: null })} />
                <AssetDrop kind="favicon" label="Browser tab icon" hint="A square PNG or ICO, 64 px or more." url={d.brand.faviconUrl} busy={uploading === "favicon"} disabled={!manage} onFile={(f) => void upload("favicon", f)} onClear={() => setBrand({ faviconAssetId: null, faviconUrl: null })} />
              </div>
            </div>
            <div className="border-t border-line pt-5">
              <PanelIntro title="Colours">Primary is for buttons and headings, secondary for small highlights. We check each one against light and dark pages and darken or lighten text where it wouldn&rsquo;t read.</PanelIntro>
              <div className="flex flex-col gap-6">
                <ColourPicker label="Primary" role="primary" value={d.brand.primary} disabled={!manage} testId="colour-primary" applied={appliedFor("primary")} onChange={(hex) => setBrand({ primary: hex })} />
                <ColourPicker label="Secondary" role="secondary" value={d.brand.secondary ?? "#B98A2E"} disabled={!manage} testId="colour-secondary" applied={appliedFor("secondary")} onChange={(hex) => setBrand({ secondary: hex })} />
                <PaletteProof brand={d.brand} heading={pairing.headingStack} body={pairing.bodyStack} />
              </div>
            </div>
            <div className="border-t border-line pt-5">
              <PanelIntro title="Light or dark">What guests see first. &ldquo;Follow the phone&rdquo; matches their dark mode.</PanelIntro>
              {!canSections && (
                <LockNote plan={sectionsPlan} onUpgrade={() => openUpgrade({ kind: "feature", feature: "site_sections", requiredPlan: sectionsPlan.code })}>
                  Your site follows the template&rsquo;s light pages. Dark and follow-the-phone are on {sectionsPlan.name}.
                </LockNote>
              )}
              <ColourModeControl value={d.colourMode} disabled={!canSections || !manage} onChange={(m) => change({ colourMode: m }, { colourMode: m })} />
            </div>
          </div>
        )}
        {tab === "type" && (
          <>
            <PanelIntro title="Type">Curated pairs of Google fonts, each with a heading face and a reading face that loads fast.</PanelIntro>
            {!canFonts && (
              <LockNote plan={fontsPlan} onUpgrade={() => openUpgrade({ kind: "feature", feature: "site_fonts", requiredPlan: fontsPlan.code })}>
                Your site uses the {templateMeta(d.templateId).name} template&rsquo;s pairing. Choosing your own is on {fontsPlan.name}.
              </LockNote>
            )}
            <FontPairingPicker
              pairings={pairings}
              value={d.brand.fontPairingId}
              templateDefault={defaultPairing}
              canChoose={canFonts && manage}
              hotelName={hotelName}
              lockPlan={fontsPlan}
              onPick={(id) => setBrand({ fontPairingId: id })}
              onLocked={() => openUpgrade({ kind: "feature", feature: "site_fonts", requiredPlan: fontsPlan.code })}
            />
          </>
        )}
        {tab === "sections" && (
          <>
            <PanelIntro title="Sections">Drag to reorder, switch off what you don&rsquo;t need, open one to change its words. Questions and text blocks are yours to write.</PanelIntro>
            {!canSections && (
              <LockNote plan={sectionsPlan} onUpgrade={() => openUpgrade({ kind: "feature", feature: "site_sections", requiredPlan: sectionsPlan.code })}>
                You can change the words in each section. Reordering, switching sections off and adding text blocks is on {sectionsPlan.name}.
              </LockNote>
            )}
            <SectionList sections={d.sections} allowed={tplInfo?.sections ?? null} onChange={(sections) => change({ sections }, { sections })} optionsOnly={!canSections} disabled={!manage} />
          </>
        )}
      </div>
    </div>
  );

  const empty = (
    <div className="flex max-w-xs flex-col items-center gap-3 text-center">
      <AdireGlyph kind="rings" size={48} className="text-laterite" />
      {preview.isError ? (
        <>
          <p className="display-sm text-[17px] text-ink">The preview didn&rsquo;t open</p>
          <p className="text-[13px] text-ink-muted">Your changes are still saved to the draft.</p>
          <Button size="sm" variant="secondary" onClick={() => preview.refetch()}>
            Try again
          </Button>
        </>
      ) : (
        <p className="text-[13px] text-ink-muted">Opening your booking site&hellip;</p>
      )}
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:min-h-0" data-testid="brand-studio">
      {/* toolbar */}
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="eyebrow flex items-center gap-2">
            <PaintBrush size={12} weight="duotone" /> Booking site
          </p>
          <h1 className="display-sm truncate text-[21px] leading-tight text-ink">
            Brand <em>Studio</em>
          </h1>
        </div>
        <div className="order-3 w-full text-[12px] xl:order-none xl:w-auto">{statusLine}</div>
        <DeviceToggle value={device} onChange={setDevice} className="hidden lg:inline-flex" />
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={() => setHistoryOpen(true)} data-testid="open-history">
            <ClockCounterClockwise size={15} /> <span className="hidden xl:inline">History</span>
          </Button>
          <a href={state.siteUrl} target="_blank" rel="noreferrer" className="hidden h-8 items-center gap-1.5 rounded-sm px-3 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink xl:inline-flex">
            <ArrowSquareOut size={14} /> Live site
          </a>
          {state.hasUnpublishedChanges && manage && (
            <Button variant="secondary" size="sm" onClick={() => setDiscardOpen(true)}>
              Discard
            </Button>
          )}
          {manage && (
            <Button size="sm" onClick={() => setPublishOpen(true)} disabled={!dirty || publish.isPending} loading={publish.isPending} data-testid="publish-theme">
              Publish
            </Button>
          )}
        </div>
      </div>

      {/* phone: edit or preview */}
      <div className="flex items-center justify-between border-b border-line bg-surface px-4 py-2 lg:hidden">
        <Segmented<"edit" | "preview">
          label="Studio view"
          size="sm"
          value={mobileView}
          onChange={setMobileView}
          options={[
            { value: "edit", label: "Edit", icon: <PencilSimple size={13} /> },
            { value: "preview", label: "Preview", icon: <Eye size={13} /> },
          ]}
        />
        {mobileView === "preview" && <DeviceToggle value={device} onChange={setDevice} />}
      </div>

      <div className="flex min-h-0 flex-1">
        <aside className={cn("flex min-h-0 w-full shrink-0 flex-col border-line bg-surface lg:flex lg:w-[400px] lg:border-r xl:w-[440px]", mobileView === "edit" ? "flex" : "hidden")} aria-label="Design controls">
          {controls}
        </aside>
        <section className={cn("min-h-[70dvh] min-w-0 flex-1 flex-col lg:flex lg:min-h-0", mobileView === "preview" ? "flex" : "hidden")} aria-label="Live preview">
          <PreviewFrame src={preview.data?.urls.site ?? null} device={device} host={host} version={version} busy={save.kind === "saving"} empty={empty} title={`Preview of ${hotelName}'s booking site`} />
        </section>
      </div>

      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} changes={changes} what="booking site" host={host} onPublish={() => publish.mutateAsync()} />
      <ConfirmDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        title="Discard the draft?"
        body="Everything you changed since the last publish goes. What guests see stays as it is."
        confirmLabel="Discard"
        danger
        onConfirm={() => discard.mutateAsync()}
      />
      <ThemeHistorySheet open={historyOpen} onOpenChange={setHistoryOpen} items={versions.data} loading={versions.isLoading} onRevert={(id) => revert.mutateAsync(id)} primarySecondary={d.brand.secondary ?? "#B98A2E"} />
    </div>
  );
}
