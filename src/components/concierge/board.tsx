"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CallBell, CheckCircle, Flag, MagnifyingGlass, Play, Plus, Star, Storefront, Timer, UsersThree, WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useMe } from "@/lib/api/hooks";
import { useConciergeAccess, useConciergeBoard, useConciergeRequest } from "@/lib/api/hooks-m8";
import type { ColumnKey, RequestListItem } from "@/lib/api/types-m8";
import { dayKeyOf, lagosHHMM, shortWeekday, todayKey } from "@/lib/dates";
import { initials, naira } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Input } from "@/components/ui/form";
import { EmptyState, ErrorState, PageHeader, Panel, Segmented, Skeleton } from "@/components/ui/primitives";
import { COLUMNS } from "./catalog";
import { CategoryGlyph, DISCREET_HOLDERS, DiscreetSeal, Masked, PrivateLine, SealGlyph, SlaTimer } from "./bits";
import { ConciergeTabs } from "./tabs";
import { QuoteComposer } from "./quote-composer";
import { useRequestActions } from "./actions";
import { NewRequestSheet } from "./new-request";

const DONE = new Set(["COMPLETED", "DECLINED", "CANCELLED"]);
type Who = "all" | "mine" | "unassigned";

export function ConciergeBoard() {
  const access = useConciergeAccess();
  const me = useMe();
  const q = useConciergeBoard();
  const params = useSearchParams();
  const router = useRouter();
  const [who, setWho] = useState<Who>("all");
  const [term, setTerm] = useState("");
  const [phoneCol, setPhoneCol] = useState<ColumnKey>("NEW");
  const [acting, setActing] = useState<RequestListItem | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (params.get("new") === "1" && access.work) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- the palette opens the sheet with ?new=1
      setCreating(true);
      router.replace("/concierge");
    }
  }, [params, access.work, router]);

  const myId = me.data?.user.id;
  const filter = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (r: RequestListItem) => {
      if (who === "mine" && r.assignee?.id !== myId) return false;
      if (who === "unassigned" && (r.assignee || r.vendor)) return false;
      if (!t) return true;
      // a private request is found by its number and room only, never by what it is or who asked
      const hay = r.masked ? [r.number, r.roomNumber] : [r.number, r.title, r.guestName, r.roomNumber, r.vendor?.name, r.assignee?.fullName, r.reservationCode];
      return hay.some((x) => x?.toLowerCase().includes(t));
    };
  }, [who, term, myId]);

  const cols = useMemo(() => {
    const m = new Map<ColumnKey, RequestListItem[]>();
    for (const c of q.data?.columns ?? []) m.set(c.key, c.items.filter(filter));
    return m;
  }, [q.data, filter]);
  const counts = q.data?.counts;
  const all = (q.data?.columns ?? []).flatMap((c) => c.items);
  const privateCount = all.filter((r) => r.discreet && !DONE.has(r.status)).length + (q.data?.hiddenDiscreet ?? 0);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <CallBell size={14} weight="duotone" /> Concierge
          </>
        }
        title={
          <>
            What guests <em>have asked for</em>.
          </>
        }
        description={<span className="max-sm:hidden">Every request from booking to checkout, answered on time. Private requests stay private: only the people allowed to see them ever do.</span>}
        actions={
          access.work ? (
            <Button onClick={() => setCreating(true)} data-testid="new-request">
              <Plus size={15} weight="bold" /> Request for a guest
            </Button>
          ) : undefined
        }
      />
      <ConciergeTabs />

      <Panel className="mb-5 grid grid-cols-4 divide-x divide-line">
        {[
          { k: "New", short: "New", v: counts?.new, icon: <CallBell size={14} className="text-laterite" /> },
          { k: "Late for a first answer", short: "Late", v: counts?.overdue, icon: <Timer size={14} className={counts?.overdue ? "text-laterite" : "text-ink-faint"} />, hot: !!counts?.overdue },
          { k: "Happening today", short: "Today", v: counts?.today, icon: <CheckCircle size={14} className="text-adire" /> },
          { k: "Private, open", short: "Private", v: q.data ? privateCount : undefined, icon: <SealGlyph size={14} className="text-brass" />, sub: access.discreet ? "you can open them" : `details for ${DISCREET_HOLDERS}` },
        ].map((c) => (
          <div key={c.k} className="flex min-w-0 flex-col gap-1 px-3 py-2.5 sm:px-5 sm:py-3.5">
            <span className="flex items-center gap-1.5 text-[11.5px] text-ink-muted sm:text-[12px]">
              <span className="max-sm:hidden">{c.icon}</span>
              <span className="truncate sm:hidden">{c.short}</span>
              <span className="truncate max-sm:hidden">{c.k}</span>
            </span>
            <span className={cn("font-mono text-[20px] leading-none sm:text-[26px]", c.hot ? "text-laterite" : "text-ink")}>{c.v ?? "–"}</span>
            {c.sub && <span className="truncate text-[11px] text-ink-faint max-sm:hidden">{c.sub}</span>}
          </div>
        ))}
      </Panel>

      {!!counts?.flagged && access.review && (
        <div className="mb-4 flex items-start gap-2.5 rounded-md border border-[color-mix(in_oklab,var(--ochre)_40%,transparent)] bg-ochre-wash/60 px-4 py-3 text-[13px] text-ink" data-testid="flagged-banner">
          <Flag size={16} weight="fill" className="mt-0.5 shrink-0 text-ochre" />
          <p>
            <span className="font-medium">{counts.flagged === 1 ? "One request is" : `${counts.flagged} requests are`} held for a manager.</span>
            <span className="max-sm:hidden"> The wording may fall outside what the hotel can arrange. Nothing was sent to a vendor, and the guest was told you&rsquo;ll get back to them.</span>
          </p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Segmented<Who>
          label="Whose"
          size="sm"
          value={who}
          onChange={setWho}
          options={[
            { value: "all", label: "Everyone's" },
            { value: "mine", label: "Mine" },
            { value: "unassigned", label: "Unassigned" },
          ]}
        />
        <label className="relative w-full sm:ml-auto sm:w-72">
          <span className="sr-only">Search requests</span>
          <MagnifyingGlass size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Number, room, guest or service" className="pl-9" data-testid="board-search" />
        </label>
      </div>

      {q.isError ? (
        <Panel>
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </Panel>
      ) : !q.data ? (
        <div className="grid gap-3 lg:grid-cols-5">
          {COLUMNS.map((c) => (
            <Skeleton key={c.key} className="h-96" />
          ))}
        </div>
      ) : (
        <>
          <div className="mb-3 lg:hidden">
            <Segmented<ColumnKey>
              label="Column"
              size="sm"
              className="w-full"
              value={phoneCol}
              onChange={setPhoneCol}
              options={COLUMNS.map((c) => ({
                value: c.key,
                label: (
                  <>
                    {c.label} <span className="font-mono text-[11px] text-ink-faint">{cols.get(c.key)?.length ?? 0}</span>
                  </>
                ),
              }))}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-5" data-testid="concierge-board">
            {COLUMNS.map((c) => {
              const items = cols.get(c.key) ?? [];
              return (
                <section key={c.key} aria-labelledby={`col-${c.key}`} className={cn("min-w-0 flex-col rounded-lg border border-line bg-surface-2/40", phoneCol === c.key ? "flex" : "hidden lg:flex")} data-column={c.key}>
                  <header className="flex items-baseline gap-2 border-b border-line px-3.5 py-2.5">
                    <h2 id={`col-${c.key}`} className="display-sm text-[16px] text-ink">
                      {c.label}
                    </h2>
                    <span className="font-mono text-[12px] text-ink-muted">{items.length}</span>
                    <span className="ml-auto hidden truncate text-[11px] text-ink-faint 2xl:inline">{c.blurb}</span>
                  </header>
                  <ol className="flex flex-col gap-2 p-2">
                    {items.map((r) => (
                      <li key={r.id}>
                        <RequestCard r={r} column={c.key} onAct={() => setActing(r)} canWork={access.work} />
                      </li>
                    ))}
                    {!items.length && <li className="px-2 py-6 text-center text-[12.5px] text-ink-faint">{c.key === "NEW" ? "All answered." : "Nothing here."}</li>}
                  </ol>
                </section>
              );
            })}
          </div>
          {q.data.hiddenDiscreet > 0 && (
            <p className="mt-4 flex items-center gap-2 text-[12px] text-ink-muted" data-testid="hidden-discreet">
              <SealGlyph size={14} className="text-brass" /> {q.data.hiddenDiscreet} private {q.data.hiddenDiscreet === 1 ? "request isn't" : "requests aren't"} listed for your role. {DISCREET_HOLDERS.charAt(0).toUpperCase() + DISCREET_HOLDERS.slice(1)} look after {q.data.hiddenDiscreet === 1 ? "it" : "them"}.
            </p>
          )}
          {!all.length && !q.data.hiddenDiscreet && (
            <Panel className="mt-4">
              <EmptyState glyph="arcs" title="No requests yet" body="When guests ask for something while booking, on their trip page or on WhatsApp, it lands here with a clock for the first answer." />
            </Panel>
          )}
        </>
      )}
      <QuickAct item={acting} onOpenChange={(o) => !o && setActing(null)} />
      <NewRequestSheet open={creating} onOpenChange={setCreating} />
    </>
  );
}

