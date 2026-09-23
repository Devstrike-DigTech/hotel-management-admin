/* The M5 contract (API-M5.md): multi-property, point of sale, channel manager, dynamic pricing,
   the guest WhatsApp inbox, loyalty and custom domains. */

import type { ReservationStatus } from "@/lib/catalog-m2";
import type { Folio, Guest, ReceiptDocument, ReservationListItem, UserRef } from "./types-m2";
import type { MaintenanceCategory, TaskPriority, WhatsAppTemplateName } from "./types-m4";
import type { RoomStatus } from "./types";

export type { Paginated } from "./types";

export type PropertyRef = { id: string; name: string; slug: string };

export type OutletType = "RESTAURANT" | "BAR" | "POOL_BAR" | "ROOM_SERVICE" | "MINIBAR" | "LAUNDRY" | "SPA" | "OTHER";
export type KdsStation = "KITCHEN" | "BAR" | "NONE";
export type PosOrderStatus = "OPEN" | "SETTLED" | "CANCELLED";
export type PosLineStatus = "PENDING" | "SENT" | "VOIDED";
export type KdsTicketStatus = "NEW" | "PREPARING" | "READY" | "SERVED" | "CANCELLED";
export type PosSettlement = "PAYMENT" | "ROOM_CHARGE" | "CITY_LEDGER" | "COMPLIMENTARY";
export type PosTenderMethod = "CASH" | "TRANSFER" | "POS";
export type StockMovementType = "PURCHASE" | "SALE" | "VOID_RETURN" | "WASTE" | "ADJUSTMENT" | "COUNT" | "MINIBAR";

export type ChannelProviderKind = "ICAL" | "CHANNEX";
export type OtaChannel = "AIRBNB" | "BOOKING_COM" | "EXPEDIA" | "AGODA" | "VRBO" | "HOTELS_NG" | "OTHER";
export type ChannelConnectionStatus = "ACTIVE" | "PAUSED" | "ERROR";
export type SyncDirection = "PUSH" | "PULL" | "WEBHOOK";
export type SyncKind = "ARI" | "BOOKING" | "ICAL_IMPORT" | "CONNECT" | "MAPPING";
export type SyncStatus = "OK" | "ERROR" | "SKIPPED";
export type ChannelBookingStatus = "NEW" | "MODIFIED" | "CANCELLED";

export type PricingMode = "OFF" | "SUGGEST" | "AUTOPILOT";
export type SuggestionStatus = "PENDING" | "ACCEPTED" | "REJECTED" | "APPLIED" | "SUPERSEDED" | "EXPIRED";
export type PriceChangeSource = "ACCEPTED" | "AUTOPILOT" | "REVERT";
export type PricingFactorCode = "OCCUPANCY" | "PACE" | "LEAD_TIME" | "DAY_OF_WEEK" | "EVENT" | "COMPETITOR" | "GUARDRAIL";
export type EventImpact = "LOW" | "MEDIUM" | "HIGH" | "VERY_HIGH";

export type ConversationStatus = "OPEN" | "PENDING" | "CLOSED";
export type MessageDirection = "INBOUND" | "OUTBOUND" | "NOTE" | "SYSTEM";
export type MessageStatus = "RECEIVED" | "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "OUTBOX";
export type TaskSuggestionKind = "HOUSEKEEPING" | "MAINTENANCE";
export type TaskSuggestionStatus = "PENDING" | "CREATED" | "DISMISSED";

export type LoyaltyTxnType = "EARN" | "REDEEM" | "EXPIRE" | "ADJUST" | "REVERSAL";
export type LoyaltyEnrolSource = "DESK" | "CHECK_IN" | "ONLINE";

export type DomainStatus = "PENDING" | "VERIFIED" | "FAILED";
export type DomainCheckFailure = "TXT_MISSING" | "TXT_MISMATCH" | "CNAME_MISSING" | "CNAME_MISMATCH" | "DNS_ERROR";

