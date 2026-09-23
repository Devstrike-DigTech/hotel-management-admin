import type { Metadata, Viewport } from "next";
import { HkRoute } from "@/components/hk/hk-route";

export const metadata: Metadata = { title: "My rooms" };
export const viewport: Viewport = { themeColor: [{ media: "(prefers-color-scheme: dark)", color: "#13110E" }, { color: "#F4EFE6" }] };

export default function Page() {
  return <HkRoute />;
}
