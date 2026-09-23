import type { Metadata } from "next";
import { StaffView } from "@/components/staff/staff-view";
import { RequireCap } from "@/components/gating/require-cap";

export const metadata: Metadata = { title: "Staff" };

export default function Page() {
  return (
    <RequireCap cap="staff.manage" what="Staff">
      <StaffView />
    </RequireCap>
  );
}
