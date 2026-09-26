"use client";

import { useState } from "react";
import { ChatCircleText, PaperPlaneTilt } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import type { RequestDetail } from "@/lib/api/types-m8";
import { useConciergeSettings } from "@/lib/api/hooks-m8";
import { firstName, naira } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { AffixInput, Field, Switch, Textarea } from "@/components/ui/form";
import { CONTACT } from "./catalog";
import { useRequestActions } from "./actions";

const VALIDITY = [2, 6, 24, 72];
const NOTE_HINT: Partial<Record<string, string>> = {
  WELLNESS: "A licensed therapist brings the table and oils; 90 minutes in your room.",
  DINING: "Three courses cooked in your suite; ingredients and the chef's time included.",
  TRANSPORT: "Car, driver and fuel for the day; tolls and parking extra.",
  ROMANCE_AND_CELEBRATION: "Roses, candles and a small cake, set up while you're at dinner.",
  SHOPPING: "Collected tomorrow morning and back by Friday afternoon.",
  PHOTOGRAPHY: "One hour around the hotel and the beach, 30 edited photos.",
};
const toKobo = (s: string) => {
  const n = Number(s.replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};

/**
 * The quote: a price, whether the hotel's taxes apply, how long it holds and a line for the guest,
 * with the message roughly as the guest reads it. The server works out the taxes (API-M8 8.1).
 */
export function QuoteComposer({ r, onDone }: { r: RequestDetail; onDone?: () => void }) {
  const { quote } = useRequestActions();
  const settings = useConciergeSettings();
  const [amount, setAmount] = useState(r.quote ? String(r.quote.amountKobo / 100) : r.price ? String(r.price.amountKobo / 100) : "");
  const [taxable, setTaxable] = useState(r.quote ? r.quote.taxKobo > 0 : true);
  const [hours, setHours] = useState<number | null>(null);
  const [note, setNote] = useState(r.quote?.note ?? "");
  const validHours = hours ?? settings.data?.quoteValidityHours ?? 24;
  const kobo = toKobo(amount);
  const guest = r.guest ? firstName(r.guest.fullName) : "there";
  const what = r.discreet ? `your private request ${r.number}` : r.service ? `the ${r.title.charAt(0).toLowerCase()}${r.title.slice(1)}` : `your request ${r.number}`;
  const preview = `Hello ${guest}, ${what} would be ${naira(kobo)}${taxable ? " plus any taxes" : ""}.${note.trim() ? ` ${note.trim()}` : ""} Reply YES to go ahead or NO to leave it. The link lets you pay now or add it to your bill; it holds for ${validHours} hours.`;
  const choices = [...new Set([...VALIDITY, settings.data?.quoteValidityHours ?? 24])].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-4" data-testid="quote-composer">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Field label="Price" htmlFor={`q-amt-${r.id}`} hint={r.vendor ? `Include ${r.vendor.name}'s fee and your margin.` : undefined}>
          <AffixInput id={`q-amt-${r.id}`} prefix="₦" inputMode="decimal" className="font-mono" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="45000" data-testid="quote-amount" />
        </Field>
        <div className="flex items-end pb-2">
          <Switch checked={taxable} onChange={setTaxable} label={<span className="text-[13px]">Add our taxes</span>} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-medium text-ink">Holds for</span>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Holds for">
          {choices.map((h) => (
            <button key={h} type="button" role="radio" aria-checked={validHours === h} onClick={() => setHours(h)} className={cn("h-8 rounded-sm border px-2.5 font-mono text-[12px]", validHours === h ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:text-ink")}>
              {h < 24 ? `${h} h` : `${h / 24} ${h === 24 ? "day" : "days"}`}
            </button>
          ))}
        </div>
      </div>
      <Field label="A line for the guest" htmlFor={`q-note-${r.id}`} optional hint="Plain words: what's included, where, how long.">
        <Textarea id={`q-note-${r.id}`} className="min-h-16" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={NOTE_HINT[r.category ?? "OTHER"] ?? "Everything that's included, where and for how long."} data-testid="quote-note" />
      </Field>

      <div className="rounded-md border border-line bg-surface-2/50">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-[11.5px] text-ink-muted">
          <ChatCircleText size={14} weight="duotone" /> By {CONTACT[r.contactPreference]}, roughly as the guest reads it
        </div>
        <p className="px-3 py-2.5 text-[13px] leading-relaxed text-ink" data-testid="quote-preview">
          {kobo ? preview : <span className="text-ink-faint">Type a price to see the message.</span>}
        </p>
        {r.discreet && <p className="border-t border-line px-3 py-2 text-[11.5px] text-ink-muted">Private: the message names the request number, never the service.</p>}
      </div>

      <div className="flex items-center gap-3">
        <p className="mr-auto text-[11.5px] leading-snug text-ink-muted">{taxable ? "Taxes follow your settings; the guest's total shows here once it's sent." : "No taxes added."}</p>
        <Button onClick={() => quote.mutate({ id: r.id, amountKobo: kobo, taxable, validHours, note: note.trim() || null }, { onSuccess: () => onDone?.() })} loading={quote.isPending} disabled={kobo <= 0} data-testid="send-quote">
          <PaperPlaneTilt size={15} /> {r.quote ? "Send new quote" : "Send quote"}
        </Button>
      </div>
    </div>
  );
}
