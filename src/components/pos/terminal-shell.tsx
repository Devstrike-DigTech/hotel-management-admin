"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHotelSession, useHydrated, useSilentRefresh, useEntitlements } from "@/lib/auth";
import { onSessionExpired } from "@/lib/api/client";
import { LogoMark } from "@/components/brand";
import { OfflineRuntime } from "@/components/offline/offline";
import { PropertyScopeRuntime } from "@/components/shell/property-switcher";
import { AppShell } from "@/components/shell/app-shell";
import { cn } from "@/lib/cn";

/**
 * A full-bleed shell for the till and the kitchen display: no sidebar, the
 * whole screen for tiles and tickets. Session guard, silent refresh, the
 * property scope and the offline outbox, like the rest of the admin.
 * Without the feature, the page falls back to the admin shell with its
 * upgrade preview.
 */
export function TerminalShell({ feature, locked, children, dark }: { feature: string; locked: React.ReactNode; children: React.ReactNode; dark?: boolean }) {
  const hydrated = useHydrated();
  const s = useHotelSession();
  const router = useRouter();
  const pathname = usePathname();
  const { has, loading } = useEntitlements();
  useSilentRefresh();
  useEffect(() => {
    if (hydrated && !s) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, s, router, pathname]);
  useEffect(
    () =>
      onSessionExpired((aud) => {
        if (aud === "hotel") router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}&expired=1`);
      }),
    [router],
  );
  if (hydrated && s && !loading && !has(feature)) return <AppShell>{locked}</AppShell>;
  if (!hydrated || !s || loading)
    return (
      <div className={cn("grid min-h-dvh place-items-center bg-paper", dark && "theme-dark")} aria-busy aria-label="Loading">
        <LogoMark size={40} className="animate-[breathe_1.6s_ease-in-out_infinite]" />
      </div>
    );
  return (
    <div className={cn("relative z-10 min-h-dvh bg-paper text-ink", dark && "theme-dark")}>
      {children}
      <PropertyScopeRuntime />
      <OfflineRuntime />
    </div>
  );
}
