import type { Metadata } from "next";
import { BookingSettingsView } from "@/components/settings/booking-settings";
import { RequireCap } from "@/components/gating/require-cap";

export const metadata: Metadata = { title: "Online booking" };

export default function BookingSettingsPage() {
  return (
    <RequireCap cap="booking.settings" what="Online booking settings">
      <BookingSettingsView />
    </RequireCap>
  );
}
