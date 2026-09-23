"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Ticket } from "@phosphor-icons/react";
import { usePromo, usePromos } from "@/lib/api/hooks-m4";
import { promoApi } from "@/lib/api/endpoints-m4";
import type { PromoCode, PromoType, RateChannel } from "@/lib/api/types-m4";
import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/store";
import { formatDay } from "@/lib/dates";
import { naira, nairaCompact, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/overlay";
import { Field, Input, Switch } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, Segmented, Skeleton, Stat } from "@/components/ui/primitives";
import { ChipRadio, NairaInput, Stepper } from "@/components/m2/bits";
import { CHANNELS } from "@/components/rates/plans-view";

const STATUS: Record<PromoCode["status"], { label: string; tone: "palm" | "brass" | "neutral" | "ochre" | "danger" }> = {
  ACTIVE: { label: "Live", tone: "palm" },
  SCHEDULED: { label: "Scheduled", tone: "brass" },
  EXPIRED: { label: "Expired", tone: "neutral" },
  USED_UP: { label: "Used up", tone: "ochre" },
  INACTIVE: { label: "Paused", tone: "neutral" },
};

export function promoValue(p: Pick<PromoCode, "type" | "value">) {
  if (p.type === "PERCENT") return `${p.value / 100}% off`;
  if (p.type === "AMOUNT") return `${naira(p.value)} off`;
  return `stay ${p.value}, pay ${p.value - 1}`;
}

export function PromosView() {
  const [status, setStatus] = useState("");
  const promos = usePromos(status ? { status } : {});
  const all = usePromos({});
  const { can } = useCan();
  const [open, setOpen] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const items = promos.data ?? [];
  const live = (all.data ?? []).filter((p) => p.status === "ACTIVE");
  const totals = (all.data ?? []).reduce((a, p) => ({ uses: a.uses + p.uses, disc: a.disc + p.discountGivenKobo, rev: a.rev + p.revenueKobo }), { uses: 0, disc: 0, rev: 0 });

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Ticket size={14} weight="duotone" /> Promo codes
          </>
        }
        title={
          <>
            A reason to book <em>this week</em>.
          </>
        }
        description="Codes guests type at checkout and the desk types for them. Each use is counted when the booking is confirmed and given back if it's cancelled. Promo discounts are pre-approved, so they never need the second key."
        actions={
          can("promotions.manage") && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={15} weight="bold" /> New code
            </Button>
          )
        }
      />
      <Panel className="mb-6 grid grid-cols-2 gap-6 p-5 md:grid-cols-4">
        <Stat label="Live codes" value={all.data ? live.length : "-"} sub={`${(all.data ?? []).length} in all`} />
        <Stat label="Times used" value={all.data ? totals.uses : "-"} sub="confirmed bookings" />
        <Stat label="Given away" value={all.data ? nairaCompact(totals.disc) : "-"} sub="in discounts" />
        <Stat label="Brought in" value={all.data ? nairaCompact(totals.rev) : "-"} sub={totals.disc ? `${(totals.rev / totals.disc).toFixed(1)} naira per naira off` : "room revenue"} />
      </Panel>
      <ChipRadio
        label="Status"
        className="mb-4"
        value={status}
        onChange={setStatus}
        options={[
          { value: "", label: "All" },
          { value: "ACTIVE", label: "Live" },
          { value: "SCHEDULED", label: "Scheduled" },
          { value: "USED_UP", label: "Used up" },
          { value: "EXPIRED", label: "Expired" },
        ]}
      />
      {promos.isError ? (
        <Panel>
          <ErrorState error={promos.error} onRetry={() => promos.refetch()} />
        </Panel>
      ) : !promos.data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : !items.length ? (
        <Panel>
          <EmptyState glyph="arcs" title="No codes here" body="Make one for a slow week, a partner, or first-time guests." />
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map((p) => (
            <Stub key={p.id} p={p} onOpen={() => setOpen(p.id)} />
          ))}
        </div>
      )}
      <PromoSheet id={open} onOpenChange={(o) => !o && setOpen(null)} />
      <PromoDialog open={creating} onOpenChange={setCreating} />
    </>
  );
}

