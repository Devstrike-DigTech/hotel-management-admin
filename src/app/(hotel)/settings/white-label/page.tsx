import type { Metadata } from "next";
import { WhiteLabelRoute } from "@/components/m6/routes";

export const metadata: Metadata = { title: "White label" };

export default function Page() {
  return <WhiteLabelRoute />;
}
