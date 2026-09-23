"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  AirplaneLanding,
  AirplaneTakeoff,
  Bed,
  Door,
  IdentificationCard,
  Money,
  SignIn,
  Sun,
  WarningCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import type { FrontDeskToday, TodayStay } from "@/lib/api/types-m2";
import { reservationsApi } from "@/lib/api/endpoints-m2";
import { useNow } from "@/lib/use-now";
import { useCan } from "@/lib/permissions";
import { openPayment } from "@/lib/store-m2";
import { dayStartMs, lagosHHMM, todayKey } from "@/lib/dates";
import { naira, relativeTime } from "@/lib/format";
import { STAY_STATUS } from "@/lib/catalog-m2";
import { Segmented, Skeleton } from "@/components/ui/primitives";
import { GuestName } from "@/components/m2/bits";

type Col = "arrivals" | "inHouse" | "departures";

/** Arrivals / In house / Departures, with the next action on every card. */
export function FrontDeskBoard({ data, loading, onPeek }: { data?: FrontDeskToday; loading: boolean; onPeek: (id: string) => void }) {
  const [col, setCol] = useState<Col>("arrivals");
  const cols: { key: Col; title: string; icon: React.ReactNode; items: TodayStay[]; sub: string }[] = useMemo(() => {
    const d = data;
    const nightly = (list: TodayStay[]) => list.filter((s) => s.stayType === "NIGHTLY");
    return [
      {
        key: "arrivals",
        title: "Arriving",
        icon: <AirplaneLanding size={16} weight="duotone" />,
        items: d ? sortArrivals(nightly(d.arrivals)) : [],
        sub: d ? `${d.counts.arrivalsPending} to come` : "",
      },
      {
        key: "inHouse",
        title: "In the house",
        icon: <Bed size={16} weight="duotone" />,
        items: d ? [...nightly(d.inHouse)].sort((a, b) => b.balanceKobo - a.balanceKobo) : [],
        sub: d ? `${d.counts.inHouse} guests` : "",
      },
      {
        key: "departures",
        title: "Leaving",
        icon: <AirplaneTakeoff size={16} weight="duotone" />,
        items: d ? [...nightly(d.departures)].sort((a, b) => Number(a.status === "CHECKED_OUT") - Number(b.status === "CHECKED_OUT") || Number(b.overdue) - Number(a.overdue)) : [],
        sub: d ? `${d.counts.departuresPending} to go` : "",
      },
    ];
  }, [data]);

  return (
    <section aria-label="Front desk board" className="flex flex-col gap-4">
      <div className="md:hidden">
        <Segmented<Col>
          label="Board column"
          value={col}
          onChange={setCol}
          className="w-full [&>button]:flex-1 [&>button]:justify-center"
          options={cols.map((c) => ({ value: c.key, label: <>{c.title.replace("In the house", "In house")} <span className="font-mono text-ink-faint">{c.items.length}</span></> }))}
        />
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {cols.map((c) => (
          <div key={c.key} className={cn("min-w-0 flex-col rounded-lg border border-line bg-surface", col === c.key ? "flex" : "hidden md:flex")} data-testid={`board-${c.key}`}>
            <header className="flex items-center gap-2 border-b border-line px-4 py-3">
              <span className="text-laterite">{c.icon}</span>
              <h3 className="display-sm text-[16px] text-ink">{c.title}</h3>
              <span className="ml-auto font-mono text-[11.5px] text-ink-muted">{c.sub}</span>
            </header>
            <ul className="scrollbar-thin flex max-h-[420px] flex-col overflow-y-auto p-1.5">
              {loading ? (
                Array.from({ length: 3 }, (_, i) => (
                  <li key={i} className="p-2">
                    <Skeleton className="h-14 w-full" />
                  </li>
                ))
              ) : c.items.length === 0 ? (
                <li className="px-4 py-8 text-center text-[13px] italic text-ink-faint">
                  {c.key === "arrivals" ? "No arrivals today." : c.key === "inHouse" ? "No one in the house." : "No departures today."}
                </li>
              ) : (
                c.items.map((s) => <StayCard key={s.id} s={s} col={c.key} onPeek={onPeek} />)
              )}
            </ul>
          </div>
        ))}
      </div>
      {data && data.dayUse.length > 0 && <DayUseStrip items={data.dayUse} onPeek={onPeek} />}
    </section>
  );
}

