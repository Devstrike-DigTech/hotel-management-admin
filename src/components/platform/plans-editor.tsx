"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Stack, WarningCircle } from "@phosphor-icons/react";
import { platformApi } from "@/lib/api/endpoints";
import { qk, usePlatformMetrics, usePlatformPlans, usePublicFeatures } from "@/lib/api/hooks";
import type { Plan, PlanPatch } from "@/lib/api/types";
import { FALLBACK_FEATURES, LIMIT_LABEL, planTone } from "@/lib/catalog";
import { naira } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { AffixInput, Checkbox, Field, Input, Switch } from "@/components/ui/form";
import { ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";

const CATS = ["Operations", "Revenue", "Guests", "Growth", "Platform"];
const LIMITS = ["max_rooms", "max_staff", "max_properties"] as const;

export function PlansEditor() {
  const plans = usePlatformPlans();
  const [active, setActive] = useState<string | null>(null);
  const current = plans.data?.find((p) => p.code === (active ?? plans.data?.[0]?.code));

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Stack size={14} weight="duotone" /> Plans
          </>
        }
        title={
          <>
            Prices, limits <em>and what&rsquo;s inside</em>.
          </>
        }
        description="Edits apply to every tenant on the plan at their next entitlement check. Prices change for new checkouts."
      />
      {plans.isLoading ? (
        <Skeleton className="h-[560px] w-full rounded-lg" />
      ) : plans.isError ? (
        <Panel>
          <ErrorState error={plans.error} onRetry={() => plans.refetch()} />
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <nav aria-label="Plans" className="flex gap-2 overflow-x-auto lg:flex-col">
            {plans.data!.map((p) => {
              const on = p.code === current?.code;
              return (
                <button
                  key={p.code}
                  onClick={() => setActive(p.code)}
                  aria-current={on ? "true" : undefined}
                  className={cn(
                    "relative flex min-w-[160px] flex-col items-start rounded-md border px-4 py-3 text-left transition-colors",
                    on ? "border-ink bg-surface" : "border-line bg-surface/60 hover:border-line-strong",
                  )}
                >
                  <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-r-xs" style={{ background: planTone(p.code) }} />
                  <span className="display-sm text-[17px] text-ink">{p.name}</span>
                  <span className="font-mono text-[12px] text-ink-muted">
                    {p.priceMonthlyKobo == null ? "Custom" : `${naira(p.priceMonthlyKobo)}/mo`}
                  </span>
                </button>
              );
            })}
          </nav>
          {current && <PlanForm key={current.code + JSON.stringify(current)} plan={current} />}
        </div>
      )}
    </>
  );
}

const koboToNaira = (k: number | null) => (k == null ? "" : String(Math.round(k / 100)));

