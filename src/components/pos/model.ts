/* ------------------------------------------------------------------------ */
/* Point of sale: the terminal's own view model. The API's menu and orders  */
/* are adapted into these shapes, so the terminal does not depend on the    */
/* wire contract, and the pure maths here is what the ticket rail shows.    */
/* ------------------------------------------------------------------------ */

export type OutletType = "RESTAURANT" | "BAR" | "POOL_BAR" | "ROOM_SERVICE" | "MINIBAR" | "LAUNDRY" | "SPA" | "OTHER";

export interface PosOutlet {
  id: string;
  name: string;
  type: OutletType;
  /** whether tickets from here go to a kitchen/bar display */
  sendsToKitchen: boolean;
  active: boolean;
}

export interface PosModifierOption {
  id: string;
  name: string;
  priceKobo: number;
}

export interface PosModifierGroup {
  id: string;
  name: string;
  /** 0 = optional */
  min: number;
  /** 1 = pick one */
  max: number;
  options: PosModifierOption[];
}

export interface PosItem {
  id: string;
  name: string;
  categoryId: string;
  priceKobo: number;
  /** happy hour or other time-window price in force right now */
  activePriceKobo?: number | null;
  activePriceLabel?: string | null;
  available: boolean;
  station?: "KITCHEN" | "BAR" | null;
  modifierGroups: PosModifierGroup[];
  /** optional short code the bar types, e.g. STAR */
  code?: string | null;
  /** remaining stock when tracked (null = not tracked) */
  stockLeft?: number | null;
  vatApplicable?: boolean;
  consumptionTaxApplicable?: boolean;
}

export interface PosCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface PosMenu {
  outletId: string;
  categories: PosCategory[];
  items: PosItem[];
}

export interface ChosenModifier {
  groupId: string;
  optionId: string;
  name: string;
  priceKobo: number;
}

export type LineState = "DRAFT" | "SENT" | "VOID";

export interface TicketLine {
  /** client id until the server gives one */
  key: string;
  id?: string | null;
  itemId: string;
  name: string;
  qty: number;
  unitPriceKobo: number;
  modifiers: ChosenModifier[];
  note?: string;
  state: LineState;
  /** kitchen ticket number once sent */
  kot?: number | null;
  voidReason?: string | null;
  seat?: number | null;
}

export type TabKind = "TABLE" | "ROOM" | "TAB";

export interface Ticket {
  /** client key; stable offline */
  key: string;
  id?: string | null;
  number?: string | null;
  outletId: string;
  kind: TabKind;
  /** table number, room number or a name for a bar tab */
  label: string;
  covers?: number | null;
  lines: TicketLine[];
  openedAt: string;
  status: "OPEN" | "SETTLED" | "VOID";
  /** the reservation when opened against a room */
  reservationId?: string | null;
  guestName?: string | null;
  discountKobo?: number;
  /** server totals when known (preferred over the local estimate) */
  server?: TicketTotals | null;
  /** queued offline, not yet on the server */
  pending?: boolean;
}

export interface TaxRule {
  enabled: boolean;
  rateBps: number;
  inclusive: boolean;
}

export interface TaxProfile {
  vat: TaxRule;
  consumptionTax: TaxRule & { label?: string };
  serviceCharge: TaxRule;
}

export const DEFAULT_TAX: TaxProfile = {
  vat: { enabled: true, rateBps: 750, inclusive: true },
  consumptionTax: { enabled: true, rateBps: 500, inclusive: true, label: "Consumption tax" },
  serviceCharge: { enabled: false, rateBps: 1000, inclusive: false },
};

export interface TicketTotals {
  subtotalKobo: number;
  discountKobo: number;
  vatKobo: number;
  consumptionTaxKobo: number;
  serviceChargeKobo: number;
  totalKobo: number;
  paidKobo?: number;
  balanceKobo?: number;
}

export const lineUnit = (l: Pick<TicketLine, "unitPriceKobo" | "modifiers">) =>
  l.unitPriceKobo + l.modifiers.reduce((s, m) => s + m.priceKobo, 0);

export const lineTotal = (l: TicketLine) => (l.state === "VOID" ? 0 : lineUnit(l) * l.qty);

/**
 * The local estimate of a ticket's totals. Prices on the menu are what the
 * guest pays; inclusive taxes are carved out of them for display, exclusive
 * ones (usually a service charge) are added on top. The server's figures win
 * once the ticket has been sent.
 */
export function ticketTotals(lines: TicketLine[], tax: TaxProfile = DEFAULT_TAX, discountKobo = 0): TicketTotals {
  const gross = lines.reduce((s, l) => s + lineTotal(l), 0);
  const base = Math.max(0, gross - discountKobo);
  const part = (r: TaxRule) => {
    if (!r.enabled) return { incl: 0, excl: 0 };
    if (r.inclusive) return { incl: Math.round((base * r.rateBps) / (10_000 + r.rateBps)), excl: 0 };
    return { incl: 0, excl: Math.round((base * r.rateBps) / 10_000) };
  };
  const vat = part(tax.vat);
  const ct = part(tax.consumptionTax);
  const sc = part(tax.serviceCharge);
  return {
    subtotalKobo: gross,
    discountKobo,
    vatKobo: vat.incl + vat.excl,
    consumptionTaxKobo: ct.incl + ct.excl,
    serviceChargeKobo: sc.incl + sc.excl,
    totalKobo: base + vat.excl + ct.excl + sc.excl,
  };
}

export function totalsFor(t: Ticket, tax?: TaxProfile): TicketTotals {
  return t.server && !t.lines.some((l) => l.state === "DRAFT") ? t.server : ticketTotals(t.lines, tax, t.discountKobo ?? 0);
}

