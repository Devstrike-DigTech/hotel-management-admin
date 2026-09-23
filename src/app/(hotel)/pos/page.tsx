import type { Metadata } from "next";
import { PosRoute } from "@/components/gating/feature-routes";

export const metadata: Metadata = { title: "Point of sale" };

export default function Page() {
  return <PosRoute />;
}
