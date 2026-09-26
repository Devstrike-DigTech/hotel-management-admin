/**
 * The M8 contract (API-M8.md): the concierge. Services, vendors, guest requests with discretion,
 * quotes, the acceptable-use policy, SLA, reports and settings.
 */
import type { AnswerView, FormField } from "./types-m7";

export type ServiceCategory =
  | "WELLNESS"
  | "DINING"
  | "ROMANCE_AND_CELEBRATION"
  | "GROOMING"
  | "TRANSPORT"
  | "SECURITY"
  | "TOURS_AND_EXPERIENCES"
  | "FAMILY"
  | "SHOPPING"
  | "PHOTOGRAPHY"
  | "EVENTS"
  | "NIGHTLIFE_RESERVATIONS"
  | "BUSINESS"
  | "LAUNDRY_EXPRESS"
  | "OTHER";

export type ServicePricing = "FIXED" | "FROM" | "PER_HOUR" | "PER_PERSON" | "FREE";
export type ServiceLocation = "IN_ROOM" | "ON_PROPERTY" | "OFF_PROPERTY";
export type FulfilledBy = "STAFF" | "VENDOR";
export type ServiceChannel = "BOOKING_FLOW" | "TRIP_PAGE" | "FRONT_DESK";
export type ReviewStatus = "LIVE" | "PENDING_REVIEW" | "REJECTED" | "HIDDEN";
export type RequestStatus = "NEW" | "QUOTED" | "AWAITING_GUEST" | "CONFIRMED" | "SCHEDULED" | "IN_PROGRESS" | "COMPLETED" | "DECLINED" | "CANCELLED";
export type RequestSource = "BOOKING_FLOW" | "TRIP_PAGE" | "WHATSAPP" | "FRONT_DESK";
export type ContactPreference = "WHATSAPP" | "SMS" | "EMAIL" | "IN_APP";
export type PaymentMethod = "ONLINE" | "FOLIO" | "NONE";
export type PaymentStatus = "NONE" | "PENDING" | "PAID" | "POSTED" | "REFUNDED";
export type CommissionType = "NONE" | "PERCENT" | "FIXED";

export type Availability = { days: number[]; from: string; to: string } | null;

export interface TaxLine {
  code: string;
  label: string;
  rateBps: number;
  inclusive: boolean;
  amountKobo: number;
}
export interface QuotedPrice {
  amountKobo: number;
  netKobo: number;
  taxKobo: number;
  totalKobo: number;
  taxes: TaxLine[];
  description: string;
}
export interface StaffRef {
  id: string;
  fullName: string;
}

/* ---------- gates, AUP, screening ---------- */

export interface ConciergeGates {
  feature: boolean;
  vendorsFeature: boolean;
  requiredPlan: "growth" | null;
  vendorsRequiredPlan: "pro" | null;
  aup: { version: string; accepted: boolean; acceptedAt: string | null; acceptedBy: StaffRef | null };
  suspended: { since: string; reason: string } | null;
  enabled: boolean;
  canSeeDiscreet: boolean;
  discreetVisibility: "MASKED" | "HIDDEN";
}

export interface AupState {
  version: string;
  title: string;
  summary: string[];
  text: string;
  prohibited: { code: string; label: string }[];
  accepted: boolean;
  acceptedVersion: string | null;
  acceptedAt: string | null;
  acceptedBy: StaffRef | null;
}

export interface ScreenResult {
  flagged: boolean;
  matches: { term: string; category: string; excerpt: string; textIndex: number }[];
}

/* ---------- catalogue ---------- */

export interface ServiceVariant {
  id?: string;
  name: string;
  priceKobo: number;
  durationMinutes: number | null;
}

export type ServiceQuestion = FormField;

