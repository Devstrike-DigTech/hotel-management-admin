import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

/**
 * M7 against the live API and its seed: a theme change published from Brand
 * Studio shows on the web microsite; a form with a custom select and a
 * conditional question is built and published, and a front-desk booking goes
 * through it; a motor-park pickup shows on the transfers board, a driver is
 * assigned and the guest's message lands in the dev outbox; a Starter hotel
 * sees the locked templates and the three-field limit; the setup wizard keeps
 * its progress. Each test puts the demo data back as it found it.
 */

const API = process.env.E2E_API_URL || "http://localhost:4000/api/v1";
const APP_API = process.env.E2E_API_ORIGIN || "";
const OWNER = process.env.E2E_EMAIL || "demo@palmwine.ng";
const STARTER = process.env.E2E_STARTER_EMAIL || "owner@bodijaheights.ng";
const WIZARD = process.env.E2E_WIZARD_EMAIL || "owner@wusegarden.ng";
const PASSWORD = process.env.E2E_PASSWORD || "Demo1234!";
const stamp = Date.now().toString().slice(-5);

type Tokens = { accessToken: string; refreshToken: string };

async function login(email: string): Promise<Tokens> {
  const r = await fetch(`${API}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password: PASSWORD }) });
  if (!r.ok) throw new Error(`login ${email} -> ${r.status} ${await r.text()}`);
  return (await r.json()) as Tokens;
}

async function call<T>(t: Tokens, method: string, path: string, body?: unknown): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${t.accessToken}`, ...(body !== undefined ? { "content-type": "application/json" } : {}), "Idempotency-Key": `e2e-${Math.random().toString(36).slice(2)}` },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${text.slice(0, 300)}`);
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

const lagosDay = (offset = 0) => new Date(Date.now() + 3_600_000 + offset * 86_400_000).toISOString().slice(0, 10);

test.describe.configure({ mode: "default" });

let owner: Tokens;
test.beforeAll(async () => {
  owner = await login(OWNER);
});

type ThemeState = { siteUrl: string; hasUnpublishedChanges: boolean; draft: { brand: { primary: string } }; published: { id: string; version: number } | null };

test("a colour published in Brand Studio shows on the booking site", async ({ browser }) => {
  const before = await call<ThemeState>(owner, "GET", "/site/theme");
  const versions = await call<{ id: string; isCurrent: boolean }[]>(owner, "GET", "/site/theme/versions");
  const current = versions.find((v) => v.isCurrent)!;
  const pick = before.draft.brand.primary.toUpperCase() === "#1F6F78" ? "#7A2E3A" : "#1F6F78";
  const { ctx, page } = await open(browser, owner);
  try {
    await page.goto("/site#brand");
    await expect(page.getByTestId("brand-studio")).toBeVisible();
    await page.getByTestId("colour-primary").fill(pick);
    // the draft saves itself; contrast feedback follows the colour
    await expect(page.getByTestId("colour-primary-light")).toHaveAttribute("data-grade", /AA/);
    await expect(page.getByTestId("studio-status")).toContainText("Draft saved", { timeout: 15_000 });
    await page.getByTestId("publish-theme").click();
    await expect(page.getByTestId("publish-diff")).toContainText("Primary colour");
    await page.getByTestId("confirm-publish").click();
    await expect(page.getByRole("status").filter({ hasText: "Your booking site is updated" })).toBeVisible();
    await expect(page.getByTestId("studio-status")).toContainText("Live");

    // the web microsite now paints with the applied variant of the new colour
    const slug = new URL(before.siteUrl).pathname.split("/").filter(Boolean).pop()!;
    const pub = await (await fetch(`${API}/public/hotels/${slug}/theme`)).json();
    expect(pub.brand.primary.toUpperCase()).toBe(pick);
    const applied = String(pub.colours.light.primary).toLowerCase();
    await page.goto(before.siteUrl);
    await expect.poll(async () => (await page.content()).toLowerCase().includes(applied), { timeout: 20_000 }).toBe(true);
  } finally {
    // put the site back as it was
    await call(owner, "POST", `/site/theme/versions/${current.id}/revert`, {}).catch(() => undefined);
    if (before.hasUnpublishedChanges) await call(owner, "PUT", "/site/theme/draft", { brand: { primary: before.draft.brand.primary } }).catch(() => undefined);
    await ctx.close();
  }
});

type FormState = { hasUnpublishedChanges: boolean; published: { id: string; version: number } | null; draft: { fields: { key: string; label: string; condition: unknown }[] } };

test("a form with a custom select and a conditional question is published and used at the front desk", async ({ browser }) => {
  const before = await call<FormState>(owner, "GET", "/booking-form");
  if (before.hasUnpublishedChanges) await call(owner, "POST", "/booking-form/discard");
  const { ctx, page } = await open(browser, owner);
  const select = `Arriving by ${stamp}`;
  const bus = `Bus company ${stamp}`;
  let reservationId = "";
  try {
    await page.goto("/settings/booking-form");
    await expect(page.getByTestId("form-canvas")).toBeVisible();

    // a custom "choose one" question with two options
    await page.getByTestId("add-type-SELECT").click();
    await page.getByTestId("insp-label").fill(select);
    await page.getByTestId("option-0").fill("By road");
    await page.getByTestId("option-1").fill("By air");
    await expect(page.getByTestId("form-status")).toContainText("Draft", { timeout: 15_000 });

    // a short answer shown only when the guest comes by road
    await page.getByTestId("add-type-SHORT_TEXT").click();
    await page.getByTestId("insp-label").fill(bus);
    await expect(page.getByTestId("form-status")).toContainText("Draft", { timeout: 15_000 });
    await page.getByTestId("add-condition").click();
    await page.getByTestId("rule-field").selectOption({ label: select });
    await page.getByTestId("rule-op").selectOption("EQUALS");
    await page.getByTestId("rule-value").selectOption({ label: "By road" });
    await expect(page.getByTestId("rule-sentence")).toContainText(`Show ${bus} when`);
    await expect(page.locator('[data-testid^="cond-"]').filter({ hasText: `when ${select} is By road` })).toBeVisible({ timeout: 15_000 });

    // publish with the summary of changes
    await page.getByTestId("publish-form").click();
    await expect(page.getByTestId("form-diff")).toContainText(select);
    await expect(page.getByTestId("form-diff")).toContainText(bus);
    await page.getByTestId("confirm-publish-form").click();
    await expect(page.getByRole("status").filter({ hasText: /Version \d+ is live/ })).toBeVisible();

    // the front desk books through it
    await page.goto("/today");
    await page.getByRole("button", { name: "New reservation" }).first().click();
    const drawer = page.getByRole("dialog");
    await drawer.getByRole("radiogroup", { name: "Room type" }).getByRole("radio").filter({ hasNot: page.locator("[disabled]") }).first().click();
    await drawer.locator("#nr-phone").fill(`0803${stamp}77`.slice(0, 11));
    await drawer.locator("#nr-name").fill(`Kelechi E2E ${stamp}`);
    await expect(drawer.getByTestId("form-answers")).toBeVisible();
    await expect(drawer.getByLabel(bus)).toHaveCount(0);
    await drawer.getByRole("radiogroup", { name: select }).getByRole("radio", { name: "By road" }).click();
    await drawer.getByLabel(bus).fill("GIGM");
    await drawer.getByRole("button", { name: /Book it/ }).click();
    const toast = page.getByRole("status").filter({ hasText: "booked" });
    await expect(toast).toBeVisible();
    await toast.getByRole("button", { name: "Open" }).click();
    await page.waitForURL(/\/reservations\/[\w-]+$/);
    reservationId = page.url().split("/").pop()!;
    const card = page.getByTestId("answers-card");
    await expect(card).toContainText(select);
    await expect(card).toContainText("By road");
    await expect(card).toContainText("GIGM");
  } finally {
    if (reservationId) await call(owner, "POST", `/reservations/${reservationId}/cancel`, { reason: "e2e clean-up" }).catch(() => undefined);
    if (before.published) {
      await call(owner, "POST", `/booking-form/versions/${before.published.id}/restore`).catch(() => undefined);
      await call(owner, "POST", "/booking-form/publish", { note: "e2e: back to the seed form" }).catch(() => undefined);
    }
    await ctx.close();
  }
});

type Point = { id: string; kind: string; name: string; active: boolean; vehicleOptions: { id: string; maxPassengers: number }[]; operatingHours: { open: string; close: string } | null };

test("a motor-park pickup reaches the transfers board, and assigning a driver tells the guest", async ({ browser }) => {
  const points = await call<Point[]>(owner, "GET", "/pickup-points");
  const park = points.find((p) => p.kind === "MOTOR_PARK" && p.active);
  test.skip(!park, "no active motor park in the seed");
  const types = await call<{ id: string }[] | { items: { id: string }[] }>(owner, "GET", "/room-types");
  const roomTypeId = (Array.isArray(types) ? types : types.items)[0].id;
  const arrival = lagosDay(1);
  const phone = `+234803${stamp}12`.slice(0, 14);
  const r = await call<{ id: string; code: string }>(owner, "POST", "/reservations", {
    roomTypeId,
    arrivalDate: arrival,
    departureDate: lagosDay(3),
    guest: { fullName: `Chinedu Road ${stamp}`, phone, consent: true },
    adults: 2,
    source: "PHONE",
    status: "CONFIRMED",
    transfers: [{ direction: "ARRIVAL", pickupPointId: park!.id, vehicleOptionId: park!.vehicleOptions[0]?.id ?? null, passengers: 2, scheduledAt: `${arrival}T14:30:00+01:00`, details: { transportCompanyId: null, transportCompanyOther: "Peace Mass Transit", departureCity: "Enugu" }, contactPhone: phone }],
  });
  const { ctx, page } = await open(browser, owner);
  try {
    await page.goto("/transfers");
    await page.getByLabel("Day").fill(arrival);
    const card = page.locator(`[data-transfer="${r.code}"]`);
    await expect(card).toBeVisible();
    await expect(card).toContainText(park!.name.split(" ")[0]);

    const since = Date.now() - 2_000;
    await card.getByRole("button", { name: "Assign a driver" }).click();
    await page.getByTestId("driver-name").fill("Musa Ibrahim");
    await page.getByTestId("driver-phone").fill("0803 555 0142");
    await page.getByTestId("driver-plate").fill("LSD 482 KJ");
    await expect(page.getByTestId("sms-preview")).toContainText("Musa Ibrahim");
    await page.getByTestId("confirm-assign").click();
    await expect(page.getByRole("status").filter({ hasText: "Musa Ibrahim is on it" })).toBeVisible();
    await expect(card).toHaveAttribute("data-status", "DRIVER_ASSIGNED");

    // the guest's message, in the dev outbox
    await expect
      .poll(
        async () => {
          const j = (await (await fetch(`${API}/public/dev/outbox?limit=30`)).json()) as { items: { createdAt: string; template: string; to: string; text: string }[] };
          return j.items.some((m) => /TRANSFER_DRIVER_ASSIGNED/i.test(m.template) && Date.parse(m.createdAt) >= since && m.text.includes("Musa Ibrahim") && m.text.includes("LSD 482 KJ"));
        },
        { timeout: 20_000 },
      )
      .toBe(true);
  } finally {
    await call(owner, "POST", `/reservations/${r.id}/cancel`, { reason: "e2e clean-up" }).catch(() => undefined);
    await ctx.close();
  }
});

test("a Starter hotel sees the locked templates and the three-field limit", async ({ browser }) => {
  const starter = await login(STARTER);
  const before = await call<FormState & { gates: { limits: { max_custom_form_fields: number }; usage: { customFormFields: number } } }>(starter, "GET", "/booking-form");
  const { ctx, page } = await open(browser, starter);
  try {
    await page.goto("/site");
    await expect(page.getByTestId("template-editorial")).not.toHaveAttribute("data-locked", "true");
    await expect(page.getByTestId("template-essentials")).not.toHaveAttribute("data-locked", "true");
    for (const t of ["boutique", "business", "resort", "heritage"]) await expect(page.getByTestId(`template-${t}`)).toHaveAttribute("data-locked", "true");
    await page.getByTestId("template-boutique").click();
    await expect(page.getByRole("dialog")).toContainText("Growth");
    await page.keyboard.press("Escape");

    await page.goto("/settings/booking-form");
    const meter = page.getByTestId("field-limit");
    await expect(meter).toContainText("/ 3");
    // fill up to the limit, then one more asks for an upgrade instead of adding it
    const room = 3 - before.gates.usage.customFormFields;
    for (let i = 0; i < room; i++) {
      await page.getByTestId("add-type-SHORT_TEXT").click();
      await expect(page.getByTestId("inspector")).toBeVisible();
    }
    await expect(meter).toContainText("3 / 3", { timeout: 15_000 });
    const count = await page.locator("[data-field]").count();
    await page.getByTestId("add-type-SHORT_TEXT").click();
    await expect(page.getByRole("dialog")).toContainText(/extra form field|Growth/i);
    await page.keyboard.press("Escape");
    await expect(page.locator("[data-field]")).toHaveCount(count);
  } finally {
    await call(starter, "POST", "/booking-form/discard").catch(() => undefined);
    await ctx.close();
  }
});

type Setup = { steps: { key: string; status: string; skippable: boolean }[] };

test("the setup wizard keeps its progress", async ({ browser }) => {
  const t = await login(WIZARD);
  const before = await call<Setup>(t, "GET", "/setup");
  const step = before.steps.find((s) => s.status === "TODO" && s.skippable && s.key !== "hotel_type");
  test.skip(!step, "no open skippable step in the seed");
  const { ctx, page } = await open(browser, t);
  try {
    await page.goto("/today");
    await expect(page.getByTestId("setup-checklist")).toBeVisible();
    await page.getByTestId("resume-setup").click();
    await page.waitForURL(/\/setup$/);
    await page.locator(`[data-step="${step!.key}"]`).click();
    await page.getByTestId("skip-step").click();
    await expect(page.locator(`[data-step="${step!.key}"]`)).toHaveAttribute("data-status", "SKIPPED");
    await page.reload();
    await expect(page.locator(`[data-step="${step!.key}"]`)).toHaveAttribute("data-status", "SKIPPED");
    const after = await call<Setup>(t, "GET", "/setup");
    expect(after.steps.find((s) => s.key === step!.key)?.status).toBe("SKIPPED");
  } finally {
    await call(t, "PUT", `/setup/steps/${step!.key}`, { status: "TODO" }).catch(() => undefined);
    await ctx.close();
  }
});
