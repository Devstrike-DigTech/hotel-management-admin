"use client";

import { ChartLineUp, ChatCircleText, Crown, Plugs } from "@phosphor-icons/react";
import { FeaturePage } from "@/components/gating/feature-page";
import { RequireCap } from "@/components/gating/require-cap";
import { InboxView } from "@/components/inbox/inbox-view";
import { LoyaltyView } from "@/components/loyalty/loyalty-view";
import { MemberView } from "@/components/loyalty/member-view";
import { ChannelsView } from "@/components/channels/channels-view";
import { PricingView } from "@/components/pricing/pricing-view";
import { ChannelPreview, InboxPreview, LoyaltyPreview, PricingPreview } from "./previews";

export function InboxRoute() {
  return (
    <FeaturePage
      feature="whatsapp_messaging"
      icon={ChatCircleText}
      name="Guest inbox"
      title={
        <>
          Every guest, <em>one thread</em>.
        </>
      }
      pitch="Guests message the hotel on WhatsApp; the desk answers from one inbox with the stay beside the thread, and requests like towels or a broken AC become tasks in a tap."
      bullets={[
        "Messages matched to the guest and their reservation",
        "Quick replies for Wi-Fi, directions and check-out",
        "Towels, AC and water complaints turned into tasks",
        "Pre-arrival: guests confirm their arrival time",
      ]}
      preview={<InboxPreview />}
    >
      <RequireCap cap="inbox.view" what="The guest inbox">
        <InboxView />
      </RequireCap>
    </FeaturePage>
  );
}

export function LoyaltyRoute({ memberId }: { memberId?: string }) {
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
      pitch="One programme across every hotel in the group: points on rooms and outlet spend, tiers by nights, and points redeemed on the bill at the desk or when booking online."
      bullets={[
        "Points earned at check-out, taxes left out",
        "Tiers with perks the desk sees at check-in",
        "Redeem on the folio with a code to the guest's phone",
        "Adjustments with a reason, large ones flagged",
      ]}
      preview={<LoyaltyPreview />}
    >
      <RequireCap cap="loyalty.view" what="Loyalty">
        {memberId ? <MemberView id={memberId} /> : <LoyaltyView />}
      </RequireCap>
    </FeaturePage>
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
          One house, <em>every shop window</em>.
        </>
      }
      pitch="Availability and prices out to Booking.com, Expedia and Airbnb as they change, their bookings back onto the Ledger, and what each channel costs next to your own booking site."
      bullets={[
        "iCal for Airbnb today; Channex for Booking.com and Expedia with prices",
        "Room types mapped once, pushes within 30 seconds",
        "Overbooking caught and flagged with a place to move the guest",
        "OTA commission this month against direct bookings",
      ]}
      preview={<ChannelPreview />}
    >
      <RequireCap cap="channels.view" what="The channel manager">
        <ChannelsView />
      </RequireCap>
    </FeaturePage>
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
      pitch="A suggested price for every room type and night, from how full the house is, the booking pace, the day, the events in town and the neighbours' prices, always inside limits you set."
      bullets={[
        "Ghost prices on the Rate Almanac with the reason in plain words",
        "Detty December, Independence Day and Eid already on the calendar",
        "Floors, ceilings and a daily step it never exceeds",
        "Autopilot at 03:00, and an honest estimate of what it earned",
      ]}
      preview={<PricingPreview />}
    >
      <RequireCap cap="pricing.view" what="Dynamic pricing">
        <PricingView />
      </RequireCap>
    </FeaturePage>
  );
}
