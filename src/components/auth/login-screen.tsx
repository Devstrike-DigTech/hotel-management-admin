"use client";

import { useEffect } from "react";
import { AsideQuote, AuthSplit } from "./auth-split";
import { LoginForm } from "./login-form";
import { BrandedLogin } from "./branded-login";
import { useStaffPortal } from "./staff-portal";

/** Our sign-in, or the hotel's own when this host is its verified staff portal. */
export function LoginScreen() {
  const portal = useStaffPortal();
  const branded = portal.status === "branded" ? portal.portal : null;
  useEffect(() => {
    if (!branded) return;
    document.title = `Sign in · ${branded.brandName}`;
    if (branded.faviconUrl) {
      for (const l of Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'))) l.remove();
      const link = document.createElement("link");
      link.rel = "icon";
      link.href = branded.faviconUrl;
      document.head.appendChild(link);
    }
  }, [branded]);
  if (portal.status === "loading") return <div className="min-h-dvh bg-paper" aria-busy aria-label="Loading" />;
  if (branded) return <BrandedLogin portal={branded} />;
  return (
    <AuthSplit aside={<AsideQuote />}>
      <LoginForm />
    </AuthSplit>
  );
}
