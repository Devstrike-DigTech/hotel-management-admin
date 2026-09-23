"use client";

import Link from "next/link";
import { ArrowUpRight, ChartBar } from "@phosphor-icons/react";
import { usePlatformMetrics } from "@/lib/api/hooks";
import type { SubscriptionStatus } from "@/lib/api/types";
import { PLAN_NAMES, PLAN_ORDER, SUB_STATUS, SUB_STATUS_ORDER, planTone } from "@/lib/catalog";
import { daysUntil, formatDate, lagosLongDate, naira, nairaCompact, number } from "@/lib/format";
import { EmptyState, ErrorState, PageHeader, Panel, PanelHeader, PlanPlate, Skeleton } from "@/components/ui/primitives";
import { ColumnChart, ShareBar, UnitRows } from "@/components/charts/charts";

const STATUS_COLOR: Record<SubscriptionStatus, string> = {
  TRIALING: "var(--brass)",
  ACTIVE: "var(--palm)",
  PAST_DUE: "var(--ochre)",
  READ_ONLY: "var(--danger)",
  SUSPENDED: "var(--danger)",
  CANCELLED: "var(--ink-faint)",
};

export function OverviewView() {
  const m = usePlatformMetrics();
  const d = m.data;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <ChartBar size={14} weight="duotone" /> <span suppressHydrationWarning>{lagosLongDate()}</span>
          </>
        }
        title={
          <>
            The platform, <em>at a glance</em>.
          </>
        }
        description="Recurring revenue, where tenants sit across plans, and who needs a nudge before their trial runs out."
      />

      {m.isError ? (
        <Panel>
          <ErrorState error={m.error} onRetry={() => m.refetch()} />
        </Panel>
      ) : (
        <>
          <Panel className="mb-6 grid grid-cols-2 md:grid-cols-4 [&>*]:border-line max-md:[&>*:nth-child(-n+2)]:border-b max-md:[&>*:nth-child(odd)]:border-r md:[&>*:not(:first-child)]:border-l">
            <Hero label="Monthly recurring" value={d ? nairaCompact(d.mrrKobo) : null} sub={d ? naira(d.mrrKobo) : ""} accent />
            <Hero label="Annual run-rate" value={d ? nairaCompact(d.arrKobo) : null} sub={d ? naira(d.arrKobo) : ""} />
            <Hero label="Hotels" value={d ? number(d.tenantsTotal) : null} sub="tenants on the platform" />
            <Hero label="New in 30 days" value={d ? number(d.newTenants30d) : null} sub="signups" />
          </Panel>

          <div className="grid gap-6 lg:grid-cols-12">
            <Panel className="lg:col-span-7">
              <PanelHeader eyebrow="Growth" title="Signups by week" description="New hotel accounts, last 12 weeks" />
              <div className="px-4 pb-4 pt-5 sm:px-5">
                {d ? (
                  d.signupsByWeek?.length ? (
                    <ColumnChart
                      label="Signups by week"
                      data={d.signupsByWeek.map((w) => ({ x: w.week, y: w.count }))}
                      formatX={(s) => formatDate(s, { day: "numeric", month: "short", year: undefined })}
                    />
                  ) : (
                    <EmptyState compact glyph="arcs" title="No signups yet" />
                  )
                ) : (
                  <Skeleton className="h-[180px]" />
                )}
              </div>
            </Panel>

            <Panel className="lg:col-span-5">
              <PanelHeader eyebrow="Mix" title="Tenants by plan" />
              <div className="px-5 py-5">
                {d ? (
                  <ShareBar
                    label="Tenants by plan"
                    items={[...new Set([...PLAN_ORDER, ...Object.keys(d.tenantsByPlan ?? {})])].map((code) => ({
                      key: code,
                      label: PLAN_NAMES[code] ?? code,
                      value: d.tenantsByPlan?.[code] ?? 0,
                      color: planTone(code),
                      ink: PLAN_ORDER.includes(code) ? `var(--plan-${code}-ink)` : undefined,
                    }))}
                  />
                ) : (
                  <Skeleton className="h-16" />
                )}
                <p className="mt-5 border-t border-line pt-4 text-[12.5px] text-ink-muted">
                  Paid tenants carry the MRR. Trials count toward their trial plan until they convert.
                </p>
              </div>
            </Panel>

            <Panel className="lg:col-span-5">
              <PanelHeader eyebrow="Health" title="Subscription status" description="One square per hotel" />
              <div className="px-5 py-5">
                {d ? (
                  <UnitRows
                    rows={SUB_STATUS_ORDER.map((s) => ({
                      key: s,
                      label: SUB_STATUS[s].label,
                      value: d.tenantsByStatus?.[s] ?? 0,
                      color: STATUS_COLOR[s],
                      hatch: s === "SUSPENDED",
                    }))}
                  />
                ) : (
                  <Skeleton className="h-40" />
                )}
              </div>
            </Panel>

            <Panel className="overflow-hidden lg:col-span-7">
              <PanelHeader
                eyebrow="Follow up"
                title="Trials ending soon"
                actions={
                  <Link href="/platform/tenants?status=TRIALING" className="inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink">
                    All trials <ArrowUpRight size={13} />
                  </Link>
                }
              />
              {!d ? (
                <div className="space-y-2 p-5">
                  <Skeleton className="h-10" />
                  <Skeleton className="h-10" />
                </div>
              ) : !d.trialsEndingSoon?.length ? (
                <EmptyState compact glyph="frond" title="No trials ending this week" />
              ) : (
                <ul className="divide-y divide-line">
                  {d.trialsEndingSoon.map((t) => {
                    const left = daysUntil(t.trialEndsAt);
                    return (
                      <li key={t.id}>
                        <Link href={`/platform/tenants/${t.id}`} className="flex items-center gap-4 px-5 py-3 hover:bg-surface-2/50">
                          <span
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-md border font-mono text-[15px]"
                            style={{
                              borderColor: left !== null && left <= 2 ? "var(--laterite)" : "var(--line-strong)",
                              color: left !== null && left <= 2 ? "var(--laterite)" : "var(--ink)",
                            }}
                            aria-label={`${left} days left`}
                          >
                            {left}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[14px] font-medium text-ink">{t.name}</span>
                            <span className="block text-[12.5px] text-ink-muted">
                              {t.city} &middot; ends {formatDate(t.trialEndsAt)}
                            </span>
                          </span>
                          <PlanPlate name={t.planCode} code={t.planCode} />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </>
  );
}

function Hero({ label, value, sub, accent }: { label: string; value: string | null; sub?: string; accent?: boolean }) {
  return (
    <div className="flex flex-col gap-2 px-5 py-5 md:px-6">
      <span className="display-sm text-[14.5px] italic text-ink-muted">{label}</span>
      {value === null ? (
        <Skeleton className="h-10 w-24" />
      ) : (
        <span className={`font-mono text-[32px] leading-none tracking-tight md:text-[40px] ${accent ? "text-laterite" : "text-ink"}`}>
          {value}
        </span>
      )}
      {sub && <span className={`text-ink-muted ${/\d/.test(sub) ? "font-mono text-[12px]" : "text-[12.5px]"}`}>{sub}</span>}
    </div>
  );
}
