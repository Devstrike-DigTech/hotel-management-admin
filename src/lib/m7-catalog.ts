/**
 * Static catalogues for Milestone 7: booking-site templates and sections, font
 * pairings, the booking-form field library and presets, paid extras, pickup
 * points and transfers. The API holds the registry and is the authority; these
 * lists label what it returns, fill in while it loads, and drive the plan-locked
 * previews.
 */

import { contrastRatio, parseHex } from "./m6-catalog";

/* =========================================================================
 * Templates
 * ========================================================================= */

export type TemplateId = "editorial" | "boutique" | "business" | "resort" | "heritage" | "essentials";

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  description: string;
  bestFor: string;
  /** included on Starter (the rest need `site_templates_all`) */
  starter: boolean;
  defaultFontPairing: string;
  defaultSections: string[];
  /** a few words for the gallery card */
  traits: string[];
}

export const TEMPLATES: TemplateMeta[] = [
  {
    id: "editorial",
    name: "Editorial",
    description: "A magazine spread: a big serif headline, long reading lines and pictures set like photographs in print.",
    bestFor: "City hotels with a story to tell",
    starter: true,
    defaultFontPairing: "fraunces-schibsted",
    defaultSections: ["hero", "highlights", "rooms", "amenities", "gallery", "reviews", "location-map", "policies", "contact"],
    traits: ["Big serif", "Long reads", "Calm"],
  },
  {
    id: "boutique",
    name: "Boutique",
    description: "Image first. A full-bleed hero, very few words and generous white space between everything.",
    bestFor: "Design-led small hotels",
    starter: false,
    defaultFontPairing: "cormorant-manrope",
    defaultSections: ["hero", "gallery", "rooms", "experiences", "reviews", "getting-here", "contact"],
    traits: ["Full-bleed", "Quiet", "Photographic"],
  },
  {
    id: "business",
    name: "Business",
    description: "Availability and rates above the fold, dense and efficient, with the corporate rate and meeting rooms up front.",
    bestFor: "Business travellers and conferences",
    starter: false,
    defaultFontPairing: "bricolage-instrument",
    defaultSections: ["hero", "rates-calendar", "rooms", "meetings", "amenities", "location-map", "getting-here", "policies", "contact"],
    traits: ["Rates first", "Dense", "Corporate"],
  },
  {
    id: "resort",
    name: "Resort",
    description: "Immersive: a gallery you walk through, then the experiences, dining and pool. Softer, rounder shapes.",
    bestFor: "Resorts, beach and leisure",
    starter: false,
    defaultFontPairing: "playfair-worksans",
    defaultSections: ["hero", "gallery", "experiences", "dining", "rooms", "reviews", "getting-here", "faq", "contact"],
    traits: ["Immersive", "Soft", "Leisure"],
  },
  {
    id: "heritage",
    name: "Heritage",
    description: "Formal, classic typography with ornamental rules and a crest-like logo lockup.",
    bestFor: "Grand and historic houses",
    starter: false,
    defaultFontPairing: "marcellus-karla",
    defaultSections: ["hero", "highlights", "rooms", "dining", "gallery", "reviews", "policies", "contact"],
    traits: ["Formal", "Ornamental", "Crest"],
  },
  {
    id: "essentials",
    name: "Essentials",
    description: "Ultra-light and text-first: no heavy pictures above the fold, tiny scripts, quick on 3G and small Android phones.",
    bestFor: "Guesthouses and patchy networks",
    starter: true,
    defaultFontPairing: "system-stack",
    defaultSections: ["hero", "rooms", "amenities", "getting-here", "policies", "faq", "contact"],
    traits: ["Under 120 KB", "Text first", "Fast"],
  },
];

export function templateMeta(id: string | null | undefined): TemplateMeta {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0];
}

/* =========================================================================
 * Sections
 * ========================================================================= */

