"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, EyeSlash, Hourglass, ListBullets, MapPin, Plus, Prohibit, Storefront } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { conciergeApi } from "@/lib/api/endpoints-m8";
import { qk8, useConciergeAccess, useConciergeServices } from "@/lib/api/hooks-m8";
import type { ConciergeService, ServiceCategory } from "@/lib/api/types-m8";
import { toast } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, Skeleton, Tip } from "@/components/ui/primitives";
import { CATEGORIES, LOCATIONS, REVIEW, categoryMeta } from "./catalog";
import { CategoryGlyph, SealGlyph } from "./bits";
import { ConciergeTabs } from "./tabs";
import { ServiceEditor } from "./service-editor";
import { AupAcceptedLine } from "./aup";
import { Highlight } from "./highlight";

type Filter = ServiceCategory | "ALL" | "REVIEW";

export function ServicesView() {
  const access = useConciergeAccess();
  const q = useConciergeServices();
  const qc = useQueryClient();
  const params = useSearchParams();
  const router = useRouter();
  const [cat, setCat] = useState<Filter>("ALL");
  const [editing, setEditing] = useState<ConciergeService | "new" | null>(null);
  const list = useMemo(() => q.data ?? [], [q.data]);
  const notLive = list.filter((s) => s.reviewStatus !== "LIVE");
  const shown = list.filter((s) => (cat === "ALL" ? true : cat === "REVIEW" ? s.reviewStatus !== "LIVE" : s.category === cat)).sort((a, b) => Number(a.reviewStatus === "LIVE") - Number(b.reviewStatus === "LIVE"));
  const counts = useMemo(() => {
    const m = new Map<ServiceCategory, number>();
    for (const s of list) m.set(s.category, (m.get(s.category) ?? 0) + 1);
    return m;
  }, [list]);

  useEffect(() => {
    if (params.get("new") === "1" && access.catalogue) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the palette opens the editor with ?new=1
      setEditing("new");
      router.replace("/concierge/services");
    }
  }, [params, access.catalogue, router]);

  const toggle = useMutation({
    mutationFn: (v: { s: ConciergeService; active: boolean }) => conciergeApi.updateService(v.s.id, { active: v.active }),
    onSuccess: async (s) => {
      await qc.invalidateQueries({ queryKey: qk8.services });
      toast.success(s.active ? "Offered to guests" : "Switched off", s.name);
    },
    meta: { errorTitle: "Not changed" },
  });

  const chips: { value: Filter; label: string; n: number }[] = [
    { value: "ALL", label: "All", n: list.length },
    ...(notLive.length ? [{ value: "REVIEW" as const, label: "Not live", n: notLive.length }] : []),
    ...CATEGORIES.filter((c) => counts.get(c.value)).map((c) => ({ value: c.value as Filter, label: c.label, n: counts.get(c.value)! })),
  ];

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <ListBullets size={14} weight="duotone" /> Concierge
          </>
        }
        title={
          <>
            Your <em>menu of services</em>.
          </>
        }
        description="What guests can ask for, what it costs and who does it. Each service can ask its own few questions."
        actions={
          access.catalogue ? (
            <Button onClick={() => setEditing("new")} data-testid="add-service">
              <Plus size={15} weight="bold" /> Add a service
            </Button>
          ) : undefined
        }
      />
      <ConciergeTabs />

      {notLive.length > 0 && (
        <Panel className="mb-5 overflow-hidden border-[color-mix(in_oklab,var(--ochre)_40%,transparent)]" data-testid="review-explainer">
          <div className="flex items-start gap-3 bg-ochre-wash/50 px-5 py-4">
            <Hourglass size={20} weight="duotone" className="mt-0.5 shrink-0 text-ochre" />
            <div className="text-[13.5px] leading-snug text-ink">
              <p className="font-medium">{notLive.length === 1 ? "One service isn't" : `${notLive.length} services aren't`} shown to guests.</p>
              <p className="mt-0.5 max-w-3xl text-ink-muted">
                When a name, description or question may fall outside the acceptable-use policy, the service waits for our trust team, usually within a working day, and stays hidden from guests until then. The words that were caught are marked. Change them and save to be checked again, or wait for a decision.
              </p>
            </div>
          </div>
        </Panel>
      )}

      <div className="scrollbar-thin -mx-4 mb-5 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Category">
        {chips.map((c) => (
          <button
            key={c.value}
            role="tab"
            aria-selected={cat === c.value}
            onClick={() => setCat(c.value)}
            className={cn(
              "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12.5px]",
              cat === c.value ? "border-ink bg-ink text-paper" : c.value === "REVIEW" ? "border-[color-mix(in_oklab,var(--ochre)_50%,transparent)] text-ochre" : "border-line-strong text-ink-muted hover:text-ink",
            )}
          >
            {c.label} <span className="font-mono text-[11px] opacity-70">{c.n}</span>
          </button>
        ))}
      </div>

      {q.isError ? (
        <Panel>
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </Panel>
      ) : !q.data ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      ) : !list.length ? (
        <Panel>
          <EmptyState glyph="arcs" title="No services yet" body="Start with two or three things guests ask for most: a massage, a car with a driver, a table at a good restaurant." action={access.catalogue ? <Button onClick={() => setEditing("new")}>Add a service</Button> : undefined} />
        </Panel>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" data-testid="service-list">
          {shown.map((s) => (
            <li key={s.id}>
              <ServiceCard s={s} manage={access.catalogue} onOpen={() => setEditing(s)} onToggle={(v) => toggle.mutate({ s, active: v })} />
            </li>
          ))}
        </ul>
      )}
      <div className="mt-6">
        <AupAcceptedLine />
      </div>
      {editing && <ServiceEditor key={editing === "new" ? "new" : editing.id} service={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

export function ServiceCard({ s, manage, onOpen, onToggle }: { s: ConciergeService; manage: boolean; onOpen: () => void; onToggle: (v: boolean) => void }) {
  const review = REVIEW[s.reviewStatus];
  const live = s.reviewStatus === "LIVE";
  const terms = live ? [] : s.review.flaggedTerms;
  const meta = [s.durationMinutes ? `${s.durationMinutes} min` : null, s.leadTimeHours ? `${s.leadTimeHours} h notice` : null, LOCATIONS.find((l) => l.value === s.location)?.label].filter(Boolean);
  return (
    <article
      className={cn("relative flex h-full flex-col rounded-lg border bg-surface transition-colors", !live ? "border-[color-mix(in_oklab,var(--ochre)_50%,transparent)]" : s.active ? "border-line hover:border-line-strong" : "border-dashed border-line-strong bg-surface-2/40")}
      data-service={s.name}
      data-review={s.reviewStatus}
      data-testid="service-card"
    >
      <button type="button" onClick={onOpen} className="flex flex-1 flex-col gap-2 p-4 pr-16 text-left" aria-label={`Open ${s.name}`}>
        <span className="flex items-center gap-1.5 text-[11.5px] text-ink-muted">
          <CategoryGlyph category={s.category} size={14} /> {categoryMeta(s.category).label}
          {s.discreetEligible && (
            <Tip content="Guests may ask for it privately">
              <span className="ml-1 inline-flex text-brass">
                <SealGlyph size={13} />
              </span>
            </Tip>
          )}
        </span>
        <span className={cn("text-[15px] font-medium leading-snug", s.active && live ? "text-ink" : "text-ink-muted")}>
          <Highlight text={s.name} terms={terms} />
        </span>
        {s.description && (
          <span className="line-clamp-3 text-[12.5px] leading-snug text-ink-muted">
            <Highlight text={s.description} terms={terms} />
          </span>
        )}
        <span className="mt-auto pt-2 font-mono text-[18px] leading-none text-ink">{s.priceLabel}</span>
        {s.variants.length > 0 && <span className="text-[11.5px] text-ink-faint">{s.variants.map((v) => v.name).join(" · ")}</span>}
      </button>
      <div className="absolute right-3 top-3">
        <Switch checked={s.active} disabled={!manage} onChange={onToggle} ariaLabel={`${s.name} offered`} />
      </div>
      {!live && (
        <div className="flex items-start gap-2 border-t border-[color-mix(in_oklab,var(--ochre)_35%,transparent)] bg-ochre-wash/45 px-4 py-2.5 text-[12px] leading-snug text-ink" data-testid="service-review-state">
          {s.reviewStatus === "PENDING_REVIEW" ? <Hourglass size={14} weight="duotone" className="mt-px shrink-0 text-ochre" /> : <Prohibit size={14} className="mt-px shrink-0 text-danger" />}
          <span>
            <Badge tone={review.tone} className="mr-1.5 h-[18px] text-[10.5px]">
              {review.label}
            </Badge>
            {review.guest}.{s.review.reason ? <span className="text-ink-muted"> &ldquo;{s.review.reason}&rdquo;</span> : null}
          </span>
        </div>
      )}
      {live && s.active && !s.guestVisible && (
        <div className="flex items-center gap-2 border-t border-line px-4 py-2 text-[11.5px] text-ink-muted">
          <EyeSlash size={13} /> Not shown to guests while concierge is switched off.
        </div>
      )}
      <footer className="flex items-center gap-2 border-t border-dashed border-line px-4 py-2 text-[11.5px] text-ink-muted">
        {s.fulfilledBy === "VENDOR" ? <Storefront size={13} className="shrink-0" /> : s.location === "OFF_PROPERTY" ? <MapPin size={13} className="shrink-0" /> : <Clock size={13} className="shrink-0" />}
        <span className="min-w-0 flex-1 truncate">
          {s.fulfilledBy === "VENDOR" && s.vendor ? `${s.vendor.name} · ` : ""}
          {meta.join(" · ")}
        </span>
        {s.questions.length > 0 && (
          <span>
            {s.questions.length} {s.questions.length === 1 ? "question" : "questions"}
          </span>
        )}
        <Tip content="Requests in the last 30 days">
          <span className="font-mono text-ink">{s.requestsLast30Days}</span>
        </Tip>
      </footer>
    </article>
  );
}
