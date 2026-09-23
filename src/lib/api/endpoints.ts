import { api } from "./client";
import type {
  AppInfo,
  AuditLog,
  AuthResponse,
  BillingInterval,
  BillingSubscription,
  BulkRoomsInput,
  CheckoutResponse,
  DashboardSummary,
  FeatureInfo,
  HousekeepingTask,
  Invoice,
  Me,
  Paginated,
  Plan,
  PlanPatch,
  PlatformAuthResponse,
  PlatformMetrics,
  Property,
  Room,
  RoomInput,
  RoomStatus,
  RoomType,
  RoomTypeInput,
  SignupInput,
  Staff,
  StaffInput,
  SubscriptionStatus,
  TenantDetail,
  TenantRow,
} from "./types";

/** Accept either a bare array or a `{ items }` envelope. */
function items<T>(v: T[] | { items: T[] } | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : (v.items ?? []);
}

export const publicApi = {
  app: () => api<AppInfo>("/public/app", { auth: "none" }),
  plans: async () => {
    const plans = items(await api<Plan[] | { items: Plan[] }>("/public/plans", { auth: "none" }));
    return [...plans].sort((a, b) => a.sortOrder - b.sortOrder);
  },
  features: async () => items(await api<FeatureInfo[] | { items: FeatureInfo[] }>("/public/features", { auth: "none" })),
};

export const authApi = {
  login: (email: string, password: string) =>
    api<AuthResponse>("/auth/login", { method: "POST", body: { email, password }, auth: "none" }),
  signup: (input: SignupInput) => api<AuthResponse>("/auth/signup", { method: "POST", body: input, auth: "none" }),
  logout: (refreshToken: string) =>
    api<void>("/auth/logout", { method: "POST", body: { refreshToken }, auth: "none" }).catch(() => undefined),
  me: () => api<Me>("/me"),
};

export const hotelApi = {
  dashboard: () => api<DashboardSummary>("/dashboard/summary"),

  property: () => api<Property>("/property"),
  updateProperty: (patch: Partial<Property>) => api<Property>("/property", { method: "PATCH", body: patch }),

  roomTypes: async () => items(await api<RoomType[] | { items: RoomType[] }>("/room-types")),
  createRoomType: (input: RoomTypeInput) => api<RoomType>("/room-types", { method: "POST", body: input }),
  updateRoomType: (id: string, input: RoomTypeInput) =>
    api<RoomType>(`/room-types/${id}`, { method: "PATCH", body: input }),
  deleteRoomType: (id: string) => api<void>(`/room-types/${id}`, { method: "DELETE" }),

  rooms: async (filters: { status?: RoomStatus | ""; floor?: number | ""; roomTypeId?: string } = {}) =>
    items(await api<Room[] | { items: Room[] }>("/rooms", { query: filters })),
  createRoom: (input: RoomInput) => api<Room>("/rooms", { method: "POST", body: input }),
  bulkRooms: (input: BulkRoomsInput) =>
    api<Room[] | { created: number; items?: Room[] }>("/rooms/bulk", { method: "POST", body: input }),
  updateRoom: (id: string, input: Partial<RoomInput>) => api<Room>(`/rooms/${id}`, { method: "PATCH", body: input }),
  setRoomStatus: (id: string, status: RoomStatus, note?: string) =>
    api<Room>(`/rooms/${id}/status`, { method: "PATCH", body: { status, note: note || undefined } }),
  deleteRoom: (id: string) => api<void>(`/rooms/${id}`, { method: "DELETE" }),

  staff: async () => items(await api<Staff[] | { items: Staff[] }>("/staff")),
  createStaff: (input: StaffInput) => api<Staff>("/staff", { method: "POST", body: input }),
  updateStaff: (id: string, input: Partial<StaffInput>) =>
    api<Staff>(`/staff/${id}`, { method: "PATCH", body: input }),
  deleteStaff: (id: string) => api<void>(`/staff/${id}`, { method: "DELETE" }),

  auditLogs: (page = 1, pageSize = 30) =>
    api<Paginated<AuditLog>>("/audit-logs", { query: { page, pageSize } }),

  housekeepingTasks: async () =>
    items(await api<HousekeepingTask[] | { items: HousekeepingTask[] }>("/housekeeping/tasks")),

  billingSubscription: () => api<BillingSubscription>("/billing/subscription"),
  invoices: async () => items(await api<Invoice[] | { items: Invoice[] }>("/billing/invoices")),
  checkout: (planCode: string, interval: BillingInterval) =>
    api<CheckoutResponse>("/billing/checkout", { method: "POST", body: { planCode, interval } }),
  devConfirm: (reference: string) =>
    api<unknown>("/billing/dev/confirm", { method: "POST", body: { reference } }),
};

export const platformApi = {
  login: (email: string, password: string) =>
    api<PlatformAuthResponse>("/platform/auth/login", { method: "POST", body: { email, password }, auth: "none" }),
  metrics: () => api<PlatformMetrics>("/platform/metrics", { auth: "platform" }),
  tenants: (q: { q?: string; plan?: string; status?: string; page?: number }) =>
    api<Paginated<TenantRow>>("/platform/tenants", { auth: "platform", query: q }),
  tenant: (id: string) => api<TenantDetail>(`/platform/tenants/${id}`, { auth: "platform" }),
  updateSubscription: (id: string, body: { planCode?: string; status?: SubscriptionStatus; trialEndsAt?: string }) =>
    api<unknown>(`/platform/tenants/${id}/subscription`, { method: "PATCH", body, auth: "platform" }),
  setFeature: (id: string, featureCode: string, enabled: boolean) =>
    api<unknown>(`/platform/tenants/${id}/features`, {
      method: "PUT",
      body: { featureCode, enabled },
      auth: "platform",
    }),
  plans: async () => {
    const plans = items(await api<Plan[] | { items: Plan[] }>("/platform/plans", { auth: "platform" }));
    return [...plans].sort((a, b) => a.sortOrder - b.sortOrder);
  },
  updatePlan: (code: string, patch: PlanPatch) =>
    api<Plan>(`/platform/plans/${code}`, { method: "PATCH", body: patch, auth: "platform" }),
};
