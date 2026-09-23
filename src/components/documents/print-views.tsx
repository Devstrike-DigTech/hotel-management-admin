"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "@phosphor-icons/react";
import { useInvoice, useReceipt } from "@/lib/api/hooks-m2";
import { documentsApi } from "@/lib/api/endpoints-m2";
import type { HotelHeader, InvoiceDocument, ReceiptDocument } from "@/lib/api/types-m2";
import { isApiError } from "@/lib/api/client";
import { PAYMENT_METHODS } from "@/lib/catalog-m2";
import { formatDate, formatDateTime, formatPhone, naira } from "@/lib/format";
import { dayKeyOf, formatDay, lagosHHMM, prettyDates } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { config } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { ErrorState, Skeleton } from "@/components/ui/primitives";
import { AdireRule } from "@/components/motifs/adire";
import { DocumentActions } from "./share";

/* ---------------- routes ---------------- */

export function InvoicePrint({ id }: { id: string }) {
  const q = useInvoice(id);
  return (
    <PrintFrame kind="invoice" loading={q.isLoading} error={q.error} actions={q.data && <DocumentActions kind="invoice" id={id} size="sm" noPrint />}>
      {q.data && <InvoiceSheet doc={q.data} />}
    </PrintFrame>
  );
}

export function ReceiptPrint({ id }: { id: string }) {
  const q = useReceipt(id);
  return (
    <PrintFrame kind="receipt" loading={q.isLoading} error={q.error} actions={q.data && <DocumentActions kind="receipt" id={id} size="sm" noPrint />}>
      {q.data && <ReceiptSlip doc={q.data} />}
    </PrintFrame>
  );
}

/** Public, unauthenticated page behind a signed share link (WhatsApp). */
export function SharedDocument({ token }: { token: string }) {
  const q = useQuery({ queryKey: ["public-doc", token], queryFn: () => documentsApi.publicDocument(token), retry: false });
  const expired = isApiError(q.error) && q.error.code === "LINK_EXPIRED";
  return (
    <PrintFrame
      kind={q.data?.type === "RECEIPT" ? "receipt" : "invoice"}
      loading={q.isLoading}
      error={q.error}
      errorTitle={expired ? "This link has expired" : "We couldn't find this document"}
      publicView
    >
      {q.data?.type === "INVOICE" && <InvoiceSheet doc={q.data.document} />}
      {q.data?.type === "RECEIPT" && <ReceiptSlip doc={q.data.document} />}
    </PrintFrame>
  );
}

