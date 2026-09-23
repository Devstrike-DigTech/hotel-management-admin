import type { KdsTicket, PosItem, PosMenu, PosOutlet, Ticket } from "./model";

/**
 * Sample data for the locked-feature previews on lower plans. It is never
 * shown as real data: the preview panel says "Sample data" above it.
 */

const N = (naira: number) => naira * 100;

export const SAMPLE_OUTLETS: PosOutlet[] = [
  { id: "o-yard", name: "The Yard", type: "RESTAURANT", sendsToKitchen: true, active: true },
  { id: "o-bar", name: "Palm Bar", type: "BAR", sendsToKitchen: true, active: true },
  { id: "o-rs", name: "Room service", type: "ROOM_SERVICE", sendsToKitchen: true, active: true },
];

const pepper = {
  id: "g-pepper",
  name: "Pepper level",
  min: 1,
  max: 1,
  options: [
    { id: "p-mild", name: "Mild", priceKobo: 0 },
    { id: "p-med", name: "Medium", priceKobo: 0 },
    { id: "p-hot", name: "Hot", priceKobo: 0 },
    { id: "p-naija", name: "Naija hot", priceKobo: 0 },
  ],
};
const sides = {
  id: "g-sides",
  name: "Extras",
  min: 0,
  max: 3,
  options: [
    { id: "s-plantain", name: "Extra plantain (dodo)", priceKobo: N(1500) },
    { id: "s-egg", name: "Boiled egg", priceKobo: N(500) },
    { id: "s-moimoi", name: "Moi moi", priceKobo: N(1800) },
    { id: "s-coleslaw", name: "Coleslaw", priceKobo: N(1000) },
  ],
};
const protein = {
  id: "g-protein",
  name: "Protein",
  min: 1,
  max: 1,
  options: [
    { id: "pr-chicken", name: "Chicken", priceKobo: 0 },
    { id: "pr-beef", name: "Beef", priceKobo: 0 },
    { id: "pr-goat", name: "Goat meat", priceKobo: N(1500) },
    { id: "pr-fish", name: "Croaker fish", priceKobo: N(3500) },
  ],
};
const ice = {
  id: "g-ice",
  name: "Serve",
  min: 0,
  max: 1,
  options: [
    { id: "i-cold", name: "Chilled", priceKobo: 0 },
    { id: "i-ice", name: "With ice", priceKobo: 0 },
    { id: "i-warm", name: "Not cold", priceKobo: 0 },
  ],
};

const item = (id: string, name: string, categoryId: string, naira: number, extra: Partial<PosItem> = {}): PosItem => ({
  id,
  name,
  categoryId,
  priceKobo: N(naira),
  available: true,
  station: categoryId.startsWith("c-drink") || categoryId === "c-spirits" || categoryId === "c-beer" ? "BAR" : "KITCHEN",
  modifierGroups: [],
  ...extra,
});

export const SAMPLE_MENU: PosMenu = {
  outletId: "o-yard",
  categories: [
    { id: "c-mains", name: "Mains", sortOrder: 1 },
    { id: "c-grill", name: "Grill & suya", sortOrder: 2 },
    { id: "c-soups", name: "Soups & swallow", sortOrder: 3 },
    { id: "c-small", name: "Small chops", sortOrder: 4 },
    { id: "c-drinks", name: "Soft drinks", sortOrder: 5 },
    { id: "c-beer", name: "Beer", sortOrder: 6 },
    { id: "c-spirits", name: "Spirits", sortOrder: 7 },
  ],
  items: [
    item("i-jollof", "Party jollof rice", "c-mains", 6500, { modifierGroups: [protein, pepper, sides] }),
    item("i-fried", "Fried rice", "c-mains", 6500, { modifierGroups: [protein, sides] }),
    item("i-ofada", "Ofada rice & ayamase", "c-mains", 8500, { modifierGroups: [pepper, sides] }),
    item("i-yam", "Yam & egg sauce", "c-mains", 5000),
    item("i-beans", "Ewa agoyin & bread", "c-mains", 4500, { available: false }),
    item("i-suya", "Suya platter", "c-grill", 7500, { modifierGroups: [pepper] }),
    item("i-asun", "Asun", "c-grill", 6000, { modifierGroups: [pepper] }),
    item("i-snail", "Peppered snail", "c-grill", 9500, { modifierGroups: [pepper] }),
    item("i-fish", "Grilled croaker", "c-grill", 14000, { modifierGroups: [pepper, sides] }),
    item("i-psoup", "Goat meat pepper soup", "c-soups", 7000, { modifierGroups: [pepper] }),
    item("i-egusi", "Egusi & pounded yam", "c-soups", 8000),
    item("i-efo", "Efo riro & eba", "c-soups", 7500),
    item("i-puff", "Puff puff (6)", "c-small", 2500),
    item("i-spring", "Spring rolls (4)", "c-small", 3500),
    item("i-dodo", "Dodo", "c-small", 2000),
    item("i-chapman", "Chapman", "c-drinks", 3500, { modifierGroups: [ice] }),
    item("i-zobo", "Zobo", "c-drinks", 2000, { modifierGroups: [ice] }),
    item("i-water", "Eva water 75cl", "c-drinks", 800, { stockLeft: 40 }),
    item("i-coke", "Coca-Cola 35cl", "c-drinks", 1000, { stockLeft: 22, modifierGroups: [ice] }),
    item("i-star", "Star lager", "c-beer", 1500, { code: "STAR", stockLeft: 5, modifierGroups: [ice], activePriceKobo: N(1200), activePriceLabel: "Happy hour" }),
    item("i-gulder", "Gulder", "c-beer", 1500, { stockLeft: 31, modifierGroups: [ice] }),
    item("i-guinness", "Guinness stout", "c-beer", 1800, { stockLeft: 18 }),
    item("i-heineken", "Heineken", "c-beer", 2000, { stockLeft: 0, available: false }),
    item("i-henny", "Hennessy VS (shot)", "c-spirits", 6000, { stockLeft: 14 }),
    item("i-henny-b", "Hennessy VS (bottle)", "c-spirits", 95000, { stockLeft: 3 }),
    item("i-gin", "Gordon's gin & tonic", "c-spirits", 4500),
  ],
};

