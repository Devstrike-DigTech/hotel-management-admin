"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Menu from "@radix-ui/react-dropdown-menu";
import {
  ArrowCounterClockwise,
  CheckCircle,
  ClockCounterClockwise,
  DotsThree,
  Eye,
  ListPlus,
  PencilSimple,
  SlidersHorizontal,
  Textbox,
  WarningCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useCan } from "@/lib/permissions";
import { formApi } from "@/lib/api/endpoints-m7";
import { qk7, useBookingForm, useFormLibrary, useFormVersions, usePickupPoints, usePreviewToken, useRenderedForm } from "@/lib/api/hooks-m7";
import type { BookingFormState, Channel, FormDiff, FormField } from "@/lib/api/types-m7";
import { isApiError } from "@/lib/api/client";
import { handleMutationError } from "@/components/providers";
import { openUpgrade, toast } from "@/lib/store";
import { PLAN_NAMES } from "@/lib/catalog";
import { formatDateTime, relativeTime } from "@/lib/format";
import { PRESETS, idLikeCheck } from "@/lib/m7-catalog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, Sheet } from "@/components/ui/overlay";
import { EmptyState, ErrorState, Segmented, Skeleton } from "@/components/ui/primitives";
import { Field, Input } from "@/components/ui/form";
import { CatalogIcon } from "@/components/m7/icon";
import { DeviceToggle, PreviewFrame, type Device } from "@/components/studio/preview-frame";
import { GuestFormPreview } from "@/components/guest-form/renderer";
import { FormCanvas, type DropPayload } from "./canvas";
import { LibraryPane } from "./library-pane";
import { Inspector } from "./inspector";
import { countsTowardLimit, newCustomField, sectionOrder, toInput } from "./logic";

type Lens = Channel | "ALL";
type SaveState = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

export function BuilderView() {
  const q = useBookingForm();
  const { can } = useCan();
  if (q.isError) return <div className="p-6"><ErrorState error={q.error} onRetry={() => q.refetch()} title="The form builder didn't load" /></div>;
  if (!q.data)
    return (
      <div className="flex min-h-0 flex-1 lg:min-h-0">
        <div className="hidden w-[280px] border-r border-line bg-surface lg:block" />
        <div className="flex-1 p-8">
          <Skeleton className="mx-auto h-[70vh] max-w-2xl" />
        </div>
      </div>
    );
  return <Builder key={q.data.id} state={q.data} editable={can("forms.manage")} />;
}

const planOf = (code: string | undefined) => ({ code: code ?? "growth", name: PLAN_NAMES[code ?? "growth"] ?? "Growth" });

