/* The M3 contract (scratchpad API-M3.md, sections 6 and 7) as TypeScript. Money in kobo. */

import type { Paginated } from "./types";

export type BookingChannel = "MARKETPLACE" | "BOOKING_SITE";
export type PaymentMode = "ONLINE" | "PAY_AT_HOTEL";
export type GuaranteeType = "NONE" | "PREPAID";
export type BookingDisplayStatus = "AWAITING_PAYMENT" | "CONFIRMED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "EXPIRED";
export type BookingPaymentStatus = "INITIALIZED" | "SUCCEEDED" | "FAILED" | "ORPHANED" | "PARTIALLY_REFUNDED" | "REFUNDED";
export type RefundStatus = "PENDING" | "PROCESSED" | "FAILED";
export type RefundReason = "GUEST_CANCELLED" | "HOTEL_CANCELLED" | "PAYMENT_ORPHANED";
export type OrphanReason = "LATE_NO_INVENTORY" | "AMOUNT_MISMATCH" | "BOOKING_CANCELLED";
export type CommissionKind = "ACCRUED" | "COLLECTED" | "REVERSED";
export type CancelledBy = "GUEST" | "HOTEL" | "SYSTEM";
export type NotificationChannel = "EMAIL" | "SMS" | "WHATSAPP";
export type NotificationStatus = "QUEUED" | "SENT" | "FAILED" | "OUTBOX";
export type NotificationTemplate =
  | "OTP"
  | "MAGIC_LINK"
  | "BOOKING_CONFIRMED"
  | "PAYMENT_RECEIPT"
  | "PAY_AT_HOTEL_CONFIRMED"
  | "HOLD_EXPIRED"
  | "BOOKING_CANCELLED"
  | "PRE_ARRIVAL"
  | "REVIEW_REQUEST"
  | "PAYMENT_ORPHANED_REFUND"
  | "HOTEL_NEW_BOOKING"
  | "HOTEL_BOOKING_CANCELLED"
  | "ORPHANED_PAYMENT_ALERT";
export type ReviewStatus = "PUBLISHED" | "HIDDEN" | "FLAGGED";
export type TravellerType = "BUSINESS" | "COUPLE" | "FAMILY" | "SOLO" | "FRIENDS";
export type ModerationReason = "ABUSE" | "PII" | "SPAM" | "OFF_TOPIC" | "OTHER";

/* ---------- 6.1 booking settings ---------- */
export interface CancellationPolicy {
  freeCancellationHours: number;
  lateCancellationFeePct: number;
  noShowFeePct: number;
  summary?: string;
}
export interface BookingSettings {
  propertyId: string;
  onlineBookingEnabled: boolean;
  allowPayAtHotel: boolean;
  requireCardForPayAtHotel: boolean;
  cancellationPolicy: CancellationPolicy;
  preArrivalMessage: string;
  payoutReady: boolean;
  marketplaceListed: boolean;
  commissionBps: number;
  bookingSiteUrl: string;
  updatedAt: string;
}
export interface BookingSettingsInput {
  onlineBookingEnabled?: boolean;
  allowPayAtHotel?: boolean;
  requireCardForPayAtHotel?: boolean;
  cancellationPolicy?: { freeCancellationHours?: number; lateCancellationFeePct?: number; noShowFeePct?: number };
  preArrivalMessage?: string;
}

/* ---------- 6.2 payouts ---------- */
export interface Bank {
  code: string;
  name: string;
  slug: string;
  type: string;
}
export interface ResolvedAccount {
  bankCode: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}
export interface PayoutAccount {
  id: string;
  bankCode: string;
  bankName: string;
  accountNumberMasked: string;
  accountName: string;
  businessName: string;
  subaccountCode: string;
  settlementVerified: boolean;
  percentageCharge: 0;
  provider: "paystack" | "mock";
  createdAt: string;
  updatedAt: string;
}
export interface PayoutSummary {
  from: string;
  to: string;
  onlineRevenueKobo: number;
  refundsKobo: number;
  commissionKobo: number;
  netToHotelKobo: number;
  bookings: number;
  payAtHotelBookings: number;
  commissionAccruedKobo: number;
  payoutReady: boolean;
}
export interface PayoutTransaction {
  paymentId: string;
  reference: string;
  reservationId: string;
  reservationCode: string;
  guestName: string;
  channel: BookingChannel;
  status: BookingPaymentStatus;
  paidAt: string | null;
  amountKobo: number;
  commissionBps: number;
  commissionKobo: number;
  refundedKobo: number;
  commissionReversedKobo: number;
  netKobo: number;
}
export interface CommissionEntry {
  id: string;
  kind: CommissionKind;
  amountKobo: number;
  baseKobo: number;
  commissionBps: number;
  channel: BookingChannel;
  reservationId: string;
  reservationCode: string;
  note: string | null;
  settledAt: string | null;
  createdAt: string;
}

