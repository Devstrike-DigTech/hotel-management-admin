import { api } from "./client";
import type {
  AupState,
  Board,
  CategoryInfo,
  ConciergeGates,
  ConciergeReport,
  ConciergeService,
  ConciergeSettings,
  ContactPreference,
  PaymentMethod,
  RequestDetail,
  RequestPage,
  RequestStatus,
  ScreenResult,
  ServiceInput,
  ServiceQuestion,
  TodayConcierge,
  Vendor,
  VendorInput,
} from "./types-m8";

export interface RequestQuery {
  status?: string;
  source?: string;
  from?: string;
  to?: string;
  q?: string;
  assigneeId?: string;
  vendorId?: string;
  serviceId?: string;
  discreet?: boolean;
  flagged?: boolean;
  overdue?: boolean;
  reservationId?: string;
  page?: number;
  pageSize?: number;
}

export interface CreateRequestBody {
  reservationId?: string;
  guestId?: string;
  serviceId?: string;
  variantId?: string;
  requestText?: string;
  answers?: Record<string, unknown>;
  preferredStart?: string;
  preferredEnd?: string;
  hours?: number;
  partySize?: number;
  notes?: string;
  internalNotes?: string;
  discreet?: boolean;
  contactPreference?: ContactPreference;
  paymentMethod?: PaymentMethod;
  notifyGuest?: boolean;
  assigneeId?: string;
  vendorId?: string;
}

export const conciergeApi = {
  gates: () => api<ConciergeGates>("/concierge/gates"),
  aup: () => api<AupState>("/concierge/aup"),
  acceptAup: (version: string) => api<AupState>("/concierge/aup/accept", { method: "POST", body: { version } }),
  screen: (texts: string[]) => api<ScreenResult>("/concierge/screen", { method: "POST", body: { texts } }),
  categories: () => api<CategoryInfo[]>("/concierge/categories"),
  questionLibrary: () => api<ServiceQuestion[]>("/concierge/question-library"),

  services: () => api<ConciergeService[]>("/concierge/services"),
  service: (id: string) => api<ConciergeService>(`/concierge/services/${id}`),
  createService: (b: ServiceInput) => api<ConciergeService>("/concierge/services", { method: "POST", body: b }),
  updateService: (id: string, b: Partial<ServiceInput>) => api<ConciergeService>(`/concierge/services/${id}`, { method: "PATCH", body: b }),
  removeService: (id: string) => api<{ success: true }>(`/concierge/services/${id}`, { method: "DELETE" }),

  vendors: () => api<Vendor[]>("/concierge/vendors"),
  createVendor: (b: VendorInput) => api<Vendor>("/concierge/vendors", { method: "POST", body: b }),
  updateVendor: (id: string, b: Partial<VendorInput>) => api<Vendor>(`/concierge/vendors/${id}`, { method: "PATCH", body: b }),
  removeVendor: (id: string) => api<{ success: true }>(`/concierge/vendors/${id}`, { method: "DELETE" }),

  board: () => api<Board>("/concierge/board"),
  requests: (q: RequestQuery) => api<RequestPage>("/concierge/requests", { query: q as Record<string, string | number | boolean | undefined> }),
  request: (id: string) => api<RequestDetail>(`/concierge/requests/${id}`),
  createRequest: (b: CreateRequestBody) => api<RequestDetail>("/concierge/requests", { method: "POST", body: b }),
  update: (id: string, b: { preferredStart?: string; preferredEnd?: string; partySize?: number; notes?: string; internalNotes?: string; contactPreference?: ContactPreference; discreet?: boolean }) =>
    api<RequestDetail>(`/concierge/requests/${id}`, { method: "PATCH", body: b }),
  quote: (id: string, b: { amountKobo: number; taxable?: boolean; validHours?: number; note?: string; notify?: boolean }) => api<RequestDetail>(`/concierge/requests/${id}/quote`, { method: "POST", body: b }),
  confirm: (id: string, b: { paymentMethod: PaymentMethod; note?: string }) => api<RequestDetail>(`/concierge/requests/${id}/confirm`, { method: "POST", body: b }),
  assign: (id: string, b: { assigneeId?: string | null; vendorId?: string | null }) => api<RequestDetail>(`/concierge/requests/${id}/assign`, { method: "POST", body: b }),
  sendToVendor: (id: string, b: { channel?: "WHATSAPP" | "SMS"; note?: string; includeGuestSurname?: boolean; includeRoom?: boolean }) =>
    api<RequestDetail & { sent: { channel: string; to: string; status: string } }>(`/concierge/requests/${id}/send-to-vendor`, { method: "POST", body: b }),
  statusPath: (id: string) => `/concierge/requests/${id}/status`,
  setStatus: (id: string, b: { status: RequestStatus; note?: string; scheduledAt?: string; notifyGuest?: boolean; vendorRating?: number }) => api<RequestDetail>(`/concierge/requests/${id}/status`, { method: "POST", body: b }),
  note: (id: string, note: string) => api<RequestDetail>(`/concierge/requests/${id}/notes`, { method: "POST", body: { note } }),
  flagReview: (id: string, decision: "CLEAR" | "DECLINE", note: string) => api<RequestDetail>(`/concierge/requests/${id}/flag-review`, { method: "POST", body: { decision, note } }),
  rateVendor: (id: string, rating: number) => api<RequestDetail>(`/concierge/requests/${id}/rate-vendor`, { method: "POST", body: { rating } }),

  today: () => api<TodayConcierge>("/concierge/today"),
  settings: () => api<ConciergeSettings>("/concierge/settings"),
  saveSettings: (b: Partial<Omit<ConciergeSettings, "propertyId" | "updatedAt" | "updatedBy">>) => api<ConciergeSettings>("/concierge/settings", { method: "PUT", body: b }),
  report: (q: { from: string; to: string }) => api<ConciergeReport>("/concierge/reports", { query: q }),
  exportPath: "/concierge/requests/export",
};