function Builder({ state, editable }: { state: BookingFormState; editable: boolean }) {
  const qc = useQueryClient();
  const lib = useFormLibrary();
  const points = usePickupPoints(!!state.gates.features.paid_extras);
  const [fields, setFields] = useState<FormField[]>(() => state.draft.fields);
  const [selected, setSelected] = useState<string | null>(null);
  const [lens, setLens] = useState<Lens>("ALL");
  const [mode, setMode] = useState<"build" | "preview">("build");
  const [pane, setPane] = useState<"library" | "form" | "field">("form");
  const [device, setDevice] = useState<Device>("phone");
  const [save, setSave] = useState<SaveState>({ kind: "idle" });
  const [issues, setIssues] = useState<Record<string, string>>({});
  const [publishOpen, setPublishOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [presetOpen, setPresetOpen] = useState<string | null>(null);
  const [previewVersion, setPreviewVersion] = useState(0);
  const timer = useRef<number | null>(null);
  const latest = useRef(fields);
  const seq = useRef(0);
  const dirtyLocal = useRef(false);
  useEffect(() => {
    latest.current = fields;
  }, [fields]);

  const gates = state.gates;
  const canConditions = !!gates.features.form_conditional_logic;
  const canFiles = !!gates.features.form_file_uploads;
  const max = gates.limits.max_custom_form_fields;
  const used = fields.filter(countsTowardLimit).length;
  const planFor = (feature: string) => planOf(gates.requiredPlans[feature]);
  const locked = (feature: string) => openUpgrade({ kind: "feature", feature, requiredPlan: gates.requiredPlans[feature] });
  const limitHit = () => openUpgrade({ kind: "limit", limit: "max_custom_form_fields", max, current: used, upgradePlan: gates.requiredPlans.form_fields_unlimited ?? "growth" });

  const warnings = useMemo(() => Object.fromEntries(state.warnings.filter((w) => w.code === "ID_LIKE").map((w) => [w.fieldKey, "Better asked at check-in, on the register card."])), [state.warnings]);

  const apply = useCallback((s: BookingFormState) => qc.setQueryData(qk7.form, s), [qc]);

  const flush = useCallback(async () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    const cur = latest.current;
    // never send a BVN label; the inspector already says why
    if (cur.some((f) => idLikeCheck(`${f.label} ${f.helpText ?? ""}`)?.level === "block")) {
      setSave({ kind: "error", message: "Not saved: a question asks for BVN" });
      return;
    }
    const { fields: body, renamed } = toInput(cur);
    const mine = ++seq.current;
    dirtyLocal.current = false;
    setSave({ kind: "saving" });
    try {
      const s = await formApi.saveDraft(body);
      apply(s);
      setIssues({});
      if (mine === seq.current && !dirtyLocal.current) {
        setFields(s.draft.fields);
        setSelected((k) => (k && renamed[k] ? renamed[k] : k));
        setSave({ kind: "saved" });
        setPreviewVersion((v) => v + 1);
        void qc.invalidateQueries({ queryKey: qk7.library });
        void qc.invalidateQueries({ queryKey: ["booking-form", "render"] });
      }
    } catch (e) {
      if (mine !== seq.current) return;
      if (isApiError(e) && e.code === "VALIDATION_ERROR") {
        const list = ((e.details as { issues?: { path: string; fieldKey: string | null; message: string }[] })?.issues ?? []);
        const map: Record<string, string> = {};
        for (const i of list) {
          const idx = /^fields\[(\d+)\]/.exec(i.path)?.[1];
          const key = i.fieldKey ?? (idx !== undefined ? body[Number(idx)]?.key : undefined);
          const k = Object.entries(renamed).find(([, v]) => v === key)?.[0] ?? key;
          if (k) map[k] = i.message;
        }
        setIssues(map);
        setSave({ kind: "error", message: list.length ? "Check the marked questions" : e.message });
        return;
      }
      handleMutationError(e, { errorTitle: "The form wasn't saved" });
      setSave({ kind: "error", message: isApiError(e) && e.isEntitlement ? "Not on your plan" : "Not saved" });
      // go back to what the server has
      const s = qc.getQueryData<BookingFormState>(qk7.form);
      if (s) setFields(s.draft.fields);
    }
  }, [apply, qc]);

  const commit = (next: FormField[]) => {
    if (!editable) return;
    setFields(next);
    dirtyLocal.current = true;
    setSave({ kind: "saving" });
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void flush(), 700);
  };
  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current);
    },
    [],
  );

  const sections = sectionOrder(fields);
  const insert = (added: FormField[], section: string, index?: number) => {
    const sorted = [...fields].sort((a, b) => a.order - b.order);
    const at = index ?? (() => {
      // after the last field of that section
      let last = -1;
      sorted.forEach((f, i) => f.section === section && (last = i));
      return last >= 0 ? last + 1 : sorted.length;
    })();
    const next = [...sorted.slice(0, at), ...added.map((f) => ({ ...f, section })), ...sorted.slice(at)].map((f, i) => ({ ...f, order: i }));
    commit(next);
    setSelected(added[0].key);
    setPane("field");
  };

  const add = (p: DropPayload, section?: string, index?: number) => {
    const target = section ?? (selected ? fields.find((f) => f.key === selected)?.section : undefined);
    if (p.kind === "type") {
      if (max >= 0 && used >= max) return limitHit();
      const f = newCustomField(p.id as FormField["type"], target ?? sections[sections.length - 1] ?? "Your stay");
      insert([f], f.section, index);
    } else if (p.kind === "library") {
      const item = lib.data?.library.find((l) => l.libraryKey === p.id);
      if (!item) return;
      if (!item.available) return locked(item.feature ?? "paid_extras");
      if (max >= 0 && used + item.fields.filter(countsTowardLimit).length > max) return limitHit();
      const sec = section ?? item.fields[0]?.section ?? target ?? "Your stay";
      insert(item.fields.map((f) => ({ ...f })), sec, index);
    } else if (p.kind === "recommended") {
      toggleRecommended(p.id, true);
    }
  };

  const toggleRecommended = (key: string, on: boolean) => {
    const f = fields.find((x) => x.key === key);
    if (f) commit(fields.map((x) => (x.key === key ? { ...x, required: on ? "OPTIONAL" : "HIDDEN" } : x)));
    else if (on) {
      const r = lib.data?.recommended.find((x) => x.key === key);
      if (r) insert([{ ...r }], r.section);
    }
  };

  const patchField = (key: string, p: Partial<FormField>) => {
    if (p.condition && !canConditions) return locked("form_conditional_logic");
    if (p.required && p.required !== "HIDDEN") {
      const f = fields.find((x) => x.key === key)!;
      if (f.required === "HIDDEN" && countsTowardLimit({ ...f, required: p.required }) && max >= 0 && used >= max) return limitHit();
    }
    setIssues((m) => {
      if (!m[key]) return m;
      const n = { ...m };
      delete n[key];
      return n;
    });
    commit(fields.map((f) => (f.key === key ? { ...f, ...p } : f)));
  };
  const removeField = (key: string) => {
    const f = fields.find((x) => x.key === key);
    const dependants = fields.filter((x) => x.condition?.fieldKey === key);
    commit(fields.filter((x) => x.key !== key).map((x) => (x.condition?.fieldKey === key ? { ...x, condition: null } : x)));
    setSelected(null);
    setPane("form");
    if (f) toast.info(`${f.label} removed`, dependants.length ? `${dependants.map((d) => d.label).join(", ")} ${dependants.length === 1 ? "is" : "are"} now always shown.` : "Publish to take it off the live form.");
  };

  const publish = useMutation({
    mutationFn: async (note: string) => {
      if (timer.current || dirtyLocal.current) await flush();
      return formApi.publish(note || undefined);
    },
    onSuccess: (r) => {
      apply(r.state);
      setFields(r.state.draft.fields);
      void qc.invalidateQueries({ queryKey: qk7.formVersions });
      void qc.invalidateQueries({ queryKey: ["booking-form", "render"] });
      toast.success(`Version ${r.version.version} is live`, r.diff.summary);
    },
    meta: { errorTitle: "Not published" },
  });
  const discard = useMutation({
    mutationFn: formApi.discard,
    onSuccess: (s) => {
      apply(s);
      setFields(s.draft.fields);
      setSelected(null);
      toast.info("Draft discarded", "The builder shows the live form again.");
    },
    meta: { errorTitle: "Draft not discarded" },
  });
  const preset = useMutation({
    mutationFn: (id: string) => formApi.resetToPreset(id),
    onSuccess: (s) => {
      apply(s);
      setFields(s.draft.fields);
      setSelected(null);
      const skipped = s.warnings.filter((w) => w.code === "PRESET_FIELD_SKIPPED").length;
      toast.success("Preset applied to the draft", skipped ? `${skipped} question${skipped === 1 ? "" : "s"} left out: not on your plan.` : "Publish when it looks right.");
    },
    meta: { errorTitle: "Preset not applied" },
  });

  const sel = fields.find((f) => f.key === selected) ?? null;
  const dirty = state.hasUnpublishedChanges || save.kind === "saving";

  const statusLine =
    save.kind === "saving" ? (
      <span className="inline-flex items-center gap-1.5 text-ink-muted">
        <span className="h-1.5 w-1.5 animate-[breathe_1s_ease-in-out_infinite] rounded-full bg-ochre" /> Saving
      </span>
    ) : save.kind === "error" ? (
      <span className="inline-flex items-center gap-1.5 text-danger" data-testid="form-save-error">
        <WarningCircle size={13} weight="fill" /> {save.message}
      </span>
    ) : state.hasUnpublishedChanges ? (
      <span className="inline-flex items-center gap-1.5 text-ink-muted" data-testid="form-status">
        <span className="h-1.5 w-1.5 rounded-full bg-ochre" /> Draft &middot; {state.diff.summary || "changes"} since v{state.published?.version ?? 0}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 text-ink-muted" data-testid="form-status">
        <CheckCircle size={13} weight="fill" className="text-palm" /> Version {state.published?.version ?? 1} is live
      </span>
    );

  const library = (
    <LibraryPane
      lib={lib.data}
      fields={fields}
      onAdd={(p) => add(p)}
      onToggleRecommended={toggleRecommended}
      onSelect={(k) => {
        setSelected(k);
        setPane("field");
      }}
      onLocked={(f) => (f === "form_fields_unlimited" ? limitHit() : locked(f))}
      limit={{ used, max }}
      editable={editable}
      planFor={planFor}
    />
  );

  const inspector = sel ? (
    <Inspector
      key={sel.key}
      field={sel}
      fields={fields}
      onChange={(p) => patchField(sel.key, p)}
      onRemove={() => removeField(sel.key)}
      canConditions={canConditions}
      canFiles={canFiles}
      onLocked={locked}
      issue={issues[sel.key]}
      pickupPoints={points.data}
      editable={editable}
    />
  ) : (
    <div className="px-6 py-10">
      <EmptyState compact glyph="ladder" title="Choose a question" body="Click any question on the form to reword it, make it required, choose where it is asked, or show it only after a certain answer." />
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:min-h-0" data-testid="form-builder">
      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-b border-line bg-surface px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <p className="eyebrow flex items-center gap-2">
            <Textbox size={12} weight="duotone" /> Online booking
          </p>
          <h1 className="display-sm truncate text-[21px] leading-tight text-ink">
            The booking <em>form</em>
          </h1>
        </div>
        <div className="order-3 w-full text-[12px] sm:order-none sm:w-auto">{statusLine}</div>
        <Segmented<Lens>
          label="Channel"
          size="sm"
          value={lens}
          onChange={setLens}
          className="hidden xl:inline-flex"
          options={[
            { value: "ALL", label: "All" },
            { value: "MARKETPLACE", label: "Marketplace" },
            { value: "BOOKING_SITE", label: "Booking site" },
            { value: "FRONT_DESK", label: "Front desk" },
          ]}
        />
        <div className="flex items-center gap-1.5">
          <Button variant={mode === "preview" ? "ink" : "secondary"} size="sm" onClick={() => setMode(mode === "preview" ? "build" : "preview")} data-testid="toggle-preview" className="hidden lg:inline-flex">
            {mode === "preview" ? <PencilSimple size={14} /> : <Eye size={14} />} {mode === "preview" ? "Edit" : "Preview"}
          </Button>
          <Menu.Root>
            <Menu.Trigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="More form actions">
                <DotsThree size={18} weight="bold" />
              </Button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={4} className="z-50 min-w-56 rounded-md border border-line bg-surface p-1 shadow-float animate-[rise_140ms_ease-out]">
                <Menu.Item onSelect={() => setHistoryOpen(true)} className="flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2.5 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2">
                  <ClockCounterClockwise size={15} /> Published versions
                </Menu.Item>
                {editable && (
                  <Menu.Sub>
                    <Menu.SubTrigger className="flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2.5 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2 data-[state=open]:bg-surface-2">
                      <SlidersHorizontal size={15} /> Start from a preset
                    </Menu.SubTrigger>
                    <Menu.Portal>
                      <Menu.SubContent sideOffset={4} className="z-50 min-w-64 rounded-md border border-line bg-surface p-1 shadow-float">
                        {PRESETS.map((p) => (
                          <Menu.Item key={p.id} onSelect={() => setPresetOpen(p.id)} className="flex cursor-pointer items-start gap-2.5 rounded-sm px-2.5 py-2 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2">
                            <CatalogIcon name={p.icon} size={15} className="mt-0.5 text-ink-muted" />
                            <span>
                              <span className="block font-medium">{p.name}</span>
                              <span className="block text-[11.5px] text-ink-muted">{p.hint}</span>
                            </span>
                          </Menu.Item>
                        ))}
                      </Menu.SubContent>
                    </Menu.Portal>
                  </Menu.Sub>
                )}
                {editable && state.hasUnpublishedChanges && (
                  <Menu.Item onSelect={() => setDiscardOpen(true)} className="flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2.5 text-[13px] text-danger outline-none data-[highlighted]:bg-danger-wash">
                    <ArrowCounterClockwise size={15} /> Discard the draft
                  </Menu.Item>
                )}
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
          {editable && (
            <Button size="sm" onClick={() => setPublishOpen(true)} disabled={!dirty || publish.isPending || save.kind === "error"} loading={publish.isPending} data-testid="publish-form">
              Publish
            </Button>
          )}
        </div>
      </div>

      {/* phones and tablets: one pane at a time */}
      <div className="flex items-center justify-between gap-2 border-b border-line bg-surface px-4 py-2 lg:hidden">
        <Segmented<"library" | "form" | "field">
          label="Builder pane"
          size="sm"
          value={pane}
          onChange={setPane}
          options={[
            { value: "library", label: "Add", icon: <ListPlus size={13} /> },
            { value: "form", label: "Form", icon: <Textbox size={13} /> },
            { value: "field", label: "Question", icon: <SlidersHorizontal size={13} /> },
          ]}
        />
        <Button variant="ghost" size="sm" onClick={() => setMode(mode === "preview" ? "build" : "preview")}>
          {mode === "preview" ? <PencilSimple size={14} /> : <Eye size={14} />} {mode === "preview" ? "Edit" : "Preview"}
        </Button>
      </div>

      {mode === "preview" ? (
        <FormPreview lens={lens === "ALL" ? "BOOKING_SITE" : lens} onLens={setLens} device={device} onDevice={setDevice} version={previewVersion} />
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className={cn("scrollbar-thin min-h-0 w-full shrink-0 overflow-y-auto border-line bg-surface lg:block lg:w-[272px] lg:border-r xl:w-[292px]", pane === "library" ? "block" : "hidden")} aria-label="Add questions">
            {library}
          </aside>
          <section className={cn("scrollbar-thin min-h-0 min-w-0 flex-1 overflow-y-auto lg:block", pane === "form" ? "block" : "hidden")} aria-label="The form">
            <div className="mx-auto max-w-[680px] px-4 pb-24 pt-6 sm:px-8">
              <div className="mb-5 flex items-end justify-between gap-3 xl:hidden">
                <Segmented<Lens>
                  label="Channel"
                  size="sm"
                  value={lens}
                  onChange={setLens}
                  options={[
                    { value: "ALL", label: "All" },
                    { value: "MARKETPLACE", label: "MKT" },
                    { value: "BOOKING_SITE", label: "Site" },
                    { value: "FRONT_DESK", label: "Desk" },
                  ]}
                />
              </div>
              <FormCanvas
                fields={fields}
                selected={selected}
                onSelect={(k) => {
                  setSelected(k);
                  setPane("field");
                }}
                onChange={commit}
                onDrop={(p, sec, idx) => add(p, sec, idx)}
                lens={lens}
                issues={issues}
                warnings={warnings}
                editable={editable}
              />
              {lens !== "ALL" && (
                <p className="mt-6 text-center text-[12px] text-ink-faint">
                  Faded questions aren&rsquo;t asked on the {lens === "MARKETPLACE" ? "marketplace" : lens === "BOOKING_SITE" ? "booking site" : "front desk"}.
                </p>
              )}
            </div>
          </section>
          <aside className={cn("scrollbar-thin min-h-0 w-full shrink-0 overflow-y-auto border-line bg-surface lg:block lg:w-[340px] lg:border-l xl:w-[360px]", pane === "field" ? "block" : "hidden")} aria-label="Question settings">
            {inspector}
          </aside>
        </div>
      )}

      <PublishFormDialog open={publishOpen} onOpenChange={setPublishOpen} diff={state.diff} version={(state.published?.version ?? 0) + 1} onPublish={(note) => publish.mutateAsync(note)} />
      <FormVersionsSheet open={historyOpen} onOpenChange={setHistoryOpen} onRestored={(s) => { apply(s); setFields(s.draft.fields); setSelected(null); }} editable={editable} />
      <ConfirmDialog open={discardOpen} onOpenChange={setDiscardOpen} title="Discard the draft?" body="The builder goes back to the live form. Guests are not affected either way." confirmLabel="Discard" danger onConfirm={() => discard.mutateAsync()} />
      <ConfirmDialog
        open={!!presetOpen}
        onOpenChange={(o) => !o && setPresetOpen(null)}
        title={`Start from the ${PRESETS.find((p) => p.id === presetOpen)?.name ?? ""} preset?`}
        body="The draft is replaced with the preset's questions. The live form doesn't change until you publish."
        confirmLabel="Use this preset"
        onConfirm={() => (presetOpen ? preset.mutateAsync(presetOpen) : undefined)}
      />
    </div>
  );
}

