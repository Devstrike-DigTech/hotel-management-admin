"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowClockwise,
  ArrowRight,
  ArrowsClockwise,
  CalendarBlank,
  Flask,
  Info,
  Key,
  LinkSimple,
  Pause,
  Play,
  Plugs,
  Plus,
  Trash,
  WarningOctagon,
} from "@phosphor-icons/react";
import { useCan } from "@/lib/permissions";
import { useRoomTypes } from "@/lib/api/hooks";
import { channelsApi } from "@/lib/api/endpoints-m5";
import { qk5, useChannelCost, useChannelSummary, useIcalExports, useIcalFeeds, useMappings, useOtaBookings, useRemoteCatalogue, useSyncLogs } from "@/lib/api/hooks-m5";
import type { ChannelConnection, OtaChannel } from "@/lib/api/types-m5";
import { formatDate, formatDateTime, naira, number, relativeTime } from "@/lib/format";
import { addDays, todayKey } from "@/lib/dates";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, Sheet } from "@/components/ui/overlay";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, PanelHeader, Segmented, Skeleton } from "@/components/ui/primitives";
import { StayBadge } from "@/components/m2/bits";
import { CopyField } from "@/components/domain/parts";
import { ChannelSeal, MappingGrid, OtaCostBars, SyncDirection, type MapCells } from "./parts";

export const OTA_NAME: Record<OtaChannel, string> = {
  AIRBNB: "Airbnb",
  BOOKING_COM: "Booking.com",
  EXPEDIA: "Expedia",
  AGODA: "Agoda",
  VRBO: "Vrbo",
  HOTELS_NG: "Hotels.ng",
  OTHER: "Other",
};

type Tab = "overview" | "connections" | "mapping" | "bookings" | "log";

export function ChannelsView() {
  const sp = useSearchParams();
  const router = useRouter();
  const tab = (sp.get("tab") as Tab) ?? "overview";
  const setTab = (t: Tab) => router.replace(t === "overview" ? "/channel-manager" : `/channel-manager?tab=${t}`, { scroll: false });
  const summary = useChannelSummary();
  const { can } = useCan();
  const [connect, setConnect] = useState(false);
  const conns = summary.data?.connections ?? [];
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Plugs size={14} weight="duotone" /> Channel manager
          </>
        }
        title={
          <>
            One house, <em>every shop window</em>.
          </>
        }
        description="Availability and prices go out to Booking.com, Expedia and Airbnb as they change; their bookings come back onto the Ledger. See what each channel costs next to your own booking site."
        actions={
          can("channels.manage") ? (
            <Button onClick={() => setConnect(true)} data-testid="connect-channel">
              <Plus size={15} weight="bold" /> Connect a channel
            </Button>
          ) : undefined
        }
      />
      {summary.data && summary.data.errors24h > 0 && (
        <div role="status" className="mb-5 flex items-center gap-3 rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-wash px-4 py-2.5 text-[13px]">
          <WarningOctagon size={17} weight="duotone" className="text-danger" />
          <span className="flex-1 text-ink">
            {summary.data.errors24h} {summary.data.errors24h === 1 ? "sync failed" : "syncs failed"} in the last 24 hours.
          </span>
          <button type="button" onClick={() => setTab("log")} className="font-medium text-danger underline underline-offset-4">
            See the log
          </button>
        </div>
      )}
      <Segmented
        label="Channel manager sections"
        value={tab}
        onChange={setTab}
        className="mb-6"
        options={[
          { value: "overview", label: "Overview" },
          { value: "connections", label: `Connections${conns.length ? ` · ${conns.length}` : ""}` },
          { value: "mapping", label: "Mapping" },
          { value: "bookings", label: "OTA bookings" },
          { value: "log", label: "Sync log" },
        ]}
      />
      {summary.isError ? (
        <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
      ) : !summary.data ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : tab === "connections" ? (
        <Connections conns={conns} onConnect={() => setConnect(true)} />
      ) : tab === "mapping" ? (
        <Mapping conns={conns} />
      ) : tab === "bookings" ? (
        <OtaBookings />
      ) : tab === "log" ? (
        <SyncLogView conns={conns} />
      ) : (
        <Overview conns={conns} onConnect={() => setConnect(true)} />
      )}
      <ConnectSheet open={connect} onOpenChange={setConnect} hasChannex={conns.some((c) => c.provider === "CHANNEX")} />
    </>
  );
}

/* ------------------------------------------------------------------ */

