import type { Metadata } from "next";
import { MaintenanceRoute } from "@/components/m4/routes";

export const metadata: Metadata = { title: "Maintenance" };

export default function Page() {
  return <MaintenanceRoute />;
}