function FormPreview({ lens, onLens, device, onDevice, version }: { lens: Channel; onLens: (l: Lens) => void; device: Device; onDevice: (d: Device) => void; version: number }) {
  const token = usePreviewToken(lens !== "FRONT_DESK");
  const desk = useRenderedForm("FRONT_DESK", "draft", lens === "FRONT_DESK");
  const src = token.data ? `${token.data.urls.booking}${token.data.urls.booking.includes("?") ? "&" : "?"}channel=${lens}` : null;
  return (
    <div className="flex min-h-[70dvh] flex-1 flex-col lg:min-h-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/40 px-4 py-2">
        <Segmented<Channel>
          label="Preview as"
          size="sm"
          value={lens}
          onChange={(v) => onLens(v)}
          options={[
            { value: "MARKETPLACE", label: "Marketplace" },
            { value: "BOOKING_SITE", label: "Booking site" },
            { value: "FRONT_DESK", label: "Front desk" },
          ]}
        />
        {lens !== "FRONT_DESK" && <DeviceToggle value={device} onChange={onDevice} />}
      </div>
      {lens === "FRONT_DESK" ? (
        <div className="studio-stage scrollbar-thin min-h-0 flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="mx-auto max-w-[640px] rounded-lg border border-line bg-surface p-6 shadow-float" data-testid="desk-preview">
            <p className="eyebrow mb-1">Front desk &middot; draft</p>
            <h2 className="display-sm mb-5 text-[22px] text-ink">New reservation: the questions</h2>
            {desk.data ? <GuestFormPreview form={desk.data} /> : desk.isError ? <ErrorState error={desk.error} /> : <Skeleton className="h-96" />}
          </div>
        </div>
      ) : (
        <PreviewFrame src={src} device={device} host="Booking form preview" version={version} fit="contain" title="Guest booking form preview" testId="form-preview-frame" empty={<p className="text-[13px] text-ink-muted">{token.isError ? "The preview didn't open." : "Opening the guest's booking form…"}</p>} />
      )}
    </div>
  );
}