function PlanForm({ plan }: { plan: Plan }) {
  const qc = useQueryClient();
  const features = usePublicFeatures();
  const metrics = usePlatformMetrics();
  const feats = features.data?.length ? features.data : FALLBACK_FEATURES;

  const [name, setName] = useState(plan.name);
  const [tagline, setTagline] = useState(plan.tagline ?? "");
  const [custom, setCustom] = useState(plan.priceMonthlyKobo == null);
  const [monthly, setMonthly] = useState(koboToNaira(plan.priceMonthlyKobo));
  const [yearly, setYearly] = useState(koboToNaira(plan.priceYearlyKobo));
  const [limits, setLimits] = useState<Record<string, number>>({ ...plan.limits });
  const [commission, setCommission] = useState(plan.commissionBps == null ? "" : String(plan.commissionBps / 100));
  const [highlighted, setHighlighted] = useState(plan.highlighted);
  const [included, setIncluded] = useState<Set<string>>(new Set(plan.features));

  const patch: PlanPatch = {
    name: name.trim(),
    tagline: tagline.trim(),
    priceMonthlyKobo: custom ? null : Math.round(Number(monthly || 0) * 100),
    priceYearlyKobo: custom ? null : Math.round(Number(yearly || 0) * 100),
    limits,
    commissionBps: commission === "" ? null : Math.round(Number(commission) * 100),
    highlighted,
    features: feats.map((f) => f.code).filter((c) => included.has(c)),
  };
  const original: PlanPatch = {
    name: plan.name,
    tagline: plan.tagline ?? "",
    priceMonthlyKobo: plan.priceMonthlyKobo,
    priceYearlyKobo: plan.priceYearlyKobo,
    limits: plan.limits,
    commissionBps: plan.commissionBps,
    highlighted: plan.highlighted,
    features: feats.map((f) => f.code).filter((c) => plan.features.includes(c)),
  };
  const changedKeys = (Object.keys(patch) as (keyof PlanPatch)[]).filter(
    (k) => JSON.stringify(patch[k]) !== JSON.stringify(original[k]),
  );
  const dirty = changedKeys.length > 0;
  const tenantsOnPlan = plan.tenantCount ?? metrics.data?.tenantsByPlan?.[plan.code];

  const save = useMutation({
    mutationFn: () => {
      const body: PlanPatch = {};
      for (const k of changedKeys) (body as Record<string, unknown>)[k] = patch[k];
      return platformApi.updatePlan(plan.code, body);
    },
    onSuccess: () => {
      toast.success(`${name} saved`, tenantsOnPlan ? `Applies to ${tenantsOnPlan} hotels on this plan.` : undefined);
      void qc.invalidateQueries({ queryKey: qk.pPlans });
      void qc.invalidateQueries({ queryKey: qk.plans });
    },
    meta: { errorTitle: "Plan not saved" },
  });

  const yearlySaving =
    !custom && monthly && yearly ? Number(monthly) * 12 - Number(yearly) : 0;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <Panel>
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="h-3 w-3 rounded-full" style={{ background: planTone(plan.code) }} aria-hidden />
            <h2 className="display-sm text-[21px] text-ink">{plan.name}</h2>
            <span className="font-mono text-[12px] text-ink-faint">{plan.code}</span>
          </div>
          {tenantsOnPlan !== undefined && (
            <span className="text-[12.5px] text-ink-muted">
              <span className="font-mono text-ink">{tenantsOnPlan}</span> hotels on this plan
            </span>
          )}
        </div>
        <div className="grid gap-5 p-5 sm:grid-cols-2 sm:p-6">
          <Field label="Name" htmlFor="pl-name">
            <Input id="pl-name" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Tagline" htmlFor="pl-tag">
            <Input id="pl-tag" value={tagline} onChange={(e) => setTagline(e.target.value)} />
          </Field>
          <div className="sm:col-span-2">
            <Switch checked={custom} onChange={setCustom} label="Custom pricing" description="Hide prices and show 'Talk to us'. Used for Enterprise." />
          </div>
          {!custom && (
            <>
              <Field label="Monthly price" htmlFor="pl-m">
                <AffixInput id="pl-m" prefix="₦" suffix="/mo" inputMode="numeric" className="font-mono" value={monthly} onChange={(e) => setMonthly(e.target.value.replace(/[^\d]/g, ""))} />
              </Field>
              <Field
                label="Yearly price"
                htmlFor="pl-y"
                hint={yearlySaving > 0 ? `Customers save ₦${yearlySaving.toLocaleString("en-NG")} (${(yearlySaving / Number(monthly)).toFixed(1)} months)` : undefined}
              >
                <AffixInput id="pl-y" prefix="₦" suffix="/yr" inputMode="numeric" className="font-mono" value={yearly} onChange={(e) => setYearly(e.target.value.replace(/[^\d]/g, ""))} />
              </Field>
            </>
          )}
          {LIMITS.map((k) => {
            const v = limits[k] ?? 0;
            const unlimited = v < 0;
            return (
              <Field key={k} label={LIMIT_LABEL[k].label} htmlFor={`pl-${k}`}>
                <div className="flex items-center gap-3">
                  <Input
                    id={`pl-${k}`}
                    type="number"
                    min={0}
                    className="max-w-[120px] font-mono"
                    disabled={unlimited}
                    value={unlimited ? "" : v}
                    placeholder={unlimited ? "Unlimited" : ""}
                    onChange={(e) => setLimits((l) => ({ ...l, [k]: Number(e.target.value) }))}
                  />
                  <Checkbox checked={unlimited} onChange={(c) => setLimits((l) => ({ ...l, [k]: c ? -1 : 1 }))} label="Unlimited" />
                </div>
              </Field>
            );
          })}
          <Field label="Marketplace commission" htmlFor="pl-com" hint="Leave empty for negotiated rates.">
            <AffixInput id="pl-com" suffix="%" inputMode="decimal" className="font-mono" value={commission} onChange={(e) => setCommission(e.target.value.replace(/[^\d.]/g, ""))} />
          </Field>
          <div className="sm:col-span-2">
            <Switch checked={highlighted} onChange={setHighlighted} label="Highlight on pricing pages" description="Shows a 'Most chosen' mark next to this plan." />
          </div>
        </div>
      </Panel>

      <Panel>
        <div className="flex items-center justify-between border-b border-line px-5 py-4 sm:px-6">
          <div>
            <h2 className="display-sm text-[19px] text-ink">Features</h2>
            <p className="text-[13px] text-ink-muted">
              <span className="font-mono text-ink">{included.size}</span> of {feats.length} included
            </p>
          </div>
        </div>
        <div className="grid gap-x-8 gap-y-6 p-5 sm:grid-cols-2 sm:p-6">
          {[...CATS, "Other"].map((cat) => {
            const list = feats.filter((f) => (cat === "Other" ? !CATS.includes(String(f.category)) : f.category === cat));
            if (!list.length) return null;
            return (
              <fieldset key={cat}>
                <legend className="eyebrow mb-2.5">{cat}</legend>
                <div className="flex flex-col gap-2">
                  {list.map((f) => (
                    <Checkbox
                      key={f.code}
                      checked={included.has(f.code)}
                      onChange={(c) =>
                        setIncluded((s) => {
                          const n = new Set(s);
                          if (c) n.add(f.code);
                          else n.delete(f.code);
                          return n;
                        })
                      }
                      label={f.name}
                    />
                  ))}
                </div>
              </fieldset>
            );
          })}
        </div>
      </Panel>

      <div
        className={cn(
          "sticky bottom-4 z-20 flex items-center gap-3 rounded-lg border border-line bg-ink px-4 py-3 text-paper shadow-float transition-all duration-200",
          dirty ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-3 opacity-0",
        )}
        aria-hidden={!dirty}
      >
        <WarningCircle size={18} weight="duotone" className="shrink-0 text-brass" />
        <p className="flex-1 text-[13px]">
          {changedKeys.length} unsaved {changedKeys.length === 1 ? "change" : "changes"}
          {tenantsOnPlan ? <span className="text-paper/65"> &middot; affects {tenantsOnPlan} hotels</span> : null}
        </p>
        <Button size="sm" loading={save.isPending} onClick={() => save.mutate()} tabIndex={dirty ? 0 : -1}>
          Save plan
        </Button>
      </div>
    </div>
  );
}
