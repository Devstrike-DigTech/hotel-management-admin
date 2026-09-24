"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle, Circle, Minus, Rocket, Van, WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useCan } from "@/lib/permissions";
import { useEntitlements } from "@/lib/auth";
import { useSetup, useTransfersToday } from "@/lib/api/hooks-m7";
import { kindMeta, TRANSFER_STATUS } from "@/lib/m7-catalog";
import { lagosHHMM } from "@/lib/dates";
import { ButtonLink } from "@/components/ui/button";
import { Panel, PanelHeader } from "@/components/ui/primitives";
import { CatalogIcon } from "@/components/m7/icon";

/** "Resume setup": until the wizard is complete (API-M7 5). */
export function SetupChecklistCard() {
  const { can } = useCan();
  const q = useSetup(can("settings.manage"));
  const p = q.data;
  if (!p || !p.showChecklist || p.completedAt) return null;
  const left = p.steps.filter((s) => s.status === "TODO");
  const next = p.steps.find((s) => s.key === p.currentStep);
  return (
    <Panel className="overflow-hidden" data-testid="setup-checklist">
      <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="flex flex-col gap-3 border-b border-line bg-[color-mix(in_oklab,var(--laterite-wash)_55%,var(--surface))] p-5 md:border-b-0 md:border-r">
          <p className="eyebrow flex items-center gap-1.5">
            <Rocket size={12} weight="duotone" /> Setup &middot; {p.progressPct}%
          </p>
          <h2 className="display-sm text-[21px] leading-tight text-ink">{next ? <>Next: {next.title.charAt(0).toLowerCase() + next.title.slice(1)}</> : "Almost there"}</h2>
          <div className="h-1.5 overflow-hidden rounded-xs bg-surface" role="meter" aria-label="Setup progress" aria-valuenow={p.progressPct} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full bg-laterite transition-[width] duration-500" style={{ width: `${p.progressPct}%` }} />
          </div>
          <p className="text-[12.5px] text-ink-muted">{left.length} {left.length === 1 ? "step" : "steps"} left. {p.canTakeBookings ? "You can already take bookings at the desk." : "Add rooms to start taking bookings."}</p>
          <ButtonLink href="/setup" size="sm" className="self-start" data-testid="resume-setup">
            Resume setup <ArrowRight size={13} weight="bold" />
          </ButtonLink>
        </div>
        <ol className="grid grid-cols-1 gap-x-4 p-3 sm:grid-cols-2">
          {p.steps.map((s) => (
            <li key={s.key}>
              <Link href="/setup" className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-[12.5px] hover:bg-surface-2">
                {s.status === "DONE" ? <CheckCircle size={15} weight="fill" className="text-palm" /> : s.status === "SKIPPED" ? <Minus size={15} className="text-ink-faint" /> : <Circle size={15} className={s.key === p.currentStep ? "text-laterite" : "text-ink-faint"} />}
                <span className={cn("truncate", s.status === "DONE" || s.status === "SKIPPED" ? "text-ink-muted line-through decoration-line-strong" : "text-ink")}>{s.title}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </Panel>
  );
}

/** Today's pickups and drop-offs: who's next and who still needs a driver. */
export function TransfersTodayCard() {
  const { can } = useCan();
  const { has } = useEntitlements();
  const q = useTransfersToday();
  if (!can("transfers.view") || !has("paid_extras") || !q.data) return null;
  const d = q.data;
  if (!d.arrivals && !d.departures) return null;
  return (
    <Panel data-testid="transfers-today">
      <PanelHeader
        eyebrow="Pickups today"
        title={
          <>
            {d.arrivals} {d.arrivals === 1 ? "pickup" : "pickups"}, {d.departures} {d.departures === 1 ? "drop-off" : "drop-offs"}
          </>
        }
        actions={
          <ButtonLink href="/transfers" size="sm" variant="secondary">
            <Van size={14} /> Board
          </ButtonLink>
        }
      />
      {d.unassigned > 0 && (
        <Link href="/transfers" className="flex items-center gap-2 border-b border-line bg-ochre-wash/60 px-5 py-2 text-[12.5px] text-ink hover:bg-ochre-wash">
          <WarningCircle size={14} weight="fill" className="text-ochre" /> {d.unassigned} still {d.unassigned === 1 ? "needs" : "need"} a driver
        </Link>
      )}
      <ul className="divide-y divide-line">
        {d.next.slice(0, 4).map((t) => (
          <li key={t.id}>
            <Link href="/transfers" className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2/50">
              <span className="w-11 font-mono text-[13px] text-ink">{lagosHHMM(t.scheduledAt)}</span>
              <CatalogIcon name={kindMeta(t.pickupPoint.kind).icon} size={15} className="text-ink-muted" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] text-ink">{t.reservation.guestName}</span>
                <span className="block truncate text-[11.5px] text-ink-muted">
                  {t.pickupPoint.shortName ?? t.pickupPoint.name}
                  {t.driver ? ` · ${t.driver.name}` : ""}
                </span>
              </span>
              <span className={cn("text-[11.5px]", t.status === "REQUESTED" || t.status === "CONFIRMED" ? "text-ochre" : "text-ink-muted")}>{TRANSFER_STATUS[t.status].label}</span>
            </Link>
          </li>
        ))}
        {!d.next.length && <li className="px-5 py-4 text-[13px] text-ink-muted">Everyone&rsquo;s been met.</li>}
      </ul>
    </Panel>
  );
}
