import type { Metadata } from "next";
import { DevelopersRoute } from "@/components/m6/routes";

export const metadata: Metadata = { title: "Webhooks" };

export default function Page() {
  return <DevelopersRoute page="webhooks" />;
}
