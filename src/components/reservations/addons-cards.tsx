"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowSquareOut, Eye, EyeSlash, FileText, Minus, Plus, ShieldCheck, ShoppingBag, Trash, Van } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useCan } from "@/lib/permissions";
import type { ReservationDetailM7 } from "@/lib/api/types-m2";
import type { PickupAnswer } from "@/lib/api/types-m7";
import { reservationAddOnsApi } from "@/lib/api/endpoints-m7";
import { useExtras, usePickupPoints, useTrainRoutes, useTransportCompanies } from "@/lib/api/hooks-m7";
import { useEntitlements } from "@/lib/auth";
import { EXTRA_CATEGORIES, kindMeta, pricingUnit } from "@/lib/m7-catalog";
import { formatDay, lagosHHMM, dayKeyOf } from "@/lib/dates";
import { naira } from "@/lib/format";
import { toast } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { Select } from "@/components/ui/form";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { CatalogIcon } from "@/components/m7/icon";
import { StatusChip } from "@/components/transfers/transfers-view";
import { PickupBlock, pickupProblems, transfersFromPickup } from "@/components/guest-form/pickup-block";

const CHANNEL_NAME = { MARKETPLACE: "marketplace", BOOKING_SITE: "booking site", FRONT_DESK: "front desk" } as const;

/** What the guest told us through the booking form. */
export function AnswersCard({ r }: { r: ReservationDetailM7 }) {
  const { can } = useCan();
  const [shown, setShown] = useState<Set<string>>(new Set());
  const bf = r.bookingForm;
  if (!bf || !bf.answers.length) return null;
  const sections = [...new Set(bf.answers.map((a) => a.section))];
  const mayReveal = can("guests.reveal_id") || can("guests.export");
  return (
    <Panel data-testid="answers-card">
      <PanelHeader eyebrow={`Form v${bf.version} · ${CHANNEL_NAME[bf.channel]}`} title="What the guest told us" />
      <div className="flex flex-col gap-4 px-5 py-4">
        {sections.map((s) => (
          <div key={s}>
            <p className="eyebrow mb-1.5 text-[10px]">{s}</p>
            <dl className="flex flex-col gap-1.5">
              {bf.answers
                .filter((a) => a.section === s)
                .map((a) => {
                  const masked = a.sensitive && !shown.has(a.key);
                  return (
                    <div key={a.key} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-3 text-[13px]" data-answer={a.key}>
                      <dt className="text-ink-muted">{a.label}</dt>
                      <dd className="flex min-w-0 items-start gap-1.5 text-ink">
                        {a.file ? (
                          <a href={a.file.url} target="_blank" rel="noreferrer" className="inline-flex min-w-0 items-center gap-1 text-laterite hover:underline">
                            <FileText size={13} className="shrink-0" /> <span className="truncate">{a.file.name}</span>
                          </a>
                        ) : (
                          <span className={cn("min-w-0 break-words", masked && "font-mono tracking-widest text-ink-faint")}>{masked ? "••••••" : a.display}</span>
                        )}
                        {a.sensitive && mayReveal && !a.file && (
                          <button type="button" onClick={() => setShown((x) => new Set(x.has(a.key) ? [...x].filter((k) => k !== a.key) : [...x, a.key]))} aria-label={masked ? `Show ${a.label}` : `Hide ${a.label}`} className="mt-0.5 shrink-0 text-ink-faint hover:text-ink">
                            {masked ? <Eye size={13} /> : <EyeSlash size={13} />}
                          </button>
                        )}
                        {a.sensitive && !mayReveal && <ShieldCheck size={12} weight="fill" className="mt-0.5 shrink-0 text-adire" aria-label="Sensitive" />}
                      </dd>
                    </div>
                  );
                })}
            </dl>
          </div>
        ))}
        {r.billTo && (
          <p className="rounded-sm border border-dashed border-line px-3 py-2 text-[12.5px] text-ink-muted">
            Invoice to <span className="text-ink">{r.billTo.companyName}</span>
            {r.billTo.tin && <span className="font-mono"> &middot; TIN {r.billTo.tin}</span>}
          </p>
        )}
      </div>
    </Panel>
  );
}

