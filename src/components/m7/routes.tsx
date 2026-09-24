"use client";

import { RequireCap } from "@/components/gating/require-cap";
import { useCan, type Permission } from "@/lib/permissions";
import { StudioView } from "@/components/studio/studio-view";
import { BuilderView } from "@/components/form-builder/builder-view";
import { ShoppingBag, Signpost, Van } from "@phosphor-icons/react";
import { FeaturePage } from "@/components/gating/feature-page";
import { ExtrasView } from "@/components/extras/extras-view";
import { PickupsView } from "@/components/pickups/pickups-view";
import { TransfersView } from "@/components/transfers/transfers-view";
import { ExtrasPreview, PickupsPreview, TransfersPreview } from "./previews";
import { SetupView } from "@/components/setup/setup-view";

/** Any of several permissions opens the page (the codes the API names, and the M4 fallback). */
export function RequireAny({ caps, what, children }: { caps: Permission[]; what: string; children: React.ReactNode }) {
  const { can, ready } = useCan();
  if (ready && caps.some((c) => can(c))) return <>{children}</>;
  return <RequireCap cap={caps[0]} what={what}>{children}</RequireCap>;
}

/** Workspace pages have no page padding of their own; give the refusal some air. */
function WorkspaceGate({ caps, what, children }: { caps: Permission[]; what: string; children: React.ReactNode }) {
  const { can, ready } = useCan();
  if (ready && caps.some((c) => can(c))) return <>{children}</>;
  return (
    <div className="px-4 py-6 sm:px-6 lg:px-10">
      <RequireCap cap={caps[0]} what={what}>
        {children}
      </RequireCap>
    </div>
  );
}

export const SITE_CAPS: Permission[] = ["site.manage"];
export const FORM_CAPS: Permission[] = ["forms.manage"];

export function StudioRoute() {
  return (
    <WorkspaceGate caps={SITE_CAPS} what="Brand Studio">
      <StudioView />
    </WorkspaceGate>
  );
}

export function BookingFormRoute() {
  return (
    <WorkspaceGate caps={FORM_CAPS} what="The booking form builder">
      <BuilderView />
    </WorkspaceGate>
  );
}

const EXTRAS_BULLETS = [
  "Breakfast, early check-in, late check-out and celebrations, priced per stay, night, guest or item",
  "Chosen while guests book, with a running total; added at the desk any time",
  "Posted to the folio as their own lines, with your taxes",
  "Daily limits and notice so the kitchen is never surprised",
];

export function ExtrasRoute() {
  return (
    <FeaturePage feature="paid_extras" icon={ShoppingBag} name="Extras" title={<>Everything <em>besides the room</em>.</>} pitch="Sell breakfast, late check-out, a cake on the bed and airport or motor-park pickups with every booking." bullets={EXTRAS_BULLETS} preview={<ExtrasPreview />}>
      <RequireAny caps={["extras.manage", "settings.manage"]} what="Extras">
        <ExtrasView />
      </RequireAny>
    </FeaturePage>
  );
}

export function PickupsRoute() {
  return (
    <FeaturePage
      feature="paid_extras"
      icon={Signpost}
      name="Pickup points"
      title={<>Meet them <em>where they land</em>.</>}
      pitch="Airports, motor parks, train stations and jetties where your driver meets guests, each with its own price, vehicles and hours."
      bullets={["Road travellers pick their bus company: GIGM, ABC, Peace Mass Transit and the rest", "Flight numbers, trains and ferries asked for by the kind of place", "Notice and working hours checked before the guest pays", "A price per vehicle, one way or both"]}
      preview={<PickupsPreview />}
    >
      <RequireAny caps={["extras.manage", "settings.manage"]} what="Pickup points">
        <PickupsView />
      </RequireAny>
    </FeaturePage>
  );
}

export function TransfersRoute() {
  return (
    <FeaturePage
      feature="paid_extras"
      icon={Van}
      name="Transfers"
      title={<>Who&rsquo;s being met, <em>where and when</em>.</>}
      pitch="Every pickup and drop-off by time, with the driver, the plate and the guest told automatically."
      bullets={["Assign a driver and the guest gets the name, phone and plate", "Big buttons for the driver or porter on a phone", "Delay notes such as \u201cbus delayed at Ore\u201d", "On Today, so nobody is left waiting at the park"]}
      preview={<TransfersPreview />}
    >
      <RequireAny caps={["transfers.view", "transfers.manage"]} what="Transfers">
        <TransfersView />
      </RequireAny>
    </FeaturePage>
  );
}

export function SetupRoute() {
  return (
    <RequireCap cap="settings.manage" what="Setup">
      <SetupView />
    </RequireCap>
  );
}
