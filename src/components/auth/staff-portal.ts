"use client";

import { useEffect, useState } from "react";
import { staffPortalApi } from "@/lib/api/endpoints-m6";
import type { StaffPortalPublic } from "@/lib/api/types-m6";
import { config } from "@/lib/config";

/**
 * Hosts that are ours (localhost, *.APP_DOMAIN) never carry a hotel's brand and
 * render at once; any other host may be a hotel's verified staff portal, so the
 * sign-in page waits for GET /public/staff-portal?host= before showing a brand,
 * and never flashes ours first.
 */
export function isOwnHost(host: string) {
  const h = host.split(":")[0].toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === config.appDomain || h.endsWith(`.${config.appDomain}`) || h.endsWith(".local");
}

/** Development only: `/login?portal=staff.harmattanhotels.com` previews a staff portal on localhost. */
function portalHost(): string {
  if (typeof window === "undefined") return "";
  if (process.env.NODE_ENV !== "production") {
    const q = new URLSearchParams(window.location.search).get("portal");
    if (q) {
      try {
        sessionStorage.setItem("admin.portalHost", q);
      } catch {
        /* ignore */
      }
      return q;
    }
    try {
      const s = sessionStorage.getItem("admin.portalHost");
      if (s) return s;
    } catch {
      /* ignore */
    }
  }
  return window.location.host;
}

export type PortalState = { status: "loading" } | { status: "none" } | { status: "branded"; portal: StaffPortalPublic; host: string };

export function useStaffPortal(): PortalState {
  const [state, setState] = useState<PortalState>({ status: "loading" });
  useEffect(() => {
    const host = portalHost();
    const own = isOwnHost(host);
    let done = false;
    // our own hosts render straight away; a lookup still runs in dev for ?portal=
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the host is only known in the browser
    if (own) setState({ status: "none" });
    if (own && host === window.location.host) return;
    const timer = window.setTimeout(() => !done && setState({ status: "none" }), 2500);
    staffPortalApi
      .resolve(host)
      .then((portal) => setState({ status: "branded", portal, host }))
      .catch(() => setState({ status: "none" }))
      .finally(() => {
        done = true;
        window.clearTimeout(timer);
      });
    return () => window.clearTimeout(timer);
  }, []);
  return state;
}

/** The SSO start URL with our own completion page as the place to come back to. */
export function ssoStartUrl(startUrl: string, next?: string | null) {
  try {
    if (next) sessionStorage.setItem("admin.sso.next", next);
  } catch {
    /* ignore */
  }
  try {
    const u = new URL(startUrl, config.apiOrigin);
    u.searchParams.set("returnTo", `${window.location.origin}/sso/complete`);
    return u.toString();
  } catch {
    return startUrl;
  }
}

export function takeSsoNext(): string | null {
  try {
    const v = sessionStorage.getItem("admin.sso.next");
    sessionStorage.removeItem("admin.sso.next");
    return v && v.startsWith("/") && !v.startsWith("//") ? v : null;
  } catch {
    return null;
  }
}

export const SSO_ERRORS: Record<string, string> = {
  SSO_DOMAIN_NOT_ALLOWED: "That account's email domain isn't allowed to sign in here. Use your work account.",
  SSO_USER_NOT_FOUND: "There's no staff account for that email yet. Ask your manager to add you first.",
  SSO_STATE_INVALID: "The sign-in took too long or was opened twice. Start again.",
  SSO_TOKEN_INVALID: "Your identity provider's answer couldn't be verified. Try again, or tell your IT team.",
  LIMIT_REACHED: "Every staff seat on your plan is taken, so a new account couldn't be created. Ask the owner.",
  SSO_DISABLED: "Single sign-on is switched off for this hotel. Use your password.",
};

export function providerLabel(p: string | null | undefined) {
  if (!p) return "single sign-on";
  const u = p.toUpperCase();
  if (u === "GOOGLE") return "Google";
  if (u === "MICROSOFT") return "Microsoft";
  return "single sign-on";
}
