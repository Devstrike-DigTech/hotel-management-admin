"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Info, Key } from "@phosphor-icons/react";
import type { StaffPortalPublic } from "@/lib/api/types-m6";
import { session } from "@/lib/api/session";
import { inkOn, loadGoogleFont } from "@/lib/m6-catalog";
import { TenantMark } from "@/components/tenant-mark";
import { ProviderMark } from "@/components/sso/sso-view";
import { ErrorNote, PasswordForm } from "./login-form";
import { SSO_ERRORS, providerLabel, ssoStartUrl } from "./staff-portal";

/**
 * The staff sign-in at a hotel's own host (e.g. staff.harmattanhotels.com):
 * their colours, type, logo and name, and no platform name anywhere.
 */
export function BrandedLogin({ portal: p }: { portal: StaffPortalPublic }) {
  const router = useRouter();
  const params = useSearchParams();
  const expired = params.get("expired") === "1";
  const ssoError = params.get("sso_error");
  const [breakGlass, setBreakGlass] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);
  const primary = p.primaryColor ?? "#1F2D48";
  const accent = p.accentColor ?? primary;
  const onPrimary = inkOn(primary);
  const heading = p.headingFont?.family ?? null;
  const body = p.bodyFont?.family ?? null;
  const ssoOn = p.sso.enabled && !!p.sso.startUrl;
  const enforced = ssoOn && p.sso.enforced;

  useEffect(() => {
    if (p.headingFont) loadGoogleFont(p.headingFont.family, p.headingFont.googleFontsUrl);
    if (p.bodyFont) loadGoogleFont(p.bodyFont.family, p.bodyFont.googleFontsUrl);
  }, [p.headingFont, p.bodyFont]);

  useEffect(() => {
    if (session.hotel()?.accessToken && !expired) router.replace(params.get("next") || "/today");
  }, [router, params, expired]);

  const headingStyle = heading ? { fontFamily: `"${heading}", var(--font-display), serif`, fontVariationSettings: "normal" } : undefined;
  return (
    <div className="grid min-h-dvh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" style={body ? { fontFamily: `"${body}", var(--font-sans), sans-serif` } : undefined} data-testid="branded-login">
      <aside className="relative hidden overflow-hidden lg:block" style={{ background: primary, color: onPrimary }}>
        <svg aria-hidden className="absolute -bottom-24 -right-24 h-[560px] w-[560px] opacity-[0.13]" viewBox="0 0 200 200">
          {Array.from({ length: 9 }, (_, i) => (
            <circle key={i} cx="100" cy="100" r={12 + i * 11} fill="none" stroke="currentColor" strokeWidth="0.7" />
          ))}
        </svg>
        <div className="relative flex h-full flex-col justify-between p-12 xl:p-16">
          <span className="inline-flex items-center gap-3">
            {p.logoUrl && !logoBroken ? (
              // eslint-disable-next-line @next/next/no-img-element -- the hotel's own logo
              <img src={p.logoUrl} alt="" onError={() => setLogoBroken(true)} className="h-10 max-w-[220px] object-contain" />
            ) : (
              <>
                <span className="grid h-10 w-10 place-items-center rounded-full border text-[15px]" style={{ borderColor: `${onPrimary}80`, ...headingStyle }}>
                  {p.brandName
                    .split(/\s+/)
                    .filter((w) => /^[A-Za-z]/.test(w) && !["the", "and", "of"].includes(w.toLowerCase()))
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join("")}
                </span>
                <span className="text-[20px]" style={headingStyle}>
                  {p.brandName}
                </span>
              </>
            )}
          </span>
          <div className="max-w-md">
            <p className="text-[12px] uppercase tracking-[0.2em] opacity-70">Staff</p>
            <p className="mt-4 text-[44px] leading-[1.05]" style={headingStyle}>
              Good to have you on shift.
            </p>
          </div>
        </div>
      </aside>
      <main className="flex min-h-dvh flex-col bg-paper px-5 py-8 sm:px-10 lg:px-16">
        <div className="-mx-5 -mt-8 mb-8 flex items-center gap-3 px-5 py-5 lg:hidden" style={{ background: primary, color: onPrimary }}>
          {p.logoUrl && !logoBroken ? (
            // eslint-disable-next-line @next/next/no-img-element -- the hotel's own logo
            <img src={p.logoUrl} alt="" onError={() => setLogoBroken(true)} className="h-8 max-w-[160px] object-contain" />
          ) : (
            <TenantMark name={p.brandName} size={30} className="border-current text-current" />
          )}
          <span className="text-[17px]" style={headingStyle}>
            {p.brandName}
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full max-w-[380px]">
            <p className="eyebrow mb-4">Staff sign in</p>
            <h1 className="text-[38px] leading-[1.05] text-ink" style={headingStyle ?? { fontFamily: "var(--font-display)" }} data-testid="portal-brand-name">
              {p.brandName}
            </h1>
            {expired && !ssoError && (
              <p className="mt-6 flex items-start gap-2.5 rounded-md border border-line bg-surface px-3.5 py-3 text-[13px] text-ink-muted">
                <Info size={16} weight="duotone" className="mt-px shrink-0" style={{ color: primary }} />
                Your session timed out. Sign in again.
              </p>
            )}
            {ssoError && (
              <div className="mt-6">
                <ErrorNote>{SSO_ERRORS[ssoError] ?? "Single sign-on didn't finish. Try again."}</ErrorNote>
              </div>
            )}
            <div className="mt-8 flex flex-col gap-4">
              {ssoOn && (
                <a
                  href={ssoStartUrl(p.sso.startUrl!, params.get("next"))}
                  className="inline-flex h-12 items-center justify-center gap-2.5 rounded-md border border-line-strong bg-surface text-[15px] font-medium text-ink transition-colors hover:bg-surface-2"
                  data-testid="sso-button"
                >
                  <ProviderMark id={p.sso.provider ?? "OIDC"} className="h-6 w-6 text-[13px]" /> Continue with {providerLabel(p.sso.provider)}
                </a>
              )}
              {ssoOn && !enforced && (
                <div className="flex items-center gap-3 text-[12px] text-ink-faint">
                  <span className="h-px flex-1 bg-line" /> or with your password <span className="h-px flex-1 bg-line" />
                </div>
              )}
              {!enforced || breakGlass ? (
                <PasswordForm devFill={false} accent={{ bg: accent, fg: inkOn(accent) }} />
              ) : (
                <button type="button" onClick={() => setBreakGlass(true)} className="inline-flex items-center justify-center gap-1.5 text-[12.5px] text-ink-muted hover:text-ink" data-testid="break-glass">
                  <Key size={13} /> Owner sign-in with a password
                </button>
              )}
              {enforced && breakGlass && <p className="text-[12px] leading-snug text-ink-muted">Only the owner named for emergencies can sign in with a password. It is recorded in the audit log.</p>}
            </div>
          </div>
        </div>
        <footer className="text-[12px] text-ink-faint">Trouble signing in? Ask your manager.</footer>
      </main>
    </div>
  );
}
