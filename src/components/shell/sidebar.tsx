"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { CaretUpDown, LockSimple, SignOut, SidebarSimple, Buildings, Receipt } from "@phosphor-icons/react";
import { HOTEL_NAV, isActive, type NavItem } from "@/lib/nav";
import { useEntitlements, useLogout } from "@/lib/auth";
import { ROLES } from "@/lib/catalog";
import { initials } from "@/lib/format";
import { cn } from "@/lib/cn";
import { LogoMark, Wordmark } from "@/components/brand";
import { PlanPlate, Skeleton, Tip } from "@/components/ui/primitives";
import { TrialPill } from "./trial-pill";
import { ThemeToggle } from "./theme-toggle";

export function Sidebar({
  collapsed,
  onToggle,
  onNavigate,
  variant = "desktop",
}: {
  collapsed: boolean;
  onToggle?: () => void;
  onNavigate?: () => void;
  variant?: "desktop" | "drawer";
}) {
  const pathname = usePathname();
  const { me, has, loading } = useEntitlements();
  const c = variant === "desktop" && collapsed;

  return (
    <div className="flex h-full flex-col">
      <div className={cn("flex h-16 shrink-0 items-center", c ? "justify-center px-0" : "px-5")}>
        <Link href="/today" onClick={onNavigate} aria-label="Today" className="rounded-sm">
          {c ? <LogoMark size={26} /> : <Wordmark size="sm" />}
        </Link>
      </div>

      {/* tenant */}
      {!c && (
        <div className="mx-3 mb-3 rounded-md border border-line bg-paper/70 px-3 py-3">
          {loading || !me ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-24" />
            </div>
          ) : (
            <>
              <p className="display-sm truncate text-[15.5px] leading-tight text-ink" title={me.tenant.name}>
                {me.tenant.name}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <PlanPlate name={me.subscription.planName} code={me.subscription.planCode} />
                <TrialPill sub={me.subscription} className="h-5 pl-1 pr-2 text-[11px]" />
              </div>
            </>
          )}
        </div>
      )}

      <nav aria-label="Main" className="scrollbar-thin flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4">
        {HOTEL_NAV.map((group) => (
          <div key={group.label} className="mt-3 first:mt-1">
            {c ? (
              <div className="mx-auto my-2 h-px w-6 bg-line" aria-hidden />
            ) : (
              <p className="eyebrow mb-1 px-3 text-[10px] text-ink-faint">{group.label}</p>
            )}
            <ul className="flex flex-col gap-px">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    active={isActive(pathname, item.href)}
                    locked={!!item.feature && !loading && !has(item.feature)}
                    collapsed={c}
                    onNavigate={onNavigate}
                  />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className={cn("shrink-0 border-t border-line p-3", c && "px-2")}>
        <UserMenu collapsed={c} />
        {variant === "desktop" && onToggle && (
          <button
            onClick={onToggle}
            className={cn(
              "mt-1 flex h-8 w-full items-center gap-2 rounded-md px-2.5 text-[12.5px] text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink",
              c && "justify-center px-0",
            )}
            aria-label={c ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!c}
          >
            <SidebarSimple size={16} weight="duotone" />
            {!c && (
              <>
                <span>Collapse</span>
                <span className="kbd ml-auto">[</span>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function NavLink({
  item,
  active,
  locked,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  locked: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const I = item.icon;
  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-3 rounded-md text-[14px] transition-colors duration-150",
        collapsed ? "justify-center px-0" : "px-3",
        active ? "bg-surface-2 font-medium text-ink" : "text-ink-muted hover:bg-surface-2/70 hover:text-ink",
      )}
    >
      {active && (
        <span aria-hidden className="absolute -left-3 top-1.5 bottom-1.5 w-[3px] rounded-r-xs bg-laterite" />
      )}
      <I
        size={19}
        weight={active ? "duotone" : "duotone"}
        className={cn("shrink-0 transition-colors", active ? "text-laterite" : locked ? "opacity-60" : "")}
      />
      {!collapsed && <span className={cn("truncate", locked && "opacity-75")}>{item.label}</span>}
      {locked && !collapsed && (
        <span className="ml-auto inline-flex items-center text-brass" aria-label="Locked on your plan">
          <LockSimple size={12} weight="bold" />
        </span>
      )}
      {locked && collapsed && (
        <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-brass" aria-label="Locked" />
      )}
    </Link>
  );
  if (collapsed)
    return (
      <Tip side="right" content={locked ? `${item.label} (upgrade)` : item.label}>
        {link}
      </Tip>
    );
  return link;
}

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { me } = useEntitlements();
  const logout = useLogout();
  const name = me?.user.fullName ?? "";
  return (
    <Menu.Root>
      <Menu.Trigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-surface-2 data-[state=open]:bg-surface-2",
            collapsed && "justify-center",
          )}
          aria-label="Account menu"
        >
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-[color-mix(in_oklab,var(--laterite)_30%,transparent)] bg-laterite-wash font-mono text-[11px] font-medium text-laterite">
            {initials(name)}
          </span>
          {!collapsed && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium text-ink">{name || " "}</span>
                <span className="block truncate text-[11.5px] text-ink-muted">
                  {me ? ROLES[me.user.role]?.label ?? me.user.role : " "}
                </span>
              </span>
              <CaretUpDown size={14} className="text-ink-faint" />
            </>
          )}
        </button>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content
          side="top"
          align="start"
          sideOffset={8}
          className="z-50 w-64 rounded-md border border-line bg-surface p-1.5 shadow-float animate-[rise_160ms_ease-out]"
        >
          <div className="px-2.5 pb-2 pt-1.5">
            <p className="truncate text-[13px] font-medium text-ink">{name}</p>
            <p className="truncate text-[12px] text-ink-muted">{me?.user.email}</p>
          </div>
          <div className="px-2 pb-2">
            <ThemeToggle className="w-full justify-between [&>button]:flex-1" />
          </div>
          <Menu.Separator className="my-1 h-px bg-line" />
          <MenuLink href="/property" icon={<Buildings size={16} weight="duotone" />}>
            Property settings
          </MenuLink>
          <MenuLink href="/billing" icon={<Receipt size={16} weight="duotone" />}>
            Billing & plan
          </MenuLink>
          <Menu.Separator className="my-1 h-px bg-line" />
          <Menu.Item
            onSelect={() => void logout()}
            className="flex h-8 cursor-pointer items-center gap-2.5 rounded-sm px-2.5 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2"
          >
            <SignOut size={16} weight="duotone" />
            Log out
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}

function MenuLink({ href, icon, children }: { href: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Menu.Item asChild>
      <Link
        href={href}
        className="flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2"
      >
        {icon}
        {children}
      </Link>
    </Menu.Item>
  );
}
