"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Bell, X } from "@phosphor-icons/react";
import { onlineApi } from "@/lib/api/endpoints-m3";
import { qk3 } from "@/lib/api/hooks-m3";
import type { FeedItem, OnlineCounts } from "@/lib/api/types-m3";
import { useCan } from "@/lib/permissions";
import { useEntitlements } from "@/lib/auth";
import { formatDay } from "@/lib/dates";
import { naira, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { EmptyState, Panel, Skeleton } from "@/components/ui/primitives";
import { BRASS_TEXT, ChannelBadge, HoldCountdown } from "@/components/m3/bits";

const POLL_MS = 30_000;

const EVENT: Record<FeedItem["event"], { label: string; tone: string }> = {
  NEW_BOOKING: { label: "New booking", tone: "var(--laterite)" },
  PAID: { label: "Paid online", tone: "var(--palm)" },
  HOLD_EXPIRED: { label: "Hold lapsed", tone: "var(--ink-muted)" },
  CANCELLED: { label: "Cancelled", tone: "var(--danger)" },
};

function stayLine(i: FeedItem) {
  const from = formatDay(i.arrivalDate, { weekday: "short", day: "numeric", month: "short" });
  return `${i.roomTypeName}, ${from}${i.nights ? `, ${i.nights} ${i.nights === 1 ? "night" : "nights"}` : ""}`;
}

/* ---------------- runtime: poll and announce ---------------- */

/**
 * Polls the online booking feed every 30 seconds with `since` and shows a slip
 * for each new booking or payment. The first poll only sets the baseline, so
 * opening the app never replays yesterday. Mounted once in the shell.
 */
export function OnlineFeedRuntime() {
  const { can, ready } = useCan();
  const { has, me } = useEntitlements();
  const on = ready && can("online.feed") && !!me && has("reservations");
  const qc = useQueryClient();
  const since = useRef<string | null>(null);
  const seen = useRef(new Set<string>());
  const [slips, setSlips] = useState<FeedItem[]>([]);

  useEffect(() => {
    if (!on) return;
    let stop = false;
    let timer: number | undefined;
    const tick = async () => {
      try {
        const first = since.current === null;
        const feed = await onlineApi.feed(since.current ?? new Date(Date.now() - 60_000).toISOString(), 20);
        if (stop) return;
        since.current = feed.now;
        const fresh = feed.items.filter((i) => {
          const key = `${i.reservationId}:${i.event}:${i.eventAt}`;
          if (seen.current.has(key)) return false;
          seen.current.add(key);
          return true;
        });
        if (fresh.length) {
          // anything that moved rooms or money: refresh the desk views
          void qc.invalidateQueries({ queryKey: ["reservations"] });
          void qc.invalidateQueries({ queryKey: ["tape-chart"] });
          void qc.invalidateQueries({ queryKey: ["front-desk"] });
          void qc.invalidateQueries({ queryKey: qk3.feed });
          if (!first) {
            const announce = fresh.filter((i) => i.event === "NEW_BOOKING" || i.event === "PAID" || i.event === "CANCELLED");
            if (announce.length) setSlips((s) => [...announce.slice(0, 3), ...s].slice(0, 3));
          }
        }
      } catch {
        /* offline or not allowed: try again next tick */
      }
      if (!stop) timer = window.setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      stop = true;
      window.clearTimeout(timer);
    };
  }, [on, qc]);

  // each slip leaves on its own after 14 seconds
  useEffect(() => {
    if (!slips.length) return;
    const id = window.setTimeout(() => setSlips((s) => s.slice(0, -1)), 14_000);
    return () => window.clearTimeout(id);
  }, [slips]);

  if (!slips.length) return null;
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed left-3 right-3 top-[64px] z-[65] flex flex-col items-center gap-2 sm:left-auto sm:right-5 sm:items-end"
      data-testid="online-toasts"
    >
      {slips.map((i) => (
        <BookingSlip key={`${i.reservationId}-${i.eventAt}`} i={i} onClose={() => setSlips((s) => s.filter((x) => x !== i))} />
      ))}
    </div>
  );
}

