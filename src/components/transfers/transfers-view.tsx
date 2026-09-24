"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  CaretLeft,
  CaretRight,
  ChatText,
  CheckCircle,
  Clock,
  IdentificationBadge,
  Phone,
  Steps,
  Suitcase,
  UserCircle,
  UsersThree,
  Van,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useCan } from "@/lib/permissions";
import { transfersApi } from "@/lib/api/endpoints-m7";
import { qk7, useTransfers } from "@/lib/api/hooks-m7";
import type { Transfer, TransferStatus } from "@/lib/api/types-m7";
import { TRANSFER_STATUS, kindMeta } from "@/lib/m7-catalog";
import { addDays, formatDay, lagosHHMM, lagosIso, todayKey, dayKeyOf } from "@/lib/dates";
import { formatPhone, naira, relativeTime } from "@/lib/format";
import { toast } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, Sheet } from "@/components/ui/overlay";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, Segmented, Skeleton } from "@/components/ui/primitives";
import { CatalogIcon } from "@/components/m7/icon";

type Filter = "all" | "driver" | "out" | "done";
const FINAL: TransferStatus[] = ["COMPLETED", "NO_SHOW", "CANCELLED"];
const needsDriver = (t: Transfer) => t.status === "REQUESTED" || t.status === "CONFIRMED";
const out = (t: Transfer) => t.status === "DRIVER_ASSIGNED" || t.status === "EN_ROUTE" || t.status === "PICKED_UP";

export function StatusChip({ s }: { s: TransferStatus }) {
  const m = TRANSFER_STATUS[s];
  return (
    <Badge tone={m.tone} dot>
      {m.label}
    </Badge>
  );
}

export function useTransferActions() {
  const qc = useQueryClient();
  const done = (t: Transfer) => {
    void qc.invalidateQueries({ queryKey: qk7.transfersAll });
    void qc.invalidateQueries({ queryKey: ["reservation"] });
    return t;
  };
  const confirm = useMutation({ mutationFn: (id: string) => transfersApi.confirm(id), onSuccess: done, meta: { errorTitle: "Not confirmed" } });
  const status = useMutation({
    mutationFn: (v: { id: string; status: TransferStatus; note?: string }) => transfersApi.status(v.id, v.status, v.note),
    onSuccess: (t) => {
      done(t);
      toast.success(TRANSFER_STATUS[t.status].label, `${t.reservation.guestName}, ${t.pickupPoint.shortName ?? t.pickupPoint.name}`);
    },
    meta: { errorTitle: "Status not changed" },
  });
  return { confirm, status, done };
}

