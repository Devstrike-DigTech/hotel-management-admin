"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import * as Popover from "@radix-ui/react-popover";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChartLineUp, Check, X } from "@phosphor-icons/react";
import { pricingApi } from "@/lib/api/endpoints-m5";
import { qk5, usePricingSettings, useSuggestions } from "@/lib/api/hooks-m5";
import { qk4 } from "@/lib/api/hooks-m4";
import type { PricingFactor, Suggestion } from "@/lib/api/types-m5";
import { formatDay, type DayKey } from "@/lib/dates";
import { naira, percent } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { NairaInput } from "@/components/m2/bits";
import type { Ghost } from "@/components/rates/almanac";

export const FACTOR_LABEL: Record<PricingFactor["code"], string> = {
  OCCUPANCY: "Occupancy",
  PACE: "Booking pace",
  LEAD_TIME: "Days to arrival",
  DAY_OF_WEEK: "Day of the week",
  EVENT: "Event",
  COMPETITOR: "Competitors",
  GUARDRAIL: "Guardrail",
};

const bps = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v / 100).toFixed(v % 100 ? 1 : 0)}%`;

/** Suggestions for the Almanac window, keyed by room type and night. */
export function useAlmanacSuggestions(from: string, to: string, enabled: boolean) {
  const q = useSuggestions({ from, to, status: "PENDING" }, enabled);
  const settings = usePricingSettings(enabled);
  const map = useMemo(() => {
    const m = new Map<string, Suggestion>();
    for (const s of q.data ?? []) m.set(`${s.roomType.id}|${s.date}`, s);
    return m;
  }, [q.data]);
  return { list: q.data ?? [], map, settings: settings.data, loading: q.isLoading };
}

export function ghostOf(s: Suggestion | undefined): Ghost | null {
  if (!s) return null;
  return { id: s.id, suggestedKobo: s.suggestedKobo, currentKobo: s.currentKobo, reason: s.reason, status: s.status === "PENDING" ? "PENDING" : "ACCEPTED", clamped: s.factors.some((f) => f.code === "GUARDRAIL") ? "guardrail" : null };
}

export function usePricingRefresh() {
  const qc = useQueryClient();
  return () => Promise.all([qc.invalidateQueries({ queryKey: qk5.pricing }), qc.invalidateQueries({ queryKey: qk4.rates }), qc.invalidateQueries({ queryKey: ["availability"] })]);
}

/** The card that opens from a ghost price: why, how sure, and accept (as is or edited) or reject. */
export function SuggestionPopover({ s, anchor, onClose, canManage }: { s: Suggestion | null; anchor: HTMLElement | null; onClose: () => void; canManage: boolean }) {
  const refresh = usePricingRefresh();
  const [edit, setEdit] = useState<number | null>(null);
  const vref = useRef<{ getBoundingClientRect: () => DOMRect }>({ getBoundingClientRect: () => new DOMRect() });
  useEffect(() => {
    if (anchor) vref.current = { getBoundingClientRect: () => anchor.getBoundingClientRect() };
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new suggestion starts unedited
    setEdit(null);
  }, [anchor, s?.id]);
  const accept = useMutation({
    mutationFn: () => pricingApi.accept(s!.id, edit ?? undefined),
    onSuccess: async (r) => {
      await refresh();
      toast.success(`${r.suggestion.roomType.name}: ${naira(r.change.toKobo)} on ${formatDay(r.change.date, { day: "numeric", month: "short" })}`, "The price is live on the desk, the booking site and the channels.");
      onClose();
    },
    meta: { errorTitle: "Not applied" },
  });
  const reject = useMutation({
    mutationFn: () => pricingApi.reject(s!.id),
    onSuccess: async () => {
      await refresh();
      onClose();
    },
    meta: { errorTitle: "Not rejected" },
  });
  if (!s) return null;
  const up = s.suggestedKobo > s.currentKobo;
  const maxAbs = Math.max(1, ...s.factors.map((f) => Math.abs(f.effectBps)));
  return (
    <Popover.Root open={!!s && !!anchor} onOpenChange={(o) => !o && onClose()}>
      <Popover.Anchor virtualRef={vref} />
      <Popover.Portal>
        <Popover.Content side="bottom" align="center" sideOffset={8} collisionPadding={12} className="z-50 w-[340px] rounded-lg border border-line bg-surface shadow-float outline-none animate-[rise_160ms_ease-out]" data-testid="suggestion-card">
          <div className="border-b border-line px-4 pb-3 pt-3.5">
            <p className="eyebrow text-[10px]">
              {s.roomType.name} &middot; {formatDay(s.date, { weekday: "short", day: "numeric", month: "short" })}
            </p>
            <div className="mt-2 flex items-baseline gap-2.5">
              <span className="font-mono text-[15px] text-ink-muted line-through">{naira(s.currentKobo)}</span>
              <ArrowRight size={13} className="text-ink-faint" />
              <span className={cn("font-mono text-[24px] tracking-tight", up ? "text-palm" : "text-ochre")}>{naira(s.suggestedKobo)}</span>
              <span className={cn("ml-auto inline-flex items-center gap-0.5 font-mono text-[12px]", up ? "text-palm" : "text-ochre")}>
                {up ? <ArrowUpRight size={12} weight="bold" /> : <ArrowDownRight size={12} weight="bold" />}
                {bps(s.changeBps)}
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-snug text-ink">{s.reason}</p>
          </div>
          <ul className="flex flex-col gap-1.5 px-4 py-3">
            {s.factors.map((f) => (
              <li key={f.code + f.label} className="grid grid-cols-[1fr_80px_48px] items-center gap-2 text-[12px]">
                <span className="truncate text-ink-muted" title={f.label}>
                  {f.label}
                </span>
                <span className="relative h-2 rounded-full bg-line" aria-hidden>
                  <span className={cn("absolute inset-y-0 rounded-full", f.effectBps >= 0 ? "left-1/2 bg-palm" : "right-1/2 bg-ochre")} style={{ width: `${(Math.abs(f.effectBps) / maxAbs) * 50}%` }} />
                  <span className="absolute inset-y-[-2px] left-1/2 w-px bg-line-strong" />
                </span>
                <span className={cn("text-right font-mono", f.effectBps >= 0 ? "text-palm" : "text-ochre")}>{bps(f.effectBps)}</span>
              </li>
            ))}
          </ul>
          <dl className="grid grid-cols-3 gap-px border-y border-line bg-line text-[11.5px]">
            <div className="bg-surface px-3 py-2">
              <dt className="text-ink-muted">On the books</dt>
              <dd className="font-mono text-ink">{percent(s.occupancy.onTheBooks)}</dd>
            </div>
            <div className="bg-surface px-3 py-2">
              <dt className="text-ink-muted">Forecast</dt>
              <dd className="font-mono text-ink">{percent(s.occupancy.forecast)}</dd>
            </div>
            <div className="bg-surface px-3 py-2">
              <dt className="text-ink-muted">Confidence</dt>
              <dd className={cn("font-mono", s.confidence === "HIGH" ? "text-palm" : s.confidence === "LOW" ? "text-ochre" : "text-ink")}>{s.confidence.toLowerCase()}</dd>
            </div>
          </dl>
          {canManage ? (
            <div className="flex flex-col gap-2 p-3">
              {edit !== null && <NairaInput kobo={edit} onChange={(v) => setEdit(v ?? 0)} aria-label="Price for this night" autoFocus />}
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => reject.mutate()} loading={reject.isPending} data-testid="suggestion-reject">
                  <X size={13} weight="bold" /> Keep {naira(s.currentKobo)}
                </Button>
                {edit === null && (
                  <Button size="sm" variant="ghost" onClick={() => setEdit(s.suggestedKobo)}>
                    Edit
                  </Button>
                )}
                <Button size="sm" className="ml-auto" onClick={() => accept.mutate()} loading={accept.isPending} data-testid="suggestion-accept">
                  <Check size={13} weight="bold" /> Use {naira(edit ?? s.suggestedKobo)}
                </Button>
              </div>
            </div>
          ) : (
            <p className="px-4 py-3 text-[12px] text-ink-muted">A manager with pricing rights accepts or rejects suggestions.</p>
          )}
          <Popover.Arrow className="fill-surface" width={12} height={6} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** The strip above the Almanac: show or hide ghosts, the mode, and bulk decisions. */
export function SuggestionsStrip({
  show,
  onShow,
  inView,
  inSelection,
  mode,
  canManage,
}: {
  show: boolean;
  onShow: (v: boolean) => void;
  inView: Suggestion[];
  inSelection: Suggestion[];
  mode?: string;
  canManage: boolean;
}) {
  const refresh = usePricingRefresh();
  const bulk = useMutation({
    mutationFn: ({ ids, action }: { ids: string[]; action: "ACCEPT" | "REJECT" }) => pricingApi.bulk(ids, action),
    onSuccess: async (r) => {
      await refresh();
      if (r.accepted) toast.success(`${r.accepted} ${r.accepted === 1 ? "price" : "prices"} applied`, r.failed.length ? `${r.failed.length} could not be applied.` : "Live on every channel.");
      else toast.info(`${r.rejected} ${r.rejected === 1 ? "suggestion" : "suggestions"} set aside`);
    },
    meta: { errorTitle: "Not applied" },
  });
  const up = inView.filter((s) => s.suggestedKobo > s.currentKobo).length;
  const target = inSelection.length ? inSelection : inView;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-[color-mix(in_oklab,var(--adire)_5%,var(--surface))] px-4 py-2 sm:px-5" data-testid="suggestions-strip">
      <button type="button" role="switch" aria-checked={show} onClick={() => onShow(!show)} className="inline-flex items-center gap-2 text-[12.5px] font-medium text-ink">
        <span className={cn("relative inline-flex h-[18px] w-[30px] items-center rounded-full border transition-colors", show ? "border-adire bg-adire" : "border-line-strong bg-surface-2")}>
          <span className={cn("inline-block h-3 w-3 rounded-full transition-transform", show ? "translate-x-[14px] bg-surface" : "translate-x-[2px] bg-ink-faint")} />
        </span>
        <ChartLineUp size={14} weight="duotone" className="text-adire" />
        Pricing suggestions
      </button>
      <span className="text-[12px] text-ink-muted">
        {inView.length ? (
          <>
            <span className="font-mono text-ink">{inView.length}</span> in view: <span className="text-palm">{up} up</span>, <span className="text-ochre">{inView.length - up} down</span>
          </>
        ) : (
          "none in these nights"
        )}
        {mode && (
          <>
            {" "}
            &middot; mode <span className="font-medium text-ink">{mode === "AUTOPILOT" ? "autopilot" : mode === "SUGGEST" ? "suggest" : "off"}</span>
          </>
        )}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        {canManage && show && target.length > 0 && (
          <>
            <Button size="sm" variant="ghost" onClick={() => bulk.mutate({ ids: target.map((s) => s.id), action: "REJECT" })} disabled={bulk.isPending}>
              Set aside {inSelection.length ? "selected" : "all"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => bulk.mutate({ ids: target.map((s) => s.id), action: "ACCEPT" })} loading={bulk.isPending} data-testid="accept-bulk">
              <Check size={13} weight="bold" /> Accept {inSelection.length ? `${inSelection.length} selected` : `all ${inView.length}`}
            </Button>
          </>
        )}
        <Link href="/dynamic-pricing" className="inline-flex h-8 items-center gap-1 rounded-sm px-2 text-[12.5px] text-ink-muted hover:bg-surface-2 hover:text-ink">
          Settings <ArrowRight size={12} />
        </Link>
      </div>
    </div>
  );
}

export type { DayKey };
