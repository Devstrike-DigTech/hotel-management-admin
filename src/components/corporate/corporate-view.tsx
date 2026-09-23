"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Briefcase, Buildings, EnvelopeSimple, Phone, Plus, Printer, Receipt } from "@phosphor-icons/react";
import { useCorporateAccount, useCorporateAccounts, useRatePlans } from "@/lib/api/hooks-m4";
import { cityLedgerApi, corporateApi } from "@/lib/api/endpoints-m4";
import type { BillingCycle, CorporateAccount } from "@/lib/api/types-m4";
import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/store";
import { formatDay } from "@/lib/dates";
import { formatPhone, naira, nairaCompact } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/overlay";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { ChipRadio, KV, NairaInput, Stepper } from "@/components/m2/bits";
import { AgingBar, AgingStrip, CreditMeter } from "@/components/ledger-city/aging";

export function CorporateView() {
  const params = useSearchParams();
  const router = useRouter();
  const list = useCorporateAccounts({});
  const { can } = useCan();
  const open = params.get("open");
  const setOpen = (id: string | null) => router.replace(id ? `/corporate?open=${id}` : "/corporate", { scroll: false });
  const [editing, setEditing] = useState<CorporateAccount | "new" | null>(null);
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Briefcase size={14} weight="duotone" /> Corporate accounts
          </>
        }
        title={
          <>
            The companies that <em>keep coming back</em>.
          </>
        }
        description="Negotiated rates, a credit limit and payment terms per company. Stays linked to an account can check out to the City Ledger with no manager override while they're inside the limit."
        actions={
          can("corporate.manage") && (
            <Button onClick={() => setEditing("new")}>
              <Plus size={15} weight="bold" /> New account
            </Button>
          )
        }
      />
      {list.isError ? (
        <Panel>
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        </Panel>
      ) : !list.data ? (
        <Skeleton className="h-64" />
      ) : !list.data.length ? (
        <Panel>
          <EmptyState glyph="ladder" title="No company accounts yet" body="Add the oil-services firm, the bank and the NGO that send people every month." />
        </Panel>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {list.data.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => setOpen(a.id)}
              className={cn("flex flex-col gap-4 rounded-lg border bg-surface p-5 text-left transition-colors hover:border-line-strong", !a.active && "opacity-60", a.availableCreditKobo < 0 ? "border-[color-mix(in_oklab,var(--danger)_35%,transparent)]" : "border-line")}
              data-testid={`corp-${a.name}`}
            >
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-surface-2 text-ink-muted">
                  <Buildings size={19} weight="duotone" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="display-sm truncate text-[17px] leading-tight text-ink">{a.name}</p>
                  <p className="truncate text-[12.5px] text-ink-muted">
                    {a.contactName} &middot; {a.ratePlan ? `${a.ratePlan.name} rate` : "Best available rate"} &middot; {a.paymentTermsDays} days
                  </p>
                </div>
                {!a.active && <Badge>Inactive</Badge>}
              </div>
              <div className="grid grid-cols-[1fr_auto] items-end gap-6">
                <CreditMeter usedKobo={a.outstandingKobo} limitKobo={a.creditLimitKobo} />
                <AgingStrip buckets={a.aging} width={96} />
              </div>
              <p className="flex flex-wrap gap-x-4 text-[12px] text-ink-muted">
                <span>
                  <span className="font-mono text-ink">{a.stays.inHouse}</span> in the house
                </span>
                <span>
                  <span className="font-mono text-ink">{a.stays.upcoming}</span> arriving
                </span>
                <span>
                  <span className="font-mono text-ink">{a.stays.last90Days}</span> stays in 90 days
                </span>
                {a.overdueKobo > 0 && <span className="text-laterite">{nairaCompact(a.overdueKobo)} overdue</span>}
              </p>
            </button>
          ))}
        </div>
      )}
      <AccountSheet id={open} onOpenChange={(o) => !o && setOpen(null)} onEdit={(a) => setEditing(a)} />
      <AccountDialog account={editing} onOpenChange={(o) => !o && setEditing(null)} />
    </>
  );
}

