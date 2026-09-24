import { api } from "./client";
import type {
  AppliedColours,
  BookingFormState,
  Channel,
  Extra,
  ExtraInput,
  ExtraSelection,
  ExtrasQuote,
  FontPairingInfo,
  FormDiff,
  FormField,
  FormPreset,
  FormVersionSummary,
  LabelCheck,
  LibraryResponse,
  PickupPoint,
  PickupPointInput,
  PreviewToken,
  PublicBookingForm,
  ReservationExtra,
  SetupProgress,
  SetupStepKey,
  SiteAsset,
  SiteGates,
  SiteTemplate,
  SiteThemeState,
  ThemeDraftInput,
  ThemeVersionItem,
  TrainRoute,
  Transfer,
  TransferList,
  TransferSelection,
  TransferStatus,
  TransfersToday,
  TransportCompany,
  ValidationIssue,
} from "./types-m7";

export const siteApi = {
  templates: () => api<SiteTemplate[]>("/site/templates"),
  fontPairings: () => api<FontPairingInfo[]>("/site/font-pairings"),
  gates: () => api<SiteGates>("/site/gates"),
  theme: () => api<SiteThemeState>("/site/theme"),
  saveDraft: (b: ThemeDraftInput) => api<SiteThemeState>("/site/theme/draft", { method: "PUT", body: b }),
  publish: (note?: string) => api<SiteThemeState>("/site/theme/publish", { method: "POST", body: note ? { note } : {} }),
  discard: () => api<SiteThemeState>("/site/theme/discard", { method: "POST" }),
  versions: () => api<ThemeVersionItem[]>("/site/theme/versions"),
  revert: (id: string) => api<SiteThemeState>(`/site/theme/versions/${id}/revert`, { method: "POST", body: {} }),
  contrast: (primary: string, secondary?: string | null) => api<AppliedColours>("/site/theme/contrast", { method: "POST", body: { primary, secondary } }),
  previewToken: (kinds?: ("THEME" | "FORM")[]) => api<PreviewToken>("/site/preview-token", { method: "POST", body: kinds ? { kinds } : {} }),
  upload: (kind: "logo" | "favicon" | "image", file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);
    return api<SiteAsset>("/site/assets", { method: "POST", body: fd });
  },
};

export const formApi = {
  get: () => api<BookingFormState>("/booking-form"),
  library: () => api<LibraryResponse>("/booking-form/library"),
  presets: () => api<FormPreset[]>("/booking-form/presets"),
  saveDraft: (fields: FormField[]) => api<BookingFormState>("/booking-form/draft", { method: "PUT", body: { fields } }),
  checkLabel: (label: string, helpText?: string) => api<LabelCheck>("/booking-form/check-label", { method: "POST", body: { label, helpText } }),
  resetToPreset: (presetId: string) => api<BookingFormState>("/booking-form/reset-to-preset", { method: "POST", body: { presetId } }),
  publish: (note?: string) => api<{ state: BookingFormState; version: FormVersionSummary; diff: FormDiff }>("/booking-form/publish", { method: "POST", body: note ? { note } : {} }),
  discard: () => api<BookingFormState>("/booking-form/discard", { method: "POST" }),
  versions: () => api<FormVersionSummary[]>("/booking-form/versions"),
  version: (id: string) => api<FormVersionSummary & { fields: FormField[] }>(`/booking-form/versions/${id}`),
  restore: (id: string) => api<BookingFormState>(`/booking-form/versions/${id}/restore`, { method: "POST" }),
  render: (channel: Channel, source: "published" | "draft" = "published") => api<PublicBookingForm>("/booking-form/render", { query: { channel, source } }),
  validate: (b: { channel: Channel; source?: "published" | "draft"; answers: Record<string, unknown>; paymentMode?: "ONLINE" | "PAY_AT_HOTEL"; adults?: number; children?: number; guest?: { fullName?: string; phone?: string; email?: string } }) =>
    api<{ valid: boolean; issues: ValidationIssue[]; visibleKeys: string[] }>("/booking-form/validate", { method: "POST", body: b }),
  upload: (file: File, fieldKey: string) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("fieldKey", fieldKey);
    return api<{ uploadId: string; token: string; fieldKey: string; name: string; contentType: string; size: number; expiresAt: string }>("/booking-form/uploads", { method: "POST", body: fd });
  },
};

