/**
 * Milestone 7 contract (API-M7.md): site theme and templates, the booking form,
 * paid extras, pickup points, transfers and the setup wizard.
 */

import type { Channel, ConditionOp, ExtraCategory, ExtraPricing, FieldType, PickupKind, Requirement, TransferStatus } from "@/lib/m7-catalog";

export type { Channel, ConditionOp, ExtraCategory, ExtraPricing, FieldType, PickupKind, Requirement, TransferStatus };

export type PlanCode = "starter" | "growth" | "pro" | "enterprise";
type Who = { id: string | null; fullName: string } | null;

/* ---------------- 0. shared ---------------- */

export interface ValidationIssue {
  path: string;
  fieldKey: string | null;
  code: string;
  message: string;
  meta?: Record<string, unknown>;
}

export interface SiteGates {
  features: Record<string, boolean>;
  requiredPlans: Record<string, PlanCode>;
  templates: { id: string; available: boolean }[];
  limits: { max_custom_form_fields: number };
  usage: { customFormFields: number };
}

/* ---------------- 1. theme ---------------- */

export type ColourMode = "LIGHT" | "DARK" | "SYSTEM";

export interface ThemeSection {
  id: string;
  key: string;
  enabled: boolean;
  order: number;
  options: Record<string, unknown>;
}

export interface SiteTemplate {
  id: string;
  name: string;
  description: string;
  bestFor: string[];
  availableOn: PlanCode[];
  feature: string | null;
  sections: string[];
  defaultSections: ThemeSection[];
  defaultFontPairingId: string;
  defaultColourMode: ColourMode;
  traits: { hero: string; density: string; corners: string; imageWeight: string };
  performance: { maxJsKb: number | null; imagesAboveFold: boolean };
  previewImages: { thumb: string; desktop: string; mobile: string };
}

export interface FontFace {
  family: string;
  category: "serif" | "sans" | "display" | "system";
  weights: number[];
  italicWeights: number[];
  googleFontsUrl: string | null;
  cssStack: string;
}

export interface FontPairingInfo {
  id: string;
  name: string;
  heading: FontFace;
  body: FontFace;
  mood: string;
  isHouseDefault: boolean;
  templateDefaults: string[];
  googleFontsUrl: string | null;
}

export interface ThemeBrand {
  logoAssetId: string | null;
  faviconAssetId: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  primary: string;
  secondary: string | null;
  fontPairingId: string | null;
}

export interface ColourSet {
  paper: string;
  surface: string;
  surface2: string;
  ink: string;
  inkMuted: string;
  line: string;
  primary: string;
  onPrimary: string;
  primaryText: string;
  secondary: string;
  onSecondary: string;
  secondaryText: string;
  focusRing: string;
}

export interface AppliedColours {
  chosen: { primary: string; secondary: string | null };
  light: ColourSet;
  dark: ColourSet;
  contrast: { light: Record<string, number>; dark: Record<string, number> };
  adjusted: boolean;
  adjustments: { mode: "light" | "dark"; token: string; from: string; to: string; reason: string }[];
}

export interface ThemeContent {
  templateId: string;
  brand: ThemeBrand;
  colourMode: ColourMode;
  sections: ThemeSection[];
  applied?: AppliedColours;
  fontPairing?: FontPairingInfo;
}

export interface ThemeVersionView extends ThemeContent {
  id: string;
  version: number;
  publishedAt: string;
  publishedBy: Who;
  note: string | null;
}

export interface SiteThemeState {
  scope: "PROPERTY" | "GROUP";
  propertyId: string | null;
  themeId: string;
  draft: ThemeContent & { updatedAt: string; updatedBy: Who };
  published: ThemeVersionView | null;
  hasUnpublishedChanges: boolean;
  changes: string[];
  gates: SiteGates;
  siteUrl: string;
}

