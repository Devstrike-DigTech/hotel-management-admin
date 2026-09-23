import type { Metadata } from "next";
import { StaffView } from "@/components/staff/staff-view";

export const metadata: Metadata = { title: "Staff" };

export default function StaffPage() {
  return <StaffView />;
}
