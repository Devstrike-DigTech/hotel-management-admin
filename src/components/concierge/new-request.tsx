"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MagnifyingGlass } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useReservations } from "@/lib/api/hooks-m2";
import { conciergeApi } from "@/lib/api/endpoints-m8";
import { qk8, useConciergeServices } from "@/lib/api/hooks-m8";
import type { ContactPreference } from "@/lib/api/types-m8";
import type { FormField, PublicBookingForm } from "@/lib/api/types-m7";
import { addDays, todayKey } from "@/lib/dates";
import { toast } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/overlay";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { FormAnswers, checkAnswers, cleanAnswers, type StayContext } from "@/components/guest-form/renderer";
import { CONTACT, categoryMeta, pricingLabel } from "./catalog";
import { DISCREET_HOLDERS, SealGlyph } from "./bits";

/** A service's questions as a one-section form, so the M7 renderer (conditions included) draws them. */
export function serviceForm(questions: FormField[], name = "About the request"): PublicBookingForm {
  const fields = [...questions].sort((a, b) => a.order - b.order).map((f) => ({ ...f, section: name }));
  return {
    formVersionId: null,
    version: null,
    preview: true,
    channel: "FRONT_DESK",
    sections: [{ name, order: 0, fieldKeys: fields.map((f) => f.key) }],
    fields,
    rules: { emailRequiredFor: [], phoneDefaultCountry: "NG", consentRequired: false },
    extras: [],
    pickup: null,
    uploads: { enabled: false, maxFileMB: 5 },
  };
}

