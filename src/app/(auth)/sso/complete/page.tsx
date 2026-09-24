import type { Metadata } from "next";
import { Suspense } from "react";
import { SsoComplete } from "@/components/auth/sso-complete";

export const metadata: Metadata = { title: "Signing in" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SsoComplete />
    </Suspense>
  );
}
