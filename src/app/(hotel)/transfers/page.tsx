import type { Metadata } from "next";
import { TransfersRoute } from "@/components/m7/routes";

export const metadata: Metadata = { title: "Transfers" };

export default function Page() {
  return <TransfersRoute />;
}
