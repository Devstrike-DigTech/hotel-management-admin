"use client";

import { ArrowsLeftRight, CreditCard, Money, ShieldWarning } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { naira } from "@/lib/format";
import { formatTime } from "@/lib/format";
import { PAYMENT_METHODS, VARIANCE_TOLERANCE_KOBO } from "@/lib/catalog-m2";
import type { Shift, ShiftPayment } from "@/lib/api/types-m2";

export function varianceTone(v: number | null | undefined) {
  if (v === null || v === undefined) return { tone: "var(--ink-muted)", label: "-" };
  if (Math.abs(v) <= VARIANCE_TOLERANCE_KOBO) return { tone: "var(--palm)", label: v === 0 ? "Balanced" : "Within ₦500" };
  return v < 0 ? { tone: "var(--danger)", label: "Short" } : { tone: "var(--ochre)", label: "Over" };
}

export function VarianceChip({ v }: { v: number | null }) {
  if (v === null) return <span className="font-mono text-[12px] text-ink-faint">hidden</span>;
  const t = varianceTone(v);
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[12.5px]" style={{ color: t.tone }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: t.tone }} />
      {v > 0 ? "+" : v < 0 ? "−" : ""}
      {naira(Math.abs(v))}
    </span>
  );
}

/** Expected against counted for each method, with the variance ruled off beneath. */
export function VarianceTable({ s, animate }: { s: Shift; animate?: boolean }) {
  const rows = [
    { key: "cash", label: "Cash in drawer", icon: <Money size={16} weight="duotone" />, expected: s.expectedCashKobo, counted: s.countedCashKobo, v: s.varianceCashKobo, note: `includes ${naira(s.openingFloatKobo)} float` },
    { key: "pos", label: "POS", icon: <CreditCard size={16} weight="duotone" />, expected: s.expectedPosKobo, counted: s.declaredPosKobo, v: s.variancePosKobo },
    { key: "trf", label: "Transfers", icon: <ArrowsLeftRight size={16} weight="duotone" />, expected: s.expectedTransferKobo, counted: s.declaredTransferKobo, v: s.varianceTransferKobo },
  ];
  return (
    <div className="overflow-hidden rounded-md border border-line">
      <div className="grid grid-cols-[1fr_repeat(3,minmax(0,110px))] gap-2 border-b border-line bg-surface-2/50 px-4 py-2">
        <span className="eyebrow text-[10px]">Method</span>
        <span className="eyebrow text-right text-[10px]">Expected</span>
        <span className="eyebrow text-right text-[10px]">Counted</span>
        <span className="eyebrow text-right text-[10px]">Variance</span>
      </div>
      {rows.map((r, i) => (
        <div
          key={r.key}
          className={cn("grid grid-cols-[1fr_repeat(3,minmax(0,110px))] items-baseline gap-2 border-b border-line px-4 py-3 last:border-0", animate && "animate-[rise_420ms_cubic-bezier(0.22,1,0.36,1)_both]")}
          style={animate ? { animationDelay: `${200 + i * 160}ms` } : undefined}
        >
          <span className="flex items-center gap-2 text-[13.5px] text-ink">
            <span className="text-ink-muted">{r.icon}</span>
            <span>
              {r.label}
              {r.note && <span className="block text-[11px] text-ink-faint">{r.note}</span>}
            </span>
          </span>
          <span className="text-right font-mono text-[13.5px] text-ink-muted">{naira(r.expected, "-")}</span>
          <span className="text-right font-mono text-[13.5px] text-ink">{naira(r.counted, "-")}</span>
          <span className="text-right">
            <VarianceChip v={r.v} />
          </span>
        </div>
      ))}
    </div>
  );
}

export function VarianceHeadline({ s }: { s: Shift }) {
  const v = s.varianceTotalKobo ?? 0;
  const worst = [s.varianceCashKobo, s.variancePosKobo, s.varianceTransferKobo].reduce<number>((m, x) => (Math.abs(x ?? 0) > Math.abs(m) ? (x ?? 0) : m), 0);
  const t = varianceTone(worst);
  const flagged = Math.abs(worst) > VARIANCE_TOLERANCE_KOBO;
  return (
    <div className="flex flex-col items-center text-center">
      <p className="eyebrow mb-2">The count against the books</p>
      <p className="display text-[44px] leading-none md:text-[56px]" style={{ color: t.tone }} data-testid="variance-headline">
        {Math.abs(worst) <= VARIANCE_TOLERANCE_KOBO ? (
          <>
            Balanced<em>.</em>
          </>
        ) : worst < 0 ? (
          <>
            Short by <span className="font-mono tracking-tight">{naira(-worst)}</span>
          </>
        ) : (
          <>
            Over by <span className="font-mono tracking-tight">{naira(worst)}</span>
          </>
        )}
      </p>
      <p className="mt-3 text-[13.5px] text-ink-muted">
        Net variance across methods <span className="font-mono text-ink">{v > 0 ? "+" : v < 0 ? "−" : ""}{naira(Math.abs(v))}</span>
      </p>
      {flagged && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-danger-wash px-3 py-1 text-[12.5px] text-danger">
          <ShieldWarning size={14} weight="duotone" /> Beyond ₦500, so Revenue Guard has flagged it for the owner
        </p>
      )}
    </div>
  );
}

export function PaymentsList({ payments }: { payments: ShiftPayment[] }) {
  if (!payments.length) return <p className="px-4 py-6 text-center text-[13px] italic text-ink-faint">No payments on this shift.</p>;
  return (
    <ul className="divide-y divide-line">
      {payments.map((p) => (
        <li key={p.entryId} className={cn("flex items-baseline gap-3 px-4 py-2.5 text-[13px]", p.voided && "opacity-60")}>
          <span className="w-12 font-mono text-[11.5px] text-ink-faint">{formatTime(p.createdAt)}</span>
          <span className={cn("min-w-0 flex-1 truncate text-ink", p.voided && "line-through")}>
            {p.guestName ?? "Walk-in"}
            {p.reservationCode && <span className="ml-2 font-mono text-[11px] text-ink-faint">{p.reservationCode}</span>}
          </span>
          <span className="text-[12px] text-ink-muted">{PAYMENT_METHODS[p.method].short}</span>
          <span className={cn("w-24 text-right font-mono", p.type === "REFUND" ? "text-danger" : "text-ink")}>
            {p.type === "REFUND" ? "−" : ""}
            {naira(p.amountKobo)}
          </span>
        </li>
      ))}
    </ul>
  );
}
