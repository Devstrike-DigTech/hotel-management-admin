import type { Metadata } from "next";
import { AuditView } from "@/components/audit/audit-view";
import { RequireCap } from "@/components/gating/require-cap";

export const metadata: Metadata = { title: "Audit log" };

export default function Page() {
  return (
    <RequireCap cap="audit.view" what="The audit log">
      <AuditView />
    </RequireCap>
  );
}
