/**
 * Static catalogues for the Enterprise pages: API key scopes grouped by
 * resource, webhook events, curated brand fonts, OIDC presets and the colour
 * contrast maths used by the brand kit. The API is the authority on every one
 * of these; the lists here label and group what it returns, and fill in when a
 * list is not loaded yet.
 */

export interface ScopeInfo {
  code: string;
  resource: string;
  access: "read" | "write" | "manage";
  label: string;
  description: string;
}

export interface ScopeGroup {
  resource: string;
  label: string;
  description: string;
  scopes: ScopeInfo[];
}

const S = (code: string, label: string, description: string): ScopeInfo => {
  const [resource, access] = code.split(":");
  return { code, resource, access: access as ScopeInfo["access"], label, description };
};

export const SCOPE_GROUPS: ScopeGroup[] = [
  {
    resource: "reservations",
    label: "Reservations",
    description: "Bookings and stays",
    scopes: [
      S("reservations:read", "Read", "List and open reservations, with stay dates, room and status."),
      S("reservations:write", "Write", "Create, change and cancel reservations. Every write needs an Idempotency-Key."),
    ],
  },
  {
    resource: "availability",
    label: "Availability",
    description: "Rooms free per type and night",
    scopes: [S("availability:read", "Read", "Rooms free per room type and night, with restrictions.")],
  },
  {
    resource: "rates",
    label: "Rates",
    description: "Prices per night and plan",
    scopes: [
      S("rates:read", "Read", "Resolved nightly prices, rate plans and overrides."),
      S("rates:write", "Write", "Set and clear nightly price overrides."),
    ],
  },
  {
    resource: "rooms",
    label: "Rooms",
    description: "Rooms, types and status",
    scopes: [
      S("rooms:read", "Read", "Room types, rooms and their housekeeping status."),
      S("rooms:write", "Write", "Change a room's status, for example from a door-lock or PMS bridge."),
    ],
  },
  {
    resource: "housekeeping",
    label: "Housekeeping",
    description: "Cleaning tasks",
    scopes: [
      S("housekeeping:read", "Read", "Today's cleaning tasks and who has them."),
      S("housekeeping:write", "Write", "Create tasks and mark them done."),
    ],
  },
  {
    resource: "guests",
    label: "Guests",
    description: "Guest profiles, limited",
    scopes: [S("guests:read", "Read", "Name, email, phone and stay count. ID numbers are never exposed.")],
  },
  {
    resource: "folios",
    label: "Folios",
    description: "Bills and payments",
    scopes: [S("folios:read", "Read", "Charges, payments and balances on a stay's folio.")],
  },
  {
    resource: "reports",
    label: "Reports",
    description: "Daily figures",
    scopes: [S("reports:read", "Read", "Daily occupancy, ADR, RevPAR and revenue.")],
  },
  {
    resource: "webhooks",
    label: "Webhooks",
    description: "Endpoints for events",
    scopes: [S("webhooks:manage", "Manage", "Add, change and remove webhook endpoints through the API.")],
  },
];

export const ALL_SCOPES = SCOPE_GROUPS.flatMap((g) => g.scopes);

export function scopeInfo(code: string): ScopeInfo {
  return ALL_SCOPES.find((s) => s.code === code) ?? S(code, code.split(":")[1] ?? code, "");
}

/** Group any list of scope codes (including ones this build does not know) by resource. */
export function groupScopes(codes: string[]): ScopeGroup[] {
  const known = SCOPE_GROUPS.map((g) => ({ ...g, scopes: g.scopes.filter((s) => codes.includes(s.code)) })).filter((g) => g.scopes.length);
  const extra = codes.filter((c) => !ALL_SCOPES.some((s) => s.code === c));
  const byRes = new Map<string, ScopeInfo[]>();
  for (const c of extra) {
    const info = scopeInfo(c);
    byRes.set(info.resource, [...(byRes.get(info.resource) ?? []), info]);
  }
  return [
    ...known,
    ...[...byRes.entries()].map(([resource, scopes]) => ({ resource, label: resource.charAt(0).toUpperCase() + resource.slice(1), description: "", scopes })),
  ];
}

