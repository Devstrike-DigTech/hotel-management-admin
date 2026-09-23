"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarDots, CaretLeft, CaretRight, Lightning, PushPin, Keyboard } from "@phosphor-icons/react";
import { useRateCalendar, useRatePlans, qk4 } from "@/lib/api/hooks-m4";
import { ratesApi } from "@/lib/api/endpoints-m4";
import type { BandColor, RateCalendar, RateRule } from "@/lib/api/types-m4";
import { addDays, diffDays, formatDay, todayKey, type DayKey } from "@/lib/dates";
import { naira, percent } from "@/lib/format";
import { toast } from "@/lib/store";
import { useCan } from "@/lib/permissions";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { ConfirmDialog } from "@/components/ui/overlay";
import { AlmanacGrid, selectionDates, type Preview } from "./almanac";
import { PaintTray, type PaintDraft } from "./paint-tray";
import { SLOT_VAR, previewCell, type AlmanacCell, type AlmanacData, type AlmanacRule, type Selection } from "./model";
import { useEntitlements } from "@/lib/auth";
import { SuggestionPopover, SuggestionsStrip, ghostOf, useAlmanacSuggestions } from "@/components/pricing/overlay";
import type { Suggestion } from "@/lib/api/types-m5";

const WINDOW = 42;
const BAND_SLOT: Record<BandColor, number> = { laterite: 1, adire: 2, brass: 3, palm: 4, ochre: 5 };
const SLOT_BAND: BandColor[] = ["laterite", "adire", "brass", "palm", "ochre"];

function toRule(r: RateRule): AlmanacRule {
  return {
    id: r.id,
    name: r.name,
    slot: BAND_SLOT[r.color] ?? 1,
    roomTypeIds: r.roomTypeIds,
    dateFrom: r.dateFrom,
    dateTo: r.dateTo,
    daysOfWeek: r.daysOfWeek,
    adjustment: r.adjustment.type === "PERCENT" ? { type: "PERCENT", value: r.adjustment.value / 100 } : { type: r.adjustment.type, value: r.adjustment.value },
    priority: r.priority,
    active: r.active,
  };
}

function adapt(c: RateCalendar): AlmanacData {
  const days = c.roomTypes[0]?.days.map((d) => d.date) ?? [];
  const cells = new Map<string, Map<DayKey, AlmanacCell>>();
  for (const t of c.roomTypes) {
    const m = new Map<DayKey, AlmanacCell>();
    for (const d of t.days)
      m.set(d.date, {
        date: d.date,
        priceKobo: d.rateKobo,
        baseKobo: t.roomType.basePriceKobo,
        ruleId: d.ruleId,
        overrideKobo: d.override ? d.rateKobo : null,
        overrideSource: d.override ? (d.overrideSource ?? "MANUAL") : null,
        minNights: d.restriction?.minNights ?? null,
        closedToArrival: !!d.restriction?.closedToArrival,
        stopSell: !!d.restriction?.stopSell,
        available: d.available,
      });
    cells.set(t.roomType.id, m);
  }
  return {
    from: c.from,
    days,
    types: c.roomTypes.map((t) => ({ id: t.roomType.id, name: t.roomType.name, basePriceKobo: t.roomType.basePriceKobo, rooms: t.days[0]?.sellable })),
    cells,
    rules: c.bands.map(toRule),
    demand: new Map(c.occupancy.map((o) => [o.date, { date: o.date, occupancy: o.rate, booked: o.booked, total: o.sellable }])),
  };
}

