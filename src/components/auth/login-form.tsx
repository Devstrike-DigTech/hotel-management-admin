"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Info, WarningOctagon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api/endpoints";
import { errorMessage, isApiError } from "@/lib/api/client";
import { session } from "@/lib/api/session";
import { storeAuth } from "@/lib/auth";
import { config } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Field, Input, PasswordInput } from "@/components/ui/form";
import { Wordmark } from "@/components/brand";

const isDev = process.env.NODE_ENV !== "production";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const next = params.get("next") || "/today";
  const expired = params.get("expired") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in? Go straight to the desk.
  useEffect(() => {
    if (session.hotel()?.accessToken && !expired) router.replace(next);
  }, [router, next, expired]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your work email and password.");
      return;
    }
    setBusy(true);
    try {
      const res = await authApi.login(email.trim(), password);
      qc.clear();
      storeAuth(res);
      // housekeepers land on their rooms, not the desk
      const home = res.user.role === "HOUSEKEEPING" && !params.get("next") ? "/hk" : "/today";
      router.replace(next.startsWith("/") && !next.startsWith("//") && params.get("next") ? next : home);
    } catch (err) {
      setError(
        isApiError(err) && err.status === 401
          ? "That email and password don't match. Check for typos and try again."
          : errorMessage(err),
      );
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="lg:hidden">
        <Wordmark />
      </div>
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-[380px]">
          <p className="eyebrow mb-4">Staff sign in</p>
          <h1 className="display text-[40px] leading-[1.02] text-ink sm:text-[46px]">
            Back to the <em>front desk</em>.
          </h1>
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-muted">
            Sign in to see today&rsquo;s rooms, keys and takings.
          </p>

          {expired && !error && (
            <div className="mt-6 flex items-start gap-2.5 rounded-md border border-line bg-surface px-3.5 py-3 text-[13px] text-ink-muted">
              <Info size={16} weight="duotone" className="mt-px shrink-0 text-adire" />
              Your session timed out. Sign in again to pick up where you left off.
            </div>
          )}

          <form onSubmit={submit} className="mt-8 flex flex-col gap-4" noValidate>
            <Field label="Work email" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourhotel.ng"
                aria-invalid={!!error}
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <PasswordInput
                id="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error}
              />
            </Field>

            {error && (
              <p
                role="alert"
                className="flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-wash px-3 py-2.5 text-[13px] text-danger"
              >
                <WarningOctagon size={16} weight="duotone" className="mt-px shrink-0" />
                {error}
              </p>
            )}

            <Button type="submit" size="lg" loading={busy} className="mt-2 w-full">
              Sign in
              <ArrowRight size={16} weight="bold" />
            </Button>
          </form>

          {isDev && (
            <button
              type="button"
              onClick={() => {
                setEmail("demo@palmwine.ng");
                setPassword("Demo1234!");
              }}
              className="mt-3 w-full rounded-md border border-dashed border-line-strong px-3 py-2 text-left text-[12.5px] text-ink-muted transition-colors hover:border-ink-faint hover:text-ink"
            >
              <span className="eyebrow mr-2 text-[10px]">Dev</span>
              Fill the demo account <span className="font-mono">demo@palmwine.ng</span>
            </button>
          )}

          <div className="mt-10 border-t border-line pt-6">
            <p className="text-[14px] text-ink">
              New to {config.appName}?{" "}
              <Link href="/signup" className="font-medium text-laterite underline-offset-4 hover:underline">
                Start a 14-day Growth trial
              </Link>
            </p>
            <p className="mt-1.5 text-[12.5px] text-ink-muted">No card needed. Set up takes about four minutes.</p>
          </div>
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 text-[12px] text-ink-faint">
        <span>
          Help: <a className="underline-offset-4 hover:text-ink hover:underline" href={`mailto:${config.supportEmail}`}>{config.supportEmail}</a>
        </span>
        <Link href="/platform/login" className="underline-offset-4 hover:text-ink hover:underline">
          Platform console
        </Link>
      </footer>
    </div>
  );
}
