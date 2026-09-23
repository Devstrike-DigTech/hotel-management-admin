import type { KdsTicketWire, PosLine, PosOrder, PosOrderListItem, TerminalMenu } from "@/lib/api/types-m5";
import type { TaxSettings } from "@/lib/api/types-m2";
import type { KdsTicket, PosMenu, TaxProfile, Ticket, TicketLine, TabKind } from "./model";

/** The terminal menu from the API, as tiles and categories. */
export function adaptMenu(m: TerminalMenu): PosMenu {
  return {
    outletId: m.outlet.id,
    categories: m.categories.map((c) => ({ id: c.id, name: c.name, sortOrder: c.sortOrder })),
    items: m.categories.flatMap((c) =>
      c.items.map((i) => ({
        id: i.id,
        name: i.name,
        categoryId: c.id,
        priceKobo: i.priceKobo,
        activePriceKobo: i.happyHour ? i.currentPriceKobo : null,
        activePriceLabel: i.happyHour?.name ?? null,
        available: i.available,
        station: (i.station ?? c.station ?? m.outlet.defaultStation) === "NONE" ? null : ((i.station ?? c.station ?? m.outlet.defaultStation) as "KITCHEN" | "BAR"),
        modifierGroups: i.modifiers.map((g) => ({ id: g.id, name: g.name, min: g.required ? 1 : 0, max: g.multiple ? g.options.length : 1, options: g.options })),
        stockLeft: null,
        vatApplicable: i.vat,
        consumptionTaxApplicable: i.consumptionTax,
      })),
    ),
  };
}

export function adaptTax(t: TaxSettings | undefined): TaxProfile | undefined {
  if (!t) return undefined;
  return { vat: t.vat, consumptionTax: t.consumptionTax, serviceCharge: t.serviceCharge };
}

export function lineFromWire(l: PosLine, kot: string | null): TicketLine {
  return {
    key: l.id,
    id: l.id,
    itemId: l.itemId,
    name: l.name,
    qty: l.quantity,
    // unit price on the wire already includes modifiers
    unitPriceKobo: l.unitPriceKobo - l.modifiers.reduce((s, m) => s + m.priceKobo, 0),
    modifiers: l.modifiers.map((m) => ({ groupId: m.groupId, optionId: m.optionId, name: m.option, priceKobo: m.priceKobo })),
    note: l.note || undefined,
    state: l.status === "VOIDED" ? "VOID" : l.status === "SENT" ? "SENT" : "DRAFT",
    kot: kot ? Number(kot.replace(/\D/g, "")) || null : null,
    voidReason: l.voidReason,
  };
}

export function kindOf(o: Pick<PosOrder, "room" | "tableLabel" | "guestName">): { kind: TabKind; label: string } {
  if (o.room) return { kind: "ROOM", label: o.room.number };
  if (o.tableLabel && /^T\d+$/i.test(o.tableLabel)) return { kind: "TABLE", label: o.tableLabel.replace(/^T/i, "") };
  if (o.tableLabel && !o.guestName) return { kind: "TABLE", label: o.tableLabel };
  return { kind: "TAB", label: o.guestName ?? o.tableLabel ?? "Tab" };
}

export function ticketFromOrder(o: PosOrder, tickets: Map<string, string> = new Map()): Ticket {
  const k = kindOf(o);
  return {
    key: o.id,
    id: o.id,
    number: o.number,
    outletId: o.outlet.id,
    kind: k.kind,
    label: k.label,
    covers: o.covers,
    openedAt: o.openedAt,
    status: o.status === "OPEN" ? "OPEN" : o.status === "SETTLED" ? "SETTLED" : "VOID",
    reservationId: o.reservation?.id ?? null,
    guestName: o.reservation?.guestName ?? (k.kind === "TAB" ? null : o.guestName),
    discountKobo: o.totals.discountKobo,
    lines: o.lines.map((l) => lineFromWire(l, l.ticketId ? (tickets.get(l.ticketId) ?? null) : null)),
    server: { subtotalKobo: o.totals.itemsKobo, discountKobo: o.totals.discountKobo, vatKobo: o.totals.taxes.filter((t) => t.code === "VAT").reduce((s, t) => s + t.amountKobo, 0), consumptionTaxKobo: o.totals.taxes.filter((t) => t.code === "CONSUMPTION").reduce((s, t) => s + t.amountKobo, 0), serviceChargeKobo: o.totals.taxes.filter((t) => t.code === "SERVICE_CHARGE").reduce((s, t) => s + t.amountKobo, 0), totalKobo: o.totals.totalKobo, paidKobo: o.totals.paidKobo, balanceKobo: o.totals.dueKobo },
  };
}

export function ticketFromListItem(o: PosOrderListItem): Ticket {
  const k = kindOf(o);
  return {
    key: o.id,
    id: o.id,
    number: o.number,
    outletId: o.outlet.id,
    kind: k.kind,
    label: k.label,
    covers: o.covers,
    openedAt: o.openedAt,
    status: "OPEN",
    guestName: k.kind === "TAB" ? null : o.guestName,
    lines: [],
    server: { subtotalKobo: o.totalKobo, discountKobo: 0, vatKobo: 0, consumptionTaxKobo: 0, serviceChargeKobo: 0, totalKobo: o.totalKobo, balanceKobo: o.dueKobo },
  };
}

export function tableLabelFor(kind: TabKind, label: string) {
  return kind === "TABLE" ? (/^\d+$/.test(label) ? `T${label}` : label) : kind === "TAB" ? "Bar" : null;
}

export function kdsFromWire(t: KdsTicketWire): KdsTicket {
  const o = t.order;
  const kind: TabKind = o.roomNumber ? "ROOM" : o.tableLabel && !o.guestName ? "TABLE" : o.guestName ? "TAB" : "TABLE";
  const label = o.roomNumber ? `Room ${o.roomNumber}` : o.tableLabel ? (/^T\d+$/i.test(o.tableLabel) ? `Table ${o.tableLabel.slice(1)}` : o.tableLabel) : (o.guestName ?? o.number);
  return {
    id: t.id,
    kot: Number(t.number.replace(/\D/g, "")) || 0,
    number: t.number,
    outletName: o.outletName,
    station: t.station === "NONE" ? null : t.station,
    label: o.guestName && kind === "TAB" ? `${label} · ${o.guestName}` : label,
    kind,
    server: t.server?.fullName.split(" ")[0] ?? null,
    status: t.status === "CANCELLED" ? "SERVED" : t.status,
    createdAt: t.createdAt,
    startedAt: t.startedAt,
    readyAt: t.readyAt,
    lines: t.lines.map((l) => ({ key: l.lineId, name: l.name, qty: l.quantity, modifiers: l.modifiers, note: l.note || null, voided: l.voided })),
  };
}
