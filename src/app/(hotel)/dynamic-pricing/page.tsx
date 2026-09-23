import type { Metadata } from "next";
import { PricingRoute } from "@/components/m5/routes";

export const metadata: Metadata = { title: "Dynamic pricing" };

export default function Page() {
  return <PricingRoute />;
}
