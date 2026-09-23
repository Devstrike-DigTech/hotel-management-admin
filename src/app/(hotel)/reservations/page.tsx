import type { Metadata } from "next";
import { ReservationsList } from "@/components/reservations/reservations-list";

export const metadata: Metadata = { title: "Reservations" };

export default function ReservationsPage() {
  return <ReservationsList />;
}
