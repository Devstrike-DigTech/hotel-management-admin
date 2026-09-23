import type { Metadata } from "next";
import { ChannelRoute } from "@/components/m5/routes";

export const metadata: Metadata = { title: "Channel manager" };

export default function Page() {
  return <ChannelRoute />;
}
