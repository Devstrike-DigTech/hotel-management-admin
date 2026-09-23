import type { Metadata } from "next";
import { Suspense } from "react";
import { PlatformLogin } from "@/components/platform/platform-login";

export const metadata: Metadata = { title: "Platform console" };

export default function PlatformLoginPage() {
  return (
    <Suspense fallback={null}>
      <PlatformLogin />
    </Suspense>
  );
}