export type TaxLine = { code: "VAT" | "CONSUMPTION" | "SERVICE_CHARGE"; label: string; rateBps: number; inclusive: boolean; amountKobo: number };

/* ---------- 1. multi-property ---------- */

export interface PropertySummary {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
  area: string;
  isPrimary: boolean;
  invoicePrefix: string | null;
  coverImageUrl: string | null;
  roomCount: number;
  listedOnMarketplace: boolean;
  customDomain: string | null;
  createdAt: string;
}
export interface PropertyAccess {
  allProperties: boolean;
  propertyIds: string[];
}
export interface GroupInfo {
  slug: string;
  name: string;
  propertyCount: number;
}
export interface MeM5 {
  currentProperty?: PropertySummary;
  properties?: PropertySummary[];
  propertyAccess?: PropertyAccess;
  group?: GroupInfo;
}

export interface PropertyCreateInput {
  name: string;
  city: string;
  state: string;
  area?: string;
  address?: string;
  phone?: string;
  email?: string;
  checkInTime?: string;
  checkOutTime?: string;
  slug?: string;
  invoicePrefix?: string;
  tagline?: string;
  description?: string;
  copyFromPropertyId?: string;
}

export interface GroupRow {
  roomsAvailable: number;
  roomsSold: number;
  occupancyRate: number;
  adrKobo: number;
  revparKobo: number;
  roomRevenueKobo: number;
  posRevenueKobo: number;
  otherRevenueKobo: number;
  totalRevenueKobo: number;
  paymentsKobo: number;
  reservations: number;
  otaCommissionKobo: number;
}
export interface GroupReport {
  from: string;
  to: string;
  properties: (GroupRow & { property: PropertySummary })[];
  totals: GroupRow;
  byDay: {
    date: string;
    occupancyRate: number;
    roomRevenueKobo: number;
    totalRevenueKobo: number;
    byProperty: Record<string, { occupancyRate: number; roomRevenueKobo: number; totalRevenueKobo: number }>;
  }[];
}
export interface GroupDashboard {
  date: string;
  properties: {
    property: PropertySummary;
    rooms: { total: number; byStatus: Record<RoomStatus, number> };
    occupancyRate: number;
    arrivals: number;
    departures: number;
    inHouse: number;
    openFlags: number;
    unreadMessages: number;
    openPosOrders: number;
    roomRevenueTodayKobo: number;
    posRevenueTodayKobo: number;
  }[];
  totals: {
    rooms: number;
    occupancyRate: number;
    arrivals: number;
    departures: number;
    inHouse: number;
    openFlags: number;
    roomRevenueTodayKobo: number;
    posRevenueTodayKobo: number;
  };
}

/* ---------- 2. point of sale ---------- */

export interface Outlet {
  id: string;
  propertyId: string;
  name: string;
  code: string;
  type: OutletType;
  active: boolean;
  defaultStation: KdsStation;
  serviceChargeApplies: boolean;
  allowRoomCharge: boolean;
  allowCityLedger: boolean;
  sortOrder: number;
  openOrders: number;
}
export type OutletInput = Partial<Omit<Outlet, "id" | "propertyId" | "openOrders">> & { name?: string; code?: string; type?: OutletType };

