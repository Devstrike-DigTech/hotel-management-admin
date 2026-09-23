import type { Metadata } from "next";
import { RatesRoute } from "@/components/m4/routes";

export const metadata: Metadata = { title: "Rate Almanac" };

export default function Page() {
  return <RatesRoute />;
}
