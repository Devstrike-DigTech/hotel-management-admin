"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CaretLeft, CaretRight, CaretRight as Chevron, MagnifyingGlass, Plus, Sun } from "@phosphor-icons/react";
import { useReservations } from "@/lib/api/hooks-m2";
import type { ReservationQuery, StayType } from "@/lib/api/types-m2";
import { useCan } from "@/lib/permissions";
import { openNewReservation } from "@/lib/store-m2";
import { addDays, formatDay, lagosHHMM, todayKey } from "@/lib/dates";
import { SOURCES, SOURCE_ORDER, type ReservationSource } from "@/lib/catalog-m2";
import { cn } from "@/lib/cn";
import { formatPhone } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { EmptyState, ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { BalancePill, Code, GuestName, StayBadge } from "@/components/m2/bits";

const VIEWS = [
  { value: "upcoming", label: "Upcoming", status: "PENDING,CONFIRMED" },
  { value: "inhouse", label: "In house", status: "CHECKED_IN" },
  { value: "departed", label: "Checked out", status: "CHECKED_OUT" },
  { value: "lost", label: "Cancelled & no-show", status: "CANCELLED,NO_SHOW" },
  { value: "all", label: "All", status: "" },
] as const;
type View = (typeof VIEWS)[number]["value"];

const RANGES = [
  { value: "any", label: "Any dates" },
  { value: "today", label: "Today" },
  { value: "week", label: "Next 7 days" },
  { value: "month", label: "Next 30 days" },
  { value: "past", label: "Last 30 days" },
] as const;
type Range = (typeof RANGES)[number]["value"];

export function ReservationsList() {
  const router = useRouter();
  const search = useSearchParams();
  const { can } = useCan();
  const [view, setView] = useState<View>("upcoming");
  const [range, setRange] = useState<Range>("any");
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [stayType, setStayType] = useState<StayType | "">("");
  const [source, setSource] = useState<ReservationSource | "">("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (search.get("new") === "1") {
      openNewReservation({});
      router.replace("/reservations");
    }
  }, [search, router]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(q.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(id);
  }, [q]);

  const today = todayKey();
  const dates: Pick<ReservationQuery, "from" | "to"> =
    range === "today"
      ? { from: today, to: today }
      : range === "week"
        ? { from: today, to: addDays(today, 7) }
        : range === "month"
          ? { from: today, to: addDays(today, 30) }
          : range === "past"
            ? { from: addDays(today, -30), to: today }
            : {};
  const query: ReservationQuery = {
    status: VIEWS.find((v) => v.value === view)!.status || undefined,
    q: debounced || undefined,
    stayType: stayType || undefined,
    source: source || undefined,
    page,
    pageSize: 25,
    ...dates,
  };
  const list = useReservations(query);
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / 25));

  return (
    <>
      <PageHeader
        eyebrow="Front of house"
        title={
          <>
            Reser<em>vations</em>
          </>
        }
        description="Every booking, by code, guest or phone. Open one to see its folio, check in or check out."
        actions={
          can("reservations.write") && (
            <Button onClick={() => openNewReservation({})}>
              <Plus size={15} weight="bold" /> New reservation
            </Button>
          )
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="scrollbar-thin -mx-4 flex gap-1 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="tablist" aria-label="Reservation views">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              role="tab"
              aria-selected={view === v.value}
              onClick={() => {
                setView(v.value);
                setPage(1);
              }}
              className={cn(
                "relative h-9 shrink-0 whitespace-nowrap px-3 text-[13.5px] font-medium transition-colors",
                view === v.value ? "text-ink" : "text-ink-muted hover:text-ink",
              )}
            >
              {v.label}
              {view === v.value && <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-laterite" />}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
            <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Code, guest name or phone" className="h-9 pl-9" aria-label="Search reservations" />
          </div>
          <Select value={range} onChange={(e) => { setRange(e.target.value as Range); setPage(1); }} className="h-9 w-auto min-w-[140px]" aria-label="Dates">
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <Select value={stayType} onChange={(e) => { setStayType(e.target.value as StayType | ""); setPage(1); }} className="h-9 w-auto min-w-[130px]" aria-label="Stay type">
            <option value="">Any stay</option>
            <option value="NIGHTLY">Overnight</option>
            <option value="DAY_USE">Day use</option>
          </Select>
          <Select value={source} onChange={(e) => { setSource(e.target.value as ReservationSource | ""); setPage(1); }} className="h-9 w-auto min-w-[130px]" aria-label="Source">
            <option value="">Any source</option>
            {SOURCE_ORDER.map((s) => (
              <option key={s} value={s}>
                {SOURCES[s]}
              </option>
            ))}
          </Select>
          <span className="ml-auto font-mono text-[12px] text-ink-muted">{list.data ? `${total} found` : ""}</span>
        </div>
      </div>

      <Panel className="overflow-hidden">
        {list.isError ? (
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        ) : list.isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !list.data?.items.length ? (
          <EmptyState
            glyph="dots"
            title={debounced ? `Nothing matches “${debounced}”` : "No reservations here"}
            body="Try another view or date range, or take a new booking."
            action={
              can("reservations.write") && (
                <Button variant="secondary" onClick={() => openNewReservation({})}>
                  <Plus size={14} weight="bold" /> New reservation
                </Button>
              )
            }
          />
        ) : (
          <>
            <table className="hidden w-full text-[13.5px] md:table">
              <thead>
                <tr className="border-b border-line text-left">
                  <th className="eyebrow py-3 pl-5 text-[10px] font-normal">Code</th>
                  <th className="eyebrow py-3 text-[10px] font-normal">Guest</th>
                  <th className="eyebrow py-3 text-[10px] font-normal">Stay</th>
                  <th className="eyebrow py-3 text-[10px] font-normal">Room</th>
                  <th className="eyebrow py-3 text-[10px] font-normal">Status</th>
                  <th className="eyebrow py-3 pr-5 text-right text-[10px] font-normal">Balance</th>
                </tr>
              </thead>
              <tbody>
                {list.data.items.map((r) => (
                  <tr
                    key={r.id}
                    onClick={() => router.push(`/reservations/${r.id}`)}
                    className="group cursor-pointer border-b border-line last:border-0 hover:bg-surface-2/50"
                  >
                    <td className="py-3 pl-5">
                      <Link href={`/reservations/${r.id}`} className="font-mono text-[13px] tracking-wide text-ink" onClick={(e) => e.stopPropagation()}>
                        {r.code}
                      </Link>
                    </td>
                    <td className="max-w-[220px] py-3 pr-3">
                      <GuestName name={r.guest.fullName} vip={r.guest.vip} className="text-ink" />
                      <span className="block font-mono text-[11.5px] text-ink-faint">{formatPhone(r.guest.phone)}</span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="text-ink">
                        {formatDay(r.arrivalDate, { weekday: "short", day: "numeric", month: "short" })}
                        {r.stayType === "NIGHTLY" && <span className="text-ink-faint"> &rarr; </span>}
                        {r.stayType === "NIGHTLY" && formatDay(r.departureDate, { day: "numeric", month: "short" })}
                      </span>
                      <span className="block text-[12px] text-ink-muted">
                        {r.stayType === "DAY_USE" ? (
                          <span className="inline-flex items-center gap-1">
                            <Sun size={12} /> {lagosHHMM(r.arrivalAt)} to {lagosHHMM(r.departureAt)}
                          </span>
                        ) : (
                          `${r.nights} ${r.nights === 1 ? "night" : "nights"}`
                        )}
                      </span>
                    </td>
                    <td className="py-3 pr-3">
                      <span className="font-mono text-ink">{r.room?.number ?? <span className="text-ink-faint">-</span>}</span>
                      <span className="block text-[12px] text-ink-muted">{r.roomType.name}</span>
                    </td>
                    <td className="py-3 pr-3">
                      <StayBadge status={r.status} />
                    </td>
                    <td className="py-3 pr-5 text-right">
                      <span className="inline-flex items-center gap-2">
                        {r.balanceKobo === 0 && ["PENDING", "CONFIRMED", "CANCELLED", "NO_SHOW"].includes(r.status) ? (
                          <span className="font-mono text-[12px] text-ink-faint">-</span>
                        ) : (
                          <BalancePill kobo={r.balanceKobo} />
                        )}
                        <Chevron size={13} className="text-ink-faint opacity-0 transition-opacity group-hover:opacity-100" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <ul className="divide-y divide-line md:hidden">
              {list.data.items.map((r) => (
                <li key={r.id}>
                  <Link href={`/reservations/${r.id}`} className="flex items-start gap-3 px-4 py-3.5 active:bg-surface-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Code value={r.code} className="text-[12px] text-ink-muted" />
                        <StayBadge status={r.status} />
                      </div>
                      <GuestName name={r.guest.fullName} vip={r.guest.vip} className="mt-1 text-[15px] font-medium text-ink" />
                      <p className="mt-0.5 text-[12.5px] text-ink-muted">
                        {formatDay(r.arrivalDate, { weekday: "short", day: "numeric", month: "short" })}
                        {r.stayType === "NIGHTLY" ? `, ${r.nights}n` : `, ${lagosHHMM(r.arrivalAt)} day use`} &middot;{" "}
                        {r.room ? `Room ${r.room.number}` : r.roomType.name}
                      </p>
                    </div>
                    <div className="pt-1">
                      <BalancePill kobo={r.balanceKobo} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2">
          <span className="font-mono text-[12px] text-ink-muted">
            {page} / {pages}
          </span>
          <Button size="icon" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
            <CaretLeft size={14} />
          </Button>
          <Button size="icon" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
            <CaretRight size={14} />
          </Button>
        </div>
      )}
    </>
  );
}
