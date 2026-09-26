import type { Metadata } from "next";
import { ConciergeRoute } from "@/components/concierge/routes";

export const metadata: Metadata = { title: "Concierge" };

export default function Page() {
  return <ConciergeRoute />;
}