export interface ModifierOption {
  id: string;
  name: string;
  priceKobo: number;
}
export interface ModifierGroup {
  id: string;
  name: string;
  required: boolean;
  multiple: boolean;
  options: ModifierOption[];
}
export interface MenuCategory {
  id: string;
  name: string;
  station: KdsStation | null;
  sortOrder: number;
  itemCount: number;
}
export interface MenuItem {
  id: string;
  propertyId: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  priceKobo: number;
  outletIds: string[];
  available: boolean;
  vat: boolean;
  consumptionTax: boolean;
  modifiers: ModifierGroup[];
  station: KdsStation | null;
  stockLinks: { stockItemId: string; stockItemName: string; unit: string; quantity: number }[];
  imageUrl: string | null;
  sortOrder: number;
}
export interface MenuItemInput {
  categoryId?: string;
  name?: string;
  description?: string;
  priceKobo?: number;
  outletIds?: string[];
  available?: boolean;
  vat?: boolean;
  consumptionTax?: boolean;
  modifiers?: { name: string; required: boolean; multiple: boolean; options: { name: string; priceKobo: number }[] }[];
  station?: KdsStation | null;
  stockLinks?: { stockItemId: string; quantity: number }[];
  imageUrl?: string | null;
  sortOrder?: number;
}
export interface PriceRule {
  id: string;
  name: string;
  active: boolean;
  outletIds: string[];
  categoryIds: string[];
  itemIds: string[];
  daysOfWeek: number[];
  startTime: string;
  endTime: string;
  adjustmentType: "PERCENT" | "AMOUNT" | "FIXED";
  value: number;
}
export type TerminalItem = MenuItem & { currentPriceKobo: number; happyHour: { ruleId: string; name: string; endsAt: string } | null };
export interface TerminalMenu {
  outlet: Outlet;
  categories: (MenuCategory & { items: TerminalItem[] })[];
  serverTime: string;
}

export interface PosLine {
  id: string;
  itemId: string;
  name: string;
  categoryName: string;
  quantity: number;
  unitPriceKobo: number;
  basePriceKobo: number;
  modifiers: { groupId: string; group: string; optionId: string; option: string; priceKobo: number }[];
  note: string;
  station: KdsStation;
  status: PosLineStatus;
  lineTotalKobo: number;
  sentAt: string | null;
  ticketId: string | null;
  voidedAt: string | null;
  voidReason: string | null;
  voidedBy: UserRef | null;
  approvedBy: UserRef | null;
  addedBy: UserRef | null;
  createdAt: string;
}
export interface PosTotals {
  itemsKobo: number;
  discountKobo: number;
  netKobo: number;
  taxes: TaxLine[];
  taxTotalKobo: number;
  totalKobo: number;
  paidKobo: number;
  dueKobo: number;
}
export type PosPaymentMethod = PosTenderMethod | "ROOM_CHARGE" | "CITY_LEDGER" | "COMPLIMENTARY";
export interface PosOrder {
  id: string;
  propertyId: string;
  number: string;
  outlet: { id: string; name: string; code: string; type: OutletType };
  status: PosOrderStatus;
  tableLabel: string | null;
  room: { id: string; number: string } | null;
  reservation: { id: string; code: string; guestName: string } | null;
  guestName: string | null;
  covers: number;
  lines: PosLine[];
  discount: { mode: "AMOUNT" | "PERCENT"; value: number; amountKobo: number; reason: string; approvedBy: UserRef | null } | null;
  totals: PosTotals;
  settlement: PosSettlement | null;
  payments: { method: PosPaymentMethod; amountKobo: number; reference: string | null; receiptId: string | null; receiptNumber: string | null }[];
  folioId: string | null;
  corporateAccount: { id: string; name: string } | null;
  openedBy: UserRef | null;
  openedAt: string;
  settledAt: string | null;
  settledBy: UserRef | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  splitFromOrderId: string | null;
  notes: string;
  clientCreatedAt: string | null;
  updatedAt: string;
}
export type PosOrderListItem = Pick<PosOrder, "id" | "number" | "outlet" | "status" | "tableLabel" | "room" | "guestName" | "covers" | "openedAt" | "settledAt" | "settlement"> & {
  totalKobo: number;
  dueKobo: number;
  itemCount: number;
  pendingItems: number;
  openedBy: UserRef | null;
};
export interface LineInput {
  itemId: string;
  quantity: number;
  modifierOptionIds?: string[];
  note?: string;
}
export interface OrderCreateInput {
  id?: string;
  outletId: string;
  tableLabel?: string;
  roomId?: string;
  reservationId?: string;
  guestName?: string;
  covers?: number;
  notes?: string;
  lines?: LineInput[];
  send?: boolean;
}
export interface KdsTicketWire {
  id: string;
  number: string;
  station: KdsStation;
  status: KdsTicketStatus;
  order: { id: string; number: string; tableLabel: string | null; roomNumber: string | null; guestName: string | null; outletName: string };
  lines: { lineId: string; name: string; quantity: number; modifiers: string[]; note: string; voided: boolean }[];
  server: UserRef | null;
  createdAt: string;
  startedAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  elapsedSec: number;
}
export interface InHouseForPos {
  reservationId: string;
  code: string;
  room: { id: string; number: string };
  guestName: string;
  guestPhoneLast4: string | null;
  departureDate: string;
  balanceKobo: number;
  vip: boolean;
  loyaltyTier: string | null;
}
export interface SettleInput {
  payments?: { method: PosTenderMethod; amountKobo: number; reference?: string }[];
  tipKobo?: number;
  roomCharge?: { reservationId: string; guestName?: string; signatureDataUrl?: string; override?: { reason: string } };
  cityLedger?: { corporateAccountId: string; signedBy?: string; reference?: string };
  complimentary?: { reason: string };
  clientCreatedAt?: string;
}
export type PosReceipt = ReceiptDocument & {
  pos?: { orderNumber: string; outlet: string; tableLabel: string | null; lines: { name: string; quantity: number; unitPriceKobo: number; lineTotalKobo: number }[]; tipKobo: number } | null;
};
export interface SettleResult {
  order: PosOrder;
  receipts: PosReceipt[];
  folioId: string;
}

