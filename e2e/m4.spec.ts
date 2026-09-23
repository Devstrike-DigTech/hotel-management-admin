import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

/**
 * M4 against the live API and its demo seed: a housekeeper finishes a room on
 * the phone view and a supervisor passes it; a maintenance ticket takes a room
 * out of order and the Ledger shows it; a custom role hides a page; a season
 * painted on the Rate Almanac reprices the nights; and a booking with a promo
 * code and a company account checks out to the City Ledger.
 */

const API = process.env.E2E_API_URL || "http://localhost:4000/api/v1";
const EMAIL = process.env.E2E_EMAIL || "demo@palmwine.ng";
const PASSWORD = process.env.E2E_PASSWORD || "Demo1234!";
const HOUSEKEEPER = process.env.E2E_HOUSEKEEPER || "musa@palmwine.ng";
const stamp = Date.now().toString().slice(-6);

type Tokens = { accessToken: string; refreshToken: string };
let owner: Tokens;
let ctx: BrowserContext;
let page: Page;

async function login(email: string, password = PASSWORD): Promise<Tokens> {
  const r = await fetch(`${API}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!r.ok) throw new Error(`login ${email} -> ${r.status}`);
  const j = (await r.json()) as Tokens;
  return { accessToken: j.accessToken, refreshToken: j.refreshToken };
}

async function call<T>(method: string, path: string, body?: unknown, t: Tokens = owner): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${t.accessToken}`, ...(body !== undefined ? { "content-type": "application/json" } : {}), "Idempotency-Key": `e2e-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : undefined) as T;
}
const get = <T>(path: string, t?: Tokens) => call<T>("GET", path, undefined, t);

/** A browser context signed in with the given tokens (no UI login round-trip). */
async function signedIn(browser: Browser, t: Tokens, viewport = { width: 1440, height: 900 }) {
  const c = await browser.newContext({ viewport, timezoneId: "Africa/Lagos", locale: "en-NG" });
  await c.addInitScript(
    ([tok]) => {
      try {
        localStorage.removeItem("admin.apiOrigin");
        localStorage.setItem("admin.theme", "light");
        localStorage.setItem("admin.session.hotel", tok);
      } catch {}
    },
    [JSON.stringify(t)],
  );
  return c;
}

const lagosToday = () => new Date(Date.now() + 3600_000).toISOString().slice(0, 10);
const plusDays = (k: string, n: number) => new Date(Date.parse(`${k}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

// independent tests, one worker, in file order (a failure doesn't skip the rest)
test.describe.configure({ mode: "default" });

test.beforeAll(async ({ browser }) => {
  owner = await login(EMAIL);
  ctx = await signedIn(browser, owner);
  page = await ctx.newPage();
});

const teardown: (() => Promise<void>)[] = [];
test.afterAll(async () => {
  for (const f of teardown) await f();
  await ctx?.close();
});

/* ------------------------------------------------------------------ */

test("a housekeeper finishes a room and a supervisor passes it: the room is clean", async ({ browser }) => {
  const settings = await call<{ requireInspection: boolean }>("PUT", "/housekeeping/settings", { requireInspection: true });
  expect(settings.requireInspection).toBe(true);
  const staff = await get<{ id: string; email: string }[]>("/staff");
  const musa = staff.find((s) => s.email === HOUSEKEEPER)!;
  expect(musa).toBeTruthy();

  // a clean vacant room with no open task, made dirty as if a guest just left
  const rooms = await get<{ id: string; number: string; status: string }[]>("/rooms?status=VACANT_CLEAN");
  const open = await get<{ room: { id: string } }[]>("/housekeeping/tasks");
  const room = rooms.find((r) => !open.some((t) => t.room.id === r.id))!;
  expect(room).toBeTruthy();
  await call("PATCH", `/rooms/${room.id}/status`, { status: "VACANT_DIRTY", note: "e2e turnaround" });
  const task = await call<{ id: string; checklistTotal: number }>("POST", "/housekeeping/tasks", { roomId: room.id, type: "CHECKOUT_CLEAN", assigneeId: musa.id });

  // the housekeeper's phone
  const hk = await signedIn(browser, await login(HOUSEKEEPER), { width: 390, height: 844 });
  const phone = await hk.newPage();
  await phone.goto("/hk");
  const card = phone.getByTestId(`hk-card-${room.number}`);
  await expect(card).toBeVisible();
  await phone.getByRole("button", { name: `Start room ${room.number}` }).click();
  const list = phone.getByRole("list", { name: "Checklist" });
  await expect(list).toBeVisible();
  const boxes = list.getByRole("checkbox");
  const n = await boxes.count();
  expect(n).toBe(task.checklistTotal);
  for (let i = 0; i < n; i++) {
    await boxes.nth(i).click();
    await expect(boxes.nth(i)).toHaveAttribute("aria-checked", "true");
  }
  await phone.getByRole("button", { name: "Finish room" }).click();
  await expect(phone.getByRole("status").filter({ hasText: `Room ${room.number} done` })).toBeVisible();
  await hk.close();

  let t = await get<{ status: string }>(`/housekeeping/tasks/${task.id}`);
  expect(t.status).toBe("DONE");
  let r = (await get<{ id: string; status: string }[]>("/rooms")).find((x) => x.id === room.id)!;
  expect(r.status).toBe("VACANT_DIRTY");

  // the supervisor's inspection queue
  await page.goto("/housekeeping?tab=inspection");
  const inspect = page.getByTestId(`inspect-${room.number}`);
  await expect(inspect).toBeVisible();
  await inspect.getByRole("button", { name: "Pass" }).click();
  await expect(page.getByRole("status").filter({ hasText: `Room ${room.number} is clean` })).toBeVisible();

  t = await get<{ status: string }>(`/housekeeping/tasks/${task.id}`);
  expect(t.status).toBe("INSPECTED");
  r = (await get<{ id: string; status: string }[]>("/rooms")).find((x) => x.id === room.id)!;
  expect(r.status).toBe("VACANT_CLEAN");
});

/* ------------------------------------------------------------------ */

test("a maintenance ticket takes a room out of order and the Ledger shows the block", async () => {
  const today = lagosToday();
  const chart = await get<{ rooms: { id: string; number: string; status: string }[]; stays: { roomId: string | null }[]; blocks?: { roomId: string }[] }>(
    `/tape-chart?from=${today}&to=${plusDays(today, 4)}`,
  );
  const busy = new Set([...chart.stays.map((s) => s.roomId), ...(chart.blocks ?? []).map((b) => b.roomId)]);
  const room = [...chart.rooms]
    .sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
    .find((r) => (r.status === "VACANT_CLEAN" || r.status === "VACANT_DIRTY") && !busy.has(r.id)) ??
    // a full house: any room nobody is sleeping in; future bookings are moved off it with "Block anyway"
    chart.rooms.find((r) => r.status !== "OCCUPIED" && r.status !== "OUT_OF_ORDER" && !(chart.blocks ?? []).some((b) => b.roomId === r.id))!;
  expect(room).toBeTruthy();

  await page.goto("/maintenance");
  await page.getByRole("button", { name: "Report a fault" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Report a fault" });
  await dialog.getByLabel("Room", { exact: true }).selectOption(room.id);
  await dialog.getByLabel("What's wrong").fill(`Bathroom extractor fan dead (e2e ${stamp})`);
  await dialog.getByRole("radio", { name: /Appliance/ }).click();
  await dialog.getByRole("switch", { name: "Take the room out of order" }).click();
  await dialog.getByRole("button", { name: "Open ticket and block room" }).click();
  const anyway = page.getByRole("button", { name: "Block anyway" });
  const toast = page.getByRole("status").filter({ hasText: /MT-\d+ opened/ });
  await expect(toast.or(anyway)).toBeVisible();
  if (await anyway.isVisible()) await anyway.click();
  await expect(toast).toBeVisible();
  const number = ((await toast.textContent()) ?? "").match(/MT-\d+/)![0];

  const tickets = await get<{ items: { id: string; number: string; block: { id: string } | null }[] }>(`/maintenance/tickets?q=${number}`);
  const ticket = tickets.items.find((x) => x.number === number)!;
  expect(ticket.block).toBeTruthy();

  // the ticket links to the room on the Ledger
  await page.goto(`/maintenance/${ticket.id}`);
  await page.getByRole("link", { name: /See it on the Ledger/ }).click();
  await page.waitForURL(/\/ledger\?room=/);
  const block = page.getByTestId(`ledger-block-${room.number}`);
  await expect(block).toBeVisible();
  await expect(block).toContainText(number);

  // put the room back
  await call("POST", `/maintenance/tickets/${ticket.id}/status`, { status: "RESOLVED", resolutionNote: "e2e: fan replaced" });
  await call("PATCH", `/rooms/${room.id}/status`, { status: "VACANT_CLEAN", note: "e2e" }).catch(() => undefined);
});

/* ------------------------------------------------------------------ */

test("a custom role hides the pages it doesn't include", async ({ browser }) => {
  const roleName = `Porter ${stamp}`;
  await page.goto("/staff/roles");
  await page.getByRole("button", { name: "New role" }).click();
  const dialog = page.getByRole("dialog", { name: "A role of your own" });
  await dialog.getByLabel("Name").fill(roleName);
  await dialog.getByRole("button", { name: "Create role" }).click();
  await expect(page.getByRole("status").filter({ hasText: `${roleName} created` })).toBeVisible();

  // take one permission away in the matrix and save through the diff
  const cell = page.locator(`[data-perm="reservations.cancel"][data-role="${roleName}"]`);
  await cell.scrollIntoViewIfNeeded();
  await expect(cell).toHaveAttribute("aria-checked", "true");
  await cell.click();
  await expect(cell).toHaveAttribute("aria-checked", "false");
  await page.getByRole("button", { name: "Review and save" }).click();
  const review = page.getByRole("dialog", { name: "What changes" });
  await expect(review).toContainText("reservations.cancel");
  await review.getByRole("button", { name: /^Save/ }).click();
  await expect(page.getByRole("status").filter({ hasText: `${roleName} saved` })).toBeVisible();

  const roles = await get<{ id: string; name: string; permissions: string[] }[]>("/roles");
  const role = roles.find((r) => r.name === roleName)!;
  expect(role.permissions).not.toContain("reservations.cancel");
  expect(role.permissions).not.toContain("staff.manage");

  const email = `porter${stamp}@palmwine.ng`;
  const person = await call<{ id: string }>("POST", "/staff", { fullName: "Obinna Porter", email, phone: `+234809${stamp}1`, roleId: role.id, password: "Porter1234!" });
  try {
    const c = await signedIn(browser, await login(email, "Porter1234!"));
    const p = await c.newPage();
    await p.goto("/today");
    const nav = p.getByRole("navigation", { name: "Main" });
    await expect(nav.getByRole("link", { name: "Reservations" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Staff", exact: true })).toHaveCount(0);
    await expect(nav.getByRole("link", { name: "Audit log" })).toHaveCount(0);
    await p.goto("/staff");
    await expect(p.getByRole("heading", { name: /isn.t part of your role/ })).toBeVisible();
    await expect(p.getByText(roleName).first()).toBeVisible();
    await c.close();
  } finally {
    await call("DELETE", `/staff/${person.id}`).catch(() => undefined);
    await call("DELETE", `/roles/${role.id}`).catch(() => undefined);
  }
});

/* ------------------------------------------------------------------ */

test("painting a season on the Rate Almanac reprices those nights", async () => {
  const name = `Conference ${stamp}`;
  await page.goto("/rates");
  const grid = page.getByRole("grid", { name: "Nightly rates by room type and date" });
  await expect(grid).toBeVisible();
  const cal = await get<{ roomTypes: { roomType: { id: string; basePriceKobo: number }; days: { date: string; rateKobo: number }[] }[] }>(
    `/rates/calendar?from=${lagosToday()}&to=${plusDays(lagosToday(), 41)}`,
  );
  const [c0, c1] = [3, 5];
  const target = cal.roomTypes[0];
  const date = target.days[c0 + 1].date;
  const before = target.days[c0 + 1].rateKobo;
  const expected = Math.round((target.roomType.basePriceKobo * 1.2) / 100) * 100;

  const a = grid.locator(`[data-cell="0:${c0}"]`);
  const b = grid.locator(`[data-cell="0:${c1}"]`);
  await a.scrollIntoViewIfNeeded();
  const ba = (await a.boundingBox())!;
  const bb = (await b.boundingBox())!;
  await page.mouse.move(ba.x + 12, ba.y + 12);
  await page.mouse.down();
  await page.mouse.move(bb.x + 12, bb.y + 12, { steps: 6 });
  await page.mouse.up();

  const tray = page.getByRole("region", { name: "Paint the selected nights" });
  await expect(tray).toBeVisible();
  await tray.getByLabel("Season name").fill(name);
  await tray.getByRole("button", { name: "+20%" }).click();
  // the grid previews the new price, with the old one struck through
  const cell = grid.locator(`[data-cell="0:${c0 + 1}"]`);
  const fmt = (k: number) => new Intl.NumberFormat("en-NG").format(Math.round(k / 100));
  await expect(cell).toContainText(fmt(expected));
  if (before !== expected) await expect(cell.locator(".line-through")).toHaveText(fmt(before));
  await tray.getByRole("button", { name: "Paint season" }).click();
  await expect(page.getByRole("status").filter({ hasText: `${name} painted` })).toBeVisible();
  await expect(cell).toContainText(fmt(expected));
  await expect(cell.locator(".line-through")).toHaveCount(0);

  const after = await get<{ roomTypes: { roomType: { id: string }; days: { date: string; rateKobo: number; ruleName: string | null }[] }[] }>(`/rates/calendar?from=${date}&to=${date}`);
  const night = after.roomTypes.find((t) => t.roomType.id === target.roomType.id)!.days[0];
  expect(night.ruleName).toBe(name);
  expect(night.rateKobo).toBe(expected);

  const rules = await get<{ id: string; name: string }[]>("/rate-rules");
  for (const r of rules.filter((x) => x.name === name)) await call("DELETE", `/rate-rules/${r.id}`);
});

/* ------------------------------------------------------------------ */

test("a booking with a promo code and a company account checks out to the City Ledger", async () => {
  type Account = { id: string; name: string; active: boolean; availableCreditKobo: number };
  const accounts = await get<Account[]>("/corporate-accounts");
  // a seeded company with room on its credit line; one made (and paused afterwards) if the seed has none
  let account = accounts.filter((a) => a.active && a.availableCreditKobo >= 50_000_000).sort((a, b) => b.availableCreditKobo - a.availableCreditKobo)[0];
  let madeAccount = false;
  if (!account) {
    account = await call<Account>("POST", "/corporate-accounts", { name: `Lagoon Logistics ${stamp}`, contactName: "Bayo Akande", email: "accounts@lagoonlogistics.ng", creditLimitKobo: 200_000_000, paymentTermsDays: 30, billingCycle: "MONTHLY" });
    madeAccount = true;
  }
  // WELCOME10 from the seed; a fresh code (paused afterwards) if the seed doesn't have it live
  const promos = await get<{ code: string; status: string }[]>("/promo-codes");
  let code = "WELCOME10";
  let madePromo: string | null = null;
  if (!promos.some((p) => p.code === code && p.status === "ACTIVE")) {
    code = `E2E${stamp}`;
    madePromo = (await call<{ id: string }>("POST", "/promo-codes", { code, description: "e2e 10% off", type: "PERCENT", value: 1000, channels: ["FRONT_DESK", "BOOKING_SITE", "MARKETPLACE"], active: true })).id;
  }
  const cleanup = async () => {
    if (madePromo) await call("PATCH", `/promo-codes/${madePromo}`, { active: false }).catch(() => undefined);
    if (madeAccount) await call("PATCH", `/corporate-accounts/${account.id}`, { active: false }).catch(() => undefined);
  };
  test.info().annotations.push({ type: "fixtures", description: `${account.name}, ${code}` });
  teardown.push(cleanup);
  const phone = `0816${stamp}4`;

  await page.goto("/reservations");
  await page.getByRole("button", { name: "New reservation" }).first().click();
  const drawer = page.getByRole("dialog", { name: "New reservation" });
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "More nights" }).click();
  const types = drawer.getByRole("radiogroup", { name: "Room type" }).getByRole("radio");
  await expect(drawer.getByText(/left$/).first()).toBeVisible();
  // the room type with the most rooms left, so one is ready to check into
  const count = await types.count();
  let best = -1;
  let most = 0;
  for (let i = 0; i < count; i++) {
    const left = Number(((await types.nth(i).textContent()) ?? "").match(/(\d+) left/)?.[1] ?? 0);
    if ((await types.nth(i).isEnabled()) && left > most) {
      most = left;
      best = i;
    }
  }
  expect(best).toBeGreaterThanOrEqual(0);
  await types.nth(best).click();
  await drawer.getByLabel("Company account").selectOption(account.id);
  await drawer.getByLabel("Promo code").fill(code);
  await drawer.getByRole("button", { name: "Apply" }).click();
  await expect(drawer.getByText(code, { exact: true }).first()).toBeVisible();
  await expect(drawer.getByText(/off$/).first()).toBeVisible();
  await drawer.getByLabel("Phone").fill(phone);
  await drawer.getByLabel("Full name").fill("Ifeoma Chukwuemeka");
  await drawer.getByRole("button", { name: /Book it/ }).click();
  const toast = page.getByRole("status").filter({ hasText: /booked/ });
  await expect(toast).toBeVisible();
  const resCode = ((await toast.textContent()) ?? "").match(/[A-Z]{2,4}-[A-Z0-9]{4}/)![0];
  const found = await get<{ items: { id: string; code: string }[] }>(`/reservations?q=${resCode}`);
  const id = found.items.find((x) => x.code === resCode)!.id;
  const res = await get<{ corporateAccount: { id: string } | null; promo: { code: string; discountKobo: number } | null }>(`/reservations/${id}`);
  expect(res.corporateAccount?.id).toBe(account.id);
  expect(res.promo?.code).toBe(code);
  expect(res.promo?.discountKobo).toBeGreaterThan(0);

  // check in on the register card
  await page.goto(`/reservations/${id}/check-in`);
  const card = page.getByRole("form", { name: "Guest registration card" });
  await expect(card).toBeVisible();
  await card.getByRole("radio", { name: "Female" }).click();
  await card.getByRole("radio", { name: "NIN slip / card" }).click();
  await card.getByLabel("ID number").fill(`3${stamp}0519`);
  await card.getByLabel("Arriving from").fill("Port Harcourt");
  await card.getByLabel("Going to").fill("Port Harcourt");
  await card.getByRole("radio", { name: "Business" }).click();
  await page.getByTestId("id-upload").setInputFiles({
    name: "nin.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });
  await card.getByRole("checkbox", { name: /I confirm these details are correct/ }).check({ force: true });
  const ready = page.getByRole("radiogroup", { name: "Room", exact: true }).getByRole("radio");
  const dirty = page.getByRole("radiogroup", { name: "Needs cleaning" }).getByRole("radio");
  await expect(ready.or(dirty).first()).toBeVisible();
  if (await ready.count()) await ready.first().click();
  else await dirty.first().click();
  const override = page.getByLabel("Override reason");
  if (await override.isVisible()) await override.fill("Inspected by the supervisor, status not updated yet");
  await page.getByTestId("confirm-checkin").click();
  await expect(page.getByText("Checked in", { exact: true })).toBeVisible();

  // check out to the company's City Ledger
  await page.goto(`/reservations/${id}`);
  await page.getByTestId("check-out").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("checkout-city-ledger").click();
  await expect(dialog.getByText(/charged to/)).toBeVisible();
  await expect(dialog.getByText(account.name).first()).toBeVisible();

  const after = await get<{ status: string; balanceKobo: number }>(`/reservations/${id}`);
  expect(after.status).toBe("CHECKED_OUT");
  const detail = await get<{ uninvoiced: { reservationCode: string | null }[]; invoices: { id: string }[] }>(`/corporate-accounts/${account.id}`);
  const onLedger = detail.uninvoiced.some((c) => c.reservationCode === resCode);
  const invoiced = !onLedger ? (await Promise.all(detail.invoices.slice(0, 3).map((i) => get<{ lines: { reservationCode: string | null }[] }>(`/city-ledger/invoices/${i.id}`)))).some((d) => d.lines.some((l) => l.reservationCode === resCode)) : false;
  expect(onLedger || invoiced).toBe(true);
});
