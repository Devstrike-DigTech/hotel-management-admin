import {
  AddressBook,
  Bank,
  ChatsTeardrop,
  GlobeHemisphereWest,
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
  Wrench,
  CalendarDots,
  Tag,
  Ticket,
  Briefcase,
  Notebook,
  ShieldCheck,
  BellRinging,
  DeviceMobile,
  ChatCircleText,
  CookingPot,
  ForkKnife,
  Package,
  TreeStructure,
  Globe,
  Code,
  Palette,
  Fingerprint,
  FileZip,
  Lifebuoy,
  type Icon,
} from "@phosphor-icons/react";
import type { Capability, Permission } from "./permissions";

export interface NavItem {
  href: string;
  label: string;
  icon: Icon;
  feature?: string;
  keywords?: string;
  shortcut?: string;
  /** hidden without this capability or permission (an array means any of them) */
  cap?: Capability | Permission | (Capability | Permission)[];
  /** show a live count badge */
  badge?: "flags" | "approvals" | "reviews" | "inbox" | "support";
  /** label on the phone tab bar */
  short?: string;
  /** hidden for roles that have this capability (avoids duplicates) */
  hideCap?: Capability | Permission;
  /** active only on this exact path (children are separate items) */
  exact?: boolean;
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
      { href: "/inbox", label: "Guest inbox", short: "Inbox", icon: ChatCircleText, feature: "whatsapp_messaging", cap: "inbox.view", badge: "inbox", keywords: "whatsapp messages chat conversations reply guests threads", shortcut: "G I" },
      { href: "/loyalty", label: "Loyalty", icon: Crown, feature: "loyalty", cap: "loyalty.view", keywords: "rewards points members tiers circle redeem" },
      { href: "/reviews", label: "Reviews", icon: ChatsTeardrop, cap: "reviews.read", badge: "reviews", keywords: "ratings stars feedback reply verified stays" },
      { href: "/rooms", label: "Rooms", icon: Key, exact: true, cap: ["rooms.status", "rooms.manage", "reservations.view"], keywords: "key rack board status", shortcut: "G R" },
      { href: "/rooms/types", label: "Room types", icon: Bed, cap: ["rooms.manage", "rates.view"], keywords: "categories base price" },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/housekeeping", label: "Housekeeping", icon: Broom, feature: "housekeeping", cap: ["housekeeping.assign", "housekeeping.inspect", "housekeeping.view"], keywords: "cleaning tasks board assign inspection checklist lost found" },
      { href: "/hk", label: "My rooms", short: "My rooms", icon: DeviceMobile, feature: "housekeeping", cap: "housekeeping.work", keywords: "housekeeper phone my tasks cleaning start finish" },
      { href: "/maintenance", label: "Maintenance", icon: Wrench, feature: "maintenance", cap: "maintenance.view", keywords: "tickets repairs faults ac generator diesel fuel block out of order preventive" },
    ],
  },
  {
    label: "Outlets",
    items: [
      { href: "/pos", label: "Point of sale", short: "POS", icon: CashRegister, feature: "pos", cap: "pos.view", exact: true, keywords: "till bar restaurant order ticket table tab room charge settle receipt" },
      { href: "/kds", label: "Kitchen display", icon: CookingPot, feature: "pos", cap: "kds.view", keywords: "kds kitchen bar tickets bump ready kot" },
      { href: "/pos/menu", label: "Menu & outlets", icon: ForkKnife, feature: "pos", cap: "pos.manage", keywords: "menu items prices categories modifiers happy hour outlets" },
      { href: "/pos/stock", label: "Stock & minibar", icon: Package, feature: "pos", cap: ["stock.view", "stock.manage", "minibar.record"], keywords: "stock inventory count variance purchases minibar par levels low stock" },
      { href: "/pos/reports", label: "Outlet sales", icon: ChartBar, feature: "pos", cap: "pos.view", keywords: "pos reports sales by outlet item hour voids cashier top items" },
    ],
  },
  {
    label: "Rates & sales",
    items: [
      { href: "/rates", label: "Rate Almanac", short: "Rates", icon: CalendarDots, feature: "promotions", cap: "rates.view", exact: true, keywords: "rates prices seasons calendar weekend detty december override min stay closed to arrival stop sell" },
      { href: "/rates/plans", label: "Rate plans", icon: Notebook, feature: "promotions", cap: "rates.view", keywords: "bar non-refundable corporate long stay breakfast" },
      { href: "/promotions", label: "Promo codes", icon: Ticket, feature: "promotions", cap: "rates.view", keywords: "promo codes discount voucher welcome10" },
      { href: "/corporate", label: "Corporate accounts", icon: Briefcase, feature: "promotions", cap: "corporate.view", keywords: "companies negotiated rate credit limit oil bank ngo" },
      { href: "/dynamic-pricing", label: "Dynamic pricing", icon: ChartLineUp, feature: "dynamic_pricing", cap: "pricing.view", keywords: "suggestions autopilot guardrails events calendar yield pricing engine earned" },
      { href: "/channel-manager", label: "Channel manager", icon: Plugs, feature: "channel_manager", cap: "channels.view", keywords: "ota booking.com expedia airbnb agoda ical channex sync mapping commission" },
      { href: "/city-ledger", label: "City Ledger", icon: Tag, feature: "promotions", cap: "corporate.view", keywords: "receivables aging statements invoices companies owe" },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/shifts", label: "My shift", short: "Shift", icon: Coins, cap: "shift.own", keywords: "cashier till float blind count close shift open shift" },
      { href: "/shifts", label: "Shifts", short: "Shifts", icon: Coins, cap: "shift.viewAll", hideCap: "shift.own", keywords: "cashier shifts variance counts all" },
      { href: "/payouts", label: "Payouts", icon: Bank, cap: "payouts.read", keywords: "bank account paystack subaccount online revenue commission settlement" },
      { href: "/folios", label: "Folios & invoices", icon: Wallet, feature: "invoicing", cap: "folio.read", keywords: "bills invoices receipts balances walk-in" },
      { href: "/approvals", label: "Approvals", icon: SealCheck, cap: "shift.approve", badge: "approvals", keywords: "approve shifts manager variance" },
      { href: "/guard", label: "Revenue Guard", icon: ShieldWarning, feature: "revenue_guard_basic", cap: "guard.read", badge: "flags", keywords: "flags leakage fraud alerts triage" },
      { href: "/reports", label: "Reports", icon: ChartBar, cap: "reports.read", keywords: "daily flash revenue occupancy adr revpar shifts digest night audit" },
      { href: "/group", label: "Group reports", icon: TreeStructure, feature: "multi_property", cap: "reports.read", keywords: "all properties consolidated compare group occupancy adr revpar" },
      { href: "/register", label: "Guest register", icon: BookOpenText, feature: "guest_register", cap: "frontdesk.checkin", keywords: "police register csv export security book" },
    ],
  },
  {
    label: "The house",
    items: [
      { href: "/staff", label: "Staff", icon: UsersThree, exact: true, cap: "staff.manage", keywords: "team people users pin", shortcut: "G S" },
      { href: "/staff/roles", label: "Roles & permissions", icon: ShieldCheck, cap: "staff.manage", keywords: "custom roles permissions access matrix night auditor clone" },
      { href: "/property", label: "Property", icon: Buildings, cap: "settings.manage", keywords: "settings details hotel branding amenities" },
      { href: "/properties", label: "Properties & access", icon: TreeStructure, cap: ["settings.manage", "properties.manage"], keywords: "multi property group add property staff access switch" },
      { href: "/settings/domain", label: "Custom domain", icon: Globe, feature: "custom_domain", cap: "settings.manage", keywords: "domain dns cname txt booking site own domain verify" },
      { href: "/settings/booking", label: "Online booking", icon: GlobeHemisphereWest, cap: "booking.settings", keywords: "booking site marketplace pay at hotel cancellation policy refund online" },
      { href: "/settings/taxes", label: "Taxes & charges", icon: Percent, cap: "tax.read", keywords: "vat consumption tax service charge discount threshold" },
      { href: "/settings/notifications", label: "Alerts & WhatsApp", icon: BellRinging, cap: "settings.manage", keywords: "notifications whatsapp templates quiet hours owner alerts digest" },
      { href: "/billing", label: "Billing & plan", icon: Receipt, cap: "billing.manage", keywords: "subscription upgrade invoices plan", shortcut: "G B" },
      { href: "/audit", label: "Audit log", icon: ClockCounterClockwise, cap: "audit.view", keywords: "history activity trail export csv json" },
    ],
  },
  {
    label: "Enterprise",
    items: [
      { href: "/developers", label: "API & webhooks", icon: Code, feature: "api_access", cap: "integrations.view", keywords: "api keys webhooks integrations developers partner api secret scopes events deliveries" },
      { href: "/settings/white-label", label: "White label", icon: Palette, feature: "white_label", cap: "whitelabel.manage", keywords: "brand kit logo favicon colours fonts email domain sender id sms staff portal powered by" },
      { href: "/settings/sso", label: "Single sign-on", icon: Fingerprint, feature: "sso", cap: "sso.manage", keywords: "sso oidc google workspace microsoft entra azure login saml identity provider" },
      { href: "/data-export", label: "Data export", icon: FileZip, feature: "data_export", cap: "data.export", keywords: "export download zip backup all data ndpa portability" },
    ],
  },
  {
    label: "Help",
    items: [{ href: "/support", label: "Support", icon: Lifebuoy, cap: "support.request", badge: "support", keywords: "help support ticket request contact devstrike problem bug question" }],
  },
];

export const MOBILE_TABS = ["/today", "/ledger", "/reservations", "/shifts"];

export function allNavItems() {
  return HOTEL_NAV.flatMap((g) => g.items);
}

/** Whether a role (through its capability check) should see a nav item. */
export function navVisible(item: NavItem, can: (c: Capability | Permission) => boolean, ready = true) {
  if (!ready) return !item.hideCap && !item.cap;
  const caps = item.cap === undefined ? [] : Array.isArray(item.cap) ? item.cap : [item.cap];
  return (!caps.length || caps.some(can)) && (!item.hideCap || !can(item.hideCap));
}

const EXACT = new Set(HOTEL_NAV.flatMap((g) => g.items).filter((i) => i.exact).map((i) => i.href));

export function isActive(pathname: string, href: string) {
  if (EXACT.has(href)) {
    if (pathname === href) return true;
    // a child path belongs to the exact item unless another nav item owns it
    const owned = HOTEL_NAV.some((g) => g.items.some((i) => i.href !== href && (pathname === i.href || pathname.startsWith(`${i.href}/`))));
    return !owned && pathname.startsWith(`${href}/`);
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}