export interface ThemeDraftInput {
  templateId?: string;
  resetSections?: boolean;
  brand?: Partial<Pick<ThemeBrand, "logoAssetId" | "faviconAssetId" | "logoUrl" | "primary" | "secondary" | "fontPairingId">>;
  colourMode?: ColourMode;
  sections?: ThemeSection[];
}

export interface ThemeVersionItem {
  id: string;
  version: number;
  publishedAt: string;
  publishedBy: Who;
  note: string | null;
  templateId: string;
  primary: string;
  isCurrent: boolean;
}

export interface SiteAsset {
  id: string;
  kind: "logo" | "favicon" | "image";
  url: string;
  contentType: string;
  width: number;
  height: number;
  bytes: number;
  strippedBytes: number;
  originalName: string | null;
  createdAt: string;
  usedBy: ("DRAFT" | "PUBLISHED")[];
}

export interface PreviewToken {
  token: string;
  expiresAt: string;
  urls: { site: string; booking: string };
}

/* ---------------- 2. booking form ---------------- */

export interface FieldCondition {
  fieldKey: string;
  operator: ConditionOp;
  value?: string | number | boolean | string[];
}

export interface FieldValidation {
  min?: number;
  max?: number;
  pattern?: string;
  maxLength?: number;
  maxFileMB?: number;
  accept?: ("pdf" | "jpeg" | "png" | "webp")[];
}

export interface FormField {
  key: string;
  source: "SYSTEM" | "LIBRARY" | "CUSTOM";
  libraryKey: string | null;
  recommended: boolean;
  type: FieldType;
  label: string;
  helpText: string | null;
  placeholder: string | null;
  required: Requirement;
  options: { value: string; label: string }[];
  validation: FieldValidation;
  section: string;
  order: number;
  channels: Channel[];
  condition: FieldCondition | null;
  purpose: string | null;
  guestPurpose: string | null;
  sensitive: boolean;
  extra?: { categories: ExtraCategory[] | null } | null;
  pickup?: { directions: ("ARRIVAL" | "DEPARTURE")[]; pickupPointIds: string[] | null } | null;
  /* server-computed */
  locked?: { remove: boolean; hide: boolean; type: boolean; channels: boolean };
  mapsTo?: string | null;
  boundTo?: "QUOTE" | "GUEST" | "CONSENT" | null;
  idLike?: { kind: string } | null;
  conditionText?: string | null;
}

export interface FormVersionSummary {
  id: string;
  version: number;
  publishedAt: string;
  publishedBy: Who;
  note: string | null;
  fieldCount: number;
}

export interface FormDiff {
  added: { key: string; label: string }[];
  removed: { key: string; label: string }[];
  changed: { key: string; label: string; changes: string[] }[];
  summary: string;
}

export interface FormWarning {
  fieldKey: string;
  code: string;
  kind?: string;
  message: string;
  suggestion?: string;
}

export interface BookingFormState {
  id: string;
  propertyId: string;
  presetId: string | null;
  draft: { fields: FormField[]; updatedAt: string; updatedBy: Who };
  published: FormVersionSummary | null;
  hasUnpublishedChanges: boolean;
  diff: FormDiff;
  warnings: FormWarning[];
  gates: SiteGates;
}

export interface LibraryItem {
  libraryKey: string;
  name: string;
  description: string;
  fields: FormField[];
  feature: string | null;
  available: boolean;
  alreadyAdded: boolean;
}

export interface LibraryResponse {
  system: FormField[];
  recommended: FormField[];
  library: LibraryItem[];
  customTypes: { type: FieldType; label: string; feature: string | null; available: boolean }[];
  sections: string[];
  channels: Channel[];
}

export interface FormPreset {
  id: string;
  name: string;
  hotelType: string;
  description: string;
  suggestedTemplateId: string;
  fieldKeys: string[];
  customFields: string[];
}

export interface LabelCheck {
  level: "OK" | "WARN" | "BLOCK";
  kind: string | null;
  message: string | null;
}

export interface TransportCompany {
  id: string;
  name: string;
  shortName: string | null;
  source: "PLATFORM" | "HOTEL";
}

