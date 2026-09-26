import type { Metadata } from "next";
import { SettingsRoute } from "@/components/concierge/routes";

export const metadata: Metadata = { title: "Concierge settings" };

export default function Page() {
  return <SettingsRoute />;
}
