"use client";

import { useCityLedgerInvoice } from "@/lib/api/hooks-m4";
import type { CityLedgerInvoiceDocument } from "@/lib/api/types-m4";
import { formatDay } from "@/lib/dates";
import { formatPhone, naira } from "@/lib/format";
import { AdireRule } from "@/components/motifs/adire";
import { PrintFrame } from "@/components/documents/print-views";
import { BUCKETS } from "./aging";

const METHOD: Record<string, string> = { TRANSFER: "Bank transfer", CHEQUE: "Cheque", CASH: "Cash", POS: "POS" };

export function StatementPrint({ id }: { id: string }) {
  const q = useCityLedgerInvoice(id);
  return (
    <PrintFrame kind="invoice" label="A4 statement" loading={q.isLoading} error={q.error}>
      {q.data && <StatementSheet doc={q.data} />}
    </PrintFrame>
  );
}

/** The City Ledger statement a company's accounts department receives. */
export function StatementSheet({ doc }: { doc: CityLedgerInvoiceDocument }) {
  const accent = "#b4452a";
  const bucket = BUCKETS.find((b) => b.key === doc.bucket);
  return (
    <article
      className="relative w-full max-w-[794px] overflow-hidden bg-[#ffffff] text-[#1b1a17] shadow-[0_1px_0_rgb(0_0_0/0.04),0_24px_60px_-28px_rgb(60_40_20/0.45)] print:max-w-none print:shadow-none"
      style={{ minHeight: 1123, colorScheme: "light" }}
      aria-label={`Statement ${doc.number}`}
    >
      <div className="h-2" style={{ background: accent }} />
      {doc.status === "PAID" && (
        <span aria-hidden className="pointer-events-none absolute right-[64px] top-[210px] rotate-[-12deg] rounded-[6px] border-[3px] border-[#2f5a43] px-4 py-1 font-mono text-[28px] font-semibold tracking-[0.2em] text-[#2f5a43] opacity-60">
          PAID
        </span>
      )}
      <div className="px-[56px] pb-[48px] pt-[44px]">
        <header className="flex items-start justify-between gap-8">
          <div className="text-[11.5px] leading-relaxed text-[#5b544a]">
            <p className="display-sm text-[22px] leading-tight text-[#1b1a17]" style={{ fontVariationSettings: '"opsz" 72, "SOFT" 60' }}>
              {doc.hotel.name}
            </p>
            {doc.hotel.address && <p>{doc.hotel.address}</p>}
            <p className="font-mono">
              {formatPhone((doc.hotel.phone as string) ?? "")}
              {doc.hotel.email ? ` · ${doc.hotel.email}` : ""}
            </p>
            {doc.hotel.taxId && <p className="font-mono">TIN {doc.hotel.taxId}</p>}
          </div>
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: accent }}>
              {doc.kind === "PER_STAY" ? "City Ledger invoice" : "Statement of account"}
            </p>
            <p className="mt-1 font-mono text-[20px] font-medium tracking-wide">{doc.number}</p>
            <p className="mt-1 text-[11.5px] text-[#5b544a]">Issued {formatDay(doc.issueDate, { day: "numeric", month: "long", year: "numeric" })}</p>
            <p className="text-[11.5px] font-medium" style={{ color: doc.overdue ? accent : "#1b1a17" }}>
              Due {formatDay(doc.dueDate, { day: "numeric", month: "long", year: "numeric" })}
              {doc.overdue && " (overdue)"}
            </p>
          </div>
        </header>

        <div className="mt-8 grid grid-cols-2 gap-8 border-y border-[#e0d7c8] py-5 text-[12px]">
          <div>
            <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#8a8175]">Bill to</p>
            <p className="text-[14px] font-medium">{doc.billTo.name}</p>
            {doc.billTo.contactName && <p>Attn: {doc.billTo.contactName}</p>}
            {doc.billTo.address && <p className="text-[#5b544a]">{doc.billTo.address}</p>}
            <p className="text-[#5b544a]">{doc.billTo.email}</p>
            {doc.billTo.taxId && <p className="font-mono text-[#5b544a]">TIN {doc.billTo.taxId}</p>}
          </div>
          <div>
            <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#8a8175]">Account</p>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
              {doc.periodFrom && (
                <>
                  <dt className="text-[#8a8175]">Period</dt>
                  <dd>
                    {formatDay(doc.periodFrom, { day: "numeric", month: "short" })} to {formatDay(doc.periodTo ?? doc.issueDate, { day: "numeric", month: "short", year: "numeric" })}
                  </dd>
                </>
              )}
              <dt className="text-[#8a8175]">Days outstanding</dt>
              <dd className="font-mono">{doc.daysOutstanding}</dd>
              <dt className="text-[#8a8175]">Age</dt>
              <dd>{bucket?.label}</dd>
            </dl>
          </div>
        </div>

        <table className="mt-6 w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b-2 border-[#1b1a17]">
              <th className="w-[80px] py-2 text-left font-mono text-[9.5px] font-normal uppercase tracking-[0.18em] text-[#8a8175]">Date</th>
              <th className="w-[96px] py-2 text-left font-mono text-[9.5px] font-normal uppercase tracking-[0.18em] text-[#8a8175]">Booking</th>
              <th className="py-2 text-left font-mono text-[9.5px] font-normal uppercase tracking-[0.18em] text-[#8a8175]">Guest and stay</th>
              <th className="w-[130px] py-2 text-right font-mono text-[9.5px] font-normal uppercase tracking-[0.18em] text-[#8a8175]">Amount (NGN)</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => (
              <tr key={i} className="border-b border-[#ece5d8]">
                <td className="py-2 font-mono text-[11.5px] text-[#5b544a]">{formatDay(l.date, { day: "2-digit", month: "short" })}</td>
                <td className="py-2 font-mono text-[11.5px]">{l.reservationCode ?? "-"}</td>
                <td className="py-2">
                  {l.guestName && <span className="font-medium">{l.guestName}. </span>}
                  <span className="text-[#5b544a]">{l.description}</span>
                </td>
                <td className="py-2 text-right font-mono">{naira(l.amountKobo).replace("₦", "")}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <dl className="w-[300px] text-[12.5px]">
            <div className="flex items-baseline justify-between py-1">
              <dt className="text-[#5b544a]">Total</dt>
              <dd className="font-mono">{naira(doc.totalKobo)}</dd>
            </div>
            <div className="flex items-baseline justify-between py-1">
              <dt className="text-[#5b544a]">Paid</dt>
              <dd className="font-mono">
                {doc.paidKobo ? "−" : ""}
                {naira(doc.paidKobo)}
              </dd>
            </div>
            <div className="mt-1 flex items-baseline justify-between rounded-[3px] px-2 py-1.5" style={{ background: doc.balanceKobo > 0 ? "#f4e1c3" : "#dbe6dc" }}>
              <dt className="font-medium">{doc.balanceKobo > 0 ? "Balance due" : "Settled"}</dt>
              <dd className="font-mono text-[16px] font-medium">{naira(doc.balanceKobo)}</dd>
            </div>
          </dl>
        </div>

        {doc.payments.length > 0 && (
          <div className="mt-8">
            <p className="mb-2 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#8a8175]">Payments received</p>
            <table className="w-full text-[12px]">
              <tbody>
                {doc.payments.map((p, i) => (
                  <tr key={i} className="border-b border-[#ece5d8]">
                    <td className="w-[80px] py-1.5 font-mono text-[11.5px] text-[#5b544a]">{formatDay(p.date, { day: "2-digit", month: "short" })}</td>
                    <td className="py-1.5">
                      {METHOD[p.method] ?? p.method}
                      {p.reference && <span className="ml-2 font-mono text-[11px] text-[#8a8175]">{p.reference}</span>}
                    </td>
                    <td className="w-[130px] py-1.5 text-right font-mono">{naira(p.amountKobo).replace("₦", "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {doc.notes && (
          <div className="mt-8 rounded-[4px] border border-[#e0d7c8] px-4 py-3 text-[12px] text-[#5b544a]">
            <p className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#8a8175]">How to pay</p>
            {doc.notes}
          </div>
        )}
        <div className="mt-12 text-[#d8cdb9]">
          <AdireRule />
        </div>
        <p className="mt-3 text-center text-[10.5px] text-[#8a8175]">
          Please quote {doc.number} with your payment. Issued by {doc.issuedBy?.fullName ?? doc.hotel.name}.
        </p>
      </div>
    </article>
  );
}
