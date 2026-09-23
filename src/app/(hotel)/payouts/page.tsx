import type { Metadata } from "next";
import { PayoutsView } from "@/components/payouts/payouts-view";
import { RequireCap } from "@/components/gating/require-cap";

export const metadata: Metadata = { title: "Payouts" };

export default function PayoutsPage() {
  return (
    <RequireCap cap="payouts.read" what="Payouts">
      <PayoutsView />
    </RequireCap>
  );
}
