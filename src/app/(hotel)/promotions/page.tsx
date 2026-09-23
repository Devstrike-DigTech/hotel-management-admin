import type { Metadata } from "next";
import { PromosRoute } from "@/components/m4/routes";

export const metadata: Metadata = { title: "Promo codes" };

export default function Page() {
  return <PromosRoute />;
}