export type SectionOptionField =
  | { key: string; label: string; kind: "text"; placeholder?: string; max?: number }
  | { key: string; label: string; kind: "textarea"; placeholder?: string; max?: number }
  | { key: string; label: string; kind: "toggle"; hint?: string; defaultOn?: boolean }
  | { key: string; label: string; kind: "select"; choices: { value: string; label: string }[] }
  | { key: string; label: string; kind: "number"; min?: number; max?: number }
  | { key: string; label: string; kind: "items"; max: number; noun: string; itemFields: { key: string; label: string; max: number; multiline?: boolean; placeholder?: string }[] };

export interface SectionMeta {
  key: string;
  name: string;
  description: string;
  /** name of a Phosphor icon, resolved in the studio */
  icon: string;
  options: SectionOptionField[];
  /** cannot be switched off */
  fixed?: boolean;
}

const ITEMS = (max: number, noun: string): SectionOptionField => ({
  key: "items",
  label: noun === "highlight" ? "Highlights" : "What to show",
  kind: "items",
  max,
  noun,
  itemFields: [
    { key: "title", label: "Title", max: noun === "highlight" ? 40 : 60, placeholder: noun === "highlight" ? "Power all night" : "Sunday jazz brunch" },
    { key: "text", label: "Text", max: noun === "highlight" ? 140 : 300, multiline: true },
  ],
});
const TITLE_INTRO: SectionOptionField[] = [
  { key: "title", label: "Title", kind: "text", max: 60 },
  { key: "intro", label: "Introduction", kind: "textarea", max: 400 },
];

/** The catalogue, with the option fields the API validates (API-M7 1.1). */
export const SECTIONS: SectionMeta[] = [
  {
    key: "hero",
    name: "Hero",
    description: "The first screen: name, a line and the booking bar.",
    icon: "Flag",
    fixed: true,
    options: [
      { key: "headline", label: "Headline", kind: "text", placeholder: "Stay where the city slows down", max: 80 },
      { key: "subheadline", label: "Line under it", kind: "text", placeholder: "Twelve rooms off Admiralty Way, five minutes from the beach", max: 160 },
      { key: "ctaLabel", label: "Button", kind: "text", placeholder: "Book a room", max: 24 },
    ],
  },
  { key: "highlights", name: "Highlights", description: "Short reasons to stay, up to six.", icon: "Star", options: [ITEMS(6, "highlight")] },
  {
    key: "rooms",
    name: "Rooms",
    description: "Every room type with its from price.",
    icon: "Bed",
    fixed: true,
    options: [
      { key: "layout", label: "Layout", kind: "select", choices: [{ value: "GRID", label: "Cards" }, { value: "LIST", label: "List" }] },
      { key: "showRates", label: "Show from prices", kind: "toggle", defaultOn: true },
    ],
  },
  { key: "rates-calendar", name: "Rates calendar", description: "Prices and availability by night.", icon: "CalendarDots", options: [{ key: "months", label: "Months shown", kind: "select", choices: [{ value: "1", label: "One month" }, { value: "2", label: "Two months" }] }] },
  { key: "amenities", name: "Amenities", description: "Wi-Fi, power, parking and the rest, from your property.", icon: "Plug", options: [] },
  { key: "gallery", name: "Gallery", description: "The hotel's photographs.", icon: "Images", options: [{ key: "layout", label: "Layout", kind: "select", choices: [{ value: "MOSAIC", label: "Mosaic" }, { value: "GRID", label: "Grid" }, { value: "CAROUSEL", label: "Carousel" }] }] },
  { key: "experiences", name: "Experiences", description: "Things to do, in and around the hotel.", icon: "Compass", options: [...TITLE_INTRO, ITEMS(8, "experience")] },
  { key: "dining", name: "Dining", description: "The restaurant, the bar, room service hours.", icon: "ForkKnife", options: [...TITLE_INTRO, ITEMS(8, "place")] },
  { key: "meetings", name: "Meetings", description: "Meeting rooms, capacity and business amenities.", icon: "Presentation", options: [...TITLE_INTRO, ITEMS(8, "room")] },
  { key: "reviews", name: "Reviews", description: "Verified guest reviews with the rating.", icon: "ChatsTeardrop", options: [{ key: "limit", label: "Reviews shown", kind: "number", min: 3, max: 12 }] },
  {
    key: "location-map",
    name: "Location",
    description: "A static map image or a directions link, no heavy map.",
    icon: "MapTrifold",
    options: [
      { key: "mode", label: "Show", kind: "select", choices: [{ value: "STATIC_IMAGE", label: "A map picture" }, { value: "LINK", label: "Just a directions link" }] },
      { key: "note", label: "Directions note", kind: "text", max: 200, placeholder: "Opposite the Chevron roundabout, second gate on the left" },
    ],
  },
  { key: "getting-here", name: "Getting here", description: "Your pickup points: \u201cWe pick up from Jibowu Motor Park\u2026\u201d", icon: "Signpost", options: [{ key: "intro", label: "Introduction", kind: "textarea", max: 300, placeholder: "Coming by road? Tell us your bus company and we'll meet you at the park." }] },
  { key: "policies", name: "Policies", description: "Check-in, check-out, cancellation and house rules.", icon: "Scroll", options: [] },
  {
    key: "faq",
    name: "Questions",
    description: "Your own questions and answers.",
    icon: "Question",
    options: [{ key: "items", label: "Questions", kind: "items", max: 20, noun: "question", itemFields: [{ key: "question", label: "Question", max: 160, placeholder: "Is there parking?" }, { key: "answer", label: "Answer", max: 1000, multiline: true, placeholder: "Yes, for eight cars inside the gate, free for guests." }] }],
  },
  {
    key: "contact",
    name: "Contact",
    description: "Phone, WhatsApp, email and address.",
    icon: "Phone",
    fixed: true,
    options: [
      { key: "showPhone", label: "Phone number", kind: "toggle", defaultOn: true },
      { key: "showWhatsApp", label: "WhatsApp button", kind: "toggle", defaultOn: true },
      { key: "showEmail", label: "Email address", kind: "toggle", defaultOn: true },
    ],
  },
  {
    key: "custom-text",
    name: "Text block",
    description: "A heading and a few paragraphs of your own.",
    icon: "TextAlignLeft",
    options: [
      { key: "title", label: "Heading", kind: "text", max: 80 },
      { key: "body", label: "Text", kind: "textarea", max: 3000 },
    ],
  },
];