export interface ConciergeService {
  id: string;
  propertyId: string;
  name: string;
  description: string;
  category: ServiceCategory;
  imageUrl: string | null;
  pricing: ServicePricing;
  priceKobo: number | null;
  variants: ServiceVariant[];
  durationMinutes: number | null;
  leadTimeHours: number;
  availability: Availability;
  requiresSlot: boolean;
  slotCapacity: number | null;
  location: ServiceLocation;
  fulfilledBy: FulfilledBy;
  vendor: { id: string; name: string } | null;
  discreetEligible: boolean;
  questions: ServiceQuestion[];
  taxable: boolean;
  channels: ServiceChannel[];
  active: boolean;
  sortOrder: number;
  reviewStatus: ReviewStatus;
  review: { flaggedTerms: string[]; reason: string | null; submittedAt: string | null; reviewedAt: string | null; reviewedBy: string | null };
  guestVisible: boolean;
  priceLabel: string;
  requestsLast30Days: number;
  createdAt: string;
  updatedAt: string;
  warnings?: { questionKey: string; code: "ID_LIKE"; message: string }[];
}

export type ServiceInput = Omit<
  ConciergeService,
  "id" | "propertyId" | "vendor" | "sortOrder" | "reviewStatus" | "review" | "guestVisible" | "priceLabel" | "requestsLast30Days" | "createdAt" | "updatedAt" | "warnings"
> & { vendorId: string | null; sortOrder?: number };

export interface CategoryInfo {
  code: ServiceCategory;
  label: string;
  description: string;
}

/* ---------- vendors ---------- */

export interface Vendor {
  id: string;
  propertyId: string;
  name: string;
  category: ServiceCategory;
  contactName: string | null;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  commissionType: CommissionType;
  /** basis points for PERCENT, kobo for FIXED */
  commissionValue: number;
  payoutNotes: string | null;
  notes: string | null;
  active: boolean;
  rating: number | null;
  ratingCount: number;
  jobsLast30Days: number;
  unsettledPayableKobo: number | null;
  createdAt: string;
  updatedAt: string;
}
export type VendorInput = Pick<Vendor, "name" | "category" | "contactName" | "phone" | "whatsapp" | "email" | "notes" | "active"> & Partial<Pick<Vendor, "commissionType" | "commissionValue" | "payoutNotes">>;

/* ---------- requests ---------- */

export interface RequestSla {
  dueAt: string;
  firstResponseAt: string | null;
  overdue: boolean;
  minutesLeft: number | null;
  escalatedAt: string | null;
  target: "IN_STAY" | "PRE_ARRIVAL";
}

export interface RequestListItem {
  id: string;
  number: string;
  propertyId: string;
  status: RequestStatus;
  source: RequestSource;
  discreet: boolean;
  masked: boolean;
  title: string;
  label: string;
  category: ServiceCategory | null;
  guestName: string | null;
  roomNumber: string | null;
  reservationCode: string | null;
  preferredStart: string | null;
  preferredEnd: string | null;
  partySize: number | null;
  assignee: StaffRef | null;
  vendor: { id: string; name: string } | null;
  flagged: boolean;
  totalKobo: number | null;
  paymentStatus: PaymentStatus;
  sla: RequestSla;
  createdAt: string;
  updatedAt: string;
}

export interface RequestQuote {
  version: number;
  amountKobo: number;
  netKobo: number;
  taxKobo: number;
  totalKobo: number;
  taxes: TaxLine[];
  validUntil: string;
  note: string | null;
  sentAt: string;
  sentBy: StaffRef | null;
  acceptUrl: string;
  expired: boolean;
  answer: "ACCEPTED" | "DECLINED" | null;
  answeredAt: string | null;
  answeredVia: "LINK" | "WHATSAPP" | "TRIP_PAGE" | "STAFF" | null;
}

export interface TimelineEvent {
  at: string;
  type: string;
  status: RequestStatus | null;
  note: string | null;
  by: string | null;
  guestVisible: boolean;
}