export const extrasApi = {
  list: () => api<Extra[]>("/extras"),
  create: (b: ExtraInput) => api<Extra>("/extras", { method: "POST", body: b }),
  update: (id: string, b: Partial<ExtraInput>) => api<Extra>(`/extras/${id}`, { method: "PATCH", body: b }),
  remove: (id: string) => api<{ success: true }>(`/extras/${id}`, { method: "DELETE" }),
  quote: (b: { extras: ExtraSelection[]; arrivalDate: string; departureDate: string; adults: number; children: number; channel?: Channel }) => api<ExtrasQuote>("/extras/quote", { method: "POST", body: b }),
};

export const pickupApi = {
  list: () => api<PickupPoint[]>("/pickup-points"),
  create: (b: PickupPointInput) => api<PickupPoint>("/pickup-points", { method: "POST", body: b }),
  update: (id: string, b: Partial<PickupPointInput>) => api<PickupPoint>(`/pickup-points/${id}`, { method: "PATCH", body: b }),
  remove: (id: string) => api<{ success: true }>(`/pickup-points/${id}`, { method: "DELETE" }),
  companies: () => api<TransportCompany[]>("/transport-companies"),
  addCompany: (name: string, shortName?: string) => api<TransportCompany>("/transport-companies", { method: "POST", body: { name, shortName } }),
  removeCompany: (id: string) => api<{ success: true }>(`/transport-companies/${id}`, { method: "DELETE" }),
  trainRoutes: () => api<TrainRoute[]>("/train-routes"),
};

export const transfersApi = {
  list: (q: { date?: string; from?: string; to?: string; status?: string; direction?: string }) => api<TransferList>("/transfers", { query: q }),
  today: () => api<TransfersToday>("/transfers/today"),
  get: (id: string) => api<Transfer>(`/transfers/${id}`),
  update: (id: string, b: { scheduledAt?: string; passengers?: number; luggage?: number | null; contactPhone?: string | null; notes?: string | null; details?: Record<string, unknown> }) =>
    api<Transfer>(`/transfers/${id}`, { method: "PATCH", body: b }),
  confirm: (id: string) => api<Transfer>(`/transfers/${id}/confirm`, { method: "POST" }),
  assign: (id: string, b: { driverName: string; driverPhone: string; vehiclePlate: string; vehicleDescription?: string; notifyGuest?: boolean }) =>
    api<Transfer & { notified: { channel: string; to: string; status: string }[] }>(`/transfers/${id}/assign`, { method: "POST", body: b }),
  status: (id: string, status: TransferStatus, note?: string, notifyGuest?: boolean) => api<Transfer>(`/transfers/${id}/status`, { method: "POST", body: { status, note, notifyGuest } }),
  delay: (id: string, b: { note: string; newScheduledAt?: string; notifyGuest?: boolean }) => api<Transfer>(`/transfers/${id}/delay`, { method: "POST", body: b }),
};

export const reservationAddOnsApi = {
  extras: (id: string) => api<ReservationExtra[]>(`/reservations/${id}/extras`),
  addExtra: (id: string, b: ExtraSelection) => api<ReservationExtra>(`/reservations/${id}/extras`, { method: "POST", body: b }),
  removeExtra: (id: string, lineId: string) => api<{ success: true }>(`/reservations/${id}/extras/${lineId}`, { method: "DELETE" }),
  addTransfer: (id: string, b: TransferSelection & { details?: Record<string, unknown>; luggage?: number | null; contactPhone?: string | null; notes?: string | null }) =>
    api<Transfer>(`/reservations/${id}/transfers`, { method: "POST", body: b }),
  removeTransfer: (id: string, transferId: string) => api<{ success: true }>(`/reservations/${id}/transfers/${transferId}`, { method: "DELETE" }),
  saveAnswers: (id: string, answers: Record<string, unknown>) => api<unknown>(`/reservations/${id}/form-answers`, { method: "PUT", body: { answers } }),
};

export const setupApi = {
  get: () => api<SetupProgress>("/setup"),
  hotelType: (hotelType: string, opts: { applyFormPreset?: boolean; applyTemplate?: boolean } = {}) => api<SetupProgress>("/setup/hotel-type", { method: "POST", body: { hotelType, ...opts } }),
  step: (key: SetupStepKey, status: "DONE" | "SKIPPED" | "TODO") => api<SetupProgress>(`/setup/steps/${key}`, { method: "PUT", body: { status } }),
  goLive: (b: { publishTheme?: boolean; publishForm?: boolean; listOnMarketplace?: boolean }) => api<SetupProgress>("/setup/go-live", { method: "POST", body: b }),
};
