import type { Metadata } from "next";
import { Suspense } from "react";
import { ImpersonateHandoff } from "@/components/support/impersonate-handoff";

export const metadata: Metadata = { title: "Support session", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <ImpersonateHandoff />
    </Suspense>
  );
}