/** A booking arriving, as a torn-off slip with the channel stamp. */
function BookingSlip({ i, onClose }: { i: FeedItem; onClose: () => void }) {
  const ev = EVENT[i.event];
  return (
    <div
      role="status"
      className="pointer-events-auto relative w-full max-w-[360px] overflow-hidden rounded-md border border-line bg-surface shadow-float animate-[rise_240ms_cubic-bezier(0.22,1,0.36,1)]"
      data-testid="online-toast"
    >
      <span aria-hidden className="absolute inset-x-0 top-0 h-[3px]" style={{ background: ev.tone }} />
      <div className="flex items-start gap-3 px-4 pb-3 pt-3.5">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line bg-paper text-laterite">
          <Bell size={16} weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="eyebrow text-[10px]" style={{ color: ev.tone }}>
              {ev.label}
            </p>
            <ChannelBadge source={i.channel} size="sm" />
          </div>
          <p className="display-sm mt-1 truncate text-[17px] leading-tight text-ink">{i.guestName}</p>
          <p className="mt-0.5 truncate text-[12.5px] text-ink-muted">{stayLine(i)}</p>
          <p className="mt-1.5 flex items-center gap-2 font-mono text-[12px]">
            <span className="text-ink">{naira(i.totalKobo)}</span>
            <span className="text-ink-faint">&middot;</span>
            {i.paymentMode === "PAY_AT_HOTEL" ? (
              <span className="text-ink-muted">pays at hotel</span>
            ) : i.paidKobo > 0 ? (
              <span className="text-palm">paid</span>
            ) : i.holdExpiresAt ? (
              <HoldCountdown expiresAt={i.holdExpiresAt} variant="inline" />
            ) : (
              <span className="text-ink-muted">awaiting payment</span>
            )}
          </p>
        </div>
        <button onClick={onClose} aria-label="Dismiss" className="grid h-6 w-6 shrink-0 place-items-center rounded-sm text-ink-faint hover:bg-surface-2 hover:text-ink">
          <X size={13} />
        </button>
      </div>
      <Link
        href={`/reservations/${i.reservationId}`}
        onClick={onClose}
        className="flex items-center justify-between border-t border-dashed border-line-strong px-4 py-2 text-[12.5px] font-medium text-laterite hover:bg-surface-2/60"
      >
        Open {i.code}
        <ArrowRight size={13} weight="bold" />
      </Link>
    </div>
  );
}

/* ---------------- Today card ---------------- */

/** Online bookings on Today: counts for the desk and the latest arrivals of the feed. */
export function OnlineTodayCard({ counts, enabled }: { counts?: OnlineCounts; enabled: boolean }) {
  const feed = useQuery({
    queryKey: qk3.feed,
    queryFn: () => onlineApi.feed(new Date(Date.now() - 3 * 86_400_000).toISOString(), 6),
    enabled,
    refetchInterval: POLL_MS,
  });
  const items = feed.data?.items ?? [];
  const c = counts;
  return (
    <Panel className="overflow-hidden" data-testid="online-today">
      <div className="grid md:grid-cols-12">
        <div className="flex flex-col gap-4 border-line px-5 py-4 md:col-span-4 md:border-r max-md:border-b">
          <div className="flex items-center gap-2">
            <h3 className="display-sm text-[16px] text-ink">Booked online</h3>
            <span className="ml-auto flex gap-1">
              <ChannelBadge source="MARKETPLACE" size="sm" />
              <ChannelBadge source="BOOKING_SITE" size="sm" />
            </span>
          </div>
          <dl className="grid grid-cols-3 gap-3">
            <Count k="Arriving today" v={c?.arrivalsToday} />
            <Count k="New today" v={c?.newToday} />
            <Count k="Holds open" v={c?.activeHolds} tone={c?.activeHolds ? BRASS_TEXT : undefined} />
          </dl>
          <p className="text-[12px] leading-relaxed text-ink-muted">A hold keeps a room for 20 minutes while the guest pays; it lets go by itself if they don&rsquo;t.</p>
        </div>
        <div className="md:col-span-8">
          {feed.isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState compact glyph="arcs" title="No online bookings in three days" body="New ones appear here and as a slip at the top of the screen." className="py-6" />
          ) : (
            <ul className="divide-y divide-line">
              {items.slice(0, 5).map((i) => {
                const ev = EVENT[i.event];
                return (
                  <li key={`${i.reservationId}-${i.eventAt}`}>
                    <Link href={`/reservations/${i.reservationId}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2/50">
                      <span aria-hidden className="h-7 w-[3px] shrink-0 rounded-full" style={{ background: ev.tone }} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-2">
                          <span className="truncate text-[13.5px] font-medium text-ink">{i.guestName}</span>
                          <ChannelBadge source={i.channel} size="sm" className="hidden sm:inline-flex" />
                        </p>
                        <p className="truncate text-[12px] text-ink-muted">
                          {ev.label} &middot; {stayLine(i)}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        {i.displayStatus === "AWAITING_PAYMENT" && i.holdExpiresAt ? (
                          <HoldCountdown expiresAt={i.holdExpiresAt} />
                        ) : (
                          <span className={cn("font-mono text-[12.5px]", i.paymentMode === "PAY_AT_HOTEL" ? "text-ink-muted" : "text-ink")}>{naira(i.totalKobo)}</span>
                        )}
                        <span className="block text-[11px] text-ink-faint">{relativeTime(i.eventAt)}</span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
}

function Count({ k, v, tone }: { k: string; v: number | undefined; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11.5px] text-ink-muted">{k}</dt>
      <dd className="font-mono text-[24px] leading-tight" style={{ color: tone ?? "var(--ink)" }}>
        {v ?? <Skeleton className="mt-1 h-6 w-8" />}
      </dd>
    </div>
  );
}
