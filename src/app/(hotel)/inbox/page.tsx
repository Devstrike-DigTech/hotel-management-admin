import type { Metadata } from "next";
import { InboxRoute } from "@/components/m5/routes";

export const metadata: Metadata = { title: "Guest inbox" };

export default function Page() {
  return <InboxRoute />;
}