function Overview({ conns, onConnect }: { conns: ChannelConnection[]; onConnect: () => void }) {
  const [month, setMonth] = useState(todayKey().slice(0, 7));
  const cost = useChannelCost(month);
  const c = cost.data;
  const months = useMemo(() => {
    const out: string[] = [];
    const d = new Date(`${todayKey().slice(0, 7)}-15T12:00:00Z`);
    for (let i = 0; i < 6; i++) {
      out.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 15)).toISOString().slice(0, 7));
    }
    return out;
  }, []);
  const monthName = (m: string) => new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m}-15T12:00:00Z`));
  return (
    <div className="flex flex-col gap-5">
      <Panel className="overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[1.1fr_1.4fr]">
          <div className="border-b border-line bg-[linear-gradient(160deg,color-mix(in_oklab,var(--palm)_9%,var(--surface)),var(--surface))] p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3">
              <p className="eyebrow">What the OTAs cost</p>
              <select value={month} onChange={(e) => setMonth(e.target.value)} className="h-8 rounded-sm border border-line-strong bg-surface px-2 text-[12.5px] text-ink outline-none" aria-label="Month">
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthName(m)}
                  </option>
                ))}
              </select>
            </div>
            {!c ? (
              <Skeleton className="mt-5 h-32" />
            ) : (
              <>
                {c.ota.commissionKobo > 0 ? (
                  <>
                    <p className="display mt-5 text-[30px] leading-[1.12] text-ink sm:text-[34px]" data-testid="ota-headline">
                      You paid <span className="font-mono text-[0.9em] tracking-tight text-danger">{naira(c.ota.commissionKobo)}</span> to OTAs in {monthName(c.month)}.
                    </p>
                    <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
                      The same {number(c.ota.bookings)} bookings on your own booking site would have saved about <span className="font-mono text-palm">{naira(c.savingsKobo)}</span>: no commission, only the card fee (about {naira(c.directCostEstimateKobo)} in all).
                    </p>
                  </>
                ) : (
                  <>
                    <p className="display mt-5 text-[30px] leading-[1.12] text-ink sm:text-[34px]" data-testid="ota-headline">
                      No OTA commission in {monthName(c.month)}.
                    </p>
                    <p className="mt-3 text-[15px] leading-relaxed text-ink-muted">
                      {c.ota.bookings
                        ? `${number(c.ota.bookings)} OTA ${c.ota.bookings === 1 ? "booking has" : "bookings have"} no commission recorded yet. Set each channel's rate under Connections to see what they cost.`
                        : "Every booking this month came direct. Keep it that way: your booking site charges no commission."}
                    </p>
                  </>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/settings/booking" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink px-3.5 text-[13px] font-medium text-paper hover:opacity-90">
                    Grow direct bookings <ArrowRight size={13} />
                  </Link>
                  <Link href="/promotions" className="inline-flex h-9 items-center rounded-md px-3 text-[13px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink">
                    Make a promo code
                  </Link>
                </div>
              </>
            )}
          </div>
          <div className="p-6">
            {!c ? (
              <Skeleton className="h-48" />
            ) : c.ota.byChannel.length === 0 ? (
              <EmptyState compact glyph="river" title="No OTA stays this month" body="Bookings from connected channels show here with what they cost." />
            ) : (
              <OtaCostBars
                rows={c.ota.byChannel.map((r) => ({ channel: r.channel, name: OTA_NAME[r.channel], bookings: r.bookings, roomNights: r.roomNights, revenueKobo: r.revenueKobo, commissionKobo: r.commissionKobo, commissionPct: r.effectiveBps / 100 }))}
                directSavingsKobo={c.savingsKobo}
                marketplaceCostKobo={c.direct.marketplace.commissionKobo}
              />
            )}
          </div>
        </div>
        {c && (
          <div className="grid grid-cols-2 border-t border-line text-[12.5px] sm:grid-cols-4">
            {[
              ["OTA room nights", number(c.ota.roomNights)],
              ["OTA revenue", naira(c.ota.revenueKobo)],
              ["Booking site", `${number(c.direct.bookingSite.bookings)} bookings, ${naira(c.direct.bookingSite.revenueKobo)}`],
              ["Marketplace", `${number(c.direct.marketplace.bookings)} bookings, ${naira(c.direct.marketplace.revenueKobo)}`],
            ].map(([k, v]) => (
              <div key={k} className="border-r border-line px-5 py-3 last:border-r-0">
                <p className="text-ink-muted">{k}</p>
                <p className="mt-0.5 font-mono text-[13px] text-ink">{v}</p>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        {conns.map((c) => (
          <ConnectionCard key={c.id} c={c} />
        ))}
        {conns.length === 0 && (
          <Panel className="md:col-span-2">
            <EmptyState glyph="river" title="No channels yet" body="Start with iCal for Airbnb (it works today, no partner agreement), or connect Channex to reach Booking.com and Expedia with prices." action={<Button onClick={onConnect}>Connect a channel</Button>} />
          </Panel>
        )}
      </div>
    </div>
  );
}

function statusTone(c: ChannelConnection) {
  return c.status === "ERROR" ? "danger" : c.status === "PAUSED" ? "neutral" : "palm";
}

function ConnectionCard({ c }: { c: ChannelConnection }) {
  const qc = useQueryClient();
  const { can } = useCan();
  const now = useNow(30_000);
  const sync = useMutation({
    mutationFn: () => channelsApi.sync(c.id),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["channels"] });
      toast.success(`${c.name} synced`, r.log[0]?.summary);
    },
    meta: { errorTitle: "Sync failed" },
  });
  const pause = useMutation({
    mutationFn: () => channelsApi.update(c.id, { status: c.status === "PAUSED" ? "ACTIVE" : "PAUSED" }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ["channels"] }),
    meta: { errorTitle: "Not changed" },
  });
  return (
    <Panel className="flex flex-col" data-testid={`connection-${c.provider}`}>
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        {c.channel ? <ChannelSeal code={c.channel} /> : <span className="grid h-7 w-7 place-items-center rounded-[3px] border border-line-strong bg-paper text-ink-muted"><Plugs size={15} /></span>}
        <div className="min-w-0 flex-1">
          <p className="display-sm truncate text-[17px] leading-tight text-ink">{c.name}</p>
          <p className="mt-0.5 text-[12px] text-ink-muted">
            {c.provider === "ICAL" ? "iCal calendar feeds" : `Channex${c.mock ? " (development mock)" : ""}`}
            {c.externalPropertyId ? <> &middot; <span className="font-mono">{c.externalPropertyId}</span></> : null}
          </p>
        </div>
        <Badge tone={statusTone(c)} dot>
          {c.status === "ACTIVE" ? "Live" : c.status === "PAUSED" ? "Paused" : "Error"}
        </Badge>
      </div>
      <dl className="grid grid-cols-3 gap-px bg-line text-[12px]">
        <div className="bg-surface px-4 py-3">
          <dt className="text-ink-muted">Last sync</dt>
          <dd className="mt-0.5 text-ink" suppressHydrationWarning>
            {c.lastSyncAt ? relativeTime(c.lastSyncAt, now) : "never"}
          </dd>
        </div>
        <div className="bg-surface px-4 py-3">
          <dt className="text-ink-muted">Mapped</dt>
          <dd className={cn("mt-0.5 font-mono", c.mapping.pct === 100 ? "text-palm" : "text-ochre")}>
            {c.mapping.mappedRoomTypes}/{c.mapping.totalRoomTypes} types
          </dd>
        </div>
        <div className="bg-surface px-4 py-3">
          <dt className="text-ink-muted">Bookings, 30 days</dt>
          <dd className="mt-0.5 font-mono text-ink">{c.bookings30d}</dd>
        </div>
      </dl>
      {(c.lastError || c.pendingPush) && (
        <p className={cn("border-t border-line px-5 py-2 text-[12.5px]", c.lastError ? "text-danger" : "text-ochre")}>
          {c.lastError ?? "Changes queued: they go out within 30 seconds."}
        </p>
      )}
      {c.provider === "ICAL" && (
        <p className="border-t border-line px-5 py-2.5 text-[12px] leading-relaxed text-ink-muted">
          iCal carries dates only, no prices, and lags up to 15 minutes each way.{" "}
          {c.settings.stopSellBuffer ? `${c.settings.stopSellBuffer} ${c.settings.stopSellBuffer === 1 ? "room is" : "rooms are"} held back from each type to avoid double bookings.` : "Consider holding a room back per type."}
        </p>
      )}
      {can("channels.manage") && (
        <div className="mt-auto flex gap-1.5 border-t border-line px-3 py-2">
          <Button size="sm" variant="ghost" onClick={() => sync.mutate()} loading={sync.isPending} disabled={c.status === "PAUSED"}>
            <ArrowsClockwise size={14} /> Sync now
          </Button>
          <Button size="sm" variant="ghost" onClick={() => pause.mutate()} loading={pause.isPending}>
            {c.status === "PAUSED" ? <Play size={14} /> : <Pause size={14} />} {c.status === "PAUSED" ? "Resume" : "Pause"}
          </Button>
          <Link href={`/channel-manager?tab=${c.provider === "ICAL" ? "connections" : "mapping"}`} className="ml-auto inline-flex h-8 items-center gap-1 rounded-sm px-3 text-[13px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink">
            {c.provider === "ICAL" ? "Feeds" : "Mapping"} <ArrowRight size={12} />
          </Link>
        </div>
      )}
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

function Connections({ conns, onConnect }: { conns: ChannelConnection[]; onConnect: () => void }) {
  const ical = conns.filter((c) => c.provider === "ICAL");
  const [sel, setSel] = useState<string | null>(ical[0]?.id ?? null);
  const current = conns.find((c) => c.id === sel) ?? ical[0] ?? null;
  if (!conns.length)
    return (
      <Panel>
        <EmptyState glyph="river" title="No channels yet" action={<Button onClick={onConnect}>Connect a channel</Button>} />
      </Panel>
    );
  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <Panel as="div" className="self-start p-2">
        {conns.map((c) => (
          <button key={c.id} type="button" onClick={() => setSel(c.id)} className={cn("flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left", current?.id === c.id ? "bg-surface-2" : "hover:bg-surface-2/60")}>
            {c.channel ? <ChannelSeal code={c.channel} size="sm" /> : <Plugs size={16} className="text-ink-muted" />}
            <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">{c.name}</span>
            <Badge tone={statusTone(c)}>{c.provider === "ICAL" ? "iCal" : "API"}</Badge>
          </button>
        ))}
      </Panel>
      {current && (current.provider === "ICAL" ? <IcalDetail c={current} /> : <ChannexDetail c={current} />)}
    </div>
  );
}

