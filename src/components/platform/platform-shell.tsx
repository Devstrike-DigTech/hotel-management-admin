"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { Buildings, ChartBar, SignOut, Stack } from "@phosphor-icons/react";
import { useQueryClient } from "@tanstack/react-query";
import { onSessionExpired } from "@/lib/api/client";
import { session } from "@/lib/api/session";
import { useHydrated, usePlatformSession } from "@/lib/auth";
import { config } from "@/lib/config";
import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/brand";
import { ThemeToggle } from "@/components/shell/theme-toggle";

const NAV = [
  { href: "/platform", label: "Overview", icon: ChartBar },
  { href: "/platform/tenants", label: "Tenants", icon: Buildings },
  { href: "/platform/plans", label: "Plans", icon: Stack },
];

function active(pathname: string, href: string) {
  return href === "/platform" ? pathname === "/platform" : pathname.startsWith(href);
}

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const s = usePlatformSession();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();

  useEffect(() => {
    if (hydrated && !s) router.replace(`/platform/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, s, router, pathname]);
  useEffect(
    () =>
      onSessionExpired((aud) => {
        if (aud === "platform") router.replace("/platform/login?expired=1");
      }),
    [router],
  );

  if (!hydrated || !s)
    return (
      <div className="grid min-h-dvh place-items-center">
        <LogoMark size={40} className="animate-[breathe_1.6s_ease-in-out_infinite]" />
      </div>
    );

  const logout = () => {
    session.setPlatform(null);
    qc.removeQueries({ queryKey: ["platform"] });
    router.replace("/platform/login");
  };

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="shrink-0 bg-[#1b1a17] text-[#efe8dc] lg:w-[232px] dark:bg-[#0c0b09] dark:lg:border-r dark:lg:border-line">
        <div className="lg:sticky lg:top-0 lg:flex lg:h-dvh lg:flex-col">
          <div className="flex h-14 items-center gap-3 px-4 lg:h-16 lg:px-5">
            <LogoMark size={24} />
            <div className="min-w-0 leading-tight">
              <p className="display-sm truncate text-[15px] text-[#f4ecdd]">{config.appName}</p>
              <p className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-[#d6a94a]">Platform console</p>
            </div>
            <button
              onClick={logout}
              className="ml-auto grid h-9 w-9 place-items-center rounded-md text-[#efe8dc]/70 hover:bg-white/5 hover:text-[#efe8dc] lg:hidden"
              aria-label="Log out"
            >
              <SignOut size={18} />
            </button>
          </div>
          <nav aria-label="Console" className="scrollbar-thin overflow-x-auto px-3 pb-2 lg:flex-1 lg:pb-0 lg:pt-4">
            <ul className="flex gap-1 lg:flex-col">
              {NAV.map((n) => {
                const I = n.icon;
                const on = active(pathname, n.href);
                return (
                  <li key={n.href}>
                    <Link
                      href={n.href}
                      aria-current={on ? "page" : undefined}
                      className={cn(
                        "relative flex h-9 items-center gap-3 whitespace-nowrap rounded-md px-3 text-[14px] transition-colors",
                        on ? "bg-white/[0.07] text-[#f4ecdd]" : "text-[#efe8dc]/60 hover:bg-white/[0.04] hover:text-[#efe8dc]",
                      )}
                    >
                      {on && <span className="absolute -left-3 top-1.5 bottom-1.5 hidden w-[3px] rounded-r-xs bg-[#d6a94a] lg:block" />}
                      <I size={18} weight="duotone" className={on ? "text-[#d6a94a]" : ""} />
                      {n.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <div className="hidden border-t border-white/10 p-3 lg:block">
            <div className="flex items-center gap-2.5 px-1.5 py-1.5">
              <span className="grid h-8 w-8 place-items-center rounded-full border border-[#d6a94a]/40 font-mono text-[11px] text-[#d6a94a]">
                {initials(s.fullName ?? s.email ?? "D S")}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] text-[#f4ecdd]">{s.fullName ?? "Devstrike admin"}</p>
                <p className="truncate text-[11.5px] text-[#efe8dc]/55">{s.email}</p>
              </div>
            </div>
            <button
              onClick={logout}
              className="mt-1 flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-[12.5px] text-[#efe8dc]/65 hover:bg-white/5 hover:text-[#efe8dc]"
            >
              <SignOut size={15} /> Log out
            </button>
          </div>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center justify-between gap-3 border-b border-line px-4 sm:px-6 lg:px-10">
          <p className="eyebrow truncate">
            <span className="hidden sm:inline">Devstrike Digital &middot; </span>Operations
          </p>
          <ThemeToggle compact />
        </header>
        <main className="flex-1 px-4 pb-16 pt-6 sm:px-6 md:pt-9 lg:px-10">
          <div key={pathname} className="mx-auto w-full max-w-[1240px] animate-[rise_260ms_cubic-bezier(0.22,1,0.36,1)]">
            <Suspense fallback={null}>{children}</Suspense>
          </div>
        </main>
      </div>
    </div>
  );
}
