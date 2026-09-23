import type { Metadata } from "next";
import { PropertyView } from "@/components/property/property-view";

export const metadata: Metadata = { title: "Property" };

export default function PropertyPage() {
  return <PropertyView />;
}
