"use client";

import { Broom, CashRegister } from "@phosphor-icons/react";
import { FeaturePage } from "./feature-page";
import { RequireCap } from "./require-cap";
import { PosTerminalPreview } from "@/components/m5/previews";
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
      pitch="A till for the restaurant, the bar and room service that sends orders to a kitchen screen, settles in the cashier's shift and posts room charges straight to the guest's folio."
      bullets={[
        "Big tiles, modifiers and split bills, fast on a tablet",
        "A kitchen display with timers, and orders that keep coming when the line drops",
        "Charge to the room in one step, with the guest's name checked",
        "Stock that counts itself down, and voids Revenue Guard sees",
      ]}
      preview={<PosTerminalPreview />}
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

