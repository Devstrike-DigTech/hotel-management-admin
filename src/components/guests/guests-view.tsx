"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CaretLeft, CaretRight, Crown, MagnifyingGlass } from "@phosphor-icons/react";
import { useGuests } from "@/lib/api/hooks-m2";
import { formatDate, formatPhone, initials } from "@/lib/format";
import { ID_TYPES } from "@/lib/catalog-m2";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { EmptyState, ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { GuestName } from "@/components/m2/bits";

export function GuestsView() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [vip, setVip] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => {
    const id = window.setTimeout(() => {
      setDebounced(q.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(id);
  }, [q]);
  const list = useGuests({ q: debounced || undefined, vip: vip || undefined, page, pageSize: 30 });
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 30));
  return (
    <>
      <PageHeader
        eyebrow="Guest book"
        title={
          <>
            <em>Guests</em>
          </>
        }
        description="Everyone who has stayed, found by name, phone or company. ID numbers stay masked; opening one is logged."
      />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1 sm:max-w-md">
          <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, phone, email or company" className="h-9 pl-9" aria-label="Search guests" />
        </div>
        <button
          onClick={() => {
            setVip((v) => !v);
            setPage(1);
          }}
          aria-pressed={vip}
          className={cn(
            "inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-[13px] font-medium",
            vip ? "border-brass bg-brass-wash text-brass" : "border-line bg-surface text-ink-muted hover:text-ink",
          )}
        >
          <Crown size={14} weight={vip ? "fill" : "regular"} /> VIP only
        </button>
        <span className="ml-auto font-mono text-[12px] text-ink-muted">{list.data ? `${list.data.total} guests` : ""}</span>
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
          <EmptyState glyph="rings" title="No guests found" body="Guests are added when you take a booking or check someone in." />
        ) : (
          <ul className="divide-y divide-line">
            {list.data.items.map((g) => (
              <li key={g.id}>
                <Link href={`/guests/${g.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 px-5 py-3 hover:bg-surface-2/50 md:grid-cols-[auto_minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_90px_110px]">
                  <span
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-full border font-mono text-[11px]",
                      g.anonymisedAt ? "border-dashed border-line-strong text-ink-faint" : "border-line bg-surface-2 text-ink-muted",
                    )}
                  >
                    {g.anonymisedAt ? "--" : initials(g.fullName)}
                  </span>
                  <span className="min-w-0">
                    <GuestName name={g.fullName} vip={g.vip} className={cn("text-[14px] font-medium", g.anonymisedAt ? "italic text-ink-faint" : "text-ink")} />
                    <span className="block truncate text-[12px] text-ink-muted">{g.company ?? g.email ?? g.nationality}</span>
                  </span>
                  <span className="hidden font-mono text-[12.5px] text-ink-muted md:block">{formatPhone(g.phone)}</span>
                  <span className="hidden text-[12.5px] text-ink-muted md:block">
                    {g.idType ? (
                      <>
                        {ID_TYPES[g.idType].split(" ")[0]} <span className="font-mono">{g.idNumberMasked}</span>
                      </>
                    ) : (
                      <span className="text-ink-faint">no ID</span>
                    )}
                  </span>
                  <span className="hidden text-right font-mono text-[12.5px] text-ink md:block">
                    {g.stayCount} <span className="text-ink-faint">{g.stayCount === 1 ? "stay" : "stays"}</span>
                  </span>
                  <span className="text-right text-[12px] text-ink-muted">{g.lastStayAt ? formatDate(g.lastStayAt, { day: "numeric", month: "short", year: "2-digit" }) : "-"}</span>
                </Link>
              </li>
            ))}
          </ul>
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