export interface StockItem {
  id: string;
  name: string;
  unit: string;
  category: string;
  sku: string | null;
  onHand: number;
  reorderLevel: number;
  parLevel: number | null;
  unitCostKobo: number;
  valueKobo: number;
  lowStock: boolean;
  active: boolean;
  updatedAt: string;
}
export interface StockMovement {
  id: string;
  stockItemId: string;
  stockItemName: string;
  type: StockMovementType;
  quantity: number;
  unitCostKobo: number | null;
  reference: string | null;
  note: string;
  orderId: string | null;
  createdBy: UserRef | null;
  createdAt: string;
}
export interface StockCount {
  id: string;
  countedAt: string;
  note: string;
  countedBy: UserRef | null;
  lines: { stockItemId: string; name: string; unit: string; expected: number; counted: number; variance: number; varianceValueKobo: number }[];
  varianceValueKobo: number;
  flagged: boolean;
}
export interface StockVariance {
  from: string;
  to: string;
  items: { stockItemId: string; name: string; unit: string; opening: number; purchased: number; sold: number; minibar: number; wasted: number; adjusted: number; countVariance: number; closing: number; varianceValueKobo: number }[];
  totals: { purchasedKobo: number; soldCostKobo: number; wasteKobo: number; countVarianceKobo: number };
}
export interface MinibarPar {
  roomTypeId: string;
  items: { itemId: string; name: string; priceKobo: number; parQty: number }[];
}
export interface MinibarRoom {
  room: { id: string; number: string };
  stay: { reservationId: string; code: string; guestName: string } | null;
  items: { itemId: string; name: string; priceKobo: number; parQty: number }[];
}

export interface PosSalesReport {
  from: string;
  to: string;
  totals: { orders: number; covers: number; itemsSold: number; grossKobo: number; discountKobo: number; netKobo: number; taxKobo: number; totalKobo: number; voidCount: number; voidKobo: number; avgOrderKobo: number; tipsKobo: number };
  byOutlet: { outlet: { id: string; name: string; type: OutletType }; orders: number; netKobo: number; totalKobo: number }[];
  byItem: { itemId: string; name: string; category: string; quantity: number; netKobo: number }[];
  byCategory: { category: string; quantity: number; netKobo: number }[];
  byHour: { hour: number; orders: number; netKobo: number }[];
  byDay: { date: string; orders: number; netKobo: number }[];
  bySettlement: { settlement: PosPaymentMethod; count: number; amountKobo: number }[];
  byCashier: { user: UserRef; orders: number; totalKobo: number; voids: number }[];
  voids: { orderNumber: string; itemName: string; quantity: number; amountKobo: number; reason: string; voidedBy: UserRef | null; approvedBy: UserRef | null; voidedAt: string; afterSend: boolean }[];
}

