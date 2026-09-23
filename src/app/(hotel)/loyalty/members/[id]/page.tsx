import type { Metadata } from "next";
import { LoyaltyRoute } from "@/components/m5/routes";

export const metadata: Metadata = { title: "Loyalty member" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <LoyaltyRoute memberId={id} />;
}