/** Two lines are the same order when item, modifiers and note match; tapping again bumps the quantity. */
export function sameOrder(a: Pick<TicketLine, "itemId" | "modifiers" | "note">, b: Pick<TicketLine, "itemId" | "modifiers" | "note">) {
  if (a.itemId !== b.itemId || (a.note ?? "") !== (b.note ?? "")) return false;
  const k = (m: ChosenModifier[]) => m.map((x) => x.optionId).sort().join(",");
  return k(a.modifiers) === k(b.modifiers);
}

export function newKey(prefix = "l") {
  const r =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}-${r}`;
}

/** Add an item to a ticket: bumps a matching draft line or appends a new one. */
export function addToTicket(lines: TicketLine[], item: PosItem, modifiers: ChosenModifier[] = [], qty = 1, note?: string): TicketLine[] {
  const probe = { itemId: item.id, modifiers, note };
  const i = lines.findIndex((l) => l.state === "DRAFT" && sameOrder(l, probe));
  if (i >= 0) {
    const next = [...lines];
    next[i] = { ...next[i], qty: next[i].qty + qty };
    return next;
  }
  return [
    ...lines,
    {
      key: newKey(),
      itemId: item.id,
      name: item.name,
      qty,
      unitPriceKobo: item.activePriceKobo ?? item.priceKobo,
      modifiers,
      note,
      state: "DRAFT",
    },
  ];
}

export const draftCount = (t: Ticket) => t.lines.filter((l) => l.state === "DRAFT").reduce((s, l) => s + l.qty, 0);
export const liveLines = (t: Ticket) => t.lines.filter((l) => l.state !== "VOID");

/* ---------- split bill ---------- */

export type SplitMode = "EVEN" | "ITEMS";

/** Even split in kobo: the remainder goes to the first checks so the parts always add up. */
export function evenSplit(totalKobo: number, ways: number): number[] {
  const n = Math.max(1, Math.floor(ways));
  // split whole naira, never kobo, the way a waiter would
  const naira = Math.round(totalKobo / 100);
  const each = Math.floor(naira / n);
  const rem = naira - each * n;
  return Array.from({ length: n }, (_, i) => (each + (i < rem ? 1 : 0)) * 100);
}

/** Items split: each line (by key) belongs to one check; returns each check's total. */
export function itemSplit(lines: TicketLine[], assign: Record<string, number>, checks: number, tax?: TaxProfile): TicketTotals[] {
  return Array.from({ length: checks }, (_, c) =>
    ticketTotals(
      lines.filter((l) => l.state !== "VOID" && (assign[l.key] ?? 0) === c),
      tax,
    ),
  );
}

/* ---------- settlement ---------- */

export type SettleMethod = "CASH" | "TRANSFER" | "POS" | "ROOM" | "CITY_LEDGER";

export const SETTLE_META: Record<SettleMethod, { label: string; short: string; needsShift: boolean; color: string }> = {
  CASH: { label: "Cash", short: "Cash", needsShift: true, color: "var(--m-cash)" },
  TRANSFER: { label: "Bank transfer", short: "Transfer", needsShift: true, color: "var(--m-transfer)" },
  POS: { label: "POS terminal", short: "POS", needsShift: true, color: "var(--m-pos)" },
  ROOM: { label: "Charge to room", short: "Room", needsShift: false, color: "var(--adire)" },
  CITY_LEDGER: { label: "Company account", short: "Company", needsShift: false, color: "var(--m-ledger)" },
};

/** Quick cash buttons: exact, then the next round notes above the total. */
export function cashQuickAmounts(totalKobo: number): number[] {
  const n = Math.ceil(totalKobo / 100);
  const steps = [500, 1000, 2000, 5000, 10_000, 20_000, 50_000];
  const out = new Set<number>([n]);
  for (const s of steps) {
    const up = Math.ceil(n / s) * s;
    if (up > n) out.add(up);
    if (out.size >= 4) break;
  }
  return [...out].sort((a, b) => a - b).map((v) => v * 100);
}

/* ---------- kitchen ---------- */

export type KdsStatus = "NEW" | "PREPARING" | "READY" | "SERVED";

export interface KdsTicket {
  id: string;
  kot: number;
  /** the ticket number as printed, e.g. K-042 */
  number?: string;
  outletName: string;
  station: "KITCHEN" | "BAR" | null;
  label: string;
  kind: TabKind;
  server?: string | null;
  status: KdsStatus;
  createdAt: string;
  startedAt?: string | null;
  readyAt?: string | null;
  lines: { key: string; name: string; qty: number; modifiers: string[]; note?: string | null; voided?: boolean }[];
  note?: string | null;
  rush?: boolean;
}

export const KDS_NEXT: Record<KdsStatus, KdsStatus | null> = { NEW: "PREPARING", PREPARING: "READY", READY: "SERVED", SERVED: null };

/** Age bands for a kitchen ticket: fine, getting long, late. */
export function ageTone(ms: number, warnMin = 10, lateMin = 18): "fine" | "warn" | "late" {
  const m = ms / 60_000;
  if (m >= lateMin) return "late";
  if (m >= warnMin) return "warn";
  return "fine";
}

export const OUTLET_LABEL: Record<OutletType, string> = {
  RESTAURANT: "Restaurant",
  BAR: "Bar",
  POOL_BAR: "Pool bar",
  ROOM_SERVICE: "Room service",
  MINIBAR: "Minibar",
  LAUNDRY: "Laundry",
  SPA: "Spa",
  OTHER: "Other",
};
