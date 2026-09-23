import type { Metadata } from "next";
import { CityLedgerRoute } from "@/components/m4/routes";

export const metadata: Metadata = { title: "City Ledger" };

export default function Page() {
  return <CityLedgerRoute />;
}
