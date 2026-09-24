import type { Metadata } from "next";
import { SupportRoute } from "@/components/m6/routes";

export const metadata: Metadata = { title: "Support" };

export default function Page() {
  return <SupportRoute />;
}
