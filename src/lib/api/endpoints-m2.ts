import { api, apiRaw } from "./client";
import type { Room, RoomStatus } from "./types";
import type {
  Approver,
  Availability,
  ChargeInput,
  CheckInInput,
  CheckOutResult,
  DailyFlash,
  Digest,
  DigestData,
  DigestSettings,
  DiscountInput,
  Folio,
  FolioListItem,
  FrontDeskToday,
  GuardFlag,
  GuardRuleInfo,
  GuardSummary,
  Guest,
  GuestDetail,
  GuestInput,
  GuestUpdate,
  HousekeepingTaskM2,
  IdDocument,
  InvoiceDocument,
  InvoiceListItem,
  NightAuditRun,
  Paginated,
  PaymentInput,
  PaymentsReport,
  PublicDocument,
  RangeReport,
  ReceiptDocument,
  ReceiptListItem,
  RefundInput,
  RegisterRow,
  RegistrationInput,
  ReservationDetail,
  ReservationInput,
  ReservationListItem,
  ReservationPatch,
  ReservationQuery,
  RoomAvailability,
  ShareLink,
  Shift,
  ShiftCloseInput,
  ShiftDetail,
  ShiftsReport,
  StayType,
  TapeChart,
  TaxSettings,
  TaxSettingsPatch,
} from "./types-m2";

/** Options for offline-safe writes (see API-M2 0.1). */
export interface WriteOpts {
  idempotencyKey?: string;
}
const idem = (o?: WriteOpts) => (o?.idempotencyKey ? { "Idempotency-Key": o.idempotencyKey } : undefined);

export const reservationsApi = {
  list: (q: ReservationQuery = {}) =>
    api<Paginated<ReservationListItem>>("/reservations", { query: q as Record<string, string | number | undefined> }),
  get: (id: string) => api<ReservationDetail>(`/reservations/${id}`),
  create: (input: ReservationInput, o?: WriteOpts) =>
    api<ReservationDetail>("/reservations", { method: "POST", body: input, headers: idem(o) }),
  update: (id: string, patch: ReservationPatch) =>
    api<ReservationDetail>(`/reservations/${id}`, { method: "PATCH", body: patch }),
  confirm: (id: string) => api<ReservationDetail>(`/reservations/${id}/confirm`, { method: "POST", body: {} }),
  moveRoom: (id: string, roomId: string, reason?: string) =>
    api<ReservationDetail>(`/reservations/${id}/move-room`, { method: "POST", body: { roomId, reason } }),
  convertToNightly: (id: string, departureDate?: string) =>
    api<ReservationDetail>(`/reservations/${id}/convert-to-nightly`, { method: "POST", body: { departureDate } }),
  cancel: (id: string, reason: string, feeKobo?: number) =>
    api<ReservationDetail>(`/reservations/${id}/cancel`, { method: "POST", body: { reason, feeKobo } }),
  noShow: (id: string, reason?: string, feeKobo?: number) =>
    api<ReservationDetail>(`/reservations/${id}/no-show`, { method: "POST", body: { reason, feeKobo } }),
  checkIn: (id: string, input: CheckInInput, o?: WriteOpts) =>
    api<ReservationDetail>(`/reservations/${id}/check-in`, { method: "POST", body: input, headers: idem(o) }),
  checkOut: (id: string, input: { override?: { reason: string }; clientCreatedAt?: string }, o?: WriteOpts) =>
    api<CheckOutResult>(`/reservations/${id}/check-out`, { method: "POST", body: input, headers: idem(o) }),
  registration: (id: string, input: RegistrationInput & { guest?: GuestUpdate }) =>
    api<ReservationDetail>(`/reservations/${id}/registration`, { method: "PUT", body: input }),
  folio: (id: string) => api<Folio>(`/reservations/${id}/folio`),
};

export const availabilityApi = {
  byType: (from: string, to: string, roomTypeId?: string) =>
    api<Availability>("/availability", { query: { from, to, roomTypeId } }),
  rooms: (q: {
    roomTypeId: string;
    stayType?: StayType;
    arrivalDate?: string;
    departureDate?: string;
    arrivalAt?: string;
    departureAt?: string;
    excludeReservationId?: string;
  }) => api<RoomAvailability>("/availability/rooms", { query: q }),
  tapeChart: (from: string, to: string) => api<TapeChart>("/tape-chart", { query: { from, to } }),
};

