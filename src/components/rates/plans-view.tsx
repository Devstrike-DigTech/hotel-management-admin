"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Coffee, Notebook, Plus, ShieldSlash, Storefront, Globe, Desktop } from "@phosphor-icons/react";
import { useRatePlans, qk4 } from "@/lib/api/hooks-m4";
import { ratesApi } from "@/lib/api/endpoints-m4";
import { useRoomTypes } from "@/lib/api/hooks";
import type { RateChannel, RatePlan, RatePlanKind } from "@/lib/api/types-m4";
import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/store";
import { naira } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/overlay";
import { Field, Input, Switch, Textarea } from "@/components/ui/form";
import { Badge, ErrorState, PageHeader, Panel, Segmented, Skeleton } from "@/components/ui/primitives";
import { ChipRadio, NairaInput, Stepper } from "@/components/m2/bits";

export const CHANNELS: { value: RateChannel; label: string; icon: React.ReactNode }[] = [
  { value: "FRONT_DESK", label: "Front desk", icon: <Desktop size={13} weight="duotone" /> },
  { value: "BOOKING_SITE", label: "Booking site", icon: <Globe size={13} weight="duotone" /> },
  { value: "MARKETPLACE", label: "Marketplace", icon: <Storefront size={13} weight="duotone" /> },
];

const KIND: Record<RatePlanKind, string> = {
  BAR: "Best available",
  NON_REFUNDABLE: "Non-refundable",
  CORPORATE: "Corporate",
  LONG_STAY: "Long stay",
  PACKAGE: "Package",
};

/** How a plan prices a night, in words. */
export function planRule(p: RatePlan) {
  if (p.isBar) return "The nightly price from the Rate Almanac";
  if (p.pricing === "FIXED") return "Fixed prices per room type";
  if (!p.adjustment) return "Same as the best available rate";
  const v = p.adjustment.value;
  return p.adjustment.type === "PERCENT" ? `${v < 0 ? "" : "+"}${v / 100}% on the best available rate` : `${v < 0 ? "−" : "+"}${naira(Math.abs(v))} a night on the best available rate`;
}