export interface TrainRoute {
  id: string;
  name: string;
  operator: string;
  stations: string[];
  services: string[];
}

export interface PublicBookingForm {
  formVersionId: string | null;
  version: number | null;
  preview: boolean;
  channel: Channel;
  sections: { name: string; order: number; fieldKeys: string[] }[];
  fields: FormField[];
  rules: { emailRequiredFor: ("ONLINE" | "PAY_AT_HOTEL")[]; phoneDefaultCountry: string; consentRequired: boolean };
  extras: PublicExtra[];
  pickup: { points: PublicPickupPoint[]; transportCompanies: TransportCompany[]; trainRoutes: TrainRoute[] } | null;
  uploads: { enabled: boolean; maxFileMB: number };
}

export interface AnswerView {
  key: string;
  label: string;
  type: FieldType;
  section: string;
  source: "SYSTEM" | "LIBRARY" | "CUSTOM";
  value: unknown;
  display: string;
  sensitive: boolean;
  mapsTo: string | null;
  file?: { name: string; contentType: string; size: number; url: string };
}

export interface BookingFormAnswers {
  formVersionId: string;
  version: number;
  channel: Channel;
  submittedAt: string;
  answers: AnswerView[];
}

export interface PickupAnswer {
  wanted: boolean;
  pickupPointId?: string;
  vehicleOptionId?: string | null;
  passengers?: number;
  luggage?: number | null;
  contactPhone?: string | null;
  scheduledAt?: string;
  details?: Record<string, unknown>;
  departure?: { wanted: boolean; sameAsArrival: boolean; pickupPointId?: string; vehicleOptionId?: string | null; scheduledAt?: string } | null;
}

/* ---------------- 3. extras ---------------- */

export type ExtraKind = "STANDARD" | "EARLY_CHECK_IN" | "LATE_CHECK_OUT";

export interface ExtraAvailability {
  validFrom: string | null;
  validTo: string | null;
  daysOfWeek: number[] | null;
  minNights: number | null;
  earlyFrom: string | null;
  lateUntil: string | null;
}

export interface Extra {
  id: string;
  propertyId: string;
  name: string;
  description: string;
  imageUrl: string | null;
  category: ExtraCategory;
  kind: ExtraKind;
  pricing: ExtraPricing;
  priceKobo: number;
  maxUnits: number | null;
  taxable: boolean;
  channels: Channel[];
  availability: ExtraAvailability;
  dailyCap: number | null;
  leadTimeHours: number;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  soldLast30Days: number;
}

export type ExtraInput = Omit<Extra, "id" | "propertyId" | "sortOrder" | "createdAt" | "updatedAt" | "soldLast30Days"> & { sortOrder?: number };

export interface QuotedExtra {
  extraId: string;
  name: string;
  category: ExtraCategory;
  pricing: ExtraPricing;
  quantity: number;
  persons: number | null;
  nights: number | null;
  unitPriceKobo: number;
  amountKobo: number;
  netKobo: number;
  taxKobo: number;
  totalKobo: number;
  description: string;
  serviceDates: string[];
}

export type PublicExtra = Pick<Extra, "id" | "name" | "description" | "imageUrl" | "category" | "kind" | "pricing" | "priceKobo" | "maxUnits" | "taxable" | "availability"> & {
  available: boolean | null;
  unavailableReason: string | null;
  price: QuotedExtra | null;
};

export interface ExtraSelection {
  extraId: string;
  quantity?: number;
}

export interface ExtrasQuote {
  extras: QuotedExtra[];
  subtotalKobo: number;
  taxKobo: number;
  totalKobo: number;
  issues: ValidationIssue[];
}

export interface ReservationExtra extends QuotedExtra {
  id: string;
  reservationId: string;
  status: "ACTIVE" | "CANCELLED";
  source: "ONLINE" | "FRONT_DESK";
  posted: boolean;
  postedAt: string | null;
  folioEntryId: string | null;
  createdAt: string;
  createdBy: string | null;
}

