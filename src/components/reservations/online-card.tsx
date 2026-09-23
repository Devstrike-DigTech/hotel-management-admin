"use client";

import { ArrowCounterClockwise, CheckCircle, Clock, CreditCard, UserCircleCheck, WarningOctagon, XCircle } from "@phosphor-icons/react";
import type { ReservationDetail } from "@/lib/api/types-m2";
import type { BookingPaymentStatus, RefundStatus } from "@/lib/api/types-m3";
import { formatDateTime, formatPhone, naira } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Panel } from "@/components/ui/primitives";
import { BRASS_TEXT, ChannelBadge, CHANNEL_META } from "@/components/m3/bits";

/** What the guest has paid online and not had back. */
export function paidOnline(r: ReservationDetail): number {
  const o = r.online;
  if (!o) return 0;
  const paid = o.payments.filter((p) => ["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(p.status)).reduce((s, p) => s + p.amountKobo, 0);
  const back = o.refunds.filter((f) => f.status !== "FAILED").reduce((s, f) => s + f.amountKobo, 0);
  return Math.max(0, paid - back);
}

const PAY: Record<BookingPaymentStatus, { label: string; color: string; icon: React.ElementType }> = {
  INITIALIZED: { label: "Waiting for payment", color: BRASS_TEXT, icon: Clock },
  SUCCEEDED: { label: "Paid", color: "var(--palm)", icon: CheckCircle },
  FAILED: { label: "Failed", color: "var(--ink-muted)", icon: XCircle },
  ORPHANED: { label: "Paid late, refunding", color: "var(--danger)", icon: WarningOctagon },
  PARTIALLY_REFUNDED: { label: "Partly refunded", color: "var(--ochre)", icon: ArrowCounterClockwise },
  REFUNDED: { label: "Refunded", color: "var(--ink-muted)", icon: ArrowCounterClockwise },
};
const REFUND: Record<RefundStatus, { label: string; color: string }> = {
  PENDING: { label: "pending", color: "var(--ochre)" },
  PROCESSED: { label: "done", color: "var(--palm)" },
  FAILED: { label: "failed", color: "var(--danger)" },
};
const REFUND_WHY = { GUEST_CANCELLED: "Guest cancelled", HOTEL_CANCELLED: "Hotel cancelled", PAYMENT_ORPHANED: "Paid after the room went" } as const;
const CHANNEL_NAME: Record<string, string> = { card: "Card", bank_transfer: "Transfer", ussd: "USSD", bank: "Bank" };

function headline(r: ReservationDetail) {
  const o = r.online!;
  if (o.paymentMode === "PAY_AT_HOTEL") return r.status === "CANCELLED" ? "Pay at hotel, cancelled" : "Pays at the hotel";
  const paid = o.payments.some((p) => ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(p.status));
  if (!paid) return r.status === "CANCELLED" ? "Never paid, released" : "Paying online";
  if (o.payments.every((p) => p.status === "REFUNDED" || p.status === "FAILED" || p.status === "INITIALIZED")) return "Paid online, refunded";
  if (o.payments.some((p) => p.status === "PARTIALLY_REFUNDED")) return "Paid online, partly refunded";
  return "Paid online";
}

/** The online half of a booking: channel, how it was paid, commission, refunds, contact. */
export function OnlineBookingCard({ r }: { r: ReservationDetail }) {
  const o = r.online!;
  const meta = CHANNEL_META[o.channel];
  return (
    <Panel className="overflow-hidden" data-testid="online-card">
      <div className="relative border-b border-line px-5 py-4" style={{ background: `color-mix(in oklab, ${meta.wash} 45%, transparent)` }}>
        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: meta.color }} />
        <div className="flex items-center justify-between gap-3">
          <p className="eyebrow">Booked online</p>
          <ChannelBadge source={o.channel} size="sm" />
        </div>
        <p className="display-sm mt-1.5 text-[19px] leading-tight text-ink">
          {headline(r)}
        </p>
        <p className="mt-0.5 text-[12.5px] text-ink-muted">
          Quoted <span className="font-mono text-ink">{naira(o.quotedTotalKobo)}</span>
          {o.channel === "MARKETPLACE" ? `, ${o.commissionBps / 100}% commission` : ", no commission"}
        </p>
      </div>

      {o.payments.length > 0 && (
        <ul className="divide-y divide-line border-b border-line">
          {o.payments.map((p) => {
            const m = PAY[p.status] ?? PAY.INITIALIZED;
            const I = m.icon;
            return (
              <li key={p.id} className="flex items-start gap-3 px-5 py-3">
                <CreditCard size={16} weight="duotone" className="mt-0.5 shrink-0 text-ink-muted" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[14px] text-ink">{naira(p.amountKobo)}</span>
                    <span className="inline-flex items-center gap-1 text-[12px] font-medium" style={{ color: m.color }}>
                      <I size={12} weight="fill" /> {m.label}
                    </span>
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-ink-faint" title={p.reference}>
                    {p.channel ? `${CHANNEL_NAME[p.channel] ?? p.channel} · ` : ""}
                    {p.reference}
                  </p>
                  {p.paidAt && <p className="text-[11.5px] text-ink-muted">{formatDateTime(p.paidAt)}</p>}
                  {p.commissionKobo > 0 && (
                    <p className="text-[11.5px] text-ink-muted">
                      {naira(p.commissionKobo)} commission {["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED"].includes(p.status) ? "taken at the split" : "to be taken at the split"}
                    </p>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {o.refunds.length > 0 && (
        <ul className="divide-y divide-line border-b border-line">
          {o.refunds.map((f) => (
            <li key={f.id} className="flex items-baseline gap-3 px-5 py-2.5 text-[12.5px]">
              <ArrowCounterClockwise size={13} className="shrink-0 self-center text-ink-muted" />
              <span className="text-ink">{REFUND_WHY[f.reason] ?? f.reason}</span>
              <span className="ml-auto font-mono text-ink">&minus;{naira(f.amountKobo)}</span>
              <span className="w-14 text-right text-[11.5px]" style={{ color: REFUND[f.status].color }}>
                {REFUND[f.status].label}
              </span>
            </li>
          ))}
        </ul>
      )}

      <dl className="divide-y divide-line px-5 py-1 text-[13px]">
        {(o.commission.collectedKobo > 0 || o.commission.accruedKobo > 0 || o.commission.reversedKobo > 0) && (
          <div className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="text-ink-muted">Commission</dt>
            <dd className="text-right font-mono text-ink">
              {naira(o.commission.netKobo)}
              <span className="block text-[11px] text-ink-muted">
                {o.commission.accruedKobo > 0 ? "invoiced monthly" : "taken at payment"}
                {o.commission.reversedKobo > 0 ? `, ${naira(o.commission.reversedKobo)} reversed` : ""}
              </span>
            </dd>
          </div>
        )}
        <div className="flex items-baseline justify-between gap-4 py-1.5">
          <dt className="text-ink-muted">Contact</dt>
          <dd className="min-w-0 text-right">
            <span className="block font-mono text-ink">{formatPhone(o.contact.phone)}</span>
            {o.contact.email && <span className="block break-all text-[12px] text-ink-muted">{o.contact.email}</span>}
          </dd>
        </div>
        {o.guestAccountLinked && (
          <div className="flex items-center gap-1.5 py-1.5 text-[12.5px] text-ink-muted">
            <UserCircleCheck size={14} className="text-palm" /> Signed-in guest account; sees this in their trips
          </div>
        )}
        {o.cancelledBy && (
          <div className="flex items-baseline justify-between gap-4 py-1.5">
            <dt className="text-ink-muted">Cancelled by</dt>
            <dd className="text-ink">
              {o.cancelledBy === "GUEST" ? "the guest" : o.cancelledBy === "HOTEL" ? "the hotel" : "the system (hold lapsed)"}
              {o.cancellationFeeKobo ? <span className="block font-mono text-[11.5px] text-ink-muted">fee {naira(o.cancellationFeeKobo)}</span> : null}
            </dd>
          </div>
        )}
      </dl>
      {o.specialRequests && (
        <div className="border-t border-line px-5 py-3">
          <p className="eyebrow mb-1 text-[10px]">Special requests</p>
          <p className={cn("text-[13px] italic leading-relaxed text-ink")}>&ldquo;{o.specialRequests}&rdquo;</p>
        </div>
      )}
    </Panel>
  );
}
