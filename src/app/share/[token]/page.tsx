import type { Metadata } from "next";
import { SharedDocument } from "@/components/documents/print-views";

export const metadata: Metadata = { title: "Your document", robots: { index: false, follow: false } };

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <SharedDocument token={token} />;
}
