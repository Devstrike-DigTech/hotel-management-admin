import type { Metadata } from "next";
import { DevelopersRoute } from "@/components/m6/routes";

export const metadata: Metadata = { title: "API keys" };

export default function Page() {
  return <DevelopersRoute page="keys" />;
}
