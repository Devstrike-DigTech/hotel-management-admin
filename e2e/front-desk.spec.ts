import { expect, test, type Page, type BrowserContext } from "@playwright/test";

/**
 * One desk shift, end to end, against the live API and its demo seed:
 * sign in, take a booking, check the guest in on the register card, take a
 * payment inside a cashier shift, check out, close the shift with a blind
 * count, and see Revenue Guard raise the variance.
 */

const API = process.env.E2E_API_URL || "http://localhost:4000/api/v1";
const EMAIL = process.env.E2E_EMAIL || "demo@palmwine.ng";
const PASSWORD = process.env.E2E_PASSWORD || "Demo1234!";

const stamp = Date.now().toString().slice(-7);
const FIRST = ["Temitope", "Chiamaka", "Babatunde", "Nkechi", "Ifeanyi", "Oluwaseyi", "Zainab", "Kunle"];
const LAST = ["Ajala", "Okeke", "Adewale", "Eze", "Bello", "Nwankwo", "Olatunde", "Ibrahim"];
// a real-looking name (no digits); the booking is found again by its code
const guestName = `${FIRST[Number(stamp) % FIRST.length]} ${LAST[Math.floor(Number(stamp) / 8) % LAST.length]}`;
const phone = `0809${stamp}`;

let context: BrowserContext;
let page: Page;
let token = "";
let reservationId = "";
let reservationCode = "";

async function apiGet<T>(path: string): Promise<T> {
  const r = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!r.ok) throw new Error(`${path} -> ${r.status}`);
  return (await r.json()) as T;
}

test.describe.configure({ mode: "serial" });

test.beforeAll(async ({ browser }) => {
  context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "Africa/Lagos" });
  await context.addInitScript(() => {
    try {
      localStorage.removeItem("admin.apiOrigin");
      localStorage.setItem("admin.theme", "light");
    } catch {}
  });
  page = await context.newPage();
  const r = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  token = ((await r.json()) as { accessToken: string }).accessToken;
});

test.afterAll(async () => {
  await context?.close();
});

test("signs in to the front desk", async () => {
  await page.goto("/login");
  await page.getByLabel("Work email").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/today/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening)|Still up/);
  await expect(page.getByTestId("board-arrivals")).toBeVisible();
});

test("books a walk-in reservation with live availability", async () => {
  await page.goto("/reservations");
  await page.getByRole("button", { name: "New reservation" }).first().click();
  const drawer = page.getByRole("dialog", { name: "New reservation" });
  await expect(drawer).toBeVisible();
  // first room type that still has rooms tonight
  const types = drawer.getByRole("radiogroup", { name: "Room type" }).getByRole("radio");
  await expect(types.first()).toBeVisible();
  await expect(drawer.getByText(/left$/).first()).toBeVisible();
  const count = await types.count();
  for (let i = 0; i < count; i++) {
    if (await types.nth(i).isEnabled()) {
      await types.nth(i).click();
      break;
    }
  }
  await drawer.getByLabel("Phone").fill(phone);
  await expect(drawer.getByLabel("Full name")).toBeVisible();
  await drawer.getByLabel("Full name").fill(guestName);
  await drawer.getByRole("button", { name: /Book it/ }).click();
  const toast = page.getByRole("status").filter({ hasText: /booked/ });
  await expect(toast).toBeVisible();
  reservationCode = ((await toast.textContent()) ?? "").match(/[A-Z]{2,4}-[A-Z0-9]{4}/)?.[0] ?? "";
  expect(reservationCode).not.toBe("");

  const found = await apiGet<{ items: { id: string; code: string }[] }>(`/reservations?q=${encodeURIComponent(reservationCode)}`);
  reservationId = found.items.find((x) => x.code === reservationCode)!.id;
  expect(reservationId).toBeTruthy();
});

