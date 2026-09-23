import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { AsideQuote, AuthSplit } from "@/components/auth/auth-split";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthSplit aside={<AsideQuote />}>
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </AuthSplit>
  );
}
