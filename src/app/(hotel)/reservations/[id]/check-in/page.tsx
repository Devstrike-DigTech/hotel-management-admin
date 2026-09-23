import type { Metadata } from "next";
import { CheckInView } from "@/components/checkin/check-in-view";

export const metadata: Metadata = { title: "Check in" };

export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CheckInView id={id} />;
}
