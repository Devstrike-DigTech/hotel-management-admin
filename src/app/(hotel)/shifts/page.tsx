import type { Metadata } from "next";
import { ShiftsView } from "@/components/shifts/shifts-view";

export const metadata: Metadata = { title: "My shift" };

export default function ShiftsPage() {
  return <ShiftsView />;
}
