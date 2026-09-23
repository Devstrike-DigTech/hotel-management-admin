import { api, apiRaw } from "./client";
import type {
  AssignSuggestion,
  Checklist,
  CityLedgerCharge,
  CityLedgerInvoice,
  CityLedgerInvoiceDocument,
  CityLedgerPayment,
  CityLedgerSummary,
  CorporateAccount,
  CorporateDetail,
  CorporateInput,
  FuelLog,
  FuelSummary,
  GuardAlert,
  HkTaskStatus,
  HkTaskType,
  HousekeepingBoardData,
  HousekeepingSettings,
  HousekeepingTask,
  LedgerPaymentMethod,
  LostFoundItem,
  LostFoundStatus,
  MaintenanceReport,
  MaintenanceSchedule,
  MaintenanceTicket,
  MaintenanceTicketDetail,
  MyTasks,
  NotificationSettings,
  NotificationSettingsInput,
  Paginated,
  PermissionGroupWire,
  PromoCode,
  PromoDetail,
  PromoInput,
  QuoteInput,
  RateCalendar,
  RateOverrideInput,
  RatePlan,
  RatePlanInput,
  RateRestriction,
  RateRule,
  RateRuleInput,
  RestrictionInput,
  RoleDetail,
  RoleInput,
  RoleWire,
  RoomBlock,
  BlockConflict,
  ScheduleCalendar,
  ScheduleInput,
  StayQuote,
  TaskPriority,
  TicketInput,
  TicketStatus,
  WhatsAppTemplates,
  MaintenanceCategory,
  PromoInvalidReason,
} from "./types-m4";

type Q = Record<string, string | number | boolean | null | undefined>;

/* ---------- permissions + roles ---------- */
export const rolesApi = {
  catalog: () => api<PermissionGroupWire[]>("/permissions"),
  list: () => api<RoleWire[]>("/roles"),
  get: (id: string) => api<RoleDetail>(`/roles/${encodeURIComponent(id)}`),
  create: (b: RoleInput) => api<RoleWire>("/roles", { method: "POST", body: b }),
  update: (id: string, b: Partial<RoleInput>) => api<RoleWire>(`/roles/${encodeURIComponent(id)}`, { method: "PATCH", body: b }),
  remove: (id: string) => api<{ success: true }>(`/roles/${encodeURIComponent(id)}`, { method: "DELETE" }),
};

/* ---------- audit export ---------- */
export const auditExportApi = {
  download: (from: string, to: string, format: "csv" | "json") => apiRaw("/audit-logs/export", { query: { from, to, format }, headers: { Accept: "*/*" } }),
};