const ago = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

export const SAMPLE_TICKET: Ticket = {
  key: "t-sample",
  outletId: "o-yard",
  kind: "TABLE",
  label: "7",
  covers: 3,
  openedAt: ago(24),
  status: "OPEN",
  lines: [
    { key: "a", itemId: "i-jollof", name: "Party jollof rice", qty: 2, unitPriceKobo: N(6500), modifiers: [{ groupId: "g-protein", optionId: "pr-chicken", name: "Chicken", priceKobo: 0 }, { groupId: "g-sides", optionId: "s-plantain", name: "Extra plantain (dodo)", priceKobo: N(1500) }], state: "SENT", kot: 41 },
    { key: "b", itemId: "i-suya", name: "Suya platter", qty: 1, unitPriceKobo: N(7500), modifiers: [{ groupId: "g-pepper", optionId: "p-hot", name: "Hot", priceKobo: 0 }], state: "SENT", kot: 41 },
    { key: "c", itemId: "i-chapman", name: "Chapman", qty: 3, unitPriceKobo: N(3500), modifiers: [], state: "DRAFT" },
    { key: "d", itemId: "i-star", name: "Star lager", qty: 2, unitPriceKobo: N(1200), modifiers: [], state: "DRAFT" },
  ],
};

export const SAMPLE_KDS: KdsTicket[] = [
  { id: "k1", kot: 38, outletName: "The Yard", station: "KITCHEN", label: "Table 4", kind: "TABLE", server: "Blessing", status: "PREPARING", createdAt: ago(21), startedAt: ago(15), lines: [{ key: "1", name: "Ofada rice & ayamase", qty: 2, modifiers: ["Naija hot"] }, { key: "2", name: "Peppered snail", qty: 1, modifiers: ["Medium"] }] },
  { id: "k2", kot: 39, outletName: "Room service", station: "KITCHEN", label: "Room 204", kind: "ROOM", server: "Emeka", status: "NEW", createdAt: ago(12), lines: [{ key: "1", name: "Goat meat pepper soup", qty: 1, modifiers: ["Hot"], note: "No uziza leaves" }] },
  { id: "k3", kot: 40, outletName: "The Yard", station: "KITCHEN", label: "Table 9", kind: "TABLE", server: "Blessing", status: "NEW", createdAt: ago(6), lines: [{ key: "1", name: "Suya platter", qty: 2, modifiers: ["Mild"] }, { key: "2", name: "Puff puff (6)", qty: 1, modifiers: [] }] },
  { id: "k4", kot: 41, outletName: "The Yard", station: "KITCHEN", label: "Table 7", kind: "TABLE", server: "Tunde", status: "NEW", createdAt: ago(2), lines: [{ key: "1", name: "Party jollof rice", qty: 2, modifiers: ["Chicken", "Extra plantain (dodo)"] }, { key: "2", name: "Suya platter", qty: 1, modifiers: ["Hot"] }] },
  { id: "k5", kot: 36, outletName: "The Yard", station: "KITCHEN", label: "Table 2", kind: "TABLE", server: "Tunde", status: "READY", createdAt: ago(27), readyAt: ago(3), lines: [{ key: "1", name: "Grilled croaker", qty: 1, modifiers: ["Hot", "Coleslaw"] }] },
];
