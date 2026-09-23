"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useHotelSession, useHydrated } from "@/lib/auth";
import { LogoMark } from "@/components/brand";

/** Signed-in wrapper for print pages: no sidebar, no top bar, just the paper. */
export function PrintShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const s = useHotelSession();
  const router = useRouter();
  const pathname = usePathname();
  useEffect(() => {
    if (hydrated && !s) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, s, router, pathname]);
  if (!hydrated || !s)
    return (
      <div className="grid min-h-dvh place-items-center">
        <LogoMark size={36} className="animate-[breathe_1.6s_ease-in-out_infinite]" />
      </div>
    );
  return <>{children}</>;
}
