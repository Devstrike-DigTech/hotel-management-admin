import type { Metadata } from "next";
import { LoyaltyRoute } from "@/components/gating/feature-routes";

export const metadata: Metadata = { title: "Loyalty" };

export default function Page() {
  return <LoyaltyRoute />;
}
