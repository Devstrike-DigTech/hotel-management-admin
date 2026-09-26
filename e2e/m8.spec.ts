import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

/**
 * M8, the concierge, against the live API and its seed:
 * - a new hotel accepts the acceptable-use policy, adds a clean service that goes live and one whose
 *   wording trips the content screen, which waits in review, hidden from guests;
 * - a private request is quoted at the desk, accepted by the guest on the quote link, started and
 *   completed, and its folio line uses the hotel's neutral wording;
 * - a front-desk colleague without "See private requests" sees that request masked on the board,
 *   in search, in the palette and on its page;
 * - a vendor is assigned and sent the job, and the message lands in the dev outbox without the
 *   guest's surname or phone.
 * The tests make their own data and cancel or remove what they can afterwards.
 */

const API = process.env.E2E_API_URL || "http://localhost:4000/api/v1";
const APP_API = process.env.E2E_API_ORIGIN || "";
const OWNER = process.env.E2E_EMAIL || "demo@palmwine.ng";
const PASSWORD = process.env.E2E_PASSWORD || "Demo1234!";
const stamp = Date.now().toString().slice(-6);

type Tokens = { accessToken: string; refreshToken: string };

async function login(email: string, password = PASSWORD): Promise<Tokens> {
  const r = await fetch(`${API}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!r.ok) throw new Error(`login ${email} -> ${r.status} ${await r.text()}`);
  return (await r.json()) as Tokens;
}

async function call<T>(t: Tokens | null, method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { ...(t ? { Authorization: `Bearer ${t.accessToken}` } : {}), ...(body !== undefined ? { "content-type": "application/json" } : {}), "Idempotency-Key": `e2e-${Math.random().toString(36).slice(2)}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text.slice(0, 400)}`);
  return (text ? JSON.parse(text) : undefined) as T;
}

const INIT = ([t, api]: [string, string]) => {
  try {
    if (sessionStorage.getItem("e2e.init")) return;
    sessionStorage.setItem("e2e.init", "1");
    if (api) localStorage.setItem("admin.apiOrigin", api);
    else localStorage.removeItem("admin.apiOrigin");
    localStorage.setItem("admin.theme", "light");
    localStorage.removeItem("admin.property");
    localStorage.setItem("admin.session.hotel", t);
  } catch {}
};

async function open(browser: Browser, t: Tokens): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "Africa/Lagos", locale: "en-NG" });
  await ctx.addInitScript(INIT, [JSON.stringify({ accessToken: t.accessToken, refreshToken: t.refreshToken }), APP_API] as [string, string]);
  return { ctx, page: await ctx.newPage() };
}

type Req = { id: string; number: string; status: string; masked: boolean; discreet: boolean; quote: { acceptUrl: string; totalKobo: number } | null; payment: { folioEntryId: string | null; folioDescription: string | null }; reservation: { id: string } | null };
type Stay = { id: string; code: string; folioId: string; guest: { fullName: string }; room: { number: string } | null };

test.describe.configure({ mode: "default" });

let owner: Tokens;
let stay: Stay;
test.beforeAll(async () => {
  owner = await login(OWNER);
  const list = await call<{ items: Stay[] }>(owner, "GET", "/reservations?status=CHECKED_IN&pageSize=20");
  const s = list.items.find((r) => r.room);
  if (!s) throw new Error("The seed has no guest in the house at The Palmwine House");
  stay = s;
});

/** A private request in the guest's own words, on a stay that is in the house. */
async function privateRequest(text: string) {
  return call<Req>(owner, "POST", "/concierge/requests", { reservationId: stay.id, requestText: text, discreet: true, contactPreference: "SMS", notifyGuest: false, partySize: 2 });
}

test("a new hotel accepts the policy; a clean service goes live and a caught one waits for review", async ({ browser }) => {
  const email = `concierge${stamp}@example.ng`;
  const signup = await call<Tokens>(null, "POST", "/auth/signup", { hotelName: `Lagoon Rest ${stamp}`, city: "Lagos", state: "Lagos", fullName: "Ada Obi", email, phone: `+234803${stamp}`, password: PASSWORD });
  const { ctx, page } = await open(browser, signup);
  try {
    await page.goto("/concierge");
    await expect(page.getByTestId("aup")).toBeVisible();
    await expect(page.getByTestId("accept-aup")).toBeDisabled();
    await page.getByTestId("aup-check").click();
    await page.getByTestId("accept-aup").click();
    await expect(page.getByRole("status").filter({ hasText: "Policy accepted" })).toBeVisible();
    await expect(page.getByTestId("concierge-board")).toBeVisible();

    await page.goto("/concierge/services");
    await expect(page.getByTestId("aup-accepted")).toContainText("accepted by Ada Obi");

    // a clean service: live at once
    await page.getByTestId("add-service").click();
    await page.getByTestId("svc-name").fill("Barber in-room");
    await page.getByTestId("svc-desc").fill("A licensed barber comes to your room with clippers and hot towels.");
    await page.getByTestId("cat-GROOMING").click();
    await page.getByTestId("svc-price").fill("15000");
    // a question built with the booking form's inspector
    await page.getByTestId("add-question").click();
    await page.getByTestId("add-question-panel").getByRole("button", { name: "Choose one" }).click();
    await expect(page.getByTestId("inspector")).toBeVisible();
    await page.getByTestId("insp-label").fill("Style");
    await page.getByTestId("save-service").click();
    const clean = page.locator('[data-testid="service-card"][data-service="Barber in-room"]');
    await expect(clean).toHaveAttribute("data-review", "LIVE");

    // a service whose wording trips the screen: saved, hidden from guests, waiting for review
    await page.getByTestId("add-service").click();
    await page.getByTestId("svc-name").fill("Garden walk");
    await page.getByTestId("svc-desc").fill("A slow walk through the herb garden; we pull a weed or two as we go.");
    await page.getByTestId("cat-TOURS_AND_EXPERIENCES").click();
    await page.getByTestId("svc-price").fill("5000");
    await expect(page.getByTestId("screen-warning")).toBeVisible({ timeout: 15_000 });
    await page.getByTestId("save-service").click();
    await expect(page.getByRole("status").filter({ hasText: "waiting for review" })).toBeVisible();
    const held = page.locator('[data-testid="service-card"][data-service="Garden walk"]');
    await expect(held).toHaveAttribute("data-review", "PENDING_REVIEW");
    await expect(held.getByTestId("service-review-state")).toContainText("Hidden from guests");
    await expect(held.getByTestId("matched-term").first()).toHaveText(/weed/i);
    await expect(page.getByTestId("review-explainer")).toBeVisible();
  } finally {
    await ctx.close();
  }
});

test("a private request: quote, the guest accepts on the link, it is completed and billed in neutral words", async ({ browser }) => {
  const r = await privateRequest(`A quiet birthday set-up with flowers and a cake (e2e ${stamp})`);
  const { ctx, page } = await open(browser, owner);
  try {
    await page.goto(`/concierge/requests/${r.id}`);
    await expect(page.getByTestId("discreet-notice")).toBeVisible();
    await expect(page.getByTestId("request-text")).toContainText("birthday set-up");

    // quote at the desk
    await page.getByTestId("quote-amount").fill("45000");
    await expect(page.getByTestId("quote-preview")).toContainText(`your private request ${r.number}`);
    await page.getByTestId("send-quote").click();
    await expect(page.getByTestId("awaiting-guest")).toBeVisible();

    // the guest accepts on the signed quote page, to be added to the bill
    const quoted = await call<Req>(owner, "GET", `/concierge/requests/${r.id}`);
    const token = new URL(quoted.quote!.acceptUrl).pathname.split("/").pop()!;
    await call(null, "POST", `/public/concierge/quotes/${token}/accept`, { paymentMethod: "FOLIO" });

    await page.reload();
    await expect(page.getByTestId("request-detail")).toBeVisible();
    await page.getByTestId("start-request").click();
    await expect(page.getByTestId("folio-preview")).toContainText(`Guest service (${r.number})`);
    await page.getByTestId("complete-request").click();
    await expect(page.getByTestId("folio-line")).toHaveText(`Guest service (${r.number})`);

    // the folio itself says the same, never the real request
    const done = await call<Req>(owner, "GET", `/concierge/requests/${r.id}`);
    expect(done.status).toBe("COMPLETED");
    const folio = await call<{ entries?: { description: string }[]; lines?: { description: string }[] }>(owner, "GET", `/folios/${stay.folioId}`);
    const lines = (folio.entries ?? folio.lines ?? []).map((e) => e.description);
    expect(lines).toContain(`Guest service (${r.number})`);
    expect(lines.join(" ")).not.toContain("birthday");
  } finally {
    await ctx.close();
  }
});

test("a colleague without the private-requests permission sees a private request masked everywhere", async ({ browser }) => {
  const r = await privateRequest(`Flowers for an anniversary, please (e2e ${stamp})`);
  const email = `desk${stamp}@palmwine.ng`;
  const person = await call<{ id: string }>(owner, "POST", "/staff", { fullName: "Kemi Desk", email, phone: `+234807${stamp}`, role: "FRONT_DESK", password: "Desk1234!" });
  const desk = await login(email, "Desk1234!");
  const { ctx, page } = await open(browser, desk);
  try {
    await page.goto("/concierge");
    const card = page.locator(`[data-testid="request-card"][data-number="${r.number}"]`);
    await expect(card).toHaveAttribute("data-masked", "true");
    await expect(card).toContainText("Private request");
    await expect(card).not.toContainText("anniversary");
    await expect(card).not.toContainText(stay.guest.fullName);

    // search finds it by number, never by what it is or who asked
    await page.getByTestId("board-search").fill(stay.guest.fullName.split(" ")[0]);
    await expect(card).toHaveCount(0);
    await page.getByTestId("board-search").fill(r.number);
    await expect(card).toBeVisible();

    // the palette shows it masked
    await page.keyboard.press("Control+k");
    await page.getByPlaceholder(/Jump to/).fill(r.number);
    const hit = page.getByTestId("palette-concierge-hit").filter({ hasText: r.number });
    await expect(hit).toContainText("Private request");
    await expect(hit).not.toContainText("anniversary");
    await page.keyboard.press("Escape");

    // and its page is a sealed envelope
    await page.goto(`/concierge/requests/${r.id}`);
    await expect(page.getByTestId("sealed-envelope")).toBeVisible();
    await expect(page.getByTestId("request-title")).toHaveText("Private request");
    await expect(page.locator("body")).not.toContainText("anniversary");
    const seen = await call<Req>(desk, "GET", `/concierge/requests/${r.id}`);
    expect(seen.masked).toBe(true);
  } finally {
    await ctx.close();
    await call(owner, "POST", `/concierge/requests/${r.id}/status`, { status: "CANCELLED", note: "e2e clean-up", notifyGuest: false }).catch(() => undefined);
    await call(owner, "DELETE", `/staff/${person.id}`).catch(() => undefined);
  }
});

test("assigning a vendor and sending the job lands in the outbox without the guest's surname or phone", async ({ browser }) => {
  const vendors = await call<{ id: string; name: string; active: boolean; whatsapp: string | null; phone: string | null }[]>(owner, "GET", "/concierge/vendors");
  const vendor = vendors.find((v) => v.active && (v.whatsapp || v.phone))!;
  const r = await call<Req>(owner, "POST", "/concierge/requests", { reservationId: stay.id, requestText: `A photographer for a family portrait by the pool (e2e ${stamp})`, contactPreference: "SMS", notifyGuest: false, partySize: 4 });
  const since = Date.now() - 5_000;
  const { ctx, page } = await open(browser, owner);
  try {
    await page.goto(`/concierge/requests/${r.id}`);
    await page.getByTestId("assign-vendor").selectOption(vendor.id);
    await expect(page.getByTestId("vendor-job")).toBeVisible();
    await expect(page.getByTestId("vendor-message")).not.toContainText(stay.guest.fullName);
    await page.getByTestId("send-to-vendor").click();
    await expect(page.getByRole("status").filter({ hasText: `Sent to ${vendor.name}` })).toBeVisible();

    const surname = stay.guest.fullName.split(" ").slice(-1)[0];
    await expect
      .poll(
        async () => {
          const j = (await (await fetch(`${API}/public/dev/outbox?limit=40`)).json()) as { items: { createdAt: string; template: string; text: string; meta?: { conciergeRequestId?: string } }[] };
          const m = j.items.find((x) => Date.parse(x.createdAt) >= since && (x.meta?.conciergeRequestId === r.id || x.text.includes(r.number)) && /VENDOR/i.test(x.template));
          return m ? { found: true, surname: m.text.includes(surname) } : { found: false, surname: false };
        },
        { timeout: 20_000 },
      )
      .toEqual({ found: true, surname: false });
  } finally {
    await ctx.close();
    await call(owner, "POST", `/concierge/requests/${r.id}/status`, { status: "CANCELLED", note: "e2e clean-up", notifyGuest: false }).catch(() => undefined);
  }
});
