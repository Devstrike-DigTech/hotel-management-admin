import type { Metadata } from "next";
import { StatementPrint } from "@/components/ledger-city/statement";

export const metadata: Metadata = { title: "Statement" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <StatementPrint id={id} />;
}
