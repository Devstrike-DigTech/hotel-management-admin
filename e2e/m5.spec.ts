import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

/**
 * M5 (Pro) against the live API and its demo seed (The Palmwine House group:
 * Lekki and Ikoyi): the property switcher changes what every page shows; a
 * room-service order goes to the kitchen display and onto the guest's folio;
 * a cash sale at the till needs a shift; a dynamic-pricing suggestion accepted
 * on the Rate Almanac reprices the night; a guest's WhatsApp message is
 * answered from the inbox; loyalty points come off a folio; and a custom domain
 * verifies once its DNS records are published (mock DNS).
 */

const API = process.env.E2E_API_URL || "http://localhost:4000/api/v1";
const EMAIL = process.env.E2E_EMAIL || "demo@palmwine.ng";
const PASSWORD = process.env.E2E_PASSWORD || "Demo1234!";
const WAITER = process.env.E2E_WAITER || "yemi@palmwine.ng";
const IKOYI = "palmwine-house-ikoyi";
const stamp = Date.now().toString().slice(-6);

type Tokens = { accessToken: string; refreshToken: string };
type Property = { id: string; slug: string; name: string };
let owner: Tokens;
let props: Property[];
let lekki: Property;
let ikoyi: Property;
let ctx: BrowserContext;
let page: Page;

