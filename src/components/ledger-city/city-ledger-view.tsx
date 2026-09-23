"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Coins, Printer, Tag, Warning } from "@phosphor-icons/react";
import { useCityLedgerInvoices, useCityLedgerSummary } from "@/lib/api/hooks-m4";
import { cityLedgerApi } from "@/lib/api/endpoints-m4";
import type { AgingBucket, CityLedgerInvoice, LedgerPaymentMethod } from "@/lib/api/types-m4";
import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/store";
import { formatDay, todayKey } from "@/lib/dates";
import { naira, nairaCompact, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, Input, Textarea } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, PanelHeader, Skeleton, Stat } from "@/components/ui/primitives";
import { ChipRadio, NairaInput } from "@/components/m2/bits";
import { Th } from "@/components/ui/table";
import { AgingBar, AgingStrip, BUCKETS, CreditMeter } from "./aging";

const STATUS: Record<CityLedgerInvoice["status"], { label: string; tone: "ochre" | "brass" | "palm" | "neutral" }> = {
  OPEN: { label: "Open", tone: "ochre" },
  PARTIALLY_PAID: { label: "Part paid", tone: "brass" },
  PAID: { label: "Paid", tone: "palm" },
  VOID: { label: "Void", tone: "neutral" },
};
export const LEDGER_METHODS: { value: LedgerPaymentMethod; label: string }[] = [
  { value: "TRANSFER", label: "Transfer" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "POS", label: "POS" },
  { value: "CASH", label: "Cash" },
];

