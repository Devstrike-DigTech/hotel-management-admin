import type { Metadata } from "next";
import { MaintenanceRoute } from "@/components/m4/routes";

export const metadata: Metadata = { title: "Maintenance ticket" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MaintenanceRoute id={id} />;
}