export function sectionMeta(key: string): SectionMeta {
  return SECTIONS.find((s) => s.key === key) ?? { key, name: key, description: "", icon: "Rows", options: [] };
}

/* =========================================================================
 * Font pairings
 * ========================================================================= */

export interface FontPairing {
  id: string;
  name: string;
  heading: string;
  body: string;
  note: string;
  headingCategory: "serif" | "sans" | "display";
}

export const FONT_PAIRINGS: FontPairing[] = [
  { id: "fraunces-schibsted", name: "Fraunces + Schibsted Grotesk", heading: "Fraunces", body: "Schibsted Grotesk", note: "The house pairing: warm serif, sturdy sans", headingCategory: "serif" },
  { id: "cormorant-manrope", name: "Cormorant Garamond + Manrope", heading: "Cormorant Garamond", body: "Manrope", note: "Light and refined, for image-led pages", headingCategory: "serif" },
  { id: "bricolage-instrument", name: "Bricolage Grotesque + Instrument Sans", heading: "Bricolage Grotesque", body: "Instrument Sans", note: "Characterful sans, modern and efficient", headingCategory: "sans" },
  { id: "playfair-worksans", name: "Playfair Display + Work Sans", heading: "Playfair Display", body: "Work Sans", note: "High-contrast classic with a friendly sans", headingCategory: "serif" },
  { id: "marcellus-karla", name: "Marcellus + Karla", heading: "Marcellus", body: "Karla", note: "Carved Roman capitals, compact text", headingCategory: "display" },
  { id: "system-stack", name: "System fonts", heading: "system-ui", body: "system-ui", note: "No download at all: the phone's own fonts, fastest", headingCategory: "sans" },
  { id: "dmserif-dmsans", name: "DM Serif Display + DM Sans", heading: "DM Serif Display", body: "DM Sans", note: "Bold editorial headlines, neutral text", headingCategory: "display" },
  { id: "youngserif-figtree", name: "Young Serif + Figtree", heading: "Young Serif", body: "Figtree", note: "Round and relaxed, for leisure", headingCategory: "serif" },
  { id: "spacegrotesk-plexsans", name: "Space Grotesk + IBM Plex Sans", heading: "Space Grotesk", body: "IBM Plex Sans", note: "Engineered and precise", headingCategory: "sans" },
  { id: "baskerville-sourcesans", name: "Libre Baskerville + Source Sans 3", heading: "Libre Baskerville", body: "Source Sans 3", note: "Bookish serif over a plain sans", headingCategory: "serif" },
];

