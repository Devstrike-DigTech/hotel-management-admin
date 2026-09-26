import type { FeatureInfo, Plan, Role, RoomStatus, SubscriptionStatus } from "./api/types";

/* ---------------- Room status ---------------- */

export interface RoomStatusMeta {
  label: string;
  short: string;
  /** CSS color var used for the tag fill/border */
  color: string;
  wash: string;
  /** SVG pattern id rendered on the key tag so status is never colour-only */
  pattern: "solid" | "adire" | "dots" | "cross" | "ring";
  description: string;
  key: string; // keyboard shortcut in the sheet
}

export const ROOM_STATUS: Record<RoomStatus, RoomStatusMeta> = {
  VACANT_CLEAN: {
    label: "Vacant, clean",
    short: "CLN",
    color: "var(--palm)",
    wash: "var(--palm-wash)",
    pattern: "solid",
    description: "Ready to sell",
    key: "1",
  },
  OCCUPIED: {
    label: "Occupied",
    short: "OCC",
    color: "var(--adire)",
    wash: "var(--adire-wash)",
    pattern: "adire",
    description: "Guest in house",
    key: "2",
  },
  VACANT_DIRTY: {
    label: "Vacant, dirty",
    short: "DRT",
    color: "var(--ochre)",
    wash: "var(--ochre-wash)",
    pattern: "dots",
    description: "Needs housekeeping",
    key: "3",
  },
  RESERVED: {
    label: "Reserved",
    short: "RSV",
    color: "var(--brass)",
    wash: "var(--brass-wash)",
    pattern: "ring",
    description: "Held for an arrival",
    key: "4",
  },
  OUT_OF_ORDER: {
    label: "Out of order",
    short: "OOO",
    color: "var(--danger)",
    wash: "var(--danger-wash)",
    pattern: "cross",
    description: "Blocked for maintenance",
    key: "5",
  },
};

export const ROOM_STATUS_ORDER: RoomStatus[] = ["VACANT_CLEAN", "OCCUPIED", "VACANT_DIRTY", "RESERVED", "OUT_OF_ORDER"];

/* ---------------- Roles ---------------- */

export const ROLES: Record<Role, { label: string; description: string }> = {
  OWNER: { label: "Owner", description: "Full control, billing and staff" },
  MANAGER: { label: "Manager", description: "Runs operations and staff" },
  FRONT_DESK: { label: "Front desk", description: "Check-ins, rooms, guests" },
  HOUSEKEEPING: { label: "Housekeeping", description: "Room status and tasks" },
  ACCOUNTANT: { label: "Accountant", description: "Invoices and reports" },
  SUPERVISOR: { label: "Supervisor", description: "Assigns and inspects housekeeping" },
  MAINTENANCE: { label: "Technician", description: "Maintenance tickets and the diesel log" },
  WAITER: { label: "Waiter / cashier", description: "Takes orders and settles bills at the outlets" },
  KITCHEN: { label: "Kitchen / bar", description: "Works the kitchen display" },
  CONCIERGE: { label: "Concierge", description: "Guest requests, services and vendors, private requests included" },
  CUSTOM: { label: "Custom role", description: "Permissions chosen by the hotel" },
};
export const ROLE_ORDER: Role[] = ["OWNER", "MANAGER", "FRONT_DESK", "HOUSEKEEPING", "SUPERVISOR", "MAINTENANCE", "WAITER", "KITCHEN", "CONCIERGE", "ACCOUNTANT"];

/** The display name for a user's role, custom roles included. */
export function roleLabel(u: { role: Role; roleName?: string | null } | null | undefined): string {
  if (!u) return "";
  return u.roleName || ROLES[u.role]?.label || u.role;
}

/* ---------------- Subscription status ---------------- */