function sortArrivals(list: TodayStay[]) {
  return [...list].sort((a, b) => Number(a.status === "CHECKED_IN") - Number(b.status === "CHECKED_IN") || a.arrivalAt.localeCompare(b.arrivalAt));
}

function StayCard({ s, col, onPeek }: { s: TodayStay; col: Col; onPeek: (id: string) => void }) {
  const { can } = useCan();
  const act = can("frontdesk.act");
  const done = (col === "arrivals" && s.status === "CHECKED_IN") || (col === "departures" && s.status === "CHECKED_OUT");
  const m = STAY_STATUS[s.status];
  return (
    <li className={cn("group relative rounded-md px-3 py-2.5 transition-colors hover:bg-surface-2/60", done && "opacity-55")}>
      <span aria-hidden className="absolute bottom-2.5 left-0 top-2.5 w-[3px] rounded-r-full" style={{ background: s.overdue ? "var(--danger)" : m.color }} />
      <div className="flex items-start gap-3 pl-1">
        <button onClick={() => onPeek(s.id)} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-2">
            <GuestName name={s.guest.fullName} vip={s.guest.vip} className={cn("text-[14px] font-medium text-ink", done && "line-through decoration-ink-faint")} />
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-muted">
            <span className="font-mono">{s.room ? s.room.number : "no room"}</span>
            <span className="text-ink-faint">&middot;</span>
            <span className="truncate">{s.roomType.name}</span>
            {col === "departures" && !done && (
              <>
                <span className="text-ink-faint">&middot;</span>
                <span className={cn("font-mono", s.overdue && "text-danger")}>
                  {s.overdue ? `due ${lagosHHMM(s.departureAt)}` : `out ${lagosHHMM(s.departureAt)}`}
                </span>
              </>
            )}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2">
            {s.balanceKobo > 0 && <span className="font-mono text-[11.5px] text-ochre">owes {naira(s.balanceKobo)}</span>}
            {s.balanceKobo < 0 && <span className="font-mono text-[11.5px] text-palm">credit {naira(-s.balanceKobo)}</span>}
            {!s.registrationComplete && s.status === "CHECKED_IN" && (
              <span className="inline-flex items-center gap-1 text-[11.5px] text-ochre">
                <IdentificationCard size={12} /> register
              </span>
            )}
            {done && <span className="text-[11.5px] text-ink-faint">{col === "arrivals" ? "arrived" : "left"}</span>}
          </span>
        </button>
        {act && !done && (
          <div className="flex shrink-0 items-center gap-1">
            {col === "arrivals" && (
              <Link
                href={`/reservations/${s.id}/check-in`}
                className="inline-flex h-8 items-center gap-1.5 rounded-sm bg-laterite px-2.5 text-[12.5px] font-medium text-laterite-ink hover:bg-laterite-hover"
                data-testid="board-check-in"
              >
                <SignIn size={14} weight="bold" /> In
              </Link>
            )}
            {col !== "arrivals" && s.balanceKobo > 0 && (
              <button
                onClick={() =>
                  void reservationsApi
                    .get(s.id)
                    .then((r) => openPayment({ folioId: r.folioId, label: s.guest.fullName, balanceKobo: r.balanceKobo, reservationCode: s.code }))
                    .catch(() => onPeek(s.id))
                }
                className="grid h-8 w-8 place-items-center rounded-sm border border-line-strong text-ink-muted hover:bg-surface hover:text-ink"
                aria-label={`Take payment from ${s.guest.fullName}`}
                title="Take payment"
              >
                <Money size={15} weight="duotone" />
              </button>
            )}
            {col === "departures" && (
              <Link
                href={`/reservations/${s.id}?checkout=1`}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-sm px-2.5 text-[12.5px] font-medium",
                  s.overdue ? "bg-danger text-paper" : "bg-ink text-paper hover:opacity-90",
                )}
              >
                <Door size={14} weight="bold" /> Out
              </Link>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

/** Day-use stays on a 06:00 to 23:00 rail with the current time. */
function DayUseStrip({ items, onPeek }: { items: TodayStay[]; onPeek: (id: string) => void }) {
  const start = dayStartMs(todayKey()) + 6 * 3600_000;
  const end = start + 17 * 3600_000;
  const pos = (iso: string | number) => Math.min(100, Math.max(0, (((typeof iso === "number" ? iso : +new Date(iso)) - start) / (end - start)) * 100));
  const now = useNow();
  return (
    <div className="rounded-lg border border-line bg-surface px-4 pb-4 pt-3">
      <div className="mb-3 flex items-center gap-2">
        <Sun size={16} weight="duotone" className="text-laterite" />
        <h3 className="display-sm text-[16px] text-ink">Day use</h3>
        <span className="font-mono text-[11.5px] text-ink-muted">{items.length} today</span>
      </div>
      <div className="relative">
        <div className="relative h-5 border-b border-line">
          {Array.from({ length: 18 }, (_, i) => (
            <span key={i} className="absolute bottom-0 h-1.5 w-px bg-line-strong" style={{ left: `${(i / 17) * 100}%` }}>
              {i % 3 === 0 && (
                <span className="absolute bottom-2 -translate-x-1/2 font-mono text-[9.5px] text-ink-faint">{String(6 + i).padStart(2, "0")}</span>
              )}
            </span>
          ))}
        </div>
        <ul className="relative mt-2 flex flex-col gap-1.5">
          {items.map((s) => {
            const a = pos(s.arrivalAt);
            const b = pos(s.departureAt);
            const m = STAY_STATUS[s.status];
            const over = s.status === "CHECKED_IN" && +new Date(s.departureAt) < now;
            return (
              <li key={s.id} className="relative h-7">
                <button
                  onClick={() => onPeek(s.id)}
                  className="hatch absolute inset-y-0 flex items-center overflow-hidden rounded-[3px] border px-2 text-left"
                  style={{
                    left: `${a}%`,
                    width: `${Math.max(4, b - a)}%`,
                    color: over ? "var(--danger)" : m.color,
                    backgroundColor: m.wash,
                    borderColor: `color-mix(in oklab, ${over ? "var(--danger)" : m.color} 45%, transparent)`,
                  }}
                  aria-label={`${s.guest.fullName}, room ${s.room?.number ?? "unassigned"}, ${lagosHHMM(s.arrivalAt)} to ${lagosHHMM(s.departureAt)}`}
                >
                  <span className="truncate rounded-xs bg-surface/85 px-1 text-[11.5px] font-medium text-ink">
                    {s.room?.number ?? "-"} &middot; {s.guest.fullName.split(" ")[0]}
                    {over ? " · overstay" : ""}
                  </span>
                </button>
                {over && (
                  <WarningCircle
                    size={14}
                    weight="fill"
                    className="absolute top-1/2 -translate-y-1/2 text-danger"
                    style={{ left: `calc(${b}% + 4px)` }}
                    aria-hidden
                  />
                )}
              </li>
            );
          })}
        </ul>
        <span aria-hidden className="pointer-events-none absolute bottom-0 top-3 w-px bg-laterite" style={{ left: `${pos(now)}%` }} />
      </div>
      <p className="sr-only">Updated {relativeTime(new Date().toISOString())}</p>
    </div>
  );
}
