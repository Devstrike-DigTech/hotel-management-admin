import { api } from "./client";
import type { Staff } from "./types";
import type {
  ChannelBooking,
  ChannelConnection,
  ChannelCost,
  ChannelMapping,
  ChannelSummary,
  CompetitorRate,
  ConversationDetail,
  ConversationListItem,
  ConversationStatus,
  CustomDomain,
  DomainsView,
  EventImpact,
  FrozenDate,
  GroupDashboard,
  GroupReport,
  Guardrail,
  IcalExport,
  IcalFeed,
  InboxSettings,
  InboxSummary,
  InHouseForPos,
  KdsStation,
  KdsTicketStatus,
  KdsTicketWire,
  LineInput,
  LoyaltyMember,
  LoyaltyProgramme,
  LoyaltySummary,
  LoyaltyTier,
  LoyaltyTxn,
  M5TemplateName,
  MenuCategory,
  MenuItem,
  MenuItemInput,
  MessageWire,
  MinibarPar,
  MinibarRoom,
  OrderCreateInput,
  OtaChannel,
  Outlet,
  OutletInput,
  Paginated,
  PosOrder,
  PosOrderListItem,
  PosSalesReport,
  PriceChange,
  PriceRule,
  PricingEvent,
  PricingReport,
  PricingSettings,
  PropertyAccess,
  PropertyCreateInput,
  PropertySummary,
  QuickReplyWire,
  RedeemChallenge,
  RedeemResult,
  RemoteCatalogue,
  SettleResult,
  SettleInput,
  StockCount,
  StockItem,
  StockMovement,
  StockVariance,
  Suggestion,
  SyncLog,
  TaskPriority,
  TaskSuggestion,
  TerminalMenu,
  TierColor,
} from "./types-m5";