function AccountSheet({ id, onOpenChange, onEdit }: { id: string | null; onOpenChange: (o: boolean) => void; onEdit: (a: CorporateAccount) => void }) {
  const q = useCorporateAccount(id);
  const qc = useQueryClient();
  const { can } = useCan();
  const issue = useMutation({
    mutationFn: () => cityLedgerApi.issue({ accountId: id! }),
    onSuccess: async (d) => {
      await Promise.all([qc.invalidateQueries({ queryKey: ["corporate"] }), qc.invalidateQueries({ queryKey: ["city-ledger"] })]);
      toast.success(`${d.number} issued`, `${naira(d.totalKobo)}, due ${formatDay(d.dueDate)}.`, { label: "Print", onClick: () => window.open(`/print/statement/${d.id}`, "_blank") });
    },
    meta: { errorTitle: "Statement not issued" },
  });
  const a = q.data;
  return (
    <Sheet
      open={!!id}
      onOpenChange={onOpenChange}
      eyebrow="Corporate account"
      title={a?.name ?? "..."}
      description={a ? `${a.billingCycle === "MONTHLY" ? "Monthly statement" : "Invoiced per stay"}, ${a.paymentTermsDays} days to pay` : undefined}
      width="sm:max-w-[560px]"
      footer={
        a &&
        can("corporate.manage") && (
          <Button variant="secondary" className="ml-auto" onClick={() => onEdit(a)}>
            Edit account
          </Button>
        )
      }
    >
      {!a ? (
        <Skeleton className="h-72" />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="eyebrow mb-2">Credit</p>
              <CreditMeter usedKobo={a.outstandingKobo} limitKobo={a.creditLimitKobo} />
              <p className="mt-1.5 text-[12px] text-ink-muted">{a.availableCreditKobo >= 0 ? `${naira(a.availableCreditKobo)} left to spend` : `${naira(-a.availableCreditKobo)} over the limit`}</p>
            </div>
            <dl className="text-[12.5px]">
              <KV k={<EnvelopeSimple size={13} />} v={<a href={`mailto:${a.email}`} className="hover:text-laterite">{a.email}</a>} className="py-0.5" />
              {a.phone && <KV k={<Phone size={13} />} v={<span className="font-mono">{formatPhone(a.phone)}</span>} className="py-0.5" />}
              {a.taxId && <KV k="TIN" v={<span className="font-mono">{a.taxId}</span>} className="py-0.5" />}
            </dl>
          </div>
          <AgingBar buckets={a.aging} />
          {a.uninvoiced.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="eyebrow">Not yet invoiced</h3>
                {can("corporate.manage") && (
                  <Button size="sm" variant="secondary" loading={issue.isPending} onClick={() => issue.mutate()}>
                    <Receipt size={13} /> Issue a statement now
                  </Button>
                )}
              </div>
              <ul className="divide-y divide-line rounded-md border border-line">
                {a.uninvoiced.map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-[12.5px]">
                    <span className="font-mono text-ink-muted">{c.reservationCode}</span>
                    <span className="min-w-0 flex-1 truncate text-ink">
                      {c.guestName} <span className="text-ink-muted">&middot; {c.description}</span>
                    </span>
                    <span className="font-mono text-ink">{naira(c.amountKobo)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h3 className="eyebrow mb-2">Statements</h3>
            {a.invoices.length ? (
              <ul className="divide-y divide-line rounded-md border border-line">
                {a.invoices.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 px-3 py-2 text-[12.5px]">
                    <span className="font-mono text-ink">{i.number}</span>
                    <span className="flex-1 text-ink-muted">due {formatDay(i.dueDate, { day: "numeric", month: "short" })}</span>
                    <span className={cn("font-mono", i.balanceKobo > 0 ? (i.overdue ? "text-laterite" : "text-ink") : "text-palm")}>{i.balanceKobo > 0 ? naira(i.balanceKobo) : "paid"}</span>
                    <ButtonLink href={`/print/statement/${i.id}`} variant="ghost" size="icon-sm" aria-label={`Print ${i.number}`}>
                      <Printer size={14} />
                    </ButtonLink>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-muted">None yet.</p>
            )}
          </section>
          {a.notes && <p className="rounded-md bg-surface-2/60 px-3 py-2.5 text-[12.5px] text-ink-muted">{a.notes}</p>}
        </div>
      )}
    </Sheet>
  );
}

function AccountDialog({ account, onOpenChange }: { account: CorporateAccount | "new" | null; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const plans = useRatePlans();
  const a = account === "new" ? null : account;
  const [key, setKey] = useState("");
  const blank = { name: "", contactName: "", email: "", phone: "", address: "", taxId: "", ratePlanId: "", limit: 100_000_000 as number | null, terms: 30, cycle: "MONTHLY" as BillingCycle, notes: "", active: true };
  const [f, setF] = useState(blank);
  const k = account === "new" ? "new" : (a?.id ?? "");
  if (account && k !== key) {
    setKey(k);
    setF(
      a
        ? { name: a.name, contactName: a.contactName, email: a.email, phone: a.phone, address: a.address, taxId: a.taxId, ratePlanId: a.ratePlan?.id ?? "", limit: a.creditLimitKobo, terms: a.paymentTermsDays, cycle: a.billingCycle, notes: a.notes, active: a.active }
        : blank,
    );
  }
  const m = useMutation({
    mutationFn: () => {
      const body = { name: f.name.trim(), contactName: f.contactName.trim(), email: f.email.trim(), phone: f.phone.trim() || undefined, address: f.address.trim(), taxId: f.taxId.trim(), ratePlanId: f.ratePlanId || null, creditLimitKobo: f.limit ?? 0, paymentTermsDays: f.terms, billingCycle: f.cycle, notes: f.notes.trim(), active: f.active };
      return a ? corporateApi.update(a.id, body) : corporateApi.create(body);
    },
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: ["corporate"] });
      toast.success(`${r.name} saved`);
      onOpenChange(false);
    },
    meta: { errorTitle: "Account not saved" },
  });
  const valid = f.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(f.email);
  return (
    <Dialog
      open={!!account}
      onOpenChange={onOpenChange}
      eyebrow="Corporate account"
      title={a ? a.name : "A new company"}
      className="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={m.isPending} onClick={() => m.mutate()}>
            Save account
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Company" htmlFor="ca-name">
          <Input id="ca-name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Deltaline Oilfield Services Ltd" autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Contact" htmlFor="ca-contact">
            <Input id="ca-contact" value={f.contactName} onChange={(e) => setF({ ...f, contactName: e.target.value })} />
          </Field>
          <Field label="Accounts email" htmlFor="ca-email" hint="Statements and reminders go here">
            <Input id="ca-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          </Field>
          <Field label="Phone" htmlFor="ca-phone" optional>
            <Input id="ca-phone" type="tel" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className="font-mono" />
          </Field>
          <Field label="TIN" htmlFor="ca-tin" optional>
            <Input id="ca-tin" value={f.taxId} onChange={(e) => setF({ ...f, taxId: e.target.value })} className="font-mono" />
          </Field>
        </div>
        <Field label="Address" htmlFor="ca-addr" optional>
          <Input id="ca-addr" value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Negotiated rate" htmlFor="ca-plan">
            <Select id="ca-plan" value={f.ratePlanId} onChange={(e) => setF({ ...f, ratePlanId: e.target.value })}>
              <option value="">Best available rate</option>
              {plans.data?.filter((p) => !p.isBar).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.label ? `(${p.label})` : ""}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Credit limit" htmlFor="ca-limit">
            <NairaInput id="ca-limit" kobo={f.limit} onChange={(v) => setF({ ...f, limit: v })} />
          </Field>
          <Field label="Days to pay">
            <Stepper label="days" value={f.terms} onChange={(v) => setF({ ...f, terms: v })} min={0} max={120} suffix="days" />
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink">Invoicing</span>
            <ChipRadio
              label="Billing cycle"
              value={f.cycle}
              onChange={(v) => setF({ ...f, cycle: v })}
              options={[
                { value: "MONTHLY", label: "Monthly statement" },
                { value: "PER_STAY", label: "Per stay" },
              ]}
            />
          </div>
        </div>
        <Field label="Notes" htmlFor="ca-notes" optional>
          <Textarea id="ca-notes" className="min-h-14" value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
        </Field>
        {a && <Switch checked={f.active} onChange={(v) => setF({ ...f, active: v })} label="Active" description="Inactive accounts can't be linked to new bookings or checked out to." />}
      </div>
    </Dialog>
  );
}
