"use client";

import { ArrowRight, Check, EnvelopeSimple, LockKey, type Icon } from "@phosphor-icons/react";
import { useEntitlements } from "@/lib/auth";
import { config } from "@/lib/config";
import { naira } from "@/lib/format";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, PlanPlate, Skeleton } from "@/components/ui/primitives";

export interface FeaturePageProps {
  feature: string;
  icon: Icon;
  name: string;
  title: React.ReactNode;
  pitch: string;
  bullets: string[];
  preview: React.ReactNode;
  /** Rendered when the tenant is entitled. */
  children?: React.ReactNode;
}

/**
 * A gated section of the product. Entitled tenants see `children`; everyone
 * else sees a quiet preview of what the feature does and the plan that has it.
 */
export function FeaturePage({ feature, icon: I, name, title, pitch, bullets, preview, children }: FeaturePageProps) {
  const { has, loading, requiredPlan, plans } = useEntitlements();
  if (loading)
    return (
      <>
        <PageHeader eyebrow={name} title={<Skeleton className="h-11 w-80" />} />
        <Skeleton className="h-80 w-full rounded-lg" />
      </>
    );

  if (has(feature))
    return (
      <>
        {children ?? (
          <>
            <PageHeader
              eyebrow={
                <>
                  <I size={14} weight="duotone" /> {name}
                </>
              }
              title={title}
              description={pitch}
            />
            <Panel>
              <EmptyState
                glyph="arcs"
                title={`${name} is switched on`}
                body="Your plan includes this. The full workspace opens in the next release; we'll let you know the moment it's live."
              />
            </Panel>
          </>
        )}
      </>
    );

  const plan = requiredPlan(feature);
  const p = plans?.find((x) => x.code === plan.code);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <LockKey size={14} weight="duotone" className="text-brass" /> {name}
            <span className="text-ink-faint">&middot; on {plan.name}</span>
          </>
        }
        title={title}
        description={pitch}
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel className="relative self-start overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <span className="eyebrow">Preview</span>
            <span className="text-[12px] text-ink-faint">Sample data</span>
          </div>
          <div className="relative p-5 sm:p-6" aria-hidden>
            <div className="pointer-events-none select-none">{preview}</div>
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-surface to-transparent" />
          </div>
        </Panel>

        <Panel as="aside" className="flex flex-col self-start">
          <div className="border-b border-line p-5">
            <div className="flex items-center gap-2">
              <PlanPlate name={plan.name} code={plan.code} />
              {p?.priceMonthlyKobo != null && (
                <span className="text-[12.5px] text-ink-muted">
                  from <span className="font-mono text-ink">{naira(p.priceMonthlyKobo)}</span>/mo
                </span>
              )}
            </div>
            <h2 className="display-sm mt-3 text-[20px] leading-snug text-ink">What {name.toLowerCase()} does for you</h2>
          </div>
          <ul className="flex flex-col gap-3 p-5">
            {bullets.map((b) => (
              <li key={b} className="flex gap-2.5 text-[13.5px] leading-snug text-ink">
                <Check size={15} weight="bold" className="mt-0.5 shrink-0 text-palm" />
                {b}
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-col gap-2 border-t border-line p-5">
            <ButtonLink href={`/billing?plan=${plan.code}#plans`} className="w-full">
              Upgrade to {plan.name} <ArrowRight size={15} weight="bold" />
            </ButtonLink>
            <a
              href={`mailto:${config.supportEmail}?subject=${encodeURIComponent(`Question about ${name}`)}`}
              className="inline-flex h-9 items-center justify-center gap-2 text-[13px] text-ink-muted hover:text-ink"
            >
              <EnvelopeSimple size={15} /> Ask us about it first
            </a>
          </div>
        </Panel>
      </div>
    </>
  );
}
