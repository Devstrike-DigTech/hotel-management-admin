/**
 * The permission catalogue in plain words. The API serves the catalogue too;
 * this is the fallback and the source of the descriptions the matrix shows.
 */

export interface PermissionInfo {
  code: string;
  label: string;
  description: string;
  /** Moves money or changes who can do what: called out in the diff preview. */
  sensitive?: boolean;
}

export interface PermissionGroup {
  key: string;
  label: string;
  items: PermissionInfo[];
}

const P = (code: string, label: string, description: string, sensitive?: boolean): PermissionInfo => ({ code, label, description, sensitive });

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    key: "reservations",
    label: "Reservations",
    items: [
      P("reservations.view", "See bookings", "The Ledger, the reservations list and each booking."),
      P("reservations.create", "Take bookings", "New reservations from the desk, the phone or walk-ins."),
      P("reservations.edit", "Change bookings", "Dates, rooms, guests and notes on a booking."),
      P("reservations.cancel", "Cancel bookings", "Cancel or mark a no-show.", true),
    ],
  },
  {
    key: "frontdesk",
    label: "Front desk",
    items: [
      P("frontdesk.checkin", "Check guests in", "The register card, ID capture, room assignment and the guest register."),
      P("frontdesk.checkout", "Check guests out", "Settle and close the stay, or send it to the City Ledger."),
      P("frontdesk.override", "Override the desk", "Check into a dirty room, check out owing, go over a company's credit limit.", true),
    ],
  },
  {
    key: "folio",
    label: "Folios",
    items: [
      P("folio.view", "See folios", "Charges, payments, balances, invoices and receipts."),
      P("folio.charge", "Post charges", "Add extras to a guest's bill."),
      P("folio.discount", "Give discounts", "Discounts above the threshold still need a second key.", true),
      P("folio.approve", "Be the second key", "Approve large discounts with a PIN.", true),
      P("folio.void", "Void charges", "Remove a charge from a bill.", true),
      P("folio.refund", "Refund money", "Give money back to a guest.", true),
    ],
  },
  {
    key: "payments",
    label: "Payments",
    items: [
      P("payments.take", "Take payments", "Cash, POS and transfer at the desk, and City Ledger payments."),
      P("payments.special", "Special payments", "Complimentary, card online or City Ledger by hand.", true),
    ],
  },
  {
    key: "shifts",
    label: "Shifts",
    items: [
      P("shifts.own", "Run a cashier shift", "Open a float and close with a blind count."),
      P("shifts.approve", "Approve shifts", "Sign off a closed shift and its variance.", true),
      P("shifts.view_all", "See every shift", "All cashiers' shifts and counts."),
    ],
  },
  {
    key: "guests",
    label: "Guests",
    items: [
      P("guests.view", "See guests", "Profiles and stay history."),
      P("guests.edit", "Edit guests", "Contact details and ID images."),
      P("guests.reveal_id", "Reveal ID numbers", "Show a guest's full ID number. Every reveal is audited.", true),
      P("guests.export", "Export guest data", "A guest's data, and the register with full ID numbers.", true),
      P("guests.anonymise", "Anonymise guests", "Erase a guest's personal data for good.", true),
    ],
  },
  {
    key: "rooms",
    label: "Rooms",
    items: [
      P("rooms.status", "Change room status", "Mark any room clean, dirty or out of order."),
      P("rooms.manage", "Set up rooms", "Add rooms and room types, change base prices."),
    ],
  },
  {
    key: "housekeeping",
    label: "Housekeeping",
    items: [
      P("housekeeping.view", "See housekeeping", "The board, today's tasks and lost and found."),
      P("housekeeping.work", "Clean rooms", "Start and finish their own rooms, tick checklists, log found items."),
      P("housekeeping.assign", "Assign rooms", "Hand out rooms, balance workloads, edit checklists."),
      P("housekeeping.inspect", "Inspect rooms", "Pass a cleaned room back on sale, or send it back."),
    ],
  },
  {
    key: "maintenance",
    label: "Maintenance",
    items: [
      P("maintenance.view", "See maintenance", "Tickets, schedules, room blocks and the diesel log."),
      P("maintenance.report", "Report a fault", "Open a ticket, with a photo."),
      P("maintenance.work", "Work tickets", "Update their own tickets and log diesel deliveries."),
      P("maintenance.manage", "Run maintenance", "Assign, block rooms, close tickets, plan servicing."),
    ],
  },
  {
    key: "rates",
    label: "Rates",
    items: [
      P("rates.view", "See rates", "The Rate Almanac, rate plans and promo codes."),
      P("rates.manage", "Set rates", "Seasons, fixed prices, restrictions, plans and custom booking rates.", true),
      P("promotions.manage", "Run promotions", "Create and pause promo codes.", true),
    ],
  },
  {
    key: "corporate",
    label: "Corporate",
    items: [
      P("corporate.view", "See companies", "Corporate accounts and the City Ledger."),
      P("corporate.manage", "Manage companies", "Credit limits, statements, reminders and voids.", true),
    ],
  },
  {
    key: "reports",
    label: "Reports",
    items: [
      P("reports.view", "See reports", "Occupancy, the daily flash, trends and the owner digest."),
      P("reports.financial", "See money reports", "Payments, shifts, payouts and commission."),
    ],
  },
  {
    key: "guard",
    label: "Revenue Guard",
    items: [
      P("guard.view", "See Revenue Guard", "Flags and their evidence."),
      P("guard.resolve", "Resolve flags", "Close or dismiss a flag, run a sweep.", true),
    ],
  },
  {
    key: "admin",
    label: "Running the hotel",
    items: [
      P("staff.manage", "Manage staff and roles", "Add staff, change roles, edit custom roles.", true),
      P("settings.manage", "Change settings", "Property, taxes, online booking, alerts and the night audit.", true),
      P("billing.manage", "Manage the plan", "Upgrade, pay and see the subscription.", true),
      P("payouts.manage", "Manage payouts", "The bank account online payments settle into.", true),
    ],
  },
  {
    key: "reviews",
    label: "Reviews",
    items: [
      P("reviews.view", "See reviews", "Ratings and what guests wrote."),
      P("reviews.reply", "Reply to reviews", "Answer guests in public, report abuse."),
    ],
  },
  {
    key: "audit",
    label: "Audit",
    items: [
      P("audit.view", "See the audit log", "Who did what, and when."),
      P("audit.export", "Export the audit log", "Download a date range as CSV or JSON.", true),
    ],
  },
  {
    key: "integrations",
    label: "Integrations",
    items: [
      P("integrations.view", "See API keys and webhooks", "Keys, endpoints and the delivery log."),
      P("integrations.manage", "Manage API keys and webhooks", "Create, rotate and revoke keys; add and replay webhooks.", true),
    ],
  },
  {
    key: "enterprise",
    label: "Enterprise",
    items: [
      P("whitelabel.manage", "Manage white label", "Brand kit, sending domain, SMS sender and staff portal."),
      P("sso.manage", "Manage single sign-on", "The identity provider and who may sign in with it.", true),
      P("data.export", "Export all hotel data", "A zip of every record, guests' ID numbers included.", true),
    ],
  },
  {
    key: "support",
    label: "Support",
    items: [
      P("support.request", "Contact support", "Open requests and reply to them."),
      P("support.view_all", "See every support request", "All of the hotel's requests, not only their own."),
      P("support.sessions.view", "See support sessions", "When our team viewed the hotel, as whom and why."),
    ],
  },
];

