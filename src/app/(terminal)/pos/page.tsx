import type { Metadata } from "next";
import { PosTerminalRoute } from "@/components/pos/routes";

export const metadata: Metadata = { title: "Point of sale" };

export default function Page() {
  return <PosTerminalRoute />;
}
