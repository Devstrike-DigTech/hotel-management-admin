import type { Metadata } from "next";
import { SupportRoute } from "@/components/m6/routes";

export const metadata: Metadata = { title: "Support request" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SupportRoute id={id} />;
}
