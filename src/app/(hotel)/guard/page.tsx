import type { Metadata } from "next";
import { GuardView } from "@/components/guard/guard-view";

export const metadata: Metadata = { title: "Revenue Guard" };

export default function GuardPage() {
  return <GuardView />;
}
