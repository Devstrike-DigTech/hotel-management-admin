import type { Metadata } from "next";
import { LoyaltyRoute } from "@/components/m5/routes";

export const metadata: Metadata = { title: "Loyalty" };

export default function Page() {
  return <LoyaltyRoute />;
}