/** Ready-made scope sets for the common integrations. */
export const SCOPE_PRESETS: { id: string; label: string; hint: string; scopes: string[] }[] = [
  { id: "channel", label: "Booking engine / channel", hint: "Reads availability and rates, writes reservations", scopes: ["availability:read", "rates:read", "reservations:read", "reservations:write"] },
  { id: "bi", label: "Reporting / BI", hint: "Read-only figures and bookings", scopes: ["reports:read", "reservations:read", "folios:read"] },
  { id: "locks", label: "Door locks / IoT", hint: "Rooms and their status", scopes: ["rooms:read", "rooms:write", "reservations:read"] },
  { id: "hk", label: "Housekeeping app", hint: "Tasks and room status", scopes: ["housekeeping:read", "housekeeping:write", "rooms:read", "rooms:write"] },
];

/* ---------- webhook events ---------- */

export interface EventInfo {
  code: string;
  label: string;
  group: string;
}

export const EVENT_GROUPS: { group: string; events: EventInfo[] }[] = [
  {
    group: "Reservations",
    events: [
      { code: "reservation.created", label: "Created", group: "Reservations" },
      { code: "reservation.updated", label: "Changed", group: "Reservations" },
      { code: "reservation.cancelled", label: "Cancelled", group: "Reservations" },
      { code: "reservation.checked_in", label: "Checked in", group: "Reservations" },
      { code: "reservation.checked_out", label: "Checked out", group: "Reservations" },
      { code: "reservation.no_show", label: "No-show", group: "Reservations" },
    ],
  },
  { group: "Money", events: [{ code: "payment.received", label: "Payment received", group: "Money" }] },
  {
    group: "The house",
    events: [
      { code: "room.status_changed", label: "Room status changed", group: "The house" },
      { code: "housekeeping.task_completed", label: "Housekeeping task done", group: "The house" },
    ],
  },
  {
    group: "Guests & control",
    events: [
      { code: "review.published", label: "Review published", group: "Guests & control" },
      { code: "guard.flag_raised", label: "Revenue Guard flag", group: "Guests & control" },
    ],
  },
];

export const ALL_EVENTS = EVENT_GROUPS.flatMap((g) => g.events);

export function groupEvents(codes: string[]): { group: string; events: EventInfo[] }[] {
  if (codes.includes("*")) return [{ group: "Every event", events: [{ code: "*", label: "All events, including new ones", group: "Every event" }] }];
  const known = EVENT_GROUPS.map((g) => ({ ...g, events: g.events.filter((e) => codes.includes(e.code)) })).filter((g) => g.events.length);
  const extra = codes.filter((c) => !ALL_EVENTS.some((e) => e.code === c) && c !== "*" && c !== "webhook.ping");
  if (extra.length) known.push({ group: "Other", events: extra.map((code) => ({ code, label: code, group: "Other" })) });
  return known;
}

/* ---------- brand fonts ---------- */

export interface BrandFont {
  family: string;
  category: "serif" | "sans" | "display";
  googleFontsUrl: string;
  note?: string;
}

const gf = (family: string, axes = "wght@400;500;700") => `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, "+")}:${axes}&display=swap`;

/** The API's curated list (GET /white-label/fonts); used until it loads. */
export const BRAND_FONTS: BrandFont[] = [
  { family: "Fraunces", category: "serif", googleFontsUrl: gf("Fraunces", "wght@400;600"), note: "Soft, warm serif" },
  { family: "Playfair Display", category: "serif", googleFontsUrl: gf("Playfair Display", "wght@400;700"), note: "High contrast, classic" },
  { family: "Cormorant Garamond", category: "serif", googleFontsUrl: gf("Cormorant Garamond", "wght@400;600"), note: "Refined, light" },
  { family: "DM Serif Display", category: "display", googleFontsUrl: gf("DM Serif Display", "wght@400"), note: "Bold, editorial" },
  { family: "Libre Baskerville", category: "serif", googleFontsUrl: gf("Libre Baskerville", "wght@400;700"), note: "Bookish, calm" },
  { family: "Lora", category: "serif", googleFontsUrl: gf("Lora"), note: "Serif for reading" },
  { family: "Marcellus", category: "display", googleFontsUrl: gf("Marcellus", "wght@400"), note: "Carved, Roman" },
  { family: "Schibsted Grotesk", category: "sans", googleFontsUrl: gf("Schibsted Grotesk"), note: "Plain, sturdy" },
  { family: "Work Sans", category: "sans", googleFontsUrl: gf("Work Sans"), note: "Friendly, open" },
  { family: "Manrope", category: "sans", googleFontsUrl: gf("Manrope"), note: "Modern, even" },
  { family: "Karla", category: "sans", googleFontsUrl: gf("Karla"), note: "Compact, quirky" },
  { family: "Figtree", category: "sans", googleFontsUrl: gf("Figtree"), note: "Round, clear" },
  { family: "Libre Franklin", category: "sans", googleFontsUrl: gf("Libre Franklin"), note: "Newspaper sans" },
  { family: "Source Sans 3", category: "sans", googleFontsUrl: gf("Source Sans 3"), note: "Neutral, legible" },
  { family: "IBM Plex Sans", category: "sans", googleFontsUrl: gf("IBM Plex Sans"), note: "Engineered, precise" },
  { family: "Space Grotesk", category: "sans", googleFontsUrl: gf("Space Grotesk"), note: "Geometric, bold" },
];

