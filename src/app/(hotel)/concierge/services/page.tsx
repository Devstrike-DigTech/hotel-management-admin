import type { Metadata } from "next";
import { ServicesRoute } from "@/components/concierge/routes";

export const metadata: Metadata = { title: "Concierge services" };

export default function Page() {
  return <ServicesRoute />;
}