const enc = encodeURIComponent;
const idem = (kind: string) =>
  `m5:${kind}:${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`}`;
const post = <T>(path: string, body: unknown = {}, kind = "w") => api<T>(path, { method: "POST", body, headers: { "Idempotency-Key": idem(kind) } });

/* ---------- 1. properties ---------- */
export const propertiesApi = {
  /** tenant-wide: sent without X-Property-Id */
  list: () => api<PropertySummary[]>("/properties", { propertyId: null }),
  create: (b: PropertyCreateInput) => api<PropertySummary & Record<string, unknown>>("/properties", { method: "POST", body: b, propertyId: null }),
  update: (id: string, b: Record<string, unknown>) => api<Record<string, unknown>>(`/properties/${enc(id)}`, { method: "PATCH", body: b, propertyId: id }),
  setCurrent: (propertyId: string) => api<{ currentProperty: PropertySummary }>("/me/current-property", { method: "PUT", body: { propertyId }, propertyId: null }),
  staffAccess: (staffId: string, b: PropertyAccess) => api<Staff & { propertyAccess: PropertyAccess }>(`/staff/${enc(staffId)}/property-access`, { method: "PUT", body: b, propertyId: null }),
  groupReport: (from: string, to: string, propertyIds?: string[]) =>
    api<GroupReport>("/reports/group", { query: { from, to, propertyIds: propertyIds?.length ? propertyIds.join(",") : undefined }, propertyId: null }),
  groupDashboard: () => api<GroupDashboard>("/dashboard/group", { propertyId: null }),
};

/* ---------- 2. point of sale ---------- */
export const posApi = {
  outlets: () => api<Outlet[]>("/pos/outlets"),
  createOutlet: (b: OutletInput) => api<Outlet>("/pos/outlets", { method: "POST", body: b }),
  updateOutlet: (id: string, b: OutletInput) => api<Outlet>(`/pos/outlets/${enc(id)}`, { method: "PATCH", body: b }),
  categories: () => api<MenuCategory[]>("/pos/categories"),
  createCategory: (b: { name: string; station?: KdsStation | null; sortOrder?: number }) => api<MenuCategory>("/pos/categories", { method: "POST", body: b }),
  updateCategory: (id: string, b: { name?: string; station?: KdsStation | null; sortOrder?: number }) => api<MenuCategory>(`/pos/categories/${enc(id)}`, { method: "PATCH", body: b }),
  deleteCategory: (id: string) => api<{ success: true }>(`/pos/categories/${enc(id)}`, { method: "DELETE" }),
  items: (q: { outletId?: string; categoryId?: string; available?: boolean; q?: string } = {}) => api<MenuItem[]>("/pos/items", { query: q }),
  createItem: (b: MenuItemInput) => api<MenuItem>("/pos/items", { method: "POST", body: b }),
  updateItem: (id: string, b: MenuItemInput) => api<MenuItem>(`/pos/items/${enc(id)}`, { method: "PATCH", body: b }),
  deleteItem: (id: string) => api<{ success: true }>(`/pos/items/${enc(id)}`, { method: "DELETE" }),
  setAvailability: (id: string, available: boolean) => api<MenuItem>(`/pos/items/${enc(id)}/availability`, { method: "PATCH", body: { available } }),
  priceRules: () => api<PriceRule[]>("/pos/price-rules"),
  createPriceRule: (b: Omit<PriceRule, "id">) => api<PriceRule>("/pos/price-rules", { method: "POST", body: b }),
  updatePriceRule: (id: string, b: Partial<Omit<PriceRule, "id">>) => api<PriceRule>(`/pos/price-rules/${enc(id)}`, { method: "PATCH", body: b }),
  deletePriceRule: (id: string) => api<{ success: true }>(`/pos/price-rules/${enc(id)}`, { method: "DELETE" }),
  menu: (outletId: string) => api<TerminalMenu>("/pos/menu", { query: { outletId } }),

  orders: (q: { status?: string; outletId?: string; date?: string; q?: string; page?: number; pageSize?: number } = {}) => api<Paginated<PosOrderListItem>>("/pos/orders", { query: q }),
  order: (id: string) => api<PosOrder>(`/pos/orders/${enc(id)}`),
  createOrder: (b: OrderCreateInput) => post<PosOrder>("/pos/orders", b, "pos-order"),
  patchOrder: (id: string, b: { tableLabel?: string; covers?: number; guestName?: string; notes?: string; roomId?: string; reservationId?: string }) =>
    api<PosOrder>(`/pos/orders/${enc(id)}`, { method: "PATCH", body: b }),
  addLines: (id: string, lines: LineInput[]) => post<PosOrder>(`/pos/orders/${enc(id)}/lines`, { lines }, "pos-lines"),
  patchLine: (id: string, lineId: string, b: { quantity?: number; note?: string }) => api<PosOrder>(`/pos/orders/${enc(id)}/lines/${enc(lineId)}`, { method: "PATCH", body: b }),
  deleteLine: (id: string, lineId: string) => api<PosOrder>(`/pos/orders/${enc(id)}/lines/${enc(lineId)}`, { method: "DELETE" }),
  send: (id: string) => post<{ order: PosOrder; tickets: KdsTicketWire[] }>(`/pos/orders/${enc(id)}/send`, {}, "pos-send"),
  voidLine: (id: string, lineId: string, b: { reason: string; quantity?: number; returnToStock?: boolean; approval?: { approverId: string; pin: string } }) =>
    post<PosOrder>(`/pos/orders/${enc(id)}/lines/${enc(lineId)}/void`, b, "pos-void"),
  discount: (id: string, b: { mode: "AMOUNT" | "PERCENT"; value: number; reason: string; approval?: { approverId: string; pin: string } }) =>
    post<PosOrder>(`/pos/orders/${enc(id)}/discount`, b, "pos-discount"),
  removeDiscount: (id: string) => api<PosOrder>(`/pos/orders/${enc(id)}/discount`, { method: "DELETE" }),
  split: (id: string, lines: { lineId: string; quantity: number }[]) => post<{ order: PosOrder; newOrder: PosOrder }>(`/pos/orders/${enc(id)}/split`, { lines }, "pos-split"),
  cancel: (id: string, reason: string) => post<PosOrder>(`/pos/orders/${enc(id)}/cancel`, { reason }, "pos-cancel"),
  settle: (id: string, b: SettleInput) => post<SettleResult>(`/pos/orders/${enc(id)}/settle`, { clientCreatedAt: new Date().toISOString(), ...b }, "pos-settle"),
  inHouse: (q?: string) => api<InHouseForPos[]>("/pos/rooms/in-house", { query: { q } }),

  kds: (q: { station?: KdsStation; outletId?: string; status?: string; since?: string } = {}) => api<KdsTicketWire[]>("/kds/tickets", { query: q }),
  kdsStatus: (id: string, status: KdsTicketStatus) => post<KdsTicketWire>(`/kds/tickets/${enc(id)}/status`, { status }, "kds"),
  kdsBump: (id: string) => post<KdsTicketWire>(`/kds/tickets/${enc(id)}/bump`, {}, "kds"),

  report: (from: string, to: string, outletId?: string) => api<PosSalesReport>("/pos/reports/sales", { query: { from, to, outletId } }),
};

export const stockApi = {
  items: (q: { q?: string; lowStock?: boolean; category?: string } = {}) => api<StockItem[]>("/stock/items", { query: q }),
  createItem: (b: { name: string; unit: string; category?: string; sku?: string; reorderLevel?: number; parLevel?: number | null; unitCostKobo?: number; openingQuantity?: number }) =>
    api<StockItem>("/stock/items", { method: "POST", body: b }),
  updateItem: (id: string, b: Partial<{ name: string; unit: string; category: string; sku: string | null; reorderLevel: number; parLevel: number | null; unitCostKobo: number }>) =>
    api<StockItem>(`/stock/items/${enc(id)}`, { method: "PATCH", body: b }),
  purchase: (b: { supplier?: string; reference?: string; lines: { stockItemId: string; quantity: number; unitCostKobo: number }[] }) =>
    post<{ movements: StockMovement[] }>("/stock/purchases", b, "stock"),
  adjust: (b: { stockItemId: string; quantity: number; type: "WASTE" | "ADJUSTMENT"; note: string }) => post<StockMovement>("/stock/adjustments", b, "stock"),
  count: (b: { note?: string; lines: { stockItemId: string; counted: number }[] }) => post<StockCount>("/stock/counts", b, "stock"),
  counts: (page = 1) => api<Paginated<StockCount>>("/stock/counts", { query: { page } }),
  movements: (q: { stockItemId?: string; type?: string; from?: string; to?: string; page?: number } = {}) => api<Paginated<StockMovement>>("/stock/movements", { query: q }),
  variance: (from: string, to: string) => api<StockVariance>("/stock/variance", { query: { from, to } }),
  alerts: () => api<{ lowStock: StockItem[] }>("/stock/alerts"),
  par: (roomTypeId?: string) => api<MinibarPar[]>("/minibar/par", { query: { roomTypeId } }),
  savePar: (b: { roomTypeId: string; items: { itemId: string; parQty: number }[] }) => api<MinibarPar | MinibarPar[]>("/minibar/par", { method: "PUT", body: b }),
  minibarRoom: (roomId: string) => api<MinibarRoom>(`/minibar/rooms/${enc(roomId)}`),
  consume: (b: { roomId: string; items: { itemId: string; quantity: number }[]; note?: string; housekeepingTaskId?: string }) =>
    post<{ order: PosOrder; charged: boolean; folioId: string | null }>("/minibar/consumption", { clientCreatedAt: new Date().toISOString(), ...b }, "minibar"),
};

/* ---------- 3. channels ---------- */
export const channelsApi = {
  summary: () => api<ChannelSummary>("/channels/summary"),
  connections: () => api<ChannelConnection[]>("/channels/connections"),
  create: (b: { provider: "ICAL"; channel: OtaChannel; name?: string; stopSellBuffer?: number; commissionBps?: number } | { provider: "CHANNEX"; apiKey?: string; externalPropertyId?: string; name?: string }) =>
    api<ChannelConnection>("/channels/connections", { method: "POST", body: b }),
  update: (id: string, b: Partial<{ name: string; status: "ACTIVE" | "PAUSED"; stopSellBuffer: number; commissionBps: Partial<Record<OtaChannel, number>> | number; pushRates: boolean; pushRestrictions: boolean; horizonDays: number; apiKey: string }>) =>
    api<ChannelConnection>(`/channels/connections/${enc(id)}`, { method: "PATCH", body: b }),
  remove: (id: string) => api<{ success: true }>(`/channels/connections/${enc(id)}`, { method: "DELETE" }),
  sync: (id: string, full = false) => post<{ log: SyncLog[] }>(`/channels/connections/${enc(id)}/sync`, { full }, "sync"),
  exports: (id: string) => api<IcalExport[]>(`/channels/connections/${enc(id)}/ical/exports`),
  rotate: (id: string) => post<IcalExport[]>(`/channels/connections/${enc(id)}/ical/rotate`, {}, "rotate"),
  feeds: (id: string) => api<IcalFeed[]>(`/channels/connections/${enc(id)}/ical/feeds`),
  addFeed: (id: string, b: { roomId?: string; roomTypeId?: string; url: string }) => api<IcalFeed>(`/channels/connections/${enc(id)}/ical/feeds`, { method: "POST", body: b }),
  removeFeed: (id: string, feedId: string) => api<{ success: true }>(`/channels/connections/${enc(id)}/ical/feeds/${enc(feedId)}`, { method: "DELETE" }),
  remote: (id: string) => api<RemoteCatalogue>(`/channels/connections/${enc(id)}/remote`),
  mappings: (id: string) => api<ChannelMapping[]>(`/channels/connections/${enc(id)}/mappings`),
  saveMappings: (id: string, mappings: { roomTypeId: string; ratePlanId?: string | null; externalRoomTypeId: string; externalRatePlanId?: string | null }[]) =>
    api<ChannelMapping[]>(`/channels/connections/${enc(id)}/mappings`, { method: "PUT", body: { mappings } }),
  bookings: (q: { channel?: string; status?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}) => api<Paginated<ChannelBooking>>("/channels/bookings", { query: q }),
  logs: (q: { connectionId?: string; status?: string; page?: number; pageSize?: number } = {}) => api<Paginated<SyncLog>>("/channels/logs", { query: q }),
  cost: (month?: string) => api<ChannelCost>("/channels/cost", { query: { month } }),
  devBooking: (b: { connectionId: string; roomTypeId: string; checkIn: string; checkOut: string; otaChannel?: OtaChannel; guestName?: string; adults?: number; amountKobo?: number }) =>
    api<{ externalId: string; webhook: { status: number; body: unknown } }>("/channels/dev/channex/bookings", { method: "POST", body: b }),
};

/* ---------- 4. pricing ---------- */
export const pricingApi = {
  settings: () => api<PricingSettings>("/pricing/settings"),
  saveSettings: (b: Partial<Omit<PricingSettings, "lastRunAt" | "nextRunAt">>) => api<PricingSettings>("/pricing/settings", { method: "PUT", body: b }),
  guardrails: () => api<Guardrail[]>("/pricing/guardrails"),
  saveGuardrail: (roomTypeId: string, b: Partial<Pick<Guardrail, "enabled" | "floorKobo" | "ceilingKobo" | "maxDailyChangeBps">>) =>
    api<Guardrail>(`/pricing/guardrails/${enc(roomTypeId)}`, { method: "PUT", body: b }),
  frozen: (from?: string, to?: string) => api<FrozenDate[]>("/pricing/frozen-dates", { query: { from, to } }),
  freeze: (b: { date?: string; dateFrom?: string; dateTo?: string; roomTypeId?: string | null; note?: string }) => api<FrozenDate[]>("/pricing/frozen-dates", { method: "POST", body: b }),
  unfreeze: (id: string) => api<{ success: true }>(`/pricing/frozen-dates/${enc(id)}`, { method: "DELETE" }),
  events: (from?: string, to?: string) => api<PricingEvent[]>("/pricing/events", { query: { from, to } }),
  createEvent: (b: { name: string; dateFrom: string; dateTo: string; impact?: EventImpact; upliftBps?: number; city?: string | null; note?: string }) =>
    api<PricingEvent>("/pricing/events", { method: "POST", body: b }),
  updateEvent: (id: string, b: Partial<{ name: string; dateFrom: string; dateTo: string; impact: EventImpact; upliftBps: number; city: string | null; note: string; disabled: boolean }>) =>
    api<PricingEvent>(`/pricing/events/${enc(id)}`, { method: "PATCH", body: b }),
  deleteEvent: (id: string) => api<{ success: true }>(`/pricing/events/${enc(id)}`, { method: "DELETE" }),
  competitors: (from?: string, to?: string) => api<CompetitorRate[]>("/pricing/competitors", { query: { from, to } }),
  saveCompetitors: (entries: { competitorName: string; date: string; rateKobo: number; roomTypeId?: string | null }[]) => api<CompetitorRate[]>("/pricing/competitors", { method: "PUT", body: { entries } }),
  deleteCompetitor: (id: string) => api<{ success: true }>(`/pricing/competitors/${enc(id)}`, { method: "DELETE" }),
  suggestions: (q: { from?: string; to?: string; roomTypeId?: string; status?: string } = {}) => api<Suggestion[]>("/pricing/suggestions", { query: q }),
  run: (b: { from?: string; to?: string } = {}) => post<{ generated: number; applied: number; skipped: number; suggestions: Suggestion[] }>("/pricing/run", b, "pricing"),
  accept: (id: string, priceKobo?: number) => post<{ suggestion: Suggestion; change: PriceChange }>(`/pricing/suggestions/${enc(id)}/accept`, priceKobo ? { priceKobo } : {}, "pricing"),
  reject: (id: string, note?: string) => post<Suggestion>(`/pricing/suggestions/${enc(id)}/reject`, note ? { note } : {}, "pricing"),
  bulk: (ids: string[], action: "ACCEPT" | "REJECT") => post<{ accepted: number; rejected: number; failed: { id: string; reason: string }[] }>("/pricing/suggestions/bulk", { ids, action }, "pricing"),
  changes: (q: { from?: string; to?: string; roomTypeId?: string; source?: string; page?: number; pageSize?: number } = {}) => api<Paginated<PriceChange>>("/pricing/changes", { query: q }),
  revert: (id: string) => post<PriceChange>(`/pricing/changes/${enc(id)}/revert`, {}, "pricing"),
  report: (from: string, to: string) => api<PricingReport>("/pricing/report", { query: { from, to } }),
};

/* ---------- 5. inbox ---------- */
export const inboxApi = {
  summary: () => api<InboxSummary>("/inbox/summary"),
  list: (q: { status?: string; assigneeId?: string; mine?: boolean; unread?: boolean; q?: string; page?: number; pageSize?: number } = {}) =>
    api<Paginated<ConversationListItem>>("/inbox/conversations", { query: q }),
  get: (id: string) => api<ConversationDetail>(`/inbox/conversations/${enc(id)}`),
  start: (b: { guestId?: string; phone?: string; reservationId?: string; template: { name: M5TemplateName; params: string[] } }) => post<ConversationDetail>("/inbox/conversations", b, "inbox"),
  send: (id: string, b: { body?: string; quickReplyId?: string }) => post<MessageWire>(`/inbox/conversations/${enc(id)}/messages`, b, "inbox"),
  template: (id: string, name: string, params: string[]) => post<MessageWire>(`/inbox/conversations/${enc(id)}/template`, { name, params }, "inbox"),
  note: (id: string, body: string) => post<MessageWire>(`/inbox/conversations/${enc(id)}/notes`, { body }, "inbox"),
  read: (id: string) => post<{ success: true }>(`/inbox/conversations/${enc(id)}/read`, {}, "inbox"),
  patch: (id: string, b: { status?: ConversationStatus; assigneeId?: string | null; reservationId?: string | null }) => api<ConversationListItem>(`/inbox/conversations/${enc(id)}`, { method: "PATCH", body: b }),
  acceptSuggestion: (id: string, b: { roomId?: string; priority?: TaskPriority; note?: string } = {}) =>
    post<{ suggestion: TaskSuggestion; housekeepingTaskId: string | null; ticketId: string | null }>(`/inbox/suggestions/${enc(id)}/accept`, b, "inbox"),
  dismissSuggestion: (id: string) => post<TaskSuggestion>(`/inbox/suggestions/${enc(id)}/dismiss`, {}, "inbox"),
  quickReplies: () => api<QuickReplyWire[]>("/inbox/quick-replies"),
  createQuickReply: (b: { title: string; shortcut?: string; body: string; sortOrder?: number }) => api<QuickReplyWire>("/inbox/quick-replies", { method: "POST", body: b }),
  updateQuickReply: (id: string, b: Partial<{ title: string; shortcut: string; body: string; sortOrder: number }>) => api<QuickReplyWire>(`/inbox/quick-replies/${enc(id)}`, { method: "PATCH", body: b }),
  deleteQuickReply: (id: string) => api<{ success: true }>(`/inbox/quick-replies/${enc(id)}`, { method: "DELETE" }),
  settings: () => api<InboxSettings>("/inbox/settings"),
  saveSettings: (b: Partial<InboxSettings>) => api<InboxSettings>("/inbox/settings", { method: "PUT", body: b }),
  devInbound: (b: { phone: string; body: string; name?: string }) => api<{ conversationId: string | null; routed: boolean }>("/inbox/dev/inbound", { method: "POST", body: b }),
};

/* ---------- 6. loyalty (group-wide) ---------- */
export const loyaltyApi = {
  programme: () => api<LoyaltyProgramme>("/loyalty/programme"),
  saveProgramme: (b: Partial<Omit<LoyaltyProgramme, "tiers">>) => api<LoyaltyProgramme>("/loyalty/programme", { method: "PUT", body: b }),
  createTier: (b: { name: string; minNights: number; bonusBps?: number; perks?: string[]; color?: TierColor; sortOrder?: number }) => api<LoyaltyTier>("/loyalty/tiers", { method: "POST", body: b }),
  updateTier: (id: string, b: Partial<{ name: string; minNights: number; bonusBps: number; perks: string[]; color: TierColor; sortOrder: number }>) => api<LoyaltyTier>(`/loyalty/tiers/${enc(id)}`, { method: "PATCH", body: b }),
  deleteTier: (id: string) => api<{ success: true }>(`/loyalty/tiers/${enc(id)}`, { method: "DELETE" }),
  summary: () => api<LoyaltySummary>("/loyalty/summary"),
  members: (q: { q?: string; tierId?: string; page?: number; pageSize?: number } = {}) => api<Paginated<LoyaltyMember>>("/loyalty/members", { query: q }),
  enrol: (guestId: string, via: "DESK" | "CHECK_IN" = "DESK") => api<LoyaltyMember>("/loyalty/members", { method: "POST", body: { guestId, via } }),
  member: (id: string) => api<LoyaltyMember & { statement: LoyaltyTxn[] }>(`/loyalty/members/${enc(id)}`),
  byGuest: (guestId: string) => api<LoyaltyMember>(`/loyalty/members/by-guest/${enc(guestId)}`),
  statement: (id: string, page = 1, pageSize = 50) => api<Paginated<LoyaltyTxn>>(`/loyalty/members/${enc(id)}/statement`, { query: { page, pageSize } }),
  adjust: (id: string, points: number, reason: string) => post<LoyaltyMember>(`/loyalty/members/${enc(id)}/adjust`, { points, reason }, "loyalty"),
  redeemStart: (memberId: string, folioId: string, points: number) => post<RedeemChallenge>(`/loyalty/members/${enc(memberId)}/redeem/start`, { folioId, points }, "loyalty"),
  redeemCode: (challengeId: string, code: string) => post<RedeemResult>("/loyalty/redeem", { challengeId, code }, "loyalty"),
  redeemPin: (b: { memberId: string; folioId: string; points: number; approval: { approverId: string; pin: string } }) => post<RedeemResult>("/loyalty/redeem", b, "loyalty"),
  runExpiry: () => post<{ expiredLots: number; points: number }>("/loyalty/jobs/expiry/run", {}, "loyalty"),
};

/* ---------- 7. custom domain ---------- */
export const domainsApi = {
  get: () => api<DomainsView>("/domains"),
  add: (domain: string) => api<CustomDomain>("/domains", { method: "POST", body: { domain } }),
  verify: (id: string) => post<CustomDomain>(`/domains/${enc(id)}/verify`, {}, "domain"),
  remove: (id: string) => api<{ success: true }>(`/domains/${enc(id)}`, { method: "DELETE" }),
  devPublish: (id: string) => api<{ success: true }>(`/domains/${enc(id)}/dev/publish`, { method: "POST", body: {} }),
};