/* ---------- housekeeping ---------- */
export const hkApi = {
  board: (date?: string) => api<HousekeepingBoardData>("/housekeeping/board", { query: { date } }),
  tasks: (q: { status?: string; type?: string; assigneeId?: string; floor?: number; date?: string; roomId?: string } = {}) =>
    api<HousekeepingTask[]>("/housekeeping/tasks", { query: q }),
  task: (id: string) => api<HousekeepingTask>(`/housekeeping/tasks/${id}`),
  mine: () => api<MyTasks>("/housekeeping/my-tasks"),
  create: (b: { roomId: string; type: HkTaskType; priority?: TaskPriority; assigneeId?: string; dueAt?: string; notes?: string }) =>
    api<HousekeepingTask>("/housekeeping/tasks", { method: "POST", body: b }),
  patch: (id: string, b: { status?: HkTaskStatus; notes?: string; priority?: TaskPriority; assigneeId?: string | null; dueAt?: string | null }) =>
    api<HousekeepingTask>(`/housekeeping/tasks/${id}`, { method: "PATCH", body: b }),
  start: (id: string) => api<HousekeepingTask>(`/housekeeping/tasks/${id}/start`, { method: "POST", body: {} }),
  finish: (id: string, b: { notes?: string; checklist?: { id: string; done: boolean }[] } = {}) =>
    api<HousekeepingTask>(`/housekeeping/tasks/${id}/finish`, { method: "POST", body: b }),
  skip: (id: string, reason = "DND") => api<HousekeepingTask>(`/housekeeping/tasks/${id}/skip`, { method: "POST", body: { reason } }),
  inspect: (id: string, result: "PASS" | "FAIL", note?: string) =>
    api<HousekeepingTask>(`/housekeeping/tasks/${id}/inspect`, { method: "POST", body: { result, note: note || undefined } }),
  assign: (b: { assigneeId: string | null; taskIds?: string[]; floor?: number; date?: string }) =>
    api<{ updated: number; tasks: HousekeepingTask[] }>("/housekeeping/assign", { method: "POST", body: b }),
  suggest: (date?: string) => api<AssignSuggestion>("/housekeeping/assignments/suggest", { query: { date } }),
  apply: (assignments: { taskId: string; assigneeId: string }[]) =>
    api<{ updated: number }>("/housekeeping/assignments/apply", { method: "POST", body: { assignments } }),
  inspections: () => api<HousekeepingTask[]>("/housekeeping/inspections"),
  settings: () => api<HousekeepingSettings>("/housekeeping/settings"),
  saveSettings: (b: Partial<{ requireInspection: boolean; stayoverEnabled: boolean; deepCleanEveryStays: { roomTypeId: string; every: number | null }[] }>) =>
    api<HousekeepingSettings>("/housekeeping/settings", { method: "PUT", body: b }),
  checklists: () => api<Checklist[]>("/housekeeping/checklists"),
  saveChecklist: (b: { roomTypeId: string | null; taskType: HkTaskType; items: { id?: string; label: string }[] }) =>
    api<Checklist>("/housekeeping/checklists", { method: "PUT", body: b }),
  resetChecklist: (id: string) => api<{ success: true }>(`/housekeeping/checklists/${id}`, { method: "DELETE" }),
  issue: (id: string, b: { title: string; category: MaintenanceCategory; description?: string; priority?: TaskPriority; photoKeys?: string[]; blocksRoom?: boolean }) =>
    api<MaintenanceTicket>(`/housekeeping/tasks/${id}/issue`, { method: "POST", body: b }),
  runStayovers: () => api<{ created: number }>("/housekeeping/jobs/stayover/run", { method: "POST" }),
  uploadPhoto: (id: string, file: Blob) => {
    const fd = new FormData();
    fd.append("file", file, "photo.jpg");
    return api<HousekeepingTask>(`/housekeeping/tasks/${id}/photos`, { method: "POST", body: fd });
  },
};

export const lostFoundApi = {
  list: (q: { status?: LostFoundStatus | ""; q?: string; page?: number; pageSize?: number }) => api<Paginated<LostFoundItem>>("/lost-found", { query: q as Q }),
  create: (b: { description: string; category?: string; roomId?: string; location?: string; foundAt?: string; storageLocation?: string; notes?: string }) =>
    api<LostFoundItem>("/lost-found", { method: "POST", body: b }),
  update: (id: string, b: { status?: LostFoundStatus; returnedTo?: string; storageLocation?: string; notes?: string; description?: string; category?: string }) =>
    api<LostFoundItem>(`/lost-found/${id}`, { method: "PATCH", body: b }),
};

