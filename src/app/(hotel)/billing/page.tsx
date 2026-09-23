import type { Metadata } from "next";
import { BillingView } from "@/components/billing/billing-view";
import { RequireCap } from "@/components/gating/require-cap";

export const metadata: Metadata = { title: "Billing & plan" };

export default function Page() {
  return (
    <RequireCap cap="billing.manage" what="Billing">
      <BillingView />
    </RequireCap>
  );
}
