"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { Eye, WarningOctagon } from "@phosphor-icons/react";
import { impersonationApi } from "@/lib/api/endpoints-m6";
import { errorMessage, isApiError } from "@/lib/api/client";
import { session } from "@/lib/api/session";
import { AdireField } from "@/components/motifs/adire";

/**
 * The Devstrike console opens `/impersonate#code=...` in a new tab. The one-time
 * code becomes a staff token kept in this tab only (sessionStorage); the
 * user's own sign-in, in other tabs or later in this one, is untouched.
 */
export function ImpersonateHandoff() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const ended = params.get("ended") === "1";
  const [state, setState] = useState<{ kind: "working" } | { kind: "error"; message: string } | { kind: "ended" }>(() => (ended ? { kind: "ended" } : { kind: "working" }));
  const ran = useRef(false);

  useEffect(() => {
    if (!ended) return;
    if (session.impersonation()) session.setImpersonation(null);
    session.supportEnded(true);
  }, [ended]);

  useEffect(() => {
    if (ended || ran.current) return;
    ran.current = true;
    const code = new URLSearchParams(window.location.hash.slice(1)).get("code");
    // drop the code from the address bar and history straight away
    history.replaceState(null, "", "/impersonate");
    if (!code) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off handoff result
      setState({ kind: "error", message: "This link has no session code. Start the session again from the console." });
      return;
    }
    impersonationApi
      .exchange(code)
      .then((r) => {
        qc.clear();
        session.setImpersonation({ accessToken: r.accessToken, expiresAt: r.expiresAt, user: r.user, banner: r.impersonation });
        router.replace(r.user.role === "HOUSEKEEPING" ? "/hk" : "/today");
      })
      .catch((e) =>
        setState({
          kind: "error",
          message: isApiError(e) && (e.status === 401 || e.status === 404 || e.status === 410) ? "This link has expired or was already used. Links work once, for two minutes. Start the session again from the console." : errorMessage(e),
        }),
      );
  }, [ended, qc, router]);

  return (
    <main className="relative grid min-h-dvh place-items-center overflow-hidden bg-[#1f2d48] px-6 text-[#ece3d2] dark:bg-[#141d30]">
      <AdireField cols={10} rows={10} animated={false} className="absolute inset-0 h-full w-full text-[#ece3d2] opacity-[0.12]" />
      <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-[repeating-linear-gradient(135deg,#d6a94a_0_8px,transparent_8px_14px)]" />
      <div className="relative w-full max-w-md text-center" role="status" aria-live="polite">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-full border border-[#d6a94a]/50 text-[#d6a94a]">{state.kind === "error" ? <WarningOctagon size={22} weight="duotone" /> : <Eye size={22} weight="duotone" />}</span>
        <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.2em] text-[#d6a94a]">Devstrike support</p>
        {state.kind === "working" && (
          <>
            <h1 className="display mt-3 text-[30px] leading-tight">Opening the support session</h1>
            <p className="mt-3 text-[14px] text-[#ece3d2]/70">Every page you open and anything you change is recorded in the hotel&rsquo;s audit log.</p>
          </>
        )}
        {state.kind === "error" && (
          <>
            <h1 className="display mt-3 text-[30px] leading-tight">The session didn&rsquo;t open</h1>
            <p className="mt-3 text-[14px] text-[#ece3d2]/75" data-testid="impersonate-error">
              {state.message}
            </p>
          </>
        )}
        {state.kind === "ended" && (
          <>
            <h1 className="display mt-3 text-[30px] leading-tight" data-testid="impersonation-ended">
              Support session ended
            </h1>
            <p className="mt-3 text-[14px] text-[#ece3d2]/70">Access through this tab has stopped. You can close it.</p>
            <button type="button" onClick={() => window.close()} className="mt-6 inline-flex h-10 items-center rounded-md border border-[#ece3d2]/30 px-4 text-[14px] hover:bg-white/10">
              Close this tab
            </button>
          </>
        )}
      </div>
    </main>
  );
}
