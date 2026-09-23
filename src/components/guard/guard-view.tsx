"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowClockwise, ArrowRight, CheckCircle, Eye, Lightbulb, LockSimple, ShieldCheck, ShieldWarning, XCircle } from "@phosphor-icons/react";
import { useGuardFlags, useGuardRules, useGuardSummary } from "@/lib/api/hooks-m2";
import { guardApi } from "@/lib/api/endpoints-m2";
import { useDeskRefresh } from "@/lib/api/mutations-m2";
import type { GuardFlag, GuardRuleInfo } from "@/lib/api/types-m2";
import { useEntitlements } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import { openUpgrade, toast } from "@/lib/store";
import { FLAG_STATUS, GUARD_RULES, SEVERITY, type Severity } from "@/lib/catalog-m2";
import { formatDateTime, naira, relativeTime, titleCase } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/overlay";
import { Textarea } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, PlanPlate, Skeleton } from "@/components/ui/primitives";
import { FeaturePage } from "@/components/gating/feature-page";

const TABS = [
  { value: "OPEN,ACKNOWLEDGED", label: "To review" },
  { value: "RESOLVED", label: "Resolved" },
  { value: "DISMISSED", label: "Dismissed" },
  { value: "", label: "All" },
] as const;

export function GuardView() {
  return (
    <FeaturePage
      feature="revenue_guard_basic"
      icon={ShieldWarning}
      name="Revenue Guard"
      title={
        <>
          Know where the <em>money leaks</em>.
        </>
      }
      pitch="Voided payments, till shortages and guests who leave owing, raised for the owner the moment they happen."
      bullets={["Shift variances beyond ₦500", "Every voided payment", "Check-outs with money owing"]}
      preview={<EmptyState compact glyph="eye" title="No flags yet" />}
    >
      <Inbox />
    </FeaturePage>
  );
}

function Inbox() {
  const { can } = useCan();
  const refresh = useDeskRefresh();
  const [tab, setTab] = useState<string>(TABS[0].value);
  const [severity, setSeverity] = useState<Severity | "">("");
  const [selected, setSelected] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const flags = useGuardFlags({ status: tab || undefined, severity: severity || undefined, pageSize: 50 });
  const summary = useGuardSummary();
  const rules = useGuardRules();
  const items = useMemo(
    () => [...(flags.data?.items ?? [])].sort((a, b) => SEVERITY[b.severity].rank - SEVERITY[a.severity].rank || b.createdAt.localeCompare(a.createdAt)),
    [flags.data],
  );
  const current = items.find((f) => f.id === selected) ?? items[0] ?? null;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- keep a selection when the list changes
    if (items.length && !items.some((f) => f.id === selected)) setSelected(items[0].id);
  }, [items, selected]);

  const sweep = useMutation({
    mutationFn: guardApi.sweep,
    onSuccess: async (r) => {
      await refresh();
      toast.success("Sweep finished", r.created ? `${r.created} new ${r.created === 1 ? "flag" : "flags"}.` : "Nothing new.");
    },
    meta: { errorTitle: "Sweep failed" },
  });

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <ShieldWarning size={14} weight="duotone" /> Leakage and anomalies
          </>
        }
        title={
          <>
            Revenue <em>Guard</em>
          </>
        }
        description="Every void, variance, override and room sold off the books lands here. Review each one, note what happened, and close it."
        actions={
          can("guard.triage") && (
            <Button variant="secondary" onClick={() => sweep.mutate()} loading={sweep.isPending}>
              <ArrowClockwise size={15} weight="bold" /> Check now
            </Button>
          )
        }
      />

      <SeverityStrip summary={summary.data} active={severity} onPick={(s) => setSeverity((cur) => (cur === s ? "" : s))} />

      <div className="mb-3 mt-6 flex items-center gap-1 border-b border-line" role="tablist" aria-label="Flag status">
        {TABS.map((t) => (
          <button
            key={t.label}
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn("relative h-10 px-3 text-[13.5px] font-medium", tab === t.value ? "text-ink" : "text-ink-muted hover:text-ink")}
          >
            {t.label}
            {t.value === "OPEN,ACKNOWLEDGED" && summary.data ? <span className="ml-1.5 font-mono text-[11.5px] text-laterite">{summary.data.open}</span> : null}
            {tab === t.value && <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-laterite" />}
          </button>
        ))}
      </div>

      {flags.isError ? (
        <ErrorState error={flags.error} onRetry={() => flags.refetch()} />
      ) : flags.isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : !items.length ? (
        <Panel>
          <EmptyState glyph="eye" title={tab.startsWith("OPEN") ? "All clear" : "Nothing here"} body={tab.startsWith("OPEN") ? "No open flags. Revenue Guard checks again every hour and after every night audit." : undefined} />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <ul className="flex flex-col gap-1.5" aria-label="Flags">
            {items.map((f) => (
              <li key={f.id}>
                <FlagRow
                  f={f}
                  active={current?.id === f.id}
                  onClick={() => {
                    setSelected(f.id);
                    setMobileOpen(true);
                  }}
                />
              </li>
            ))}
          </ul>
          <div className="hidden lg:block">{current && <FlagDetail key={current.id} f={current} />}</div>
          <div className="lg:hidden">
            <Sheet open={mobileOpen && !!current} onOpenChange={setMobileOpen} title={current ? GUARD_RULES[current.rule].label : "Flag"} eyebrow="Revenue Guard">
              {current && <FlagDetail f={current} bare />}
            </Sheet>
          </div>
        </div>
      )}

      <RulesPanel rules={rules.data} counts={summary.data?.byRule} />
    </>
  );
}

