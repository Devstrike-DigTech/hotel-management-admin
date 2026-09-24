import type { Metadata } from "next";
import { SsoRoute } from "@/components/m6/routes";

export const metadata: Metadata = { title: "Single sign-on" };

export default function Page() {
  return <SsoRoute />;
}
