import type { Metadata } from "next";
import { KdsRoute } from "@/components/pos/routes";

export const metadata: Metadata = { title: "Kitchen display" };

export default function Page() {
  return <KdsRoute />;
}