/** A promo code drawn as a torn-off ticket stub. */
function Stub({ p, onOpen }: { p: PromoCode; onOpen: () => void }) {
  const cap = p.maxUses ?? null;
  const used = p.uses + p.held;
  const dim = p.status === "EXPIRED" || p.status === "INACTIVE";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn("group relative flex overflow-hidden rounded-lg border border-line bg-surface text-left transition-[border-color,transform] hover:-translate-y-px hover:border-line-strong", dim && "opacity-70")}
      data-testid={`promo-${p.code}`}
    >
      <div className="relative flex w-[132px] shrink-0 flex-col justify-between border-r border-dashed border-line-strong bg-[color-mix(in_oklab,var(--brass-wash)_55%,var(--surface))] px-4 py-4">
        <span className="absolute -right-[7px] -top-[7px] h-3.5 w-3.5 rounded-full border border-line bg-paper" aria-hidden />
        <span className="absolute -bottom-[7px] -right-[7px] h-3.5 w-3.5 rounded-full border border-line bg-paper" aria-hidden />
        <span className="eyebrow text-[9.5px]">Code</span>
        <span className="break-all font-mono text-[17px] font-medium leading-tight tracking-wide text-ink">{p.code}</span>
        <span className="display-sm text-[15px] italic text-brass">{promoValue(p)}</span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-2 px-4 py-4">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-[13.5px] leading-snug text-ink">{p.description}</p>
          <Badge tone={STATUS[p.status].tone} dot>
            {STATUS[p.status].label}
          </Badge>
        </div>
        <div>
          <div className="flex items-baseline justify-between text-[11.5px] text-ink-muted">
            <span>
              <span className="font-mono text-ink">{p.uses}</span> used{p.held ? <>, {p.held} on hold</> : null}
            </span>
            <span className="font-mono">{cap ? `of ${cap}` : "no cap"}</span>
          </div>
          <div className="mt-1 flex h-1.5 gap-[2px] overflow-hidden rounded-[2px] bg-surface-2" role="meter" aria-label="Uses" aria-valuenow={used} aria-valuemin={0} aria-valuemax={cap ?? undefined}>
            {cap ? (
              <>
                <span className="h-full bg-ink/80" style={{ width: `${Math.min(100, (p.uses / cap) * 100)}%` }} />
                {p.held > 0 && <span className="hatch h-full text-ink" style={{ width: `${(p.held / cap) * 100}%` }} />}
              </>
            ) : (
              <span className="h-full w-full bg-ink/15" />
            )}
          </div>
        </div>
        <p className="mt-auto flex flex-wrap gap-x-3 text-[11.5px] text-ink-faint">
          <span>{nairaCompact(p.discountGivenKobo)} off</span>
          <span>{nairaCompact(p.revenueKobo)} booked</span>
          {p.validTo && <span>until {formatDay(p.validTo, { day: "numeric", month: "short", year: "numeric" })}</span>}
          {p.minNights && <span>{p.minNights}+ nights</span>}
        </p>
      </div>
    </button>
  );
}

