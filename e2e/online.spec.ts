import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * M3, the guest side as the hotel sees it, against the live API and its seed:
 * payout onboarding in dev mock mode (Wuse Garden has no payout account in the
 * seed), replying to a review, changing the cancellation policy, and finding an
 * online booking by its channel badge.
 *
 * E2E_API_ORIGIN points the app at another API origin (for example a contract
 * mock) through the development-only localStorage override.
 */

const ORIGIN = (process.env.E2E_API_ORIGIN || (process.env.E2E_API_URL || "http://localhost:4000/api/v1").replace(/\/api\/v1\/?$/, "")).replace(/\/$/, "");
const API = `${ORIGIN}/api/v1`;
const DEMO = { email: process.env.E2E_EMAIL || "demo@palmwine.ng", password: process.env.E2E_PASSWORD || "Demo1234!" };
const NO_PAYOUT = { email: process.env.E2E_PAYOUT_EMAIL || "owner@wusegarden.ng", password: process.env.E2E_PAYOUT_PASSWORD || "Demo1234!" };
const stamp = Date.now().toString().slice(-6);

async function login(creds: { email: string; password: string }) {
  const r = await fetch(`${API}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(creds) });
  if (!r.ok) throw new Error(`login ${creds.email} -> ${r.status}`);
  return (await r.json()) as { accessToken: string; refreshToken: string };
}

/** A signed-in page (tokens placed where the app keeps them), light theme. */
async function signedIn(browser: Browser, creds: { email: string; password: string }): Promise<{ page: Page; token: string; close: () => Promise<void> }> {
  const s = await login(creds);
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "Africa/Lagos" });
  await context.addInitScript(
    ([session, origin]) => {
      try {
        localStorage.setItem("admin.theme", "light");
        localStorage.setItem("admin.session.hotel", session);
        if (origin !== "http://localhost:4000") localStorage.setItem("admin.apiOrigin", origin);
        else localStorage.removeItem("admin.apiOrigin");
      } catch {}
    },
    [JSON.stringify({ accessToken: s.accessToken, refreshToken: s.refreshToken }), ORIGIN] as const,
  );
  const page = await context.newPage();
  return { page, token: s.accessToken, close: () => context.close() };
}

test.describe.configure({ mode: "serial" });

test("an owner sets up payouts in dev mock mode", async ({ browser }) => {
  const { page, close } = await signedIn(browser, NO_PAYOUT);
  await page.goto("/payouts");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Payouts");

  // first run: onboarding; later runs: the account is on file, so change it
  const onboarding = page.getByTestId("payout-onboarding");
  const account = page.getByTestId("payout-account");
  await expect(onboarding.or(account)).toBeVisible();
  if (await account.isVisible()) await account.getByRole("button", { name: "Change" }).click();
  await expect(onboarding).toBeVisible();
  await expect(onboarding.getByText(/No money moves/)).toBeVisible();

  await onboarding.getByRole("combobox").click();
  await page.getByLabel("Search banks").fill("guaranty");
  await page.getByLabel("Search banks").press("Enter");
  await expect(onboarding.getByRole("combobox")).toContainText(/Guaranty/i);

  const last4 = stamp.slice(-4);
  await onboarding.getByLabel("Account number").fill(`012345${last4}`);
  const name = onboarding.getByTestId("resolved-name");
  await expect(name).toBeVisible();
  await expect(name).not.toBeEmpty();
  await expect(page.getByTestId("save-payout")).toBeDisabled();
  await onboarding.getByText("Yes, this is the hotel's account").click();
  await page.getByTestId("save-payout").click();

  await expect(account).toBeVisible();
  await expect(account).toContainText(last4);
  await expect(account).toContainText(/Guaranty/i);
  await close();
});

test("a manager replies to a review", async ({ browser }) => {
  const { page, token, close } = await signedIn(browser, DEMO);
  const seeded = (await (await fetch(`${API}/reviews?pageSize=1`, { headers: { Authorization: `Bearer ${token}` } })).json()) as { total: number };
  expect(seeded.total, "the M3 seed has reviews for the demo hotel").toBeGreaterThan(0);
  await page.goto("/reviews?replied=false");
  await expect(page.getByTestId("review-rating")).toBeVisible();
  const list = page.getByTestId("review-list");
  const empty = page.getByText("No reviews match");
  await expect(list.or(empty)).toBeVisible();

  const text = `Thank you for staying with us and for the kind words about the desk team. We have passed them on. (${stamp})`;
  if (await list.isVisible()) {
    const card = list.getByRole("article").first();
    await card.getByTestId("reply-review").click();
    await card.getByTestId("reply-composer").getByRole("textbox").fill(text);
    await card.getByRole("button", { name: "Post reply" }).click();
  } else {
    // every review already has a reply (a re-run): edit one instead
    await page.goto("/reviews?replied=true");
    const card = page.getByTestId("review-list").getByRole("article").first();
    await card.getByRole("button", { name: "Edit" }).click();
    await card.getByTestId("reply-composer").getByRole("textbox").fill(text);
    await card.getByRole("button", { name: "Save reply" }).click();
  }
  await expect(page.getByRole("status").filter({ hasText: /Reply (posted|updated)/ })).toBeVisible();

  await page.goto("/reviews?replied=true");
  await expect(page.getByTestId("hotel-reply").filter({ hasText: stamp })).toBeVisible();
  await close();
});

test("an owner changes the cancellation policy and sees the guest's wording", async ({ browser }) => {
  const { page, close } = await signedIn(browser, DEMO);
  await page.goto("/settings/booking");
  const hours = page.getByTestId("policy-hours");
  await expect(hours).toBeVisible();
  const headline = page.getByTestId("policy-headline");

  const was = await hours.getByRole("radio", { checked: true }).textContent().catch(() => null);
  const target = was?.trim() === "3 days" ? "1 day" : "3 days";

  await hours.getByRole("radio", { name: target }).click();
  await expect(headline).toContainText(target === "3 days" ? "3 days before check-in" : "24 hours before check-in");
  await page.getByTestId("policy-late").getByRole("radio", { name: "50%" }).click();
  await expect(page.getByTestId("policy-preview")).toContainText("half of the first night");
  await page.getByTestId("save-booking-settings").click();
  await expect(page.getByRole("status").filter({ hasText: "Booking settings saved" })).toBeVisible();

  // it stuck
  await page.reload();
  await expect(page.getByTestId("policy-hours").getByRole("radio", { name: target })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByTestId("policy-headline")).toContainText(target === "3 days" ? "3 days" : "24 hours");

  // put the seed default back: 48 hours, first night
  await page.getByTestId("policy-hours").getByRole("radio", { name: "2 days" }).click();
  await page.getByTestId("policy-late").getByRole("radio", { name: "1st night" }).click();
  await page.getByTestId("save-booking-settings").click();
  await expect(page.getByRole("status").filter({ hasText: "Booking settings saved" })).toBeVisible();
  await close();
});

test("an online booking shows where it came from", async ({ browser }) => {
  const { page, token, close } = await signedIn(browser, DEMO);
  const r = await fetch(`${API}/reservations?source=MARKETPLACE&pageSize=5`, { headers: { Authorization: `Bearer ${token}` } });
  const list = (await r.json()) as { items: { id: string; code: string; source: string }[] };
  const booking = list.items.find((i) => i.source === "MARKETPLACE");
  expect(booking, "the seed has marketplace bookings").toBeTruthy();

  await page.goto("/reservations?source=MARKETPLACE&view=all");
  const row = page.getByRole("row").filter({ hasText: booking!.code });
  await expect(row).toBeVisible();
  await expect(row.getByTestId("channel-badge")).toHaveAttribute("data-channel", "MARKETPLACE");
  await expect(row.getByTestId("channel-badge")).toHaveText(/Marketplace/i);

  await row.getByRole("link", { name: booking!.code }).click();
  await page.waitForURL(new RegExp(`/reservations/${booking!.id}`));
  await expect(page.getByTestId("channel-badge").first()).toHaveAttribute("data-channel", "MARKETPLACE");
  // a booking made online carries its online block; a desk booking tagged Marketplace does not
  const online = page.getByTestId("online-card");
  const messages = page.getByRole("heading", { name: "What the guest was sent" });
  await expect(messages).toBeVisible();
  if (await online.isVisible()) await expect(online).toContainText(/Booked online/i);
  await close();
});
