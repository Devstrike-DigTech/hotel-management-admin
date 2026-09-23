import type { Metadata } from "next";
import { MenuRoute } from "@/components/pos/routes";

export const metadata: Metadata = { title: "Menu & outlets" };

export default function Page() {
  return <MenuRoute />;
}