function SeverityStrip({
  summary,
  active,
  onPick,
}: {
  summary?: { open: number; bySeverity: Record<Severity, number> };
  active: Severity | "";
  onPick: (s: Severity) => void;
}) {
  const sev: Severity[] = ["HIGH", "MEDIUM", "LOW"];
  const total = summary?.open ?? 0;
  return (
    <Panel className="grid grid-cols-3 divide-x divide-line overflow-hidden">
      {sev.map((s) => {
        const n = summary?.bySeverity[s] ?? 0;
        const m = SEVERITY[s];
        return (
          <button
            key={s}
            onClick={() => onPick(s)}
            aria-pressed={active === s}
            className={cn("relative flex flex-col gap-1.5 px-5 py-4 text-left transition-colors hover:bg-surface-2/50", active === s && "bg-surface-2/70")}
          >
            <span className="flex items-center gap-2 text-[13px] text-ink-muted">
              <span className="h-2 w-2 rounded-full" style={{ background: m.color }} /> {m.label}
            </span>
            <span className="font-mono text-[30px] leading-none text-ink">{summary ? n : "-"}</span>
            <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: m.color, opacity: total ? 0.15 + (n / total) * 0.85 : 0.15, transform: `scaleX(${total ? Math.max(0.05, n / total) : 0.05})`, transformOrigin: "left" }} />
          </button>
        );
      })}
    </Panel>
  );
}

function FlagRow({ f, active, onClick }: { f: GuardFlag; active: boolean; onClick: () => void }) {
  const m = SEVERITY[f.severity];
  const closed = f.status === "RESOLVED" || f.status === "DISMISSED";
  return (
    <button
      onClick={onClick}
      aria-current={active || undefined}
      data-testid="flag-row"
      className={cn(
        "relative flex w-full items-start gap-3 overflow-hidden rounded-md border px-4 py-3 text-left transition-colors",
        active ? "border-line-strong bg-surface shadow-[0_1px_0_var(--line)]" : "border-transparent hover:border-line hover:bg-surface/70",
        closed && "opacity-70",
      )}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: m.color }} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: m.color }}>
            {m.label}
          </span>
          <span className="truncate text-[11.5px] text-ink-faint">{GUARD_RULES[f.rule]?.label ?? titleCase(f.rule)}</span>
          {f.status === "ACKNOWLEDGED" && <Badge tone="brass">seen</Badge>}
        </div>
        <p className={cn("mt-1 line-clamp-2 text-[14px] leading-snug text-ink", !closed && f.status === "OPEN" && "font-medium")}>{f.title}</p>
        <p className="mt-1 text-[12px] text-ink-muted">
          {relativeTime(f.createdAt)}
          {f.user ? ` · ${f.user.fullName}` : ""}
          {f.room ? ` · room ${f.room.number}` : ""}
        </p>
      </div>
      {f.amountKobo !== null && <span className="shrink-0 font-mono text-[13px] text-ink">{naira(Math.abs(f.amountKobo))}</span>}
    </button>
  );
}

