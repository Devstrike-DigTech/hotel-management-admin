import type { Metadata } from "next";
import { RoomTypesView } from "@/components/rooms/room-types-view";

export const metadata: Metadata = { title: "Room types" };

export default function RoomTypesPage() {
  return <RoomTypesView />;
}
