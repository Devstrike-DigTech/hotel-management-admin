import type { Metadata } from "next";
import { LedgerView } from "@/components/ledger/ledger-view";

export const metadata: Metadata = { title: "The Ledger" };

export default function LedgerPage() {
  return <LedgerView />;
}
