import {
  AddressBook,
  Bed,
  BookBookmark,
  BookOpenText,
  Broom,
  Buildings,
  CashRegister,
  ChartBar,
  ChartLineUp,
  ClockCounterClockwise,
  Coins,
  Crown,
  Key,
  Percent,
  Plugs,
  Receipt,
  Rows,
  SealCheck,
  ShieldWarning,
  SunHorizon,
  UsersThree,
  Wallet,
  type Icon,
} from "@phosphor-icons/react";
import type { Capability } from "./permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  feature?: string;
  keywords?: string;
  shortcut?: string;
  /** hidden for roles without this capability */
  cap?: Capability;
  /** show a live count badge */
  badge?: "flags" | "approvals";
  /** label on the phone tab bar */
  short?: string;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const HOTEL_NAV: NavGroup[] = [
  {
    label: "Front of house",
    items: [
      { href: "/today", label: "Today", icon: SunHorizon, keywords: "dashboard home arrivals departures in-house", shortcut: "G T" },
      { href: "/ledger", label: "The Ledger", short: "Ledger", icon: Rows, feature: "reservations", cap: "reservations.read", keywords: "tape chart calendar availability grid", shortcut: "G L" },
      { href: "/reservations", label: "Reservations", short: "Bookings", icon: BookBookmark, feature: "reservations", cap: "reservations.read", keywords: "bookings stays arrivals codes", shortcut: "G V" },
      { href: "/guests", label: "Guests", icon: AddressBook, feature: "guest_register", cap: "guest.read", keywords: "guest profiles people customers ndpa" },
      { href: "/rooms", label: "Rooms", icon: Key, keywords: "key rack board status", shortcut: "G R" },
      { href: "/rooms/types", label: "Room types", icon: Bed, keywords: "rates prices categories" },
      { href: "/housekeeping", label: "Housekeeping", icon: Broom, feature: "housekeeping", keywords: "cleaning tasks" },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/shifts", label: "My shift", short: "Shift", icon: Coins, cap: "shift.own", keywords: "cashier till float blind count close shift open shift" },
      { href: "/folios", label: "Folios & invoices", icon: Wallet, feature: "invoicing", cap: "folio.read", keywords: "bills invoices receipts balances walk-in" },
      { href: "/approvals", label: "Approvals", icon: SealCheck, cap: "shift.approve", badge: "approvals", keywords: "approve shifts manager variance" },
      { href: "/guard", label: "Revenue Guard", icon: ShieldWarning, feature: "revenue_guard_basic", cap: "guard.read", badge: "flags", keywords: "flags leakage fraud alerts triage" },
      { href: "/reports", label: "Reports", icon: ChartBar, cap: "reports.read", keywords: "daily flash revenue occupancy adr revpar shifts digest night audit" },
      { href: "/register", label: "Guest register", icon: BookOpenText, feature: "guest_register", cap: "guest.write", keywords: "police register csv export security book" },
    ],
  },
  {
    label: "Grow",
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
      { href: "/staff", label: "Staff", icon: UsersThree, keywords: "team people users roles pin", shortcut: "G S" },
      { href: "/property", label: "Property", icon: Buildings, keywords: "settings details hotel branding amenities" },
      { href: "/settings/taxes", label: "Taxes & charges", icon: Percent, cap: "tax.read", keywords: "vat consumption tax service charge discount threshold" },
      { href: "/billing", label: "Billing & plan", icon: Receipt, keywords: "subscription upgrade invoices plan", shortcut: "G B" },
      { href: "/audit", label: "Audit log", icon: ClockCounterClockwise, keywords: "history activity trail" },
    ],
  },
];

export const MOBILE_TABS = ["/today", "/ledger", "/reservations", "/shifts"];

export function allNavItems() {
  return HOTEL_NAV.flatMap((g) => g.items);
}

export function isActive(pathname: string, href: string) {
  if (href === "/rooms") return pathname === "/rooms";
  return pathname === href || pathname.startsWith(`${href}/`);
}