export function fontNote(family: string) {
  return BRAND_FONTS.find((f) => f.family === family)?.note ?? "";
}

/** Load a Google font for the live preview (idempotent). */
export function loadGoogleFont(family: string | null | undefined, url?: string | null) {
  if (typeof document === "undefined" || !family) return;
  const id = `gf-${family.replace(/\W+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;
  const href = url || BRAND_FONTS.find((f) => f.family === family)?.googleFontsUrl || gf(family);
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = href;
  document.head.appendChild(link);
}

/* ---------- colour contrast (WCAG 2.x) ---------- */

export function parseHex(hex: string): [number, number, number] | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function lum([r, g, b]: [number, number, number]) {
  const c = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}

export function contrastRatio(a: string, b: string): number | null {
  const x = parseHex(a);
  const y = parseHex(b);
  if (!x || !y) return null;
  const [l1, l2] = [lum(x), lum(y)].sort((p, q) => q - p);
  return (l1 + 0.05) / (l2 + 0.05);
}

export type ContrastGrade = "AAA" | "AA" | "AA large" | "Fail";

export function grade(ratio: number | null): ContrastGrade {
  if (ratio == null) return "Fail";
  if (ratio >= 7) return "AAA";
  if (ratio >= 4.5) return "AA";
  if (ratio >= 3) return "AA large";
  return "Fail";
}

/** Black or white text, whichever reads better on the colour. */
export function inkOn(hex: string): "#FFFFFF" | "#1B1A17" {
  const w = contrastRatio(hex, "#FFFFFF") ?? 0;
  const k = contrastRatio(hex, "#1B1A17") ?? 0;
  return w >= k ? "#FFFFFF" : "#1B1A17";
}

/* ---------- SSO presets ---------- */

export type SsoPresetId = "GOOGLE" | "MICROSOFT" | "OIDC";

export interface SsoPreset {
  id: SsoPresetId;
  name: string;
  issuerHint: string;
  /** a function so Entra can put the tenant id in */
  issuer: (tenant?: string) => string;
  consoleName: string;
  steps: string[];
}

export const SSO_PRESETS: SsoPreset[] = [
  {
    id: "GOOGLE",
    name: "Google Workspace",
    issuerHint: "https://accounts.google.com",
    issuer: () => "https://accounts.google.com",
    consoleName: "Google Cloud console",
    steps: [
      "In the Google Cloud console, open APIs & Services, then Credentials.",
      "Create an OAuth client ID of type Web application.",
      "Add the redirect URI below as an authorised redirect URI.",
      "Copy the client ID and client secret here.",
    ],
  },
  {
    id: "MICROSOFT",
    name: "Microsoft Entra ID",
    issuerHint: "https://login.microsoftonline.com/<tenant-id>/v2.0",
    issuer: (t) => `https://login.microsoftonline.com/${t || "<tenant-id>"}/v2.0`,
    consoleName: "Microsoft Entra admin centre",
    steps: [
      "In Entra ID, open App registrations and choose New registration.",
      "Set the redirect URI (Web) to the one below.",
      "Under Certificates & secrets, create a client secret.",
      "Copy the Directory (tenant) ID, the Application (client) ID and the secret here.",
    ],
  },
  {
    id: "OIDC",
    name: "Other OIDC provider",
    issuerHint: "https://idp.yourcompany.com",
    issuer: () => "",
    consoleName: "your identity provider",
    steps: [
      "Create a confidential OIDC client (authorization code flow with PKCE).",
      "Allow the redirect URI below and the scopes openid, email and profile.",
      "Paste the issuer URL: we read its /.well-known/openid-configuration.",
      "Copy the client ID and secret here.",
    ],
  },
];