/* ---------- 3. channel manager ---------- */

export interface ChannelConnection {
  id: string;
  propertyId: string;
  provider: ChannelProviderKind;
  name: string;
  channel: OtaChannel | null;
  status: ChannelConnectionStatus;
  mock: boolean;
  externalPropertyId: string | null;
  settings: { stopSellBuffer: number; commissionBps: Partial<Record<OtaChannel, number>>; pushRates: boolean; pushRestrictions: boolean; horizonDays: number };
  lastSyncAt: string | null;
  lastError: string | null;
  lastErrorAt: string | null;
  pendingPush: boolean;
  mapping: { mappedRoomTypes: number; totalRoomTypes: number; mappedRatePlans: number; pct: number };
  bookings30d: number;
  createdAt: string;
}
export interface IcalFeed {
  id: string;
  scope: "ROOM" | "ROOM_TYPE";
  room: { id: string; number: string } | null;
  roomType: { id: string; name: string };
  url: string;
  lastFetchedAt: string | null;
  lastStatus: "OK" | "ERROR" | null;
  lastError: string | null;
  eventsCount: number;
}
export interface IcalExport {
  scope: "ROOM" | "ROOM_TYPE";
  room: { id: string; number: string } | null;
  roomType: { id: string; name: string };
  url: string;
}
export interface ChannelMapping {
  id: string;
  roomType: { id: string; name: string };
  ratePlan: { id: string; name: string; code: string } | null;
  externalRoomTypeId: string;
  externalRoomTypeName: string | null;
  externalRatePlanId: string | null;
  externalRatePlanName: string | null;
}
export interface RemoteCatalogue {
  roomTypes: { id: string; title: string }[];
  ratePlans: { id: string; title: string; roomTypeId: string }[];
}
export interface SyncLog {
  id: string;
  connectionId: string;
  direction: SyncDirection;
  kind: SyncKind;
  status: SyncStatus;
  summary: string;
  items: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}
export interface ChannelBooking {
  id: string;
  connectionId: string;
  provider: ChannelProviderKind;
  channel: OtaChannel;
  externalId: string;
  status: ChannelBookingStatus;
  reservation: { id: string; code: string; status: ReservationStatus; arrivalDate: string; departureDate: string; guestName: string; roomNumber: string | null } | null;
  grossKobo: number | null;
  commissionKobo: number | null;
  commissionBps: number | null;
  overbooked: boolean;
  receivedAt: string;
  updatedAt: string;
}
export interface ChannelCost {
  month: string;
  ota: {
    bookings: number;
    roomNights: number;
    revenueKobo: number;
    commissionKobo: number;
    byChannel: { channel: OtaChannel; bookings: number; roomNights: number; revenueKobo: number; commissionKobo: number; effectiveBps: number }[];
  };
  direct: { bookings: number; revenueKobo: number; bookingSite: { bookings: number; revenueKobo: number }; marketplace: { bookings: number; revenueKobo: number; commissionKobo: number } };
  directCostEstimateKobo: number;
  savingsKobo: number;
  headline: string;
}
export interface ChannelSummary {
  connections: ChannelConnection[];
  bookingsByChannel30d: { channel: OtaChannel; bookings: number; roomNights: number; revenueKobo: number; commissionKobo: number }[];
  errors24h: number;
  lastSyncAt: string | null;
  cost: ChannelCost;
}

/* ---------- 4. dynamic pricing ---------- */

