"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ssoApi } from "@/lib/api/endpoints-m6";
import { errorMessage } from "@/lib/api/client";
import { storeAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui/button";
import { ErrorNote } from "./login-form";
import { takeSsoNext } from "./staff-portal";

/** The API sends people here with a one-time code after the identity provider (`/sso/complete#code=`). */
export function SsoComplete() {
  const router = useRouter();
  const qc = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const ran = useRef(false);
  useEffect(() => {
    if (ran.current) return;
    ran.current = true;
    const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    history.replaceState(null, "", "/sso/complete");
    if (!code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off result of the redirect
      setError("The sign-in link is incomplete. Start again from the sign-in page.");
      return;
    }
    ssoApi
      .exchange(code)
      .then((res) => {
        qc.clear();
        storeAuth(res);
        const next = takeSsoNext();
        router.replace(next ?? (res.user.role === "HOUSEKEEPING" ? "/hk" : "/today"));
      })
      .catch((e) => setError(errorMessage(e)));
  }, [qc, router]);
  return (
    <main className="grid min-h-dvh place-items-center bg-paper px-6">
      <div className="w-full max-w-sm text-center" role="status" aria-live="polite">
        {error ? (
          <>
            <ErrorNote>{error}</ErrorNote>
            <Link href="/login" className="mt-5 inline-block text-[14px] font-medium text-laterite hover:underline">
              Back to sign in
            </Link>
          </>
        ) : (
          <p className="inline-flex items-center gap-2.5 text-[14px] text-ink-muted">
            <Spinner size={16} /> Signing you in
          </p>
        )}
      </div>
    </main>
  );
}
