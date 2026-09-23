"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CalendarBlank, Receipt, ClockCountdown } from "@phosphor-icons/react";
import { hotelApi } from "@/lib/api/endpoints";
import { useBilling, useInvoices, useMe, usePublicFeatures, usePublicPlans } from "@/lib/api/hooks";
import type { BillingInterval, Plan } from "@/lib/api/types";
import { LIMIT_LABEL, SUB_STATUS, type Tone } from "@/lib/catalog";
import { daysUntil, formatDate, naira } from "@/lib/format";
import { toast } from "@/lib/store";
import { Badge, EmptyState, ErrorState, Meter, PageHeader, Panel, PanelHeader, PlanPlate, Skeleton } from "@/components/ui/primitives";
import { Th } from "@/components/ui/table";
import { AdireField } from "@/components/motifs/adire";
import { PlanCompare } from "./plan-compare";

export const PENDING_CHECKOUT_KEY = "admin.checkout.pending";

const INVOICE_TONE: Record<string, Tone> = { PAID: "palm", SUCCESS: "palm", FAILED: "danger", PENDING: "brass", VOID: "neutral" };

export function BillingView() {
  const me = useMe();
  const billing = useBilling();
  const plans = usePublicPlans();
  const features = usePublicFeatures();
  const invoices = useInvoices();
  const params = useSearchParams();
  const target = params.get("plan");
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (target && plans.data) document.getElementById("plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [target, plans.data]);

  const checkout = useMutation({
    mutationFn: ({ plan, interval }: { plan: Plan; interval: BillingInterval }) => hotelApi.checkout(plan.code, interval),
    onMutate: ({ plan }) => setPending(plan.code),
    onSuccess: (res, { plan, interval }) => {
      try {
        sessionStorage.setItem(
          PENDING_CHECKOUT_KEY,
          JSON.stringify({
            reference: res.reference,
            planCode: plan.code,
            planName: plan.name,
            interval,
            amountKobo: interval === "MONTHLY" ? plan.priceMonthlyKobo : plan.priceYearlyKobo,
          }),
        );
      } catch {
        /* ignore */
      }
      toast.info("Taking you to secure payment", `${plan.name}, ${interval === "MONTHLY" ? "monthly" : "yearly"}`);
      window.location.href = res.authorizationUrl;
    },
    onSettled: () => setPending(null),
    meta: { errorTitle: "Couldn't start checkout" },
  });

  const sub = billing.data?.subscription ?? me.data?.subscription;
  const plan = billing.data?.plan ?? plans.data?.find((p) => p.code === sub?.planCode);
  const left = sub?.status === "TRIALING" ? daysUntil(sub.trialEndsAt) : null;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Receipt size={14} weight="duotone" /> Billing &amp; plan
          </>
        }
        title={
          <>
            Your plan, <em>in plain naira</em>.
          </>
        }
        description="No setup fees and no surprises. Upgrade when the hotel grows, and every change is prorated."
      />

      {/* current plan */}
      <Panel className="relative mb-10 overflow-hidden">
        {!sub ? (
          <div className="grid gap-6 p-6 md:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        ) : (
          <div className="grid md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
            <div className="relative overflow-hidden bg-[#1f2d48] p-6 text-[#ece3d2] sm:p-8 dark:bg-[#141d30]">
              <AdireField cols={8} rows={5} animated={false} className="absolute inset-0 h-full w-full text-[#ece3d2] opacity-[0.16] [mask-image:linear-gradient(100deg,transparent_25%,black_95%)]" />
              <div className="relative">
                <p className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-[#ece3d2]/65">Current plan</p>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <h2 className="display text-[44px] leading-none text-[#f4ecdd]">{sub.planName}</h2>
                  <span className="rounded-xs border border-[#ece3d2]/40 px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.14em] text-[#ece3d2]/90">
                    {SUB_STATUS[sub.status]?.label ?? sub.status}
                  </span>
                </div>
                <p className="mt-3 max-w-sm text-[13.5px] text-[#ece3d2]/75">{plan?.tagline}</p>
                <div className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
                  {plan && plan.priceMonthlyKobo != null && (
                    <div>
                      <p className="font-mono text-[24px] leading-none text-[#f4ecdd]">
                        {naira(sub.interval === "YEARLY" ? plan.priceYearlyKobo : plan.priceMonthlyKobo)}
                      </p>
                      <p className="mt-1 text-[12px] text-[#ece3d2]/60">per {sub.interval === "YEARLY" ? "year" : "month"}</p>
                    </div>
                  )}
                  {left !== null ? (
                    <div>
                      <p className="flex items-center gap-2 font-mono text-[24px] leading-none text-[#f0c38e]">
                        <ClockCountdown size={20} weight="duotone" /> {left}
                      </p>
                      <p className="mt-1 text-[12px] text-[#ece3d2]/60">days of trial, ends {formatDate(sub.trialEndsAt)}</p>
                    </div>
                  ) : sub.currentPeriodEnd ? (
                    <div>
                      <p className="flex items-center gap-2 font-mono text-[24px] leading-none text-[#f4ecdd]">
                        <CalendarBlank size={20} weight="duotone" /> {formatDate(sub.currentPeriodEnd, { year: undefined })}
                      </p>
                      <p className="mt-1 text-[12px] text-[#ece3d2]/60">
                        {sub.status === "ACTIVE" ? "next renewal" : "period ended"}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4 p-6 sm:p-8">
              <p className="eyebrow">Usage this period</p>
              {me.data ? (
                (["max_rooms", "max_staff", "max_properties"] as const).map((k) => (
                  <Meter
                    key={k}
                    label={LIMIT_LABEL[k].label}
                    used={
                      k === "max_rooms"
                        ? me.data.entitlements.usage.rooms
                        : k === "max_staff"
                          ? me.data.entitlements.usage.staff
                          : me.data.entitlements.usage.properties
                    }
                    max={me.data.entitlements.limits[k]}
                  />
                ))
              ) : (
                <Skeleton className="h-24" />
              )}
              {billing.data?.nextInvoice && (
                <p className="mt-auto border-t border-line pt-4 text-[13px] text-ink-muted">
                  Next invoice{" "}
                  <span className="font-mono text-ink">{naira(billing.data.nextInvoice.amountKobo)}</span>
                  {billing.data.nextInvoice.dueAt && <> on {formatDate(billing.data.nextInvoice.dueAt)}</>}
                </p>
              )}
              {sub.status === "TRIALING" && (
                <p className="mt-auto rounded-md border border-[color-mix(in_oklab,var(--brass)_40%,transparent)] bg-brass-wash/60 px-3 py-2.5 text-[13px] text-ink">
                  Choose a plan before your trial ends to keep editing without a pause. Your data stays either way.
                </p>
              )}
            </div>
          </div>
        )}
      </Panel>

      {/* plans */}
      <section id="plans" className="scroll-mt-20" aria-labelledby="plans-title">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow mb-2">Plans</p>
            <h2 id="plans-title" className="display text-[30px] leading-tight text-ink">
              Four tiers, <em>one ledger</em>.
            </h2>
          </div>
        </div>
        {plans.isLoading ? (
          <Skeleton className="h-[520px] w-full rounded-lg" />
        ) : plans.isError ? (
          <Panel>
            <ErrorState error={plans.error} onRetry={() => plans.refetch()} />
          </Panel>
        ) : (
          <PlanCompare
            plans={plans.data ?? []}
            features={features.data}
            currentCode={sub?.planCode}
            currentStatus={sub?.status}
            targetCode={target}
            pendingCode={pending}
            onChoose={(plan, interval) => checkout.mutate({ plan, interval })}
          />
        )}
      </section>

      {/* invoices */}
      <Panel className="mt-10 overflow-hidden">
        <PanelHeader eyebrow="Receipts" title="Invoices" description="Every payment, with its Paystack reference." />
        {invoices.isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-8" />
            ))}
          </div>
        ) : invoices.isError ? (
          <ErrorState error={invoices.error} onRetry={() => invoices.refetch()} />
        ) : !invoices.data?.length ? (
          <EmptyState compact glyph="ladder" title="No invoices yet" body="Your first invoice appears here once you choose a plan." />
        ) : (
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[620px] border-collapse text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-line">
                  <Th className="pl-5">Reference</Th>
                  <Th>Date</Th>
                  <Th>Plan</Th>
                  <Th>Status</Th>
                  <Th className="pr-5 text-right">Amount</Th>
                </tr>
              </thead>
              <tbody>
                {invoices.data.map((inv) => (
                  <tr key={inv.id} className="border-b border-line last:border-b-0 hover:bg-surface-2/40">
                    <td className="py-3 pl-5 font-mono text-[12.5px] text-ink">{inv.reference}</td>
                    <td className="py-3 text-ink-muted">{formatDate(inv.paidAt ?? inv.createdAt)}</td>
                    <td className="py-3">
                      <span className="flex items-center gap-2">
                        <PlanPlate name={inv.planCode} code={inv.planCode} />
                        <span className="text-[12.5px] text-ink-muted">{inv.interval === "YEARLY" ? "yearly" : "monthly"}</span>
                      </span>
                    </td>
                    <td className="py-3">
                      <Badge tone={INVOICE_TONE[inv.status?.toUpperCase()] ?? "neutral"} dot>
                        {inv.status?.charAt(0) + inv.status?.slice(1).toLowerCase()}
                      </Badge>
                    </td>
                    <td className="py-3 pr-5 text-right font-mono text-ink">{naira(inv.amountKobo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
