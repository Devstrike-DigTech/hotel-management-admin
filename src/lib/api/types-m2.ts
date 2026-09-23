/* The M2 contract (scratchpad API-M2.md) as TypeScript. Money in kobo, rates in basis points. */

import type { Paginated, RoomStatus } from "./types";
import type { OnlineBookingInfo, OnlineCounts, OnlineFields } from "./types-m3";
import type {
  FlagStatus,
  FolioEntryType,
  GuardRule,
  IdType,
  PaymentMethod,
  Purpose,
  ReservationSource,
  ReservationStatus,
  Severity,
  ShiftStatus,
} from "@/lib/catalog-m2";

export type { Paginated };
export type StayType = "NIGHTLY" | "DAY_USE";
export type Gender = "MALE" | "FEMALE" | "UNDISCLOSED";
export type FolioKind = "RESERVATION" | "WALK_IN";
export type FolioStatus = "OPEN" | "CLOSED";
export type TaxCode = "VAT" | "CONSUMPTION" | "SERVICE_CHARGE";
export type GuestInvoiceKind = "PROFORMA" | "FINAL";
export type HousekeepingTaskStatus = "PENDING" | "IN_PROGRESS" | "DONE";
export type DigestChannel = "WHATSAPP" | "LOG";
export type DigestStatus = "SENT" | "LOGGED" | "FAILED";
export type NightAuditStatus = "RUNNING" | "COMPLETED" | "FAILED";

export type UserRef = { id: string; fullName: string };
export type RoomRef = { id: string; number: string; floor: number; status: RoomStatus };
export type TypeRef = { id: string; name: string };

/* ---------- reservations ---------- */

export interface Registration {
  arrivingFrom: string;
  goingTo: string;
  purpose: Purpose;
  vehiclePlate: string | null;
  completedAt: string | null;
  completedBy: UserRef | null;
}

export interface GuestLite {
  id: string;
  fullName: string;
  phone: string | null;
  vip: boolean;
}

