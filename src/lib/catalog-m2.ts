import type { Tone } from "./catalog";

/* Presentation metadata for the M2 enums (reservations, folios, payments,
   shifts, Revenue Guard). Values follow the M2 contract. */

export type ReservationStatus = "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";

export const STAY_STATUS: Record<
  ReservationStatus,
  { label: string; tone: Tone; color: string; wash: string; short: string }
> = {
  PENDING: { label: "Pending", tone: "neutral", color: "var(--brass)", wash: "var(--surface)", short: "PND" },
  CONFIRMED: { label: "Confirmed", tone: "brass", color: "var(--brass)", wash: "var(--brass-wash)", short: "CNF" },
  CHECKED_IN: { label: "In house", tone: "adire", color: "var(--adire)", wash: "var(--adire-wash)", short: "INH" },
  CHECKED_OUT: { label: "Checked out", tone: "neutral", color: "var(--ink-faint)", wash: "var(--surface-2)", short: "OUT" },
  CANCELLED: { label: "Cancelled", tone: "neutral", color: "var(--ink-faint)", wash: "var(--surface-2)", short: "CXL" },
  NO_SHOW: { label: "No-show", tone: "danger", color: "var(--danger)", wash: "var(--danger-wash)", short: "NSH" },
};

export const STAY_STATUS_ORDER: ReservationStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN", "CHECKED_OUT", "NO_SHOW", "CANCELLED"];

export type ReservationSource =
  | "WALK_IN"
  | "PHONE"
  | "WHATSAPP"
  | "MARKETPLACE"
  | "BOOKING_SITE"
  | "CORPORATE"
  | "OTA";

export const SOURCES: Record<ReservationSource, string> = {
  WALK_IN: "Walk-in",
  PHONE: "Phone",
  WHATSAPP: "WhatsApp",
  MARKETPLACE: "Marketplace",
  BOOKING_SITE: "Booking site",
  CORPORATE: "Corporate",
  OTA: "OTA",
};
export const SOURCE_ORDER: ReservationSource[] = ["WALK_IN", "PHONE", "WHATSAPP", "CORPORATE", "BOOKING_SITE", "MARKETPLACE", "OTA"];

export type IdType = "NIN" | "PASSPORT" | "DRIVERS_LICENSE" | "VOTERS_CARD" | "OTHER";
export const ID_TYPES: Record<IdType, string> = {
  NIN: "NIN slip / card",
  PASSPORT: "International passport",
  DRIVERS_LICENSE: "Driver's licence",
  VOTERS_CARD: "Voter's card",
  OTHER: "Other ID",
};
export const ID_TYPE_ORDER: IdType[] = ["NIN", "PASSPORT", "DRIVERS_LICENSE", "VOTERS_CARD", "OTHER"];

export type Purpose = "BUSINESS" | "LEISURE" | "EVENT" | "TRANSIT" | "OTHER";
export const PURPOSES: Record<Purpose, string> = {
  BUSINESS: "Business",
  LEISURE: "Leisure",
  EVENT: "Event",
  TRANSIT: "Transit",
  OTHER: "Other",
};
export const PURPOSE_ORDER: Purpose[] = ["BUSINESS", "LEISURE", "EVENT", "TRANSIT", "OTHER"];

export type PaymentMethod = "CASH" | "TRANSFER" | "POS" | "CARD_ONLINE" | "COMPLIMENTARY" | "CITY_LEDGER";
export const PAYMENT_METHODS: Record<PaymentMethod, { label: string; short: string; needsShift: boolean; color: string }> = {
  CASH: { label: "Cash", short: "Cash", needsShift: true, color: "var(--m-cash)" },
  TRANSFER: { label: "Bank transfer", short: "Transfer", needsShift: true, color: "var(--m-transfer)" },
  POS: { label: "POS terminal", short: "POS", needsShift: true, color: "var(--m-pos)" },
  CARD_ONLINE: { label: "Card online", short: "Card", needsShift: false, color: "var(--m-card)" },
  COMPLIMENTARY: { label: "Complimentary", short: "Comp", needsShift: false, color: "var(--m-comp)" },
  CITY_LEDGER: { label: "City ledger", short: "Ledger", needsShift: false, color: "var(--m-ledger)" },
};
export const DESK_METHODS: PaymentMethod[] = ["CASH", "TRANSFER", "POS"];
/** Fixed series order for charts (validated adjacency). */
export const METHOD_ORDER: PaymentMethod[] = ["CASH", "POS", "TRANSFER", "CARD_ONLINE", "CITY_LEDGER", "COMPLIMENTARY"];

