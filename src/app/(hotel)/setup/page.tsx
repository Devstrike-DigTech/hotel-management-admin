import type { Metadata } from "next";
import { SetupRoute } from "@/components/m7/routes";

export const metadata: Metadata = { title: "Setup" };

export default function Page() {
  return <SetupRoute />;
}