function PromoSheet({ id, onOpenChange }: { id: string | null; onOpenChange: (o: boolean) => void }) {
  const q = usePromo(id);
  const qc = useQueryClient();
  const { can } = useCan();
  const toggle = useMutation({
    mutationFn: (active: boolean) => promoApi.update(id!, { active }),
    onSuccess: async (p) => {
      await qc.invalidateQueries({ queryKey: ["promos"] });
      toast.success(p.active ? `${p.code} is live` : `${p.code} paused`);
    },
    meta: { errorTitle: "Not changed" },
  });
  const p = q.data;
  const chTotal = p ? Object.values(p.byChannel).reduce((s, v) => s + v, 0) : 0;
  return (
    <Sheet open={!!id} onOpenChange={onOpenChange} eyebrow="Promo code" title={p ? <span className="font-mono">{p.code}</span> : "..."} description={p?.description} width="sm:max-w-[480px]">
      {!p ? (
        <Skeleton className="h-64" />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-3 gap-4">
            <Stat label="Used" value={p.uses} sub={p.maxUses ? `of ${p.maxUses}` : "no cap"} />
            <Stat label="Off" value={nairaCompact(p.discountGivenKobo)} />
            <Stat label="Booked" value={nairaCompact(p.revenueKobo)} />
          </div>
          <section>
            <h3 className="eyebrow mb-2">Where it was used</h3>
            <div className="flex h-3 gap-[2px] overflow-hidden rounded-[2px]">
              {CHANNELS.map((c, i) =>
                p.byChannel[c.value] ? (
                  <span key={c.value} style={{ width: `${(p.byChannel[c.value] / Math.max(1, chTotal)) * 100}%`, background: ["var(--season-1)", "var(--season-2)", "var(--season-3)"][i] }} title={`${c.label}: ${p.byChannel[c.value]}`} />
                ) : null,
              )}
            </div>
            <ul className="mt-2 flex flex-wrap gap-x-4 text-[12px] text-ink-muted">
              {CHANNELS.map((c, i) => (
                <li key={c.value} className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-[2px]" style={{ background: ["var(--season-1)", "var(--season-2)", "var(--season-3)"][i] }} />
                  {c.label} <span className="font-mono text-ink">{p.byChannel[c.value] ?? 0}</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h3 className="eyebrow mb-2">The rules</h3>
            <dl className="grid grid-cols-[130px_1fr] gap-y-1.5 text-[13px]">
              <dt className="text-ink-muted">Gives</dt>
              <dd className="text-ink">{promoValue(p)}</dd>
              <dt className="text-ink-muted">Book between</dt>
              <dd className="text-ink">{p.validFrom || p.validTo ? `${p.validFrom ? formatDay(p.validFrom) : "now"} and ${p.validTo ? formatDay(p.validTo) : "any time"}` : "Any time"}</dd>
              <dt className="text-ink-muted">Stays between</dt>
              <dd className="text-ink">{p.stayFrom || p.stayTo ? `${p.stayFrom ? formatDay(p.stayFrom) : "any"} and ${p.stayTo ? formatDay(p.stayTo) : "any"}` : "Any dates"}</dd>
              <dt className="text-ink-muted">Minimum stay</dt>
              <dd className="text-ink">{p.minNights ? `${p.minNights} nights` : "None"}</dd>
              <dt className="text-ink-muted">Per guest</dt>
              <dd className="text-ink">{p.perGuestLimit ? `${p.perGuestLimit} time${p.perGuestLimit === 1 ? "" : "s"}` : "No limit"}{p.firstBookingOnly ? ", first stay only" : ""}</dd>
            </dl>
          </section>
          <section>
            <h3 className="eyebrow mb-2">Latest uses</h3>
            {p.redemptions.length ? (
              <ul className="divide-y divide-line rounded-md border border-line">
                {p.redemptions.map((r) => (
                  <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-[12.5px]">
                    <a href={`/reservations/${r.reservationId}`} className="font-mono text-ink hover:text-laterite">
                      {r.reservationCode}
                    </a>
                    <span className="min-w-0 flex-1 truncate text-ink-muted">{r.guestName}</span>
                    {r.status !== "CONFIRMED" && <Badge tone={r.status === "HELD" ? "brass" : "neutral"}>{r.status === "HELD" ? "On hold" : "Given back"}</Badge>}
                    <span className="font-mono text-ink">{naira(r.discountKobo)}</span>
                    <span className="w-16 text-right text-[11px] text-ink-faint">{relativeTime(r.createdAt)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[13px] text-ink-muted">Not used yet.</p>
            )}
          </section>
          {can("promotions.manage") && <Switch checked={p.active} onChange={(v) => toggle.mutate(v)} label="On" description="Paused codes are refused at checkout with a clear message." />}
        </div>
      )}
    </Sheet>
  );
}

function PromoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ code: "", description: "", type: "PERCENT" as PromoType, pct: 10, amount: null as number | null, nights: 4, validTo: "", minNights: 0, maxUses: 0, perGuest: 1, first: false, channels: ["FRONT_DESK", "BOOKING_SITE", "MARKETPLACE"] as RateChannel[] });
  const m = useMutation({
    mutationFn: () =>
      promoApi.create({
        code: f.code.trim().toUpperCase(),
        description: f.description.trim(),
        type: f.type,
        value: f.type === "PERCENT" ? f.pct * 100 : f.type === "AMOUNT" ? (f.amount ?? 0) : f.nights,
        validTo: f.validTo || null,
        minNights: f.type === "FREE_NIGHT" ? f.nights : f.minNights || null,
        maxUses: f.maxUses || null,
        perGuestLimit: f.perGuest || null,
        firstBookingOnly: f.first,
        channels: f.channels,
        active: true,
      }),
    onSuccess: async (p) => {
      await qc.invalidateQueries({ queryKey: ["promos"] });
      toast.success(`${p.code} is live`, promoValue(p));
      onOpenChange(false);
    },
    meta: { errorTitle: "Code not saved" },
  });
  const valid = /^[A-Z0-9]{3,20}$/.test(f.code.trim().toUpperCase()) && f.description.trim().length >= 3 && (f.type !== "AMOUNT" || !!f.amount);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Promo code"
      title="A new code"
      className="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!valid} loading={m.isPending} onClick={() => m.mutate()}>
            Make it live
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
          <Field label="Code" htmlFor="pc-code" hint="Letters and numbers">
            <Input id="pc-code" value={f.code} onChange={(e) => setF({ ...f, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} className="font-mono tracking-wide" placeholder="SALLAH15" autoFocus />
          </Field>
          <Field label="What it's for" htmlFor="pc-desc">
            <Input id="pc-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Sallah weekend, 15% off" />
          </Field>
        </div>
        <Segmented<PromoType>
          label="Type"
          size="sm"
          value={f.type}
          onChange={(v) => setF({ ...f, type: v })}
          options={[
            { value: "PERCENT", label: "% off" },
            { value: "AMOUNT", label: "₦ off" },
            { value: "FREE_NIGHT", label: "Free night" },
          ]}
        />
        {f.type === "PERCENT" && <Stepper label="percent off" value={f.pct} onChange={(v) => setF({ ...f, pct: v })} min={1} max={90} suffix="%" />}
        {f.type === "AMOUNT" && <NairaInput kobo={f.amount} onChange={(v) => setF({ ...f, amount: v })} aria-label="Amount off the stay" className="max-w-[220px]" />}
        {f.type === "FREE_NIGHT" && (
          <div className="flex items-center gap-3">
            <Stepper label="nights" value={f.nights} onChange={(v) => setF({ ...f, nights: v })} min={2} max={14} suffix="nights" />
            <span className="text-[12.5px] text-ink-muted">
              stay {f.nights}, the cheapest night is free
            </span>
          </div>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Book by" htmlFor="pc-to" optional>
            <Input id="pc-to" type="date" value={f.validTo} onChange={(e) => setF({ ...f, validTo: e.target.value })} className="font-mono" />
          </Field>
          <Field label="Uses in all" optional>
            <Stepper label="uses" value={f.maxUses} onChange={(v) => setF({ ...f, maxUses: v })} min={0} max={9999} suffix={f.maxUses ? "" : "any"} />
          </Field>
          <Field label="Per guest" optional>
            <Stepper label="per guest" value={f.perGuest} onChange={(v) => setF({ ...f, perGuest: v })} min={0} max={20} suffix={f.perGuest ? "" : "any"} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CHANNELS.map((c) => {
            const on = f.channels.includes(c.value);
            return (
              <button
                key={c.value}
                type="button"
                aria-pressed={on}
                onClick={() => setF({ ...f, channels: on ? f.channels.filter((x) => x !== c.value) : [...f.channels, c.value] })}
                className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px]", on ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}
              >
                {c.icon} {c.label}
              </button>
            );
          })}
        </div>
        <Switch checked={f.first} onChange={(v) => setF({ ...f, first: v })} label="First stay only" description="Refused for guests who have stayed before (by phone number)." />
      </div>
    </Dialog>
  );
}