function IcalDetail({ c }: { c: ChannelConnection }) {
  const qc = useQueryClient();
  const { can } = useCan();
  const exports = useIcalExports(c.id);
  const feeds = useIcalFeeds(c.id);
  const types = useRoomTypes();
  const [rotate, setRotate] = useState(false);
  const [remove, setRemove] = useState(false);
  const [url, setUrl] = useState("");
  const [typeId, setTypeId] = useState("");
  const [buffer, setBuffer] = useState(String(c.settings.stopSellBuffer));
  const manage = can("channels.manage");
  const addFeed = useMutation({
    mutationFn: () => channelsApi.addFeed(c.id, { roomTypeId: typeId || types.data?.[0]?.id, url: url.trim() }),
    onSuccess: () => {
      setUrl("");
      void qc.invalidateQueries({ queryKey: qk5.feeds(c.id) });
      toast.success("Calendar added", "It is read every 15 minutes. Sync now to read it at once.");
    },
    meta: { errorTitle: "Not added" },
  });
  const delFeed = useMutation({ mutationFn: (id: string) => channelsApi.removeFeed(c.id, id), onSuccess: () => void qc.invalidateQueries({ queryKey: qk5.feeds(c.id) }), meta: { errorTitle: "Not removed" } });
  const rot = useMutation({
    mutationFn: () => channelsApi.rotate(c.id),
    onSuccess: (r) => {
      qc.setQueryData(qk5.exports(c.id), r);
      toast.success("New links made", `Paste them into ${c.name} again; the old ones stopped working.`);
    },
    meta: { errorTitle: "Links not changed" },
  });
  const saveBuffer = useMutation({ mutationFn: () => channelsApi.update(c.id, { stopSellBuffer: Number(buffer || 0) }), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["channels"] }); toast.success("Saved"); }, meta: { errorTitle: "Not saved" } });
  const del = useMutation({ mutationFn: () => channelsApi.remove(c.id), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["channels"] }); toast.success(`${c.name} disconnected`, "Its reservations stay on the Ledger."); }, meta: { errorTitle: "Not removed" } });
  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <PanelHeader
          eyebrow={<>Step 1 &middot; out to {c.name}</>}
          title="Your calendars, for them to import"
          description={`Copy each link into ${c.name}'s calendar import (Calendar, Availability, Import calendar). Booked and blocked nights show as unavailable; no guest details leave the hotel.`}
          actions={manage ? <Button size="sm" variant="ghost" onClick={() => setRotate(true)}><ArrowClockwise size={14} /> New links</Button> : undefined}
        />
        <ul className="flex flex-col gap-3 p-5">
          {exports.isLoading && <Skeleton className="h-24" />}
          {(exports.data ?? []).map((e) => (
            <li key={`${e.scope}-${e.room?.id ?? e.roomType.id}`} className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
              <span className="text-[13.5px] text-ink">
                <CalendarBlank size={14} className="mr-1.5 inline text-ink-muted" />
                {e.room ? `Room ${e.room.number}` : e.roomType.name}
                <span className="block pl-5 text-[11.5px] text-ink-muted">{e.scope === "ROOM" ? e.roomType.name : "whole room type"}</span>
              </span>
              <CopyField value={e.url} label={`${e.roomType.name} calendar link`} testId="ical-export" />
            </li>
          ))}
        </ul>
      </Panel>
      <Panel>
        <PanelHeader eyebrow={<>Step 2 &middot; in from {c.name}</>} title="Their calendars, for us to import" description={`Paste ${c.name}'s export link for each listing. Each booking there becomes a reservation here, unassigned if the room is taken; a booking that disappears is cancelled.`} />
        <ul className="divide-y divide-line">
          {(feeds.data ?? []).map((f) => (
            <li key={f.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
              <span className="w-40 shrink-0 text-[13.5px] text-ink">{f.room ? `Room ${f.room.number}` : f.roomType.name}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-ink-muted" title={f.url}>
                {f.url}
              </span>
              <span className={cn("font-mono text-[11.5px]", f.lastStatus === "ERROR" ? "text-danger" : "text-ink-muted")}>
                {f.lastStatus === "ERROR" ? f.lastError : f.lastFetchedAt ? `${f.eventsCount} events, read ${formatDateTime(f.lastFetchedAt)}` : "not read yet"}
              </span>
              {manage && (
                <Button size="icon-sm" variant="ghost" aria-label="Remove this calendar" onClick={() => delFeed.mutate(f.id)}>
                  <Trash size={14} />
                </Button>
              )}
            </li>
          ))}
          {feeds.data && !feeds.data.length && <li className="px-5 py-5 text-[13px] text-ink-muted">No calendars imported yet.</li>}
        </ul>
        {manage && (
          <form
            className="flex flex-wrap items-end gap-2 border-t border-line p-5"
            onSubmit={(e) => {
              e.preventDefault();
              if (url.trim()) addFeed.mutate();
            }}
          >
            <Field label="Room type" className="w-48">
              <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
                {(types.data ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={`${c.name} calendar link`} className="min-w-[240px] flex-1">
              <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.airbnb.com/calendar/ical/....ics" className="font-mono" />
            </Field>
            <Button type="submit" loading={addFeed.isPending} disabled={!/^https?:\/\//.test(url.trim())}>
              <LinkSimple size={14} /> Import
            </Button>
          </form>
        )}
      </Panel>
      <Panel className="p-5">
        <div className="flex items-start gap-3">
          <Info size={18} className="mt-0.5 shrink-0 text-adire" />
          <div className="text-[13px] leading-relaxed text-ink">
            <p className="font-medium">What iCal can and cannot do</p>
            <p className="mt-1 text-ink-muted">
              It carries dates only: no prices, no guest phone or email. Both sides read each other every 15 minutes or so, so two bookings for the last room can land in that gap. Holding rooms back makes that rarer; if it still happens, the booking is kept and Revenue Guard flags it as overbooked with a place to move the guest.
            </p>
            {manage && (
              <div className="mt-3 flex items-end gap-2">
                <Field label="Rooms held back per type" className="w-44">
                  <Input inputMode="numeric" value={buffer} onChange={(e) => setBuffer(e.target.value.replace(/\D/g, ""))} />
                </Field>
                <Button variant="secondary" onClick={() => saveBuffer.mutate()} loading={saveBuffer.isPending} disabled={buffer === String(c.settings.stopSellBuffer)}>
                  Save
                </Button>
                <Button variant="ghost" className="ml-auto text-danger" onClick={() => setRemove(true)}>
                  Disconnect
                </Button>
              </div>
            )}
          </div>
        </div>
      </Panel>
      <ConfirmDialog open={rotate} onOpenChange={setRotate} title="Make new calendar links?" body={`The current links stop working at once. Paste the new ones into ${c.name}, or it keeps selling nights you no longer have.`} confirmLabel="Make new links" onConfirm={() => rot.mutateAsync()} />
      <ConfirmDialog open={remove} onOpenChange={setRemove} title={`Disconnect ${c.name}?`} body="Its calendars stop syncing. Reservations it already brought in stay." confirmLabel="Disconnect" danger onConfirm={() => del.mutateAsync()} />
    </div>
  );
}

function ChannexDetail({ c }: { c: ChannelConnection }) {
  const qc = useQueryClient();
  const { can } = useCan();
  const types = useRoomTypes();
  const [sim, setSim] = useState(false);
  const full = useMutation({ mutationFn: () => channelsApi.sync(c.id, true), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["channels"] }); toast.success("Full push sent", "Every night of the horizon, all mapped room types."); }, meta: { errorTitle: "Push failed" } });
  return (
    <div className="flex flex-col gap-5">
      <ConnectionCard c={c} />
      <Panel className="p-5">
        <p className="display-sm text-[17px] text-ink">What goes out</p>
        <ul className="mt-3 grid gap-2 text-[13px] text-ink sm:grid-cols-2">
          <li>Rooms free per type and night, minus blocks</li>
          <li>Prices from the Rate Almanac, dynamic pricing included</li>
          <li>Stop-sell, closed to arrival, minimum stay</li>
          <li>Only what changed, within 30 seconds of the change</li>
        </ul>
        {can("channels.manage") && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => full.mutate()} loading={full.isPending}>
              <ArrowsClockwise size={14} /> Push everything again
            </Button>
            {c.mock && process.env.NODE_ENV !== "production" && (
              <Button variant="ghost" onClick={() => setSim(true)}>
                <Flask size={14} /> Simulate a Booking.com booking
              </Button>
            )}
          </div>
        )}
      </Panel>
      <SimBooking open={sim} onOpenChange={setSim} connectionId={c.id} types={types.data ?? []} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Mapping({ conns }: { conns: ChannelConnection[] }) {
  const qc = useQueryClient();
  const { can } = useCan();
  const types = useRoomTypes();
  const channex = conns.find((c) => c.provider === "CHANNEX") ?? null;
  const ical = conns.filter((c) => c.provider === "ICAL");
  const remote = useRemoteCatalogue(channex?.id ?? null);
  const maps = useMappings(channex?.id ?? null);
  const [edit, setEdit] = useState<{ roomTypeId: string; name: string } | null>(null);
  const [rt, setRt] = useState("");
  const [rp, setRp] = useState("");
  const rows = (types.data ?? []).map((t) => ({ roomTypeId: t.id, roomTypeName: t.name, rooms: t.roomCount }));
  const cols = [
    ...(channex ? [{ connectionId: channex.id, channel: "OTHER", name: channex.name, remote: (remote.data?.roomTypes ?? []).map((r) => ({ id: r.id, name: r.title })) }] : []),
    ...ical.map((c) => ({ connectionId: c.id, channel: c.channel ?? "OTHER", name: `${c.name} (iCal)`, remote: [] })),
  ];
  const cells: MapCells = {};
  for (const r of rows) {
    cells[r.roomTypeId] = {};
    if (channex) {
      const m = maps.data?.find((x) => x.roomType.id === r.roomTypeId);
      cells[r.roomTypeId][channex.id] = m ? { remoteId: m.externalRoomTypeId, remoteName: `${m.externalRoomTypeName ?? m.externalRoomTypeId}${m.externalRatePlanName ? ` · ${m.externalRatePlanName}` : ""}` } : null;
    }
    for (const c of ical) cells[r.roomTypeId][c.id] = { remoteId: "calendar feed", remoteName: "Dates by iCal" };
  }
  const save = useMutation({
    mutationFn: async () => {
      if (!channex || !edit) return;
      const others = (maps.data ?? []).filter((m) => m.roomType.id !== edit.roomTypeId).map((m) => ({ roomTypeId: m.roomType.id, ratePlanId: m.ratePlan?.id ?? null, externalRoomTypeId: m.externalRoomTypeId, externalRatePlanId: m.externalRatePlanId }));
      const next = rt ? [...others, { roomTypeId: edit.roomTypeId, ratePlanId: null, externalRoomTypeId: rt, externalRatePlanId: rp || null }] : others;
      return channelsApi.saveMappings(channex.id, next);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["channels"] });
      setEdit(null);
      toast.success("Mapping saved", "A full push of prices and availability is on its way.");
    },
    meta: { errorTitle: "Mapping not saved" },
  });
  if (!channex && !ical.length) return <Panel><EmptyState glyph="cross" title="Nothing to map yet" body="Connect Channex to map your room types to Booking.com and Expedia's." /></Panel>;
  return (
    <Panel className="overflow-hidden">
      <PanelHeader eyebrow="Mapping" title="Which of their rooms is which of yours" description="A room type that is not mapped does not sell on that channel. Saving a mapping pushes every night again." />
      <MappingGrid
        rows={rows}
        cols={cols}
        cells={cells}
        editable={can("channels.manage")}
        onEdit={(row, col) => {
          if (col.connectionId !== channex?.id) {
            toast.info("iCal has no room mapping", "Each imported calendar belongs to a room type; manage them under Connections.");
            return;
          }
          const m = maps.data?.find((x) => x.roomType.id === row.roomTypeId);
          setRt(m?.externalRoomTypeId ?? "");
          setRp(m?.externalRatePlanId ?? "");
          setEdit({ roomTypeId: row.roomTypeId, name: row.roomTypeName });
        }}
      />
      <Dialog
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        title={`Map ${edit?.name ?? ""}`}
        description="Choose the room and the rate plan as they are named on Channex."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEdit(null)}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} data-testid="save-mapping">
              {rt ? "Save mapping" : "Remove mapping"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <Field label="Their room">
            <Select value={rt} onChange={(e) => { setRt(e.target.value); setRp(""); }}>
              <option value="">Not mapped (does not sell there)</option>
              {(remote.data?.roomTypes ?? []).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Their rate plan" hint="Your best available rate is sent to it">
            <Select value={rp} onChange={(e) => setRp(e.target.value)} disabled={!rt}>
              <option value="">Choose a rate plan</option>
              {(remote.data?.ratePlans ?? []).filter((p) => p.roomTypeId === rt).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Dialog>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

function OtaBookings() {
  const [channel, setChannel] = useState("");
  const [page, setPage] = useState(1);
  const q = useOtaBookings({ channel: channel || undefined, page, pageSize: 20 });
  const items = q.data?.items ?? [];
  const pages = Math.max(1, Math.ceil((q.data?.total ?? 0) / 20));
  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap gap-1.5 border-b border-line p-3 sm:px-5">
        {["", "BOOKING_COM", "EXPEDIA", "AIRBNB", "AGODA"].map((c) => (
          <button key={c || "all"} type="button" aria-pressed={channel === c} onClick={() => { setChannel(c); setPage(1); }} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium", channel === c ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:text-ink")}>
            {c ? OTA_NAME[c as OtaChannel] : "Every channel"}
          </button>
        ))}
      </div>
      {q.isLoading ? (
        <Skeleton className="m-5 h-60" />
      ) : items.length === 0 ? (
        <EmptyState glyph="river" title="No OTA bookings" />
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[860px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left">
                {["Channel", "Guest", "Stay", "Room", "Paid to OTA", "Status"].map((h, i) => (
                  <th key={h} className={cn("eyebrow px-4 py-2.5 text-[10px] font-normal", i === 4 && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((b) => (
                <tr key={b.id} className="border-b border-line last:border-b-0">
                  <td className="px-4 py-2.5">
                    <ChannelSeal code={b.channel} name={OTA_NAME[b.channel]} size="sm" />
                    <span className="mt-0.5 block pl-7 font-mono text-[10.5px] text-ink-faint">{b.externalId}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    {b.reservation ? (
                      <Link href={`/reservations/${b.reservation.id}`} className="text-ink hover:text-laterite">
                        {b.reservation.guestName}
                        <span className="block font-mono text-[11px] text-ink-muted">{b.reservation.code}</span>
                      </Link>
                    ) : (
                      <span className="text-ink-faint">not created</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-ink">
                    {b.reservation ? `${formatDate(b.reservation.arrivalDate, { day: "numeric", month: "short", year: undefined })} to ${formatDate(b.reservation.departureDate, { day: "numeric", month: "short", year: undefined })}` : "-"}
                  </td>
                  <td className="px-4 py-2.5">
                    {b.overbooked ? (
                      <Link href="/guard" className="inline-flex">
                        <Badge tone="danger" icon={<WarningOctagon size={11} weight="bold" />}>
                          Overbooked
                        </Badge>
                      </Link>
                    ) : b.reservation?.roomNumber ? (
                      <span className="font-mono text-ink">{b.reservation.roomNumber}</span>
                    ) : (
                      <span className="text-[12px] italic text-ink-muted">unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {b.commissionKobo != null ? (
                      <>
                        <span className="font-mono text-danger">{naira(b.commissionKobo)}</span>
                        <span className="block font-mono text-[11px] text-ink-muted">
                          of {naira(b.grossKobo)} &middot; {(b.commissionBps ?? 0) / 100}%
                        </span>
                      </>
                    ) : (
                      <span className="text-[12px] text-ink-faint">no price on iCal</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">{b.reservation ? <StayBadge status={b.reservation.status} /> : <Badge>{b.status.toLowerCase()}</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-1 border-t border-line px-4 py-2">
          <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </Panel>
  );
}

function SyncLogView({ conns }: { conns: ChannelConnection[] }) {
  const [status, setStatus] = useState("");
  const q = useSyncLogs({ status: status || undefined, pageSize: 50 });
  const byId = new Map(conns.map((c) => [c.id, c]));
  return (
    <Panel className="overflow-hidden">
      <div className="flex gap-1.5 border-b border-line p-3 sm:px-5">
        {[
          ["", "Everything"],
          ["ERROR", "Errors"],
        ].map(([k, l]) => (
          <button key={k || "all"} type="button" aria-pressed={status === k} onClick={() => setStatus(k)} className={cn("h-8 rounded-full border px-3 text-[12.5px] font-medium", status === k ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:text-ink")}>
            {l}
          </button>
        ))}
      </div>
      <ol className="divide-y divide-line">
        {(q.data?.items ?? []).map((l) => (
          <li key={l.id} className="grid grid-cols-[88px_1fr] gap-3 px-4 py-3 sm:grid-cols-[120px_150px_1fr] sm:px-5">
            <span className="font-mono text-[11.5px] text-ink-muted">{formatDateTime(l.startedAt).replace(/,? \d{4}/, "")}</span>
            <span className="hidden text-[12.5px] text-ink sm:block">
              {byId.get(l.connectionId)?.name ?? "Channel"}
              <span className="mt-0.5 flex items-center gap-2">
                <SyncDirection dir={l.direction === "WEBHOOK" ? "PULL" : l.direction} />
                <span className="font-mono text-[10.5px] uppercase tracking-wider text-ink-faint">{l.kind.replace("_", " ")}</span>
              </span>
            </span>
            <span className="min-w-0">
              <span className={cn("block text-[13px]", l.status === "ERROR" ? "text-danger" : "text-ink")}>{l.summary}</span>
              {l.error && <span className="block text-[12px] text-danger">{l.error}</span>}
            </span>
          </li>
        ))}
        {q.data && !q.data.items.length && <li className="px-5 py-8 text-center text-[13px] text-ink-muted">Nothing logged.</li>}
      </ol>
    </Panel>
  );
}

/* ------------------------------------------------------------------ */

function ConnectSheet({ open, onOpenChange, hasChannex }: { open: boolean; onOpenChange: (o: boolean) => void; hasChannex: boolean }) {
  const qc = useQueryClient();
  const [kind, setKind] = useState<"ICAL" | "CHANNEX">("ICAL");
  const [channel, setChannel] = useState<OtaChannel>("AIRBNB");
  const [buffer, setBuffer] = useState("1");
  const [apiKey, setApiKey] = useState("");
  const [pid, setPid] = useState("");
  const create = useMutation({
    mutationFn: () => (kind === "ICAL" ? channelsApi.create({ provider: "ICAL", channel, stopSellBuffer: Number(buffer || 0) }) : channelsApi.create({ provider: "CHANNEX", apiKey: apiKey.trim() || undefined, externalPropertyId: pid.trim() || undefined })),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ["channels"] });
      onOpenChange(false);
      toast.success(`${c.name} connected`, c.provider === "ICAL" ? "Copy your calendar links into it next." : "Map your room types next.");
    },
    meta: { errorTitle: "Not connected" },
  });
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Channel manager"
      title="Connect a channel"
      width="max-w-lg"
      footer={
        <Button className="w-full" onClick={() => create.mutate()} loading={create.isPending} disabled={kind === "CHANNEX" && hasChannex} data-testid="connect-confirm">
          Connect
        </Button>
      }
    >
      <div role="radiogroup" aria-label="How" className="grid gap-2">
        {(
          [
            ["ICAL", "iCal calendar", "Airbnb, Vrbo, Booking.com and most OTAs. Dates only, works today, no partner agreement.", CalendarBlank],
            ["CHANNEX", "Channex", "Booking.com, Expedia and Agoda with prices, availability and restrictions, two-way.", Key],
          ] as const
        ).map(([k, title, blurb, I]) => (
          <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={cn("flex items-start gap-3 rounded-md border p-4 text-left", kind === k ? "border-ink shadow-[0_0_0_1px_var(--ink)]" : "border-line-strong hover:border-ink-faint")}>
            <I size={20} weight="duotone" className="mt-0.5 text-ink-muted" />
            <span>
              <span className="block text-[14px] font-medium text-ink">{title}</span>
              <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-muted">{blurb}</span>
            </span>
          </button>
        ))}
      </div>
      {kind === "ICAL" ? (
        <div className="mt-5 flex flex-col gap-4">
          <Field label="Channel">
            <Select value={channel} onChange={(e) => setChannel(e.target.value as OtaChannel)}>
              {(Object.keys(OTA_NAME) as OtaChannel[]).map((c) => (
                <option key={c} value={c}>
                  {OTA_NAME[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Rooms held back per type" hint="Fewer double bookings in the 15-minute gap. 1 is a good start.">
            <Input inputMode="numeric" value={buffer} onChange={(e) => setBuffer(e.target.value.replace(/\D/g, ""))} />
          </Field>
        </div>
      ) : (
        <div className="mt-5 flex flex-col gap-4">
          {hasChannex && <p className="rounded-md bg-ochre-wash px-3 py-2 text-[12.5px] text-ink">This property already has a Channex connection.</p>}
          <Field label="Channex API key" hint={process.env.NODE_ENV !== "production" ? "Leave empty in development to use the built-in mock." : "From Channex: Settings, API access."}>
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} className="font-mono" autoComplete="off" />
          </Field>
          <Field label="Channex property id" optional>
            <Input value={pid} onChange={(e) => setPid(e.target.value)} className="font-mono" />
          </Field>
        </div>
      )}
    </Sheet>
  );
}

function SimBooking({ open, onOpenChange, connectionId, types }: { open: boolean; onOpenChange: (o: boolean) => void; connectionId: string; types: { id: string; name: string }[] }) {
  const qc = useQueryClient();
  const [typeId, setTypeId] = useState("");
  const [ota, setOta] = useState<OtaChannel>("BOOKING_COM");
  const [name, setName] = useState("Sophie Martin");
  const from = addDays(todayKey(), 5);
  const m = useMutation({
    mutationFn: () => channelsApi.devBooking({ connectionId, roomTypeId: typeId || types[0]?.id, checkIn: from, checkOut: addDays(from, 2), otaChannel: ota, guestName: name }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["channels"] });
      void qc.invalidateQueries({ queryKey: ["reservations"] });
      onOpenChange(false);
      toast.success("Booking delivered", `${r.externalId}: the signed webhook returned ${r.webhook.status}.`);
    },
    meta: { errorTitle: "Not delivered" },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Development"
      title="Simulate an OTA booking"
      description={`Two nights from ${formatDate(from)}, delivered as a signed Channex webhook through the real handler.`}
      footer={
        <Button onClick={() => m.mutate()} loading={m.isPending}>
          Deliver the booking
        </Button>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Room type">
          <Select value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="From">
          <Select value={ota} onChange={(e) => setOta(e.target.value as OtaChannel)}>
            {(["BOOKING_COM", "EXPEDIA", "AGODA"] as OtaChannel[]).map((c) => (
              <option key={c} value={c}>
                {OTA_NAME[c]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Guest name" className="sm:col-span-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
      </div>
    </Dialog>
  );
}