/** From the board: confirm at the catalogue price, or send a quote, without leaving the board. */
function QuickAct({ item, onOpenChange }: { item: RequestListItem | null; onOpenChange: (o: boolean) => void }) {
  const q = useConciergeRequest(item?.id ?? "", !!item);
  const { confirm } = useRequestActions();
  const r = q.data;
  const priced = !!r?.price && r.service?.pricing !== "FROM";
  return (
    <Dialog open={!!item} onOpenChange={onOpenChange} eyebrow={item?.number} title={priced ? "Confirm it" : "Quick quote"} description={priced ? "Priced from the catalogue. The guest is told at once." : "The guest can accept from the link, or reply YES on WhatsApp."} className="max-w-xl">
      {!r ? (
        <Skeleton className="h-60" />
      ) : priced ? (
        <div className="flex flex-col gap-4">
          <p className="flex items-baseline justify-between text-[14px] text-ink">
            <span>{r.price!.description}</span>
            <span className="font-mono text-[20px]">{naira(r.price!.totalKobo)}</span>
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={() => confirm.mutate({ id: r.id, paymentMethod: "ONLINE" }, { onSuccess: () => onOpenChange(false) })} loading={confirm.isPending}>
              Send a payment link
            </Button>
            <Button onClick={() => confirm.mutate({ id: r.id, paymentMethod: r.reservation?.folioOpen ? "FOLIO" : "NONE" }, { onSuccess: () => onOpenChange(false) })} loading={confirm.isPending} data-testid="quick-confirm">
              <CheckCircle size={15} /> {r.reservation?.folioOpen ? "Confirm, on the bill" : "Confirm"}
            </Button>
          </div>
        </div>
      ) : (
        <QuoteComposer r={r} onDone={() => onOpenChange(false)} />
      )}
    </Dialog>
  );
}