export function pairingMeta(id: string | null | undefined): FontPairing {
  return FONT_PAIRINGS.find((p) => p.id === id) ?? FONT_PAIRINGS[0];
}

/** Single-weight display faces are requested without an axis list. */
const SINGLE_WEIGHT = new Set(["Young Serif", "Marcellus", "DM Serif Display"]);

export function googleFontUrl(family: string) {
  const fam = family.replace(/ /g, "+");
  return SINGLE_WEIGHT.has(family)
    ? `https://fonts.googleapis.com/css2?family=${fam}&display=swap`
    : `https://fonts.googleapis.com/css2?family=${fam}:wght@400;500;600&display=swap`;
}

/* =========================================================================
 * Colour: suggested swatches and accessible variants
 * ========================================================================= */

export const SWATCHES: { name: string; hex: string }[] = [
  { name: "Laterite", hex: "#B4452A" },
  { name: "Adire indigo", hex: "#22324F" },
  { name: "Palm", hex: "#2F5A43" },
  { name: "Brass", hex: "#B98A2E" },
  { name: "Kola", hex: "#7A2E3A" },
  { name: "Lagoon", hex: "#1F6F78" },
  { name: "Camwood", hex: "#9C4A2F" },
  { name: "Ebony", hex: "#2A2622" },
  { name: "Harmattan", hex: "#C9A66B" },
  { name: "Aso-oke", hex: "#5B3F8C" },
];

