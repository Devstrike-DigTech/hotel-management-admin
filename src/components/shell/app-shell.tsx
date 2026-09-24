"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import * as D from "@radix-ui/react-dialog";
import { Suspense, useEffect, useState } from "react";
import { DotsThreeOutline, Lifebuoy, MagnifyingGlass, WarningOctagon, ClockCountdown, X } from "@phosphor-icons/react";
import { useHotelSession, useHydrated, useSilentRefresh } from "@/lib/auth";
import { onSessionExpired } from "@/lib/api/client";
import { useMe } from "@/lib/api/hooks";
import { MOBILE_TABS, allNavItems, isActive, navVisible } from "@/lib/nav";
import { daysUntil, formatDate } from "@/lib/format";
import { paletteStore, readOnlyStore, useStore } from "@/lib/store";
import { cn } from "@/lib/cn";
import { LogoMark } from "@/components/brand";
import { Sidebar } from "./sidebar";
import { CommandPalette } from "./command-palette";
import { TrialPill } from "./trial-pill";
import { LagosClock } from "./lagos-clock";
import { ThemeToggle } from "./theme-toggle";
import { ModKeyHint } from "./mod-key";
import { OfflineBanner, OfflineRuntime, OutboxChip } from "@/components/offline/offline";
import { ShiftChip } from "./shift-chip";
import { useCan } from "@/lib/permissions";
import { NewReservationHost } from "@/components/reservations/new-reservation";
import { PaymentHost } from "@/components/folio/take-payment";
import { OnlineFeedRuntime } from "@/components/online/online-feed";
import { PropertyScopeRuntime, usePropertyScope } from "./property-switcher";
import { AnnouncementBars, M6Runtime, SupportSessionBar, useShellBrand } from "./m6-runtime";
import { SupportHost, openSupport } from "@/components/support/new-request";
import { Tip } from "@/components/ui/primitives";
import { TenantMark } from "@/components/brand";

const COLLAPSE_KEY = "admin.sidebar.collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const s = useHotelSession();
  const router = useRouter();
  const pathname = usePathname();
  useSilentRefresh();

  useEffect(() => {
    if (hydrated && !s && !pathname.startsWith("/impersonate")) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [hydrated, s, router, pathname]);

  useEffect(
    () =>
      onSessionExpired((why) => {
        if (why === "impersonation") router.replace("/impersonate?ended=1");
        else router.replace(`/login?next=${encodeURIComponent(window.location.pathname)}&expired=1`);
      }),
    [router],
  );

  if (!hydrated || !s) return <ShellSplash />;
  return <Shell>{children}</Shell>;
}

