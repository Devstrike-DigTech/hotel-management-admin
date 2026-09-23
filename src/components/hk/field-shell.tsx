"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHotelSession, useHydrated, useSilentRefresh } from "@/lib/auth";
import { onSessionExpired } from "@/lib/api/client";
import { LogoMark } from "@/components/brand";
import { OfflineRuntime } from "@/components/offline/offline";

/** A chrome-free shell for phone work views: session guard, silent refresh and the offline outbox. */
export function FieldShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const s = useHotelSession();
  const router = useRouter();
  const pathname = usePathname();
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
  if (!hydrated || !s)
    return (
      <div className="grid min-h-dvh place-items-center" aria-busy aria-label="Loading">
        <LogoMark size={40} className="animate-[breathe_1.6s_ease-in-out_infinite]" />
      </div>
    );
  return (
    <div className="relative z-10">
      {children}
      <OfflineRuntime />
    </div>
  );
}
