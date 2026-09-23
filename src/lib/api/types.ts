/* Types mirror the shared M1 API contract. Money is always integer kobo. */

export type FeatureCode =
  | "front_desk"
  | "reservations"
  | "guest_register"
  | "invoicing"
  | "hourly_bookings"
  | "offline_mode"
  | "marketplace_listing"
  | "booking_site_branding"
  | "custom_domain"
  | "white_label"
  | "revenue_guard_basic"
  | "revenue_guard_full"
  | "owner_whatsapp_alerts"
  | "housekeeping"
  | "maintenance"
  | "custom_roles"
  | "audit_export"
  | "promotions"
  | "pos"
  | "channel_manager"
  | "dynamic_pricing"
  | "whatsapp_messaging"
  | "sms_messaging"
  | "loyalty"
  | "multi_property"
  | "api_access"
  | "dedicated_database";

export type LimitCode = "max_rooms" | "max_staff" | "max_properties";
export type PlanCode = "starter" | "growth" | "pro" | "enterprise" | (string & {});
export type BillingInterval = "MONTHLY" | "YEARLY";

export type SubscriptionStatus = "TRIALING" | "ACTIVE" | "PAST_DUE" | "READ_ONLY" | "SUSPENDED" | "CANCELLED";

export type Role = "OWNER" | "MANAGER" | "FRONT_DESK" | "HOUSEKEEPING" | "ACCOUNTANT";

export type RoomStatus = "VACANT_CLEAN" | "VACANT_DIRTY" | "OCCUPIED" | "RESERVED" | "OUT_OF_ORDER";

export interface ApiErrorBody {
  statusCode: number;
  code: string;
  message: string | string[];
  details?: Record<string, unknown>;
}

/* ---------- public ---------- */
export interface AppInfo {
  appName: string;
  appDomain: string;
  supportEmail: string;
}

export interface Plan {
  code: PlanCode;
  name: string;
  tagline: string;
  priceMonthlyKobo: number | null;
  priceYearlyKobo: number | null;
  limits: Partial<Record<LimitCode, number>> & Record<string, number>;
  features: string[];
  commissionBps: number | null;
  highlighted: boolean;
  sortOrder: number;
}

export type FeatureCategory = "Operations" | "Revenue" | "Guests" | "Growth" | "Platform";

export interface FeatureInfo {
  code: string;
  name: string;
  description: string;
  category: FeatureCategory | string;
}

/* ---------- auth ---------- */
export interface StaffUser {
  id: string;
  fullName: string;
  email: string;
  phone?: string | null;
  role: Role;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: StaffUser;
}

export interface SignupInput {
  hotelName: string;
  city: string;
  state: string;
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export interface Subscription {
  planCode: PlanCode;
  planName: string;
  status: SubscriptionStatus;
  interval: BillingInterval | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
}

export interface Usage {
  rooms: number;
  staff: number;
  properties: number;
}

export interface Entitlements {
  features: string[];
  limits: Partial<Record<LimitCode, number>> & Record<string, number>;
  usage: Usage;
}

export interface Me {
  user: StaffUser;
  tenant: { id: string; name: string; slug: string };
  subscription: Subscription;
  entitlements: Entitlements;
}

/* ---------- hotel ---------- */
export interface AuditLog {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actor: { id: string; fullName: string } | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

export interface DashboardSummary {
  rooms: { total: number; byStatus: Partial<Record<RoomStatus, number>> };
  occupancyRate: number;
  staffCount: number;
  subscription: Subscription;
  usage: Usage;
  limits: Partial<Record<LimitCode, number>> & Record<string, number>;
  recentActivity: AuditLog[];
}

export interface ImageRef {
  url: string;
  alt?: string;
}

export interface Property {
  id: string;
  name: string;
  slug: string;
  tagline: string | null;
  description: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  area: string | null;
  phone: string | null;
  email: string | null;
  checkInTime: string | null;
  checkOutTime: string | null;
  coverImageUrl: string | null;
  images: ImageRef[];
  amenities: string[];
  policies: string[];
  accentColor: string | null;
  logoUrl: string | null;
  listedOnMarketplace: boolean;
}

export interface RoomType {
  id: string;
  name: string;
  description: string | null;
  basePriceKobo: number;
  hourlyPriceKobo: number | null;
  capacity: number;
  bedType: string | null;
  sizeSqm: number | null;
  amenities: string[];
  images: ImageRef[];
  roomCount: number;
}

export type RoomTypeInput = Partial<Omit<RoomType, "id" | "roomCount">>;

export interface Room {
  id: string;
  number: string;
  floor: number;
  status: RoomStatus;
  notes: string | null;
  roomType: { id: string; name: string };
  updatedAt: string;
}

export interface RoomInput {
  number: string;
  floor: number;
  roomTypeId: string;
  notes?: string | null;
  status?: RoomStatus;
}

export interface BulkRoomsInput {
  roomTypeId: string;
  floor: number;
  from: number;
  to: number;
  prefix?: string;
}

export interface Staff {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  role: Role;
  isActive?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
}

export interface StaffInput {
  fullName: string;
  email: string;
  phone: string;
  role: Role;
  password?: string;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page?: number;
  pageSize?: number;
}

export interface BillingSubscription {
  subscription: Subscription;
  plan: Plan | null;
  nextInvoice?: { amountKobo: number; dueAt: string | null; interval?: BillingInterval } | null;
}

export interface Invoice {
  id: string;
  reference: string;
  amountKobo: number;
  status: string;
  planCode: PlanCode;
  interval: BillingInterval;
  paidAt: string | null;
  createdAt: string;
}

export interface CheckoutResponse {
  authorizationUrl: string;
  reference: string;
}

export interface HousekeepingTask {
  id: string;
  roomId?: string;
  title?: string;
  status?: string;
}

/* ---------- platform ---------- */
export interface PlatformUser {
  id: string;
  fullName?: string;
  email: string;
  role?: string;
}

export interface PlatformAuthResponse {
  accessToken: string;
  user: PlatformUser;
}

export interface TenantRow {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  planCode: PlanCode;
  status: SubscriptionStatus;
  rooms: number;
  staff: number;
  createdAt: string;
  trialEndsAt: string | null;
}

export interface PlatformMetrics {
  mrrKobo: number;
  arrKobo: number;
  tenantsTotal: number;
  tenantsByPlan: Record<string, number>;
  tenantsByStatus: Partial<Record<SubscriptionStatus, number>>;
  trialsEndingSoon: TenantRow[];
  newTenants30d: number;
  signupsByWeek: { week: string; count: number }[];
}

export interface FeatureOverride {
  featureCode: string;
  enabled: boolean;
}

export interface TenantDetail extends TenantRow {
  subscription?: Subscription & { id?: string };
  owner?: { fullName: string; email: string; phone?: string | null } | null;
  properties?: { id: string; name: string; city?: string | null }[];
  featureOverrides?: FeatureOverride[];
  entitlements?: Entitlements;
  [key: string]: unknown;
}

export type PlanPatch = Partial<
  Pick<Plan, "name" | "tagline" | "priceMonthlyKobo" | "priceYearlyKobo" | "limits" | "features" | "commissionBps" | "highlighted">
>;
