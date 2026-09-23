"use client";

import { useState } from "react";
import {
  ArrowsSplit,
  Bed,
  CloudArrowUp,
  ForkKnife,
  Minus,
  NotePencil,
  PaperPlaneTilt,
  Plus,
  Prohibit,
  Receipt,
  Trash,
  UserCircle,
  Wine,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { naira, relativeTime } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui/button";
import { draftCount, lineTotal, lineUnit, totalsFor, type TaxProfile, type Ticket, type TicketLine } from "./model";

export const TAB_ICON = { TABLE: ForkKnife, ROOM: Bed, TAB: Wine } as const;

export function ticketTitle(t: Pick<Ticket, "kind" | "label">) {
  return t.kind === "TABLE" ? `Table ${t.label}` : t.kind === "ROOM" ? `Room ${t.label}` : t.label;
}

/** Short chip label for the open-tickets strip. */
function chipLabel(t: Ticket) {
  return t.kind === "TABLE" ? `T${t.label}` : t.kind === "ROOM" ? `R${t.label}` : t.label;
}

export function TicketRail({
  ticket,
  open,
  tax,
  onSelect,
  onNew,
  onQty,
  onRemove,
  onNote,
  onVoid,
  onSend,
  onSplit,
  onSettle,
  sending,
  offline,
  canSettle = true,
  className,
}: {
  ticket: Ticket | null;
  open: Ticket[];
  tax?: TaxProfile;
  onSelect: (key: string) => void;
  onNew: () => void;
  onQty: (line: TicketLine, qty: number) => void;
  onRemove: (line: TicketLine) => void;
  onNote: (line: TicketLine) => void;
  onVoid: (line: TicketLine) => void;
  onSend: () => void;
  onSplit: () => void;
  onSettle: () => void;
  sending?: boolean;
  offline?: boolean;
  canSettle?: boolean;
  className?: string;
}) {
  const now = useNow(30_000);
  const [focus, setFocus] = useState<string | null>(null);
  const totals = ticket ? totalsFor(ticket, tax) : null;
  const drafts = ticket ? draftCount(ticket) : 0;
  const lines = ticket?.lines ?? [];
  const hasLive = lines.some((l) => l.state !== "VOID");
  const I = ticket ? TAB_ICON[ticket.kind] : ForkKnife;

  return (
    <aside aria-label="Ticket" className={cn("flex min-h-0 flex-col bg-surface", className)}>
      {/* open tickets */}
      <div className="flex items-center gap-1.5 border-b border-line px-3 py-2">
        <div className="scrollbar-thin flex min-w-0 flex-1 gap-1.5 overflow-x-auto" role="tablist" aria-label="Open tickets">
          {open.map((t) => {
            const on = t.key === ticket?.key;
            const d = draftCount(t);
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={on}
                onClick={() => onSelect(t.key)}
                className={cn(
                  "relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-sm border px-2.5 font-mono text-[12.5px] transition-colors",
                  on ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink hover:border-ink-faint",
                )}
                title={ticketTitle(t)}
              >
                {chipLabel(t)}
                {t.pending && <CloudArrowUp size={12} weight="bold" className={on ? "text-paper" : "text-ochre"} aria-label="waiting to sync" />}
                {d > 0 && <span className={cn("h-1.5 w-1.5 rounded-full", on ? "bg-laterite-ink" : "bg-laterite")} aria-label={`${d} not sent`} />}
              </button>
            );
          })}
        </div>
        <Button size="sm" variant="secondary" onClick={onNew} className="h-9 shrink-0" data-testid="pos-new-ticket">
          <Plus size={14} weight="bold" /> New
        </Button>
      </div>

      {!ticket ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
          <Receipt size={34} weight="thin" className="text-ink-faint" />
          <p className="display-sm text-[19px] text-ink">{open.length ? "Pick a ticket" : "No ticket open"}</p>
          <p className="text-[13.5px] leading-relaxed text-ink-muted">
            {open.length
              ? `${open.length} ${open.length === 1 ? "ticket is" : "tickets are"} open above. Tap one to add to it, or start a new one.`
              : "Start one for a table, a room or a bar tab, then tap the menu."}
          </p>
          <Button onClick={onNew} size="lg" className="mt-1">
            <Plus size={16} weight="bold" /> New ticket
          </Button>
        </div>
      ) : (
        <>
          {/* header */}
          <div className="flex items-start gap-3 px-4 pb-3 pt-3.5">
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line bg-paper text-ink-muted">
              <I size={18} weight="duotone" />
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="display-sm truncate text-[22px] leading-tight text-ink" data-testid="pos-ticket-title">
                {ticketTitle(ticket)}
              </h2>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-muted" suppressHydrationWarning>
                {ticket.number && <span className="font-mono">{ticket.number}</span>}
                {ticket.guestName && (
                  <span className="inline-flex items-center gap-1">
                    <UserCircle size={12} /> {ticket.guestName}
                  </span>
                )}
                {ticket.covers ? <span>{ticket.covers} covers</span> : null}
                <span>opened {relativeTime(ticket.openedAt, now)}</span>
              </p>
            </div>
          </div>

          {/* lines */}
          <ol className="scrollbar-thin min-h-0 flex-1 overflow-y-auto border-t border-line" aria-label="Items on the ticket">
            {lines.length === 0 && <li className="px-5 py-10 text-center text-[13.5px] text-ink-muted">Tap an item on the menu to add it.</li>}
            {lines.map((l) => {
              const on = focus === l.key;
              const voided = l.state === "VOID";
              return (
                <li key={l.key} className={cn("border-b border-dashed border-line last:border-b-0", on && "bg-surface-2/60")}>
                  <button
                    type="button"
                    onClick={() => setFocus(on ? null : l.key)}
                    aria-expanded={on}
                    className="flex w-full items-start gap-3 px-4 py-2.5 text-left"
                    data-testid={`line-${l.name}`}
                  >
                    <span
                      className={cn(
                        "mt-px grid h-6 min-w-6 place-items-center rounded-xs border px-1 font-mono text-[12.5px]",
                        voided ? "border-line text-ink-faint" : l.state === "DRAFT" ? "border-laterite text-laterite" : "border-line-strong text-ink",
                      )}
                    >
                      {l.qty}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block text-[14.5px] leading-snug", voided ? "text-ink-faint line-through" : "text-ink")}>{l.name}</span>
                      {(l.modifiers.length > 0 || l.note) && (
                        <span className="mt-0.5 block text-[12px] leading-snug text-ink-muted">
                          {l.modifiers.map((m) => m.name + (m.priceKobo ? ` +${naira(m.priceKobo)}` : "")).join(" · ")}
                          {l.note ? <span className="italic">{l.modifiers.length ? " · " : ""}&ldquo;{l.note}&rdquo;</span> : null}
                        </span>
                      )}
                      {voided && l.voidReason && <span className="mt-0.5 block text-[11.5px] text-danger">Void: {l.voidReason}</span>}
                    </span>
                    <span className="flex flex-col items-end gap-1">
                      <span className={cn("font-mono text-[13.5px]", voided ? "text-ink-faint line-through" : "text-ink")}>{naira(voided ? lineUnit(l) * l.qty : lineTotal(l))}</span>
                      {l.state === "DRAFT" ? (
                        <span className="inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.12em] text-laterite">
                          <span className="h-1.5 w-1.5 rounded-full bg-laterite" /> new
                        </span>
                      ) : l.state === "SENT" ? (
                        <span className="rounded-[2px] border border-line-strong px-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink-muted">{l.kot ? `KOT ${l.kot}` : "sent"}</span>
                      ) : null}
                    </span>
                  </button>
                  {on && !voided && (
                    <div className="flex flex-wrap items-center gap-1.5 px-4 pb-3 pl-[52px]">
                      {l.state === "DRAFT" ? (
                        <>
                          <div className="inline-flex h-10 items-stretch overflow-hidden rounded-md border border-line-strong bg-surface">
                            <button type="button" aria-label={`One less ${l.name}`} onClick={() => (l.qty > 1 ? onQty(l, l.qty - 1) : onRemove(l))} className="grid w-10 place-items-center text-ink-muted hover:bg-surface-2">
                              <Minus size={14} weight="bold" />
                            </button>
                            <span className="grid min-w-10 place-items-center border-x border-line font-mono text-[15px]">{l.qty}</span>
                            <button type="button" aria-label={`One more ${l.name}`} onClick={() => onQty(l, l.qty + 1)} className="grid w-10 place-items-center text-ink-muted hover:bg-surface-2">
                              <Plus size={14} weight="bold" />
                            </button>
                          </div>
                          <Button variant="secondary" className="h-10" onClick={() => onNote(l)}>
                            <NotePencil size={15} /> Note
                          </Button>
                          <Button variant="ghost" className="h-10 text-danger hover:bg-danger-wash hover:text-danger" onClick={() => { onRemove(l); setFocus(null); }}>
                            <Trash size={15} /> Remove
                          </Button>
                        </>
                      ) : (
                        <Button variant="secondary" className="h-10 text-danger" onClick={() => onVoid(l)}>
                          <Prohibit size={15} /> Void this item
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          {/* totals: a ruled ledger with dotted leaders */}
          {totals && (
            <div className="border-t border-line bg-paper/60 px-4 pb-3 pt-3">
              <dl className="space-y-1 text-[12.5px] text-ink-muted">
                <Leader k="Items" v={naira(totals.subtotalKobo)} />
                {totals.discountKobo > 0 && <Leader k="Discount" v={`−${naira(totals.discountKobo)}`} />}
                {totals.vatKobo > 0 && <Leader k={`VAT${tax?.vat.inclusive !== false ? ", included" : ""}`} v={naira(totals.vatKobo)} muted={tax?.vat.inclusive !== false} />}
                {totals.consumptionTaxKobo > 0 && (
                  <Leader k={`${tax?.consumptionTax.label ?? "Consumption tax"}${tax?.consumptionTax.inclusive !== false ? ", included" : ""}`} v={naira(totals.consumptionTaxKobo)} muted={tax?.consumptionTax.inclusive !== false} />
                )}
                {totals.serviceChargeKobo > 0 && <Leader k="Service charge" v={naira(totals.serviceChargeKobo)} />}
              </dl>
              <div className="mt-2 flex items-baseline justify-between border-t border-line-strong pt-2">
                <span className="display-sm text-[16px] italic text-ink">Total</span>
                <span className="font-mono text-[26px] leading-none tracking-tight text-ink" data-testid="pos-total">
                  {naira(totals.totalKobo)}
                </span>
              </div>
            </div>
          )}

          {/* actions */}
          <div className="grid grid-cols-[1fr_1fr] gap-2 border-t border-line p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button
              size="lg"
              className="col-span-2 h-14 text-[16px]"
              disabled={!drafts}
              loading={sending}
              onClick={onSend}
              data-testid="pos-send"
            >
              <PaperPlaneTilt size={18} weight="bold" />
              {drafts ? `Send ${drafts} to ${offline ? "the queue" : "kitchen"}` : "All sent"}
            </Button>
            <Button size="lg" variant="secondary" className="h-12" disabled={!hasLive} onClick={onSplit}>
              <ArrowsSplit size={17} weight="bold" /> Split
            </Button>
            <Button size="lg" variant="ink" className="h-12" disabled={!hasLive || !canSettle || !!ticket.pending} onClick={onSettle} data-testid="pos-settle">
              <Receipt size={17} weight="bold" /> Settle
            </Button>
          </div>
        </>
      )}
    </aside>
  );
}

function Leader({ k, v, muted }: { k: string; v: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline gap-2">
      <dt className="shrink-0">{k}</dt>
      <span aria-hidden className="mb-[3px] flex-1 border-b border-dotted border-line-strong" />
      <dd className={cn("font-mono", muted ? "text-ink-faint" : "text-ink")}>{v}</dd>
    </div>
  );
}
