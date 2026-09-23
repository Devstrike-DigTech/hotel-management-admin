import type { Metadata } from "next";
import { DomainRoute } from "@/components/m5/routes";

export const metadata: Metadata = { title: "Custom domain" };

export default function Page() {
  return <DomainRoute />;
}
