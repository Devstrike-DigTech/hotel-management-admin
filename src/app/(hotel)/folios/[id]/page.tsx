import type { Metadata } from "next";
import { FolioPage } from "@/components/folio/folios-view";

export const metadata: Metadata = { title: "Folio" };

export default async function FolioRoute({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <FolioPage id={id} />;
}