/* ---------------- 4. pickups and transfers ---------------- */

export interface VehicleOption {
  id?: string;
  name: string;
  maxPassengers: number;
  priceKobo: number | null;
}

export interface PickupPoint {
  id: string;
  propertyId: string;
  name: string;
  shortName: string | null;
  kind: PickupKind;
  city: string;
  address: string | null;
  priceKobo: number;
  dropOffPriceKobo: number | null;
  vehicleOptions: VehicleOption[];
  leadTimeHours: number;
  operatingHours: { open: string; close: string } | null;
  notesForGuest: string | null;
  taxable: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export type PickupPointInput = Omit<PickupPoint, "id" | "propertyId" | "sortOrder" | "createdAt" | "updatedAt"> & { sortOrder?: number };
export type PublicPickupPoint = Omit<PickupPoint, "propertyId" | "active" | "sortOrder" | "createdAt" | "updatedAt">;

export interface TransferSelection {
  direction: "ARRIVAL" | "DEPARTURE";
  pickupPointId: string;
  vehicleOptionId?: string | null;
  passengers: number;
  scheduledAt: string;
}

export interface Transfer {
  id: string;
  propertyId: string;
  reservationId: string;
  reservation: { code: string; status: string; guestName: string; guestPhone: string | null; roomNumber: string | null; arrivalDate: string; departureDate: string };
  direction: "ARRIVAL" | "DEPARTURE";
  status: TransferStatus;
  pickupPoint: { id: string; name: string; shortName: string | null; kind: PickupKind; city: string };
  details: Record<string, unknown>;
  detailsSummary: string;
  scheduledAt: string;
  passengers: number;
  luggage: number | null;
  vehicleOption: { id: string; name: string; maxPassengers: number } | null;
  amountKobo: number;
  taxKobo: number;
  totalKobo: number;
  contactPhone: string | null;
  driver: { name: string; phone: string; vehiclePlate: string; vehicleDescription: string | null; assignedAt: string } | null;
  delayNote: string | null;
  notes: string | null;
  events: { at: string; status: TransferStatus | null; note: string | null; by: string | null }[];
  posted: boolean;
  source: "ONLINE" | "FRONT_DESK";
  lastNotifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TransferList {
  items: Transfer[];
  counts: { arrivals: number; departures: number; unassigned: number; inProgress: number; done: number };
}

export interface TransfersToday {
  date: string;
  arrivals: number;
  departures: number;
  unassigned: number;
  inProgress: number;
  next: Transfer[];
}

/* ---------------- 5. setup ---------------- */

export type SetupStepKey = "hotel_type" | "brand" | "rooms" | "booking_form" | "extras" | "payments" | "policies" | "go_live";

export interface SetupStep {
  key: SetupStepKey;
  order: number;
  title: string;
  description: string;
  status: "TODO" | "DONE" | "SKIPPED" | "LOCKED";
  required: boolean;
  skippable: boolean;
  completedAt: string | null;
  detected: boolean;
  summary: string | null;
  feature: string | null;
  requiredPlan: PlanCode | null;
}

export interface SetupProgress {
  propertyId: string;
  hotelType: string | null;
  startedAt: string | null;
  completedAt: string | null;
  steps: SetupStep[];
  currentStep: SetupStepKey | null;
  progressPct: number;
  canTakeBookings: boolean;
  showChecklist: boolean;
}

/* ---------------- 6. reservation additions ---------------- */

export interface ReservationM7 {
  bookingForm?: BookingFormAnswers | null;
  extras?: ReservationExtra[];
  transfers?: Transfer[];
  addOnsTotalKobo?: number;
  registerPrefill?: { arrivingFrom: string | null; purpose: string | null; vehiclePlate: string | null; nationality: string | null; address: string | null; dateOfBirth: string | null } | null;
  billTo?: { companyName: string; tin: string | null } | null;
}
