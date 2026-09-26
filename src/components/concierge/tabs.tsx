"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChartBar, Kanban, ListBullets, Storefront, SlidersHorizontal } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useCan } from "@/lib/permissions";

const TABS = [
  {
    href: "/concierge",
    label: "Board",
    icon: Kanban,
    cap: "concierge.view",
    exact: true,
  },
  {
    href: "/concierge/services",
    label: "Services",
    icon: ListBullets,
    cap: "concierge.view",
  },
  {
    href: "/concierge/vendors",
    label: "Vendors",
    icon: Storefront,
    cap: "concierge.view",
  },
  {
    href: "/concierge/reports",
    label: "Reports",
    icon: ChartBar,
    cap: "concierge.reports",
  },
  {
    href: "/concierge/settings",
    label: "Settings",
    icon: SlidersHorizontal,
    cap: "concierge.settings",
  },
];

/** The concierge's own strip of pages, under the page header. */
export function ConciergeTabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const { can } = useCan();
  const tabs = TABS.filter((t) => can(t.cap));
  return (
    <nav aria-label="Concierge" className={cn("scrollbar-thin -mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0", className)}>
      {tabs.map((t) => {
        const on = t.exact ? pathname === t.href || pathname.startsWith("/concierge/requests") : pathname.startsWith(t.href);
        const I = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={cn("relative inline-flex h-10 shrink-0 items-center gap-1.5 px-3 text-[13.5px] font-medium", on ? "text-ink" : "text-ink-muted hover:text-ink")}
          >
            <I size={15} weight={on ? "duotone" : "regular"} />
            {t.label}
            {on && <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-laterite" />}
          </Link>
        );
      })}
    </nav>
  );
}