function evidenceRows(ev: Record<string, unknown>) {
  return Object.entries(ev ?? {}).map(([k, v]) => {
    const label = titleCase(k.replace(/Kobo$|Bps$/, "").replace(/([a-z])([A-Z])/g, "$1 $2"));
    let value: string;
    if (typeof v === "number" && /Kobo$/.test(k)) value = naira(v);
    else if (typeof v === "number" && /Bps$/.test(k)) value = `${v / 100}%`;
    else if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v)) value = formatDateTime(v);
    else if (typeof v === "string" && /^[A-Z_]+$/.test(v)) value = titleCase(v);
    else value = typeof v === "object" ? JSON.stringify(v) : String(v);
    return { k: label, v: value };
  });
}

function FlagDetail({ f, bare }: { f: GuardFlag; bare?: boolean }) {
  const { can } = useCan();
  const refresh = useDeskRefresh();
  const [mode, setMode] = useState<"RESOLVED" | "DISMISSED" | null>(null);
  const [note, setNote] = useState("");
  const m = SEVERITY[f.severity];
  const closed = f.status === "RESOLVED" || f.status === "DISMISSED";
  const triage = useMutation({
    mutationFn: (status: "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED") => guardApi.triage(f.id, status, status === "ACKNOWLEDGED" ? undefined : note.trim()),
    onSuccess: async (_r, status) => {
      await refresh();
      setMode(null);
      setNote("");
      toast.success(status === "ACKNOWLEDGED" ? "Marked as seen" : status === "RESOLVED" ? "Flag resolved" : "Flag dismissed");
    },
    meta: { errorTitle: "Flag not updated" },
  });
  const rows = evidenceRows(f.evidence);
  const body = (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <Badge tone={m.tone} dot>
            {m.label} severity
          </Badge>
          <Badge tone={FLAG_STATUS[f.status].tone}>{FLAG_STATUS[f.status].label}</Badge>
          <span className="text-[12px] text-ink-faint">{formatDateTime(f.createdAt)}</span>
        </div>
        <h2 className="display-sm text-[22px] leading-tight text-ink">{f.title}</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{f.detail}</p>
      </div>

      {f.amountKobo !== null && (
        <div className="flex items-baseline justify-between rounded-md border border-line bg-paper/60 px-4 py-3">
          <span className="text-[13px] text-ink-muted">Amount at stake</span>
          <span className="font-mono text-[24px] leading-none" style={{ color: m.color }}>
            {naira(Math.abs(f.amountKobo))}
          </span>
        </div>
      )}

      {(rows.length > 0 || f.user || f.room || f.reservation) && (
        <div>
          <p className="eyebrow mb-2">Evidence</p>
          <dl className="divide-y divide-dashed divide-line rounded-md border border-line px-4">
            {f.user && <Ev k="Staff member" v={f.user.fullName} />}
            {f.room && <Ev k="Room" v={<span className="font-mono">{f.room.number}</span>} />}
            {f.reservation && (
              <Ev
                k="Reservation"
                v={
                  <Link href={`/reservations/${f.reservation.id}`} className="font-mono text-laterite underline-offset-4 hover:underline">
                    {f.reservation.code}
                  </Link>
                }
              />
            )}
            {f.shiftId && (
              <Ev
                k="Shift"
                v={
                  <Link href="/approvals" className="text-laterite underline-offset-4 hover:underline">
                    Open in approvals
                  </Link>
                }
              />
            )}
            {rows.map((r) => (
              <Ev key={r.k} k={r.k} v={<span className="font-mono text-[12.5px]">{r.v}</span>} />
            ))}
          </dl>
        </div>
      )}

      {f.suggestion && !closed && (
        <p className="flex items-start gap-2 rounded-md bg-brass-wash px-3.5 py-2.5 text-[13px] text-ink">
          <Lightbulb size={16} weight="duotone" className="mt-px shrink-0 text-brass" />
          <span>
            <span className="font-medium">Suggested:</span> {f.suggestion}
            {f.reservation && (
              <Link href={`/reservations/${f.reservation.id}`} className="ml-2 inline-flex items-center gap-0.5 text-laterite hover:underline">
                Open <ArrowRight size={12} />
              </Link>
            )}
          </span>
        </p>
      )}

      {closed ? (
        <div className="rounded-md border border-line px-4 py-3">
          <p className="eyebrow mb-1">{f.status === "RESOLVED" ? "Resolution" : "Dismissed"}</p>
          <p className="text-[13.5px] text-ink">{f.resolution}</p>
          <p className="mt-1 text-[12px] text-ink-faint">
            {f.resolvedBy?.fullName} &middot; {relativeTime(f.resolvedAt)}
          </p>
        </div>
      ) : can("guard.triage") ? (
        mode ? (
          <div className="flex flex-col gap-2">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={mode === "RESOLVED" ? "What happened and what was done, e.g. Cash found in the safe, added to shift" : "Why this isn't a problem"}
              className="min-h-20"
              autoFocus
              aria-label="Note"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setMode(null)}>
                Back
              </Button>
              <Button
                variant={mode === "RESOLVED" ? "primary" : "secondary"}
                onClick={() => triage.mutate(mode)}
                loading={triage.isPending}
                disabled={note.trim().length < 3}
              >
                {mode === "RESOLVED" ? "Resolve with note" : "Dismiss with note"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {f.status === "OPEN" && (
              <Button variant="ghost" onClick={() => triage.mutate("ACKNOWLEDGED")} loading={triage.isPending && triage.variables === "ACKNOWLEDGED"}>
                <Eye size={15} /> Mark as seen
              </Button>
            )}
            <Button variant="secondary" onClick={() => setMode("DISMISSED")}>
              <XCircle size={15} /> Dismiss
            </Button>
            <Button onClick={() => setMode("RESOLVED")} data-testid="resolve-flag">
              <CheckCircle size={15} weight="bold" /> Resolve
            </Button>
          </div>
        )
      ) : (
        <p className="text-[12.5px] text-ink-faint">Owners and managers triage flags. You can read them.</p>
      )}
    </div>
  );
  if (bare) return body;
  return (
    <Panel className="sticky top-20 overflow-hidden">
      <span aria-hidden className="block h-1" style={{ background: m.color }} />
      <div className="px-6 py-5">{body}</div>
    </Panel>
  );
}

