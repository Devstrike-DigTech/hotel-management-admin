import {
  Baby,
  Briefcase,
  CallBell,
  Camera,
  CarProfile,
  Champagne,
  Compass,
  Flower,
  FlowerLotus,
  ForkKnife,
  Martini,
  Scissors,
  ShieldCheck,
  ShoppingBag,
  TShirt,
  type Icon,
} from "@phosphor-icons/react";
import type { Tone } from "@/lib/catalog";
import type { ContactPreference, FulfilledBy, RequestSource, RequestStatus, ReviewStatus, ServiceCategory, ServiceChannel, ServiceLocation, ServicePricing } from "@/lib/api/types-m8";

export const CATEGORIES: {
  value: ServiceCategory;
  label: string;
  icon: Icon;
  hint: string;
}[] = [
  {
    value: "WELLNESS",
    label: "Wellness",
    icon: FlowerLotus,
    hint: "Massage, spa, fitness",
  },
  {
    value: "DINING",
    label: "Dining",
    icon: ForkKnife,
    hint: "Private chef, in-room dining",
  },
  {
    value: "ROMANCE_AND_CELEBRATION",
    label: "Celebrations",
    icon: Flower,
    hint: "Flowers, candles, cake, room decor",
  },
  {
    value: "GROOMING",
    label: "Grooming",
    icon: Scissors,
    hint: "Barber, hair and makeup",
  },
  {
    value: "TRANSPORT",
    label: "Transport",
    icon: CarProfile,
    hint: "Car with driver, fast-track",
  },
  {
    value: "SECURITY",
    label: "Security",
    icon: ShieldCheck,
    hint: "Licensed guard, secure car",
  },
  {
    value: "TOURS_AND_EXPERIENCES",
    label: "Tours",
    icon: Compass,
    hint: "City tours, day trips",
  },
  { value: "FAMILY", label: "Family", icon: Baby, hint: "Vetted babysitting" },
  {
    value: "SHOPPING",
    label: "Shopping",
    icon: ShoppingBag,
    hint: "Personal shopper, errands",
  },
  {
    value: "PHOTOGRAPHY",
    label: "Photography",
    icon: Camera,
    hint: "Portraits, events",
  },
  {
    value: "EVENTS",
    label: "Events",
    icon: Champagne,
    hint: "Birthdays, small gatherings",
  },
  {
    value: "NIGHTLIFE_RESERVATIONS",
    label: "Table bookings",
    icon: Martini,
    hint: "Restaurants and lounges",
  },
  {
    value: "BUSINESS",
    label: "Business",
    icon: Briefcase,
    hint: "Printing, meeting set-up, interpreter",
  },
  {
    value: "LAUNDRY_EXPRESS",
    label: "Express laundry",
    icon: TShirt,
    hint: "Same-day pressing",
  },
  {
    value: "OTHER",
    label: "Other",
    icon: CallBell,
    hint: "Anything else lawful",
  },
];
const CAT = new Map(CATEGORIES.map((c) => [c.value, c]));
export const categoryMeta = (c: ServiceCategory | null | undefined) => CAT.get(c ?? "OTHER") ?? CATEGORIES[CATEGORIES.length - 1];

export const PRICING: { value: ServicePricing; label: string; hint: string }[] = [
  {
    value: "FIXED",
    label: "Fixed price",
    hint: "Confirms at once when the time is free",
  },
  {
    value: "PER_HOUR",
    label: "Per hour",
    hint: "Price times the hours booked",
  },
  {
    value: "PER_PERSON",
    label: "Per person",
    hint: "Price times the party size",
  },
  {
    value: "FROM",
    label: "From (quote)",
    hint: "A guide price; staff send a quote",
  },
  { value: "FREE", label: "Free", hint: "Complimentary" },
];
export const pricingLabel = (p: ServicePricing) => PRICING.find((x) => x.value === p)?.label ?? p;

