"use client";

import * as D from "@radix-ui/react-dialog";
import { ArrowRight, Check, LockKey, LockSimpleOpen, Prohibit, X } from "@phosphor-icons/react";
import { useRouter } from "next/navigation";
import { usePublicFeatures, usePublicPlans } from "@/lib/api/hooks";
import { FALLBACK_FEATURES, LIMIT_LABEL, PLAN_NAMES, featureName, minimumPlanFor } from "@/lib/catalog";
import { naira } from "@/lib/format";
import { closeUpgrade, upgradeStore, useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { PlanPlate } from "@/components/ui/primitives";
import { AdireField } from "@/components/motifs/adire";

export function UpgradeDialog() {
  const prompt = useStore(upgradeStore);
  const router = useRouter();
  const open = !!prompt;
  const plans = usePublicPlans(open);
  const features = usePublicFeatures(open);

  let eyebrow = "";
  let title: React.ReactNode = "";
  let body: React.ReactNode = "";
  let planCode = "growth";
  let icon = <LockKey size={20} weight="duotone" />;

  if (prompt?.kind === "feature") {
    const req = prompt.requiredPlan ?? minimumPlanFor(prompt.feature, plans.data).code;
    planCode = req;
    const name = featureName(prompt.feature, features.data);
    const desc =
      features.data?.find((f) => f.code === prompt.feature)?.description ??
      FALLBACK_FEATURES.find((f) => f.code === prompt.feature)?.description;
    eyebrow = "Not on your plan yet";
    title = (
      <>
        {name} lives on <em>{planName(req, plans.data)}</em>
      </>
    );
    body = desc ?? prompt.message;
  } else if (prompt?.kind === "limit") {
    planCode = prompt.upgradePlan ?? "growth";
    const l = LIMIT_LABEL[prompt.limit] ?? { label: prompt.limit, noun: "item" };
    const target = plans.data?.find((p) => p.code === planCode);
    const next = target?.limits?.[prompt.limit];
    eyebrow = "Limit reached";
    title = (
      <>
        You&rsquo;ve used every {l.noun} <em>on this plan</em>
      </>
    );
    body = (
      <>
        {prompt.max !== undefined && (
          <>
            Your plan includes <span className="font-mono text-ink">{prompt.max}</span> {l.label.toLowerCase()}.{" "}
          </>
        )}
        {next !== undefined && (
          <>
            {planName(planCode, plans.data)} raises that to{" "}
            <span className="font-mono text-ink">{next < 0 ? "unlimited" : next}</span>.
          </>
        )}
      </>
    );
    icon = <Prohibit size={20} weight="duotone" />;
  } else if (prompt?.kind === "readonly") {
    eyebrow = "Account is read-only";
    title = (
      <>
        Your records are safe, <em>editing is paused</em>
      </>
    );
    body =
      "Your subscription has lapsed, so changes are switched off until it is renewed. Guests can still book through your public pages.";
    icon = <LockSimpleOpen size={20} weight="duotone" />;
  }

  const plan = plans.data?.find((p) => p.code === planCode);
  const currentHighlights = plan
    ? plan.features
        .filter((f) => {
          const idx = plans.data!.findIndex((p) => p.code === planCode);
          const prev = idx > 0 ? plans.data![idx - 1] : null;
          return !prev?.features.includes(f);
        })
        .slice(0, 5)
    : [];

  const go = () => {
    closeUpgrade();
    router.push(prompt?.kind === "readonly" ? "/billing" : `/billing?plan=${planCode}#plans`);
  };

  return (
    <D.Root open={open} onOpenChange={(o) => !o && closeUpgrade()}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[80] bg-[color-mix(in_oklab,var(--ink)_30%,transparent)] data-[state=open]:animate-[fade_180ms_ease-out] dark:bg-[rgb(0_0_0/0.62)]" />
        <D.Content className="fixed left-1/2 top-1/2 z-[80] grid w-[calc(100vw-24px)] max-w-[640px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-lg border border-line bg-surface shadow-float outline-none data-[state=open]:animate-[dialog-in_240ms_cubic-bezier(0.22,1,0.36,1)] sm:grid-cols-[200px_1fr]">
          {/* indigo cloth panel */}
          <div className="relative hidden overflow-hidden bg-[#22324f] text-[#e9dfcc] sm:block dark:bg-[#172238]">
            <AdireField cols={5} rows={10} className="absolute inset-0 h-full w-full opacity-40" strokeWidth={1} />
            <div className="relative flex h-full flex-col justify-end p-5">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-[#e9dfcc]/40 bg-[#22324f]">
                {icon}
              </span>
              {plan && (
                <div className="mt-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[#e9dfcc]/70">From</p>
                  <p className="font-mono text-[22px] leading-tight">
                    {naira(plan.priceMonthlyKobo)}
                    <span className="text-[12px] text-[#e9dfcc]/70">/mo</span>
                  </p>
                </div>
              )}
            </div>
          </div>
          <div className="relative flex flex-col p-6">
            <D.Close asChild>
              <button
                aria-label="Close"
                className="absolute right-3 top-3 grid h-7 w-7 place-items-center rounded-sm text-ink-muted hover:bg-surface-2 hover:text-ink"
              >
                <X size={15} />
              </button>
            </D.Close>
            <p className="eyebrow mb-2 text-laterite">{eyebrow}</p>
            <D.Title className="display pr-6 text-[27px] leading-[1.08] text-ink">{title}</D.Title>
            <D.Description asChild>
              <div className="mt-3 text-[14px] leading-relaxed text-ink-muted">{body}</div>
            </D.Description>

            {prompt?.kind !== "readonly" && plan && (
              <div className="mt-5 rounded-md border border-line bg-paper/60 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <PlanPlate name={plan.name} code={plan.code} />
                  <span className="text-[12px] text-ink-muted">{plan.tagline}</span>
                </div>
                <ul className="grid gap-1.5">
                  {currentHighlights.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-[13px] text-ink">
                      <Check size={13} weight="bold" className="text-palm" />
                      {featureName(f, features.data)}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="ghost" onClick={closeUpgrade}>
                Not now
              </Button>
              <Button onClick={go}>
                {prompt?.kind === "readonly" ? "Renew subscription" : `See ${planName(planCode, plans.data)}`}
                <ArrowRight size={15} weight="bold" />
              </Button>
            </div>
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

function planName(code: string, plans?: { code: string; name: string }[]) {
  return plans?.find((p) => p.code === code)?.name ?? PLAN_NAMES[code] ?? code;
}