export function CityLedgerView() {
  const sum = useCityLedgerSummary();
  const [bucket, setBucket] = useState<AgingBucket | "">("");
  const [status, setStatus] = useState("OPEN,PARTIALLY_PAID");
  const inv = useCityLedgerInvoices({ status: status || undefined, bucket: bucket || undefined, pageSize: 100 });
  const [paying, setPaying] = useState<CityLedgerInvoice | null>(null);
  const [reminding, setReminding] = useState<CityLedgerInvoice | null>(null);
  const { can } = useCan();
  const s = sum.data;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Tag size={14} weight="duotone" /> City Ledger
          </>
        }
        title={
          <>
            What the companies <em>owe the house</em>.
          </>
        }
        description="Stays checked out to a company account, the statements they were sent and how old each naira is. The older the debt, the stronger its colour."
        actions={
          <ButtonLink href="/corporate" variant="secondary">
            Corporate accounts
          </ButtonLink>
        }
      />
      <Panel className="mb-6">
        {sum.isError ? (
          <ErrorState error={sum.error} onRetry={() => sum.refetch()} />
        ) : !s ? (
          <div className="p-5">
            <Skeleton className="h-32" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-6 border-b border-line p-5 md:grid-cols-3">
              <Stat label="Outstanding" value={nairaCompact(s.outstandingKobo)} sub={`${naira(s.uninvoicedKobo)} not yet invoiced`} />
              <Stat label="Overdue" value={<span className={s.overdueKobo ? "text-laterite" : undefined}>{nairaCompact(s.overdueKobo)}</span>} sub="past the payment terms" />
              <Stat label="Accounts" value={s.accounts.length} sub={`${s.accounts.filter((a) => a.overLimit).length} over their limit`} />
            </div>
            <div className="p-5">
              <p className="eyebrow mb-3">By age, since the statement was issued</p>
              <AgingBar buckets={s.aging} />
              <div className="mt-3 flex flex-wrap gap-1.5" role="group" aria-label="Filter by age">
                <button type="button" onClick={() => setBucket("")} className={cn("h-7 rounded-full border px-2.5 text-[12px]", !bucket ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}>
                  Every age
                </button>
                {BUCKETS.map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => setBucket(b.key)}
                    className={cn("inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12px]", bucket === b.key ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}
                  >
                    <span className="h-2 w-2 rounded-[2px]" style={{ background: b.shade }} /> {b.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </Panel>

      <div className="flex flex-col gap-6">
        <Panel className="order-2 overflow-hidden">
          <PanelHeader
            eyebrow="Statements and invoices"
            title="Who to chase"
            actions={
              <ChipRadio
                label="Status"
                value={status}
                onChange={setStatus}
                options={[
                  { value: "OPEN,PARTIALLY_PAID", label: "Unpaid" },
                  { value: "PAID", label: "Paid" },
                  { value: "", label: "All" },
                ]}
              />
            }
          />
          {inv.isError ? (
            <ErrorState error={inv.error} onRetry={() => inv.refetch()} />
          ) : !inv.data ? (
            <div className="p-5">
              <Skeleton className="h-48" />
            </div>
          ) : !inv.data.items.length ? (
            <EmptyState compact glyph="dots" title="Nothing owed here" body="Every statement in this view is settled." />
          ) : (
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-[13px]">
                <thead>
                  <tr className="border-b border-line text-ink-muted">
                    <Th className="pl-5">Number</Th>
                    <Th>Company</Th>
                    <Th>Due</Th>
                    <Th className="text-right">Balance</Th>
                    <Th>Status</Th>
                    <Th className="pr-5 text-right">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {inv.data.items.map((i) => {
                    const b = BUCKETS.find((x) => x.key === i.bucket)!;
                    return (
                      <tr key={i.id} className="border-b border-line last:border-b-0 hover:bg-surface-2/40" data-testid={`cl-${i.number}`}>
                        <td className="py-3 pl-5">
                          <span className="flex items-center gap-2">
                            <span className="h-6 w-1 rounded-full" style={{ background: b.shade }} title={b.label} />
                            <span className="whitespace-nowrap font-mono text-[12.5px] text-ink">{i.number}</span>
                          </span>
                        </td>
                        <td className="py-3 text-ink">
                          <Link href={`/corporate?open=${i.account.id}`} className="hover:text-laterite">
                            {i.account.name}
                          </Link>
                          <span className="block text-[11.5px] text-ink-faint">{i.kind === "PER_STAY" ? "Per stay" : "Monthly statement"}</span>
                        </td>
                        <td className="py-3">
                          <span className={cn("text-[12.5px]", i.overdue ? "text-laterite" : "text-ink-muted")}>{formatDay(i.dueDate, { day: "numeric", month: "short" })}</span>
                          <span className="block font-mono text-[11px] text-ink-faint">{i.daysOutstanding} days</span>
                        </td>
                        <td className="py-3 text-right font-mono text-ink">
                          {naira(i.balanceKobo)}
                          {i.paidKobo > 0 && i.balanceKobo > 0 && <span className="block text-[11px] text-ink-faint">of {naira(i.totalKobo)}</span>}
                        </td>
                        <td className="py-3">
                          <Badge tone={STATUS[i.status].tone}>{STATUS[i.status].label}</Badge>
                          {i.remindersSent > 0 && <span className="mt-0.5 block text-[11px] text-ink-faint">reminded {relativeTime(i.lastReminderAt)}</span>}
                        </td>
                        <td className="py-3 pr-5">
                          <span className="flex justify-end gap-1">
                            <ButtonLink href={`/print/statement/${i.id}`} variant="ghost" size="icon-sm" aria-label={`Print ${i.number}`}>
                              <Printer size={15} />
                            </ButtonLink>
                            {i.balanceKobo > 0 && can("corporate.manage") && (
                              <Button variant="ghost" size="icon-sm" aria-label={`Send a reminder for ${i.number}`} onClick={() => setReminding(i)}>
                                <Bell size={15} />
                              </Button>
                            )}
                            {i.balanceKobo > 0 && can("payments.take") && (
                              <Button variant="secondary" size="sm" onClick={() => setPaying(i)}>
                                <Coins size={13} /> Payment
                              </Button>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel className="order-1">
          <PanelHeader eyebrow="Accounts" title="Credit in use" />
          {!s ? (
            <div className="p-5">
              <Skeleton className="h-24" />
            </div>
          ) : (
            <ul className="grid divide-y divide-line md:grid-cols-3 md:divide-x md:divide-y-0">

              {[...s.accounts].sort((a, b) => b.outstandingKobo - a.outstandingKobo).map((a) => (
                <li key={a.id} className="px-5 py-3.5">
                  <div className="flex items-baseline gap-2">
                    <Link href={`/corporate?open=${a.id}`} className="min-w-0 flex-1 truncate text-[13.5px] text-ink hover:text-laterite">
                      {a.name}
                    </Link>
                    {a.overLimit && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-danger">
                        <Warning size={11} weight="fill" /> over limit
                      </span>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-4">
                    <CreditMeter usedKobo={a.outstandingKobo} limitKobo={a.creditLimitKobo} />
                    <AgingStrip buckets={a.aging} width={80} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <PaymentDialog invoice={paying} onOpenChange={(o) => !o && setPaying(null)} />
      <ReminderDialog invoice={reminding} onOpenChange={(o) => !o && setReminding(null)} />
    </>
  );
}

export function PaymentDialog({ invoice, onOpenChange }: { invoice: CityLedgerInvoice | null; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState<number | null>(null);
  const [method, setMethod] = useState<LedgerPaymentMethod>("TRANSFER");
  const [ref, setRef] = useState("");
  const [date, setDate] = useState(todayKey());
  const [key, setKey] = useState("");
  if (invoice && invoice.id !== key) {
    setKey(invoice.id);
    setAmount(invoice.balanceKobo);
  }
  const m = useMutation({
    mutationFn: () => cityLedgerApi.payInvoice(invoice!.id, { amountKobo: amount!, method, reference: ref.trim() || undefined, receivedAt: new Date(`${date}T12:00:00+01:00`).toISOString() }),
    onSuccess: async (d) => {
      await Promise.all([qc.invalidateQueries({ queryKey: ["city-ledger"] }), qc.invalidateQueries({ queryKey: ["corporate"] })]);
      toast.success(`${naira(amount)} recorded against ${d.number}`, d.balanceKobo > 0 ? `${naira(d.balanceKobo)} still due.` : "Settled in full.");
      setRef("");
      onOpenChange(false);
    },
    meta: { errorTitle: "Payment not recorded" },
  });
  const over = !!invoice && !!amount && amount > invoice.balanceKobo;
  return (
    <Dialog
      open={!!invoice}
      onOpenChange={onOpenChange}
      eyebrow={invoice?.number}
      title={`Payment from ${invoice?.account.name ?? ""}`}
      description={invoice ? `${naira(invoice.balanceKobo)} due on this ${invoice.kind === "PER_STAY" ? "invoice" : "statement"}.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!amount || over} loading={m.isPending} onClick={() => m.mutate()}>
            Record {amount ? naira(amount) : "payment"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Amount received" htmlFor="clp-amt" error={over ? "More than the balance. Record the rest against another statement." : null}>
          <NairaInput id="clp-amt" kobo={amount} onChange={setAmount} large />
        </Field>
        <ChipRadio label="Method" value={method} onChange={setMethod} options={LEDGER_METHODS} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Reference" htmlFor="clp-ref" optional hint="Transfer or cheque number">
            <Input id="clp-ref" value={ref} onChange={(e) => setRef(e.target.value)} className="font-mono" />
          </Field>
          <Field label="Received" htmlFor="clp-date">
            <Input id="clp-date" type="date" max={todayKey()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="font-mono" />
          </Field>
        </div>
      </div>
    </Dialog>
  );
}

function ReminderDialog({ invoice, onOpenChange }: { invoice: CityLedgerInvoice | null; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [msg, setMsg] = useState("");
  const m = useMutation({
    mutationFn: () => cityLedgerApi.remind(invoice!.id, msg.trim() || undefined),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["city-ledger"] });
      toast.success("Reminder sent", `To ${r.sentTo}, with the statement and balance.`);
      setMsg("");
      onOpenChange(false);
    },
    meta: { errorTitle: "Reminder not sent" },
  });
  return (
    <Dialog
      open={!!invoice}
      onOpenChange={onOpenChange}
      eyebrow={invoice?.number}
      title={`Remind ${invoice?.account.name ?? ""}`}
      description={invoice ? `An email to their accounts contact with the statement and ${naira(invoice.balanceKobo)} due${invoice.overdue ? `, ${invoice.daysOutstanding} days after it was issued` : ""}. Automatic reminders also go at 1, 15 and 30 days overdue.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button loading={m.isPending} onClick={() => m.mutate()}>
            <Bell size={14} /> Send reminder
          </Button>
        </>
      }
    >
      <Field label="A line from you" htmlFor="rem-msg" optional>
        <Textarea id="rem-msg" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Kindly confirm when the transfer has been made. Thank you for staying with us." />
      </Field>
    </Dialog>
  );
}