/* ---------- maintenance ---------- */
export const mtApi = {
  tickets: (q: { status?: string; priority?: string; category?: string; roomId?: string; q?: string; overdue?: boolean; page?: number; pageSize?: number }) =>
    api<Paginated<MaintenanceTicket>>("/maintenance/tickets", { query: q as Q }),
  ticket: (id: string) => api<MaintenanceTicketDetail>(`/maintenance/tickets/${id}`),
  create: (b: TicketInput) => api<MaintenanceTicketDetail>("/maintenance/tickets", { method: "POST", body: b }),
  update: (id: string, b: Partial<{ title: string; description: string; category: MaintenanceCategory; priority: TaskPriority; assigneeId: string | null; vendorName: string; vendorPhone: string; area: string }>) =>
    api<MaintenanceTicketDetail>(`/maintenance/tickets/${id}`, { method: "PATCH", body: b }),
  status: (id: string, b: { status: TicketStatus; note?: string; resolutionNote?: string; costKobo?: number }) =>
    api<MaintenanceTicketDetail>(`/maintenance/tickets/${id}/status`, { method: "POST", body: b }),
  comment: (id: string, body: string) => api<MaintenanceTicketDetail>(`/maintenance/tickets/${id}/comments`, { method: "POST", body: { body } }),
  photo: (id: string, file: Blob) => {
    const fd = new FormData();
    fd.append("file", file, "photo.jpg");
    return api<MaintenanceTicketDetail>(`/maintenance/tickets/${id}/photos`, { method: "POST", body: fd });
  },
  blocks: (q: { from?: string; to?: string; roomId?: string; active?: boolean } = {}) => api<RoomBlock[]>("/room-blocks", { query: q as Q }),
  createBlock: (b: { roomId: string; from: string; to: string; reason: string; ticketId?: string; force?: boolean }) =>
    api<RoomBlock & { displaced: BlockConflict[] }>("/room-blocks", { method: "POST", body: b }),
  updateBlock: (id: string, b: { to?: string; reason?: string; force?: boolean }) => api<RoomBlock>(`/room-blocks/${id}`, { method: "PATCH", body: b }),
  releaseBlock: (id: string) => api<{ success: true }>(`/room-blocks/${id}`, { method: "DELETE" }),
  schedules: () => api<MaintenanceSchedule[]>("/maintenance/schedules"),
  scheduleCalendar: (from: string, to: string) => api<ScheduleCalendar>("/maintenance/schedules/calendar", { query: { from, to } }),
  createSchedule: (b: ScheduleInput) => api<MaintenanceSchedule>("/maintenance/schedules", { method: "POST", body: b }),
  updateSchedule: (id: string, b: Partial<ScheduleInput>) => api<MaintenanceSchedule>(`/maintenance/schedules/${id}`, { method: "PATCH", body: b }),
  deleteSchedule: (id: string) => api<{ success: true }>(`/maintenance/schedules/${id}`, { method: "DELETE" }),
  runSchedules: () => api<{ created: number }>("/maintenance/schedules/run", { method: "POST" }),
  fuel: (q: { from?: string; to?: string; page?: number; pageSize?: number }) => api<Paginated<FuelLog>>("/maintenance/fuel-logs", { query: q }),
  fuelSummary: (from?: string, to?: string) => api<FuelSummary>("/maintenance/fuel-logs/summary", { query: { from, to } }),
  logFuel: (b: { date?: string; litres: number; costKobo: number; supplier: string; runHours?: number; generator?: string; notes?: string }) =>
    api<FuelLog>("/maintenance/fuel-logs", { method: "POST", body: b }),
  deleteFuel: (id: string) => api<{ success: true }>(`/maintenance/fuel-logs/${id}`, { method: "DELETE" }),
  report: (from?: string, to?: string) => api<MaintenanceReport>("/maintenance/reports", { query: { from, to } }),
};

/* ---------- rates ---------- */
export const ratesApi = {
  calendar: (from: string, to: string, ratePlanId?: string) => api<RateCalendar>("/rates/calendar", { query: { from, to, ratePlanId } }),
  plans: (active?: boolean) => api<RatePlan[]>("/rate-plans", { query: { active } }),
  createPlan: (b: RatePlanInput) => api<RatePlan>("/rate-plans", { method: "POST", body: b }),
  updatePlan: (id: string, b: RatePlanInput) => api<RatePlan>(`/rate-plans/${id}`, { method: "PATCH", body: b }),
  deletePlan: (id: string) => api<{ success: true }>(`/rate-plans/${id}`, { method: "DELETE" }),
  rules: (q: { active?: boolean; from?: string; to?: string } = {}) => api<RateRule[]>("/rate-rules", { query: q }),
  createRule: (b: RateRuleInput) => api<RateRule>("/rate-rules", { method: "POST", body: b }),
  updateRule: (id: string, b: RateRuleInput) => api<RateRule>(`/rate-rules/${id}`, { method: "PATCH", body: b }),
  deleteRule: (id: string) => api<{ success: true }>(`/rate-rules/${id}`, { method: "DELETE" }),
  setOverrides: (b: RateOverrideInput) => api<{ updated: number }>("/rate-overrides", { method: "PUT", body: b }),
  restrictions: (from: string, to: string) => api<RateRestriction[]>("/rate-restrictions", { query: { from, to } }),
  setRestrictions: (b: RestrictionInput) => api<{ updated: number }>("/rate-restrictions", { method: "PUT", body: b }),
  quote: (b: QuoteInput) => api<StayQuote>("/rates/quote", { method: "POST", body: b }),
};

