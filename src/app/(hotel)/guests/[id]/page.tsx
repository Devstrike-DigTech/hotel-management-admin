import type { Metadata } from "next";
import { GuestProfile } from "@/components/guests/guest-profile";

export const metadata: Metadata = { title: "Guest" };

export default async function GuestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <GuestProfile id={id} />;
}