export const LOCATIONS: { value: ServiceLocation; label: string }[] = [
  { value: "IN_ROOM", label: "In the room" },
  { value: "ON_PROPERTY", label: "At the hotel" },
  { value: "OFF_PROPERTY", label: "Out and about" },
];
export const FULFILLERS: { value: FulfilledBy; label: string }[] = [
  { value: "STAFF", label: "Our staff" },
  { value: "VENDOR", label: "A vendor" },
];
export const SERVICE_CHANNELS: {
  value: ServiceChannel;
  label: string;
  hint: string;
}[] = [
  {
    value: "BOOKING_FLOW",
    label: "While booking",
    hint: "Offered before arrival",
  },
  {
    value: "TRIP_PAGE",
    label: "During the stay",
    hint: "On the guest's trip page",
  },
  {
    value: "FRONT_DESK",
    label: "Front desk",
    hint: "Taken on the guest's behalf",
  },
];

export const STATUS: Record<RequestStatus, { label: string; tone: Tone }> = {
  NEW: { label: "New", tone: "laterite" },
  QUOTED: { label: "Quoted", tone: "brass" },
  AWAITING_GUEST: { label: "Waiting on guest", tone: "brass" },
  CONFIRMED: { label: "Confirmed", tone: "adire" },
  SCHEDULED: { label: "Scheduled", tone: "adire" },
  IN_PROGRESS: { label: "In progress", tone: "ochre" },
  COMPLETED: { label: "Completed", tone: "palm" },
  DECLINED: { label: "Declined", tone: "neutral" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

export const REVIEW: Record<ReviewStatus, { label: string; tone: Tone; guest: string }> = {
  LIVE: { label: "Live", tone: "palm", guest: "Guests can request it" },
  PENDING_REVIEW: {
    label: "In review",
    tone: "ochre",
    guest: "Hidden from guests until our team has looked",
  },
  REJECTED: {
    label: "Not approved",
    tone: "danger",
    guest: "Hidden from guests",
  },
  HIDDEN: {
    label: "Hidden by the platform",
    tone: "danger",
    guest: "Hidden from guests",
  },
};

export const CONTACT: Record<ContactPreference, string> = {
  WHATSAPP: "WhatsApp",
  SMS: "SMS",
  EMAIL: "Email",
  IN_APP: "Trip page",
};
export const SOURCE: Record<RequestSource, string> = {
  BOOKING_FLOW: "While booking",
  TRIP_PAGE: "Trip page",
  WHATSAPP: "WhatsApp",
  FRONT_DESK: "Front desk",
};

/** Board columns (section 4): each request sits in exactly one. */
export type Column = "NEW" | "QUOTED" | "CONFIRMED" | "TODAY" | "DONE";
export const COLUMNS: { key: Column; label: string; blurb: string }[] = [
  { key: "NEW", label: "New", blurb: "Waiting for a first answer" },
  { key: "QUOTED", label: "Quoted", blurb: "With the guest to accept" },
  { key: "CONFIRMED", label: "Confirmed", blurb: "Agreed, on a later day" },
  { key: "TODAY", label: "Today", blurb: "Happening today" },
  { key: "DONE", label: "Done", blurb: "Completed, declined or cancelled" },
];

export const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * The platform's acceptable-use policy. The API serves the current text
 * (`GET /concierge/aup`); this is what shows if that call fails.
 */
export const AUP_FALLBACK = `Concierge services on this platform must be lawful in Nigeria and offered by people who are licensed or qualified to provide them.

You may not list, arrange or accept requests for:
- sexual services of any kind, escorts or companionship for hire, or introductions for that purpose;
- drugs or controlled substances, including cannabis;
- weapons, ammunition or anything that needs a licence you do not hold;
- gambling or betting facilitation;
- anything else that is illegal in Nigeria or harms guests, staff or third parties.

Every new or edited service is checked automatically. Anything that may break these rules is held for review by our team and hidden from guests until it is approved. We may hide a service, reject it with a reason, or switch concierge off for a hotel that breaks this policy. Requests from guests that may break it are never sent to vendors automatically; a manager decides.`;
