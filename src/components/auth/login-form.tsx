"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Fingerprint, Info, WarningOctagon } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "@/lib/api/endpoints";
import { ssoApi } from "@/lib/api/endpoints-m6";
import { errorMessage, isApiError } from "@/lib/api/client";
import { session } from "@/lib/api/session";
import { storeAuth } from "@/lib/auth";
import { config } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { Field, Input, PasswordInput } from "@/components/ui/form";
import { Wordmark } from "@/components/brand";
import { SSO_ERRORS, ssoStartUrl } from "./staff-portal";

const isDev = process.env.NODE_ENV !== "production";

/** Where to go after signing in: a safe `next`, else the desk (housekeepers: their rooms). */
export function useAfterLogin() {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const next = params.get("next");
  return (role: string) => {
    qc.clear();
    const home = role === "HOUSEKEEPING" && !next ? "/hk" : "/today";
    router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : home);
  };
}

export function ErrorNote({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-wash px-3 py-2.5 text-[13px] text-danger">
      <WarningOctagon size={16} weight="duotone" className="mt-px shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/**
 * Email and password. A tenant that requires SSO answers 403 SSO_REQUIRED with
 * the URL to start it; we offer that instead of a dead end.
 */
export function PasswordForm({ submitLabel = "Sign in", devFill = true, accent }: { submitLabel?: string; devFill?: boolean; accent?: { bg: string; fg: string } | null }) {
  const params = useSearchParams();
  const after = useAfterLogin();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ssoStart, setSsoStart] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSsoStart(null);
    if (!email.trim() || !password) {
      setError("Enter your work email and password.");
      return;
    }
    setBusy(true);
    try {
      const res = await authApi.login(email.trim(), password);
      storeAuth(res);
      after(res.user.role);
    } catch (err) {
      if (isApiError(err) && err.code === "SSO_REQUIRED") {
        const start = (err.details as { startUrl?: string } | undefined)?.startUrl ?? null;
        setSsoStart(start);
        setError("Your hotel signs in with its company accounts. Use single sign-on.");
      } else {
        setError(isApiError(err) && err.status === 401 ? "That email and password don't match. Check for typos and try again." : errorMessage(err));
      }
      setBusy(false);
    }
  };

  return (
    <>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="Work email" htmlFor="email">
          <Input id="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourhotel.ng" aria-invalid={!!error} />
        </Field>
        <Field label="Password" htmlFor="password">
          <PasswordInput id="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!error} />
        </Field>
        {error && <ErrorNote>{error}</ErrorNote>}
        {ssoStart && (
          <a href={ssoStartUrl(ssoStart, params.get("next"))} className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-line-strong bg-surface text-[15px] font-medium text-ink hover:bg-surface-2" data-testid="sso-required-start">
            <Fingerprint size={17} /> Continue with single sign-on
          </a>
        )}
        <Button type="submit" size="lg" loading={busy} className="mt-2 w-full" style={accent ? { background: accent.bg, color: accent.fg } : undefined}>
          {submitLabel}
          <ArrowRight size={16} weight="bold" />
        </Button>
      </form>
      {isDev && devFill && (
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
    </>
  );
}

/** "Sign in with single sign-on" on our own host: the email's domain finds the hotel. */
function SsoByEmail({ onCancel }: { onCancel: () => void }) {
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        if (!/@.+\./.test(email)) {
          setError("Enter your work email.");
          return;
        }
        setBusy(true);
        try {
          const r = await ssoApi.discover(email.trim());
          if (r.sso && r.startUrl) {
            const u = new URL(ssoStartUrl(r.startUrl, params.get("next")));
            u.searchParams.set("login_hint", email.trim());
            window.location.href = u.toString();
            return;
          }
          setError("Your hotel doesn't use single sign-on. Sign in with your password.");
        } catch (err) {
          setError(errorMessage(err));
        }
        setBusy(false);
      }}
      noValidate
    >
      <Field label="Work email" htmlFor="sso-email" hint="We find your hotel's sign-in from the address.">
        <Input id="sso-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@yourhotel.com" data-testid="sso-email" autoFocus />
      </Field>
      {error && <ErrorNote>{error}</ErrorNote>}
      <Button type="submit" size="lg" loading={busy} className="w-full" data-testid="sso-continue">
        <Fingerprint size={17} /> Continue with single sign-on
      </Button>
      <button type="button" onClick={onCancel} className="text-[13px] text-ink-muted hover:text-ink">
        Use my password instead
      </button>
    </form>
  );
}

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const expired = params.get("expired") === "1";
  const ssoError = params.get("sso_error");
  const [sso, setSso] = useState(false);

  // Already signed in? Go straight to the desk.
  useEffect(() => {
    if (session.hotel()?.accessToken && !expired) router.replace(params.get("next") || "/today");
  }, [router, params, expired]);

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
          <p className="mt-3 text-[14.5px] leading-relaxed text-ink-muted">Sign in to see today&rsquo;s rooms, keys and takings.</p>

          {expired && !ssoError && (
            <div className="mt-6 flex items-start gap-2.5 rounded-md border border-line bg-surface px-3.5 py-3 text-[13px] text-ink-muted">
              <Info size={16} weight="duotone" className="mt-px shrink-0 text-adire" />
              Your session timed out. Sign in again to pick up where you left off.
            </div>
          )}
          {ssoError && (
            <div className="mt-6" data-testid="sso-error">
              <ErrorNote>{SSO_ERRORS[ssoError] ?? "Single sign-on didn't finish. Try again."}</ErrorNote>
            </div>
          )}

          <div className="mt-8">{sso ? <SsoByEmail onCancel={() => setSso(false)} /> : <PasswordForm />}</div>

          {!sso && (
            <div className="mt-5 flex items-center gap-3 text-[12.5px] text-ink-muted">
              <span className="h-px flex-1 bg-line" />
              <button type="button" onClick={() => setSso(true)} className="inline-flex items-center gap-1.5 font-medium text-ink hover:text-laterite" data-testid="use-sso">
                <Fingerprint size={15} /> Sign in with single sign-on
              </button>
              <span className="h-px flex-1 bg-line" />
            </div>
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
          Help:{" "}
          <a className="underline-offset-4 hover:text-ink hover:underline" href={`mailto:${config.supportEmail}`}>
            {config.supportEmail}
          </a>
        </span>
      </footer>
    </div>
  );
}