export function TransfersView() {
  const today = todayKey();
  const [date, setDate] = useState(today);
  const [filter, setFilter] = useState<Filter>("all");
  const [dir, setDir] = useState<"ALL" | "ARRIVAL" | "DEPARTURE">("ALL");
  const [open, setOpen] = useState<string | null>(null);
  const q = useTransfers({ date, status: "REQUESTED,CONFIRMED,DRIVER_ASSIGNED,EN_ROUTE,PICKED_UP,COMPLETED,NO_SHOW,CANCELLED" });
  const items = useMemo(() => {
    const all = q.data?.items ?? [];
    return all.filter((t) => (dir === "ALL" || t.direction === dir) && (filter === "all" ? true : filter === "driver" ? needsDriver(t) : filter === "out" ? out(t) : FINAL.includes(t.status)));
  }, [q.data, filter, dir]);
  const all = q.data?.items ?? [];
  const selected = all.find((t) => t.id === open) ?? null;
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1280px)");
    const on = () => setWide(m.matches);
    on();
    m.addEventListener("change", on);
    return () => m.removeEventListener("change", on);
  }, []);
  useEffect(() => {
    // keep a card open on wide screens so the right column is never empty
    // eslint-disable-next-line react-hooks/set-state-in-effect -- choose a sensible default once the list loads
    if (wide && !open && items.length) setOpen((items.find((t) => !FINAL.includes(t.status)) ?? items[0]).id);
  }, [wide, open, items]);

  const counts = q.data?.counts;
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Van size={14} weight="duotone" /> Transfers
          </>
        }
        title={
          <>
            Who&rsquo;s being met, <em>where and when</em>.
          </>
        }
        description="Airport, motor-park, station and jetty pickups and drop-offs by time. Assign a driver and the guest gets the name, phone and plate straight away."
        actions={
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="icon" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>
              <CaretLeft size={15} />
            </Button>
            <label className="relative">
              <span className="sr-only">Day</span>
              <Input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="w-[150px] font-mono" />
            </label>
            <Button variant="secondary" size="icon" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}>
              <CaretRight size={15} />
            </Button>
            {date !== today && (
              <Button variant="ghost" size="sm" onClick={() => setDate(today)}>
                Today
              </Button>
            )}
          </div>
        }
      />

      <Panel className="mb-5 grid grid-cols-2 divide-line sm:grid-cols-5 sm:divide-x max-sm:[&>*:nth-child(-n+4)]:border-b max-sm:[&>*:nth-child(odd)]:border-r max-sm:[&>*]:border-line">
        {[
          { k: "Arrivals", v: counts?.arrivals, icon: <ArrowDownRight size={14} className="text-adire" /> },
          { k: "Departures", v: counts?.departures, icon: <ArrowUpRight size={14} className="text-brass" /> },
          { k: "Need a driver", v: counts?.unassigned, icon: <WarningCircle size={14} className={counts?.unassigned ? "text-ochre" : "text-ink-faint"} />, hot: !!counts?.unassigned },
          { k: "On the road", v: counts?.inProgress, icon: <Van size={14} className="text-laterite" /> },
          { k: "Done", v: counts?.done, icon: <CheckCircle size={14} className="text-palm" /> },
        ].map((c) => (
          <div key={c.k} className="flex flex-col gap-1 px-5 py-3.5">
            <span className="flex items-center gap-1.5 text-[12px] text-ink-muted">
              {c.icon}
              {c.k}
            </span>
            <span className={cn("font-mono text-[26px] leading-none", c.hot ? "text-ochre" : "text-ink")}>{c.v ?? "–"}</span>
          </div>
        ))}
      </Panel>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented<Filter>
          label="Show"
          size="sm"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All" },
            { value: "driver", label: "Need a driver" },
            { value: "out", label: "Out now" },
            { value: "done", label: "Finished" },
          ]}
        />
        <Segmented<"ALL" | "ARRIVAL" | "DEPARTURE">
          label="Direction"
          size="sm"
          value={dir}
          onChange={setDir}
          options={[
            { value: "ALL", label: "Both" },
            { value: "ARRIVAL", label: "Pickups" },
            { value: "DEPARTURE", label: "Drop-offs" },
          ]}
        />
        <span className="ml-auto text-[12px] text-ink-faint">{formatDay(date, { weekday: "long", day: "numeric", month: "long" })}</span>
      </div>

      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
          {!items.length ? (
            <Panel>
              <EmptyState glyph="river" title={all.length ? "Nothing in this view" : "No transfers this day"} body={all.length ? "Try another filter." : "Pickups booked online or at the desk show up here by time."} />
            </Panel>
          ) : (
            <ol className="relative flex flex-col" data-testid="transfer-list">
              <span aria-hidden className="absolute bottom-3 left-[54px] top-3 w-px bg-line max-sm:hidden" />
              {items.map((t, i) => {
                const hh = lagosHHMM(t.scheduledAt);
                const prevHour = i > 0 ? lagosHHMM(items[i - 1].scheduledAt).slice(0, 2) : null;
                return (
                  <li key={t.id} className="relative flex gap-3 pb-2.5 sm:gap-5">
                    <div className="hidden w-[44px] shrink-0 pt-3 text-right sm:block">
                      <span className={cn("font-mono text-[15px] leading-none", FINAL.includes(t.status) ? "text-ink-faint" : "text-ink")}>{hh}</span>
                      {prevHour !== hh.slice(0, 2) && <span className="sr-only">{hh.slice(0, 2)} o&rsquo;clock</span>}
                    </div>
                    <span aria-hidden className={cn("absolute left-[50px] top-4 hidden h-[9px] w-[9px] rounded-full border-2 border-paper sm:block", needsDriver(t) ? "bg-ochre" : out(t) ? "bg-laterite" : t.status === "COMPLETED" ? "bg-palm" : "bg-line-strong")} />
                    <TransferCard t={t} active={open === t.id} onOpen={() => setOpen(t.id)} />
                  </li>
                );
              })}
            </ol>
          )}
          {wide ? (
            <Panel as="aside" className="sticky top-20 self-start overflow-hidden" aria-label="Transfer">
              {selected ? <TransferDetail t={selected} /> : <EmptyState compact title="Choose a transfer" />}
            </Panel>
          ) : (
            <Sheet open={!!selected} onOpenChange={(o) => !o && setOpen(null)} eyebrow={selected ? `${selected.direction === "ARRIVAL" ? "Pickup" : "Drop-off"} · ${lagosHHMM(selected.scheduledAt)}` : ""} title={selected?.reservation.guestName ?? "Transfer"}>
              {selected && <TransferDetail t={selected} inSheet />}
            </Sheet>
          )}
        </div>
      )}
    </>
  );
}