export const SUB_STATUS: Record<SubscriptionStatus, { label: string; tone: Tone }> = {
  TRIALING: { label: "Trial", tone: "brass" },
  ACTIVE: { label: "Active", tone: "palm" },
  PAST_DUE: { label: "Past due", tone: "ochre" },
  READ_ONLY: { label: "Read-only", tone: "danger" },
  SUSPENDED: { label: "Suspended", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export type Tone = "neutral" | "laterite" | "brass" | "palm" | "adire" | "ochre" | "danger";

/* ---------------- Plans + features (fallbacks; the API is the source of truth) ---------------- */

const PLAN_ORDER = ["starter", "growth", "pro", "enterprise"];

/** Plan identity colours, used in the plan comparison. */
export const PLAN_TONE: Record<string, string> = {
  starter: "var(--plan-starter)",
  growth: "var(--plan-growth)",
  pro: "var(--plan-pro)",
  enterprise: "var(--plan-enterprise)",
};

const STARTER = [
  "brand_kit",
  "front_desk",
  "reservations",
  "guest_register",
  "invoicing",
  "hourly_bookings",
  "offline_mode",
  "marketplace_listing",
  "revenue_guard_basic",
];
const GROWTH = [
  "booking_site_branding",
  "site_templates_all",
  "site_sections",
  "form_fields_unlimited",
  "form_conditional_logic",
  "paid_extras",
  "revenue_guard_full",
  "owner_whatsapp_alerts",
  "housekeeping",
  "maintenance",
  "custom_roles",
  "promotions",
  "sms_messaging",
];
const PRO = [
  "site_fonts",
  "form_file_uploads",
  "custom_domain",
  "pos",
  "channel_manager",
  "dynamic_pricing",
  "whatsapp_messaging",
  "loyalty",
  "multi_property",
  "audit_export",
];
const ENTERPRISE = ["white_label", "api_access", "dedicated_database", "sso", "data_export"];

export const FALLBACK_PLAN_FEATURES: Record<string, string[]> = {
  starter: STARTER,
  growth: [...STARTER, ...GROWTH],
  pro: [...STARTER, ...GROWTH, ...PRO],
  enterprise: [...STARTER, ...GROWTH, ...PRO, ...ENTERPRISE],
};

export const PLAN_NAMES: Record<string, string> = {
  starter: "Starter",
  growth: "Growth",
  pro: "Pro",
  enterprise: "Enterprise",
};

/** Cheapest plan (by sortOrder) that includes a feature. */
export function minimumPlanFor(feature: string, plans?: Plan[]): { code: string; name: string } {
  if (plans?.length) {
    const p = [...plans].sort((a, b) => a.sortOrder - b.sortOrder).find((pl) => pl.features.includes(feature));
    if (p) return { code: p.code, name: p.name };
  }
  for (const code of PLAN_ORDER) {
    if (FALLBACK_PLAN_FEATURES[code].includes(feature)) return { code, name: PLAN_NAMES[code] };
  }
  return { code: "enterprise", name: "Enterprise" };
}

export const FALLBACK_FEATURES: FeatureInfo[] = [
  { code: "front_desk", name: "Front desk", description: "Check-ins, check-outs and the live room board.", category: "Operations" },
  { code: "reservations", name: "Reservations", description: "Take and manage bookings across dates.", category: "Operations" },
  { code: "guest_register", name: "Guest register", description: "A digital guest book that satisfies inspectors.", category: "Guests" },
  { code: "invoicing", name: "Invoicing", description: "Folios and receipts in naira.", category: "Revenue" },
  { code: "hourly_bookings", name: "Hourly bookings", description: "Sell short stays by the hour.", category: "Revenue" },
  { code: "offline_mode", name: "Offline mode", description: "Keep the desk running when NEPA or the network drops.", category: "Operations" },
  { code: "marketplace_listing", name: "Marketplace listing", description: "Be discovered by guests on the marketplace.", category: "Growth" },
  { code: "booking_site_branding", name: "Booking site branding", description: "Your colours and logo on your booking site.", category: "Growth" },
  { code: "custom_domain", name: "Custom domain", description: "Serve your booking site from your own domain.", category: "Growth" },
  { code: "white_label", name: "White label", description: "Remove all platform branding.", category: "Platform" },
  { code: "revenue_guard_basic", name: "Revenue guard (basic)", description: "Flags voided payments and odd discounts.", category: "Revenue" },
  { code: "revenue_guard_full", name: "Revenue guard (full)", description: "Night audit reconciliation and staff leakage alerts.", category: "Revenue" },
  { code: "owner_whatsapp_alerts", name: "Owner WhatsApp alerts", description: "Daily takings and red flags on the owner's phone.", category: "Revenue" },
  { code: "housekeeping", name: "Housekeeping", description: "Assign, track and inspect room cleaning.", category: "Operations" },
  { code: "maintenance", name: "Maintenance", description: "Log faults, block rooms, track fixes.", category: "Operations" },
  { code: "custom_roles", name: "Custom roles", description: "Fine-grained staff permissions.", category: "Platform" },
  { code: "audit_export", name: "Audit export", description: "Export the full audit trail.", category: "Platform" },
  { code: "promotions", name: "Promotions", description: "Discount codes and seasonal offers.", category: "Growth" },
  { code: "pos", name: "Point of sale", description: "Bar, restaurant and laundry charges posted to the room.", category: "Revenue" },
  { code: "channel_manager", name: "Channel manager", description: "Sync rates and availability with OTAs.", category: "Growth" },
  { code: "dynamic_pricing", name: "Dynamic pricing", description: "Rates that follow demand, events and seasons.", category: "Revenue" },
  { code: "whatsapp_messaging", name: "WhatsApp messaging", description: "Confirmations and reminders on WhatsApp.", category: "Guests" },
  { code: "sms_messaging", name: "SMS messaging", description: "Booking confirmations by SMS.", category: "Guests" },
  { code: "loyalty", name: "Loyalty", description: "Reward returning guests with points and perks.", category: "Guests" },
  { code: "multi_property", name: "Multi-property", description: "Run several hotels from one account.", category: "Platform" },
  { code: "api_access", name: "API access", description: "Integrate with your own systems.", category: "Platform" },
  { code: "dedicated_database", name: "Dedicated database", description: "Your data in an isolated database.", category: "Platform" },
  { code: "sso", name: "Single sign-on", description: "Staff sign in with Google Workspace or Microsoft.", category: "Platform" },
  { code: "data_export", name: "Full data export", description: "Every record in one zip, on demand.", category: "Platform" },
  { code: "brand_kit", name: "Brand kit", description: "Logo, favicon and colours on your booking site.", category: "Growth" },
  { code: "site_templates_all", name: "All site templates", description: "Boutique, Business, Resort and Heritage layouts.", category: "Growth" },
  { code: "site_sections", name: "Section editor", description: "Reorder and switch booking-site sections; light or dark.", category: "Growth" },
  { code: "site_fonts", name: "Font pairings", description: "Choose the type on your booking site.", category: "Growth" },
  { code: "form_fields_unlimited", name: "Unlimited form fields", description: "Ask guests as many questions as you need.", category: "Guests" },
  { code: "form_conditional_logic", name: "Conditional questions", description: "Show a question only after a certain answer.", category: "Guests" },
  { code: "paid_extras", name: "Paid extras and pickups", description: "Sell breakfast, late check-out and arrival pickups.", category: "Revenue" },
  { code: "form_file_uploads", name: "File uploads", description: "Let guests attach a letter or a photo.", category: "Guests" },
];

export function featureName(code: string, features?: FeatureInfo[]): string {
  return (
    features?.find((f) => f.code === code)?.name ??
    FALLBACK_FEATURES.find((f) => f.code === code)?.name ??
    code.replace(/_/g, " ")
  );
}

export const LIMIT_LABEL: Record<string, { label: string; noun: string }> = {
  max_rooms: { label: "Rooms", noun: "room" },
  max_staff: { label: "Staff seats", noun: "staff seat" },
  max_properties: { label: "Properties", noun: "property" },
  max_custom_form_fields: { label: "Extra form fields", noun: "extra form field" },
};

export const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta",
  "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi",
  "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara",
];