function ShellSplash() {
  return (
    <div className="grid min-h-dvh place-items-center" aria-busy aria-label="Loading">
      <div className="flex flex-col items-center gap-4">
        <LogoMark size={40} className="animate-[breathe_1.6s_ease-in-out_infinite]" />
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const me = useMe();
  const pathname = usePathname();

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read persisted preference after mount
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* ignore */
      }
      return !c;
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if (e.key === "[" && !e.metaKey && !e.ctrlKey) toggle();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const current = allNavItems().find((i) => isActive(pathname, i.href));
  const scope = usePropertyScope();
  const brand = useShellBrand();
  const place = scope.current?.name ?? me.data?.tenant.name;

  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-sm focus:bg-ink focus:px-3 focus:py-2 focus:text-paper"
      >
        Skip to content
      </a>

      {/* desktop sidebar */}
      <aside
        className={cn(
          "hidden shrink-0 border-r border-line bg-surface transition-[width] duration-200 ease-out lg:block",
          collapsed ? "w-[68px]" : "w-[252px]",
        )}
      >
        <div className="sticky top-0 h-dvh">
          <Sidebar collapsed={collapsed} onToggle={toggle} />
        </div>
      </aside>

      {/* mobile drawer */}
      <D.Root open={drawer} onOpenChange={setDrawer}>
        <D.Portal>
          <D.Overlay className="fixed inset-0 z-50 bg-[color-mix(in_oklab,var(--ink)_30%,transparent)] animate-[fade_160ms_ease-out] lg:hidden" />
          <D.Content className="fixed inset-y-0 left-0 z-50 w-[86vw] max-w-[300px] border-r border-line bg-surface shadow-float outline-none animate-[sheet-in_220ms_cubic-bezier(0.22,1,0.36,1)] [animation-direction:normal] lg:hidden">
            <D.Title className="sr-only">Navigation</D.Title>
            <D.Description className="sr-only">All sections of the admin</D.Description>
            <D.Close className="absolute right-3 top-4 z-10 grid h-8 w-8 place-items-center rounded-sm text-ink-muted hover:bg-surface-2" aria-label="Close menu">
              <X size={16} />
            </D.Close>
            <Sidebar collapsed={false} variant="drawer" onNavigate={() => setDrawer(false)} />
          </D.Content>
        </D.Portal>
      </D.Root>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* top bar (a support session's bar rides above it) */}
        <div className="sticky top-0 z-30">
        <SupportSessionBar />
        <header className="flex h-14 items-center gap-3 border-b border-line bg-[color-mix(in_oklab,var(--paper)_88%,transparent)] px-4 backdrop-blur-[6px] sm:px-6 lg:px-8">
          <Link href="/today" className="lg:hidden" aria-label="Today">
            {brand.whiteLabel ? <TenantMark name={brand.name} logoUrl={brand.logoUrl} size={24} /> : <LogoMark size={24} />}
          </Link>
          <div className="min-w-0 lg:hidden">
            <p className="truncate text-[13.5px] font-medium text-ink">{me.data?.tenant.name ?? " "}</p>
          </div>
          <p className="eyebrow hidden items-center gap-2 lg:flex">
            <span className="text-ink-faint" data-testid="topbar-property-lg">{place}</span>
            <span className="text-ink-faint">/</span>
            <span className="text-ink">{current?.label ?? ""}</span>
          </p>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => paletteStore.set(true)}
              className="group hidden h-8 items-center gap-2 rounded-md border border-line bg-surface pl-2.5 pr-1.5 text-[13px] text-ink-muted transition-colors hover:border-line-strong hover:text-ink sm:flex"
            >
              <MagnifyingGlass size={15} />
              <span className="mr-6">Search or jump to</span>
              <ModKeyHint />
            </button>
            <button
              onClick={() => paletteStore.set(true)}
              className="grid h-9 w-9 place-items-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink sm:hidden"
              aria-label="Search and commands"
            >
              <MagnifyingGlass size={19} />
            </button>
            <OutboxChip />
            <ShiftChip className="hidden sm:inline-flex" />
            <div className="hidden 2xl:block">
              <TrialPill sub={me.data?.subscription} />
            </div>
            <LagosClock className="hidden xl:flex" />
            <Tip content="Ask for help">
              <button type="button" onClick={() => openSupport()} className="grid h-9 w-9 place-items-center rounded-md text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Ask for help" data-testid="help-button">
                <Lifebuoy size={18} />
              </button>
            </Tip>
            <ThemeToggle compact className="hidden md:inline-flex" />
          </div>
        </header>
        </div>

        <OfflineBanner />
        <Banners />
        <AnnouncementBars />

        <main id="main" className="flex-1 px-4 pb-28 pt-6 sm:px-6 md:pt-9 lg:px-10 lg:pb-16">
          <div className="mx-auto w-full max-w-[1240px] animate-[rise_260ms_cubic-bezier(0.22,1,0.36,1)]" key={pathname}>
            <Suspense fallback={null}>{children}</Suspense>
          </div>
        </main>

        <MobileTabs onMore={() => setDrawer(true)} />
      </div>

      <CommandPalette />
      <OfflineRuntime />
      <NewReservationHost />
      <PaymentHost />
      <OnlineFeedRuntime />
      <PropertyScopeRuntime />
      <SupportHost />
      <M6Runtime />
    </div>
  );
}