export const frontDeskApi = {
  today: () => api<FrontDeskToday>("/front-desk/today"),
  setRoomStatus: (id: string, status: RoomStatus, note?: string, clientCreatedAt?: string, o?: WriteOpts) =>
    api<Room>(`/rooms/${id}/status`, { method: "PATCH", body: { status, note: note || undefined, clientCreatedAt }, headers: idem(o) }),
};

export const guestsApi = {
  list: (q: { q?: string; vip?: boolean; page?: number; pageSize?: number } = {}) =>
    api<Paginated<Guest>>("/guests", { query: q }),
  lookup: (phone: string) => api<Guest>("/guests/lookup", { query: { phone } }),
  create: (input: GuestInput) => api<Guest>("/guests", { method: "POST", body: input }),
  get: (id: string) => api<GuestDetail>(`/guests/${id}`),
  update: (id: string, patch: GuestUpdate) => api<Guest>(`/guests/${id}`, { method: "PATCH", body: patch }),
  idDocument: (id: string) => api<IdDocument>(`/guests/${id}/id-document`),
  uploadIdImage: (id: string, file: Blob, name = "id.jpg") => {
    const fd = new FormData();
    fd.append("file", file, name);
    return api<{ hasIdImage: true; idImageUrl: string }>(`/guests/${id}/id-image`, { method: "POST", body: fd });
  },
  deleteIdImage: (id: string) => api<{ success: true }>(`/guests/${id}/id-image`, { method: "DELETE" }),
  exportData: (id: string) => api<Record<string, unknown>>(`/guests/${id}/export`),
  anonymise: (id: string, reason: string) => api<Guest>(`/guests/${id}/anonymise`, { method: "POST", body: { reason } }),
  register: (from: string, to: string) =>
    api<{ from: string; to: string; items: RegisterRow[] }>("/guest-register", { query: { from, to, format: "json" } }),
  registerCsv: (from: string, to: string, includeIdNumbers = false) =>
    apiRaw("/guest-register", { query: { from, to, format: "csv", includeIdNumbers }, headers: { Accept: "text/csv" } }),
};

export const taxApi = {
  get: () => api<TaxSettings>("/tax-settings"),
  update: (patch: TaxSettingsPatch) => api<TaxSettings>("/tax-settings", { method: "PUT", body: patch }),
};

export const foliosApi = {
  list: (q: { status?: string; kind?: string; q?: string; page?: number; pageSize?: number } = {}) =>
    api<Paginated<FolioListItem>>("/folios", { query: q }),
  create: (input: { name: string; guestId?: string; notes?: string }) =>
    api<Folio>("/folios", { method: "POST", body: input }),
  get: (id: string) => api<Folio>(`/folios/${id}`),
  charge: (id: string, input: ChargeInput) => api<Folio>(`/folios/${id}/charges`, { method: "POST", body: input }),
  discount: (id: string, input: DiscountInput) => api<Folio>(`/folios/${id}/discounts`, { method: "POST", body: input }),
  pay: (id: string, input: PaymentInput, o?: WriteOpts) =>
    api<{ folio: Folio; receipt: ReceiptDocument }>(`/folios/${id}/payments`, { method: "POST", body: input, headers: idem(o) }),
  refund: (id: string, input: RefundInput) => api<Folio>(`/folios/${id}/refunds`, { method: "POST", body: input }),
  voidEntry: (id: string, entryId: string, reason: string) =>
    api<Folio>(`/folios/${id}/entries/${entryId}/void`, { method: "POST", body: { reason } }),
  close: (id: string) => api<{ folio: Folio; invoice: InvoiceDocument }>(`/folios/${id}/close`, { method: "POST", body: {} }),
  proforma: (id: string) => api<InvoiceDocument>(`/folios/${id}/invoices`, { method: "POST", body: { kind: "PROFORMA" } }),
};