function toHex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b].map((n) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

/** Mix a colour toward black (t<0) or white (t>0). */
function shade(hex: string, t: number) {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const target = t < 0 ? 0 : 255;
  const k = Math.abs(t);
  return toHex(rgb.map((v) => v + (target - v) * k) as [number, number, number]);
}

/**
 * The nearest shade of `hex` that reaches `target` contrast against `bg`,
 * darkening on light backgrounds and lightening on dark ones. This mirrors
 * the server's "applied" variant so the studio can show it before saving.
 */
export function accessibleVariant(hex: string, bg: string, target = 4.5): string {
  if (!parseHex(hex)) return hex;
  if ((contrastRatio(hex, bg) ?? 0) >= target) return hex.toUpperCase();
  const bgLight = (contrastRatio(bg, "#000000") ?? 0) > (contrastRatio(bg, "#FFFFFF") ?? 0);
  for (let i = 1; i <= 40; i++) {
    const c = shade(hex, (bgLight ? -1 : 1) * i * 0.025);
    if ((contrastRatio(c, bg) ?? 0) >= target) return c;
  }
  return bgLight ? "#000000" : "#FFFFFF";
}

/** Surfaces the booking site paints on, per colour mode. */
export const SITE_SURFACES = { light: "#FBF8F2", dark: "#1C1915" } as const;

/* =========================================================================
 * Booking form
 * ========================================================================= */

export type Channel = "MARKETPLACE" | "BOOKING_SITE" | "FRONT_DESK";
export const CHANNELS: { value: Channel; label: string; short: string; hint: string }[] = [
  { value: "MARKETPLACE", label: "Marketplace", short: "MKT", hint: "Guests booking on the marketplace" },
  { value: "BOOKING_SITE", label: "Booking site", short: "SITE", hint: "Guests on your own booking site" },
  { value: "FRONT_DESK", label: "Front desk", short: "DESK", hint: "Staff taking a booking in the admin" },
];

export type FieldType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "NUMBER"
  | "DATE"
  | "TIME"
  | "SELECT"
  | "MULTI_SELECT"
  | "YES_NO"
  | "CHECKBOX"
  | "PHONE"
  | "EMAIL"
  | "FILE"
  | "EXTRA"
  | "PICKUP";

export interface FieldTypeMeta {
  type: FieldType;
  label: string;
  hint: string;
  icon: string;
  /** feature needed to add one */
  feature?: string;
  hasOptions?: boolean;
}

export const FIELD_TYPES: FieldTypeMeta[] = [
  { type: "SHORT_TEXT", label: "Short answer", hint: "One line of text", icon: "TextT" },
  { type: "LONG_TEXT", label: "Paragraph", hint: "A few sentences", icon: "TextAlignLeft" },
  { type: "SELECT", label: "Choose one", hint: "A list, pick one", icon: "RadioButton", hasOptions: true },
  { type: "MULTI_SELECT", label: "Choose several", hint: "A list, pick any", icon: "ListChecks", hasOptions: true },
  { type: "YES_NO", label: "Yes or no", hint: "Two buttons", icon: "ToggleLeft" },
  { type: "CHECKBOX", label: "Tick box", hint: "A single agreement", icon: "CheckSquare" },
  { type: "NUMBER", label: "Number", hint: "Counts and ages", icon: "Hash" },
  { type: "DATE", label: "Date", hint: "A day on the calendar", icon: "CalendarBlank" },
  { type: "TIME", label: "Time", hint: "Hours and minutes", icon: "Clock" },
  { type: "PHONE", label: "Phone", hint: "+234 by default", icon: "Phone" },
  { type: "EMAIL", label: "Email", hint: "Checked for shape", icon: "At" },
  { type: "FILE", label: "File upload", hint: "A letter, a photo", icon: "Paperclip", feature: "form_file_uploads" },
  { type: "EXTRA", label: "Paid extras", hint: "Breakfast, late check-out", icon: "ShoppingBag", feature: "paid_extras" },
  { type: "PICKUP", label: "Pickup and drop-off", hint: "Airport, motor park, train, jetty", icon: "Van", feature: "paid_extras" },
];

export function fieldTypeMeta(t: string): FieldTypeMeta {
  return FIELD_TYPES.find((f) => f.type === t) ?? FIELD_TYPES[0];
}

export const FORM_SECTIONS = ["About you", "Your stay", "Getting here", "Extras", "Before you arrive"] as const;

export type Requirement = "REQUIRED" | "OPTIONAL" | "HIDDEN";
export type ConditionOp = "EQUALS" | "NOT_EQUALS" | "IN" | "IS_TRUE" | "IS_FALSE" | "NOT_EMPTY";

export interface LibraryField {
  libraryKey: string;
  label: string;
  type: FieldType;
  section: string;
  helpText?: string;
  options?: { value: string; label: string }[];
  purpose: string;
  sensitive?: boolean;
  icon: string;
  feature?: string;
  /** the register-card field it fills at check-in */
  registerMap?: string;
}

const opt = (...labels: string[]) => labels.map((l) => ({ value: l.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), label: l }));