function PrintFrame({
  kind,
  loading,
  error,
  errorTitle,
  children,
  actions,
  publicView,
}: {
  kind: "invoice" | "receipt";
  loading: boolean;
  error: unknown;
  errorTitle?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  publicView?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-surface-2/60 print:bg-[#ffffff]">
      <style>{kind === "invoice" ? `@media print { @page { size: A4; margin: 0; } }` : `@media print { @page { size: 80mm auto; margin: 0; } }`}</style>
      <div className="no-print sticky top-0 z-10 border-b border-line bg-[color-mix(in_oklab,var(--paper)_92%,transparent)] backdrop-blur-[6px]">
        <div className="mx-auto flex max-w-[900px] flex-wrap items-center gap-2 px-4 py-2.5">
          {!publicView && (
            <Button variant="ghost" size="sm" onClick={() => (window.history.length > 1 ? window.history.back() : window.close())}>
              <ArrowLeft size={14} /> Back
            </Button>
          )}
          <span className="eyebrow">{kind === "invoice" ? "A4 invoice" : "80mm receipt"}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {actions}
            <Button size="sm" onClick={() => window.print()}>
              <Printer size={14} weight="bold" /> {publicView ? "Print or save PDF" : "Print"}
            </Button>
          </div>
        </div>
      </div>
      <div className="flex justify-center px-3 py-8 print:p-0">
        {loading ? (
          <Skeleton className={kind === "invoice" ? "h-[1123px] w-[794px]" : "h-[520px] w-[302px]"} />
        ) : error ? (
          <ErrorState error={error} title={errorTitle} />
        ) : (
          children
        )}
      </div>
    </div>
  );
}

/* ---------------- A4 invoice ---------------- */

/** Area, city and state, without repeating what the street address already says. */
function placeLine(h: HotelHeader) {
  const addr = (h.address ?? "").toLowerCase();
  const parts = [h.area, h.city, h.state].filter((p, i, a) => p && !addr.includes(p.toLowerCase()) && a.indexOf(p) === i);
  return parts.join(", ");
}

function HotelBlock({ h, compact }: { h: HotelHeader; compact?: boolean }) {
  return (
    <div className={cn("text-[11.5px] leading-relaxed text-[#5b544a]", compact && "text-center")}>
      <p className="display-sm text-[22px] leading-tight text-[#1b1a17]" style={{ fontVariationSettings: '"opsz" 72, "SOFT" 60' }}>
        {h.name}
      </p>
      <p>{h.address}</p>
      <p>{placeLine(h)}</p>
      <p className="font-mono">
        {formatPhone(h.phone)}
        {h.email ? ` · ${h.email}` : ""}
      </p>
    </div>
  );
}

export function InvoiceSheet({ doc }: { doc: InvoiceDocument }) {
  const accent = doc.hotel.accentColor || "#b4452a";
  const r = doc.reservation;
  const t = doc.totals;
  return (
    <article
      className="relative w-full max-w-[794px] overflow-hidden bg-[#ffffff] text-[#1b1a17] shadow-[0_1px_0_rgb(0_0_0/0.04),0_24px_60px_-28px_rgb(60_40_20/0.45)] print:max-w-none print:shadow-none"
      style={{ minHeight: 1123, colorScheme: "light" }}
      aria-label={`Invoice ${doc.number}`}
    >
      <div className="h-2" style={{ background: accent }} />
      {doc.kind === "PROFORMA" && (
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2 rotate-[-24deg] select-none whitespace-nowrap font-mono text-[96px] font-semibold tracking-[0.2em] opacity-[0.06]"
        >
          PROFORMA
        </span>
      )}
      <div className="px-[56px] pb-[48px] pt-[44px]">
        <header className="flex items-start justify-between gap-8">
          <HotelBlock h={doc.hotel} />
          <div className="text-right">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em]" style={{ color: accent }}>
              {doc.kind === "PROFORMA" ? "Proforma invoice" : "Invoice"}
            </p>
            <p className="mt-1 font-mono text-[20px] font-medium tracking-wide">{doc.number}</p>
            <p className="mt-1 text-[11.5px] text-[#5b544a]">Issued {formatDate(doc.issuedAt, { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </header>

        <div className="mt-8 grid grid-cols-2 gap-8 border-y border-[#e0d7c8] py-5 text-[12px]">
          <div>
            <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#8a8175]">Billed to</p>
            {doc.guest ? (
              <>
                <p className="text-[14px] font-medium">{doc.guest.fullName}</p>
                {doc.guest.company && <p>{doc.guest.company}</p>}
                {doc.guest.address && <p className="text-[#5b544a]">{doc.guest.address}</p>}
                <p className="font-mono text-[#5b544a]">{formatPhone(doc.guest.phone)}</p>
                {doc.guest.email && <p className="text-[#5b544a]">{doc.guest.email}</p>}
              </>
            ) : (
              <p className="text-[14px] font-medium">{doc.folio.name}</p>
            )}
          </div>
          {r && (
            <div>
              <p className="mb-1.5 font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#8a8175]">Stay</p>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-0.5">
                <dt className="text-[#8a8175]">Reservation</dt>
                <dd className="font-mono">{r.code}</dd>
                <dt className="text-[#8a8175]">Room</dt>
                <dd>
                  <span className="font-mono">{r.roomNumber ?? "-"}</span> &middot; {r.roomTypeName}
                </dd>
                <dt className="text-[#8a8175]">Arrival</dt>
                <dd>{formatDateTime(r.arrivalAt)}</dd>
                <dt className="text-[#8a8175]">Departure</dt>
                <dd>{formatDateTime(r.departureAt)}</dd>
                <dt className="text-[#8a8175]">{r.stayType === "DAY_USE" ? "Hours" : "Nights"}</dt>
                <dd className="font-mono">
                  {r.stayType === "DAY_USE" ? r.hours : r.nights} &middot; {r.adults} {r.adults === 1 ? "adult" : "adults"}
                  {r.children ? `, ${r.children} ch.` : ""}
                </dd>
              </dl>
            </div>
          )}
        </div>

        <table className="mt-6 w-full border-collapse text-[12.5px]">
          <thead>
            <tr className="border-b-2 border-[#1b1a17]">
              <th className="w-[92px] py-2 text-left font-mono text-[9.5px] font-normal uppercase tracking-[0.18em] text-[#8a8175]">Date</th>
              <th className="py-2 text-left font-mono text-[9.5px] font-normal uppercase tracking-[0.18em] text-[#8a8175]">Description</th>
              <th className="w-[140px] py-2 text-right font-mono text-[9.5px] font-normal uppercase tracking-[0.18em] text-[#8a8175]">Amount (NGN)</th>
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((l, i) => (
              <tr key={i} className="border-b border-[#ece5d8]">
                <td className="py-2 font-mono text-[11.5px] text-[#5b544a]">{formatDay(l.date, { day: "2-digit", month: "short" })}</td>
                <td className={cn("py-2", l.type === "DISCOUNT" && "italic text-[#2f5a43]")}>{prettyDates(l.description)}</td>
                <td className={cn("py-2 text-right font-mono", l.amountKobo < 0 && "text-[#2f5a43]")}>
                  {l.amountKobo < 0 ? "−" : ""}
                  {naira(Math.abs(l.amountKobo)).replace("₦", "")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-6 flex justify-end">
          <dl className="w-[300px] text-[12.5px]">
            <Row k="Subtotal" v={t.subtotalKobo} />
            {t.discountKobo !== 0 && <Row k="Discount" v={-t.discountKobo} />}
            {doc.taxes.map((x) => (
              <Row key={x.code} k={`${x.label} ${x.rateBps / 100}%${x.inclusive ? " (incl.)" : ""}`} v={x.amountKobo} />
            ))}
            {t.serviceChargeKobo !== 0 && <Row k="Service charge" v={t.serviceChargeKobo} />}
            <div className="mt-1.5 flex items-baseline justify-between border-t-2 border-[#1b1a17] pt-2">
              <dt className="text-[14px] font-medium">Total</dt>
              <dd className="font-mono text-[18px] font-medium">{naira(t.totalKobo)}</dd>
            </div>
            <Row k="Paid" v={-t.paidKobo} />
            <div className="mt-1 flex items-baseline justify-between rounded-[3px] px-2 py-1.5" style={{ background: t.balanceKobo > 0 ? "#f4e1c3" : "#dbe6dc" }}>
              <dt className="font-medium">{t.balanceKobo > 0 ? "Balance due" : t.balanceKobo < 0 ? "In credit" : "Balance"}</dt>
              <dd className="font-mono font-medium">{naira(Math.abs(t.balanceKobo))}</dd>
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
                    <td className="w-[92px] py-1.5 font-mono text-[11.5px] text-[#5b544a]">{formatDay(p.date, { day: "2-digit", month: "short" })}</td>
                    <td className="py-1.5">
                      {PAYMENT_METHODS[p.method].label}
                      {p.reference && <span className="ml-2 font-mono text-[11px] text-[#8a8175]">{p.reference}</span>}
                    </td>
                    <td className="py-1.5 font-mono text-[11px] text-[#8a8175]">{p.receiptNumber}</td>
                    <td className="w-[140px] py-1.5 text-right font-mono">{naira(p.amountKobo).replace("₦", "")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <footer className="mt-14 text-[11px] text-[#8a8175]">
          <AdireRule className="mb-4 h-2.5 opacity-60" count={34} />
          <div className="flex items-end justify-between gap-6">
            <p className="max-w-[420px] leading-relaxed">
              Thank you for staying with us. Amounts are in Nigerian naira and include the taxes shown.
              {doc.issuedBy ? ` Issued by ${doc.issuedBy.fullName}.` : ""}
            </p>
            <p className="font-mono text-[9.5px] uppercase tracking-[0.18em]">{doc.hotel.appName || config.appName}</p>
          </div>
        </footer>
      </div>
    </article>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div className="flex items-baseline justify-between py-1">
      <dt className="text-[#5b544a]">{k}</dt>
      <dd className="font-mono">
        {v < 0 ? "−" : ""}
        {naira(Math.abs(v))}
      </dd>
    </div>
  );
}

/* ---------------- 80mm thermal receipt ---------------- */

export function ReceiptSlip({ doc }: { doc: ReceiptDocument }) {
  const line = "- ".repeat(24);
  return (
    <article
      className="relative w-[302px] bg-[#ffffff] px-[14px] pb-8 pt-6 font-mono text-[12px] leading-[1.45] text-[#111] shadow-[0_24px_50px_-28px_rgb(60_40_20/0.5)] print:w-[80mm] print:px-[4mm] print:shadow-none"
      style={{ colorScheme: "light" }}
      aria-label={`Receipt ${doc.number}`}
    >
      {/* torn top edge on screen */}
      <span
        aria-hidden
        className="no-print absolute inset-x-0 -top-[6px] h-[6px]"
        style={{ background: "linear-gradient(135deg, transparent 50%, #fff 50%) 0 0/8px 6px repeat-x, linear-gradient(225deg, transparent 50%, #fff 50%) 4px 0/8px 6px repeat-x" }}
      />
      <div className="text-center">
        <p className="text-[15px] font-semibold uppercase tracking-wide">{doc.hotel.name}</p>
        <p className="text-[11px]">{doc.hotel.address}</p>
        <p className="text-[11px]">{placeLine(doc.hotel)}</p>
        <p className="text-[11px]">{formatPhone(doc.hotel.phone)}</p>
      </div>
      <p className="my-2 overflow-hidden whitespace-nowrap text-[#777]">{line}</p>
      <p className="text-center text-[13px] font-semibold tracking-[0.3em]">RECEIPT</p>
      <p className="text-center">{doc.number}</p>
      {doc.voided && <p className="mt-1 border-2 border-[#111] text-center text-[16px] font-bold tracking-[0.4em]">VOID</p>}
      <p className="my-2 overflow-hidden whitespace-nowrap text-[#777]">{line}</p>
      <Kv k="Date" v={`${formatDay(dayKeyOf(doc.issuedAt), { day: "2-digit", month: "short", year: "numeric" })} ${lagosHHMM(doc.issuedAt)}`} />
      {doc.guestName && <Kv k="Guest" v={doc.guestName} />}
      {doc.roomNumber && <Kv k="Room" v={doc.roomNumber} />}
      {doc.reservationCode && <Kv k="Booking" v={doc.reservationCode} />}
      <Kv k="Method" v={PAYMENT_METHODS[doc.method].label} />
      {doc.reference && <Kv k="Ref" v={doc.reference} />}
      <p className="my-2 overflow-hidden whitespace-nowrap text-[#777]">{line}</p>
      <div className="flex items-baseline justify-between">
        <span className="text-[13px] font-semibold">AMOUNT</span>
        <span className="text-[20px] font-semibold">{naira(doc.amountKobo)}</span>
      </div>
      <p className="mt-1 text-[11px] italic">{doc.amountInWords}</p>
      <p className="my-2 overflow-hidden whitespace-nowrap text-[#777]">{line}</p>
      <Kv k={doc.folioBalanceAfterKobo > 0 ? "Balance due" : doc.folioBalanceAfterKobo < 0 ? "In credit" : "Balance"} v={naira(Math.abs(doc.folioBalanceAfterKobo))} />
      {doc.receivedBy && <Kv k="Received by" v={doc.receivedBy.fullName} />}
      <p className="my-2 overflow-hidden whitespace-nowrap text-[#777]">{line}</p>
      <p className="text-center text-[11px]">Thank you. Keep this receipt.</p>
      <p className="mt-1 text-center text-[9.5px] uppercase tracking-[0.2em] text-[#777]">{doc.hotel.appName || config.appName}</p>
    </article>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="shrink-0 text-[#555]">{k}</span>
      <span className="truncate text-right">{v}</span>
    </div>
  );
}
