import type { Metadata } from "next";
import { PlansRoute } from "@/components/m4/routes";

export const metadata: Metadata = { title: "Rate plans" };

export default function Page() {
  return <PlansRoute />;
}