function Ev({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className="text-[12.5px] text-ink-muted">{k}</dt>
      <dd className="text-right text-[13px] text-ink">{v}</dd>
    </div>
  );
}

function RulesPanel({ rules, counts }: { rules?: GuardRuleInfo[]; counts?: Partial<Record<string, number>> }) {
  const { requiredPlan } = useEntitlements();
  if (!rules) return null;
  const locked = rules.filter((r) => !r.enabled);
  const plan = requiredPlan("revenue_guard_full");
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="display-sm text-[20px] text-ink">What Revenue Guard watches</h2>
        {locked.length > 0 && <span className="text-[12.5px] text-ink-muted">{locked.length} more rules on {plan.name}</span>}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {rules.map((r) => {
          const meta = GUARD_RULES[r.rule];
          const n = counts?.[r.rule] ?? 0;
          return (
            <div
              key={r.rule}
              className={cn(
                "relative flex flex-col gap-1.5 rounded-md border px-3.5 py-3",
                r.enabled ? "border-line bg-surface" : "border-dashed border-[color-mix(in_oklab,var(--brass)_50%,transparent)] bg-brass-wash/30",
              )}
            >
              <div className="flex items-center gap-2">
                {r.enabled ? <ShieldCheck size={15} weight="duotone" className="text-palm" /> : <LockSimple size={14} weight="bold" className="text-brass" />}
                <span className="truncate text-[13px] font-medium text-ink">{meta?.label ?? r.title}</span>
                {r.enabled && n > 0 && <span className="ml-auto font-mono text-[11.5px] text-laterite">{n}</span>}
              </div>
              <p className="text-[11.5px] leading-snug text-ink-muted">{meta?.blurb ?? r.description}</p>
              {!r.enabled && (
                <button
                  onClick={() => openUpgrade({ kind: "feature", feature: "revenue_guard_full", requiredPlan: plan.code })}
                  className="mt-auto inline-flex items-center gap-1.5 self-start pt-1 text-[11.5px] font-medium text-brass hover:underline"
                >
                  <PlanPlate name={plan.name} code={plan.code} className="h-4 text-[9px]" /> Unlock
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