async function login(email: string, password = PASSWORD): Promise<Tokens> {
  const r = await fetch(`${API}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!r.ok) throw new Error(`login ${email} -> ${r.status}`);
  const j = (await r.json()) as Tokens;
  return { accessToken: j.accessToken, refreshToken: j.refreshToken };
}

async function call<T>(method: string, path: string, body?: unknown, t: Tokens = owner, propertyId?: string): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${t.accessToken}`,
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...(propertyId ? { "X-Property-Id": propertyId } : {}),
      "Idempotency-Key": `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : undefined) as T;
}
const get = <T>(path: string, t?: Tokens, propertyId?: string) => call<T>("GET", path, undefined, t, propertyId);

/** A browser context signed in with the given tokens, scoped to a property. */
async function signedIn(browser: Browser, t: Tokens, opts: { viewport?: { width: number; height: number }; propertyId?: string } = {}) {
  const c = await browser.newContext({ viewport: opts.viewport ?? { width: 1440, height: 900 }, timezoneId: "Africa/Lagos", locale: "en-NG" });
  await c.addInitScript(
    ([tok, pid]) => {
      try {
        if (sessionStorage.getItem("e2e.init")) return;
        sessionStorage.setItem("e2e.init", "1");
        localStorage.removeItem("admin.apiOrigin");
        localStorage.setItem("admin.theme", "light");
        localStorage.setItem("admin.session.hotel", tok);
        if (pid) localStorage.setItem("admin.property", pid);
        else localStorage.removeItem("admin.property");
      } catch {}
    },
    [JSON.stringify(t), opts.propertyId ?? ""],
  );
  return c;
}

const lagosToday = () => new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
const plusDays = (k: string, n: number) => new Date(Date.parse(`${k}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const naira = (kobo: number) => `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;

type Outlet = { id: string; code: string; name: string; type: string; allowRoomCharge: boolean };
type MenuItem = { id: string; name: string; available: boolean; station: string | null; modifiers: { required: boolean }[] };
type TerminalMenu = { outlet: Outlet & { defaultStation: string }; categories: { station: string | null; items: MenuItem[] }[] };
type InHouse = { reservationId: string; code: string; room: { id: string; number: string }; guestName: string; loyaltyTier: string | null };
type PosOrder = { id: string; number: string; status: string; folioId: string | null; totals: { totalKobo: number; dueKobo: number }; lines: { name: string; ticketId: string | null }[] };
type KdsTicket = { id: string; number: string; status: string; order: { id: string; number: string } };

/** An item that goes to the given station and needs no choices. */
async function pickItem(outletId: string, station: "KITCHEN" | "BAR" | null) {
  const menu = await get<TerminalMenu>(`/pos/menu?outletId=${outletId}`, owner, lekki.id);
  for (const c of menu.categories)
    for (const i of c.items) {
      const st = i.station ?? c.station ?? menu.outlet.defaultStation;
      if (i.available && !i.modifiers.some((m) => m.required) && (station === null || st === station)) return i;
    }
  throw new Error(`no ${station ?? "plain"} item on the menu`);
}

// independent tests, one worker, in file order (a failure doesn't skip the rest)
test.describe.configure({ mode: "default" });

test.beforeAll(async ({ browser }) => {
  owner = await login(EMAIL);
  props = await get<Property[]>("/properties");
  lekki = props.find((p) => p.slug !== IKOYI)!;
  ikoyi = props.find((p) => p.slug === IKOYI)!;
  expect(lekki && ikoyi).toBeTruthy();
  ctx = await signedIn(browser, owner, { propertyId: lekki.id });
  page = await ctx.newPage();
});

const teardown: (() => Promise<void>)[] = [];
test.afterAll(async () => {
  for (const f of teardown) await f().catch(() => undefined);
  await ctx?.close();
});

/* ------------------------------------------------------------------ */

test("switching property shows that property's rooms", async ({ browser }) => {
  type Room = { id: string; number: string };
  const lekkiRooms = await get<Room[]>("/rooms", owner, lekki.id);
  const ikoyiRooms = await get<Room[]>("/rooms", owner, ikoyi.id);
  const onlyLekki = lekkiRooms.find((r) => !ikoyiRooms.some((x) => x.number === r.number))!;
  const onlyIkoyi = ikoyiRooms.find((r) => !lekkiRooms.some((x) => x.number === r.number))!;
  expect(onlyLekki && onlyIkoyi).toBeTruthy();

  const c = await signedIn(browser, owner, { propertyId: lekki.id });
  const p = await c.newPage();
  await p.goto("/rooms");
  const roomBtn = (n: string) => p.getByRole("button", { name: new RegExp(`^Room ${n}:`) });
  await expect(roomBtn(onlyLekki.number)).toBeVisible();
  await expect(p.getByTestId("topbar-property-lg")).toContainText(lekki.name);

  await p.getByTestId("property-switcher").click();
  await p.getByTestId(`property-option-${IKOYI}`).click();
  await expect(p.getByTestId("topbar-property-lg")).toContainText(ikoyi.name);
  await expect(roomBtn(onlyIkoyi.number)).toBeVisible();
  await expect(roomBtn(onlyLekki.number)).toHaveCount(0);
  expect(await p.evaluate(() => localStorage.getItem("admin.property"))).toBe(ikoyi.id);

  // and back: the header goes with every request
  await p.getByTestId("property-switcher").click();
  await p.getByTestId(`property-option-${lekki.slug}`).click();
  await expect(roomBtn(onlyLekki.number)).toBeVisible();
  await expect(roomBtn(onlyIkoyi.number)).toHaveCount(0);
  await c.close();
  // leave the saved default on Lekki for the other tests
  await call("PUT", "/me/current-property", { propertyId: lekki.id });
});

/* ------------------------------------------------------------------ */

test("a room-service order goes to the kitchen display and onto the guest's folio", async ({ browser }) => {
  const outlets = await get<Outlet[]>("/pos/outlets", owner, lekki.id);
  const outlet = outlets.find((o) => o.code === "YARD") ?? outlets.find((o) => o.type === "RESTAURANT" && o.allowRoomCharge)!;
  const item = await pickItem(outlet.id, "KITCHEN");
  const guests = await get<InHouse[]>("/pos/rooms/in-house", owner, lekki.id);
  expect(guests.length).toBeGreaterThan(0);
  const guest = guests[0];

  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto("/pos");
  await page.getByTestId(`outlet-${outlet.code}`).click();
  await page.getByTestId("pos-new-ticket").click();
  await page.getByRole("radio", { name: "Room" }).click();
  await page.getByTestId("guest-search").fill(guest.room.number);
  await page.getByTestId(`guest-${guest.room.number}`).click();
  await expect(page.getByTestId("pos-ticket-title")).toContainText(guest.room.number);

  await page.getByLabel("Find an item").fill(item.name);
  await page.getByLabel("Find an item").press("Enter");
  await expect(page.getByTestId(`line-${item.name}`)).toBeVisible();
  await page.getByTestId("pos-send").click();

  // the order reaches the server with a kitchen ticket
  let order: PosOrder | undefined;
  await expect
    .poll(async () => {
      const list = await get<{ items: { id: string; room: { number: string } | null }[] }>(`/pos/orders?status=OPEN&outletId=${outlet.id}&q=${guest.room.number}&pageSize=50`, owner, lekki.id);
      for (const o of list.items) {
        const full = await get<PosOrder>(`/pos/orders/${o.id}`, owner, lekki.id);
        if (full.lines.some((l) => l.name === item.name && l.ticketId)) order = full;
      }
      return !!order;
    }, { timeout: 20_000 })
    .toBe(true);
  const tickets = await get<KdsTicket[]>("/kds/tickets?station=KITCHEN", owner, lekki.id);
  const ticket = tickets.find((t) => t.order.id === order!.id)!;
  expect(ticket).toBeTruthy();
  const kot = String(Number(ticket.number.replace(/\D/g, "")));

  // the kitchen: start it, mark it ready
  const kc = await signedIn(browser, owner, { viewport: { width: 1024, height: 768 }, propertyId: lekki.id });
  const kds = await kc.newPage();
  await kds.goto("/kds");
  const card = kds.getByTestId(`kds-${kot}`);
  await expect(card).toBeVisible();
  await expect(card).toContainText(item.name);
  await kds.getByTestId(`kds-advance-${kot}`).click();
  await expect.poll(async () => (await get<KdsTicket[]>("/kds/tickets?station=KITCHEN&status=PREPARING,READY", owner, lekki.id)).find((t) => t.id === ticket.id)?.status, { timeout: 15_000 }).toBe("PREPARING");
  await kds.getByTestId(`kds-advance-${kot}`).click();
  await expect.poll(async () => (await get<KdsTicket[]>("/kds/tickets?station=KITCHEN&status=READY,SERVED", owner, lekki.id)).find((t) => t.id === ticket.id)?.status, { timeout: 15_000 }).toBe("READY");
  await kc.close();

  // charge it to the room
  await page.getByTestId("pos-settle").click();
  await page.getByTestId("method-ROOM").click();
  const pickGuest = page.getByTestId(`guest-${guest.room.number}`);
  if (await pickGuest.isVisible()) await pickGuest.click();
  await page.getByTestId("confirm-guest").click();
  await page.getByTestId("settle-confirm").click();
  await expect(page.getByRole("dialog").filter({ hasText: "Charged to the room" })).toBeVisible();

  const settled = await get<PosOrder>(`/pos/orders/${order!.id}`, owner, lekki.id);
  expect(settled.status).toBe("SETTLED");
  const folio = await get<{ id: string }>(`/reservations/${guest.reservationId}/folio`, owner, lekki.id);
  await page.getByTestId("done-new").click();

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/folios/${folio.id}`);
  await expect(page.getByText(new RegExp(`${order!.number}.*${item.name}`)).first()).toBeVisible();
});