export interface PricingSettings {
  mode: PricingMode;
  horizonDays: number;
  minChangeBps: number;
  paceSpikeEnabled: boolean;
  paceSpikeRooms: number;
  lastRunAt: string | null;
  nextRunAt: string | null;
}
export interface Guardrail {
  roomType: { id: string; name: string; basePriceKobo: number };
  enabled: boolean;
  floorKobo: number;
  ceilingKobo: number;
  maxDailyChangeBps: number;
}
export interface FrozenDate {
  id: string;
  date: string;
  roomTypeId: string | null;
  note: string;
  createdBy: UserRef | null;
}
export interface PricingEvent {
  id: string;
  kind: "NATIONAL" | "CUSTOM";
  name: string;
  dateFrom: string;
  dateTo: string;
  impact: EventImpact;
  upliftBps: number;
  moonDependent: boolean;
  city: string | null;
  disabled: boolean;
  note: string;
}
export interface CompetitorRate {
  id: string;
  competitorName: string;
  date: string;
  rateKobo: number;
  roomTypeId: string | null;
  createdAt: string;
}
export interface PricingFactor {
  code: PricingFactorCode;
  label: string;
  effectBps: number;
}
export interface Suggestion {
  id: string;
  roomType: { id: string; name: string };
  date: string;
  currentKobo: number;
  suggestedKobo: number;
  changeBps: number;
  factors: PricingFactor[];
  reason: string;
  occupancy: { onTheBooks: number; forecast: number; paceDeltaPts: number; roomsSold: number; capacity: number; daysOut: number };
  confidence: "LOW" | "MEDIUM" | "HIGH";
  status: SuggestionStatus;
  generatedAt: string;
  decidedAt: string | null;
  decidedBy: UserRef | null;
}
export interface PriceChange {
  id: string;
  roomType: { id: string; name: string };
  date: string;
  fromKobo: number;
  toKobo: number;
  source: PriceChangeSource;
  reason: string;
  suggestionId: string | null;
  by: UserRef | null;
  createdAt: string;
  reverted: boolean;
}
export interface PricingReport {
  from: string;
  to: string;
  nightsRepriced: number;
  roomNightsSold: number;
  actualRevenueKobo: number;
  barRevenueKobo: number;
  upliftKobo: number;
  upliftPct: number;
  byMonth: { month: string; actualRevenueKobo: number; barRevenueKobo: number; upliftKobo: number }[];
  byRoomType: { roomType: { id: string; name: string }; roomNightsSold: number; upliftKobo: number }[];
  bySource: { source: "ACCEPTED" | "AUTOPILOT"; roomNightsSold: number; upliftKobo: number }[];
  disclaimer: string;
}

/* ---------- 5. inbox ---------- */

export interface ConversationListItem {
  id: string;
  propertyId: string;
  status: ConversationStatus;
  guest: { id: string | null; fullName: string; phone: string; vip: boolean; loyaltyTier: string | null };
  reservation: { id: string; code: string; status: ReservationStatus; roomNumber: string | null; arrivalDate: string; departureDate: string } | null;
  assignee: UserRef | null;
  lastMessage: { direction: MessageDirection; body: string; at: string } | null;
  unreadCount: number;
  window: { open: boolean; expiresAt: string | null };
  overdue: boolean;
  slaDueAt: string | null;
  pendingSuggestions: number;
  updatedAt: string;
}
export interface MessageWire {
  id: string;
  direction: MessageDirection;
  body: string;
  template: { name: string; params: string[] } | null;
  status: MessageStatus;
  error: string | null;
  sentBy: UserRef | null;
  createdAt: string;
}
export interface TaskSuggestion {
  id: string;
  kind: TaskSuggestionKind;
  keyword: string;
  summary: string;
  category: MaintenanceCategory | null;
  room: { id: string; number: string } | null;
  messageId: string;
  status: TaskSuggestionStatus;
  housekeepingTaskId: string | null;
  ticketId: string | null;
  createdAt: string;
}
export interface ConversationDetail extends ConversationListItem {
  messages: MessageWire[];
  suggestions: TaskSuggestion[];
  context: { guest: Guest; stays: ReservationListItem[]; balanceKobo: number | null; loyalty: { memberNo: string; tier: string; points: number } | null };
  notes: string;
}
export interface QuickReplyWire {
  id: string;
  title: string;
  shortcut: string;
  body: string;
  sortOrder: number;
}
export interface InboxSettings {
  enabled: boolean;
  wifiName: string;
  wifiPassword: string;
  directions: string;
  preArrivalConfirm: boolean;
  inStayPrompt: boolean;
  keywordSuggestions: boolean;
  slaMinutes: number;
  phoneNumberId: string | null;
  whatsappPhone: string | null;
}
export interface InboxSummary {
  unread: number;
  open: number;
  unassigned: number;
  overdue: number;
  mine: number;
  pendingSuggestions: number;
}
export type M5TemplateName = WhatsAppTemplateName | "guest_message" | "pre_arrival_confirm" | "in_stay_welcome";

