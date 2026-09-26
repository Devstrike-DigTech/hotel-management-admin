"use client";

import Link from "next/link";
import { CallBell, Flag, Timer } from "@phosphor-icons/react";
import { useConciergeAccess, useConciergeToday } from "@/lib/api/hooks-m8";
import { lagosHHMM } from "@/lib/dates";
import { ButtonLink } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { CategoryGlyph, DISCREET_HOLDERS, SealGlyph } from "./bits";
import { STATUS } from "./catalog";

/**
 * Today: new and late requests. Today is a shared screen, so a private request never shows its
 * service or guest here, whoever is signed in (API-M8 6.5): it is counted, not listed.
 */
export function ConciergeTodayCard() {
  const access = useConciergeAccess();
  const q = useConciergeToday();
  if (!access.view || !q.data) return null;
  const d = q.data;
  if (!d.new && !d.overdue && !d.today && !d.discreet && !d.quoted && !d.inProgress) return null;
  const list = d.next.filter((r) => !r.discreet && !r.masked).slice(0, 4);
  return (
    <Panel data-testid="concierge-today">
      <PanelHeader
        eyebrow="Concierge"
        title={
          <>
            {d.new} new, {d.today} today
          </>
        }
        actions={
          <ButtonLink href="/concierge" size="sm" variant="secondary">
            <CallBell size={14} /> Board
          </ButtonLink>
        }
      />
      {(d.overdue > 0 || (d.flagged > 0 && access.review)) && (
        <div className="flex flex-wrap border-b border-line">
          {d.overdue > 0 && (
            <Link href="/concierge" className="flex flex-1 items-center gap-2 bg-laterite-wash/60 px-5 py-2 text-[12.5px] text-ink hover:bg-laterite-wash">
              <Timer size={14} weight="fill" className="text-laterite" /> {d.overdue} late for a first answer
            </Link>
          )}
          {d.flagged > 0 && access.review && (
            <Link href="/concierge" className="flex flex-1 items-center gap-2 bg-ochre-wash/60 px-5 py-2 text-[12.5px] text-ink hover:bg-ochre-wash">
              <Flag size={14} weight="fill" className="text-ochre" /> {d.flagged} held for you to look at
            </Link>
          )}
        </div>
      )}
      <ul className="divide-y divide-line">
        {list.map((r) => (
          <li key={r.id}>
            <Link href={`/concierge/requests/${r.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2/50">
              <span className="w-11 font-mono text-[13px] text-ink">{r.preferredStart ? lagosHHMM(r.preferredStart) : "--:--"}</span>
              <CategoryGlyph category={r.category} size={15} className="text-ink-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink">{r.title}</span>
                <span className="block truncate text-[11.5px] text-ink-muted">{r.roomNumber ? `Room ${r.roomNumber}` : "Before arrival"}</span>
              </span>
              <span className="text-[11.5px] text-ink-muted">{STATUS[r.status].label}</span>
            </Link>
          </li>
        ))}
        {!list.length && <li className="px-5 py-4 text-[13px] text-ink-muted">Nothing waiting that can be shown here.</li>}
      </ul>
      {d.discreet > 0 && (
        <p className="flex items-center gap-2 border-t border-line px-5 py-2.5 text-[12px] text-ink-muted" data-testid="today-discreet-count">
          <SealGlyph size={14} className="shrink-0 text-brass" />
          <span>
            and <span className="font-mono text-ink">{d.discreet}</span> private {d.discreet === 1 ? "request" : "requests"}, counted but never shown on this screen. {access.discreet ? "Open them from the board." : `Handled by ${DISCREET_HOLDERS}.`}
          </span>
        </p>
      )}
    </Panel>
  );
}