test("checks the guest in on the register card", async () => {
  await page.goto(`/reservations/${reservationId}/check-in`);
  const card = page.getByRole("form", { name: "Guest registration card" });
  await expect(card).toBeVisible();
  await card.getByRole("radio", { name: "Female" }).click();
  await card.getByRole("radio", { name: "NIN slip / card" }).click();
  await card.getByLabel("ID number").fill(`2${stamp}0419`);
  await card.getByLabel("Arriving from").fill("Abuja");
  await card.getByLabel("Going to").fill("Ibadan");
  await card.getByRole("radio", { name: "Business" }).click();
  await page.getByTestId("id-upload").setInputFiles({
    name: "nin.png",
    mimeType: "image/png",
    buffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      "base64",
    ),
  });
  await card.getByRole("checkbox", { name: /I confirm these details are correct/ }).check({ force: true });
  // a clean room of the booked type
  // (the picker asks for rooms with forCheckIn=true: ready rooms first, dirty ones as a manager override)
  const ready = page.getByRole("radiogroup", { name: "Room", exact: true }).getByRole("radio");
  const dirty = page.getByRole("radiogroup", { name: "Needs cleaning" }).getByRole("radio");
  await expect(ready.or(dirty).first()).toBeVisible();
  if (await ready.count()) await ready.first().click();
  else await dirty.first().click();
  // if every free room still needs cleaning, the owner overrides with a reason
  const override = page.getByLabel("Override reason");
  if (await override.isVisible()) await override.fill("Inspected by the supervisor, status not updated yet");
  await page.getByTestId("confirm-checkin").click();
  await expect(page.getByText("Checked in", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Room");

  const r = await apiGet<{ status: string; registrationComplete: boolean }>(`/reservations/${reservationId}`);
  expect(r.status).toBe("CHECKED_IN");
  expect(r.registrationComplete).toBe(true);
});

test("takes a cash payment inside an open shift", async () => {
  await page.goto("/shifts");
  const open = page.getByTestId("open-shift");
  const close = page.getByTestId("close-shift");
  await expect(open.or(close)).toBeVisible();
  if (await open.isVisible()) {
    await open.click();
    await expect(close).toBeVisible();
  }

  await page.goto(`/reservations/${reservationId}`);
  await page.getByRole("button", { name: "Take payment" }).first().click();
  const sheet = page.getByRole("dialog", { name: "Take payment" });
  await expect(sheet).toBeVisible();
  await sheet.getByRole("radio", { name: "Cash" }).click();
  await sheet.getByRole("button", { name: /^Record/ }).click();
  await expect(sheet.getByText(/Receipt/)).toBeVisible();
  await expect(sheet.getByText(/RCT-\d{4}-\d+/)).toBeVisible();
  await sheet.getByRole("button", { name: "Done" }).click();
  await expect(page.getByTestId("folio-balance")).toHaveText("₦0");
});

test("checks the guest out and issues the final invoice", async () => {
  await page.getByTestId("check-out").click();
  const dialog = page.getByRole("dialog");
  await dialog.getByTestId("confirm-checkout").click();
  await expect(dialog.getByTestId("invoice-number")).toHaveText(/INV-\d{4}-\d+/);
  const r = await apiGet<{ status: string }>(`/reservations/${reservationId}`);
  expect(r.status).toBe("CHECKED_OUT");
});

test("closes the shift with a blind count and reveals the variance", async () => {
  await page.goto("/shifts");
  await page.getByTestId("close-shift").click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Count the");
  // expected totals are hidden while counting
  await expect(page.getByText(/Expected/)).toHaveCount(0);
  await page.getByTestId("count-1000").fill("12");
  await page.getByTestId("count-500").fill("3");
  await expect(page.getByTestId("cash-total")).toHaveText("₦13,500");
  await page.getByTestId("submit-count").click();
  await page.getByTestId("confirm-count").click();
  await expect(page.getByTestId("variance-headline")).toBeVisible();
  await expect(page.getByText("Expected").first()).toBeVisible();
});

test("Revenue Guard shows the variance flag", async () => {
  const flags = await apiGet<{ items: { title: string; rule: string; status: string }[] }>("/guard/flags?status=OPEN,ACKNOWLEDGED&rule=SHIFT_VARIANCE&pageSize=5");
  expect(flags.items.length).toBeGreaterThan(0);
  await page.goto("/guard");
  await expect(page.getByTestId("flag-row").filter({ hasText: flags.items[0].title }).first()).toBeVisible();
});
