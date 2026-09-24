import type { Metadata } from "next";
import { StudioRoute } from "@/components/m7/routes";

export const metadata: Metadata = { title: "Brand Studio" };

export default function Page() {
  return <StudioRoute />;
}