export const documentsApi = {
  invoices: (q: { kind?: string; from?: string; to?: string; q?: string; page?: number; pageSize?: number } = {}) =>
    api<Paginated<InvoiceListItem>>("/invoices", { query: q }),
  invoice: (id: string) => api<InvoiceDocument>(`/invoices/${id}`),
  receipts: (q: { from?: string; to?: string; method?: string; q?: string; page?: number; pageSize?: number } = {}) =>
    api<Paginated<ReceiptListItem>>("/receipts", { query: q }),
  receipt: (id: string) => api<ReceiptDocument>(`/receipts/${id}`),
  shareInvoice: (id: string, expiresInHours?: number) =>
    api<ShareLink>(`/invoices/${id}/share`, { method: "POST", body: { expiresInHours } }),
  shareReceipt: (id: string, expiresInHours?: number) =>
    api<ShareLink>(`/receipts/${id}/share`, { method: "POST", body: { expiresInHours } }),
  publicDocument: (token: string) => api<PublicDocument>(`/public/documents/${encodeURIComponent(token)}`, { auth: "none" }),
};

export const shiftsApi = {
  current: () => api<Shift | null>("/shifts/current"),
  open: (openingFloatKobo: number, notes?: string) =>
    api<Shift>("/shifts/open", { method: "POST", body: { openingFloatKobo, notes } }),
  close: (id: string, input: ShiftCloseInput) => api<ShiftDetail>(`/shifts/${id}/close`, { method: "POST", body: input }),
  approve: (id: string, notes?: string) => api<ShiftDetail>(`/shifts/${id}/approve`, { method: "POST", body: { notes } }),
  list: (q: { status?: string; userId?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}) =>
    api<Paginated<Shift>>("/shifts", { query: q }),
  get: (id: string) => api<ShiftDetail>(`/shifts/${id}`),
};

export const pinApi = {
  set: (pin: string, currentPassword: string) =>
    api<{ success: true }>("/me/approval-pin", { method: "PUT", body: { pin, currentPassword } }),
  remove: () => api<{ success: true }>("/me/approval-pin", { method: "DELETE" }),
  approvers: () => api<Approver[]>("/staff/approvers"),
};

export const guardApi = {
  flags: (q: { status?: string; severity?: string; rule?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}) =>
    api<Paginated<GuardFlag>>("/guard/flags", { query: q }),
  flag: (id: string) => api<GuardFlag>(`/guard/flags/${id}`),
  triage: (id: string, status: "ACKNOWLEDGED" | "RESOLVED" | "DISMISSED", resolution?: string) =>
    api<GuardFlag>(`/guard/flags/${id}`, { method: "PATCH", body: { status, resolution } }),
  rules: () => api<GuardRuleInfo[]>("/guard/rules"),
  summary: () => api<GuardSummary>("/guard/summary"),
  sweep: () => api<{ created: number }>("/guard/sweep", { method: "POST", body: {} }),
};

export const digestsApi = {
  list: (page = 1, pageSize = 20) => api<Paginated<Digest>>("/digests", { query: { page, pageSize } }),
  settings: () => api<DigestSettings>("/digests/settings"),
  updateSettings: (s: DigestSettings) => api<DigestSettings>("/digests/settings", { method: "PUT", body: s }),
  preview: (businessDate?: string) =>
    api<{ body: string; data: DigestData }>("/digests/preview", { method: "POST", body: { businessDate } }),
  send: (businessDate?: string) => api<Digest>("/digests/send", { method: "POST", body: { businessDate } }),
};

export const reportsApi = {
  daily: (date?: string) => api<DailyFlash>("/reports/daily", { query: { date } }),
  range: (from: string, to: string) => api<RangeReport>("/reports/range", { query: { from, to } }),
  payments: (from: string, to: string) => api<PaymentsReport>("/reports/payments", { query: { from, to } }),
  shifts: (from: string, to: string) => api<ShiftsReport>("/reports/shifts", { query: { from, to } }),
  auditRuns: (page = 1, pageSize = 10) => api<Paginated<NightAuditRun>>("/night-audit/runs", { query: { page, pageSize } }),
  runAudit: (businessDate?: string) =>
    api<NightAuditRun & { alreadyRun: boolean }>("/night-audit/run", { method: "POST", body: { businessDate } }),
};

export const housekeepingApi = {
  tasks: (status?: string) => api<HousekeepingTaskM2[]>("/housekeeping/tasks", { query: { status } }),
  update: (id: string, status: HousekeepingTaskM2["status"], notes?: string) =>
    api<HousekeepingTaskM2>(`/housekeeping/tasks/${id}`, { method: "PATCH", body: { status, notes } }),
};
