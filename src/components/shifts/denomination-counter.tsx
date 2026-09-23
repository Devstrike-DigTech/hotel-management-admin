"use client";

import { Minus, Plus } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { naira } from "@/lib/format";
import { DENOMINATIONS, type Denomination } from "@/lib/catalog-m2";

const NOTE_TONE: Record<Denomination, string> = {
  1000: "var(--adire)",
  500: "var(--palm)",
  200: "var(--brass)",
  100: "var(--laterite)",
  50: "var(--ochre)",
};

export type Counts = Record<Denomination, number>;
export const emptyCounts = (): Counts => ({ 1000: 0, 500: 0, 200: 0, 100: 0, 50: 0 });
export const countsTotalKobo = (c: Counts, looseKobo = 0) =>
  DENOMINATIONS.reduce((s, d) => s + d * 100 * (c[d] || 0), 0) + looseKobo;

/** Count the drawer note by note, like a cashier with a stack of naira. */
export function DenominationCounter({
  counts,
  onChange,
  loose,
  onLoose,
}: {
  counts: Counts;
  onChange: (c: Counts) => void;
  loose: number;
  onLoose: (kobo: number) => void;
}) {
  const set = (d: Denomination, v: number) => onChange({ ...counts, [d]: Math.max(0, Math.min(99999, Math.round(v) || 0)) });
  return (
    <div className="flex flex-col">
      {DENOMINATIONS.map((d) => {
        const n = counts[d] || 0;
        const tone = NOTE_TONE[d];
        return (
          <div key={d} className="grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-dashed border-line py-3 sm:grid-cols-[112px_1fr_120px]">
            <Note value={d} tone={tone} stack={Math.min(4, Math.ceil(n / 25))} />
            <div className="flex items-center gap-1.5">
              <span className="hidden font-mono text-[13px] text-ink-faint sm:inline">&times;</span>
              <div className="inline-flex h-11 items-stretch overflow-hidden rounded-md border border-line-strong bg-surface">
                <button type="button" onClick={() => set(d, n - 1)} className="grid w-8 place-items-center sm:w-10 text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label={`One fewer ₦${d} note`}>
                  <Minus size={14} weight="bold" />
                </button>
                <input
                  inputMode="numeric"
                  aria-label={`Number of ₦${d} notes`}
                  data-testid={`count-${d}`}
                  value={n || ""}
                  placeholder="0"
                  onChange={(e) => set(d, Number(e.target.value.replace(/\D/g, "")))}
                  onFocus={(e) => e.target.select()}
                  className="w-12 border-x sm:w-16 border-line bg-transparent text-center font-mono text-[18px] text-ink outline-none focus:bg-laterite-wash/40"
                />
                <button type="button" onClick={() => set(d, n + 1)} className="grid w-8 place-items-center sm:w-10 text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label={`One more ₦${d} note`}>
                  <Plus size={14} weight="bold" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => set(d, n + 10)}
                className="hidden h-8 rounded-full border border-line-strong px-2.5 font-mono text-[11.5px] text-ink-muted hover:text-ink sm:inline-flex sm:items-center"
              >
                +10
              </button>
            </div>
            <span className={cn("text-right font-mono text-[15px]", n ? "text-ink" : "text-ink-faint")}>{naira(d * 100 * n)}</span>
          </div>
        );
      })}
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3 sm:grid-cols-[112px_1fr_120px]">
        <span className="text-[12.5px] text-ink-muted">Coins &amp; loose</span>
        <input
          inputMode="numeric"
          aria-label="Coins and loose change in naira"
          value={loose ? String(Math.round(loose / 100)) : ""}
          placeholder="0"
          onChange={(e) => onLoose(Number(e.target.value.replace(/\D/g, "") || 0) * 100)}
          className="h-10 w-28 rounded-md border border-line-strong bg-surface px-3 font-mono text-[15px] text-ink outline-none focus:border-laterite"
        />
        <span className={cn("text-right font-mono text-[15px]", loose ? "text-ink" : "text-ink-faint")}>{naira(loose)}</span>
      </div>
    </div>
  );
}

/** A small banknote glyph; stacks up as the count grows. */
function Note({ value, tone, stack }: { value: number; tone: string; stack: number }) {
  return (
    <span className="relative inline-block h-[38px] w-[64px] shrink-0 sm:w-[96px]" aria-hidden>
      {Array.from({ length: stack }, (_, i) => (
        <span
          key={i}
          className="absolute h-[30px] w-[58px] rounded-[3px] border sm:w-[88px]"
          style={{
            left: (stack - i) * 2,
            top: 6 - (stack - i) * 1.5,
            borderColor: `color-mix(in oklab, ${tone} 45%, transparent)`,
            background: `color-mix(in oklab, ${tone} 10%, var(--surface))`,
          }}
        />
      ))}
      <span
        className="absolute left-0 top-[6px] flex h-[30px] w-[58px] items-center justify-center overflow-hidden rounded-[3px] border px-1.5 sm:w-[88px] sm:justify-between"
        style={{
          borderColor: `color-mix(in oklab, ${tone} 60%, transparent)`,
          background: `linear-gradient(90deg, color-mix(in oklab, ${tone} 22%, var(--surface)), color-mix(in oklab, ${tone} 8%, var(--surface)))`,
          color: tone,
        }}
      >
        <span className="hidden h-5 w-5 place-items-center rounded-full border sm:grid" style={{ borderColor: `color-mix(in oklab, ${tone} 50%, transparent)` }}>
          <span className="h-2 w-2 rounded-full" style={{ background: `color-mix(in oklab, ${tone} 60%, transparent)` }} />
        </span>
        <span className="font-mono text-[11px] font-semibold tracking-tight sm:text-[12.5px]">₦{value.toLocaleString("en-NG")}</span>
      </span>
    </span>
  );
}