export const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.code));

const INFO = new Map(PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.code, i] as const)));
export const permissionInfo = (code: string): PermissionInfo =>
  INFO.get(code) ?? { code, label: code.replace(/[._]/g, " "), description: "" };

/** Merge a server catalogue into our groups (labels from the server win when given). */
export function mergeCatalog(server?: { code: string; group?: string; label?: string; description?: string; sensitive?: boolean }[] | null): PermissionGroup[] {
  if (!server?.length) return PERMISSION_GROUPS;
  const known = new Set(ALL_PERMISSIONS);
  const groups = PERMISSION_GROUPS.map((g) => ({
    ...g,
    items: g.items
      .filter((i) => server.some((s) => s.code === i.code))
      .map((i) => {
        const s = server.find((x) => x.code === i.code)!;
        return { ...i, label: i.label || s.label || i.code, description: i.description || s.description || "", sensitive: s.sensitive ?? i.sensitive };
      }),
  })).filter((g) => g.items.length);
  const extra = server.filter((s) => !known.has(s.code));
  if (extra.length)
    groups.push({
      key: "other",
      label: "Other",
      items: extra.map((s) => ({ code: s.code, label: s.label ?? s.code, description: s.description ?? "", sensitive: s.sensitive })),
    });
  return groups;
}