export interface ReservationListItem extends OnlineFields {
  id: string;
  code: string;
  status: ReservationStatus;
  stayType: StayType;
  source: ReservationSource;
  arrivalAt: string;
  departureAt: string;
  arrivalDate: string;
  departureDate: string;
  nights: number | null;
  hours: number | null;
  adults: number;
  children: number;
  rateKobo: number;
  guest: GuestLite;
  roomType: TypeRef;
  room: RoomRef | null;
  folioId: string;
  balanceKobo: number;
  registrationComplete: boolean;
  checkedInAt: string | null;
  checkedOutAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReservationDetail extends Omit<ReservationListItem, "guest"> {
  notes: string;
  estimatedTotalKobo: number;
  registration: Registration | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  noShowAt: string | null;
  clientCreatedAt: string | null;
  createdBy: UserRef | null;
  guest: Guest;
  /** M3: set for bookings made online (marketplace or booking site) */
  online?: OnlineBookingInfo | null;
}

export interface ReservationInput {
  guestId?: string;
  guest?: GuestInput;
  roomTypeId: string;
  roomId?: string;
  stayType?: StayType;
  arrivalDate?: string;
  departureDate?: string;
  arrivalAt?: string;
  departureAt?: string;
  adults?: number;
  children?: number;
  source?: ReservationSource;
  status?: "PENDING" | "CONFIRMED";
  rateKobo?: number;
  notes?: string;
  clientCreatedAt?: string;
}

export interface ReservationPatch {
  arrivalDate?: string;
  departureDate?: string;
  arrivalAt?: string;
  departureAt?: string;
  roomTypeId?: string;
  roomId?: string | null;
  adults?: number;
  children?: number;
  source?: ReservationSource;
  notes?: string;
  rateKobo?: number;
}

export interface ReservationQuery {
  status?: string;
  from?: string;
  to?: string;
  q?: string;
  roomId?: string;
  roomTypeId?: string;
  stayType?: StayType | "";
  source?: ReservationSource | "";
  guestId?: string;
  page?: number;
  pageSize?: number;
}

export interface RegistrationInput {
  arrivingFrom: string;
  goingTo: string;
  purpose: Purpose;
  vehiclePlate?: string;
}

export interface CheckInInput {
  roomId?: string;
  guest?: GuestUpdate;
  registration?: RegistrationInput;
  registerLater?: boolean;
  deposit?: { amountKobo: number; method: PaymentMethod; reference?: string };
  override?: { reason: string };
  clientCreatedAt?: string;
}

export interface CheckOutResult {
  reservation: ReservationDetail;
  invoice: InvoiceDocument;
}

/* ---------- availability + tape chart ---------- */

export interface AvailabilityDay {
  date: string;
  sellable: number;
  outOfOrder: number;
  booked: number;
  available: number;
}
export interface Availability {
  from: string;
  to: string;
  roomTypes: {
    roomType: TypeRef & { basePriceKobo: number; hourlyPriceKobo: number | null };
    totalRooms: number;
    days: AvailabilityDay[];
  }[];
}

export type NotReadyReason = "OUT_OF_ORDER" | "OCCUPIED" | "BOOKED" | "DIRTY";

export interface RoomAvailability {
  roomTypeId: string;
  forCheckIn?: boolean;
  available: number;
  rooms: (RoomRef & {
    free: boolean;
    clean: boolean;
    /** M2.1: free && clean && nobody checked in right now */
    checkInReady?: boolean;
    occupiedUntil?: string | null;
    reason?: NotReadyReason | null;
  })[];
}

export interface TapeStay extends OnlineFields {
  reservationId: string;
  code: string;
  roomId: string | null;
  roomTypeId: string;
  status: ReservationStatus;
  stayType: StayType;
  arrivalAt: string;
  departureAt: string;
  guestName: string;
  vip: boolean;
  adults: number;
  children: number;
  source: ReservationSource;
  balanceKobo: number;
}

export interface TapeChart {
  from: string;
  to: string;
  today: string;
  checkInTime: string;
  checkOutTime: string;
  rooms: (RoomRef & { roomType: TypeRef })[];
  roomTypes: (TypeRef & { roomCount: number })[];
  stays: TapeStay[];
  unassigned: TapeStay[];
}

/* ---------- front desk today ---------- */

export interface TodayStay extends OnlineFields {
  id: string;
  code: string;
  status: ReservationStatus;
  stayType: StayType;
  source: ReservationSource;
  guest: GuestLite;
  room: RoomRef | null;
  roomType: TypeRef;
  arrivalAt: string;
  departureAt: string;
  adults: number;
  children: number;
  balanceKobo: number;
  registrationComplete: boolean;
  overdue: boolean;
}

export interface FrontDeskToday {
  businessDate: string;
  arrivals: TodayStay[];
  inHouse: TodayStay[];
  departures: TodayStay[];
  dayUse: TodayStay[];
  counts: {
    arrivals: number;
    arrivalsPending: number;
    inHouse: number;
    departures: number;
    departuresPending: number;
    dayUse: number;
  };
  rooms: { total: number; byStatus: Record<RoomStatus, number> };
  openFlags: number | null;
  myShift: Shift | null;
  /** M3 */
  online?: OnlineCounts;
}

/* ---------- guests ---------- */

export interface Guest {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  gender: Gender | null;
  dateOfBirth: string | null;
  nationality: string;
  address: string | null;
  idType: IdType | null;
  idNumberMasked: string | null;
  hasIdImage: boolean;
  vehiclePlate: string | null;
  company: string | null;
  vip: boolean;
  notes: string;
  consentAt: string | null;
  marketingOptIn: boolean;
  anonymisedAt: string | null;
  stayCount: number;
  lastStayAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GuestDetail extends Guest {
  stays: ReservationListItem[];
}

export interface GuestInput {
  fullName: string;
  phone: string;
  email?: string;
  gender?: Gender;
  dateOfBirth?: string;
  nationality?: string;
  address?: string;
  idType?: IdType;
  idNumber?: string;
  vehiclePlate?: string;
  company?: string;
  vip?: boolean;
  notes?: string;
  consent?: boolean;
  marketingOptIn?: boolean;
}
export type GuestUpdate = Partial<GuestInput>;

export interface IdDocument {
  idType: IdType | null;
  idNumber: string | null;
  idImageUrl: string | null;
}

export interface RegisterRow {
  checkedInAt: string;
  checkedOutAt: string | null;
  roomNumber: string;
  reservationCode: string;
  guestName: string;
  phone: string | null;
  nationality: string;
  gender: Gender | null;
  idType: IdType | null;
  idNumber: string | null;
  address: string | null;
  arrivingFrom: string | null;
  goingTo: string | null;
  purpose: Purpose | null;
  vehiclePlate: string | null;
  company: string | null;
  adults: number;
  children: number;
  registeredBy: string | null;
}

/* ---------- taxes + folios ---------- */

export interface TaxComponent {
  enabled: boolean;
  rateBps: number;
  inclusive: boolean;
}
export interface TaxSettings {
  propertyId: string;
  vat: TaxComponent;
  consumptionTax: TaxComponent & { label: string };
  serviceCharge: TaxComponent;
  discountApprovalThresholdBps: number;
  updatedAt: string;
}
export type TaxSettingsPatch = Partial<Pick<TaxSettings, "vat" | "consumptionTax" | "serviceCharge" | "discountApprovalThresholdBps">>;

export interface FolioEntry {
  id: string;
  type: FolioEntryType;
  amountKobo: number;
  description: string;
  businessDate: string;
  parentEntryId: string | null;
  refEntryId: string | null;
  taxCode: TaxCode | null;
  rateBps: number | null;
  inclusive: boolean | null;
  paymentMethod: PaymentMethod | null;
  paymentRef: string | null;
  shiftId: string | null;
  receiptId: string | null;
  receiptNumber: string | null;
  reason: string | null;
  approvedBy: UserRef | null;
  voided: boolean;
  voidedByEntryId: string | null;
  voidReason: string | null;
  createdBy: UserRef | null;
  createdAt: string;
  clientCreatedAt: string | null;
  runningBalanceKobo: number;
}

export interface FolioTotals {
  chargesKobo: number;
  discountsKobo: number;
  taxKobo: number;
  serviceChargeKobo: number;
  paymentsKobo: number;
  refundsKobo: number;
  balanceKobo: number;
}

export interface Folio {
  id: string;
  kind: FolioKind;
  status: FolioStatus;
  name: string;
  reservation: {
    id: string;
    code: string;
    status: ReservationStatus;
    room: RoomRef | null;
    arrivalAt: string;
    departureAt: string;
    stayType: StayType;
  } | null;
  guest: { id: string; fullName: string; phone: string | null } | null;
  entries: FolioEntry[];
  totals: FolioTotals;
  invoices: { id: string; number: string; kind: GuestInvoiceKind; issuedAt: string; totalKobo: number }[];
  openedAt: string;
  closedAt: string | null;
}

export interface FolioListItem {
  id: string;
  kind: FolioKind;
  status: FolioStatus;
  name: string;
  reservationCode: string | null;
  roomNumber: string | null;
  balanceKobo: number;
  chargesKobo: number;
  paymentsKobo: number;
  openedAt: string;
  closedAt: string | null;
}

export interface ChargeInput {
  type?: "EXTRA" | "ROOM" | "DAY_USE";
  description: string;
  amountKobo: number;
  quantity?: number;
  taxable?: boolean;
  clientCreatedAt?: string;
}

export interface DiscountInput {
  mode: "AMOUNT" | "PERCENT";
  value: number;
  targetEntryId?: string;
  reason: string;
  approval?: { approverId: string; pin: string };
}

export interface PaymentInput {
  method: PaymentMethod;
  amountKobo: number;
  reference?: string;
  note?: string;
  clientCreatedAt?: string;
}

export interface RefundInput {
  method: "CASH" | "TRANSFER" | "POS";
  amountKobo: number;
  reason: string;
  reference?: string;
}

/* ---------- documents ---------- */

export interface HotelHeader {
  name: string;
  address: string;
  area: string;
  city: string;
  state: string;
  phone: string;
  email: string;
  logoUrl: string | null;
  accentColor: string | null;
  appName: string;
}

export interface InvoiceDocument {
  id: string;
  number: string;
  kind: GuestInvoiceKind;
  issuedAt: string;
  businessDate: string;
  hotel: HotelHeader;
  guest: { fullName: string; phone: string | null; email: string | null; company: string | null; address: string | null } | null;
  folio: { id: string; name: string };
  reservation: {
    code: string;
    roomNumber: string | null;
    roomTypeName: string;
    stayType: StayType;
    arrivalAt: string;
    departureAt: string;
    nights: number | null;
    hours: number | null;
    adults: number;
    children: number;
  } | null;
  lines: { date: string; type: "ROOM" | "DAY_USE" | "EXTRA" | "DISCOUNT"; description: string; amountKobo: number }[];
  taxes: { code: TaxCode; label: string; rateBps: number; inclusive: boolean; amountKobo: number }[];
  payments: { date: string; method: PaymentMethod; reference: string | null; receiptNumber: string | null; amountKobo: number }[];
  refunds: { date: string; method: PaymentMethod; amountKobo: number }[];
  totals: {
    subtotalKobo: number;
    discountKobo: number;
    taxKobo: number;
    serviceChargeKobo: number;
    totalKobo: number;
    paidKobo: number;
    balanceKobo: number;
  };
  issuedBy: UserRef | null;
  currency: "NGN";
}

export interface ReceiptDocument {
  id: string;
  number: string;
  issuedAt: string;
  hotel: HotelHeader;
  guestName: string | null;
  folioId: string;
  reservationCode: string | null;
  roomNumber: string | null;
  method: PaymentMethod;
  reference: string | null;
  amountKobo: number;
  amountInWords: string;
  folioBalanceAfterKobo: number;
  receivedBy: UserRef | null;
  voided: boolean;
  currency: "NGN";
}

export interface InvoiceListItem {
  id: string;
  number: string;
  kind: GuestInvoiceKind;
  issuedAt: string;
  guestName: string | null;
  reservationCode: string | null;
  totalKobo: number;
  balanceKobo: number;
}

export interface ReceiptListItem {
  id: string;
  number: string;
  issuedAt: string;
  guestName: string | null;
  reservationCode: string | null;
  method: PaymentMethod;
  amountKobo: number;
  voided: boolean;
}

export interface ShareLink {
  token: string;
  url: string;
  expiresAt: string;
  whatsappUrl: string | null;
}

export type PublicDocument = { type: "INVOICE"; document: InvoiceDocument } | { type: "RECEIPT"; document: ReceiptDocument };

/* ---------- shifts ---------- */

export interface Shift {
  id: string;
  status: ShiftStatus;
  user: UserRef;
  openedAt: string;
  closedAt: string | null;
  openingFloatKobo: number;
  countedCashKobo: number | null;
  declaredPosKobo: number | null;
  declaredTransferKobo: number | null;
  denominations: Record<string, number> | null;
  blind: boolean;
  expectedCashKobo: number | null;
  expectedPosKobo: number | null;
  expectedTransferKobo: number | null;
  varianceCashKobo: number | null;
  variancePosKobo: number | null;
  varianceTransferKobo: number | null;
  varianceTotalKobo: number | null;
  paymentsCount: number | null;
  notes: string;
  closeNotes: string | null;
  approvedBy: UserRef | null;
  approvedAt: string | null;
  approvalNotes: string | null;
}

export interface ShiftPayment {
  entryId: string;
  folioId: string;
  reservationCode: string | null;
  guestName: string | null;
  type: "PAYMENT" | "REFUND";
  method: PaymentMethod;
  amountKobo: number;
  reference: string | null;
  createdAt: string;
  voided: boolean;
}

export interface ShiftDetail extends Shift {
  payments: ShiftPayment[] | null;
}

export interface ShiftCloseInput {
  countedCashKobo: number;
  declaredPosKobo: number;
  declaredTransferKobo: number;
  denominations?: Record<string, number>;
  notes?: string;
}

export interface Approver {
  id: string;
  fullName: string;
  role: string;
}

/* ---------- revenue guard ---------- */

export interface GuardFlag {
  id: string;
  rule: GuardRule;
  severity: Severity;
  status: FlagStatus;
  title: string;
  detail: string;
  amountKobo: number | null;
  room: { id: string; number: string } | null;
  reservation: { id: string; code: string } | null;
  shiftId: string | null;
  user: UserRef | null;
  evidence: Record<string, unknown>;
  suggestion: string | null;
  resolvedBy: UserRef | null;
  resolvedAt: string | null;
  resolution: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GuardRuleInfo {
  rule: GuardRule;
  tier: "basic" | "full";
  enabled: boolean;
  title: string;
  description: string;
  defaultSeverity: Severity;
}

export interface GuardSummary {
  open: number;
  bySeverity: Record<Severity, number>;
  byRule: Partial<Record<GuardRule, number>>;
}

/* ---------- digests ---------- */

export interface DigestData {
  businessDate: string;
  hotelName: string;
  roomsSold: number;
  roomsAvailable: number;
  occupancyRate: number;
  dayUseCount: number;
  arrivals: number;
  departures: number;
  roomRevenueKobo: number;
  totalRevenueKobo: number;
  revenueByMethod: Record<PaymentMethod, number>;
  paymentsTotalKobo: number;
  openFlags: number;
  topFlags: { rule: GuardRule; severity: Severity; title: string }[];
}

export interface Digest {
  id: string;
  businessDate: string;
  channel: DigestChannel;
  status: DigestStatus;
  recipients: string[];
  body: string;
  data: DigestData;
  error: string | null;
  createdAt: string;
}

export interface DigestSettings {
  enabled: boolean;
  recipients: string[];
}

/* ---------- night audit + reports ---------- */

export interface NightAuditRun {
  id: string;
  businessDate: string;
  status: NightAuditStatus;
  trigger: "SCHEDULED" | "MANUAL";
  startedAt: string;
  finishedAt: string | null;
  summary: { roomChargesPosted: number; roomChargesKobo: number; noShows: number; flagsCreated: number } | null;
  error: string | null;
  runBy: UserRef | null;
}

export interface DailyFlash {
  date: string;
  live: boolean;
  roomsTotal: number;
  roomsOutOfOrder: number;
  roomsAvailable: number;
  /** M2.1: in-house nightly stays for the night */
  roomsSold: number;
  occupancyRate: number;
  /** M2.1: room nights with a posted ROOM charge, and their revenue (ADR uses these) */
  roomNightsPosted?: number;
  roomRevenuePostedKobo?: number;
  adrKobo: number;
  revparKobo: number;
  roomRevenueKobo: number;
  dayUseRevenueKobo: number;
  otherRevenueKobo: number;
  discountKobo: number;
  taxKobo: number;
  serviceChargeKobo: number;
  totalRevenueKobo: number;
  paymentsByMethod: Record<PaymentMethod, number>;
  paymentsTotalKobo: number;
  refundsKobo: number;
  dayUseCount: number;
  arrivals: number;
  departures: number;
  noShows: number;
  cancellations: number;
  guestsInHouse: number;
  openFlags: number;
}

export interface RangeReport {
  from: string;
  to: string;
  days: DailyFlash[];
  totals: Omit<DailyFlash, "date" | "live" | "roomsTotal" | "roomsOutOfOrder" | "guestsInHouse" | "openFlags">;
}

export interface PaymentsReport {
  from: string;
  to: string;
  totalKobo: number;
  byMethod: { method: PaymentMethod; count: number; amountKobo: number }[];
  byUser: { user: UserRef; method: PaymentMethod; count: number; amountKobo: number }[];
  byDay: { date: string; amountKobo: number; byMethod: Record<PaymentMethod, number> }[];
}

export interface ShiftsReport {
  from: string;
  to: string;
  items: Shift[];
  totals: {
    shifts: number;
    openingFloatKobo: number;
    expectedCashKobo: number;
    countedCashKobo: number;
    varianceCashKobo: number;
    variancePosKobo: number;
    varianceTransferKobo: number;
    flagged: number;
  };
}

export interface HousekeepingTaskM2 {
  id: string;
  room: RoomRef;
  status: HousekeepingTaskStatus;
  reason: "CHECKOUT" | "ROOM_MOVE" | "MANUAL";
  reservationCode: string | null;
  notes: string;
  createdAt: string;
  completedAt: string | null;
  completedBy: UserRef | null;
}
