"use client";

import { useState } from "react";
import { Broom, CashRegister, ChartLineUp, Crown, Plugs } from "@phosphor-icons/react";
import { useRooms } from "@/lib/api/hooks";
import type { Room, RoomStatus } from "@/lib/api/types";
import { useEntitlements } from "@/lib/auth";
import { ROOM_STATUS } from "@/lib/catalog";
import { relativeTime } from "@/lib/format";
import { ErrorState, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { RoomSheet } from "@/components/keyrack/room-sheet";
import { StatusSwatch } from "@/components/keyrack/status-swatch";
import { FeaturePage } from "./feature-page";
import { HousekeepingTasks } from "@/components/housekeeping/tasks";
import { ChannelPreview, HousekeepingPreview, LoyaltyPreview, PosPreview, PricingPreview } from "./feature-previews";

export function PosRoute() {
  return (
    <FeaturePage
      feature="pos"
      icon={CashRegister}
      name="Point of sale"
      title={
        <>
          Every chapman, <em>on the right folio</em>.
        </>
      }
      pitch="Ring up the bar, kitchen and laundry, then post the bill straight to the guest's room. Nothing gets lost between the pool bar and checkout."
      bullets={[
        "Charges post to the room folio in one tap",
        "Separate tills for bar, kitchen, laundry and spa",
        "End-of-shift cash-up with variance alerts",
        "Stock counts that match what was sold",
      ]}
      preview={<PosPreview />}
    />
  );
}

export function ChannelRoute() {
  return (
    <FeaturePage
      feature="channel_manager"
      icon={Plugs}
      name="Channel manager"
      title={
        <>
          One rate change, <em>everywhere at once</em>.
        </>
      }
      pitch="Keep availability and prices in step across your booking page, the marketplace and the online travel agents, so you never sell the same room twice."
      bullets={[
        "Two-way sync of rates and availability",
        "Stop-sell a room type on every channel instantly",
        "Channel-specific markups to cover commission",
        "Bookings from every channel land on the key rack",
      ]}
      preview={<ChannelPreview />}
    />
  );
}

export function PricingRoute() {
  return (
    <FeaturePage
      feature="dynamic_pricing"
      icon={ChartLineUp}
      name="Dynamic pricing"
      title={
        <>
          Rates that <em>read the room</em>.
        </>
      }
      pitch="Suggested nightly rates that rise for weekends, festivals and conferences nearby, and ease off midweek, within limits you set."
      bullets={[
        "Floor and ceiling prices per room type",
        "Event and weekend uplift, set once",
        "Approve suggestions or let them apply automatically",
        "See what each change earned last month",
      ]}
      preview={<PricingPreview />}
    />
  );
}

export function LoyaltyRoute() {
  return (
    <FeaturePage
      feature="loyalty"
      icon={Crown}
      name="Loyalty"
      title={
        <>
          Regulars feel <em>remembered</em>.
        </>
      }
      pitch="Reward the guests who keep coming back with nights, perks and a front desk that greets them by name."
      bullets={[
        "Points or stamp cards, your choice",
        "Tiers with automatic perks at check-in",
        "Birthday and anniversary offers by SMS or WhatsApp",
        "Know your top guests by revenue, not guesswork",
      ]}
      preview={<LoyaltyPreview />}
    />
  );
}

export function HousekeepingRoute() {
  return (
    <FeaturePage
      feature="housekeeping"
      icon={Broom}
      name="Housekeeping"
      title={
        <>
          Turn rooms around <em>before the next arrival</em>.
        </>
      }
      pitch="Assign rooms to attendants, track progress floor by floor and inspect before a key goes back on sale."
      bullets={[
        "Dirty rooms queue themselves at checkout",
        "Assign by floor or attendant, from any phone",
        "Inspection step before a room is sellable",
        "Lost-and-found and maintenance notes in one place",
      ]}
      preview={<HousekeepingPreview />}
    >
      <HousekeepingWorkspace />
    </FeaturePage>
  );
}

const COLUMNS: { status: RoomStatus; title: string; body: string }[] = [
  { status: "VACANT_DIRTY", title: "To clean", body: "Vacant rooms waiting on a turnaround." },
  { status: "OUT_OF_ORDER", title: "Blocked", body: "Out of order until maintenance clears them." },
  { status: "VACANT_CLEAN", title: "Ready", body: "Clean and back on sale." },
];

function HousekeepingWorkspace() {
  const { has } = useEntitlements();
  const rooms = useRooms();
  const [selected, setSelected] = useState<Room | null>(null);
  const selectedLive = selected ? (rooms.data?.find((r) => r.id === selected.id) ?? selected) : null;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Broom size={14} weight="duotone" /> Housekeeping
          </>
        }
        title={
          <>
            Turn rooms around <em>before the next arrival</em>.
          </>
        }
        description="Rooms flow from dirty to ready as your team works. Tap a room to change its status."
      />
      {rooms.isError ? (
        <Panel>
          <ErrorState error={rooms.error} onRetry={() => rooms.refetch()} />
        </Panel>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((c) => {
            const list = (rooms.data ?? [])
              .filter((r) => r.status === c.status)
              .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
            return (
              <Panel key={c.status} className="flex flex-col">
                <PanelHeader
                  title={
                    <span className="flex items-center gap-2">
                      <StatusSwatch status={c.status} size={18} /> {c.title}
                      <span className="font-mono text-[14px] text-ink-muted">{rooms.isLoading ? "" : list.length}</span>
                    </span>
                  }
                  description={c.body}
                />
                <div className="flex flex-1 flex-col gap-1.5 p-3">
                  {rooms.isLoading ? (
                    Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-12" />)
                  ) : list.length === 0 ? (
                    <p className="px-2 py-6 text-center text-[13px] text-ink-faint">Nothing here.</p>
                  ) : (
                    list.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setSelected(r)}
                        className="flex items-center gap-3 rounded-md border border-line bg-surface px-3 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-surface-2/50"
                        style={{ boxShadow: `inset 3px 0 0 ${ROOM_STATUS[r.status].color}` }}
                      >
                        <span className="font-mono text-[15px] text-ink">{r.number}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12.5px] text-ink-muted">{r.roomType?.name}</span>
                          <span className="block truncate text-[11.5px] text-ink-faint">{r.notes || `since ${relativeTime(r.updatedAt)}`}</span>
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </Panel>
            );
          })}
        </div>
      )}
      <HousekeepingTasks enabled={has("housekeeping")} />
      <RoomSheet room={selectedLive} onOpenChange={(o) => !o && setSelected(null)} />
    </>
  );
}
