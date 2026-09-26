import type { Metadata } from "next";
import { VendorsRoute } from "@/components/concierge/routes";

export const metadata: Metadata = { title: "Concierge vendors" };

export default function Page() {
  return <VendorsRoute />;
}
