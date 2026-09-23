"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BellRinging, CheckCircle, ClockCountdown, MoonStars, PaperPlaneTilt, Plus, WhatsappLogo, X } from "@phosphor-icons/react";
import { useGuardAlerts, useNotificationSettings, useWhatsAppTemplates, qk4 } from "@/lib/api/hooks-m4";
import { notifyApi } from "@/lib/api/endpoints-m4";
import type { NotificationSettings, NotificationSettingsInput } from "@/lib/api/types-m4";
import type { Digest } from "@/lib/api/types-m2";
import { useEntitlements } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import { GUARD_RULES, GUARD_RULE_ORDER } from "@/lib/catalog-m2";
import { normalisePhone } from "@/lib/api/mutations-m2";
import { toast } from "@/lib/store";
import { hhmmToMinutes } from "@/lib/dates";
import { formatPhone, naira, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input, Switch } from "@/components/ui/form";
import { Badge, ErrorState, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { NairaInput, Stepper } from "@/components/m2/bits";
import { LockedInline } from "@/components/gating/gate";
import { PhonePreview } from "@/components/reports/phone-preview";

type Form = Pick<NotificationSettings, "guardAlerts" | "quietHours" | "digest">;

export function NotificationSettingsView() {
  const s = useNotificationSettings();
  const tpl = useWhatsAppTemplates();
  const alerts = useGuardAlerts(1);
  const qc = useQueryClient();
  const { has } = useEntitlements();
  const { can } = useCan();
  const locked = !has("owner_whatsapp_alerts");
  const editable = can("settings.manage") && !locked;
  const [form, setForm] = useState<Form | null>(null);
  const [key, setKey] = useState("");
  if (s.data && s.data.updatedAt !== key) {
    setKey(s.data.updatedAt ?? "none");
    setForm({ guardAlerts: s.data.guardAlerts, quietHours: s.data.quietHours, digest: s.data.digest });
  }
  const dirty = !!form && !!s.data && JSON.stringify(form) !== JSON.stringify({ guardAlerts: s.data.guardAlerts, quietHours: s.data.quietHours, digest: s.data.digest });

  const save = useMutation({
    mutationFn: () => {
      const body: NotificationSettingsInput = { guardAlerts: form!.guardAlerts, quietHours: form!.quietHours, digest: { enabled: form!.digest.enabled, recipients: form!.digest.recipients } };
      return notifyApi.save(body);
    },
    onSuccess: (d) => {
      qc.setQueryData(qk4.notifySettings, d);
      toast.success("Alert settings saved");
    },
    meta: { errorTitle: "Settings not saved" },
  });
  const test = useMutation({
    mutationFn: notifyApi.testAlert,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["notifications", "alerts"] });
      toast.success("Test alert sent", "Check your phone. It ignores quiet hours.");
    },
    meta: { errorTitle: "Test not sent" },
  });

  const g = form?.guardAlerts;
  const set = (patch: Partial<Form["guardAlerts"]>) => setForm((f) => (f ? { ...f, guardAlerts: { ...f.guardAlerts, ...patch } } : f));
  const preview: Digest | null = useMemo(() => {
    const t = tpl.data?.templates.find((x) => x.name === "guard_alert_high");
    if (!t) return null;
    const values = ["The Palmwine House", "2", "Room 204 occupied with no stay", naira(5_500_000), "admin.hotelos.ng/guard"];
    const body = t.body.replace(/\{\{(\d)\}\}/g, (_m, n) => `*${values[Number(n) - 1] ?? "..."}*`);
    return { id: "p", createdAt: new Date().toISOString(), body, status: "SENT", recipients: [], error: null } as unknown as Digest;
  }, [tpl.data]);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <BellRinging size={14} weight="duotone" /> Alerts &amp; WhatsApp
          </>
        }
        title={
          <>
            Know at once, <em>sleep at night</em>.
          </>
        }
        description="High Revenue Guard flags reach the owner on WhatsApp within minutes, bundled so one bad hour is one message. Quiet hours hold them till morning unless it's urgent. Reply 1 to acknowledge, or DIGEST for today's numbers."
        actions={
          can("settings.manage") &&
          !locked && (
            <Button variant="secondary" loading={test.isPending} onClick={() => test.mutate()}>
              <PaperPlaneTilt size={14} /> Send me a test
            </Button>
          )
        }
      />
      {locked && <LockedInline feature="owner_whatsapp_alerts" className="mb-5" text="You can read these settings; alerts go out once the plan includes them." />}
      {s.isError ? (
        <Panel>
          <ErrorState error={s.error} onRetry={() => s.refetch()} />
        </Panel>
      ) : !form || !g ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col gap-5">
            <Panel>
              <PanelHeader eyebrow="Revenue Guard" title="Who hears about high flags" />
              <div className="flex flex-col gap-5 px-5 py-4">
                <Switch checked={g.enabled} disabled={!editable} onChange={(v) => set({ enabled: v })} label="Real-time alerts" description="A WhatsApp message for each new HIGH flag, bundled over a few minutes." />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Switch checked={g.recipients.owners} disabled={!editable} onChange={(v) => set({ recipients: { ...g.recipients, owners: v } })} label="Owners" />
                  <Switch checked={g.recipients.managers} disabled={!editable} onChange={(v) => set({ recipients: { ...g.recipients, managers: v } })} label="Managers" />
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <p className="mb-1.5 text-[13px] font-medium text-ink">Bundle flags raised within</p>
                    <Stepper label="minutes" value={g.debounceMinutes} onChange={(v) => editable && set({ debounceMinutes: v })} min={0} max={30} suffix="min" />
                  </div>
                  <div className="flex gap-2">
                    {(["WHATSAPP", "EMAIL"] as const).map((c) => {
                      const on = g.channels.includes(c);
                      return (
                        <button
                          key={c}
                          type="button"
                          disabled={!editable}
                          aria-pressed={on}
                          onClick={() => set({ channels: on ? g.channels.filter((x) => x !== c) : [...g.channels, c] })}
                          className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[12.5px] disabled:opacity-60", on ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}
                        >
                          {c === "WHATSAPP" ? <WhatsappLogo size={14} weight="duotone" /> : <PaperPlaneTilt size={13} />} {c === "WHATSAPP" ? "WhatsApp" : "Email"}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-[13px] font-medium text-ink">Urgent: breaks through quiet hours</p>
                  <p className="text-[12.5px] text-ink-muted">These rules, or any flag worth more than the amount below.</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {GUARD_RULE_ORDER.map((r) => {
                      const on = g.urgentRules.includes(r);
                      return (
                        <button
                          key={r}
                          type="button"
                          disabled={!editable}
                          aria-pressed={on}
                          onClick={() => set({ urgentRules: on ? g.urgentRules.filter((x) => x !== r) : [...g.urgentRules, r] })}
                          className={cn("h-7 rounded-full border px-2.5 text-[12px] disabled:opacity-60", on ? "border-laterite bg-laterite-wash text-laterite" : "border-line text-ink-muted hover:text-ink")}
                        >
                          {GUARD_RULES[r]?.label ?? r}
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 max-w-[240px]">
                    <NairaInput kobo={g.urgentAmountKobo} onChange={(v) => editable && set({ urgentAmountKobo: v ?? 0 })} aria-label="Urgent above this amount" />
                  </div>
                </div>
              </div>
            </Panel>

            <Panel>
              <PanelHeader eyebrow="Quiet hours" title="When the phone stays quiet" />
              <div className="flex flex-col gap-4 px-5 py-4">
                <Switch checked={form.quietHours.enabled} disabled={!editable} onChange={(v) => setForm({ ...form, quietHours: { ...form.quietHours, enabled: v } })} label="Hold alerts overnight" description="Held alerts go out together when quiet hours end. Urgent ones don't wait." />
                <div className="flex items-end gap-3">
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
                    From
                    <Input type="time" disabled={!editable} value={form.quietHours.start} onChange={(e) => setForm({ ...form, quietHours: { ...form.quietHours, start: e.target.value } })} className="w-[130px] font-mono" />
                  </label>
                  <label className="flex flex-col gap-1.5 text-[13px] font-medium text-ink">
                    To
                    <Input type="time" disabled={!editable} value={form.quietHours.end} onChange={(e) => setForm({ ...form, quietHours: { ...form.quietHours, end: e.target.value } })} className="w-[130px] font-mono" />
                  </label>
                </div>
                <DayRuler start={form.quietHours.start} end={form.quietHours.end} on={form.quietHours.enabled} />
              </div>
            </Panel>

            <Panel>
              <PanelHeader eyebrow="Owner digest" title="The day in one message, at 23:00" />
              <div className="flex flex-col gap-4 px-5 py-4">
                <Switch checked={form.digest.enabled} disabled={!editable} onChange={(v) => setForm({ ...form, digest: { ...form.digest, enabled: v } })} label="Send the nightly digest" />
                <PhoneList value={form.digest.recipients} disabled={!editable} onChange={(r) => setForm({ ...form, digest: { ...form.digest, recipients: r } })} />
              </div>
            </Panel>

            <Panel>
              <PanelHeader eyebrow="Who will receive alerts" title="Everyone, checked" />
              <ul className="divide-y divide-line">
                {s.data!.recipientsPreview.map((r) => (
                  <li key={r.userId} className="flex items-center gap-3 px-5 py-2.5 text-[13px]">
                    {r.willReceive ? <CheckCircle size={16} weight="fill" className="text-palm" /> : <X size={15} className="text-ink-faint" />}
                    <span className="min-w-0 flex-1 text-ink">
                      {r.fullName} <span className="text-[12px] text-ink-muted">&middot; {r.role.replace("_", " ").toLowerCase()}</span>
                    </span>
                    <span className="font-mono text-[12px] text-ink-muted">{r.phoneMasked ?? "no phone"}</span>
                    {r.reason && <span className="hidden text-[11.5px] text-ink-faint sm:inline">{r.reason}</span>}
                  </li>
                ))}
              </ul>
            </Panel>
          </div>

          <aside className="flex flex-col gap-5 lg:sticky lg:top-20 lg:self-start">
            {preview && <PhonePreview digest={preview} />}
            <Panel>
              <PanelHeader
                eyebrow="WhatsApp templates"
                title="Submitted to Meta"
                actions={tpl.data && <Badge tone={tpl.data.provider === "cloud" ? "palm" : "brass"}>{tpl.data.provider === "cloud" ? "Cloud API" : "Dev outbox"}</Badge>}
              />
              {!tpl.data ? (
                <div className="p-5">
                  <Skeleton className="h-40" />
                </div>
              ) : (
                <ul className="divide-y divide-line">
                  {tpl.data.templates.map((t) => (
                    <li key={t.name} className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[12.5px] text-ink">{t.name}</span>
                        <span className="ml-auto">
                          <Badge tone={t.status === "APPROVED" ? "palm" : t.status === "SUBMITTED" ? "brass" : "neutral"} dot>
                            {t.status === "APPROVED" ? "Approved" : t.status === "SUBMITTED" ? "In review" : "Not submitted"}
                          </Badge>
                        </span>
                      </div>
                      <p className="mt-0.5 text-[11.5px] text-ink-muted">
                        {t.usedFor} &middot; {t.category.toLowerCase()}
                      </p>
                      <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-ink-faint">
                        {t.body.split(/(\{\{\d\}\})/).map((part, i) =>
                          /\{\{\d\}\}/.test(part) ? (
                            <span key={i} className="rounded-[2px] bg-surface-2 px-0.5 font-mono text-[10.5px] text-ink-muted">
                              {part}
                            </span>
                          ) : (
                            <span key={i}>{part}</span>
                          ),
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
            <Panel>
              <PanelHeader eyebrow="Sent lately" title="Alert log" />
              {!alerts.data ? (
                <div className="p-5">
                  <Skeleton className="h-24" />
                </div>
              ) : !alerts.data.items.length ? (
                <p className="px-5 py-4 text-[13px] text-ink-muted">No alerts yet. That&rsquo;s a good sign.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {alerts.data.items.slice(0, 6).map((a) => (
                    <li key={a.id} className="flex items-start gap-3 px-5 py-3">
                      <span className={cn("mt-0.5", a.status === "DEFERRED" ? "text-adire" : a.status === "ACKNOWLEDGED" ? "text-palm" : a.status === "FAILED" ? "text-danger" : "text-ink-muted")}>
                        {a.status === "DEFERRED" ? <MoonStars size={15} weight="duotone" /> : a.status === "ACKNOWLEDGED" ? <CheckCircle size={15} weight="fill" /> : <ClockCountdown size={15} />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] text-ink">
                          {a.urgent && <span className="mr-1.5 font-mono text-[10px] uppercase tracking-wider text-laterite">urgent</span>}
                          {a.flags[0]?.title}
                          {a.flags.length > 1 && <span className="text-ink-muted"> +{a.flags.length - 1}</span>}
                        </p>
                        <p className="text-[11.5px] text-ink-muted">
                          {a.status === "DEFERRED"
                            ? `Held for quiet hours, goes out ${relativeTime(a.scheduledFor)}`
                            : a.status === "ACKNOWLEDGED"
                              ? `Acknowledged by ${a.acknowledgedBy?.fullName ?? "the owner"} ${relativeTime(a.acknowledgedAt)}`
                              : a.status === "FAILED"
                                ? a.error
                                : `Sent ${relativeTime(a.sentAt)}`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </aside>
        </div>
      )}
      {dirty && editable && (
        <div className="fixed inset-x-0 bottom-[68px] z-40 px-4 lg:bottom-6 lg:left-[252px]">
          <div className="mx-auto flex max-w-[640px] items-center gap-3 rounded-lg border border-line-strong bg-surface px-4 py-3 shadow-float animate-[rise_200ms_ease-out]">
            <p className="flex-1 text-[13.5px] text-ink">Unsaved alert settings</p>
            <Button variant="ghost" size="sm" onClick={() => s.data && setForm({ guardAlerts: s.data.guardAlerts, quietHours: s.data.quietHours, digest: s.data.digest })}>
              Discard
            </Button>
            <Button size="sm" loading={save.isPending} onClick={() => save.mutate()}>
              Save
            </Button>
          </div>
        </div>
      )}
    </>
  );
}

/** 24 hours as a ruler with the quiet window shaded (wrapping past midnight). */
function DayRuler({ start, end, on }: { start: string; end: string; on: boolean }) {
  const a = hhmmToMinutes(start) / 1440;
  const b = hhmmToMinutes(end) / 1440;
  const spans = a <= b ? [[a, b]] : [[a, 1], [0, b]];
  return (
    <div aria-hidden className={cn(!on && "opacity-40")}>
      <div className="relative h-8 overflow-hidden rounded-[3px] border border-line bg-surface-2/50">
        {spans.map(([x, y], i) => (
          <span key={i} className="absolute inset-y-0 bg-adire/20" style={{ left: `${x * 100}%`, width: `${(y - x) * 100}%` }}>
            <span className="hatch absolute inset-0 text-adire" />
          </span>
        ))}
        {Array.from({ length: 25 }, (_, h) => (
          <span key={h} className="absolute bottom-0 w-px bg-line-strong" style={{ left: `${(h / 24) * 100}%`, height: h % 6 === 0 ? 10 : 5 }} />
        ))}
        <span className="absolute left-2 top-1 flex items-center gap-1 text-[10.5px] text-adire">
          <MoonStars size={11} weight="fill" /> quiet {start} to {end}
        </span>
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-ink-faint">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>24:00</span>
      </div>
    </div>
  );
}

function PhoneList({ value, onChange, disabled }: { value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  const [text, setText] = useState("");
  const norm = normalisePhone(text);
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium text-ink">Sent to</p>
      <ul className="flex flex-wrap gap-1.5">
        {value.map((p) => (
          <li key={p} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong bg-surface pl-3 pr-1 font-mono text-[12.5px] text-ink">
            {formatPhone(p)}
            {!disabled && (
              <button type="button" aria-label={`Remove ${p}`} onClick={() => onChange(value.filter((x) => x !== p))} className="grid h-6 w-6 place-items-center rounded-full text-ink-muted hover:bg-surface-2">
                <X size={12} />
              </button>
            )}
          </li>
        ))}
      </ul>
      {!disabled && value.length < 5 && (
        <form
          className="mt-2 flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (norm && !value.includes(norm)) {
              onChange([...value, norm]);
              setText("");
            }
          }}
        >
          <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="0803 123 4567" inputMode="tel" className="max-w-[220px] font-mono" aria-label="Add a phone number" />
          <Button type="submit" size="md" variant="secondary" disabled={!norm}>
            <Plus size={13} weight="bold" /> Add
          </Button>
        </form>
      )}
    </div>
  );
}
