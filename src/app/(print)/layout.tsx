import { PrintShell } from "@/components/documents/print-shell";

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return <PrintShell>{children}</PrintShell>;
}
