/* M6 contract (API-M6.md sections 6, 9.1, 9.2, 10, 11, 13-17): the hotel side of the Enterprise tier. */

export type CursorPage<T> = { items: T[]; nextCursor: string | null };
export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number };

export interface Attachment {
  key: string;
  name: string;
  size: number;
  contentType: string;
  url: string;
}

/* ---------- 11. API keys ---------- */

export type KeyEnvironment = "LIVE" | "TEST";

export interface ApiKey {
  id: string;
  name: string;
  environment: KeyEnvironment;
  prefix: string;
  last4: string;
  display: string;
  scopes: string[];
  propertyIds: string[] | null;
  ipAllowlist: string[];
  expiresAt: string | null;
  status: "ACTIVE" | "REVOKED" | "EXPIRED";
  previousSecretExpiresAt: string | null;
  createdBy: { id: string; fullName: string } | null;
  createdAt: string;
  lastUsedAt: string | null;
  lastUsedIp: string | null;
  revokedAt: string | null;
  requests30d: number;
}

export interface ApiKeyInput {
  name: string;
  environment: KeyEnvironment;
  scopes: string[];
  propertyIds?: string[] | null;
  ipAllowlist?: string[];
  expiresAt?: string | null;
}

export interface ApiKeyWithSecret {
  apiKey: ApiKey;
  secret: string;
}

export interface ApiScopeInfo {
  scope: string;
  label: string;
  description: string;
  write: boolean;
}

export interface Quickstart {
  baseUrl: string;
  docsUrl: string;
  openApiUrl: string;
  propertyIds: { id: string; name: string }[];
  sampleCurl: string;
}

export interface ApiUsage {
  from: string;
  to: string;
  totals: { requests: number; errors: number; writes: number; rateLimited: number };
  keys: { id: string; name: string; prefix: string; environment: KeyEnvironment; requests: number; errors: number; rateLimited: number; lastUsedAt: string | null }[];
  byDay: { date: string; requests: number; errors: number; rateLimited: number }[];
}

/* ---------- 14. webhooks ---------- */

export interface WebhookEndpoint {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  propertyIds: string[] | null;
  status: "ACTIVE" | "DISABLED";
  disabledReason: string | null;
  disabledAt: string | null;
  secretPreview: string;
  secretRotatedAt: string | null;
  failingSince: string | null;
  consecutiveFailures: number;
  lastSuccessAt: string | null;
  lastFailureAt: string | null;
  createdAt: string;
  createdBy: { id: string; fullName: string } | null;
  stats24h: { delivered: number; failed: number };
}

export interface WebhookEndpointWithSecret {
  endpoint: WebhookEndpoint;
  secret: string;
}

export interface WebhookEventInfo {
  type: string;
  description: string;
  object: string;
}

export type DeliveryStatus = "PENDING" | "RETRYING" | "SUCCEEDED" | "FAILED";

export interface WebhookDelivery {
  id: string;
  endpointId: string;
  eventId: string;
  eventType: string;
  status: DeliveryStatus;
  attempts: number;
  nextAttemptAt: string | null;
  lastAttemptAt: string | null;
  responseStatus: number | null;
  durationMs: number | null;
  error: string | null;
  isTest: boolean;
  replayOf: string | null;
  createdAt: string;
}

export interface WebhookDeliveryDetail extends WebhookDelivery {
  request: { url: string; headers: Record<string, string>; body: string };
  response: { status: number | null; headers: Record<string, string>; body: string | null } | null;
  attemptLog: { at: string; responseStatus: number | null; durationMs: number | null; error: string | null }[];
}

/* ---------- 13. white-label ---------- */

export interface FontChoice {
  family: string;
  category: "serif" | "sans" | "display";
  weights: number[];
  googleFontsUrl: string;
}

export interface WhiteLabelCore {
  enabled: boolean;
  brandName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  headingFont: string | null;
  bodyFont: string | null;
  footerLinks: { label: string; url: string }[];
  hidePoweredBy: boolean;
  emailFromName: string | null;
  requirements: { customDomainVerified: boolean; emailDomainVerified: boolean };
  active: boolean;
}

export type WhiteLabelUpdate = Partial<Omit<WhiteLabelCore, "requirements" | "active">>;