/* ------------------------------------------------------------------ */

test("a cash sale at the till needs an open shift", async ({ browser }) => {
  const waiter = await login(WAITER);
  const openShift = async () => get<{ id: string } | null>("/shifts/current", waiter, lekki.id);
  const closeShift = async () => {
    const s = await openShift();
    if (!s) return;
    const d = await get<{ expectedCashKobo?: number; expected?: { cashKobo?: number; posKobo?: number; transferKobo?: number } }>(`/shifts/${s.id}`, owner, lekki.id);
    const cash = d.expectedCashKobo ?? d.expected?.cashKobo ?? 0;
    await call("POST", `/shifts/${s.id}/close`, { countedCashKobo: cash, declaredPosKobo: d.expected?.posKobo ?? 0, declaredTransferKobo: d.expected?.transferKobo ?? 0, notes: "e2e" }, waiter, lekki.id);
  };
  await closeShift();
  teardown.push(closeShift);

  const outlets = await get<Outlet[]>("/pos/outlets", owner, lekki.id);
  const bar = outlets.find((o) => o.code === "PBAR") ?? outlets.find((o) => o.type === "BAR")!;
  const item = await pickItem(bar.id, null);

  const c = await signedIn(browser, waiter, { viewport: { width: 1024, height: 768 }, propertyId: lekki.id });
  const p = await c.newPage();
  await p.goto("/pos");
  await p.getByTestId(`outlet-${bar.code}`).click();
  await p.getByTestId("pos-new-ticket").click();
  await p.getByRole("radio", { name: "Bar tab" }).click();
  await p.getByLabel("Name on the tab").fill(`E2E ${stamp}`);
  await p.getByRole("button", { name: "Open tab" }).click();
  await p.getByLabel("Find an item").fill(item.name);
  await p.getByLabel("Find an item").press("Enter");
  await expect(p.getByTestId(`line-${item.name}`)).toBeVisible();

  await p.getByTestId("pos-settle").click();
  await p.getByTestId("method-CASH").click();
  await expect(p.getByTestId("shift-required")).toBeVisible();
  await expect(p.getByTestId("settle-confirm")).toBeDisabled();

  await p.getByTestId("pos-open-shift").click();
  await expect(p.getByTestId("shift-required")).toHaveCount(0);
  await expect(p.getByTestId("settle-confirm")).toBeEnabled();
  await p.getByTestId("settle-confirm").click();
  await expect(p.getByRole("dialog").filter({ hasText: "Paid" })).toBeVisible();
  await expect(p.getByRole("dialog")).toContainText(/RCT-/);
  expect(await openShift()).toBeTruthy();
  await c.close();
});

