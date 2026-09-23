import {
  Bed,
  Broom,
  Buildings,
  CashRegister,
  ChartLineUp,
  ClockCounterClockwise,
  Crown,
  Key,
  Plugs,
  Receipt,
  SunHorizon,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";

export interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  feature?: string;
  keywords?: string;
  shortcut?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const HOTEL_NAV: NavGroup[] = [
  {
    label: "Front of house",
    items: [
      { href: "/today", label: "Today", icon: SunHorizon, keywords: "dashboard home overview", shortcut: "G T" },
      { href: "/rooms", label: "Rooms", icon: Key, keywords: "key rack board status", shortcut: "G R" },
      { href: "/rooms/types", label: "Room types", icon: Bed, keywords: "rates prices categories" },
      { href: "/housekeeping", label: "Housekeeping", icon: Broom, feature: "housekeeping", keywords: "cleaning tasks" },
    ],
  },
  {
    label: "Revenue",
    items: [
      { href: "/pos", label: "Point of sale", icon: CashRegister, feature: "pos", keywords: "bar restaurant pos" },
      { href: "/dynamic-pricing", label: "Dynamic pricing", icon: ChartLineUp, feature: "dynamic_pricing", keywords: "rates yield" },
      { href: "/channel-manager", label: "Channel manager", icon: Plugs, feature: "channel_manager", keywords: "ota booking sync" },
      { href: "/loyalty", label: "Loyalty", icon: Crown, feature: "loyalty", keywords: "rewards points guests" },
    ],
  },
  {
    label: "The house",
    items: [
      { href: "/staff", label: "Staff", icon: UsersThree, keywords: "team people users roles", shortcut: "G S" },
      { href: "/property", label: "Property", icon: Buildings, keywords: "settings details hotel branding amenities" },
      { href: "/billing", label: "Billing & plan", icon: Receipt, keywords: "subscription upgrade invoices plan", shortcut: "G B" },
      { href: "/audit", label: "Audit log", icon: ClockCounterClockwise, keywords: "history activity trail" },
    ],
  },
];

export const MOBILE_TABS = ["/today", "/rooms", "/staff", "/billing"];

export function allNavItems() {
  return HOTEL_NAV.flatMap((g) => g.items);
}

export function isActive(pathname: string, href: string) {
  if (href === "/rooms") return pathname === "/rooms";
  return pathname === href || pathname.startsWith(`${href}/`);
}
