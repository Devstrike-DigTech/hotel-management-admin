"use client";

import { Fragment, useMemo } from "react";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ArrowBendDownRight, DotsThreeVertical, Prohibit, Receipt, SealCheck } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { naira } from "@/lib/format";
import { formatDay } from "@/lib/dates";
import { ENTRY_TYPES, PAYMENT_METHODS } from "@/lib/catalog-m2";
import type { Folio, FolioEntry } from "@/lib/api/types-m2";

/**
 * A hotel folio rendered like the paper original: date, reference, particulars,
 * debit and credit columns, and a running balance. Tax lines hang under their
 * charge; voided entries stay visible, struck through, with the reason.
 */
export function FolioLedger({
  folio,
  canVoid,
  onVoid,
  onReceipt,
  compact,
}: {
  folio: Folio;
  canVoid?: boolean;
  onVoid?: (e: FolioEntry) => void;
  onReceipt?: (receiptId: string) => void;
  compact?: boolean;
}) {
  const { groups } = useMemo(() => groupEntries(folio.entries), [folio.entries]);
  const t = folio.totals;
  return (
    <div className="relative">
      {/* table (tablet and up) */}
      <div className="hidden sm:block">
        <table className="w-full border-collapse text-[13px]">
          <caption className="sr-only">Folio entries for {folio.name}</caption>
          <thead>
            <tr className="border-b-2 border-double border-line-strong">
              <th scope="col" className="eyebrow w-[76px] py-2.5 pl-5 text-left text-[10px] font-normal">Date</th>
              <th scope="col" className="eyebrow w-[44px] py-2.5 text-left text-[10px] font-normal">Ref</th>
              <th scope="col" className="eyebrow py-2.5 text-left text-[10px] font-normal">Particulars</th>
              <th scope="col" className="eyebrow w-[110px] py-2.5 text-right text-[10px] font-normal">Charges</th>
              <th scope="col" className="eyebrow w-[110px] py-2.5 text-right text-[10px] font-normal">Credits</th>
              <th scope="col" className="eyebrow w-[120px] py-2.5 pr-5 text-right text-[10px] font-normal">Balance</th>
              {canVoid && <th scope="col" className="w-9"><span className="sr-only">Actions</span></th>}
            </tr>
          </thead>
          <tbody className="ledger-rows">
            {groups.map(({ entry, children }) => (
              <Fragment key={entry.id}>
                <EntryRow entry={entry} canVoid={canVoid} onVoid={onVoid} onReceipt={onReceipt} />
                {children.map((c) => (
                  <EntryRow key={c.id} entry={c} child canVoid={false} />
                ))}
              </Fragment>
            ))}
            {!groups.length && (
              <tr>
                <td colSpan={canVoid ? 7 : 6} className="py-10 text-center text-[13px] italic text-ink-faint">
                  Nothing posted yet. Charges post at check-in and each night at the audit.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* phone: stacked slips */}
      <ul className="flex flex-col sm:hidden">
        {groups.map(({ entry, children }) => (
          <li key={entry.id} className="border-b border-line px-4 py-3">
            <MobileEntry entry={entry} canVoid={canVoid} onVoid={onVoid} onReceipt={onReceipt} />
            {children.map((c) => (
              <div key={c.id} className="mt-1 flex items-baseline justify-between pl-4 text-[12px] text-ink-muted">
                <span className={cn("flex items-center gap-1", c.voided && "line-through")}>
                  <ArrowBendDownRight size={11} /> {c.description}
                </span>
                <span className="font-mono">{naira(c.amountKobo)}</span>
              </div>
            ))}
          </li>
        ))}
      </ul>

      {/* totals */}
      <div className={cn("grid gap-6 border-t border-line-strong px-5 py-5", compact ? "" : "sm:grid-cols-[1fr_300px]")}>
        <div className="hidden text-[12px] leading-relaxed text-ink-faint sm:block">
          {folio.entries.some((e) => e.voided) && (
            <p className="flex items-center gap-1.5">
              <Prohibit size={13} /> Struck-through lines were voided. They stay on the folio for the audit trail.
            </p>
          )}
          {folio.entries.some((e) => e.approvedBy) && (
            <p className="mt-1 flex items-center gap-1.5">
              <SealCheck size={13} /> Discounts marked with a seal were approved with a manager&rsquo;s key.
            </p>
          )}
        </div>
        <dl className="flex flex-col text-[13px]">
          <TotalRow k="Charges" v={t.chargesKobo} />
          {t.discountsKobo !== 0 && <TotalRow k="Discounts" v={-t.discountsKobo} />}
          <TotalRow k="Taxes" v={t.taxKobo} />
          {t.serviceChargeKobo !== 0 && <TotalRow k="Service charge" v={t.serviceChargeKobo} />}
          <TotalRow k="Payments" v={-t.paymentsKobo} />
          {t.refundsKobo !== 0 && <TotalRow k="Refunds" v={t.refundsKobo} />}
          <div className="mt-2 flex items-baseline justify-between border-t-2 border-double border-line-strong pt-3">
            <dt className="display-sm text-[16px] text-ink">
              {t.balanceKobo > 0 ? "Balance due" : t.balanceKobo < 0 ? "In credit" : "Balance"}
            </dt>
            <dd
              data-testid="folio-balance"
              className={cn(
                "font-mono text-[24px] leading-none tracking-tight",
                t.balanceKobo > 0 ? "text-ochre" : t.balanceKobo < 0 ? "text-palm" : "text-ink",
              )}
            >
              {naira(Math.abs(t.balanceKobo))}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function TotalRow({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <dt className="text-ink-muted">{k}</dt>
      <dd className="font-mono text-ink">
        {v < 0 ? "−" : ""}
        {naira(Math.abs(v))}
      </dd>
    </div>
  );
}

function groupEntries(entries: FolioEntry[]) {
  const children = new Map<string, FolioEntry[]>();
  const top: FolioEntry[] = [];
  for (const e of entries) {
    if (e.parentEntryId && (e.type === "TAX" || e.type === "SERVICE_CHARGE")) {
      const list = children.get(e.parentEntryId) ?? [];
      list.push(e);
      children.set(e.parentEntryId, list);
    } else top.push(e);
  }
  // voids of tax lines follow their void parent
  const voidChildren = new Map<string, FolioEntry[]>();
  const top2: FolioEntry[] = [];
  const taxIds = new Set(entries.filter((e) => e.type === "TAX" || e.type === "SERVICE_CHARGE").map((e) => e.id));
  for (const e of top) {
    if (e.type === "VOID" && e.refEntryId && taxIds.has(e.refEntryId)) {
      const parentTax = entries.find((x) => x.id === e.refEntryId);
      const parentVoid = top.find((v) => v.type === "VOID" && v.refEntryId === parentTax?.parentEntryId);
      if (parentVoid) {
        const list = voidChildren.get(parentVoid.id) ?? [];
        list.push(e);
        voidChildren.set(parentVoid.id, list);
        continue;
      }
    }
    top2.push(e);
  }
  return {
    groups: top2.map((entry) => ({ entry, children: [...(children.get(entry.id) ?? []), ...(voidChildren.get(entry.id) ?? [])] })),
  };
}

function particulars(e: FolioEntry) {
  if (e.type === "PAYMENT" || e.type === "REFUND") {
    const m = e.paymentMethod ? PAYMENT_METHODS[e.paymentMethod].label : "";
    return `${e.type === "REFUND" ? "Refund" : e.description && e.description !== "Payment" ? e.description : "Payment"}${m ? `, ${m.toLowerCase()}` : ""}`;
  }
  return e.description;
}

function EntryRow({
  entry: e,
  child,
  canVoid,
  onVoid,
  onReceipt,
}: {
  entry: FolioEntry;
  child?: boolean;
  canVoid?: boolean;
  onVoid?: (e: FolioEntry) => void;
  onReceipt?: (id: string) => void;
}) {
  const debit = e.amountKobo > 0;
  const isVoid = e.type === "VOID";
  const struck = e.voided;
  return (
    <tr
      className={cn(
        "group border-b border-line align-baseline transition-colors hover:bg-surface-2/40",
        child && "border-b-0 text-[12px] text-ink-muted",
        isVoid && "text-danger",
      )}
    >
      <td className={cn("py-2 pl-5 font-mono text-[11.5px] text-ink-muted", child && "py-1")}>
        {!child && formatDay(e.businessDate, { day: "2-digit", month: "short" })}
      </td>
      <td className={cn("py-2 font-mono text-[10.5px] tracking-wider text-ink-faint", child && "py-1")}>{!child && ENTRY_TYPES[e.type].code}</td>
      <td className={cn("py-2 pr-3", child && "py-1 pl-4")}>
        <span className={cn("inline-flex items-baseline gap-1.5", struck && "line-through decoration-danger/70")}>
          {child && <ArrowBendDownRight size={11} className="shrink-0 self-center" />}
          <span className={cn(!child && !isVoid && "text-ink")}>{particulars(e)}</span>
          {e.approvedBy && (
            <span className="inline-flex items-center gap-0.5 whitespace-nowrap text-[11px] text-palm" title={`Approved by ${e.approvedBy.fullName}`}>
              <SealCheck size={12} weight="duotone" /> {e.approvedBy.fullName.split(" ")[0]}
            </span>
          )}
        </span>
        {(e.paymentRef || (e.receiptNumber && e.receiptId)) && (
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 font-mono text-[11px] text-ink-faint">
            {e.paymentRef && <span>ref {e.paymentRef}</span>}
            {e.receiptNumber && e.receiptId && onReceipt ? (
              <button onClick={() => onReceipt(e.receiptId!)} className="inline-flex items-center gap-1 whitespace-nowrap underline-offset-2 hover:text-laterite hover:underline">
                <Receipt size={11} /> {e.receiptNumber}
              </button>
            ) : e.receiptNumber ? (
              <span>{e.receiptNumber}</span>
            ) : null}
          </span>
        )}
        {(e.voided && e.voidReason) || (isVoid && e.reason) ? (
          <span className="mt-0.5 block text-[11.5px] italic text-danger/90">{isVoid ? `Void: ${e.reason}` : `Voided: ${e.voidReason}`}</span>
        ) : e.reason && e.type === "DISCOUNT" ? (
          <span className="mt-0.5 block text-[11.5px] italic text-ink-faint">{e.reason}</span>
        ) : null}
        {!child && e.createdBy && (
          <span className="mt-0.5 hidden text-[11px] text-ink-faint group-hover:block">
            by {e.createdBy.fullName}
            {e.clientCreatedAt && e.clientCreatedAt !== e.createdAt ? ", recorded offline" : ""}
          </span>
        )}
      </td>
      <td className={cn("py-2 text-right font-mono", struck && "line-through decoration-danger/70", child && "py-1")}>{debit ? naira(e.amountKobo) : ""}</td>
      <td className={cn("py-2 text-right font-mono", struck && "line-through decoration-danger/70", child && "py-1")}>
        {!debit && e.amountKobo !== 0 ? naira(-e.amountKobo) : ""}
      </td>
      <td className={cn("py-2 pr-5 text-right font-mono text-ink", child && "py-1 text-ink-faint")}>
        {naira(e.runningBalanceKobo)}
      </td>
      {canVoid && (
        <td className="py-1.5 pr-2 text-right">
          {!child && !isVoid && !e.voided && e.type !== "TAX" && e.type !== "SERVICE_CHARGE" && onVoid && (
            <EntryMenu entry={e} onVoid={onVoid} />
          )}
        </td>
      )}
    </tr>
  );
}

function MobileEntry({
  entry: e,
  canVoid,
  onVoid,
  onReceipt,
}: {
  entry: FolioEntry;
  canVoid?: boolean;
  onVoid?: (e: FolioEntry) => void;
  onReceipt?: (id: string) => void;
}) {
  const isVoid = e.type === "VOID";
  return (
    <div className={cn("flex items-start gap-3", isVoid && "text-danger")}>
      <span className="w-10 shrink-0 pt-0.5 font-mono text-[10.5px] leading-tight text-ink-muted">
        {formatDay(e.businessDate, { day: "2-digit", month: "short" })}
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[13.5px]", e.voided && "line-through decoration-danger/70", !isVoid && "text-ink")}>{particulars(e)}</p>
        {(e.voidReason || (isVoid && e.reason)) && <p className="text-[11.5px] italic text-danger/90">{isVoid ? e.reason : `Voided: ${e.voidReason}`}</p>}
        {e.receiptNumber && e.receiptId && onReceipt && (
          <button onClick={() => onReceipt(e.receiptId!)} className="font-mono text-[11px] text-ink-faint underline underline-offset-2">
            {e.receiptNumber}
          </button>
        )}
      </div>
      <div className="text-right">
        <p className={cn("font-mono text-[13.5px]", e.voided && "line-through", e.amountKobo < 0 && !isVoid ? "text-palm" : "text-ink")}>
          {e.amountKobo < 0 ? "−" : ""}
          {naira(Math.abs(e.amountKobo))}
        </p>
        <p className="font-mono text-[10.5px] text-ink-faint">bal {naira(e.runningBalanceKobo)}</p>
      </div>
      {canVoid && onVoid && !isVoid && !e.voided && <EntryMenu entry={e} onVoid={onVoid} />}
    </div>
  );
}

function EntryMenu({ entry, onVoid }: { entry: FolioEntry; onVoid: (e: FolioEntry) => void }) {
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button
          className="grid h-6 w-6 place-items-center rounded-sm text-ink-faint opacity-60 hover:bg-surface-2 hover:text-ink group-hover:opacity-100 data-[state=open]:opacity-100"
          aria-label={`Actions for ${entry.description}`}
        >
          <DotsThreeVertical size={15} weight="bold" />
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content align="end" sideOffset={4} className="z-50 min-w-44 rounded-md border border-line bg-surface p-1 shadow-float animate-[rise_140ms_ease-out]">
          <Menu.Item
            onSelect={() => onVoid(entry)}
            className="flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2.5 text-[13px] text-danger outline-none data-[highlighted]:bg-danger-wash"
          >
            <Prohibit size={15} /> Void this entry
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
