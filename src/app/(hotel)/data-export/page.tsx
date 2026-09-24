import type { Metadata } from "next";
import { ExportRoute } from "@/components/m6/routes";

export const metadata: Metadata = { title: "Data export" };

export default function Page() {
  return <ExportRoute />;
}
