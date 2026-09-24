import type { Metadata } from "next";
import { PickupsRoute } from "@/components/m7/routes";

export const metadata: Metadata = { title: "Pickup points" };

export default function Page() {
  return <PickupsRoute />;
}
