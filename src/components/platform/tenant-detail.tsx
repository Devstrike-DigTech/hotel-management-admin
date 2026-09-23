"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowSquareOut, Check, EnvelopeSimple, Phone, PuzzlePiece } from "@phosphor-icons/react";
import { platformApi } from "@/lib/api/endpoints";
import { qk, usePlatformPlans, usePlatformTenant, usePublicFeatures } from "@/lib/api/hooks";
import type { SubscriptionStatus, TenantDetail } from "@/lib/api/types";
import { FALLBACK_FEATURES, PLAN_NAMES, SUB_STATUS, SUB_STATUS_ORDER } from "@/lib/catalog";
import { config } from "@/lib/config";
import { daysUntil, formatDate, formatPhone } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Switch } from "@/components/ui/form";
import { Badge, ErrorState, Panel, PanelHeader, PlanPlate, Skeleton } from "@/components/ui/primitives";

export function TenantDetailView({ id }: { id: string }) {
  const t = usePlatformTenant(id);
  if (t.isLoading)
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-12 w-80" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  if (t.isError || !t.data)
    return (
      <Panel>
        <ErrorState error={t.error} onRetry={() => t.refetch()} />
      </Panel>
    );
  return <Detail key={t.dataUpdatedAt} tenant={t.data} />;
}

function toDateInput(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(iso).toISOString().slice(0, 10);
}