export function RatesView() {
  const today = todayKey();
  const qc = useQueryClient();
  const { can } = useCan();
  const canManage = can("rates.manage");
  const [from, setFrom] = useState<DayKey>(today);
  const to = addDays(from, WINDOW - 1);
  const plans = useRatePlans();
  const [planId, setPlanId] = useState<string | undefined>(undefined);
  const cal = useRateCalendar(from, to, planId);
  const data = useMemo(() => (cal.data ? adapt(cal.data) : null), [cal.data]);
  const isBar = !cal.data || cal.data.ratePlan.isBar;

  const [sel, setSel] = useState<Selection | null>(null);
  const [tray, setTray] = useState<{ sel: Selection | null; rule: AlmanacRule | null } | null>(null);
  const [draft, setDraft] = useState<PaintDraft | null>(null);
  const [deleting, setDeleting] = useState<AlmanacRule | null>(null);

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: qk4.rates }), qc.invalidateQueries({ queryKey: ["availability"] })]);

  const save = useMutation({
    mutationFn: async (d: PaintDraft) => {
      if (!data) return;
      const s = tray?.sel;
      const typeIds = s ? data.types.slice(s.r0, s.r1 + 1).map((t) => t.id) : [];
      const all = typeIds.length === data.types.length;
      const range = s ? selectionDates(data.days, s) : null;
      if (d.kind === "rule") {
        const r = d.rule;
        const body = {
          name: r.name,
          roomTypeIds: r.roomTypeIds,
          dateFrom: r.dateFrom,
          dateTo: r.dateTo,
          daysOfWeek: r.daysOfWeek,
          adjustment: r.adjustment.type === "PERCENT" ? { type: "PERCENT" as const, value: Math.round(r.adjustment.value * 100) } : r.adjustment,
          priority: r.priority,
          color: SLOT_BAND[(r.slot - 1) % 5],
          active: true,
        };
        return d.isNew ? ratesApi.createRule(body) : ratesApi.updateRule(r.id, body);
      }
      if (!range) return;
      if (d.kind === "override") return ratesApi.setOverrides({ roomTypeIds: typeIds, from: range.from, to: range.to, rateKobo: d.priceKobo });
      return ratesApi.setRestrictions({
        roomTypeIds: all ? null : typeIds,
        from: range.from,
        to: range.to,
        minNights: d.minNights,
        closedToArrival: d.closedToArrival,
        stopSell: d.stopSell,
      });
    },
    onSuccess: async (_r, d) => {
      await refresh();
      toast.success(
        d.kind === "rule" ? `${d.rule.name} ${d.isNew ? "painted" : "saved"}` : d.kind === "override" ? (d.priceKobo == null ? "Fixed prices cleared" : `Fixed at ${naira(d.priceKobo)} a night`) : "Restrictions applied",
        d.kind === "rule" ? "Prices update for every booking from now on. Existing bookings keep their price." : undefined,
      );
      setTray(null);
      setSel(null);
      setDraft(null);
    },
    meta: { errorTitle: "Rates not saved" },
  });

  const del = useMutation({
    mutationFn: (r: AlmanacRule) => ratesApi.deleteRule(r.id),
    onSuccess: async (_x, r) => {
      await refresh();
      toast.success(`${r.name} removed`);
      setTray(null);
    },
    meta: { errorTitle: "Season not removed" },
  });

  const onCommit = (s: Selection) => {
    if (!isBar) {
      toast.info("Paint on the best available rate", "Other plans follow it automatically.");
      return;
    }
    setTray({ sel: s, rule: null });
  };

  const preview: Preview | undefined = useMemo(() => {
    if (!draft || !data || !tray) return undefined;
    const s = tray.sel;
    return (typeId, cell, r, c) => {
      const inDraft = !!s && r >= s.r0 && r <= s.r1 && c >= s.c0 && c <= s.c1;
      if (draft.kind === "rule") return previewCell(cell, typeId, data.rules, { rule: draft.rule, inDraft: false });
      if (draft.kind === "override" && inDraft) return previewCell(cell, typeId, data.rules, { overrideKobo: draft.priceKobo, inDraft: true });
      return null;
    };
  }, [draft, data, tray]);

  // demand without a price: high forecast nights still sold at the base rate
  const underpriced = useMemo(() => {
    if (!data || !isBar) return [];
    return data.days.filter((d) => {
      const o = data.demand.get(d)?.occupancy ?? 0;
      if (o < 0.8) return false;
      return data.types.every((t) => {
        const c = data.cells.get(t.id)?.get(d);
        return c && !c.ruleId && c.overrideKobo == null;
      });
    });
  }, [data, isBar]);

  const avgOcc = data ? [...data.demand.values()].reduce((s, d) => s + d.occupancy, 0) / Math.max(1, data.demand.size) : 0;
  const trayRange = tray?.sel && data ? selectionDates(data.days, tray.sel) : null;

  // dynamic pricing: suggestions drawn as ghost prices on the best available rate
  const { has } = useEntitlements();
  const pricingOn = has("dynamic_pricing") && can("pricing.view");
  const sugg = useAlmanacSuggestions(from, to, pricingOn && isBar);
  const [showGhosts, setShowGhostsState] = useState(true);
  const setShowGhosts = (v: boolean) => {
    setShowGhostsState(v);
    try {
      localStorage.setItem("admin.rates.ghosts", v ? "1" : "0");
    } catch {
      /* ignore */
    }
  };
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- remember the viewer's choice
      if (localStorage.getItem("admin.rates.ghosts") === "0") setShowGhostsState(false);
    } catch {
      /* ignore */
    }
  }, []);
  const [openSugg, setOpenSugg] = useState<{ s: Suggestion; anchor: HTMLElement } | null>(null);
  const inView = useMemo(() => (data ? sugg.list.filter((x) => data.days.includes(x.date)) : []), [sugg.list, data]);
  const inSelection = useMemo(() => {
    if (!data || !sel) return [];
    const ids = new Set(data.types.slice(sel.r0, sel.r1 + 1).map((t) => t.id));
    const days = new Set(data.days.slice(sel.c0, sel.c1 + 1));
    return inView.filter((x) => ids.has(x.roomType.id) && days.has(x.date));
  }, [data, sel, inView]);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <CalendarDots size={14} weight="duotone" /> Rates
          </>
        }
        title={
          <>
            The Rate <em>Almanac</em>.
          </>
        }
        description="Every room type, every night, at the price a guest would pay. Seasons run across the top; drag across nights to paint a new one, fix a price, or close a date to arrivals."
        actions={
          <>
            <Link href="/rates/plans" className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink">
              Rate plans <ArrowRight size={13} />
            </Link>
            <Link href="/promotions" className="inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink">
              Promo codes <ArrowRight size={13} />
            </Link>
          </>
        }
      />

      {/* controls */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="inline-flex items-center rounded-md border border-line bg-surface">
          <Button variant="ghost" size="icon" aria-label="Four weeks earlier" onClick={() => setFrom(addDays(from, -28))} disabled={diffDays(today, from) <= -28}>
            <CaretLeft size={15} />
          </Button>
          <span className="min-w-[168px] px-2 text-center text-[13px] text-ink">
            {formatDay(from, { day: "numeric", month: "short" })} to {formatDay(to, { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <Button variant="ghost" size="icon" aria-label="Four weeks later" onClick={() => setFrom(addDays(from, 28))}>
            <CaretRight size={15} />
          </Button>
        </div>
        <Button variant="secondary" size="sm" onClick={() => setFrom(today)} disabled={from === today}>
          Today
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setFrom(`${today.slice(0, 4)}-12-08`)}>
          December
        </Button>
        <label className="ml-auto flex items-center gap-2 text-[12.5px] text-ink-muted">
          Prices for
          <select
            value={planId ?? ""}
            onChange={(e) => {
              setPlanId(e.target.value || undefined);
              setTray(null);
              setSel(null);
            }}
            className="h-8 rounded-sm border border-line-strong bg-surface px-2 text-[13px] text-ink outline-none focus:border-laterite"
          >
            {(plans.data ?? []).filter((p) => p.active).map((p) => (
              <option key={p.id} value={p.isBar ? "" : p.id}>
                {p.name}
                {p.label && !p.isBar ? ` (${p.label})` : ""}
              </option>
            ))}
            {!plans.data && <option value="">Best available rate</option>}
          </select>
        </label>
      </div>

      <Panel className="overflow-hidden">
        {pricingOn && isBar && (
          <SuggestionsStrip show={showGhosts} onShow={setShowGhosts} inView={inView} inSelection={inSelection} mode={sugg.settings?.mode} canManage={can("pricing.manage")} />
        )}
        {/* legend */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-line px-4 py-2.5 text-[11.5px] text-ink-muted sm:px-5">
          <span className="eyebrow text-[10px]">Nightly rate, ₦</span>
          {data?.rules.map((r) => (
            <button key={r.id} type="button" onClick={() => canManage && isBar && setTray({ sel: null, rule: r })} className="inline-flex items-center gap-1.5 hover:text-ink">
              <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: SLOT_VAR(r.slot) }} aria-hidden />
              {r.name}
            </button>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <PushPin size={11} weight="fill" className="text-brass" /> fixed price
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="hatch h-3 w-[6px] border-r border-[color-mix(in_oklab,var(--danger)_55%,transparent)] text-danger" aria-hidden /> closed to arrival
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded-[2px] border border-line-strong px-[3px] font-mono text-[9.5px] text-ink">3N</span> minimum stay
          </span>
          <span className="w-full text-[11.5px] text-ink-faint sm:hidden">Tap a night, tap another to make a range, then tap inside it to paint.</span>
          <span className="ml-auto hidden items-center gap-1.5 lg:inline-flex">
            <Keyboard size={13} /> arrows move, <span className="kbd">Shift</span> selects, <span className="kbd">Enter</span> paints
          </span>
        </div>

        {!isBar && cal.data && (
          <p className="border-b border-line bg-adire-wash/50 px-5 py-2 text-[12.5px] text-ink">
            <span className="font-medium">{cal.data.ratePlan.name}</span> follows the best available rate
            {cal.data.ratePlan.label ? ` (${cal.data.ratePlan.label})` : ""}. Switch back to paint seasons and prices.
          </p>
        )}

        {cal.isError ? (
          <ErrorState error={cal.error} onRetry={() => cal.refetch()} />
        ) : !data ? (
          <div className="flex flex-col gap-2 p-5">
            <Skeleton className="h-20" />
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-14" />
            ))}
          </div>
        ) : (
          <div className={cn("transition-opacity", cal.isFetching && cal.isPlaceholderData && "opacity-60")}>
            <AlmanacGrid
              data={data}
              selection={tray?.sel ?? sel}
              onSelectionChange={(s) => {
                setSel(s);
                // a new selection replaces the one being painted; Enter or release opens the tray again
                if (!s || tray?.sel) {
                  setTray(null);
                  setDraft(null);
                }
              }}
              onCommit={onCommit}
              onRuleClick={(r) => canManage && isBar && setTray({ sel: null, rule: r })}
              preview={preview}
              activeRuleId={tray?.rule?.id ?? null}
              today={today}
              draftRule={draft?.kind === "rule" ? draft.rule : null}
              ghost={pricingOn && isBar && showGhosts && !tray ? (typeId, date) => ghostOf(sugg.map.get(`${typeId}|${date}`)) : undefined}
              onGhost={(g, typeId, date, anchor) => {
                const s = sugg.map.get(`${typeId}|${date}`);
                if (s) setOpenSugg({ s, anchor });
              }}
            />
          </div>
        )}

        {tray && data && (
          <PaintTray
            key={tray.rule?.id ?? JSON.stringify(tray.sel)}
            from={tray.rule?.dateFrom ?? trayRange!.from}
            to={tray.rule?.dateTo ?? trayRange!.to}
            types={data.types}
            selectedTypeIds={tray.sel ? data.types.slice(tray.sel.r0, tray.sel.r1 + 1).map((t) => t.id) : data.types.map((t) => t.id)}
            editing={tray.rule}
            rules={data.rules}
            onDraft={setDraft}
            onSave={(d) => save.mutate(d)}
            onDelete={(r) => setDeleting(r)}
            onClose={() => {
              setTray(null);
              setSel(null);
            }}
            saving={save.isPending}
            canManage={canManage}
          />
        )}
      </Panel>

      {/* reading the demand */}
      {data && (
        <div className="mt-5 grid gap-4 md:grid-cols-[1fr_1fr_1.4fr]">
          <Panel className="p-5">
            <p className="display-sm text-[14px] italic text-ink-muted">Forecast occupancy</p>
            <p className="mt-1.5 font-mono text-[30px] leading-none text-ink">{percent(avgOcc)}</p>
            <p className="mt-2 text-[12.5px] text-ink-muted">average over these {WINDOW} nights, from bookings and holds on the books</p>
          </Panel>
          <Panel className="p-5">
            <p className="display-sm text-[14px] italic text-ink-muted">Seasons in view</p>
            <p className="mt-1.5 font-mono text-[30px] leading-none text-ink">{data.rules.length}</p>
            <p className="mt-2 text-[12.5px] text-ink-muted">where seasons overlap, the higher priority sets the price</p>
          </Panel>
          <Panel className="p-5">
            <p className="display-sm flex items-center gap-2 text-[14px] italic text-ink-muted">
              <Lightning size={14} weight="duotone" className="text-laterite" /> Busy nights at the base price
            </p>
            {underpriced.length ? (
              <>
                <p className="mt-2 text-[13px] text-ink">
                  {underpriced.length} {underpriced.length === 1 ? "night is" : "nights are"} forecast at 80% or more and still sell at base:{" "}
                  <span className="font-mono text-[12.5px]">{underpriced.slice(0, 5).map((d) => formatDay(d, { day: "numeric", month: "short" })).join(", ")}</span>
                  {underpriced.length > 5 ? " ..." : ""}
                </p>
                {canManage && isBar && (
                  <Button
                    size="sm"
                    variant="secondary"
                    className="mt-3"
                    onClick={() => {
                      const c0 = data.days.indexOf(underpriced[0]);
                      const s = { r0: 0, r1: data.types.length - 1, c0, c1: c0 };
                      setSel(s);
                      setTray({ sel: s, rule: null });
                    }}
                  >
                    Paint the first one
                  </Button>
                )}
              </>
            ) : (
              <p className="mt-2 text-[13px] text-ink-muted">None in view. Every night forecast at 80% or more already carries a season or a fixed price.</p>
            )}
          </Panel>
        </div>
      )}

      <SuggestionPopover s={openSugg?.s ?? null} anchor={openSugg?.anchor ?? null} onClose={() => setOpenSugg(null)} canManage={can("pricing.manage")} />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "this season"}?`}
        body="Nights it covered go back to the next season or the base price. Bookings already made keep the price they were quoted."
        confirmLabel="Delete season"
        danger
        onConfirm={() => (deleting ? del.mutateAsync(deleting) : undefined)}
      />
    </>
  );
}