function MobileTabs({ onMore }: { onMore: () => void }) {
  const pathname = usePathname();
  const { can, ready } = useCan();
  // desk roles get the desk tabs; housekeeping and maintenance roles get their own work first
  const desk = !ready || can("reservations.read");
  const items = allNavItems()
    .filter((i) =>
      desk ? MOBILE_TABS.includes(i.href) : ["/hk", "/housekeeping", "/maintenance", "/rooms"].includes(i.href),
    )
    .filter((i) => navVisible(i, can, ready))
    .slice(0, 4);
  const moreActive = !items.some((i) => isActive(pathname, i.href));
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[color-mix(in_oklab,var(--surface)_94%,transparent)] pb-[env(safe-area-inset-bottom)] backdrop-blur-[6px] lg:hidden"
    >
      <ul className="mx-auto grid max-w-lg auto-cols-fr grid-flow-col">
        {items.map((item) => {
          const I = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-[60px] flex-col items-center justify-center gap-1 text-[10.5px] font-medium",
                  active ? "text-laterite" : "text-ink-muted",
                )}
              >
                {active && <span className="absolute top-0 h-[2px] w-8 rounded-b-xs bg-laterite" aria-hidden />}
                <I size={22} weight={active ? "fill" : "duotone"} />
                {item.short ?? item.label.split(" ")[0]}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            onClick={onMore}
            className={cn(
              "flex h-[60px] w-full flex-col items-center justify-center gap-1 text-[10.5px] font-medium",
              moreActive ? "text-laterite" : "text-ink-muted",
            )}
          >
            <DotsThreeOutline size={22} weight="duotone" />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}

/** Read-only / past-due / trial-ending banners. */
function Banners() {
  const me = useMe();
  const forcedReadOnly = useStore(readOnlyStore);
  const sub = me.data?.subscription;
  const [dismissed, setDismissed] = useState(false);
  if (!sub) return null;

  if (forcedReadOnly || sub.status === "READ_ONLY" || sub.status === "SUSPENDED") {
    return (
      <div role="status" className="border-b border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-wash">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:px-6 lg:px-10">
          <WarningOctagon size={18} weight="duotone" className="shrink-0 text-danger" />
          <p className="flex-1 text-[13px] text-ink">
            <strong className="font-medium">
              {sub.status === "SUSPENDED" ? "Your account is suspended." : "Your account is read-only."}
            </strong>{" "}
            <span className="text-ink-muted">
              Everything is still here, but changes are paused until your subscription is renewed.
            </span>
          </p>
          <Link href="/billing" className="text-[13px] font-medium text-danger underline underline-offset-4">
            Renew now
          </Link>
        </div>
      </div>
    );
  }
  if (sub.status === "PAST_DUE") {
    return (
      <div role="status" className="border-b border-[color-mix(in_oklab,var(--ochre)_35%,transparent)] bg-ochre-wash">
        <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-10">
          <ClockCountdown size={18} weight="duotone" className="shrink-0 text-ochre" />
          <p className="flex-1 text-[13px] text-ink">
            <strong className="font-medium">Payment is overdue.</strong>{" "}
            <span className="text-ink-muted">Pay before the grace period ends to avoid read-only mode.</span>
          </p>
          <Link href="/billing" className="text-[13px] font-medium text-ochre underline underline-offset-4">
            Pay now
          </Link>
        </div>
      </div>
    );
  }
  const left = sub.status === "TRIALING" ? daysUntil(sub.trialEndsAt) : null;
  if (left !== null && left <= 3 && !dismissed) {
    return (
      <div role="status" className="border-b border-[color-mix(in_oklab,var(--brass)_35%,transparent)] bg-brass-wash">
        <div className="mx-auto flex max-w-[1240px] items-center gap-3 px-4 py-2.5 sm:px-6 lg:px-10">
          <ClockCountdown size={18} weight="duotone" className="shrink-0 text-brass" />
          <p className="flex-1 text-[13px] text-ink">
            Your {sub.planName} trial ends on <strong className="font-medium">{formatDate(sub.trialEndsAt)}</strong>.{" "}
            <span className="text-ink-muted">Choose a plan to keep things running without a pause.</span>
          </p>
          <Link href="/billing#plans" className="text-[13px] font-medium text-brass underline underline-offset-4">
            Choose a plan
          </Link>
          <button aria-label="Dismiss" onClick={() => setDismissed(true)} className="text-ink-muted hover:text-ink">
            <X size={14} />
          </button>
        </div>
      </div>
    );
  }
  return null;
}

