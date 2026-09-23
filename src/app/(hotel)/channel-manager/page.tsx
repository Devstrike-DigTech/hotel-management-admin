import type { Metadata } from "next";
import { ChannelRoute } from "@/components/gating/feature-routes";

export const metadata: Metadata = { title: "Channel manager" };

export default function Page() {
  return <ChannelRoute />;
}
