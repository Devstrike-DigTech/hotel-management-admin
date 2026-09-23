/* The M4 contract (API-M4.md) as TypeScript. Money in kobo, percentages in bps, dates are Lagos day keys. */

import type { RoomStatus } from "./types";
import type { Paginated, RoomRef, TypeRef, UserRef } from "./types-m2";
import type { ReservationStatus } from "@/lib/catalog-m2";

export type { Paginated, UserRef };

export type StaffRole = "OWNER" | "MANAGER" | "FRONT_DESK" | "HOUSEKEEPING" | "ACCOUNTANT" | "SUPERVISOR" | "MAINTENANCE" | "CUSTOM";

export type HkTaskType = "CHECKOUT_CLEAN" | "STAYOVER" | "DEEP_CLEAN" | "TURNDOWN" | "INSPECTION" | "CUSTOM";
export type TaskPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type HkTaskStatus = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "DONE" | "INSPECTED" | "REJECTED" | "SKIPPED";
export type HkTaskSource = "CHECKOUT" | "ROOM_MOVE" | "MANUAL" | "STAYOVER_JOB" | "DEEP_CLEAN_RULE" | "MAINTENANCE";
export type LostFoundStatus = "HELD" | "RETURNED" | "DISPOSED";

export type MaintenanceCategory = "ELECTRICAL" | "PLUMBING" | "AC_HVAC" | "FURNITURE" | "APPLIANCE" | "GENERATOR" | "CIVIL" | "IT" | "OTHER";
export type TicketStatus = "OPEN" | "ASSIGNED" | "IN_PROGRESS" | "ON_HOLD" | "RESOLVED" | "CLOSED";

export type RatePlanKind = "BAR" | "NON_REFUNDABLE" | "CORPORATE" | "LONG_STAY" | "PACKAGE";
export type RatePlanPricing = "DERIVED" | "FIXED";
export type AdjustmentType = "PERCENT" | "AMOUNT" | "FIXED";
export type RateChannel = "FRONT_DESK" | "BOOKING_SITE" | "MARKETPLACE";
export type RateSource = "BASE" | "RULE" | "OVERRIDE" | "FIXED" | "MANUAL";
export type BandColor = "laterite" | "brass" | "palm" | "adire" | "ochre";

export type PromoType = "PERCENT" | "AMOUNT" | "FREE_NIGHT";
export type PromoRedemptionStatus = "HELD" | "CONFIRMED" | "RELEASED";
export type PromoInvalidReason =
  | "NOT_FOUND"
  | "INACTIVE"
  | "NOT_STARTED"
  | "EXPIRED"
  | "STAY_DATES"
  | "MIN_NIGHTS"
  | "CHANNEL"
  | "ROOM_TYPE"
  | "USED_UP"
  | "PER_GUEST_LIMIT"
  | "FIRST_BOOKING_ONLY"
  | "NO_DISCOUNT";

export type CityLedgerInvoiceStatus = "OPEN" | "PARTIALLY_PAID" | "PAID" | "VOID";
export type CityLedgerInvoiceKind = "PER_STAY" | "STATEMENT";
export type BillingCycle = "PER_STAY" | "MONTHLY";
export type LedgerPaymentMethod = "TRANSFER" | "CHEQUE" | "CASH" | "POS";
export type AgingBucket = "CURRENT" | "D31_60" | "D61_90" | "D90_PLUS";

export type WhatsAppTemplateName =
  | "owner_daily_digest"
  | "guard_alert_high"
  | "booking_confirmed"
  | "pre_arrival"
  | "review_request"
  | "payment_receipt"
  | "otp_code";
export type GuardAlertStatus = "PENDING" | "SENT" | "DEFERRED" | "FAILED" | "ACKNOWLEDGED";

/* ---------- permissions and roles ---------- */
export interface PermissionGroupWire {
  group: string;
  label: string;
  permissions: { code: string; label: string; description: string; sensitive: boolean }[];
}