export function RequestCard({ r, column, onAct, canWork = false }: { r: RequestListItem; column: ColumnKey; onAct?: () => void; canWork?: boolean }) {
  const router = useRouter();
  const { progress } = useRequestActions();
  const when = r.preferredStart;
  const whenText = when ? (dayKeyOf(when) === todayKey() ? lagosHHMM(when) : `${shortWeekday(dayKeyOf(when))} ${lagosHHMM(when)}`) : null;
  const href = `/concierge/requests/${r.id}`;
  const busy = progress.isPending;

  let action: React.ReactNode = null;
  if (canWork && !r.masked) {
    if (column === "NEW" && !r.flagged && onAct)
      action = (
        <Button size="sm" variant="secondary" onClick={onAct} data-testid="card-act">
          {r.totalKobo != null ? <CheckCircle size={14} /> : null}
          {r.totalKobo != null ? "Confirm" : "Quote"}
        </Button>
      );
    else if (column === "TODAY" && (r.status === "CONFIRMED" || r.status === "SCHEDULED"))
      action = (
        <Button size="sm" variant="secondary" onClick={() => progress.mutate({ r, status: "IN_PROGRESS" })} loading={busy} data-testid="card-start">
          <Play size={13} /> Start
        </Button>
      );
    else if (r.status === "IN_PROGRESS")
      action = (
        <Button size="sm" onClick={() => router.push(`${href}#finish`)} data-testid="card-complete">
          <CheckCircle size={14} /> Finish
        </Button>
      );
    else if (r.status === "COMPLETED" && r.vendor)
      action = (
        <Button size="sm" variant="ghost" onClick={() => router.push(`${href}#rate`)}>
          <Star size={13} /> Rate
        </Button>
      );
  } else if (r.masked && r.status === "IN_PROGRESS") {
    action = (
      <Button size="sm" variant="secondary" onClick={() => progress.mutate({ r, status: "COMPLETED" })} loading={busy} data-testid="card-complete-masked">
        <CheckCircle size={14} /> Done
      </Button>
    );
  }

  const late = r.sla.overdue && r.status === "NEW";
  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-md border bg-surface transition-colors hover:border-line-strong",
        r.flagged ? "border-[color-mix(in_oklab,var(--ochre)_55%,transparent)]" : late ? "border-[color-mix(in_oklab,var(--laterite)_50%,transparent)]" : "border-line",
        DONE.has(r.status) && "opacity-80",
      )}
      data-testid="request-card"
      data-number={r.number}
      data-discreet={r.discreet || undefined}
      data-masked={r.masked || undefined}
    >
      {r.discreet && <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-brass" />}
      <Link href={href} className="block px-3 pb-2 pt-2.5 outline-none focus-visible:bg-surface-2">
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap font-mono text-[11px] text-ink-muted">{r.number}</span>
          {r.discreet && <DiscreetSeal compact readable={!r.masked} />}
          <span className="ml-auto whitespace-nowrap">{column === "NEW" ? <SlaTimer r={r} compact /> : whenText ? <span className="font-mono text-[11.5px] text-ink-muted">{whenText}</span> : null}</span>
        </div>
        <div className="mt-1.5 flex items-start gap-2">
          {r.masked ? (
            <PrivateLine className="text-[13.5px] font-medium" />
          ) : (
            <>
              <CategoryGlyph category={r.category} size={16} className="mt-0.5 shrink-0 text-ink-muted" />
              <h3 className="line-clamp-2 min-w-0 text-[13.5px] font-medium leading-snug text-ink" data-testid="card-title">
                {r.title}
              </h3>
            </>
          )}
        </div>
        <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] text-ink-muted">
          {r.roomNumber ? (
            <span className="shrink-0 whitespace-nowrap">
              Room <span className="font-mono text-ink">{r.roomNumber}</span>
            </span>
          ) : (
            <span className="shrink-0 whitespace-nowrap">Before arrival</span>
          )}
          <span aria-hidden>&middot;</span>
          {r.masked ? <Masked width="7ch" label="Guest withheld" /> : <span className="truncate">{r.guestName ?? "Guest"}</span>}
          {!!r.partySize && r.partySize > 1 && !r.masked && (
            <span className="ml-auto inline-flex shrink-0 items-center gap-0.5 font-mono text-[11px]" title={`${r.partySize} people`}>
              <UsersThree size={12} /> {r.partySize}
            </span>
          )}
        </p>
        {r.flagged && (
          <p className="mt-2 flex items-center gap-1.5 rounded-xs bg-ochre-wash/70 px-2 py-1 text-[11.5px] text-ink">
            <WarningCircle size={12} weight="fill" className="text-ochre" /> Held for a manager
          </p>
        )}
        {r.totalKobo != null && (column === "QUOTED" || column === "NEW") && (
          <p className="mt-1.5 font-mono text-[12px] text-ink">
            {naira(r.totalKobo)}
            {r.status === "AWAITING_GUEST" && <span className="font-sans text-ink-faint"> &middot; waiting to pay</span>}
          </p>
        )}
      </Link>
      {(r.assignee || r.vendor || action) && (
        <div className="flex items-center gap-2 border-t border-line px-3 py-1.5">
          {r.vendor ? (
            <span className="inline-flex min-w-0 items-center gap-1 text-[11.5px] text-ink-muted">
              <Storefront size={13} className="shrink-0" /> <span className="truncate">{r.vendor.name}</span>
            </span>
          ) : r.assignee ? (
            <span className="inline-flex min-w-0 items-center gap-1.5 text-[11.5px] text-ink-muted">
              <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full border border-line-strong bg-surface-2 font-mono text-[9px] text-ink">{initials(r.assignee.fullName)}</span>
              <span className="truncate">{r.assignee.fullName.split(" ")[0]}</span>
            </span>
          ) : (
            <span className="text-[11.5px] text-ink-faint">Unassigned</span>
          )}
          <span className="ml-auto">{action}</span>
        </div>
      )}
    </article>
  );
}
