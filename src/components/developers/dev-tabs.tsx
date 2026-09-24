"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpenText, Key, WebhooksLogo } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/developers", label: "Quick start", icon: BookOpenText, exact: true },
  { href: "/developers/api-keys", label: "API keys", icon: Key },
  { href: "/developers/webhooks", label: "Webhooks", icon: WebhooksLogo },
];

export function DevTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Developer sections" className="-mt-3 mb-7 flex gap-1 overflow-x-auto border-b border-line md:-mt-5">
      {TABS.map((t) => {
        const on = t.exact ? pathname === t.href : pathname.startsWith(t.href);
        const I = t.icon;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative -mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-[13.5px] font-medium transition-colors",
              on ? "border-laterite text-ink" : "border-transparent text-ink-muted hover:text-ink",
            )}
          >
            <I size={16} weight={on ? "fill" : "duotone"} />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
