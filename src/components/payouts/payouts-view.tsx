"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bank as BankIcon,
  CaretLeft,
  CaretRight,
  CheckCircle,
  Clock,
  Globe,
  Info,
  LockSimple,
  PencilSimple,
  SealCheck,
  Storefront,
  WarningCircle,
} from "@phosphor-icons/react";
import { useBanks, useBookingConfig, useBookingSettings, usePayoutAccount, usePayoutSummary, usePayoutTransactions, qk3 } from "@/lib/api/hooks-m3";
import { payoutsApi } from "@/lib/api/endpoints-m3";
import type { BookingPaymentStatus, PayoutAccount, ResolvedAccount } from "@/lib/api/types-m3";
import { useMe } from "@/lib/api/hooks";
import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/store";
import { formatDate, naira, number } from "@/lib/format";
import { addDays, todayKey } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { errorMessage, isApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/form";
import { EmptyState, ErrorState, PageHeader, Panel, PanelHeader, Segmented, Skeleton } from "@/components/ui/primitives";
import { Spinner } from "@/components/ui/button";
import { ChannelBadge } from "@/components/m3/bits";
import { BankPicker } from "./bank-picker";

type Period = "30d" | "month" | "90d";
const PERIODS: { value: Period; label: string }[] = [
  { value: "30d", label: "30 days" },
  { value: "month", label: "This month" },
  { value: "90d", label: "90 days" },
];
function periodRange(p: Period) {
  const t = todayKey();
  if (p === "month") return { from: `${t.slice(0, 8)}01`, to: t };
  return { from: addDays(t, p === "30d" ? -29 : -89), to: t };
}

export function PayoutsView() {
  const { can } = useCan();
  const account = usePayoutAccount();
  const settings = useBookingSettings();
  const cfg = useBookingConfig();
  const mock = (account.data?.provider ?? cfg.data?.paymentProvider) === "mock";
  const [editing, setEditing] = useState(false);
  const [period, setPeriod] = useState<Period>("30d");
  const { from, to } = periodRange(period);
  const summary = usePayoutSummary(from, to);
  const owner = can("payouts.manage");
  const sub = account.data ?? null;
  const bps = settings.data ? settings.data.commissionBps : null;

  return (
    <>
      <PageHeader
        eyebrow="Money"
        title={
          <>
            Pay<em>outs</em>
          </>
        }
        description="Where the money from online bookings lands, and what the platform keeps. Payments are split the moment a guest pays: your share goes straight to your bank."
      />

      {account.isError ? (
        <Panel className="mb-6">
          <ErrorState error={account.error} onRetry={() => account.refetch()} />
        </Panel>
      ) : account.isLoading ? (
        <Skeleton className="mb-6 h-64 w-full" />
      ) : (
        <div className="mb-8 grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            {sub && !editing ? (
              <AccountCard account={sub} mock={mock} online={settings.data?.onlineBookingEnabled} owner={owner} onChange={() => setEditing(true)} />
            ) : owner ? (
              <Onboarding current={sub} mock={mock} onDone={() => setEditing(false)} onCancel={sub ? () => setEditing(false) : undefined} />
            ) : (
              <Panel className="px-5 py-6">
                <div className="flex items-start gap-3">
                  <LockSimple size={20} weight="duotone" className="mt-0.5 text-brass" />
                  <div>
                    <h2 className="display-sm text-[19px] text-ink">No payout account yet</h2>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-ink-muted">
                      Only the owner can add the hotel&rsquo;s bank account. Until then, online guests can only choose to pay at the hotel.
                    </p>
                  </div>
                </div>
              </Panel>
            )}
          </div>
          <div className="lg:col-span-5">
            <CommissionExplainer bps={bps} listed={settings.data?.marketplaceListed ?? true} />
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-1">Online revenue</p>
          <h2 className="display-sm text-[24px] leading-tight text-ink">
            {formatDate(from, { day: "numeric", month: "short", year: undefined })} to {formatDate(to, { day: "numeric", month: "short" })}
          </h2>
        </div>
        <Segmented<Period> label="Period" value={period} onChange={setPeriod} options={PERIODS} size="sm" />
      </div>

      <Panel className="mb-6 grid grid-cols-2 md:grid-cols-4 [&>*]:border-line max-md:[&>*:nth-child(-n+2)]:border-b max-md:[&>*:nth-child(odd)]:border-r md:[&>*:not(:first-child)]:border-l">
        <Figure label="Paid online" value={summary.data ? naira(summary.data.onlineRevenueKobo) : null} sub={summary.data ? `${number(summary.data.bookings)} online ${summary.data.bookings === 1 ? "booking" : "bookings"}` : ""} />
        <Figure label="Commission" value={summary.data ? naira(summary.data.commissionKobo) : null} sub="kept at the split, net of refunds" muted />
        <Figure label="Paid to you" value={summary.data ? naira(summary.data.netToHotelKobo) : null} sub="settled to your bank" accent />
        <Figure label="Refunded" value={summary.data ? naira(summary.data.refundsKobo) : null} sub="to guests who cancelled" muted />
      </Panel>

      {summary.data && (summary.data.payAtHotelBookings > 0 || summary.data.commissionAccruedKobo > 0) && (
        <Panel className="mb-6 flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
          <ChannelBadge source="MARKETPLACE" size="sm" />
          <p className="text-[13px] text-ink">
            <span className="font-mono">{summary.data.payAtHotelBookings}</span> pay-at-hotel {summary.data.payAtHotelBookings === 1 ? "booking" : "bookings"} in the period.
          </p>
          <p className="text-[13px] text-ink-muted">
            Commission on marketplace ones, <span className="font-mono text-ink">{naira(summary.data.commissionAccruedKobo)}</span>, is invoiced to you monthly.
          </p>
        </Panel>
      )}

      <PaymentsTable from={from} to={to} />
    </>
  );
}

function Figure({ label, value, sub, accent, muted }: { label: string; value: string | null; sub: string; accent?: boolean; muted?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-1.5 px-5 py-4">
      <span className="display-sm text-[14px] italic text-ink-muted">{label}</span>
      {value === null ? (
        <Skeleton className="h-8 w-28" />
      ) : (
        <span className={cn("font-mono text-[24px] leading-none tracking-tight md:text-[28px]", accent ? "text-laterite" : muted ? "text-ink-muted" : "text-ink")}>{value}</span>
      )}
      <span className="truncate text-[12px] text-ink-muted">{sub}</span>
    </div>
  );
}

/* ---------------- the account, once set up ---------------- */

function AccountCard({ account: s, mock, online, owner, onChange }: { account: PayoutAccount; mock: boolean; online?: boolean; owner: boolean; onChange: () => void }) {
  return (
    <Panel className="relative h-full overflow-hidden" data-testid="payout-account">
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
        <div>
          <p className="eyebrow mb-1">Payout account</p>
          <h2 className="display-sm text-[20px] leading-tight text-ink">Online payments settle here</h2>
        </div>
        {owner && (
          <Button size="sm" variant="ghost" onClick={onChange}>
            <PencilSimple size={14} /> Change
          </Button>
        )}
      </div>
      <div className="grid gap-5 px-5 py-5 sm:grid-cols-[1fr_auto]">
        {/* the account as a pay-in slip */}
        <div className="relative rounded-md border border-line-strong bg-paper/60 px-4 py-4">
          <span aria-hidden className="absolute inset-y-3 left-0 w-[3px] rounded-r-xs bg-brass" />
          <p className="flex items-center gap-2 text-[13px] text-ink-muted">
            <BankIcon size={16} weight="duotone" /> {s.bankName}
          </p>
          <p className="mt-2 font-mono text-[22px] tracking-[0.12em] text-ink">{s.accountNumberMasked}</p>
          <p className="mt-1 text-[14px] font-medium uppercase tracking-wide text-ink">{s.accountName}</p>
          <p className="mt-3 font-mono text-[11px] text-ink-faint">
            Paystack subaccount <span className="text-ink-muted">{s.subaccountCode}</span>
          </p>
        </div>
        <dl className="flex flex-col gap-3 text-[13px] sm:min-w-[180px]">
          <div>
            <dt className="text-ink-muted">Status</dt>
            <dd className="mt-0.5">
              {s.settlementVerified ? (
                <span className="inline-flex items-center gap-1.5 font-medium text-palm">
                  <SealCheck size={15} weight="fill" /> Verified
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-medium text-ochre">
                  <Clock size={15} weight="duotone" /> Awaiting first settlement
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-ink-muted">Online payments</dt>
            <dd className="mt-0.5 text-ink">{online === false ? "Online booking is off" : "Ready"}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Added</dt>
            <dd className="mt-0.5 font-mono text-ink">{formatDate(s.createdAt)}</dd>
          </div>
        </dl>
      </div>
      {mock && <DevNote />}
    </Panel>
  );
}

function DevNote() {
  return (
    <p className="flex items-center gap-2 border-t border-dashed border-line-strong bg-surface-2/40 px-5 py-2.5 font-mono text-[11px] text-ink-muted">
      <Info size={13} /> Development: banks, name checks and the subaccount are mocked. No money moves.
    </p>
  );
}

/* ---------------- onboarding ---------------- */

function Onboarding({ current, mock, onDone, onCancel }: { current: PayoutAccount | null; mock: boolean; onDone: () => void; onCancel?: () => void }) {
  const qc = useQueryClient();
  const me = useMe();
  const banks = useBanks();
  const [bank, setBank] = useState<string | null>(null);
  const [acct, setAcct] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const ready = !!bank && acct.length === 10;
  const resolve = useQuery({
    queryKey: ["payouts", "resolve", bank, acct],
    queryFn: () => payoutsApi.resolve(bank!, acct),
    enabled: ready,
    retry: false,
    staleTime: 10 * 60_000,
  });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new name must be confirmed again
    setConfirmed(false);
  }, [bank, acct]);
  const save = useMutation({
    mutationFn: () => payoutsApi.saveAccount(bank!, acct, me.data?.tenant.name),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk3.payouts });
      await qc.invalidateQueries({ queryKey: qk3.bookingSettings });
      toast.success("Payout account saved", "Online payments now settle to this account.");
      onDone();
    },
    meta: { errorTitle: "Account not saved" },
  });
  const bankName = useMemo(() => banks.data?.find((b) => b.code === bank)?.name, [banks.data, bank]);
  const step = !bank ? 1 : acct.length < 10 ? 2 : !resolve.data ? 2 : confirmed ? 4 : 3;

  return (
    <Panel data-testid="payout-onboarding">
      <PanelHeader
        eyebrow={current ? "Change payout account" : "Set up payouts"}
        title="Where should we send your money?"
        description="A Nigerian current account in the hotel's or the owner's name. We check the name with the bank before saving."
        actions={
          onCancel && (
            <Button size="sm" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )
        }
      />
      <ol className="flex flex-col px-5 py-5">
        <Step n={1} done={step > 1} title="Bank">
          <BankPicker id="payout-bank" banks={banks.data ?? []} loading={banks.isLoading} value={bank} onChange={setBank} />
          {banks.isError && <p className="mt-1.5 text-[12.5px] text-danger">{errorMessage(banks.error)}</p>}
        </Step>
        <Step n={2} done={step > 2} title="Account number" active={!!bank}>
          <div className="flex items-stretch overflow-hidden rounded-md border border-line-strong bg-surface transition-[border-color,box-shadow] focus-within:border-laterite focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--laterite)_18%,transparent)]">
            <input
              id="payout-account"
              aria-label="Account number"
              inputMode="numeric"
              autoComplete="off"
              placeholder="0123456789"
              value={acct}
              disabled={!bank}
              onChange={(e) => setAcct(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="h-11 min-w-0 flex-1 bg-transparent px-3 font-mono text-[18px] tracking-[0.18em] text-ink outline-none placeholder:text-ink-faint/60 disabled:opacity-50"
            />
            <span className="flex items-center border-l border-line bg-surface-2/60 px-3 font-mono text-[12px] text-ink-muted">{acct.length}/10</span>
          </div>
          <p className="mt-1.5 text-[12.5px] text-ink-muted">The 10-digit NUBAN on your statement.</p>
        </Step>
        <Step n={3} done={step > 3} title="Confirm the name" active={ready} last>
          {!ready ? (
            <p className="text-[13px] text-ink-faint">We&rsquo;ll look the name up as soon as the number is complete.</p>
          ) : resolve.isFetching && !resolve.data ? (
            <p className="flex items-center gap-2 text-[13px] text-ink-muted">
              <Spinner /> Asking {bankName ?? "the bank"} who owns this account
            </p>
          ) : resolve.isError ? (
            <p className="flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-wash px-3 py-2.5 text-[13px] text-ink" role="alert">
              <WarningCircle size={16} weight="duotone" className="mt-px shrink-0 text-danger" />
              {isApiError(resolve.error) && resolve.error.status < 500
                ? "That number doesn't match an account at this bank. Check the bank and the 10 digits, then try again."
                : errorMessage(resolve.error)}
            </p>
          ) : resolve.data ? (
            <ResolvedName r={resolve.data} bankName={bankName} confirmed={confirmed} onConfirm={setConfirmed} />
          ) : null}
        </Step>
      </ol>
      <div className="flex flex-wrap items-center gap-3 border-t border-line bg-surface-2/40 px-5 py-3.5">
        <Button onClick={() => save.mutate()} disabled={!confirmed || !resolve.data} loading={save.isPending} data-testid="save-payout">
          Save payout account <ArrowRight size={14} weight="bold" />
        </Button>
        <p className="text-[12.5px] text-ink-muted">You can change it later. Payments already in flight still settle to the old account.</p>
      </div>
      {mock && <DevNote />}
    </Panel>
  );
}

function Step({ n, title, done, active = true, last, children }: { n: number; title: string; done: boolean; active?: boolean; last?: boolean; children: React.ReactNode }) {
  return (
    <li className={cn("relative flex gap-4 pb-6", last && "pb-0", !active && "opacity-55")}>
      {!last && <span aria-hidden className="absolute bottom-0 left-[13px] top-8 w-px bg-line" />}
      <span
        className={cn(
          "relative z-[1] grid h-7 w-7 shrink-0 place-items-center rounded-full border font-mono text-[12px]",
          done ? "border-palm bg-palm text-paper" : "border-line-strong bg-surface text-ink-muted",
        )}
        aria-hidden
      >
        {done ? <CheckCircle size={16} weight="fill" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="mb-2 mt-1 text-[13.5px] font-medium text-ink">{title}</p>
        {children}
      </div>
    </li>
  );
}

function ResolvedName({ r, bankName, confirmed, onConfirm }: { r: ResolvedAccount; bankName?: string; confirmed: boolean; onConfirm: (v: boolean) => void }) {
  return (
    <div className={cn("rounded-md border px-4 py-3.5 transition-colors", confirmed ? "border-palm bg-palm-wash/60" : "border-line-strong bg-paper/60")}>
      <p className="text-[12px] text-ink-muted">
        {bankName ?? "The bank"} says <span className="font-mono">{r.accountNumber}</span> belongs to
      </p>
      <p className="display-sm mt-1 text-[22px] uppercase leading-tight tracking-wide text-ink" data-testid="resolved-name">
        {r.accountName}
      </p>
      <div className="mt-3">
        <Checkbox checked={confirmed} onChange={onConfirm} label="Yes, this is the hotel's account" />
      </div>
    </div>
  );
}

/* ---------------- commission, in plain words ---------------- */

const TX_STATUS: Partial<Record<BookingPaymentStatus, string>> = {
  INITIALIZED: "Not paid yet",
  FAILED: "Payment failed",
  ORPHANED: "Paid late, refunded",
  PARTIALLY_REFUNDED: "Partly refunded",
  REFUNDED: "Refunded",
};

function CommissionExplainer({ bps, listed }: { bps: number | null; listed: boolean }) {
  const pct = bps == null ? null : bps / 100;
  const sample = 10_000_000; // ₦100,000
  const cut = bps == null ? 0 : Math.round((sample * bps) / 10000);
  return (
    <Panel className="h-full">
      <PanelHeader eyebrow="How commission works" title="Two doors, two prices" />
      <div className="flex flex-col gap-5 px-5 py-5">
        <Door
          icon={<Storefront size={18} weight="duotone" />}
          badge={<ChannelBadge source="MARKETPLACE" size="sm" />}
          title={pct == null ? "Commission" : pct === 0 ? "No commission on your plan" : `${pct}% commission`}
          body={
            <>
              Guests who find you on the marketplace. The commission on your plan comes off the room and tax total, split out the moment they pay. If they pay at
              the hotel instead, it is invoiced to you monthly.
            </>
          }
          split={bps == null ? null : { total: sample, cut }}
          muted={!listed}
          note={!listed ? "You are not listed on the marketplace, so none of your bookings come through this door." : undefined}
        />
        <Door
          icon={<Globe size={18} weight="duotone" />}
          badge={<ChannelBadge source="BOOKING_SITE" size="sm" />}
          title="No commission"
          body={<>Guests who book on your own booking site (your subdomain or domain). Everything they pay is yours.</>}
          split={{ total: sample, cut: 0 }}
        />
        <p className="text-[12px] text-ink-muted">
          Commission is never charged on extras, deposits taken at the desk, or anything paid in cash. Refunds give back the commission in proportion.{" "}
          <Link href="/billing" className="text-laterite underline-offset-4 hover:underline">
            Your plan
          </Link>
        </p>
      </div>
    </Panel>
  );
}

function Door({
  icon,
  badge,
  title,
  body,
  split,
  muted,
  note,
}: {
  icon: React.ReactNode;
  badge: React.ReactNode;
  title: string;
  body: React.ReactNode;
  split: { total: number; cut: number } | null;
  muted?: boolean;
  note?: string;
}) {
  return (
    <div className={cn(muted && "opacity-60")}>
      <div className="flex items-center gap-2">
        <span className="text-ink-muted">{icon}</span>
        {badge}
        <span className="ml-auto font-mono text-[13px] text-ink">{title}</span>
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{body}</p>
      {note && <p className="mt-1 text-[12.5px] text-ink">{note}</p>}
      {split && (
        <div className="mt-2.5">
          <div className="flex h-2 gap-[2px] overflow-hidden rounded-xs" aria-hidden>
            <span className="bg-palm" style={{ flex: split.total - split.cut, opacity: 0.8 }} />
            {split.cut > 0 && <span className="hatch bg-brass-wash text-brass" style={{ flex: split.cut }} />}
          </div>
          <p className="mt-1.5 flex justify-between font-mono text-[11.5px] text-ink-muted">
            <span>
              On {naira(split.total)}: <span className="text-palm">{naira(split.total - split.cut)} to you</span>
            </span>
            {split.cut > 0 && <span className="text-ink-muted">{naira(split.cut)} commission</span>}
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------------- per-booking table ---------------- */

function PaymentsTable({ from, to }: { from: string; to: string }) {
  const [page, setPage] = useState(1);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- back to page one when the period changes
    setPage(1);
  }, [from, to]);
  const q = usePayoutTransactions({ from, to, page, pageSize: 20 });
  const pages = Math.max(1, Math.ceil((q.data?.total ?? 0) / 20));
  return (
    <Panel className="overflow-hidden">
      <PanelHeader eyebrow="Per booking" title="Online payments and commission" description="Every online payment in the period: what the guest paid, what came off, what reached you." />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <div className="flex flex-col gap-3 p-5">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : !q.data?.items.length ? (
        <EmptyState compact glyph="dots" title="No online payments in this period" body="When a guest pays online, the payment and its commission show here." />
      ) : (
        <>
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13.5px]" data-testid="payments-table">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="eyebrow py-3 pl-5 text-[10px] font-normal">Paid</th>
                  <th className="eyebrow py-3 text-[10px] font-normal">Booking</th>
                  <th className="eyebrow py-3 text-[10px] font-normal">Channel</th>
                  <th className="eyebrow py-3 pr-4 text-right text-[10px] font-normal">Guest paid</th>
                  <th className="eyebrow py-3 pr-4 text-right text-[10px] font-normal">Commission</th>
                  <th className="eyebrow py-3 pr-5 text-right text-[10px] font-normal">To you</th>
                </tr>
              </thead>
              <tbody>
                {q.data.items.map((p) => (
                  <tr key={p.paymentId} className="border-b border-line last:border-0">
                    <td className="py-3 pl-5 font-mono text-[12.5px] text-ink-muted">{formatDate(p.paidAt, { day: "numeric", month: "short", year: undefined })}</td>
                    <td className="py-3 pr-3">
                      <Link href={`/reservations/${p.reservationId}`} className="font-mono text-[13px] tracking-wide text-ink hover:text-laterite">
                        {p.reservationCode}
                      </Link>
                      <span className="block truncate text-[12px] text-ink-muted">{p.guestName}</span>
                    </td>
                    <td className="py-3 pr-3">
                      <ChannelBadge source={p.channel} size="sm" />
                      {p.status !== "SUCCEEDED" && <span className="mt-1 block text-[11.5px] text-ink-muted">{TX_STATUS[p.status] ?? p.status}</span>}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono text-ink">
                      {naira(p.amountKobo)}
                      {p.refundedKobo > 0 && <span className="block text-[11px] text-ink-muted">&minus;{naira(p.refundedKobo)} refunded</span>}
                    </td>
                    <td className="py-3 pr-4 text-right font-mono">
                      {p.commissionKobo ? (
                        <>
                          <span className="text-ink-muted">&minus;{naira(p.commissionKobo)}</span>
                          <span className="block text-[11px] text-ink-faint">
                            {p.commissionBps / 100}%{p.commissionReversedKobo > 0 ? `, ${naira(p.commissionReversedKobo)} back` : ""}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-faint">none</span>
                      )}
                    </td>
                    <td className="py-3 pr-5 text-right font-mono text-ink">{naira(p.netKobo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3">
              <span className="font-mono text-[12px] text-ink-muted">
                {page} / {pages}
              </span>
              <Button size="icon-sm" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                <CaretLeft size={13} />
              </Button>
              <Button size="icon-sm" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                <CaretRight size={13} />
              </Button>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}