export interface RequestDetail extends RequestListItem {
  service: { id: string; name: string; category: ServiceCategory; pricing: ServicePricing; location: ServiceLocation; fulfilledBy: FulfilledBy; discreetEligible: boolean } | null;
  variant: { id: string; name: string } | null;
  hours: number | null;
  requestText: string | null;
  answers: AnswerView[] | null;
  notes: string | null;
  internalNotes: string | null;
  guest: { id: string; fullName: string; phone: string | null; email: string | null; vip: boolean } | null;
  reservation: { id: string; code: string; status: string; roomNumber: string | null; arrivalDate: string; departureDate: string; folioOpen: boolean } | null;
  contactPreference: ContactPreference;
  contact: { phone: string | null; email: string | null };
  doNotCallRoom: boolean;
  flag: { terms: string[]; categories: string[]; status: "PENDING" | "CLEARED" | "DECLINED"; reviewedBy: StaffRef | null; reviewedAt: string | null; note: string | null } | null;
  price: QuotedPrice | null;
  quote: RequestQuote | null;
  payment: { method: PaymentMethod | null; status: PaymentStatus; reference: string | null; authorizationUrl: string | null; paidAt: string | null; folioEntryId: string | null; postedAt: string | null; folioDescription: string | null };
  commission: { type: CommissionType; value: number; commissionKobo: number | null; vendorPayableKobo: number | null; settledAt: string | null } | null;
  vendorSentAt: string | null;
  vendorSentVia: "WHATSAPP" | "SMS" | null;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  declineReason: string | null;
  cancelReason: string | null;
  rating: { rating: number; comment: string | null; ratedAt: string } | null;
  vendorRating: number | null;
  timeline: TimelineEvent[];
  redactedAt: string | null;
  createdBy: StaffRef | null;
}

export interface RequestPage {
  items: RequestListItem[];
  total: number;
  page: number;
  pageSize: number;
  hiddenDiscreet: number;
}

export type ColumnKey = "NEW" | "QUOTED" | "CONFIRMED" | "TODAY" | "DONE";
export interface Board {
  generatedAt: string;
  businessDate: string;
  columns: { key: ColumnKey; label: string; items: RequestListItem[] }[];
  counts: { new: number; quoted: number; confirmed: number; today: number; done: number; overdue: number; flagged: number };
  hiddenDiscreet: number;
}

export interface TodayConcierge {
  new: number;
  overdue: number;
  quoted: number;
  today: number;
  inProgress: number;
  flagged: number;
  discreet: number;
  next: RequestListItem[];
}

/* ---------- reports, settings ---------- */

export interface ConciergeReport {
  range: { from: string; to: string };
  totals: { requests: number; completed: number; declined: number; cancelled: number; flagged: number; discreet: number };
  byCategory: { category: ServiceCategory; label: string; requests: number; completed: number; revenueNetKobo: number }[];
  responseTimes: { medianMinutes: number | null; p90Minutes: number | null; withinSlaPct: number | null; overdueNow: number; escalated: number };
  revenue: { netKobo: number; taxKobo: number; totalKobo: number; online: number; folio: number };
  vendorCommission: { vendorId: string; name: string; jobs: number; netKobo: number; commissionKobo: number; payableKobo: number; settledKobo: number }[] | null;
  ratings: { average: number | null; count: number; distribution: Record<"1" | "2" | "3" | "4" | "5", number> };
  vendorRatings: { vendorId: string; name: string; average: number | null; count: number }[];
  byDay: { date: string; requests: number; completed: number }[];
}

export interface ConciergeSettings {
  propertyId: string;
  enabled: boolean;
  sla: { inStayMinutes: number; preArrivalMinutes: number; escalateAfterMinutes: number };
  folioLabels: { inRoom: string; other: string };
  redactAfterDays: number;
  discreetVisibility: "MASKED" | "HIDDEN";
  vendorSharing: { guestSurname: boolean; roomNumber: boolean };
  payments: { online: boolean; folio: boolean };
  freeFormEnabled: boolean;
  quoteValidityHours: number;
  intro: string | null;
  updatedAt: string | null;
  updatedBy: StaffRef | null;
}