export interface EmailDomain {
  id: string;
  domain: string;
  fromLocalPart: string;
  fromAddress: string;
  status: "NOT_STARTED" | "PENDING" | "VERIFIED" | "FAILED" | "TEMPORARY_FAILURE";
  provider: "resend" | "mock";
  records: { purpose: "SPF" | "DKIM" | "RETURN_PATH" | "DMARC"; type: "TXT" | "MX" | "CNAME"; name: string; value: string; priority: number | null; ttl: string; status: "pending" | "verified" | "failed" }[];
  lastCheckedAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface SmsSenderRequest {
  id: string;
  senderId: string;
  useCase: string;
  status: "REQUESTED" | "PENDING" | "APPROVED" | "REJECTED";
  note: string | null;
  requestedAt: string;
  decidedAt: string | null;
  provider: "termii" | "mock";
}

export interface StaffPortalDomain {
  id: string;
  domain: string;
  status: "PENDING" | "VERIFIED" | "FAILED";
  records: { type: "TXT" | "CNAME"; name: string; value: string; ok: boolean | null }[];
  failures: string[];
  lastCheckedAt: string | null;
  verifiedAt: string | null;
  createdAt: string;
}

export interface WhiteLabelSettings extends WhiteLabelCore {
  emailDomain: EmailDomain | null;
  smsSender: SmsSenderRequest | null;
  staffPortal: StaffPortalDomain | null;
}

export interface StaffPortalPublic {
  tenantSlug: string;
  brandName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string | null;
  accentColor: string | null;
  headingFont: FontChoice | null;
  bodyFont: FontChoice | null;
  hidePlatformBranding: true;
  sso: { enabled: boolean; enforced: boolean; provider: string | null; startUrl: string | null };
}

/* ---------- 16. SSO ---------- */

export type SsoProvider = "GOOGLE" | "MICROSOFT" | "OIDC";

export interface SsoConfig {
  enabled: boolean;
  provider: SsoProvider;
  issuer: string;
  clientId: string;
  clientSecretSet: boolean;
  clientSecretLast4: string | null;
  allowedDomains: string[];
  provisioning: "JIT" | "EXISTING_ONLY";
  defaultRole: string;
  enforced: boolean;
  breakGlassUserId: string | null;
  redirectUri: string;
  lastTest: { at: string; ok: boolean; message: string; email: string | null } | null;
}

export interface SsoInput {
  provider: SsoProvider;
  issuer?: string;
  clientId: string;
  clientSecret?: string;
  allowedDomains: string[];
  provisioning: "JIT" | "EXISTING_ONLY";
  defaultRole: string;
  enforced: boolean;
  breakGlassUserId?: string | null;
  enabled: boolean;
}

/* ---------- 15. export ---------- */

export interface DataExport {
  id: string;
  status: "QUEUED" | "RUNNING" | "READY" | "FAILED" | "EXPIRED";
  requestedBy: { kind: "USER" | "PLATFORM"; id: string; fullName: string };
  reason: "REQUEST" | "OFFBOARDING";
  progressPct: number;
  entities: { name: string; rows: number }[];
  sizeBytes: number | null;
  fileName: string | null;
  downloadUrl: string | null;
  expiresAt: string | null;
  createdAt: string;
  finishedAt: string | null;
  error: string | null;
}

/* ---------- 9.2 support ---------- */

export type SupportCategory = "BILLING" | "TECHNICAL" | "ACCOUNT" | "BOOKINGS" | "PAYMENTS" | "FEATURE_REQUEST" | "DATA_PRIVACY" | "OTHER";
export type SupportPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";
export type SupportStatus = "NEW" | "OPEN" | "WAITING_ON_HOTEL" | "RESOLVED" | "CLOSED";
export type SlaState = "ON_TRACK" | "DUE_SOON" | "BREACHED" | "MET" | "MISSED";

export interface SupportRequest {
  id: string;
  number: string;
  tenant: { id: string; name: string; slug: string };
  property: { id: string; name: string } | null;
  openedBy: { id: string; fullName: string; email: string; role: string };
  subject: string;
  category: SupportCategory;
  priority: SupportPriority;
  status: SupportStatus;
  planCode: string;
  slaHours: number;
  firstResponseDueAt: string;
  firstRespondedAt: string | null;
  sla: SlaState;
  assignee: null | { id: string; fullName: string; email: string };
  context: { pageUrl: string | null; appVersion: string | null; userAgent: string | null; propertyName: string | null; userRole: string | null };
  lastMessageAt: string;
  messageCount: number;
  unread: boolean;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupportMessage {
  id: string;
  author: { kind: "HOTEL" | "PLATFORM"; id: string; fullName: string };
  body: string;
  internal: boolean;
  attachments: Attachment[];
  createdAt: string;
}

export type SupportRequestDetail = SupportRequest & { messages: SupportMessage[] };

export interface SupportCreate {
  subject: string;
  category: SupportCategory;
  message: string;
  priority?: SupportPriority;
  attachmentKeys?: string[];
  context?: { pageUrl?: string; appVersion?: string };
}

/* ---------- 9.1 announcements ---------- */

export interface HotelAnnouncement {
  id: string;
  title: string;
  body: string;
  severity: "INFO" | "SUCCESS" | "WARNING" | "CRITICAL" | "MAINTENANCE";
  link: { label: string; url: string } | null;
  dismissible: boolean;
  startsAt: string;
  endsAt: string | null;
}

/* ---------- 6. impersonation ---------- */

export interface ImpersonationBanner {
  sessionId: string;
  platformUserName: string;
  mode: "READ_ONLY" | "WRITE";
  reason: string;
  expiresAt: string;
  startedAt: string;
}

export interface ImpersonationSession {
  id: string;
  tenant: { id: string; name: string; slug: string };
  staff: { id: string; fullName: string; email: string; role: string };
  platformUser: { id: string; fullName: string; email: string };
  reason: string;
  writeReason: string | null;
  mode: "READ_ONLY" | "WRITE";
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  endedBy: "PLATFORM" | "HOTEL_OWNER" | "EXPIRED" | "SELF" | null;
  supportRequestId: string | null;
  requests: number;
  writes: number;
}

export interface ImpersonationExchange {
  accessToken: string;
  expiresAt: string;
  user: { id: string; fullName: string; email: string; role: string };
  impersonation: ImpersonationBanner;
}

/* ---------- 17. /me additions ---------- */

export interface MeM6 {
  impersonation?: ImpersonationBanner | null;
  whiteLabel?: { active: boolean; brandName: string | null; logoUrl: string | null };
  sso?: { enabled: boolean; enforced: boolean };
  dedicatedDb?: { mode: "SHARED" | "DEDICATED" };
}
