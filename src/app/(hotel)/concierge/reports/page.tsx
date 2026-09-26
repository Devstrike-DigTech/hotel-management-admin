import type { Metadata } from "next";
import { ReportsRoute } from "@/components/concierge/routes";

export const metadata: Metadata = { title: "Concierge reports" };

export default function Page() {
  return <ReportsRoute />;
}
