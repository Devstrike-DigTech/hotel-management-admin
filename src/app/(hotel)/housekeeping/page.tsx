import type { Metadata } from "next";
import { HousekeepingRoute } from "@/components/gating/feature-routes";

export const metadata: Metadata = { title: "Housekeeping" };

export default function Page() {
  return <HousekeepingRoute />;
}