export const LIBRARY: LibraryField[] = [
  { libraryKey: "nationality", label: "Nationality", type: "SELECT", section: "About you", icon: "Globe", options: opt("Nigerian", "Ghanaian", "Beninese", "Cameroonian", "British", "American", "Other"), purpose: "The guest register asks for it", registerMap: "nationality" },
  { libraryKey: "purposeOfVisit", label: "Purpose of visit", type: "SELECT", section: "Your stay", icon: "Suitcase", options: opt("Business", "Leisure", "Wedding or event", "Visiting family", "Medical", "Other"), purpose: "The guest register asks for it; helps us plan", registerMap: "purposeOfVisit" },
  { libraryKey: "childrenAges", label: "Children's ages", type: "SHORT_TEXT", section: "Your stay", icon: "Baby", helpText: "So we can set up a cot or an extra bed", purpose: "Cots, extra beds and meals" },
  { libraryKey: "dateOfBirth", label: "Date of birth", type: "DATE", section: "About you", icon: "Cake", purpose: "Birthday surprises and the register", sensitive: true, registerMap: "dateOfBirth" },
  { libraryKey: "homeAddress", label: "Home address", type: "LONG_TEXT", section: "About you", icon: "House", purpose: "The guest register asks for it", sensitive: true, registerMap: "address" },
  { libraryKey: "nextOfKin", label: "Emergency contact", type: "SHORT_TEXT", section: "About you", icon: "FirstAid", helpText: "Name, phone and how you know them", purpose: "Who to call if something happens during the stay", sensitive: true, registerMap: "nextOfKin" },
  { libraryKey: "vehiclePlate", label: "Vehicle plate number", type: "SHORT_TEXT", section: "Getting here", icon: "CarProfile", purpose: "Parking and gate security", registerMap: "vehiclePlate" },
  { libraryKey: "bedPreference", label: "Bed preference", type: "SELECT", section: "Your stay", icon: "Bed", options: opt("One big bed", "Two separate beds", "No preference"), purpose: "Setting the room up before arrival" },
  { libraryKey: "dietary", label: "Dietary requirements", type: "MULTI_SELECT", section: "Your stay", icon: "BowlFood", options: opt("Vegetarian", "Halal", "No pork", "No seafood", "Nut allergy", "Diabetic"), purpose: "The kitchen plans breakfast", sensitive: true },
  { libraryKey: "company", label: "Company name and TIN", type: "SHORT_TEXT", section: "About you", icon: "Briefcase", helpText: "For a company invoice", purpose: "Printed on the invoice when filled" },
  { libraryKey: "howDidYouHear", label: "How did you hear about us?", type: "SELECT", section: "Before you arrive", icon: "MegaphoneSimple", options: opt("A friend", "Instagram", "Google", "The marketplace", "Returning guest", "Other"), purpose: "Knowing which marketing works" },
  { libraryKey: "marketingConsent", label: "Send me offers now and then", type: "CHECKBOX", section: "Before you arrive", icon: "EnvelopeSimple", purpose: "Consent for marketing (unticked by default)" },
  { libraryKey: "extras", label: "Paid extras", type: "EXTRA", section: "Extras", icon: "ShoppingBag", purpose: "Selling breakfast, late check-out and celebrations", feature: "paid_extras" },
  { libraryKey: "pickup", label: "Arrival pickup and departure drop-off", type: "PICKUP", section: "Getting here", icon: "Van", purpose: "Arranging a driver to meet the guest", feature: "paid_extras" },
];

/** System fields: always on the form. Their labels can be reworded. */
export const SYSTEM_FIELDS: { key: string; label: string; type: FieldType; section: string; icon: string; note: string }[] = [
  { key: "fullName", label: "Full name", type: "SHORT_TEXT", section: "About you", icon: "User", note: "Needed for every booking" },
  { key: "phone", label: "Phone number", type: "PHONE", section: "About you", icon: "Phone", note: "+234 by default, stored in international form" },
  { key: "email", label: "Email", type: "EMAIL", section: "About you", icon: "At", note: "Required when the guest pays online, optional when they pay at the hotel" },
  { key: "dates", label: "Dates", type: "DATE", section: "Your stay", icon: "CalendarBlank", note: "Arrival and departure" },
  { key: "adults", label: "Adults", type: "NUMBER", section: "Your stay", icon: "UsersThree", note: "From the stay details" },
  { key: "children", label: "Children", type: "NUMBER", section: "Your stay", icon: "Baby", note: "From the stay details" },
  { key: "policyConsent", label: "I agree to the hotel's policies", type: "CHECKBOX", section: "Before you arrive", icon: "Scroll", note: "Consent to the cancellation policy and house rules" },
];

export const RECOMMENDED_FIELDS: { key: string; label: string; type: FieldType; section: string; icon: string; note: string }[] = [
  { key: "estimatedArrivalTime", label: "Estimated arrival time", type: "TIME", section: "Your stay", icon: "Clock", note: "Shows on the arrivals list and the new-booking email" },
  { key: "specialRequests", label: "Special requests", type: "LONG_TEXT", section: "Your stay", icon: "ChatText", note: "Anything we should prepare" },
];