export const promoApi = {
  list: (q: { status?: string; q?: string } = {}) => api<PromoCode[]>("/promo-codes", { query: q }),
  get: (id: string) => api<PromoDetail>(`/promo-codes/${id}`),
  create: (b: PromoInput) => api<PromoCode>("/promo-codes", { method: "POST", body: b }),
  update: (id: string, b: PromoInput) => api<PromoCode>(`/promo-codes/${id}`, { method: "PATCH", body: b }),
  remove: (id: string) => api<{ success: true }>(`/promo-codes/${id}`, { method: "DELETE" }),
  check: (b: { code: string; roomTypeId: string; arrivalDate: string; departureDate: string; channel?: string; ratePlanId?: string; guestPhone?: string }) =>
    api<{ valid: boolean; reason: PromoInvalidReason | null; message: string | null; discountKobo: number }>("/promo-codes/check", { method: "POST", body: b }),
};

export const corporateApi = {
  list: (q: { active?: boolean; q?: string } = {}) => api<CorporateAccount[]>("/corporate-accounts", { query: q }),
  get: (id: string) => api<CorporateDetail>(`/corporate-accounts/${id}`),
  create: (b: CorporateInput) => api<CorporateAccount>("/corporate-accounts", { method: "POST", body: b }),
  update: (id: string, b: CorporateInput) => api<CorporateAccount>(`/corporate-accounts/${id}`, { method: "PATCH", body: b }),
};

export const cityLedgerApi = {
  summary: () => api<CityLedgerSummary>("/city-ledger/summary"),
  charges: (q: { accountId?: string; invoiced?: boolean; page?: number; pageSize?: number }) => api<Paginated<CityLedgerCharge>>("/city-ledger/charges", { query: q }),
  invoices: (q: { accountId?: string; status?: string; overdue?: boolean; bucket?: string; page?: number; pageSize?: number }) =>
    api<Paginated<CityLedgerInvoice>>("/city-ledger/invoices", { query: q as Q }),
  invoice: (id: string) => api<CityLedgerInvoiceDocument>(`/city-ledger/invoices/${id}`),
  issue: (b: { accountId: string; chargeIds?: string[]; periodFrom?: string; periodTo?: string; notes?: string }) =>
    api<CityLedgerInvoiceDocument>("/city-ledger/invoices", { method: "POST", body: b }),
  payInvoice: (id: string, b: { amountKobo: number; method: LedgerPaymentMethod; reference?: string; receivedAt?: string; note?: string }) =>
    api<CityLedgerInvoiceDocument>(`/city-ledger/invoices/${id}/payments`, { method: "POST", body: b }),
  payAccount: (b: { accountId: string; amountKobo: number; method: LedgerPaymentMethod; reference?: string; receivedAt?: string; note?: string }) =>
    api<{ payment: CityLedgerPayment; allocations: { invoiceId: string; number: string; amountKobo: number }[] }>("/city-ledger/payments", { method: "POST", body: b }),
  payments: (q: { accountId?: string; page?: number; pageSize?: number }) => api<Paginated<CityLedgerPayment>>("/city-ledger/payments", { query: q }),
  remind: (id: string, message?: string) => api<{ sentTo: string; notificationId: string }>(`/city-ledger/invoices/${id}/remind`, { method: "POST", body: { message: message || undefined } }),
  void: (id: string, reason: string) => api<CityLedgerInvoiceDocument>(`/city-ledger/invoices/${id}/void`, { method: "POST", body: { reason } }),
  share: (id: string) => api<{ token: string; url: string; expiresAt: string }>(`/city-ledger/invoices/${id}/share`, { method: "POST", body: {} }),
};

/* ---------- notifications ---------- */
export const notifyApi = {
  templates: () => api<WhatsAppTemplates>("/whatsapp/templates"),
  settings: () => api<NotificationSettings>("/notification-settings"),
  save: (b: NotificationSettingsInput) => api<NotificationSettings>("/notification-settings", { method: "PUT", body: b }),
  alerts: (page = 1, pageSize = 20) => api<Paginated<GuardAlert>>("/guard/alerts", { query: { page, pageSize } }),
  testAlert: () => api<GuardAlert>("/guard/alerts/test", { method: "POST" }),
};
