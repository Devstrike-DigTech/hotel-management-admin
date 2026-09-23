import type { Metadata } from "next";
import { TaxSettingsView } from "@/components/settings/tax-settings";

export const metadata: Metadata = { title: "Taxes & charges" };

export default function TaxesPage() {
  return <TaxSettingsView />;
}
