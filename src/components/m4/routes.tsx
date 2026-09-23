"use client";

import { Briefcase, CalendarDots, Notebook, Tag, Ticket, Wrench } from "@phosphor-icons/react";
import { PlansView } from "@/components/rates/plans-view";
import { PromosView } from "@/components/promos/promos-view";
import { CorporateView } from "@/components/corporate/corporate-view";
import { CityLedgerView } from "@/components/ledger-city/city-ledger-view";
import { FeaturePage } from "@/components/gating/feature-page";
import { RequireCap } from "@/components/gating/require-cap";
import { RatesView } from "@/components/rates/rates-view";
import { MaintenanceView } from "@/components/maintenance/maintenance-view";
import { TicketDetail } from "@/components/maintenance/ticket-detail";
import { AlmanacPreview, CityLedgerPreview, MaintenancePreview } from "./previews";

export function RatesRoute() {
  return (
    <FeaturePage
      feature="promotions"
      icon={CalendarDots}
      name="Rate Almanac"
      title={
        <>
          Price every night <em>against the demand</em>.
        </>
      }
      pitch="Paint seasons across the calendar, fix a price for a single night, set minimum stays and see how full the house will be before you decide."
      bullets={[
        "Weekend, Detty December and Easter seasons in a few drags",
        "One price everywhere: desk, booking site and marketplace",
        "Minimum stays and closed-to-arrival nights",
        "Forecast occupancy on every date",
      ]}
      preview={<AlmanacPreview />}
    >
      <RequireCap cap="rates.view" what="The Rate Almanac">
        <RatesView />
      </RequireCap>
    </FeaturePage>
  );
}

export function MaintenanceRoute({ id }: { id?: string }) {
  return (
    <FeaturePage
      feature="maintenance"
      icon={Wrench}
      name="Maintenance"
      title={
        <>
          Fix it <em>before a guest finds it</em>.
        </>
      }
      pitch="Faults from the desk and housekeeping in one queue with a clock on each, rooms taken out of order properly, servicing that plans itself, and the diesel book."
      bullets={[
        "Tickets with an SLA by priority: 4 hours for urgent",
        "Block a room for dates; it stops selling everywhere",
        "AC and generator servicing that raises its own tickets",
        "Diesel deliveries, naira a day and price per litre",
      ]}
      preview={<MaintenancePreview />}
    >
      <RequireCap cap="maintenance.view" what="Maintenance">
        {id ? <TicketDetail id={id} /> : <MaintenanceView />}
      </RequireCap>
    </FeaturePage>
  );
}

const RATES_PITCH = {
  feature: "promotions",
  bullets: [
    "Seasons and fixed prices painted on the Rate Almanac",
    "Non-refundable, corporate and long-stay plans",
    "Promo codes with limits, counted when a booking is confirmed",
    "Company accounts with credit limits and a City Ledger",
  ],
};

export function PlansRoute() {
  return (
    <FeaturePage {...RATES_PITCH} icon={Notebook} name="Rate plans" title={<>One room, <em>several ways</em> to sell it.</>} pitch="Flexible, non-refundable, corporate and long-stay prices that follow your best rate automatically." preview={<AlmanacPreview />}>
      <RequireCap cap="rates.view" what="Rate plans">
        <PlansView />
      </RequireCap>
    </FeaturePage>
  );
}

export function PromosRoute() {
  return (
    <FeaturePage {...RATES_PITCH} icon={Ticket} name="Promo codes" title={<>A reason to book <em>this week</em>.</>} pitch="Codes for slow weeks, partners and first-time guests, with limits and a count of what each one brought in." preview={<AlmanacPreview />}>
      <RequireCap cap="rates.view" what="Promo codes">
        <PromosView />
      </RequireCap>
    </FeaturePage>
  );
}

export function CorporateRoute() {
  return (
    <FeaturePage {...RATES_PITCH} icon={Briefcase} name="Corporate accounts" title={<>The companies that <em>keep coming back</em>.</>} pitch="Negotiated rates, credit limits and payment terms, with stays charged to the company at check-out." preview={<CityLedgerPreview />}>
      <RequireCap cap="corporate.view" what="Corporate accounts">
        <CorporateView />
      </RequireCap>
    </FeaturePage>
  );
}

export function CityLedgerRoute() {
  return (
    <FeaturePage {...RATES_PITCH} icon={Tag} name="City Ledger" title={<>What the companies <em>owe the house</em>.</>} pitch="Statements, aging from 0-30 to 90+ days, payments against each statement and reminders by email." preview={<CityLedgerPreview />}>
      <RequireCap cap="corporate.view" what="The City Ledger">
        <CityLedgerView />
      </RequireCap>
    </FeaturePage>
  );
}