/** The front desk takes a request on a guest's behalf (API-M8 6.3). */
export function NewRequestSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const qc = useQueryClient();
  const services = useConciergeServices(open);
  const [term, setTerm] = useState("");
  const res = useReservations({ q: term, status: "CHECKED_IN,CONFIRMED", pageSize: 6 }, open && term.trim().length >= 2);
  const [resId, setResId] = useState<string | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [text, setText] = useState("");
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [when, setWhen] = useState("");
  const [party, setParty] = useState("1");
  const [notes, setNotes] = useState("");
  const [discreet, setDiscreet] = useState(false);
  const [contact, setContact] = useState<ContactPreference>("WHATSAPP");

  const live = (services.data ?? []).filter((s) => s.active && s.reviewStatus === "LIVE" && s.channels.includes("FRONT_DESK"));
  const svc = live.find((s) => s.id === serviceId) ?? null;
  const form = svc ? serviceForm(svc.questions) : null;
  const picked = res.data?.items.find((r) => r.id === resId) ?? null;
  const stay: StayContext = { arrival: todayKey(), departure: addDays(todayKey(), 1), adults: Number(party) || 1, children: 0 };

  const reset = () => {
    setTerm("");
    setResId(null);
    setServiceId("");
    setVariantId("");
    setText("");
    setAnswers({});
    setErrors({});
    setWhen("");
    setParty("1");
    setNotes("");
    setDiscreet(false);
  };

  const create = useMutation({
    mutationFn: () =>
      conciergeApi.createRequest({
        reservationId: resId ?? undefined,
        serviceId: svc?.id,
        variantId: variantId || undefined,
        requestText: svc ? undefined : text.trim(),
        answers: form ? cleanAnswers(form, answers, stay) : undefined,
        preferredStart: when ? new Date(when).toISOString() : undefined,
        partySize: Number(party) || undefined,
        notes: notes.trim() || undefined,
        discreet,
        contactPreference: contact,
      }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: qk8.all });
      toast.success(`${r.number} opened`, r.flagged ? "Held for a manager to look at first." : "It's on the board.");
      reset();
      onOpenChange(false);
      router.push(`/concierge/requests/${r.id}`);
    },
    meta: { errorTitle: "Request not opened" },
  });

  const submit = () => {
    if (form) {
      const e = checkAnswers(form, answers, stay);
      setErrors(e);
      if (Object.keys(e).length) return;
    }
    create.mutate();
  };
  const ready = !!resId && (svc ? !svc.variants.length || !!variantId : text.trim().length >= 3);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      width="max-w-xl"
      eyebrow="Concierge"
      title="Request for a guest"
      description="Taken at the desk or on the phone. The guest is told on the channel they prefer."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="mr-auto">
            Cancel
          </Button>
          <Button onClick={submit} loading={create.isPending} disabled={!ready} data-testid="create-request">
            Open request
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Guest" htmlFor="nr-guest" hint={picked ? undefined : "In the house or arriving. A name, booking code or room."}>
          {picked ? (
            <div className="flex items-center gap-3 rounded-md border border-line bg-surface-2/50 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] text-ink">{picked.guest.fullName}</p>
                <p className="font-mono text-[11.5px] text-ink-muted">
                  {picked.code}
                  {picked.room ? ` · room ${picked.room.number}` : ""}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setResId(null)}>
                Change
              </Button>
            </div>
          ) : (
            <>
              <div className="relative">
                <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                <Input id="nr-guest" className="pl-9" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Okafor, PWH-7K3Q or 204" data-testid="nr-guest" autoComplete="off" />
              </div>
              {!!res.data?.items.length && (
                <ul className="mt-1 divide-y divide-line rounded-md border border-line">
                  {res.data.items.map((r) => (
                    <li key={r.id}>
                      <button type="button" onClick={() => setResId(r.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2" data-testid="nr-guest-option">
                        <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{r.guest.fullName}</span>
                        <span className="font-mono text-[11.5px] text-ink-muted">{r.room ? r.room.number : r.code}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </Field>

        <Field label="What they'd like" htmlFor="nr-service">
          <Select
            id="nr-service"
            value={serviceId}
            onChange={(e) => {
              setServiceId(e.target.value);
              setVariantId("");
              setAnswers({});
              setDiscreet(false);
            }}
            data-testid="nr-service"
          >
            <option value="">Something else (describe it)</option>
            {live.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} &middot; {categoryMeta(s.category).label} &middot; {s.priceLabel}
              </option>
            ))}
          </Select>
        </Field>
        {svc && (
          <p className="-mt-3 text-[12px] text-ink-muted">
            {pricingLabel(svc.pricing)}
            {svc.fulfilledBy === "VENDOR" && svc.vendor ? ` · by ${svc.vendor.name}` : ""}
          </p>
        )}
        {svc && svc.variants.length > 0 && (
          <Field label="Which one" htmlFor="nr-variant">
            <Select id="nr-variant" value={variantId} onChange={(e) => setVariantId(e.target.value)}>
              <option value="">Choose</option>
              {svc.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {!svc && (
          <Field label="In their words" htmlFor="nr-text" hint="Anything lawful the hotel can arrange. A request that may fall outside that is held for a manager.">
            <Textarea id="nr-text" className="min-h-16" value={text} maxLength={1000} onChange={(e) => setText(e.target.value)} placeholder="A tailor to take in a suit before Friday" data-testid="nr-text" />
          </Field>
        )}
        {form && form.fields.length > 0 && <FormAnswers form={form} answers={answers} onAnswers={setAnswers} extras={[]} onExtras={() => {}} stay={stay} errors={errors} />}

        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
          <Field label="When" htmlFor="nr-when" optional>
            <Input id="nr-when" type="datetime-local" className="font-mono" value={when} onChange={(e) => setWhen(e.target.value)} />
          </Field>
          <Field label="People" htmlFor="nr-party">
            <Input id="nr-party" type="number" min={1} max={50} className="font-mono" value={party} onChange={(e) => setParty(e.target.value)} />
          </Field>
        </div>
        <Field label="Notes" htmlFor="nr-notes" optional>
          <Textarea id="nr-notes" className="min-h-16" maxLength={1000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>

        <Field label="How to reach them" htmlFor="nr-contact" hint={discreet ? "Never the room phone for a private request." : undefined}>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="How to reach them" id="nr-contact">
            {(Object.keys(CONTACT) as ContactPreference[]).map((c) => (
              <button key={c} type="button" role="radio" aria-checked={contact === c} onClick={() => setContact(c)} className={cn("h-8 rounded-sm border px-2.5 text-[12.5px]", contact === c ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:text-ink")}>
                {CONTACT[c]}
              </button>
            ))}
          </div>
        </Field>

        <div className={cn("rounded-md border px-4 py-3", discreet ? "border-[color-mix(in_oklab,var(--brass)_45%,transparent)] bg-brass-wash/40" : "border-line")}>
          <Switch
            checked={discreet}
            onChange={setDiscreet}
            disabled={!!svc && !svc.discreetEligible}
            label={
              <span className="inline-flex items-center gap-1.5 text-[14px]">
                <SealGlyph size={14} className="text-brass" /> Private
              </span>
            }
            description={svc && !svc.discreetEligible ? "This service isn't offered privately." : `Only ${DISCREET_HOLDERS} see what it is and who asked. The bill uses your neutral wording.`}
          />
        </div>
      </div>
    </Sheet>
  );
}
