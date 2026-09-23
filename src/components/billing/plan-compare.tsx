"use client";

import { Fragment, useState } from "react";
import { ArrowRight, Check, Minus, EnvelopeSimple } from "@phosphor-icons/react";
import type { BillingInterval, FeatureInfo, Plan } from "@/lib/api/types";
import { FALLBACK_FEATURES, LIMIT_LABEL, PLAN_TONE } from "@/lib/catalog";
import { config } from "@/lib/config";
import { naira } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/primitives";

const CATEGORY_ORDER = ["Operations", "Revenue", "Guests", "Growth", "Platform"];

export function savingsKobo(p: Plan) {
  if (p.priceMonthlyKobo == null || p.priceYearlyKobo == null) return 0;
  return Math.max(0, p.priceMonthlyKobo * 12 - p.priceYearlyKobo);
}

export function PlanCompare({
  plans,
  features,
  currentCode,
  currentStatus,
  targetCode,
  onChoose,
  pendingCode,
}: {
  plans: Plan[];
  features: FeatureInfo[] | undefined;
  currentCode?: string;
  currentStatus?: string;
  targetCode?: string | null;
  onChoose: (plan: Plan, interval: BillingInterval) => void;
  pendingCode?: string | null;
}) {
  const [interval, setInterval] = useState<BillingInterval>("MONTHLY");
  const feats = features?.length ? features : FALLBACK_FEATURES;
  const currentIdx = plans.findIndex((p) => p.code === currentCode);
  const maxSaving = Math.max(0, ...plans.map(savingsKobo));
  const trialing = currentStatus === "TRIALING";

  const groups = CATEGORY_ORDER.map((cat) => ({ cat, items: feats.filter((f) => f.category === cat) })).filter(
    (g) => g.items.length,
  );
  const other = feats.filter((f) => !CATEGORY_ORDER.includes(String(f.category)));
  if (other.length) groups.push({ cat: "Other", items: other });

  return (
    <div>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Segmented
          label="Billing interval"
          value={interval}
          onChange={setInterval}
          options={[
            { value: "MONTHLY", label: "Monthly" },
            { value: "YEARLY", label: "Yearly" },
          ]}
        />
        {maxSaving > 0 && (
          <p className="text-[13px] text-ink-muted">
            Pay yearly and get <span className="display-sm italic text-ink">two months on the house</span>.
          </p>
        )}
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[860px] table-fixed border-collapse text-left">
          <thead>
            <tr className="align-top">
              <th scope="col" className="w-[26%] border-b border-line p-5 text-left align-bottom">
                <span className="eyebrow">Compare plans</span>
                <p className="mt-2 text-[12.5px] font-normal text-ink-muted">Prices in naira, VAT inclusive.</p>
              </th>
              {plans.map((p, i) => {
                const price = interval === "MONTHLY" ? p.priceMonthlyKobo : p.priceYearlyKobo;
                const isCurrent = p.code === currentCode;
                const isTarget = p.code === targetCode && !isCurrent;
                const tone = PLAN_TONE[p.code] ?? "var(--ink)";
                const saving = savingsKobo(p);
                return (
                  <th
                    key={p.code}
                    scope="col"
                    className={cn(
                      "relative border-b border-l border-line p-5 text-left font-normal",
                      (p.highlighted || isTarget) && "bg-[color-mix(in_oklab,var(--brass)_6%,var(--surface))]",
                    )}
                  >
                    <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: tone }} />
                    <div className="mb-2 flex h-[18px] items-center gap-2">
                      {p.highlighted && !isCurrent && (
                        <span className="rounded-xs border border-[color-mix(in_oklab,var(--brass)_45%,transparent)] px-1.5 py-px font-mono text-[9.5px] uppercase tracking-[0.14em] text-brass">
                          Most chosen
                        </span>
                      )}
                      {isCurrent && (
                        <span className="rounded-xs bg-ink px-1.5 py-px font-mono text-[9.5px] uppercase tracking-[0.14em] text-paper">
                          {trialing ? "Your trial" : "Your plan"}
                        </span>
                      )}
                    </div>
                    <span className="display-sm block text-[22px] leading-none text-ink">{p.name}</span>
                    <p className="mt-2 min-h-[70px] text-[12.5px] leading-snug text-ink-muted">{p.tagline}</p>
                    <div className="mt-4 flex items-baseline gap-1">
                      {price == null ? (
                        <span className="display text-[30px] leading-none text-ink">
                          <em>Custom</em>
                        </span>
                      ) : (
                        <>
                          <span className="font-mono text-[28px] leading-none tracking-tight text-ink">{naira(price)}</span>
                          <span className="text-[12px] text-ink-muted">/{interval === "MONTHLY" ? "mo" : "yr"}</span>
                        </>
                      )}
                    </div>
                    <p className="mt-1.5 h-4 text-[12px] text-palm">
                      {interval === "YEARLY" && saving > 0 ? `You save ${naira(saving)} a year` : " "}
                    </p>
                    <div className="mt-4">
                      {price == null ? (
                        <a
                          href={`mailto:${config.supportEmail}?subject=${encodeURIComponent(`${p.name} plan`)}`}
                          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-line-strong bg-surface text-[13.5px] font-medium text-ink hover:bg-surface-2"
                        >
                          <EnvelopeSimple size={15} /> Talk to us
                        </a>
                      ) : isCurrent && !trialing ? (
                        <Button variant="secondary" disabled className="w-full">
                          Your plan
                        </Button>
                      ) : (
                        <Button
                          variant={isTarget || (p.highlighted && currentIdx < i) || (isCurrent && trialing) ? "primary" : "secondary"}
                          className="w-full"
                          loading={pendingCode === p.code}
                          onClick={() => onChoose(p, interval)}
                        >
                          {isCurrent && trialing ? "Keep " + p.name : currentIdx > i ? `Switch to ${p.name}` : `Upgrade to ${p.name}`}
                          <ArrowRight size={14} weight="bold" />
                        </Button>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="text-[13px]">
            <GroupRow label="Capacity" span={plans.length + 1} />
            {(["max_rooms", "max_staff", "max_properties"] as const).map((k) => (
              <tr key={k} className="border-b border-line">
                <th scope="row" className="px-5 py-2.5 font-normal text-ink-muted">
                  {LIMIT_LABEL[k].label}
                </th>
                {plans.map((p) => {
                  const v = p.limits?.[k];
                  return (
                    <td key={p.code} className="border-l border-line px-5 py-2.5 font-mono text-ink">
                      {v === undefined ? "-" : v < 0 ? "Unlimited" : v}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-b border-line">
              <th scope="row" className="px-5 py-2.5 font-normal text-ink-muted">
                Marketplace commission
              </th>
              {plans.map((p) => (
                <td key={p.code} className="border-l border-line px-5 py-2.5 font-mono text-ink">
                  {p.commissionBps == null ? "Negotiated" : `${(p.commissionBps / 100).toFixed(p.commissionBps % 100 ? 1 : 0)}%`}
                </td>
              ))}
            </tr>
            {groups.map((g) => (
              <Fragment key={g.cat}>
                <GroupRow label={g.cat} span={plans.length + 1} />
                {g.items.map((f) => (
                  <tr key={f.code} className="border-b border-line last:border-b-0 hover:bg-surface-2/40">
                    <th scope="row" className="px-5 py-2.5 text-left font-normal">
                      <span className="text-ink">{f.name}</span>
                      <span className="block text-[11.5px] leading-snug text-ink-faint">{f.description}</span>
                    </th>
                    {plans.map((p) => {
                      const on = p.features.includes(f.code);
                      return (
                        <td key={p.code} className="border-l border-line px-5 py-2.5">
                          {on ? (
                            <Check size={15} weight="bold" className="text-palm" aria-label="Included" />
                          ) : (
                            <Minus size={15} className="text-line-strong" aria-label="Not included" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GroupRow({ label, span }: { label: string; span: number }) {
  return (
    <tr className="border-b border-line bg-paper/70">
      <th scope="colgroup" colSpan={span} className="eyebrow px-5 pb-2 pt-4 text-left text-[10.5px] font-normal">
        {label}
      </th>
    </tr>
  );
}
