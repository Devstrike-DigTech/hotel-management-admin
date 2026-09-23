import type { Metadata } from "next";
import { InvoicePrint } from "@/components/documents/print-views";

export const metadata: Metadata = { title: "Invoice" };

export default async function InvoicePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InvoicePrint id={id} />;
}
