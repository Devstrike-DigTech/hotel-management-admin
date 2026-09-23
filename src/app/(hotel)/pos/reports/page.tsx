import type { Metadata } from "next";
import { PosReportsRoute } from "@/components/pos/routes";

export const metadata: Metadata = { title: "Outlet sales" };

export default function Page() {
  return <PosReportsRoute />;
}
