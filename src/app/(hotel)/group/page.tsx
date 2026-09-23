import type { Metadata } from "next";
import { GroupRoute } from "@/components/m5/routes";

export const metadata: Metadata = { title: "Group reports" };

export default function Page() {
  return <GroupRoute />;
}
