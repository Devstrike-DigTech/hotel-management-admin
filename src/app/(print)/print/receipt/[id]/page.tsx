import type { Metadata } from "next";
import { ReceiptPrint } from "@/components/documents/print-views";

export const metadata: Metadata = { title: "Receipt" };

export default async function ReceiptPrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <ReceiptPrint id={id} />;
}