export type FolioEntryType =
  | "ROOM"
  | "DAY_USE"
  | "EXTRA"
  | "TAX"
  | "SERVICE_CHARGE"
  | "DISCOUNT"
  | "PAYMENT"
  | "REFUND"
  | "VOID";

export const ENTRY_TYPES: Record<FolioEntryType, { label: string; code: string }> = {
  ROOM: { label: "Room", code: "RM" },
  DAY_USE: { label: "Day use", code: "DU" },
  EXTRA: { label: "Extra", code: "EX" },
  TAX: { label: "Tax", code: "TX" },
  SERVICE_CHARGE: { label: "Service charge", code: "SC" },
  DISCOUNT: { label: "Discount", code: "DS" },
  PAYMENT: { label: "Payment", code: "PY" },
  REFUND: { label: "Refund", code: "RF" },
  VOID: { label: "Void", code: "VD" },
};

export type Severity = "LOW" | "MEDIUM" | "HIGH";
export const SEVERITY: Record<Severity, { label: string; tone: Tone; color: string; rank: number }> = {
  HIGH: { label: "High", tone: "danger", color: "var(--danger)", rank: 3 },
  MEDIUM: { label: "Medium", tone: "ochre", color: "var(--ochre)", rank: 2 },
  LOW: { label: "Low", tone: "neutral", color: "var(--ink-muted)", rank: 1 },
};

export type FlagStatus = "OPEN" | "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED";
export const FLAG_STATUS: Record<FlagStatus, { label: string; tone: Tone }> = {
  OPEN: { label: "Open", tone: "laterite" },
  ACKNOWLEDGED: { label: "Acknowledged", tone: "brass" },
  RESOLVED: { label: "Resolved", tone: "palm" },
  DISMISSED: { label: "Dismissed", tone: "neutral" },
};

export type GuardRule =
  | "SHIFT_VARIANCE"
  | "VOIDED_PAYMENT"
  | "CHECKOUT_WITH_BALANCE"
  | "OCCUPIED_WITHOUT_STAY"
  | "DISCOUNT_OVER_THRESHOLD"
  | "DIRTY_OVERRIDE_CHECKIN"
  | "DAY_USE_OVERSTAY"
  | "LATE_REGISTRATION"
  | "REPEATED_VOIDS_BY_USER"
  | "ROOM_STATUS_FLIP";

export const GUARD_RULES: Record<GuardRule, { label: string; tier: "basic" | "full"; blurb: string }> = {
  SHIFT_VARIANCE: { label: "Shift variance", tier: "basic", blurb: "A cashier's count differs from expected by more than ₦500." },
  VOIDED_PAYMENT: { label: "Voided payment", tier: "basic", blurb: "A payment was reversed after it was taken." },
  CHECKOUT_WITH_BALANCE: { label: "Checked out owing", tier: "basic", blurb: "A guest left with an unpaid balance." },
  OCCUPIED_WITHOUT_STAY: { label: "Room sold off the books", tier: "full", blurb: "A room was used with no checked-in reservation." },
  DISCOUNT_OVER_THRESHOLD: { label: "Large discount", tier: "full", blurb: "A discount above your approval threshold." },
  DIRTY_OVERRIDE_CHECKIN: { label: "Dirty-room check-in", tier: "full", blurb: "A guest was checked into a room not marked clean." },
  DAY_USE_OVERSTAY: { label: "Day-use overstay", tier: "full", blurb: "A day-use guest stayed past departure plus 30 minutes." },
  LATE_REGISTRATION: { label: "Late registration", tier: "full", blurb: "Checked in without the register completed within an hour." },
  REPEATED_VOIDS_BY_USER: { label: "Repeated voids", tier: "full", blurb: "One user voided several entries in a short window." },
  ROOM_STATUS_FLIP: { label: "Status flip", tier: "full", blurb: "A room went from occupied to dirty without a check-out." },
};
export const GUARD_RULE_ORDER = Object.keys(GUARD_RULES) as GuardRule[];

export type ShiftStatus = "OPEN" | "CLOSED" | "APPROVED";
export const SHIFT_STATUS: Record<ShiftStatus, { label: string; tone: Tone }> = {
  OPEN: { label: "Open", tone: "palm" },
  CLOSED: { label: "Awaiting approval", tone: "brass" },
  APPROVED: { label: "Approved", tone: "neutral" },
};

/** Naira notes counted at the till, largest first. */
export const DENOMINATIONS = [1000, 500, 200, 100, 50] as const;
export type Denomination = (typeof DENOMINATIONS)[number];

/** Variance above this (kobo) raises a Revenue Guard flag. */
export const VARIANCE_TOLERANCE_KOBO = 500_00;
