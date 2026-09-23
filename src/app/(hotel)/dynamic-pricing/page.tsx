import type { Metadata } from "next";
import { PricingRoute } from "@/components/gating/feature-routes";

export const metadata: Metadata = { title: "Dynamic pricing" };

export default function Page() {
  return <PricingRoute />;
}
