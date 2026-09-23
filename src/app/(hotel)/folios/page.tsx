import type { Metadata } from "next";
import { FoliosView } from "@/components/folio/folios-view";

export const metadata: Metadata = { title: "Folios & invoices" };

export default function FoliosPage() {
  return <FoliosView />;
}
