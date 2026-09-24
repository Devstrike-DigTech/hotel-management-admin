import type { Metadata } from "next";
import { ExtrasRoute } from "@/components/m7/routes";

export const metadata: Metadata = { title: "Extras" };

export default function Page() {
  return <ExtrasRoute />;
}
