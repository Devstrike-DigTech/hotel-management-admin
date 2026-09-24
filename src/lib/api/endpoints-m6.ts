import { api } from "./client";
import type { AuthResponse } from "./types";
import type {
  ApiKey,
  ApiKeyInput,
  ApiKeyWithSecret,
  ApiScopeInfo,
  ApiUsage,
  Attachment,
  CursorPage,
  DataExport,
  EmailDomain,
  FontChoice,
  HotelAnnouncement,
  ImpersonationBanner,
  ImpersonationExchange,
  ImpersonationSession,
  Paginated,
  Quickstart,
  SmsSenderRequest,
  SsoConfig,
  SsoInput,
  StaffPortalDomain,
  StaffPortalPublic,
  SupportCreate,
  SupportMessage,
  SupportRequest,
  SupportRequestDetail,
  WebhookDelivery,
  WebhookDeliveryDetail,
  WebhookEndpoint,
  WebhookEndpointWithSecret,
  WebhookEventInfo,
  WhiteLabelSettings,
  WhiteLabelUpdate,
} from "./types-m6";

/** tenant-wide routes: no property scope */
const T = { propertyId: null } as const;

export const apiKeysApi = {
  scopes: () => api<ApiScopeInfo[]>("/api-keys/scopes", T),
  list: () => api<ApiKey[]>("/api-keys", T),
  create: (b: ApiKeyInput) => api<ApiKeyWithSecret>("/api-keys", { method: "POST", body: b, ...T }),
  update: (id: string, b: Partial<Omit<ApiKeyInput, "environment">>) => api<ApiKey>(`/api-keys/${id}`, { method: "PATCH", body: b, ...T }),
  rotate: (id: string) => api<ApiKeyWithSecret>(`/api-keys/${id}/rotate`, { method: "POST", ...T }),
  revoke: (id: string) => api<ApiKey>(`/api-keys/${id}/revoke`, { method: "POST", ...T }),
  usage: (from?: string, to?: string) => api<ApiUsage>("/api-keys/usage", { query: { from, to }, ...T }),
  quickstart: () => api<Quickstart>("/developers/quickstart", T),
};

export const webhooksApi = {
  events: () => api<WebhookEventInfo[]>("/webhook-endpoints/events", T),
  list: () => api<WebhookEndpoint[]>("/webhook-endpoints", T),
  create: (b: { url: string; description?: string; events: string[]; propertyIds?: string[] | null }) => api<WebhookEndpointWithSecret>("/webhook-endpoints", { method: "POST", body: b, ...T }),
  update: (id: string, b: { url?: string; description?: string | null; events?: string[]; propertyIds?: string[] | null; status?: "ACTIVE" | "DISABLED" }) =>
    api<WebhookEndpoint>(`/webhook-endpoints/${id}`, { method: "PATCH", body: b, ...T }),
  remove: (id: string) => api<{ success: true }>(`/webhook-endpoints/${id}`, { method: "DELETE", ...T }),
  rotateSecret: (id: string) => api<WebhookEndpointWithSecret>(`/webhook-endpoints/${id}/rotate-secret`, { method: "POST", ...T }),
  test: (id: string) => api<WebhookDeliveryDetail>(`/webhook-endpoints/${id}/test`, { method: "POST", ...T }),
  deliveries: (id: string, q: { status?: string; eventType?: string; cursor?: string | null; limit?: number }) =>
    api<CursorPage<WebhookDelivery>>(`/webhook-endpoints/${id}/deliveries`, { query: q, ...T }),
  delivery: (id: string) => api<WebhookDeliveryDetail>(`/webhook-deliveries/${id}`, T),
  replay: (id: string) => api<WebhookDelivery>(`/webhook-deliveries/${id}/replay`, { method: "POST", ...T }),
};