export const PRESETS: { id: string; name: string; hint: string; icon: string }[] = [
  { id: "guesthouse", name: "Guesthouse", hint: "Short and quick: name, phone, arrival time", icon: "House" },
  { id: "business", name: "Business hotel", hint: "Company and TIN, purpose of visit, airport pickup", icon: "Briefcase" },
  { id: "resort", name: "Resort", hint: "Children's ages, dietary needs, extras and transfers", icon: "Umbrella" },
  { id: "boutique", name: "Boutique", hint: "Bed preference, occasions and a personal touch", icon: "Flower" },
  { id: "serviced_apartments", name: "Serviced apartments", hint: "Longer stays, company invoices, vehicle plate", icon: "Buildings" },
  { id: "event_venue", name: "Event or wedding venue", hint: "Which event, which side of the family, group transfers", icon: "Champagne" },
];

/* ---------- ID-like fields ---------- */

export type IdCheck = { level: "block"; message: string } | { level: "warn"; message: string } | null;

/** BVN is never collected. NIN, passport and ID numbers belong on the register card at check-in. */
export function idLikeCheck(label: string): IdCheck {
  const l = label.toLowerCase();
  if (/\bbvn\b|bank\s*verification/.test(l)) return { level: "block", message: "BVN can't be collected on a booking form. No hotel needs it, and asking for it puts guests at risk." };
  if (/\bnin\b|national\s*id|identity\s*(number|card)|\bid\s*(no|number|card)\b|passport|driver'?s?\s*licen[cs]e|voter'?s?\s*card|\bssn\b/.test(l))
    return { level: "warn", message: "Collect ID numbers at check-in on the register card, not at booking. Fewer guests abandon the form, and you keep less sensitive data." };
  return null;
}

/* =========================================================================
 * Extras
 * ========================================================================= */

export type ExtraCategory = "TRANSPORT" | "FOOD" | "EARLY_LATE" | "CELEBRATION" | "WELLNESS" | "OTHER";
export const EXTRA_CATEGORIES: { value: ExtraCategory; label: string; icon: string }[] = [
  { value: "FOOD", label: "Food", icon: "Coffee" },
  { value: "EARLY_LATE", label: "Early and late", icon: "Clock" },
  { value: "CELEBRATION", label: "Celebration", icon: "Cake" },
  { value: "WELLNESS", label: "Wellness", icon: "FlowerLotus" },
  { value: "TRANSPORT", label: "Transport", icon: "Van" },
  { value: "OTHER", label: "Other", icon: "ShoppingBag" },
];

export type ExtraPricing = "PER_STAY" | "PER_NIGHT" | "PER_PERSON" | "PER_PERSON_PER_NIGHT" | "PER_UNIT";
export const EXTRA_PRICING: { value: ExtraPricing; label: string; unit: string }[] = [
  { value: "PER_STAY", label: "Once per stay", unit: "per stay" },
  { value: "PER_NIGHT", label: "Every night", unit: "a night" },
  { value: "PER_PERSON", label: "Per guest", unit: "per guest" },
  { value: "PER_PERSON_PER_NIGHT", label: "Per guest, every night", unit: "per guest a night" },
  { value: "PER_UNIT", label: "Per item", unit: "each" },
];

export function pricingUnit(p: string) {
  return EXTRA_PRICING.find((x) => x.value === p)?.unit ?? "";
}

/** Price of an extra for a stay (before tax). */
export function extraPrice(p: ExtraPricing | string, priceKobo: number, stay: { nights: number; guests: number; units?: number }) {
  const n = Math.max(1, stay.nights);
  const g = Math.max(1, stay.guests);
  switch (p) {
    case "PER_NIGHT":
      return priceKobo * n;
    case "PER_PERSON":
      return priceKobo * g;
    case "PER_PERSON_PER_NIGHT":
      return priceKobo * g * n;
    case "PER_UNIT":
      return priceKobo * Math.max(1, stay.units ?? 1);
    default:
      return priceKobo;
  }
}

/* =========================================================================
 * Pickup points and transfers
 * ========================================================================= */