/* ---------- 6. loyalty ---------- */

export type TierColor = "palm" | "brass" | "laterite" | "adire" | "ochre";
export interface LoyaltyTier {
  id: string;
  name: string;
  minNights: number;
  bonusBps: number;
  perks: string[];
  color: TierColor;
  sortOrder: number;
  members: number;
}
export interface LoyaltyProgramme {
  enabled: boolean;
  name: string;
  earnPointsPer1000: number;
  pointValueKobo: number;
  minRedeemPoints: number;
  maxRedeemBps: number;
  expiryMonths: number;
  adjustmentFlagPoints: number;
  enrolOnline: boolean;
  memberNoPrefix: string;
  tiers: LoyaltyTier[];
}
export interface LoyaltyMember {
  id: string;
  memberNo: string;
  guest: { id: string; fullName: string; phone: string | null; email: string | null; vip: boolean };
  tier: { id: string; name: string; color: string; perks: string[] } | null;
  points: number;
  valueKobo: number;
  lifetimePoints: number;
  nights12m: number;
  nextTier: { name: string; nightsNeeded: number } | null;
  expiringSoon: { points: number; date: string } | null;
  enrolledAt: string;
  enrolledVia: LoyaltyEnrolSource;
  status: "ACTIVE" | "SUSPENDED";
}
export interface LoyaltyTxn {
  id: string;
  type: LoyaltyTxnType;
  points: number;
  balanceAfter: number;
  description: string;
  reason: string | null;
  property: PropertyRef | null;
  reservation: { id: string; code: string } | null;
  folioId: string | null;
  expiresAt: string | null;
  by: UserRef | null;
  approvedBy: UserRef | null;
  createdAt: string;
}
export interface LoyaltySummary {
  members: number;
  byTier: { tier: string; members: number }[];
  pointsOutstanding: number;
  liabilityKobo: number;
  earned30d: number;
  redeemed30d: number;
  expired30d: number;
  expiringNext60d: number;
}
export interface RedeemChallenge {
  challengeId: string;
  maskedPhone: string;
  expiresAt: string;
  points: number;
  valueKobo: number;
}
export interface RedeemResult {
  member: LoyaltyMember;
  folio: Folio;
  transaction: LoyaltyTxn;
}

/* ---------- 7. custom domain ---------- */

export interface CustomDomain {
  id: string;
  propertyId: string;
  domain: string;
  status: DomainStatus;
  records: { type: "TXT" | "CNAME"; name: string; value: string; ok: boolean | null }[];
  failures: DomainCheckFailure[];
  lastCheckedAt: string | null;
  verifiedAt: string | null;
  checkCount: number;
  createdAt: string;
}
export interface DomainsView {
  domain: CustomDomain | null;
  subdomain: string;
  canonicalHost: string;
}

export type { TaskPriority };
