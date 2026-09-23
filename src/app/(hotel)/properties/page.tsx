import type { Metadata } from "next";
import { PropertiesRoute } from "@/components/m5/routes";

export const metadata: Metadata = { title: "Properties" };

export default function Page() {
  return <PropertiesRoute />;
}
