"use client";

import { Broom, CashRegister, ChartLineUp, Crown, Plugs } from "@phosphor-icons/react";
import { FeaturePage } from "./feature-page";
import { RequireCap } from "./require-cap";
import { ChannelPreview, LoyaltyPreview, PosPreview, PricingPreview } from "./feature-previews";
import { HousekeepingBoardPreview } from "@/components/m4/previews";
import { HousekeepingView } from "@/components/housekeeping/housekeeping-view";

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
      preview={<HousekeepingBoardPreview />}
    >
      <RequireCap cap="housekeeping.view" what="The housekeeping board">
        <HousekeepingView />
      </RequireCap>
    </FeaturePage>
  );
}