export function PlansView() {
  const plans = useRatePlans();
  const { can } = useCan();
  const [editing, setEditing] = useState<RatePlan | "new" | null>(null);
  const manage = can("rates.manage");
  return (
    <>
      <Link href="/rates" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> Rate Almanac
      </Link>
      <PageHeader
        eyebrow={
          <>
            <Notebook size={14} weight="duotone" /> Rate plans
          </>
        }
        title={
          <>
            One room, <em>several ways</em> to sell it.
          </>
        }
        description="Every plan follows the best available rate unless it has its own prices. Guests see the plans open to their channel next to each room type."
        actions={
          manage && (
            <Button onClick={() => setEditing("new")}>
              <Plus size={15} weight="bold" /> New plan
            </Button>
          )
        }
      />
      {plans.isError ? (
        <Panel>
          <ErrorState error={plans.error} onRetry={() => plans.refetch()} />
        </Panel>
      ) : !plans.data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {plans.data.map((p) => (
            <Panel as="article" key={p.id} className={cn("flex flex-col", !p.active && "opacity-60")}>
              <header className="flex items-start gap-3 px-5 pb-3 pt-4">
                <div className="min-w-0 flex-1">
                  <p className="eyebrow mb-1 flex items-center gap-2">
                    <span className="font-mono">{p.code}</span> &middot; {KIND[p.kind]}
                  </p>
                  <h2 className="display-sm text-[20px] leading-tight text-ink">{p.name}</h2>
                  <p className="mt-1 text-[13px] text-ink-muted">{p.description || planRule(p)}</p>
                </div>
                {p.label && <span className="rounded-xs border border-line-strong px-1.5 py-0.5 font-mono text-[12px] text-ink">{p.label}</span>}
              </header>
              <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-2 border-t border-dashed border-line px-5 py-3 text-[12.5px]">
                <dt className="text-ink-muted">Price</dt>
                <dd className="text-ink">{planRule(p)}</dd>
                <dt className="text-ink-muted">Cancellation</dt>
                <dd className="text-ink">{p.cancellationPolicy?.nonRefundable ? "Non-refundable" : p.cancellationPolicy ? `Free up to ${p.cancellationPolicy.freeCancellationHours}h` : "The hotel's policy"}</dd>
                <dt className="text-ink-muted">Stay</dt>
                <dd className="text-ink">{p.minNights ? `${p.minNights}+ nights` : "Any length"}{p.maxNights ? `, up to ${p.maxNights}` : ""}</dd>
                <dt className="text-ink-muted">Sold on</dt>
                <dd className="flex flex-wrap gap-1.5 text-ink">
                  {CHANNELS.filter((c) => p.channels.includes(c.value)).map((c) => (
                    <span key={c.value} className="inline-flex items-center gap-1">
                      {c.icon} {c.label}
                    </span>
                  ))}
                </dd>
              </dl>
              {p.pricing === "FIXED" && p.fixedPrices.length > 0 && (
                <ul className="border-t border-line px-5 py-2.5 text-[12.5px]">
                  {p.fixedPrices.map((f) => (
                    <li key={f.roomTypeId} className="flex justify-between py-0.5">
                      <span className="text-ink-muted">{f.roomTypeName}</span>
                      <span className="font-mono text-ink">{naira(f.rateKobo)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <footer className="flex items-center gap-2 border-t border-line bg-surface-2/40 px-5 py-2.5">
                {p.includesBreakfast && (
                  <Badge tone="brass" icon={<Coffee size={12} weight="duotone" />}>
                    Breakfast
                  </Badge>
                )}
                {p.cancellationPolicy?.nonRefundable && (
                  <Badge tone="neutral" icon={<ShieldSlash size={12} />}>
                    No refunds
                  </Badge>
                )}
                {!p.active && <Badge tone="neutral">Paused</Badge>}
                <span className="ml-auto font-mono text-[11.5px] text-ink-faint">{p.reservationsCount} bookings</span>
                {manage && (
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>
                    Edit
                  </Button>
                )}
              </footer>
            </Panel>
          ))}
        </div>
      )}
      <PlanSheet plan={editing} onOpenChange={(o) => !o && setEditing(null)} />
    </>
  );
}

function PlanSheet({ plan, onOpenChange }: { plan: RatePlan | "new" | null; onOpenChange: (o: boolean) => void }) {
  const types = useRoomTypes();
  const qc = useQueryClient();
  const p = plan === "new" ? null : plan;
  const bar = !!p?.isBar;
  const [key, setKey] = useState("");
  const [f, setF] = useState({
    code: "",
    name: "",
    description: "",
    kind: "NON_REFUNDABLE" as RatePlanKind,
    pricing: "DERIVED" as "DERIVED" | "FIXED",
    pct: -10,
    fixed: {} as Record<string, number | null>,
    minNights: 0,
    breakfast: false,
    nonRefundable: true,
    channels: ["FRONT_DESK", "BOOKING_SITE", "MARKETPLACE"] as RateChannel[],
    active: true,
  });
  const k = `${plan === "new" ? "new" : (p?.id ?? "")}`;
  if (plan && k !== key) {
    setKey(k);
    setF(
      p
        ? {
            code: p.code,
            name: p.name,
            description: p.description,
            kind: p.kind,
            pricing: p.pricing,
            pct: p.adjustment?.type === "PERCENT" ? p.adjustment.value / 100 : 0,
            fixed: Object.fromEntries(p.fixedPrices.map((x) => [x.roomTypeId, x.rateKobo])),
            minNights: p.minNights ?? 0,
            breakfast: p.includesBreakfast,
            nonRefundable: !!p.cancellationPolicy?.nonRefundable,
            channels: p.channels,
            active: p.active,
          }
        : { code: "", name: "", description: "", kind: "NON_REFUNDABLE", pricing: "DERIVED", pct: -10, fixed: {}, minNights: 0, breakfast: false, nonRefundable: true, channels: ["FRONT_DESK", "BOOKING_SITE", "MARKETPLACE"], active: true },
    );
  }
  const m = useMutation({
    mutationFn: () => {
      const common = {
        name: f.name.trim(),
        description: f.description.trim(),
        includesBreakfast: f.breakfast,
        channels: f.channels,
        cancellationPolicy: f.nonRefundable ? { nonRefundable: true, freeCancellationHours: 0, lateCancellationFeePct: 100 } : null,
      };
      if (bar) return ratesApi.updatePlan(p!.id, common);
      const body = {
        ...common,
        code: f.code.trim().toUpperCase(),
        kind: f.kind,
        pricing: f.pricing,
        adjustment: f.pricing === "DERIVED" ? { type: "PERCENT" as const, value: Math.round(f.pct * 100) } : null,
        fixedPrices: f.pricing === "FIXED" ? Object.entries(f.fixed).filter(([, v]) => v != null).map(([roomTypeId, rateKobo]) => ({ roomTypeId, rateKobo: rateKobo! })) : undefined,
        minNights: f.minNights || null,
        active: f.active,
      };
      return p ? ratesApi.updatePlan(p.id, body) : ratesApi.createPlan(body);
    },
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: qk4.rates });
      toast.success(`${r.name} saved`);
      onOpenChange(false);
    },
    meta: { errorTitle: "Plan not saved" },
  });
  const valid = f.name.trim().length >= 2 && (bar || /^[A-Z0-9_]{2,12}$/.test(f.code.trim().toUpperCase()));
  return (
    <Sheet
      open={!!plan}
      onOpenChange={onOpenChange}
      eyebrow={bar ? "The best available rate" : p ? `Plan ${p.code}` : "New rate plan"}
      title={p ? p.name : "A new way to sell"}
      width="sm:max-w-[520px]"
      footer={
        <>
          <Button variant="secondary" className="ml-auto" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={m.isPending} onClick={() => m.mutate()}>
            Save plan
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {bar && <p className="rounded-md bg-surface-2/60 px-3 py-2.5 text-[12.5px] text-ink-muted">The best available rate always exists and follows the Rate Almanac. You can rename it and choose where it sells.</p>}
        <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
          <Field label="Code" htmlFor="rp-code">
            <Input id="rp-code" value={f.code} disabled={bar || !!p?.reservationsCount} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") })} className="font-mono" placeholder="NRF" />
          </Field>
          <Field label="Name" htmlFor="rp-name">
            <Input id="rp-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Non-refundable" />
          </Field>
        </div>
        <Field label="What guests read" htmlFor="rp-desc" optional>
          <Textarea id="rp-desc" className="min-h-14" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Pay now and save 10%. No refunds." />
        </Field>
        {!bar && (
          <>
            <ChipRadio label="Kind" value={f.kind} onChange={(v) => setF({ ...f, kind: v })} options={(Object.keys(KIND) as RatePlanKind[]).filter((x) => x !== "BAR").map((x) => ({ value: x, label: KIND[x] }))} />
            <div>
              <Segmented<"DERIVED" | "FIXED">
                label="Pricing"
                size="sm"
                value={f.pricing}
                onChange={(v) => setF({ ...f, pricing: v })}
                options={[
                  { value: "DERIVED", label: "Follow the best rate" },
                  { value: "FIXED", label: "Its own prices" },
                ]}
              />
              {f.pricing === "DERIVED" ? (
                <div className="mt-3 flex items-center gap-3">
                  <Stepper label="percent" value={f.pct} onChange={(v) => setF({ ...f, pct: v })} min={-60} max={60} suffix="%" />
                  <span className="text-[12.5px] text-ink-muted">{f.pct === 0 ? "the same price" : f.pct < 0 ? `${-f.pct}% cheaper than the best rate, every night` : `${f.pct}% dearer, e.g. breakfast for two`}</span>
                </div>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {types.data?.map((t) => (
                    <li key={t.id} className="grid grid-cols-[1fr_180px] items-center gap-3">
                      <span className="text-[13px] text-ink">
                        {t.name} <span className="font-mono text-[11.5px] text-ink-faint">base {naira(t.basePriceKobo)}</span>
                      </span>
                      <NairaInput kobo={f.fixed[t.id] ?? null} onChange={(v) => setF({ ...f, fixed: { ...f.fixed, [t.id]: v } })} aria-label={`${t.name} price`} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <Field label="Minimum stay">
              <Stepper label="nights" value={f.minNights} onChange={(v) => setF({ ...f, minNights: v })} min={0} max={30} suffix={f.minNights ? "nights" : "none"} />
            </Field>
          </>
        )}
        <div className="flex flex-col gap-2">
          <span className="text-[13px] font-medium text-ink">Sold on</span>
          <div className="flex flex-wrap gap-1.5">
            {CHANNELS.map((c) => {
              const on = f.channels.includes(c.value);
              return (
                <button
                  key={c.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setF({ ...f, channels: on ? f.channels.filter((x) => x !== c.value) : [...f.channels, c.value] })}
                  className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px]", on ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}
                >
                  {c.icon} {c.label}
                </button>
              );
            })}
          </div>
        </div>
        <Switch checked={f.breakfast} onChange={(v) => setF({ ...f, breakfast: v })} label="Breakfast included" description="Shown as a badge next to the price." />
        <Switch checked={f.nonRefundable} onChange={(v) => setF({ ...f, nonRefundable: v })} label="Non-refundable" description="Guests pay in full and get nothing back if they cancel. Pay at the hotel is not offered." />
        {!bar && <Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="On sale" />}
      </div>
    </Sheet>
  );
}
