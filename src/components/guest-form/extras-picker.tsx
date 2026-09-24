"use client";

import { Check, Minus, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import type { ExtraCategory, ExtraSelection, PublicExtra } from "@/lib/api/types-m7";
import { EXTRA_CATEGORIES, extraPrice, pricingUnit } from "@/lib/m7-catalog";
import { naira } from "@/lib/format";
import { CatalogIcon } from "@/components/m7/icon";

/** Quantity that counts: units for PER_UNIT, persons for per-person pricing. */
function qtyOf(e: PublicExtra, sel: ExtraSelection | undefined, guests: number) {
  if (!sel) return 0;
  if (e.pricing === "PER_UNIT" || e.pricing === "PER_PERSON" || e.pricing === "PER_PERSON_PER_NIGHT") return sel.quantity ?? (e.pricing === "PER_UNIT" ? 1 : guests);
  return 1;
}

export function extrasTotal(extras: PublicExtra[], selection: ExtraSelection[], stay: { nights: number; guests: number }) {
  return selection.reduce((sum, s) => {
    const e = extras.find((x) => x.id === s.extraId);
    if (!e) return sum;
    const q = qtyOf(e, s, stay.guests);
    return sum + extraPrice(e.pricing, e.priceKobo, { nights: stay.nights, guests: q, units: q });
  }, 0);
}

export function ExtrasPicker({
  extras,
  value,
  onChange,
  nights,
  guests,
  categories,
  label,
}: {
  extras: PublicExtra[];
  value: ExtraSelection[];
  onChange: (v: ExtraSelection[]) => void;
  nights: number;
  guests: number;
  categories: ExtraCategory[] | null;
  label: string;
}) {
  const list = extras.filter((e) => !categories || categories.includes(e.category));
  const total = extrasTotal(list, value, { nights, guests });
  if (!list.length) return <p className="text-[13px] text-ink-muted">No extras are on sale for this channel yet.</p>;
  const set = (id: string, q: number | null) => {
    const rest = value.filter((s) => s.extraId !== id);
    onChange(q === null ? rest : [...rest, { extraId: id, quantity: q }]);
  };
  return (
    <div className="flex flex-col gap-2" data-testid="extras-picker" aria-label={label} role="group">
      <ul className="flex flex-col divide-y divide-line rounded-md border border-line bg-surface">
        {list.map((e) => {
          const sel = value.find((s) => s.extraId === e.id);
          const q = qtyOf(e, sel, guests);
          const counted = e.pricing === "PER_UNIT" || e.pricing.startsWith("PER_PERSON");
          const max = e.pricing === "PER_UNIT" ? (e.maxUnits ?? 10) : Math.max(1, guests);
          const cat = EXTRA_CATEGORIES.find((c) => c.value === e.category);
          const off = e.available === false;
          return (
            <li key={e.id} className={cn("flex items-center gap-3 px-3 py-2.5", off && "opacity-55")} data-extra={e.name}>
              <button
                type="button"
                role="checkbox"
                aria-checked={!!sel}
                disabled={off}
                onClick={() => set(e.id, sel ? null : counted ? (e.pricing === "PER_UNIT" ? 1 : guests) : 1)}
                className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-xs border transition-colors", sel ? "border-laterite bg-laterite text-laterite-ink" : "border-line-strong bg-surface")}
                aria-label={`Add ${e.name}`}
              >
                {sel && <Check size={12} weight="bold" />}
              </button>
              <CatalogIcon name={cat?.icon ?? "ShoppingBag"} size={15} className="shrink-0 text-ink-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] text-ink">{e.name}</p>
                <p className="truncate text-[11.5px] text-ink-muted">
                  <span className="font-mono">{naira(e.priceKobo)}</span> {pricingUnit(e.pricing)}
                  {off && e.unavailableReason ? ` · ${e.unavailableReason}` : ""}
                </p>
              </div>
              {sel && counted && (
                <span className="inline-flex h-8 items-stretch overflow-hidden rounded-sm border border-line-strong" role="group" aria-label={`${e.name} quantity`}>
                  <button type="button" onClick={() => set(e.id, q - 1 < 1 ? null : q - 1)} className="grid w-7 place-items-center text-ink-muted hover:bg-surface-2" aria-label="Fewer">
                    <Minus size={11} weight="bold" />
                  </button>
                  <span className="grid w-7 place-items-center border-x border-line font-mono text-[12.5px]">{q}</span>
                  <button type="button" disabled={q >= max} onClick={() => set(e.id, q + 1)} className="grid w-7 place-items-center text-ink-muted hover:bg-surface-2 disabled:opacity-30" aria-label="More">
                    <Plus size={11} weight="bold" />
                  </button>
                </span>
              )}
              <span className={cn("w-[84px] shrink-0 text-right font-mono text-[12.5px]", sel ? "text-ink" : "text-ink-faint")}>
                {sel ? naira(extraPrice(e.pricing, e.priceKobo, { nights, guests: q, units: q })) : ""}
              </span>
            </li>
          );
        })}
      </ul>
      {value.length > 0 && (
        <p className="flex items-baseline justify-between px-1 text-[13px]" data-testid="extras-total">
          <span className="text-ink-muted">
            {value.length} extra{value.length === 1 ? "" : "s"}, before tax
          </span>
          <span className="font-mono text-ink">{naira(total)}</span>
        </p>
      )}
    </div>
  );
}