/* ---------- 6.3 online bookings on the M2 shapes ---------- */
export interface OnlineBookingInfo {
  channel: BookingChannel;
  paymentMode: PaymentMode;
  guaranteeType: GuaranteeType;
  commissionBps: number;
  quotedTotalKobo: number;
  holdExpiresAt: string | null;
  contact: { phone: string; email: string | null };
  specialRequests: string;
  guestAccountLinked: boolean;
  cancelledBy: CancelledBy | null;
  cancellationFeeKobo: number | null;
  payments: {
    id: string;
    reference: string;
    status: BookingPaymentStatus;
    amountKobo: number;
    commissionKobo: number;
    paidAt: string | null;
    channel: string | null;
    orphanReason: OrphanReason | null;
  }[];
  refunds: {
    id: string;
    amountKobo: number;
    status: RefundStatus;
    reason: RefundReason;
    createdAt: string;
    processedAt: string | null;
    error: string | null;
  }[];
  commission: { collectedKobo: number; accruedKobo: number; reversedKobo: number; netKobo: number };
}
/** Fields every M2 stay shape gains in M3. */
export interface OnlineFields {
  paymentMode?: PaymentMode | null;
  holdExpiresAt?: string | null;
}

/* ---------- 6.4 feed ---------- */
export type FeedEvent = "NEW_BOOKING" | "PAID" | "HOLD_EXPIRED" | "CANCELLED";
export interface FeedItem {
  reservationId: string;
  code: string;
  status: string;
  displayStatus: BookingDisplayStatus;
  event: FeedEvent;
  eventAt: string;
  channel: BookingChannel;
  paymentMode: PaymentMode;
  guestName: string;
  roomTypeName: string;
  arrivalDate: string;
  departureDate: string;
  nights: number | null;
  totalKobo: number;
  paidKobo: number;
  holdExpiresAt: string | null;
  createdAt: string;
}
export interface OnlineFeed {
  now: string;
  items: FeedItem[];
  counts: { activeHolds: number; confirmedToday: number; arrivingNext7Days: number };
}
export interface OnlineCounts {
  activeHolds: number;
  newToday: number;
  arrivalsToday: number;
}

/* ---------- 6.5 notifications ---------- */
export interface NotificationLogItem {
  id: string;
  template: NotificationTemplate | string;
  channel: NotificationChannel;
  audience: "GUEST" | "HOTEL" | "PLATFORM";
  recipientMasked: string;
  subject: string | null;
  preview: string;
  status: NotificationStatus;
  provider: string;
  providerMessageId: string | null;
  attempts: number;
  error: string | null;
  reservationId: string | null;
  reservationCode: string | null;
  createdAt: string;
  sentAt: string | null;
}
export interface NotificationPreview {
  subject: string | null;
  text: string;
  html: string | null;
}

/* ---------- 6.6 reviews ---------- */
export interface ReviewSummary {
  rating: number | null;
  count: number;
  subscores: { cleanliness: number | null; service: number | null; location: number | null; value: number | null };
  distribution: Record<"1" | "2" | "3" | "4" | "5", number>;
  byTravellerType: Record<TravellerType, number>;
}
export interface HotelReviewSummary extends ReviewSummary {
  unreplied: number;
  trend: { month: string; count: number; rating: number | null }[];
}
export interface HotelReview {
  id: string;
  overall: number;
  cleanliness: number;
  service: number;
  location: number;
  value: number;
  title: string | null;
  body: string;
  stayMonth: string;
  travellerType: TravellerType;
  displayName: string;
  verifiedStay: true;
  createdAt: string;
  hotelReply: { body: string; repliedAt: string } | null;
  status: ReviewStatus;
  reservationId: string;
  reservationCode: string;
  guestName: string;
  flaggedReason: string | null;
  flaggedAt: string | null;
  moderation: { reason: ModerationReason; note: string | null; at: string } | null;
}
export interface ReviewQuery {
  status?: ReviewStatus | "";
  rating?: number;
  travellerType?: TravellerType | "";
  replied?: "true" | "false" | "";
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export type { Paginated };
