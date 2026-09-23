import type { Metadata } from "next";
import { StockRoute } from "@/components/pos/routes";

export const metadata: Metadata = { title: "Stock & minibar" };

export default function Page() {
  return <StockRoute />;
}