/** Extras and transfers on the booking: add, remove, see where each stands. */
export function AddOnsPanel({ r, onChanged }: { r: ReservationDetailM7; onChanged: () => void }) {
  const { can } = useCan();
  const { has } = useEntitlements();
  const edit = can("reservations.edit") && !["CHECKED_OUT", "CANCELLED", "NO_SHOW"].includes(r.status);
  const extras = (r.extras ?? []).filter((e) => e.status === "ACTIVE");
  const transfers = r.transfers ?? [];
  const [addExtra, setAddExtra] = useState(false);
  const [addPickup, setAddPickup] = useState(false);
  const [remove, setRemove] = useState<{ kind: "extra" | "transfer"; id: string; label: string; posted: boolean } | null>(null);
  const qc = useQueryClient();
  const done = () => {
    onChanged();
    void qc.invalidateQueries({ queryKey: ["transfers"] });
  };
  if (!has("paid_extras") && !extras.length && !transfers.length) return null;
  return (
    <Panel data-testid="addons-panel">
      <PanelHeader
        eyebrow="Add-ons"
        title="Extras and pickups"
        description={r.addOnsTotalKobo ? <>Together <span className="font-mono text-ink">{naira(r.addOnsTotalKobo)}</span> with tax. {r.status === "CHECKED_IN" ? "On the folio as they are added." : "Posted to the folio at check-in, or when paid online."}</> : undefined}
        actions={
          edit &&
          has("paid_extras") && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setAddExtra(true)} data-testid="add-extra-to-booking">
                <ShoppingBag size={14} /> Extra
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setAddPickup(true)}>
                <Van size={14} /> Pickup
              </Button>
            </>
          )
        }
      />
      {!extras.length && !transfers.length ? (
        <p className="px-5 py-5 text-[13px] text-ink-muted">None yet. Breakfast, a late check-out or a pickup from the park can be added any time.</p>
      ) : (
        <ul className="divide-y divide-line">
          {extras.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-5 py-3" data-reservation-extra={e.name}>
              <CatalogIcon name={EXTRA_CATEGORIES.find((c) => c.value === e.category)?.icon ?? "ShoppingBag"} size={16} className="shrink-0 text-ink-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] text-ink">{e.description || e.name}</p>
                <p className="text-[11.5px] text-ink-muted">
                  {naira(e.unitPriceKobo)} {pricingUnit(e.pricing)} &middot; {e.source === "ONLINE" ? "booked online" : "added at the desk"}
                  {e.posted ? " · on the folio" : ""}
                </p>
              </div>
              <span className="font-mono text-[13px] text-ink">{naira(e.totalKobo)}</span>
              {edit && (
                <button type="button" aria-label={`Remove ${e.name}`} onClick={() => setRemove({ kind: "extra", id: e.id, label: e.name, posted: e.posted })} className="grid h-7 w-7 place-items-center rounded-sm text-ink-faint hover:bg-danger-wash hover:text-danger">
                  <Trash size={13} />
                </button>
              )}
            </li>
          ))}
          {transfers.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-5 py-3" data-reservation-transfer={t.id}>
              <CatalogIcon name={kindMeta(t.pickupPoint.kind).icon} size={16} className="shrink-0 text-ink-muted" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] text-ink">
                  {t.direction === "ARRIVAL" ? "Pickup from" : "Drop-off at"} {t.pickupPoint.shortName ?? t.pickupPoint.name}, <span className="font-mono">{lagosHHMM(t.scheduledAt)}</span> {formatDay(dayKeyOf(t.scheduledAt))}
                </p>
                <p className="truncate text-[11.5px] text-ink-muted">
                  {t.detailsSummary}
                  {t.driver ? ` · ${t.driver.name}, ${t.driver.vehiclePlate}` : ""}
                </p>
              </div>
              <StatusChip s={t.status} />
              <span className="hidden font-mono text-[13px] text-ink sm:inline">{naira(t.totalKobo)}</span>
              <Link href="/transfers" aria-label="Open the transfers board" className="grid h-7 w-7 place-items-center rounded-sm text-ink-faint hover:text-ink">
                <ArrowSquareOut size={13} />
              </Link>
              {edit && !["COMPLETED", "CANCELLED", "NO_SHOW"].includes(t.status) && (
                <button type="button" aria-label="Cancel this transfer" onClick={() => setRemove({ kind: "transfer", id: t.id, label: `the pickup from ${t.pickupPoint.shortName ?? t.pickupPoint.name}`, posted: t.posted })} className="grid h-7 w-7 place-items-center rounded-sm text-ink-faint hover:bg-danger-wash hover:text-danger">
                  <Trash size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {addExtra && <AddExtraDialog r={r} onClose={() => setAddExtra(false)} onDone={done} />}
      {addPickup && <AddPickupDialog r={r} onClose={() => setAddPickup(false)} onDone={done} />}
      <ConfirmDialog
        open={!!remove}
        onOpenChange={(o) => !o && setRemove(null)}
        title={remove?.kind === "extra" ? `Remove ${remove.label}?` : `Cancel ${remove?.label ?? ""}?`}
        body={remove?.posted ? (can("folio.void") ? "It's on the folio already; the charge and its tax are voided." : "It's on the folio already, so a manager has to void it.") : "Nothing has been charged for it yet."}
        confirmLabel={remove?.kind === "extra" ? "Remove" : "Cancel the pickup"}
        danger
        onConfirm={async () => {
          if (!remove) return;
          if (remove.kind === "extra") await reservationAddOnsApi.removeExtra(r.id, remove.id);
          else await reservationAddOnsApi.removeTransfer(r.id, remove.id);
          done();
          toast.success(remove.kind === "extra" ? "Extra removed" : "Pickup cancelled");
        }}
      />
    </Panel>
  );
}