export interface RoleWire {
  id: string;
  key: StaffRole | null;
  name: string;
  description: string;
  system: boolean;
  permissions: string[];
  staffCount: number;
  basedOn: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface RoleDetail extends RoleWire {
  staff: { id: string; fullName: string; email: string; isActive: boolean }[];
}

export interface RoleInput {
  name: string;
  description?: string;
  permissions?: string[];
  cloneFrom?: string;
}

/* ---------- housekeeping ---------- */
export interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

export interface HousekeepingTask {
  id: string;
  room: RoomRef & { roomType: TypeRef };
  type: HkTaskType;
  priority: TaskPriority;
  basePriority: TaskPriority;
  status: HkTaskStatus;
  source: HkTaskSource;
  reason: "CHECKOUT" | "ROOM_MOVE" | "MANUAL";
  assignee: UserRef | null;
  dueAt: string | null;
  startedAt: string | null;
  doneAt: string | null;
  inspectedAt: string | null;
  inspectedBy: UserRef | null;
  inspectionNote: string | null;
  checklist: ChecklistItem[];
  checklistDone: number;
  checklistTotal: number;
  notes: string;
  photos: { key: string; url: string; uploadedAt: string }[];
  estimatedMinutes: number;
  arrivalToday: { reservationId: string; code: string; guestName: string; arrivalAt: string } | null;
  reservationCode: string | null;
  skippedReason: string | null;
  maintenanceTicketIds: string[];
  businessDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface MyTasks {
  date: string;
  tasks: HousekeepingTask[];
  summary: { total: number; done: number; minutesLeft: number };
}

export interface HousekeepingBoardData {
  date: string;
  requireInspection: boolean;
  tasks: HousekeepingTask[];
  housekeepers: { user: UserRef; role: string; minutes: number; done: number; total: number }[];
  counts: Partial<Record<HkTaskStatus, number>>;
  inspectionQueue: number;
  rooms: { id: string; number: string; floor: number; status: RoomStatus; arrivalToday: boolean; inHouse: boolean; openTask: string | null }[];
}

export interface AssignSuggestion {
  date: string;
  housekeepers: { user: UserRef; role: string; assignedMinutes: number; proposedMinutes: number; taskCount: number }[];
  proposal: { taskId: string; roomNumber: string; floor: number; type: HkTaskType; minutes: number; assigneeId: string; currentAssigneeId: string | null }[];
  totalMinutes: number;
  targetMinutesEach: number;
}

export interface HousekeepingSettings {
  requireInspection: boolean;
  stayoverEnabled: boolean;
  stayoverTime: string;
  taskMinutes: Record<HkTaskType, number>;
  deepCleanEveryStays: { roomTypeId: string; roomTypeName: string; every: number | null }[];
}

export interface Checklist {
  id: string | null;
  roomTypeId: string | null;
  roomTypeName: string | null;
  taskType: HkTaskType;
  items: { id: string; label: string }[];
  isDefault: boolean;
  updatedAt: string | null;
}

export interface LostFoundItem {
  id: string;
  description: string;
  category: string;
  room: RoomRef | null;
  location: string | null;
  foundBy: UserRef | null;
  foundAt: string;
  status: LostFoundStatus;
  storageLocation: string | null;
  guest: { id: string; fullName: string; phone: string | null } | null;
  reservationCode: string | null;
  returnedTo: string | null;
  returnedAt: string | null;
  disposedAt: string | null;
  notes: string;
  photos: { key: string; url: string }[];
  createdAt: string;
  updatedAt: string;
}

/* ---------- maintenance ---------- */
export interface RoomBlock {
  id: string;
  room: RoomRef;
  from: string;
  to: string;
  reason: string;
  ticketId: string | null;
  ticketNumber: string | null;
  active: boolean;
  createdBy: UserRef | null;
  createdAt: string;
  releasedAt: string | null;
}

export interface BlockConflict {
  reservationId: string;
  code: string;
  guestName: string;
  status: ReservationStatus;
  arrivalAt: string;
  departureAt: string;
  roomId: string | null;
  suggestions: { roomId: string; number: string; floor: number }[];
}

export interface MaintenanceTicket {
  id: string;
  number: string;
  room: (RoomRef & { roomType: TypeRef }) | null;
  area: string | null;
  category: MaintenanceCategory;
  priority: TaskPriority;
  status: TicketStatus;
  title: string;
  description: string;
  photos: { key: string; url: string; uploadedAt: string }[];
  reportedBy: UserRef | null;
  assignee: UserRef | null;
  vendorName: string | null;
  vendorPhone: string | null;
  blocksRoom: boolean;
  block: RoomBlock | null;
  costKobo: number | null;
  resolutionNote: string | null;
  slaDueAt: string;
  slaBreached: boolean;
  slaRemainingMinutes: number | null;
  housekeepingTaskId: string | null;
  scheduleId: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
}

export interface TicketEvent {
  id: string;
  at: string;
  by: UserRef | null;
  kind: "CREATED" | "STATUS" | "ASSIGNED" | "COMMENT" | "PHOTO" | "BLOCK" | "COST";
  from: string | null;
  to: string | null;
  note: string | null;
}

export interface MaintenanceTicketDetail extends MaintenanceTicket {
  timeline: TicketEvent[];
}

export interface TicketInput {
  roomId?: string;
  area?: string;
  category: MaintenanceCategory;
  priority?: TaskPriority;
  title: string;
  description?: string;
  assigneeId?: string;
  vendorName?: string;
  vendorPhone?: string;
  blocksRoom?: boolean;
  outOfOrderFrom?: string;
  outOfOrderTo?: string;
  force?: boolean;
}

export interface MaintenanceSchedule {
  id: string;
  title: string;
  category: MaintenanceCategory;
  priority: TaskPriority;
  rooms: RoomRef[];
  area: string | null;
  everyDays: number;
  nextDueAt: string;
  lastRunAt: string | null;
  checklist: string[];
  active: boolean;
  openTickets: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleInput {
  title: string;
  category: MaintenanceCategory;
  priority?: TaskPriority;
  roomIds?: string[];
  area?: string;
  everyDays: number;
  nextDueAt: string;
  checklist?: string[];
  active?: boolean;
}

export type ScheduleCalendar = { date: string; schedules: { id: string; title: string; category: MaintenanceCategory; roomCount: number; area: string | null }[] }[];

export interface FuelLog {
  id: string;
  date: string;
  litres: number;
  costKobo: number;
  pricePerLitreKobo: number;
  supplier: string;
  runHours: number | null;
  generator: string | null;
  notes: string;
  loggedBy: UserRef | null;
  createdAt: string;
}

export interface FuelSummary {
  from: string;
  to: string;
  litres: number;
  costKobo: number;
  avgPricePerLitreKobo: number;
  litresPerDay: number;
  costPerDayKobo: number;
  runHours: number;
  litresPerRunHour: number | null;
  deliveries: number;
  days: { date: string; litres: number; costKobo: number; runHours: number | null }[];
  byMonth: { month: string; litres: number; costKobo: number }[];
  previousPeriodCostKobo: number;
}

export interface MaintenanceReport {
  from: string;
  to: string;
  openByAge: { bucket: "0-1d" | "1-3d" | "3-7d" | "7d+"; count: number }[];
  open: number;
  overdue: number;
  createdInRange: number;
  resolvedInRange: number;
  slaBreaches: { count: number; rate: number; items: MaintenanceTicket[] };
  meanTimeToResolveHours: number | null;
  costByCategory: { category: MaintenanceCategory; costKobo: number | null; tickets: number }[];
  problemRooms: { room: RoomRef; tickets: number; costKobo: number | null; lastTicketAt: string }[];
  blockedRoomNights: number;
  fuel: { litres: number; costKobo: number | null };
}

/* ---------- rates ---------- */
export interface RatePlan {
  id: string;
  code: string;
  name: string;
  description: string;
  kind: RatePlanKind;
  isBar: boolean;
  pricing: RatePlanPricing;
  adjustment: { type: "PERCENT" | "AMOUNT"; value: number } | null;
  fixedPrices: { roomTypeId: string; roomTypeName: string; rateKobo: number }[];
  cancellationPolicy: { nonRefundable: boolean; freeCancellationHours: number; lateCancellationFeePct: number } | null;
  minNights: number | null;
  maxNights: number | null;
  includesBreakfast: boolean;
  channels: RateChannel[];
  roomTypeIds: string[];
  active: boolean;
  sortOrder: number;
  label: string;
  reservationsCount: number;
  createdAt: string;
  updatedAt: string;
}

export type RatePlanInput = Partial<
  Omit<RatePlan, "id" | "isBar" | "label" | "reservationsCount" | "createdAt" | "updatedAt" | "fixedPrices">
> & { fixedPrices?: { roomTypeId: string; rateKobo: number }[] };

export interface RateRule {
  id: string;
  name: string;
  roomTypeIds: string[];
  dateFrom: string;
  dateTo: string;
  daysOfWeek: number[];
  adjustment: { type: AdjustmentType; value: number };
  priority: number;
  color: BandColor;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RateRuleInput = Partial<Omit<RateRule, "id" | "createdAt" | "updatedAt">>;

export interface RateRestriction {
  roomTypeId: string | null;
  date: string;
  closedToArrival: boolean;
  closedToDeparture: boolean;
  stopSell: boolean;
  minNights: number | null;
}

export interface NightlyRate {
  date: string;
  rateKobo: number;
  baseRateKobo: number;
  source: RateSource;
  ruleId: string | null;
  ruleName: string | null;
  discountKobo: number;
}

export interface RateCalendar {
  from: string;
  to: string;
  today: string;
  ratePlan: RatePlan;
  roomTypes: {
    roomType: TypeRef & { basePriceKobo: number };
    days: {
      date: string;
      rateKobo: number;
      baseRateKobo: number;
      source: RateSource;
      ruleId: string | null;
      ruleName: string | null;
      override: boolean;
      /** M5: who set the override (dynamic pricing writes overrides too) */
      overrideSource?: "MANUAL" | "PRICING" | null;
      restriction: Omit<RateRestriction, "roomTypeId" | "date"> | null;
      sellable: number;
      booked: number;
      available: number;
      blocked: number;
    }[];
  }[];
  bands: RateRule[];
  occupancy: { date: string; sellable: number; booked: number; rate: number }[];
}

export interface QuoteInput {
  roomTypeId: string;
  arrivalDate: string;
  departureDate: string;
  ratePlanId?: string;
  promoCode?: string;
  corporateAccountId?: string;
  adults?: number;
  children?: number;
  channel?: RateChannel;
  guestPhone?: string;
  excludeReservationId?: string;
}

export interface StayQuote {
  roomType: TypeRef;
  ratePlan: { id: string; code: string; name: string; kind: RatePlanKind; includesBreakfast: boolean };
  nights: NightlyRate[];
  roomTotalKobo: number;
  breakdown: PriceBreakdown;
  promo: { code: string; description: string; type: PromoType; discountKobo: number } | null;
  promoError: { code: string; reason: PromoInvalidReason; message: string } | null;
  eligiblePlans: { id: string; code: string; name: string; kind: RatePlanKind; available: boolean; reason: string | null; totalKobo: number | null }[];
  warnings: { reason: "CLOSED_TO_ARRIVAL" | "CLOSED_TO_DEPARTURE" | "STOP_SELL" | "MIN_NIGHTS"; date: string; minNights?: number; message: string }[];
  available: number;
  corporateAccount: { id: string; name: string; ratePlanId: string | null } | null;
}

export interface PriceBreakdown {
  currency: "NGN";
  unit: "NIGHT" | "HOUR";
  rateKobo: number;
  units: number;
  lines: { date: string; description: string; amountKobo: number }[];
  roomSubtotalKobo: number;
  discountKobo: number;
  taxes: { code: string; label: string; amountKobo: number; inclusive?: boolean; rateBps?: number }[];
  taxTotalKobo: number;
  totalKobo: number;
  firstNightTotalKobo: number;
  nightly?: { date: string; rateKobo: number; discountKobo: number; ruleName: string | null }[];
  averageNightlyKobo?: number;
  promo?: { code: string; description: string; type: PromoType; discountKobo: number } | null;
  discountLines?: { date: string; description: string; amountKobo: number }[];
}

/* ---------- promotions ---------- */
export interface PromoCode {
  id: string;
  code: string;
  description: string;
  type: PromoType;
  value: number;
  validFrom: string | null;
  validTo: string | null;
  stayFrom: string | null;
  stayTo: string | null;
  minNights: number | null;
  maxUses: number | null;
  perGuestLimit: number | null;
  channels: RateChannel[];
  roomTypeIds: string[];
  firstBookingOnly: boolean;
  active: boolean;
  uses: number;
  held: number;
  discountGivenKobo: number;
  revenueKobo: number;
  status: "ACTIVE" | "SCHEDULED" | "EXPIRED" | "USED_UP" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

export interface PromoRedemption {
  id: string;
  reservationId: string;
  reservationCode: string;
  guestName: string;
  channel: RateChannel;
  status: PromoRedemptionStatus;
  discountKobo: number;
  nights: number;
  createdAt: string;
  confirmedAt: string | null;
  releasedAt: string | null;
}

export interface PromoDetail extends PromoCode {
  redemptions: PromoRedemption[];
  byChannel: Record<RateChannel, number>;
}

export type PromoInput = Partial<Omit<PromoCode, "id" | "uses" | "held" | "discountGivenKobo" | "revenueKobo" | "status" | "createdAt" | "updatedAt">>;

/* ---------- corporate + city ledger ---------- */
export interface CorporateAccount {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  address: string;
  taxId: string;
  ratePlan: { id: string; code: string; name: string } | null;
  creditLimitKobo: number;
  paymentTermsDays: number;
  billingCycle: BillingCycle;
  active: boolean;
  notes: string;
  outstandingKobo: number;
  uninvoicedKobo: number;
  availableCreditKobo: number;
  overdueKobo: number;
  aging: Record<AgingBucket, number>;
  stays: { upcoming: number; inHouse: number; last90Days: number };
  createdAt: string;
  updatedAt: string;
}

export interface CorporateInput {
  name?: string;
  contactName?: string;
  email?: string;
  phone?: string;
  address?: string;
  taxId?: string;
  ratePlanId?: string | null;
  creditLimitKobo?: number;
  paymentTermsDays?: number;
  billingCycle?: BillingCycle;
  notes?: string;
  active?: boolean;
}

export interface CityLedgerCharge {
  id: string;
  accountId: string;
  reservationId: string | null;
  reservationCode: string | null;
  guestName: string | null;
  folioId: string | null;
  date: string;
  description: string;
  amountKobo: number;
  invoiceId: string | null;
  invoiceNumber: string | null;
  createdAt: string;
}

export interface CityLedgerInvoice {
  id: string;
  number: string;
  kind: CityLedgerInvoiceKind;
  account: { id: string; name: string };
  periodFrom: string | null;
  periodTo: string | null;
  issueDate: string;
  dueDate: string;
  totalKobo: number;
  paidKobo: number;
  balanceKobo: number;
  status: CityLedgerInvoiceStatus;
  daysOutstanding: number;
  bucket: AgingBucket;
  overdue: boolean;
  remindersSent: number;
  lastReminderAt: string | null;
  createdAt: string;
}

export interface CityLedgerPayment {
  id: string;
  accountId: string;
  invoiceId: string | null;
  invoiceNumber: string | null;
  amountKobo: number;
  method: LedgerPaymentMethod;
  reference: string | null;
  receivedAt: string;
  note: string | null;
  recordedBy: UserRef | null;
  createdAt: string;
}

export interface CorporateDetail extends CorporateAccount {
  invoices: CityLedgerInvoice[];
  uninvoiced: CityLedgerCharge[];
  recentPayments: CityLedgerPayment[];
}

export interface HotelHeaderLite {
  name: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  logoUrl?: string | null;
  taxId?: string | null;
  [k: string]: unknown;
}

export interface CityLedgerInvoiceDocument extends CityLedgerInvoice {
  hotel: HotelHeaderLite;
  billTo: { name: string; contactName: string; email: string; phone: string; address: string; taxId: string };
  lines: { date: string; reservationCode: string | null; guestName: string | null; description: string; amountKobo: number }[];
  payments: { date: string; method: LedgerPaymentMethod; reference: string | null; amountKobo: number }[];
  notes: string;
  issuedBy: UserRef | null;
  currency: "NGN";
}

export interface CityLedgerSummary {
  outstandingKobo: number;
  uninvoicedKobo: number;
  overdueKobo: number;
  aging: Record<AgingBucket, number>;
  accounts: (Pick<CorporateAccount, "id" | "name" | "creditLimitKobo" | "outstandingKobo" | "availableCreditKobo" | "overdueKobo" | "aging"> & { overLimit: boolean })[];
}

/* ---------- whatsapp + notifications ---------- */
export interface WhatsAppTemplates {
  provider: "cloud" | "outbox";
  templates: {
    name: WhatsAppTemplateName;
    language: "en";
    category: "UTILITY" | "AUTHENTICATION";
    body: string;
    params: { index: number; name: string; example: string }[];
    buttons: { type: "URL" | "QUICK_REPLY" | "COPY_CODE"; text: string; url?: string }[];
    usedFor: string;
    status: "APPROVED" | "SUBMITTED" | "NOT_SUBMITTED";
  }[];
}

export interface GuardAlert {
  id: string;
  status: GuardAlertStatus;
  urgent: boolean;
  flags: { id: string; rule: string; title: string; severity: string; amountKobo: number | null }[];
  recipients: string[];
  channel: "WHATSAPP";
  template: "guard_alert_high";
  scheduledFor: string;
  sentAt: string | null;
  deferredReason: "QUIET_HOURS" | null;
  acknowledgedAt: string | null;
  acknowledgedBy: UserRef | null;
  error: string | null;
  createdAt: string;
}

export interface NotificationSettings {
  guardAlerts: {
    enabled: boolean;
    recipients: { owners: boolean; managers: boolean; userIds: string[] };
    channels: ("WHATSAPP" | "EMAIL")[];
    debounceMinutes: number;
    urgentRules: string[];
    urgentAmountKobo: number;
  };
  quietHours: { enabled: boolean; start: string; end: string };
  digest: { enabled: boolean; recipients: string[]; channel: "WHATSAPP"; sendAt: string };
  recipientsPreview: { userId: string; fullName: string; role: string; phoneMasked: string | null; willReceive: boolean; reason: string | null }[];
  features: { ownerWhatsappAlerts: boolean; whatsappMessaging: boolean };
  updatedAt: string | null;
}

export type NotificationSettingsInput = {
  guardAlerts?: Partial<NotificationSettings["guardAlerts"]>;
  quietHours?: Partial<NotificationSettings["quietHours"]>;
  digest?: Partial<Pick<NotificationSettings["digest"], "enabled" | "recipients">>;
};

export interface DashboardM4 {
  housekeeping: { open: number; inProgress: number; awaitingInspection: number; urgent: number } | null;
  maintenance: { open: number; overdue: number; blockedRooms: number } | null;
}

export interface RateOverrideInput {
  roomTypeIds: string[];
  from: string;
  to: string;
  daysOfWeek?: number[];
  rateKobo: number | null;
  note?: string;
}

export interface RestrictionInput {
  roomTypeIds: string[] | null;
  from: string;
  to: string;
  daysOfWeek?: number[];
  closedToArrival?: boolean;
  closedToDeparture?: boolean;
  stopSell?: boolean;
  minNights?: number | null;
}