export function TransferCard({ t, active, onOpen }: { t: Transfer; active: boolean; onOpen: () => void }) {
  const k = kindMeta(t.pickupPoint.kind);
  const { confirm, status } = useTransferActions();
  const { can } = useCan();
  const manage = can("transfers.manage");
  const [assign, setAssign] = useState(false);
  const next = TRANSFER_STATUS[t.status].next;
  const primary =
    t.status === "REQUESTED"
      ? { label: "Confirm", run: () => confirm.mutate(t.id), busy: confirm.isPending }
      : t.status === "CONFIRMED"
        ? { label: "Assign a driver", run: () => setAssign(true), busy: false }
        : next
          ? { label: TRANSFER_STATUS[t.status].action!, run: () => status.mutate({ id: t.id, status: next }), busy: status.isPending }
          : null;
  const finished = FINAL.includes(t.status);
  return (
    <article
      className={cn(
        "min-w-0 flex-1 rounded-lg border bg-surface transition-[border-color,box-shadow]",
        active ? "border-ink shadow-[0_0_0_1px_var(--ink)]" : "border-line hover:border-line-strong",
        finished && "bg-surface-2/40",
      )}
      data-transfer={t.reservation.code}
      data-status={t.status}
    >
      <button type="button" onClick={onOpen} className="flex w-full flex-col gap-2 px-4 pb-2 pt-3 text-left" aria-label={`${t.reservation.guestName}, ${k.label} ${t.pickupPoint.name}`}>
        <div className="flex w-full items-start gap-3">
          <span className={cn("mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-md border", t.direction === "ARRIVAL" ? "border-[color-mix(in_oklab,var(--adire)_30%,transparent)] bg-adire-wash text-adire" : "border-[color-mix(in_oklab,var(--brass)_35%,transparent)] bg-brass-wash text-brass")}>
            <CatalogIcon name={k.icon} size={17} weight="duotone" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex min-w-0 items-center gap-2">
              <span className="font-mono text-[13px] text-ink sm:hidden">{lagosHHMM(t.scheduledAt)}</span>
              <span className={cn("truncate text-[14.5px] font-medium", finished ? "text-ink-muted" : "text-ink")}>{t.reservation.guestName}</span>
              <span className="shrink-0 font-mono text-[11px] text-ink-faint">{t.reservation.code}</span>
            </p>
            <p className="truncate text-[12.5px] text-ink-muted">
              {t.direction === "ARRIVAL" ? "From" : "To"} <span className="text-ink">{t.pickupPoint.shortName ?? t.pickupPoint.name}</span> &middot; {t.detailsSummary}
            </p>
          </div>
          <StatusChip s={t.status} />
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-12 text-[12px] text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <UsersThree size={12} /> {t.passengers}
          </span>
          {t.luggage != null && (
            <span className="inline-flex items-center gap-1">
              <Suitcase size={12} /> {t.luggage}
            </span>
          )}
          {t.vehicleOption && <span>{t.vehicleOption.name}</span>}
          {t.driver ? (
            <span className="inline-flex items-center gap-1 text-ink">
              <IdentificationBadge size={12} /> {t.driver.name} &middot; <span className="font-mono">{t.driver.vehiclePlate}</span>
            </span>
          ) : (
            !finished && <span className="inline-flex items-center gap-1 text-ochre">No driver yet</span>
          )}
        </div>
      </button>
      {t.delayNote && !finished && (
        <p className="mx-4 mb-2 ml-16 flex items-start gap-1.5 rounded-sm bg-ochre-wash/70 px-2 py-1 text-[12px] text-ink">
          <Clock size={12} className="mt-0.5 shrink-0 text-ochre" /> {t.delayNote}
        </p>
      )}
      {manage && primary && (
        <div className="flex justify-end gap-2 border-t border-dashed border-line px-3 py-2">
          <Button size="sm" variant={t.status === "CONFIRMED" ? "primary" : "secondary"} loading={primary.busy} onClick={primary.run} data-testid={`action-${t.reservation.code}`} className="max-sm:h-10 max-sm:flex-1 max-sm:text-[14px]">
            {primary.label}
          </Button>
        </div>
      )}
      {assign && <AssignDialog t={t} onClose={() => setAssign(false)} />}
    </article>
  );
}