function PublishFormDialog({ open, onOpenChange, diff, version, onPublish }: { open: boolean; onOpenChange: (o: boolean) => void; diff: FormDiff; version: number; onPublish: (note: string) => Promise<unknown> }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const empty = !diff.added.length && !diff.removed.length && !diff.changed.length;
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Publish"
      title={`Publish version ${version}?`}
      description="New bookings use it straight away. Bookings already made keep the answers to the version they were made with."
      className="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Keep editing
          </Button>
          <Button
            loading={busy}
            data-testid="confirm-publish-form"
            onClick={async () => {
              setBusy(true);
              try {
                await onPublish(note.trim());
                onOpenChange(false);
                setNote("");
              } catch {
                /* toast from the mutation */
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
      <div className="flex flex-col gap-4" data-testid="form-diff">
        {empty ? (
          <p className="text-[13px] text-ink-muted">Nothing changed in the questions since the last version.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-dashed divide-line rounded-md border border-line text-[13px]">
            {diff.added.map((a) => (
              <li key={`a-${a.key}`} className="flex items-baseline gap-3 px-3.5 py-2.5">
                <span className="w-16 shrink-0 font-mono text-[10.5px] uppercase tracking-[0.12em] text-palm">Added</span>
                <span className="font-medium text-ink">{a.label}</span>
              </li>
            ))}
            {diff.changed.map((c) => (
              <li key={`c-${c.key}`} className="flex items-baseline gap-3 px-3.5 py-2.5">
                <span className="w-16 shrink-0 font-mono text-[10.5px] uppercase tracking-[0.12em] text-adire">Changed</span>
                <span className="min-w-0">
                  <span className="font-medium text-ink">{c.label}</span>
                  <span className="block text-[12px] text-ink-muted">{c.changes.join("; ")}</span>
                </span>
              </li>
            ))}
            {diff.removed.map((r) => (
              <li key={`r-${r.key}`} className="flex items-baseline gap-3 px-3.5 py-2.5">
                <span className="w-16 shrink-0 font-mono text-[10.5px] uppercase tracking-[0.12em] text-danger">Removed</span>
                <span className="text-ink-muted line-through">{r.label}</span>
              </li>
            ))}
          </ul>
        )}
        <Field label="Note for the history" htmlFor="pub-note" optional>
          <Input id="pub-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder="Added the motor-park pickup" />
        </Field>
      </div>
    </Dialog>
  );
}

function FormVersionsSheet({ open, onOpenChange, onRestored, editable }: { open: boolean; onOpenChange: (o: boolean) => void; onRestored: (s: BookingFormState) => void; editable: boolean }) {
  const v = useFormVersions(open);
  const [confirm, setConfirm] = useState<{ id: string; version: number } | null>(null);
  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange} eyebrow="Booking form" title="Published versions" description="Every booking keeps the version it was made with. Restoring copies a version into the draft; publish it to make it live.">
        {v.isLoading ? (
          <Skeleton className="h-40" />
        ) : !v.data?.length ? (
          <EmptyState compact title="No versions yet" />
        ) : (
          <ol className="flex flex-col divide-y divide-line" data-testid="form-versions">
            {v.data.map((x, i) => (
              <li key={x.id} className="flex items-center gap-3 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border border-line font-mono text-[12px] text-ink">v{x.version}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] text-ink">{x.note ?? `${x.fieldCount} questions`}</p>
                  <p className="text-[12px] text-ink-muted" title={formatDateTime(x.publishedAt)}>
                    {x.publishedBy?.fullName ?? "Someone"}, {relativeTime(x.publishedAt)}
                    {i === 0 && <span className="ml-2 rounded-xs bg-palm-wash px-1.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-palm">Live</span>}
                  </p>
                </div>
                {i > 0 && editable && (
                  <Button size="sm" variant="secondary" onClick={() => setConfirm({ id: x.id, version: x.version })}>
                    <ArrowCounterClockwise size={13} /> Restore
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
        title={`Copy version ${confirm?.version ?? ""} into the draft?`}
        body="Your current draft is replaced. The live form doesn't change until you publish."
        confirmLabel="Restore to draft"
        onConfirm={async () => {
          if (!confirm) return;
          const s = await formApi.restore(confirm.id);
          onRestored(s);
          onOpenChange(false);
          toast.success(`Version ${confirm.version} is in the draft`, "Publish it to make it live.");
        }}
      />
    </>
  );
}
