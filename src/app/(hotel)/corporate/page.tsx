import type { Metadata } from "next";
import { CorporateRoute } from "@/components/m4/routes";

export const metadata: Metadata = { title: "Corporate accounts" };

export default function Page() {
  return <CorporateRoute />;
}
