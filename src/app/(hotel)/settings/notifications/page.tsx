import type { Metadata } from "next";
import { RequireCap } from "@/components/gating/require-cap";
import { NotificationSettingsView } from "@/components/settings/notification-settings";

export const metadata: Metadata = { title: "Alerts and WhatsApp" };

export default function Page() {
  return (
    <RequireCap cap="settings.manage" what="Alert settings">
      <NotificationSettingsView />
    </RequireCap>
  );
}
