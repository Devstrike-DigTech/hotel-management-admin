import type { Metadata } from "next";
import { RequireCap } from "@/components/gating/require-cap";
import { RolesView } from "@/components/roles/roles-view";

export const metadata: Metadata = { title: "Roles and permissions" };

export default function Page() {
  return (
    <RequireCap cap="staff.manage" what="Roles and permissions">
      <RolesView />
    </RequireCap>
  );
}