function Detail({ tenant }: { tenant: TenantDetail }) {
  const qc = useQueryClient();
  const plans = usePlatformPlans();
  const features = usePublicFeatures();
  const sub = tenant.subscription;
  const [planCode, setPlanCode] = useState<string>(sub?.planCode ?? tenant.planCode);
  const [status, setStatus] = useState<SubscriptionStatus>(sub?.status ?? tenant.status);
  const [trialEnds, setTrialEnds] = useState(toDateInput(sub?.trialEndsAt ?? tenant.trialEndsAt));

  const originalTrial = toDateInput(sub?.trialEndsAt ?? tenant.trialEndsAt);
  const dirty = planCode !== (sub?.planCode ?? tenant.planCode) || status !== (sub?.status ?? tenant.status) || trialEnds !== originalTrial;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: qk.pTenant(tenant.id) });
    void qc.invalidateQueries({ queryKey: ["platform", "tenants"] });
    void qc.invalidateQueries({ queryKey: qk.pMetrics });
  };

  const saveSub = useMutation({
    mutationFn: () =>
      platformApi.updateSubscription(tenant.id, {
        ...(planCode !== (sub?.planCode ?? tenant.planCode) ? { planCode } : {}),
        ...(status !== (sub?.status ?? tenant.status) ? { status } : {}),
        ...(trialEnds !== originalTrial && trialEnds ? { trialEndsAt: new Date(`${trialEnds}T23:59:00+01:00`).toISOString() } : {}),
      }),
    onSuccess: () => {
      toast.success("Subscription updated", `${tenant.name} is now ${PLAN_NAMES[planCode] ?? planCode}, ${SUB_STATUS[status].label.toLowerCase()}.`);
      invalidate();
    },
    meta: { errorTitle: "Subscription not updated" },
  });

  const overrides = new Map((tenant.featureOverrides ?? []).map((o) => [o.featureCode, o.enabled]));
  const [local, setLocal] = useState<Map<string, boolean>>(overrides);
  const setFeature = useMutation({
    mutationFn: ({ code, enabled }: { code: string; enabled: boolean }) =>
      enabled ? platformApi.setFeature(tenant.id, code, true) : platformApi.removeFeature(tenant.id, code),
    onMutate: ({ code, enabled }) => setLocal((m) => new Map(m).set(code, enabled)),
    onError: (_e, { code }) =>
      setLocal((m) => {
        const n = new Map(m);
        if (overrides.has(code)) n.set(code, overrides.get(code)!);
        else n.delete(code);
        return n;
      }),
    onSuccess: (_d, { code, enabled }) => {
      toast.success(enabled ? "Add-on granted" : "Add-on removed", FALLBACK_FEATURES.find((f) => f.code === code)?.name);
      void qc.invalidateQueries({ queryKey: qk.pTenant(tenant.id) });
    },
    meta: { errorTitle: "Add-on not changed" },
  });

  const plan = plans.data?.find((p) => p.code === planCode);
  const planFeatures = new Set(plan?.features ?? []);
  const feats = features.data?.length ? features.data : FALLBACK_FEATURES;
  const addOnCount = [...local.values()].filter(Boolean).length;
  const left = daysUntil(sub?.trialEndsAt ?? tenant.trialEndsAt);

  const extend = (days: number) => {
    const base = trialEnds ? new Date(`${trialEnds}T12:00:00`) : new Date();
    const start = base.getTime() < Date.now() ? new Date() : base;
    setTrialEnds(new Date(start.getTime() + days * 864e5).toISOString().slice(0, 10));
  };

  return (
    <>
      <Link href="/platform/tenants" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> All tenants
      </Link>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow mb-3 flex items-center gap-2">
            <span className="font-mono normal-case tracking-normal">{tenant.slug}</span>
            <span className="text-ink-faint">&middot;</span> {tenant.city}
          </p>
          <h1 className="display text-[38px] leading-[1.02] text-ink md:text-[46px]">{tenant.name}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <PlanPlate name={PLAN_NAMES[tenant.planCode] ?? tenant.planCode} code={tenant.planCode} />
            <Badge tone={SUB_STATUS[tenant.status]?.tone ?? "neutral"} dot>
              {SUB_STATUS[tenant.status]?.label ?? tenant.status}
            </Badge>
            <span className="text-[12.5px] text-ink-muted">Joined {formatDate(tenant.createdAt)}</span>
          </div>
        </div>
        <a
          href={`${config.webUrl}/hotels/${tenant.slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-9 items-center gap-2 self-start rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink hover:bg-surface-2 md:self-auto"
        >
          Public page <ArrowSquareOut size={15} />
        </a>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Panel>
          <PanelHeader eyebrow="Subscription" title="Plan and status" description="Changes apply to the tenant immediately." />
          <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
            <Field label="Plan" htmlFor="td-plan">
              <Select id="td-plan" value={planCode} onChange={(e) => setPlanCode(e.target.value)}>
                {(plans.data ?? []).map((p) => (
                  <option key={p.code} value={p.code}>
                    {p.name}
                  </option>
                ))}
                {!plans.data && <option value={planCode}>{PLAN_NAMES[planCode] ?? planCode}</option>}
              </Select>
            </Field>
            <Field label="Status" htmlFor="td-status">
              <Select id="td-status" value={status} onChange={(e) => setStatus(e.target.value as SubscriptionStatus)}>
                {SUB_STATUS_ORDER.map((s) => (
                  <option key={s} value={s}>
                    {SUB_STATUS[s].label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Trial ends"
              htmlFor="td-trial"
              className="sm:col-span-2"
              hint={left !== null ? `${left} days from today (Lagos time).` : "No trial set."}
            >
              <div className="flex flex-wrap gap-2">
                <Input id="td-trial" type="date" className="max-w-[200px] font-mono" value={trialEnds} onChange={(e) => setTrialEnds(e.target.value)} />
                <Button variant="secondary" onClick={() => extend(7)}>
                  +7 days
                </Button>
                <Button variant="secondary" onClick={() => extend(14)}>
                  +14 days
                </Button>
              </div>
            </Field>
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-line bg-surface-2/40 px-5 py-3.5 sm:px-6">
            {dirty && (
              <Button
                variant="ghost"
                onClick={() => {
                  setPlanCode(sub?.planCode ?? tenant.planCode);
                  setStatus(sub?.status ?? tenant.status);
                  setTrialEnds(originalTrial);
                }}
              >
                Reset
              </Button>
            )}
            <Button variant="ink" disabled={!dirty} loading={saveSub.isPending} onClick={() => saveSub.mutate()}>
              Apply changes
            </Button>
          </div>
        </Panel>

        <div className="flex flex-col gap-6">
          <Panel className="p-5">
            <p className="eyebrow mb-3">Owner</p>
            {tenant.owner ? (
              <>
                <p className="display-sm text-[18px] text-ink">{tenant.owner.fullName}</p>
                <a href={`mailto:${tenant.owner.email}`} className="mt-2 flex items-center gap-2 text-[13px] text-ink-muted hover:text-ink">
                  <EnvelopeSimple size={14} /> {tenant.owner.email}
                </a>
                {tenant.owner.phone && (
                  <a href={`tel:${tenant.owner.phone}`} className="mt-1 flex items-center gap-2 font-mono text-[12.5px] text-ink-muted hover:text-ink">
                    <Phone size={14} /> {formatPhone(tenant.owner.phone)}
                  </a>
                )}
              </>
            ) : (
              <p className="text-[13px] text-ink-muted">No owner on record.</p>
            )}
          </Panel>
          <Panel className="grid grid-cols-2 divide-x divide-line">
            <div className="p-5">
              <p className="display-sm text-[13.5px] italic text-ink-muted">Rooms</p>
              <p className="mt-1 font-mono text-[28px] text-ink">{tenant.rooms}</p>
            </div>
            <div className="p-5">
              <p className="display-sm text-[13.5px] italic text-ink-muted">Staff</p>
              <p className="mt-1 font-mono text-[28px] text-ink">{tenant.staff}</p>
            </div>
          </Panel>
        </div>
      </div>

      <Panel className="mt-6">
        <PanelHeader
          eyebrow={
            <span className="flex items-center gap-2">
              <PuzzlePiece size={13} weight="duotone" /> Add-ons
            </span>
          }
          title="Features"
          description={`Everything on ${plan?.name ?? "the plan"} is included. Grant anything else individually.`}
          actions={addOnCount > 0 && <Badge tone="brass">{addOnCount} add-on{addOnCount === 1 ? "" : "s"}</Badge>}
        />
        <ul className="grid sm:grid-cols-2 xl:grid-cols-3">
          {feats.map((f) => {
            const included = planFeatures.has(f.code);
            const on = included || !!local.get(f.code);
            const addOn = !included && !!local.get(f.code);
            return (
              <li
                key={f.code}
                className={cn(
                  "flex items-start gap-3 border-b border-line px-5 py-3.5 sm:[&:nth-child(odd)]:border-r xl:[&:nth-child(odd)]:border-r-0 xl:[&:not(:nth-child(3n))]:border-r",
                  addOn && "bg-brass-wash/40",
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-[13.5px] text-ink">
                    {f.name}
                    {addOn && <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-brass">add-on</span>}
                  </p>
                  <p className="text-[12px] leading-snug text-ink-faint">{f.description}</p>
                </div>
                {included ? (
                  <span className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] text-palm" title="Included in plan">
                    <Check size={13} weight="bold" /> Plan
                  </span>
                ) : (
                  <Switch
                    ariaLabel={`Grant ${f.name} as an add-on`}
                    checked={on}
                    disabled={setFeature.isPending && setFeature.variables?.code === f.code}
                    onChange={(v) => setFeature.mutate({ code: f.code, enabled: v })}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </>
  );
}