/* ------------------------------------------------------------------ */

test("accepting a pricing suggestion on the Rate Almanac reprices the night", async () => {
  type Suggestion = { id: string; roomTypeId: string; roomType?: { id: string }; date: string; currentKobo: number; suggestedKobo: number; status: string };
  const today = lagosToday();
  let pending = await get<Suggestion[]>(`/pricing/suggestions?from=${plusDays(today, 1)}&to=${plusDays(today, 12)}`, owner, lekki.id);
  if (!pending.length) {
    await call("POST", "/pricing/run", { from: plusDays(today, 1), to: plusDays(today, 12) }, owner, lekki.id);
    pending = await get<Suggestion[]>(`/pricing/suggestions?from=${plusDays(today, 1)}&to=${plusDays(today, 12)}`, owner, lekki.id);
  }
  const s = pending.find((x) => x.suggestedKobo !== x.currentKobo)!;
  expect(s).toBeTruthy();
  const typeId = s.roomTypeId ?? s.roomType!.id;

  await page.goto("/rates");
  const cell = page.locator(`[role="gridcell"][data-type="${typeId}"][data-date="${s.date}"]`);
  await cell.scrollIntoViewIfNeeded();
  const ghost = cell.locator(`[data-ghost="${s.id}"]`);
  await expect(ghost).toBeVisible();
  await ghost.click();
  const pop = page.getByTestId("suggestion-card");
  await expect(pop).toBeVisible();
  await pop.getByTestId("suggestion-accept").click();

  await expect(cell).toHaveAttribute("aria-label", new RegExp(`${naira(s.suggestedKobo).replace("₦", "₦")}, set by dynamic pricing`));
  await expect(cell.locator("[data-ghost]")).toHaveCount(0);
  const cal = await get<{ roomTypes: { roomType?: { id: string }; roomTypeId?: string; id?: string; days: { date: string; priceKobo: number; overrideSource: string | null }[] }[] }>(
    `/rates/calendar?from=${s.date}&to=${s.date}`,
    owner,
    lekki.id,
  );
  const row = cal.roomTypes.find((r) => (r.roomType?.id ?? r.roomTypeId ?? r.id) === typeId)!;
  const day = row.days.find((d) => d.date === s.date)!;
  expect(day.priceKobo).toBe(s.suggestedKobo);
  expect(day.overrideSource).toBe("PRICING");

  // put the night back
  teardown.push(async () => {
    const changes = await get<{ items: { id: string; date: string; roomType?: { id: string }; roomTypeId?: string; source: string }[] }>(`/pricing/changes?from=${s.date}&to=${s.date}&pageSize=20`, owner, lekki.id);
    const ch = changes.items.find((x) => x.source === "ACCEPTED" && (x.roomType?.id ?? x.roomTypeId) === typeId);
    if (ch) await call("POST", `/pricing/changes/${ch.id}/revert`, {}, owner, lekki.id);
  });
});

/* ------------------------------------------------------------------ */

test("a guest's WhatsApp message is answered from the inbox", async () => {
  const phone = `+2348091${stamp}`;
  const inbound = await call<{ conversationId: string | null; routed: boolean }>("POST", "/inbox/dev/inbound", { phone, body: `Good evening, is the pool open late tonight? (${stamp})`, name: `Amaka E2E` }, owner, lekki.id);
  expect(inbound.conversationId).toBeTruthy();

  await page.goto("/inbox");
  const thread = page.getByTestId(`thread-${phone}`);
  await expect(thread).toBeVisible();
  await thread.click();
  await expect(page.getByTestId("window-meter")).toBeVisible();
  await expect(page.getByText(`is the pool open late tonight? (${stamp})`)).toBeVisible();

  const reply = `Yes, the pool is open until 22:00 tonight. Towels are at the bar. (${stamp})`;
  await page.getByTestId("composer").getByLabel("Reply").fill(reply);
  await page.getByTestId("composer").getByRole("button", { name: "Send" }).click();
  await expect(page.getByText(reply)).toBeVisible();

  const detail = await get<{ messages: { direction: string; body: string }[] }>(`/inbox/conversations/${inbound.conversationId}`, owner, lekki.id);
  expect(detail.messages.some((m) => m.direction === "OUTBOUND" && m.body === reply)).toBe(true);
  teardown.push(() => call("PATCH", `/inbox/conversations/${inbound.conversationId}`, { status: "CLOSED" }, owner, lekki.id));
});