function AddExtraDialog({ r, onClose, onDone }: { r: ReservationDetailM7; onClose: () => void; onDone: () => void }) {
  const list = useExtras();
  const options = (list.data ?? []).filter((e) => e.active && e.channels.includes("FRONT_DESK"));
  const [id, setId] = useState("");
  const [qty, setQty] = useState(1);
  const extra = options.find((e) => e.id === id);
  const counted = extra && (extra.pricing === "PER_UNIT" || extra.pricing.startsWith("PER_PERSON"));
  const add = useMutation({
    mutationFn: () => reservationAddOnsApi.addExtra(r.id, { extraId: id, quantity: counted ? qty : undefined }),
    onSuccess: (x) => {
      onDone();
      toast.success(`${x.name} added`, `${naira(x.totalKobo)} with tax${x.posted ? ", on the folio" : ""}.`);
      onClose();
    },
    meta: { errorTitle: "Extra not added" },
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      eyebrow={r.code}
      title="Add an extra"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!id} loading={add.isPending} onClick={() => add.mutate()} data-testid="confirm-add-extra">
            Add it
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Select value={id} onChange={(e) => setId(e.target.value)} aria-label="Extra" data-testid="extra-select">
          <option value="">Choose an extra</option>
          {options.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name} &middot; {naira(e.priceKobo)} {pricingUnit(e.pricing)}
            </option>
          ))}
        </Select>
        {counted && (
          <div className="flex items-center gap-3 text-[13px] text-ink">
            <span>{extra!.pricing === "PER_UNIT" ? "How many" : "For how many guests"}</span>
            <span className="inline-flex h-9 items-stretch overflow-hidden rounded-sm border border-line-strong">
              <button type="button" className="grid w-8 place-items-center" onClick={() => setQty(Math.max(1, qty - 1))} aria-label="Fewer">
                <Minus size={12} />
              </button>
              <span className="grid w-9 place-items-center border-x border-line font-mono">{qty}</span>
              <button type="button" className="grid w-8 place-items-center" onClick={() => setQty(qty + 1)} aria-label="More">
                <Plus size={12} />
              </button>
            </span>
          </div>
        )}
        <p className="text-[12px] text-ink-muted">{r.status === "CHECKED_IN" ? "The guest is in house, so it goes on the folio now." : "It goes on the folio at check-in."} Notice and daily limits don&rsquo;t apply at the desk.</p>
      </div>
    </Dialog>
  );
}

function AddPickupDialog({ r, onClose, onDone }: { r: ReservationDetailM7; onClose: () => void; onDone: () => void }) {
  const points = usePickupPoints();
  const companies = useTransportCompanies();
  const routes = useTrainRoutes();
  const [a, setA] = useState<PickupAnswer>({ wanted: true, passengers: r.adults + r.children, contactPhone: r.guest.phone });
  const [err, setErr] = useState<Record<string, string>>({});
  const active = (points.data ?? []).filter((p) => p.active);
  const add = useMutation({
    mutationFn: async () => {
      const probs = pickupProblems(a, active, { desk: true });
      setErr(probs);
      if (Object.keys(probs).length) throw new Error("Check the pickup details");
      const list = transfersFromPickup(a);
      for (const t of list) await reservationAddOnsApi.addTransfer(r.id, { ...t, details: a.details, luggage: a.luggage ?? null, contactPhone: a.contactPhone ?? null });
      return list.length;
    },
    onSuccess: (n) => {
      onDone();
      toast.success(n > 1 ? "Pickup and drop-off added" : "Pickup added", "It's on the transfers board, confirmed.");
      onClose();
    },
    meta: { errorTitle: "Pickup not added" },
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      eyebrow={r.code}
      title="Add a pickup"
      className="max-w-2xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={add.isPending} onClick={() => add.mutate()}>
            Add it
          </Button>
        </>
      }
    >
      <PickupBlock
        value={a}
        onChange={setA}
        points={active}
        companies={companies.data ?? []}
        routes={routes.data ?? []}
        arrival={r.arrivalDate}
        departure={r.departureDate}
        guests={r.adults + r.children}
        guestPhone={r.guest.phone ?? undefined}
        directions={["ARRIVAL", "DEPARTURE"]}
        desk
        errors={err}
        label="Arrival pickup"
      />
    </Dialog>
  );
}