export function TransferDetail({ t, inSheet }: { t: Transfer; inSheet?: boolean }) {
  const { can } = useCan();
  const manage = can("transfers.manage");
  const { status, confirm } = useTransferActions();
  const [assign, setAssign] = useState(false);
  const [delay, setDelay] = useState(false);
  const [end, setEnd] = useState<TransferStatus | null>(null);
  const k = kindMeta(t.pickupPoint.kind);
  const finished = FINAL.includes(t.status);
  const next = TRANSFER_STATUS[t.status].next;
  const details = Object.entries(t.details ?? {}).filter(([key, v]) => v !== null && v !== "" && typeof v !== "object" && !/Id$/.test(key));
  return (
    <div className="flex flex-col" data-testid="transfer-detail">
      {!inSheet && (
        <header className="border-b border-line px-5 py-4">
          <p className="eyebrow mb-1 flex items-center gap-1.5">
            {t.direction === "ARRIVAL" ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />}
            {t.direction === "ARRIVAL" ? "Arrival pickup" : "Departure drop-off"} &middot; {formatDay(dayKeyOf(t.scheduledAt))}
          </p>
          <h2 className="display-sm text-[21px] leading-tight text-ink">{t.reservation.guestName}</h2>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">
            <Link href={`/reservations/${t.reservationId}`} className="font-mono text-ink hover:text-laterite">
              {t.reservation.code}
            </Link>
            {t.reservation.roomNumber && <> &middot; room {t.reservation.roomNumber}</>}
          </p>
        </header>
      )}
      <div className={cn("flex flex-col gap-4", inSheet ? "" : "px-5 py-4")}>
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-line bg-surface-2 text-laterite">
            <CatalogIcon name={k.icon} size={19} weight="duotone" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium text-ink">{t.pickupPoint.name}</p>
            <p className="text-[12.5px] text-ink-muted">{t.detailsSummary}</p>
          </div>
          <p className="text-right">
            <span className="block font-mono text-[22px] leading-none text-ink">{lagosHHMM(t.scheduledAt)}</span>
            <span className="text-[11px] text-ink-muted">{t.direction === "ARRIVAL" ? "at the point" : "leaves the hotel"}</span>
          </p>
        </div>
        {t.delayNote && (
          <p className="flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--ochre)_35%,transparent)] bg-ochre-wash/60 px-3 py-2 text-[12.5px] text-ink">
            <Clock size={14} className="mt-0.5 shrink-0 text-ochre" /> {t.delayNote}
          </p>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-[12.5px]">
          <dt className="text-ink-muted">Passengers</dt>
          <dd className="font-mono text-ink">{t.passengers}{t.luggage != null ? ` · ${t.luggage} bags` : ""}</dd>
          <dt className="text-ink-muted">Vehicle</dt>
          <dd className="text-ink">{t.vehicleOption?.name ?? "Standard car"}</dd>
          <dt className="text-ink-muted">Phone on the day</dt>
          <dd>{t.contactPhone ? <a href={`tel:${t.contactPhone}`} className="font-mono text-ink hover:text-laterite">{formatPhone(t.contactPhone)}</a> : "–"}</dd>
          {details.map(([key, v]) => (
            <FragmentRow key={key} k={key} v={String(v)} />
          ))}
          <dt className="text-ink-muted">Price</dt>
          <dd className="font-mono text-ink">{naira(t.totalKobo)}{t.posted ? " · on the folio" : ""}</dd>
        </dl>

        <div className="rounded-md border border-line p-3.5">
          <p className="eyebrow mb-2">Driver</p>
          {t.driver ? (
            <div className="flex items-start gap-3">
              <UserCircle size={30} weight="duotone" className="shrink-0 text-adire" />
              <div className="min-w-0 flex-1 text-[13px]">
                <p className="font-medium text-ink">{t.driver.name}</p>
                <p className="font-mono text-[12.5px] text-ink-muted">
                  <a href={`tel:${t.driver.phone}`} className="hover:text-laterite">{formatPhone(t.driver.phone)}</a> &middot; {t.driver.vehiclePlate}
                </p>
                {t.driver.vehicleDescription && <p className="text-[12px] text-ink-muted">{t.driver.vehicleDescription}</p>}
                <p className="mt-1 text-[11.5px] text-ink-faint">{t.lastNotifiedAt ? `Guest told ${relativeTime(t.lastNotifiedAt)}` : "Guest not told yet"}</p>
              </div>
            </div>
          ) : (
            <p className="text-[13px] text-ink-muted">No driver yet.</p>
          )}
          {manage && !finished && (
            <Button size="sm" variant={t.driver ? "secondary" : "primary"} className="mt-3 w-full" onClick={() => setAssign(true)} data-testid="assign-driver">
              <IdentificationBadge size={14} /> {t.driver ? "Change driver or resend details" : "Assign a driver"}
            </Button>
          )}
        </div>

        {manage && !finished && (
          <div className="flex flex-col gap-2">
            {t.status === "REQUESTED" && (
              <Button size="lg" variant="secondary" loading={confirm.isPending} onClick={() => confirm.mutate(t.id)}>
                <CheckCircle size={16} /> Confirm the pickup
              </Button>
            )}
            {next && t.status !== "REQUESTED" && (
              <Button size="lg" loading={status.isPending} onClick={() => status.mutate({ id: t.id, status: next })} data-testid="advance-status">
                {TRANSFER_STATUS[t.status].action}
              </Button>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Button size="sm" variant="secondary" onClick={() => setDelay(true)} data-testid="delay-note">
                <Clock size={13} /> Delay
              </Button>
              <Button size="sm" variant="secondary" disabled={!["DRIVER_ASSIGNED", "EN_ROUTE"].includes(t.status)} onClick={() => setEnd("NO_SHOW")}>
                No-show
              </Button>
              <Button size="sm" variant="ghost" className="text-danger" onClick={() => setEnd("CANCELLED")}>
                <XCircle size={13} /> Cancel
              </Button>
            </div>
          </div>
        )}

        <div>
          <p className="eyebrow mb-2 flex items-center gap-1.5">
            <Steps size={12} /> What happened
          </p>
          <ol className="flex flex-col gap-2 border-l border-line pl-3.5">
            {[...t.events].reverse().map((e, i) => (
              <li key={i} className="relative text-[12.5px]">
                <span aria-hidden className={cn("absolute -left-[18.5px] top-1.5 h-2 w-2 rounded-full", i === 0 ? "bg-laterite" : "bg-line-strong")} />
                <p className="text-ink">
                  {e.status ? TRANSFER_STATUS[e.status].label : "Note"}
                  {e.note && <span className="text-ink-muted"> &middot; {e.note}</span>}
                </p>
                <p className="text-[11px] text-ink-faint">
                  {relativeTime(e.at)}
                  {e.by ? `, ${e.by}` : ""}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
      {assign && <AssignDialog t={t} onClose={() => setAssign(false)} />}
      {delay && <DelayDialog t={t} onClose={() => setDelay(false)} />}
      <ConfirmDialog
        open={!!end}
        onOpenChange={(o) => !o && setEnd(null)}
        title={end === "NO_SHOW" ? `${t.reservation.guestName} didn't show?` : "Cancel this transfer?"}
        body={end === "NO_SHOW" ? "The driver waited and the guest never came. This closes the transfer." : "The guest is not charged for it; a charge already on the folio is voided."}
        confirmLabel={end === "NO_SHOW" ? "Mark as no-show" : "Cancel the transfer"}
        danger
        onConfirm={() => (end ? status.mutateAsync({ id: t.id, status: end }) : undefined)}
      />
    </div>
  );
}

const DETAIL_LABEL: Record<string, string> = {
  airline: "Airline",
  flightNumber: "Flight",
  terminal: "Terminal",
  transportCompanyName: "Company",
  transportCompanyOther: "Company",
  departureCity: "From",
  ticketReference: "Ticket",
  vehicleDescription: "The bus",
  trainRouteName: "Route",
  routeOther: "Route",
  trainService: "Service",
  details: "Details",
};
function FragmentRow({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt className="text-ink-muted">{DETAIL_LABEL[k] ?? k}</dt>
      <dd className={cn("text-ink", ["flightNumber", "ticketReference"].includes(k) && "font-mono")}>{v}</dd>
    </>
  );
}

function AssignDialog({ t, onClose }: { t: Transfer; onClose: () => void }) {
  const { done } = useTransferActions();
  const [name, setName] = useState(t.driver?.name ?? "");
  const [phone, setPhone] = useState(t.driver?.phone ?? "");
  const [plate, setPlate] = useState(t.driver?.vehiclePlate ?? "");
  const [desc, setDesc] = useState(t.driver?.vehicleDescription ?? "");
  const [notify, setNotify] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const assign = useMutation({
    mutationFn: () => {
      const e: Record<string, string> = {};
      if (name.trim().length < 2) e.name = "The driver's name";
      if (phone.replace(/\D/g, "").length < 10) e.phone = "A number the guest can call";
      if (plate.trim().length < 4) e.plate = "The plate, e.g. LSD 482 KJ";
      setErrors(e);
      if (Object.keys(e).length) throw new Error("Check the highlighted fields");
      return transfersApi.assign(t.id, { driverName: name.trim(), driverPhone: phone.trim(), vehiclePlate: plate.trim().toUpperCase(), vehicleDescription: desc.trim() || undefined, notifyGuest: notify });
    },
    onSuccess: (r) => {
      done(r);
      const sent = r.notified?.map((n) => `${n.channel === "WHATSAPP" ? "WhatsApp" : n.channel === "SMS" ? "SMS" : "email"} to ${n.channel === "EMAIL" ? n.to : formatPhone(n.to)}`) ?? [];
      toast.success(`${name.trim()} is on it`, sent.length ? `Sent by ${sent.join(" and ")}.` : "The guest wasn't messaged.");
      onClose();
    },
    meta: { errorTitle: "Driver not assigned" },
  });
  const point = t.pickupPoint.shortName ?? t.pickupPoint.name;
  const sms = `Your driver ${name.trim() || "[name]"} (${phone.trim() || "[phone]"}) will meet you at ${point}, ${[desc.trim(), plate.trim().toUpperCase()].filter(Boolean).join(" ") || "[plate]"}. Booking ${t.reservation.code}.`;
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      eyebrow={`${t.reservation.guestName} · ${lagosHHMM(t.scheduledAt)}`}
      title={t.driver ? "Change the driver" : "Assign a driver"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={assign.isPending} onClick={() => assign.mutate()} data-testid="confirm-assign">
            {notify ? "Assign and tell the guest" : "Assign"}
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Driver's name" error={errors.name} htmlFor="dr-name">
          <Input id="dr-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Musa Ibrahim" autoFocus data-testid="driver-name" />
        </Field>
        <Field label="Driver's phone" error={errors.phone} htmlFor="dr-phone">
          <Input id="dr-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0803 555 0142" className="font-mono" data-testid="driver-phone" />
        </Field>
        <Field label="Plate" error={errors.plate} htmlFor="dr-plate">
          <Input id="dr-plate" value={plate} onChange={(e) => setPlate(e.target.value)} placeholder="LSD 482 KJ" className="font-mono uppercase" data-testid="driver-plate" />
        </Field>
        <Field label="Car" htmlFor="dr-desc" optional>
          <Input id="dr-desc" value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Silver Toyota Sienna" />
        </Field>
      </div>
      <div className="mt-5 flex flex-col gap-3 rounded-md border border-line bg-surface-2/40 p-3.5">
        <Checkbox checked={notify} onChange={setNotify} label="Send the guest the driver's details now" />
        {notify && (
          <div className="flex gap-2.5">
            <ChatText size={16} className="mt-1 shrink-0 text-ink-muted" />
            <p className="rounded-[12px] rounded-tl-[3px] bg-surface px-3 py-2 text-[12.5px] leading-snug text-ink shadow-[0_0_0_1px_var(--line)]" data-testid="sms-preview">
              {sms}
            </p>
          </div>
        )}
        <p className="text-[11.5px] text-ink-muted">
          <Phone size={11} className="mr-1 inline" /> To {t.contactPhone ? formatPhone(t.contactPhone) : "the guest's phone"}, by WhatsApp where the hotel has it, otherwise SMS; and by email when we have one.
        </p>
      </div>
    </Dialog>
  );
}

function DelayDialog({ t, onClose }: { t: Transfer; onClose: () => void }) {
  const { done } = useTransferActions();
  const [note, setNote] = useState(t.delayNote ?? "");
  const [time, setTime] = useState("");
  const [notify, setNotify] = useState(false);
  const day = dayKeyOf(t.scheduledAt);
  const delay = useMutation({
    mutationFn: () => transfersApi.delay(t.id, { note: note.trim(), newScheduledAt: time ? lagosIso(day, time) : undefined, notifyGuest: notify }),
    onSuccess: (r) => {
      done(r);
      toast.success("Delay noted", time ? `Now ${time}.` : undefined);
      onClose();
    },
    meta: { errorTitle: "Delay not saved" },
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      eyebrow={t.reservation.guestName}
      title="Running late"
      description="The note shows on the board and the guest's trip page."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={delay.isPending} disabled={note.trim().length < 3} onClick={() => delay.mutate()} data-testid="save-delay">
            Save the note
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          {(t.pickupPoint.kind === "MOTOR_PARK" ? ["Bus delayed at Ore", "Bus broke down on the way", "Traffic at Berger"] : t.pickupPoint.kind === "AIRPORT" ? ["Flight delayed", "Long queue at immigration", "Waiting for luggage"] : ["Running late", "Traffic on the way"]).map((s) => (
            <button key={s} type="button" onClick={() => setNote(s)} className="h-7 rounded-full border border-line-strong px-2.5 text-[12px] text-ink-muted hover:text-ink">
              {s}
            </button>
          ))}
        </div>
        <Field label="Note" htmlFor="delay-note">
          <Textarea id="delay-note" value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} className="min-h-16" placeholder="Bus delayed at Ore, now expected 19:30" data-testid="delay-text" />
        </Field>
        <Field label="New time" optional htmlFor="delay-time">
          <Input id="delay-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} className="w-32 font-mono" />
        </Field>
        <Checkbox checked={notify} onChange={setNotify} label="Let the guest know" />
      </div>
    </Dialog>
  );
}