export type PickupKind = "AIRPORT" | "MOTOR_PARK" | "TRAIN_STATION" | "JETTY" | "OTHER";
export const PICKUP_KINDS: { value: PickupKind; label: string; plural: string; icon: string; detail: string }[] = [
  { value: "AIRPORT", label: "Airport", plural: "Airports", icon: "AirplaneLanding", detail: "Airline, flight number, arrival time, terminal" },
  { value: "MOTOR_PARK", label: "Motor park", plural: "Motor parks", icon: "Bus", detail: "Transport company, from which city, expected arrival at the park" },
  { value: "TRAIN_STATION", label: "Train station", plural: "Train stations", icon: "Train", detail: "Route, train or service, expected arrival" },
  { value: "JETTY", label: "Jetty", plural: "Jetties", icon: "Boat", detail: "Boat details and expected arrival" },
  { value: "OTHER", label: "Other place", plural: "Other places", icon: "MapPin", detail: "Where to meet and when" },
];

export function kindMeta(k: string) {
  return PICKUP_KINDS.find((x) => x.value === k) ?? PICKUP_KINDS[4];
}

/** Nigerian inter-city road transport companies (deduplicated). Hotels can add their own. */
export const TRANSPORT_COMPANIES = [
  "GIGM (God is Good Motors)",
  "ABC Transport",
  "Peace Mass Transit",
  "Chisco",
  "GUO",
  "Libra Motors",
  "The Young Shall Grow",
  "Efex",
  "Cross Country",
  "Area Motors",
  "Okeyson",
  "Greener Line",
  "Agofure",
  "Ifesinachi",
];

export const TRAIN_ROUTES = ["Lagos–Ibadan", "Abuja–Kaduna", "Warri–Itakpe"];

export const VEHICLE_PRESETS = [
  { name: "Saloon car", maxPassengers: 3 },
  { name: "SUV", maxPassengers: 4 },
  { name: "Bus (up to 14)", maxPassengers: 14 },
];

export type TransferStatus = "REQUESTED" | "CONFIRMED" | "DRIVER_ASSIGNED" | "EN_ROUTE" | "PICKED_UP" | "COMPLETED" | "NO_SHOW" | "CANCELLED";

export const TRANSFER_STATUS: Record<TransferStatus, { label: string; tone: "neutral" | "brass" | "adire" | "ochre" | "palm" | "danger" | "laterite"; next?: TransferStatus; action?: string }> = {
  REQUESTED: { label: "Requested", tone: "ochre", next: "CONFIRMED", action: "Confirm" },
  CONFIRMED: { label: "Confirmed", tone: "brass" },
  DRIVER_ASSIGNED: { label: "Driver assigned", tone: "adire", next: "EN_ROUTE", action: "Driver on the way" },
  EN_ROUTE: { label: "On the way", tone: "laterite", next: "PICKED_UP", action: "Guest picked up" },
  PICKED_UP: { label: "Picked up", tone: "palm", next: "COMPLETED", action: "Arrived at the hotel" },
  COMPLETED: { label: "Completed", tone: "palm" },
  NO_SHOW: { label: "No-show", tone: "danger" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export const TRANSFER_FLOW: TransferStatus[] = ["REQUESTED", "CONFIRMED", "DRIVER_ASSIGNED", "EN_ROUTE", "PICKED_UP", "COMPLETED"];

/* =========================================================================
 * Setup wizard
 * ========================================================================= */

export const SETUP_STEPS: { key: string; n: number; title: string; short: string; needed: boolean; feature?: string }[] = [
  { key: "hotel_type", n: 1, title: "What kind of place is it?", short: "Hotel type", needed: false },
  { key: "brand", n: 2, title: "Your brand and template", short: "Brand", needed: false },
  { key: "rooms", n: 3, title: "Rooms and rates", short: "Rooms", needed: true },
  { key: "booking_form", n: 4, title: "The booking form", short: "Booking form", needed: false },
  { key: "extras", n: 5, title: "Extras and pickups", short: "Extras", needed: false, feature: "paid_extras" },
  { key: "payments", n: 6, title: "Getting paid", short: "Payments", needed: true },
  { key: "policies", n: 7, title: "Times, cancellation and taxes", short: "Policies", needed: true },
  { key: "go_live", n: 8, title: "Go live", short: "Go live", needed: true },
];
