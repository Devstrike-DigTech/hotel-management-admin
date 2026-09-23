"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, WarningOctagon } from "@phosphor-icons/react";
import { platformApi } from "@/lib/api/endpoints";
import { errorMessage, isApiError } from "@/lib/api/client";
import { session } from "@/lib/api/session";
import { Button } from "@/components/ui/button";
import { Field, Input, PasswordInput } from "@/components/ui/form";
import { Wordmark } from "@/components/brand";
import { AuthSplit } from "@/components/auth/auth-split";

const isDev = process.env.NODE_ENV !== "production";

export function PlatformLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/platform";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (session.platform()?.accessToken) router.replace(next);
  }, [router, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Enter your Devstrike email and password.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await platformApi.login(email.trim(), password);
      session.setPlatform({ accessToken: res.accessToken, email: res.user?.email, fullName: res.user?.fullName });
      router.replace(next.startsWith("/platform") ? next : "/platform");
    } catch (err) {
      setError(isApiError(err) && err.status === 401 ? "Those credentials aren't valid for the console." : errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <AuthSplit
      tone="ink"
      home="/platform/login"
      aside={
        <div className="max-w-[32rem]">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#d6a94a]">Devstrike Digital &middot; Internal</p>
          <p className="display mt-5 text-[42px] leading-[1.06] text-[#f4ecdd]">
            Every hotel on the platform, <em className="serif-accent text-[#d6a94a]">in one ledger</em>.
          </p>
          <p className="mt-6 max-w-sm text-[14px] leading-relaxed text-[#ece3d2]/65">
            Revenue, trials, plans and entitlements. Changes here apply to live tenants immediately.
          </p>
        </div>
      }
    >
      <div className="flex flex-1 flex-col">
        <div className="lg:hidden">
          <Wordmark size="sm" />
        </div>
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[380px]">
            <p className="eyebrow mb-4 flex items-center gap-2 text-brass">
              <ShieldCheck size={14} weight="duotone" /> Platform console
            </p>
            <h1 className="display text-[40px] leading-[1.02] text-ink sm:text-[44px]">
              Staff <em>only</em>.
            </h1>
            <p className="mt-3 text-[14.5px] text-ink-muted">Sign in with your Devstrike account. Hotel staff accounts won&rsquo;t work here.</p>
            <form onSubmit={submit} className="mt-8 flex flex-col gap-4" noValidate>
              <Field label="Devstrike email" htmlFor="p-email">
                <Input id="p-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@devstrike.ng" />
              </Field>
              <Field label="Password" htmlFor="p-pass">
                <PasswordInput id="p-pass" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              {error && (
                <p role="alert" className="flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-wash px-3 py-2.5 text-[13px] text-danger">
                  <WarningOctagon size={16} weight="duotone" className="mt-px shrink-0" />
                  {error}
                </p>
              )}
              <Button type="submit" variant="ink" size="lg" loading={busy} className="mt-2 w-full">
                Enter the console <ArrowRight size={16} weight="bold" />
              </Button>
            </form>
            {isDev && (
              <button
                type="button"
                onClick={() => {
                  setEmail("admin@devstrike.ng");
                  setPassword("Admin1234!");
                }}
                className="mt-3 w-full rounded-md border border-dashed border-line-strong px-3 py-2 text-left text-[12.5px] text-ink-muted hover:border-ink-faint hover:text-ink"
              >
                <span className="eyebrow mr-2 text-[10px]">Dev</span>
                Fill <span className="font-mono">admin@devstrike.ng</span>
              </button>
            )}
          </div>
        </div>
        <Link href="/login" className="text-[12px] text-ink-faint hover:text-ink">
          Hotel staff sign-in
        </Link>
      </div>
    </AuthSplit>
  );
}
