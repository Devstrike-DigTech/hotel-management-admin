import type { Metadata } from "next";
import { BookingFormRoute } from "@/components/m7/routes";

export const metadata: Metadata = { title: "Booking form" };

export default function Page() {
  return <BookingFormRoute />;
}
