import type { Metadata } from "next";
import { OverviewView } from "@/components/platform/overview-view";

export const metadata: Metadata = { title: "Console overview" };

export default function PlatformOverviewPage() {
  return <OverviewView />;
}
