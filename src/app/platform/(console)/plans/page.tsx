import type { Metadata } from "next";
import { PlansEditor } from "@/components/platform/plans-editor";

export const metadata: Metadata = { title: "Plans" };

export default function PlansPage() {
  return <PlansEditor />;
}