/* ------------------------------------------------------------------ */

test("loyalty points come off a folio with the guest's code", async () => {
  type Member = { id: string; points: number; guest: { id: string; phone: string | null } };
  const guests = await get<InHouse[]>("/pos/rooms/in-house", owner, lekki.id);
  expect(guests.length).toBeGreaterThan(0);
  // a member in the house (the seed has some); else enrol the first guest
  let stay = guests.find((g) => g.loyaltyTier) ?? guests[0];
  const res = await get<{ guest: { id: string } }>(`/reservations/${stay.reservationId}`, owner, lekki.id);
  let member: Member;
  try {
    member = await get<Member>(`/loyalty/members/by-guest/${res.guest.id}`);
  } catch {
    member = await call<Member>("POST", "/loyalty/members", { guestId: res.guest.id, via: "DESK" });
  }
  if (!member.guest.phone) {
    stay = guests.find((g) => g.reservationId !== stay.reservationId) ?? stay;
  }
  if (member.points < 1500) member = await call<Member>("POST", `/loyalty/members/${member.id}/adjust`, { points: 1500, reason: `e2e top-up ${stamp}` });
  const folio = await get<{ id: string }>(`/reservations/${stay.reservationId}/folio`, owner, lekki.id);
  const before = member.points;

  await page.goto(`/folios/${folio.id}`);
  await page.getByTestId("redeem-points").click();
  await page.getByTestId("redeem-points-input").fill("1000");
  await page.getByTestId("redeem-send-code").click();

  let code = "";
  await expect
    .poll(async () => {
      const r = await fetch(`${API}/public/dev/outbox?limit=20`);
      const j = (await r.json()) as { items: { createdAt: string; meta: { otpCode?: string } }[] };
      code = j.items.find((m) => m.meta?.otpCode && Date.now() - Date.parse(m.createdAt) < 120_000)?.meta.otpCode ?? "";
      return code;
    }, { timeout: 15_000 })
    .not.toBe("");
  await page.getByRole("dialog").getByLabel("PIN").fill(code);
  await page.getByTestId("redeem-confirm").click();
  await expect(page.getByRole("status").filter({ hasText: "1,000 points redeemed" })).toBeVisible();

  const after = await get<Member>(`/loyalty/members/${member.id}`);
  expect(after.points).toBe(before - 1000);
});

/* ------------------------------------------------------------------ */

test("a custom domain verifies once its DNS records are published", async ({ browser }) => {
  const c = await signedIn(browser, owner, { propertyId: ikoyi.id });
  const p = await c.newPage();
  const current = await get<{ domain: { id: string; domain: string; status: string } | null }>("/domains", owner, ikoyi.id);
  await p.goto("/settings/domain");
  let name = current.domain?.domain ?? "";
  if (current.domain?.status !== "PENDING") {
    name = `stay${stamp}.palmwineikoyi.com`;
    if (current.domain) await call("DELETE", `/domains/${current.domain.id}`, undefined, owner, ikoyi.id);
    await p.reload();
    await p.getByTestId("domain-input").fill(name);
    await p.getByTestId("domain-input").press("Enter");
  }
  await expect(p.getByTestId("domain-name")).toContainText(name);
  await expect(p.getByTestId("domain-status")).toContainText(/Waiting|Pending|Checking/i);
  await expect(p.getByTestId("dns-TXT-host")).toBeVisible();
  await expect(p.getByTestId("dns-CNAME-value")).toBeVisible();

  // before the records exist the check fails and says which
  await p.getByTestId("verify-domain").click();
  await expect(p.getByTestId("domain-live")).toHaveCount(0);

  // the hotel's DNS provider (mock) gets the records; verify again
  await p.getByTestId("dev-publish").click();
  await p.getByTestId("verify-domain").click();
  await expect(p.getByTestId("domain-live")).toBeVisible({ timeout: 20_000 });
  const after = await get<{ domain: { status: string } | null }>("/domains", owner, ikoyi.id);
  expect(after.domain?.status).toBe("VERIFIED");
  await c.close();
});