export const whiteLabelApi = {
  fonts: () => api<FontChoice[]>("/white-label/fonts", T),
  get: () => api<WhiteLabelSettings>("/white-label", T),
  update: (b: WhiteLabelUpdate) => api<WhiteLabelSettings>("/white-label", { method: "PUT", body: b, ...T }),
  addEmailDomain: (b: { domain: string; fromLocalPart?: string }) => api<EmailDomain>("/white-label/email-domain", { method: "POST", body: b, ...T }),
  verifyEmailDomain: () => api<EmailDomain>("/white-label/email-domain/verify", { method: "POST", ...T }),
  devVerifyEmailDomain: () => api<EmailDomain>("/white-label/email-domain/dev/verify", { method: "POST", ...T }),
  removeEmailDomain: () => api<{ success: true }>("/white-label/email-domain", { method: "DELETE", ...T }),
  smsSender: () => api<SmsSenderRequest | null>("/white-label/sms-sender", T),
  requestSender: (b: { senderId: string; useCase: string }) => api<SmsSenderRequest>("/white-label/sms-sender", { method: "POST", body: b, ...T }),
  addStaffPortal: (domain: string) => api<StaffPortalDomain>("/white-label/staff-portal", { method: "POST", body: { domain }, ...T }),
  verifyStaffPortal: () => api<StaffPortalDomain>("/white-label/staff-portal/verify", { method: "POST", ...T }),
  devPublishStaffPortal: () => api<unknown>("/white-label/staff-portal/dev/publish", { method: "POST", ...T }),
  removeStaffPortal: () => api<{ success: true }>("/white-label/staff-portal", { method: "DELETE", ...T }),
};

export const staffPortalApi = {
  resolve: (host: string) => api<StaffPortalPublic>("/public/staff-portal", { query: { host }, auth: "none" }),
};

export const ssoApi = {
  get: () => api<SsoConfig | null>("/sso", T),
  save: (b: SsoInput) => api<SsoConfig>("/sso", { method: "PUT", body: b, ...T }),
  remove: () => api<{ success: true }>("/sso", { method: "DELETE", ...T }),
  test: () => api<{ authorizeUrl: string }>("/sso/test", { method: "POST", ...T }),
  discover: (email: string) => api<{ sso: boolean; enforced: boolean; startUrl: string | null }>("/auth/sso/discover", { method: "POST", body: { email }, auth: "none" }),
  exchange: (code: string) => api<AuthResponse>("/auth/sso/exchange", { method: "POST", body: { code }, auth: "none" }),
};

export const exportApi = {
  list: () => api<DataExport[]>("/exports", T),
  request: (formats?: ("json" | "csv")[]) => api<DataExport>("/exports", { method: "POST", body: formats ? { formats } : {}, ...T }),
  get: (id: string) => api<DataExport>(`/exports/${id}`, T),
  link: (id: string) => api<DataExport>(`/exports/${id}/link`, { method: "POST", ...T }),
};

export const supportApi = {
  summary: () => api<{ open: number; unread: number }>("/support/summary", T),
  list: (q: { status?: string; page?: number; pageSize?: number }) => api<Paginated<SupportRequest>>("/support/requests", { query: q, ...T }),
  get: (id: string) => api<SupportRequestDetail>(`/support/requests/${id}`, T),
  create: (b: SupportCreate) => api<SupportRequestDetail>("/support/requests", { method: "POST", body: b, ...T }),
  reply: (id: string, b: { body: string; attachmentKeys?: string[] }) => api<SupportMessage>(`/support/requests/${id}/messages`, { method: "POST", body: b, ...T }),
  close: (id: string) => api<SupportRequest>(`/support/requests/${id}/close`, { method: "POST", ...T }),
  reopen: (id: string) => api<SupportRequest>(`/support/requests/${id}/reopen`, { method: "POST", ...T }),
  upload: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return api<Attachment>("/support/attachments", { method: "POST", body: fd, ...T });
  },
  sessions: (page = 1) => api<Paginated<ImpersonationSession>>("/support-sessions", { query: { page, pageSize: 20 }, ...T }),
  endSession: (id: string) => api<ImpersonationSession>(`/support-sessions/${id}/end`, { method: "POST", ...T }),
};

export const announcementsApi = {
  list: () => api<HotelAnnouncement[]>("/announcements", T),
  seen: (id: string) => api<{ success: true }>(`/announcements/${id}/seen`, { method: "POST", ...T }),
  dismiss: (id: string) => api<{ success: true }>(`/announcements/${id}/dismiss`, { method: "POST", ...T }),
};

export const impersonationApi = {
  exchange: (code: string) => api<ImpersonationExchange>("/auth/impersonation/exchange", { method: "POST", body: { code }, auth: "none" }),
  current: () => api<ImpersonationBanner | null>("/impersonation/current", T),
  end: () => api<{ success: true }>("/impersonation/end", { method: "POST", ...T }),
};
