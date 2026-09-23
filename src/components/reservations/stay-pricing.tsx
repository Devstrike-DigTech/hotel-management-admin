"use client";

import { useEffect, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Briefcase, CheckCircle, Coffee, Ticket, Warning, X } from "@phosphor-icons/react";
import { ratesApi } from "@/lib/api/endpoints-m4";
import { useCorporateAccounts } from "@/lib/api/hooks-m4";
import type { StayQuote } from "@/lib/api/types-m4";
import { useEntitlements } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import { formatDay, prettyDates } from "@/lib/dates";
import { naira } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/primitives";

export interface PricingChoice {
  ratePlanId: string | null;
  promoCode: string | null;
  corporateAccountId: string | null;
}

/**
 * Rate plan, corporate account and promo code for a desk booking, with the
 * price the server resolves night by night (POST /rates/quote).
 */
export function StayPricing({
  roomTypeId,
  arrival,
  departure,
  adults,
  kids: children,
  phone,
  value,
  onChange,
  onQuote,
}: {
  roomTypeId: string;
  arrival: string;
  departure: string;
  adults: number;
  kids: number;
  phone?: string | null;
  value: PricingChoice;
  onChange: (v: PricingChoice) => void;
  onQuote: (q: StayQuote | null) => void;
}) {
  const { has } = useEntitlements();
  const { can } = useCan();
  const promos = has("promotions");
  const accounts = useCorporateAccounts({ active: true }, promos && can("corporate.view"));
  const [code, setCode] = useState(value.promoCode ?? "");
  const q = useQuery({
    queryKey: ["rates", "quote", roomTypeId, arrival, departure, adults, children, value.ratePlanId, value.promoCode, value.corporateAccountId, phone ?? ""],
    queryFn: () =>
      ratesApi.quote({
        roomTypeId,
        arrivalDate: arrival,
        departureDate: departure,
        adults,
        children,
        ratePlanId: value.ratePlanId ?? undefined,
        promoCode: value.promoCode ?? undefined,
        corporateAccountId: value.corporateAccountId ?? undefined,
        channel: "FRONT_DESK",
        guestPhone: phone ?? undefined,
      }),
    enabled: !!roomTypeId && departure > arrival,
    placeholderData: keepPreviousData,
    staleTime: 20_000,
  });
  const quote = q.data ?? null;
  useEffect(() => onQuote(quote), [quote, onQuote]);

  if (!quote && q.isLoading) return <Skeleton className="h-40" />;
  if (!quote) return q.isError ? <p className="text-[12.5px] text-ink-muted">Prices couldn&rsquo;t be worked out for these dates. The booking uses the standard rate.</p> : null;
  const nights = quote.nights;
  const maxRate = Math.max(...nights.map((n) => n.rateKobo));
  const b = quote.breakdown;

  return (
    <div className={cn("flex flex-col gap-4 transition-opacity", q.isFetching && "opacity-70")}>
      {promos && (
        <>
          {accounts.data && accounts.data.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                <Briefcase size={14} weight="duotone" className="text-ink-muted" /> Company account
              </span>
              <select
                aria-label="Company account"
                value={value.corporateAccountId ?? ""}
                onChange={(e) => onChange({ ...value, corporateAccountId: e.target.value || null, ratePlanId: null })}
                className="h-10 rounded-md border border-line-strong bg-surface px-3 text-[14px] text-ink outline-none focus:border-laterite"
              >
                <option value="">None, the guest pays</option>
                {accounts.data.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                    {a.ratePlan ? ` · ${a.ratePlan.name} rate` : ""}
                    {a.availableCreditKobo < 0 ? " · over limit" : ""}
                  </option>
                ))}
              </select>
              {quote.corporateAccount && (
                <span className="text-[12px] text-ink-muted">
                  Checks out to the City Ledger if you choose, inside {naira(accounts.data.find((a) => a.id === quote.corporateAccount!.id)?.availableCreditKobo ?? 0)} of credit left.
                </span>
              )}
            </label>
          )}
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink">Rate plan</span>
            <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Rate plan">
              {quote.eligiblePlans.map((p) => {
                const on = p.id === quote.ratePlan.id;
                return (
                  <button
                    key={p.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    disabled={!p.available}
                    title={p.reason ?? undefined}
                    onClick={() => onChange({ ...value, ratePlanId: p.id })}
                    className={cn(
                      "flex flex-col items-start rounded-md border px-3 py-1.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-45",
                      on ? "border-laterite bg-laterite-wash/50 shadow-[inset_3px_0_0_var(--laterite)]" : "border-line-strong hover:border-ink-faint",
                    )}
                  >
                    <span className="text-[12.5px] font-medium text-ink">{p.name}</span>
                    <span className="font-mono text-[11px] text-ink-muted">{p.available ? (p.totalKobo != null ? naira(p.totalKobo) : "") : p.reason}</span>
                  </button>
                );
              })}
            </div>
            {quote.ratePlan.includesBreakfast && (
              <span className="inline-flex items-center gap-1 text-[12px] text-brass">
                <Coffee size={13} weight="duotone" /> Breakfast included
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
              <Ticket size={14} weight="duotone" className="text-ink-muted" /> Promo code
            </span>
            {value.promoCode && quote.promo ? (
              <span className="inline-flex w-fit items-center gap-2 rounded-md border border-[color-mix(in_oklab,var(--palm)_40%,transparent)] bg-palm-wash/60 py-1.5 pl-3 pr-1.5 text-[13px] text-ink">
                <CheckCircle size={15} weight="fill" className="text-palm" />
                <span className="font-mono">{quote.promo.code}</span> {naira(quote.promo.discountKobo)} off
                <button
                  type="button"
                  aria-label="Remove promo code"
                  onClick={() => {
                    setCode("");
                    onChange({ ...value, promoCode: null });
                  }}
                  className="grid h-6 w-6 place-items-center rounded-sm text-ink-muted hover:bg-surface"
                >
                  <X size={12} />
                </button>
              </span>
            ) : (
              <div className="flex gap-2">
                <input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      if (code) onChange({ ...value, promoCode: code });
                    }
                  }}
                  placeholder="WELCOME10"
                  aria-label="Promo code"
                  aria-invalid={!!quote.promoError}
                  className="h-10 w-44 rounded-md border border-line-strong bg-surface px-3 font-mono text-[14px] uppercase tracking-wide text-ink outline-none focus:border-laterite aria-[invalid=true]:border-danger"
                />
                <Button type="button" variant="secondary" disabled={!code} onClick={() => onChange({ ...value, promoCode: code })}>
                  Apply
                </Button>
              </div>
            )}
            {quote.promoError && value.promoCode && (
              <span role="alert" className="text-[12.5px] text-danger">
                {quote.promoError.message}
              </span>
            )}
          </div>
        </>
      )}

      {/* night by night */}
      <div className="rounded-md border border-line bg-surface">
        <ul className="divide-y divide-dashed divide-line">
          {nights.map((n) => (
            <li key={n.date} className="grid grid-cols-[92px_1fr_auto] items-center gap-3 px-3 py-1.5 text-[12.5px]">
              <span className="text-ink-muted">{formatDay(n.date)}</span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-1.5 rounded-full bg-ink/15" style={{ width: `${Math.max(8, (n.rateKobo / maxRate) * 100)}%` }} aria-hidden />
                {n.ruleName && <span className="shrink-0 truncate text-[11px] text-ink-muted">{n.ruleName}</span>}
              </span>
              <span className="text-right font-mono text-ink">
                {n.discountKobo > 0 && <span className="mr-2 text-[11px] text-palm">−{naira(n.discountKobo)}</span>}
                {naira(n.rateKobo)}
              </span>
            </li>
          ))}
        </ul>
        <dl className="border-t border-line px-3 py-2 text-[12.5px]">
          <div className="flex justify-between py-0.5">
            <dt className="text-ink-muted">
              {nights.length} {nights.length === 1 ? "night" : "nights"}, {quote.ratePlan.name}
            </dt>
            <dd className="font-mono text-ink">{naira(quote.roomTotalKobo)}</dd>
          </div>
          {b.discountKobo > 0 && (
            <div className="flex justify-between py-0.5 text-palm">
              <dt>Promo {quote.promo?.code}</dt>
              <dd className="font-mono">−{naira(b.discountKobo)}</dd>
            </div>
          )}
          {b.taxes?.map((t) => (
            <div key={t.code} className="flex justify-between py-0.5">
              <dt className="text-ink-muted">{t.label}</dt>
              <dd className="font-mono text-ink-muted">{naira(t.amountKobo)}</dd>
            </div>
          ))}
          <div className="mt-1 flex justify-between border-t border-line pt-1.5 text-[13.5px]">
            <dt className="font-medium text-ink">Guest pays</dt>
            <dd className="font-mono font-medium text-ink">{naira(b.totalKobo)}</dd>
          </div>
        </dl>
      </div>
      {quote.warnings.map((w) => (
        <p key={w.reason + w.date} className="flex items-start gap-2 text-[12.5px] text-ochre">
          <Warning size={14} weight="fill" className="mt-0.5 shrink-0" />
          <span>
            {prettyDates(w.message)} <span className="text-ink-muted">Online channels refuse this; the desk can still book it.</span>
          </span>
        </p>
      ))}
    </div>
  );
}
