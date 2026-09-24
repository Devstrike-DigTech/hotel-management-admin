import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";

/**
 * M6 (Enterprise) against the live API and its demo seed (Harmattan Hotels &
 * Suites): an API key's secret is shown once; a webhook endpoint gets a test
 * ping that shows in its delivery log; a brand-kit change shows on the sign-in
 * preview and on the staff portal's sign-in page; staff sign in through the dev
 * mock OIDC provider; a full data export is requested and downloaded; a support
 * request is opened with its context; and a Devstrike support session (started
 * through the platform API) shows its banner and refuses writes while read-only.
 */

const API = process.env.E2E_API_URL || "http://localhost:4000/api/v1";
/** Development override for the app's API origin (e.g. a contract mock); unset = the app's own env. */
const APP_API = process.env.E2E_API_ORIGIN || "";
const OWNER = process.env.E2E_ENTERPRISE_EMAIL || "owner@harmattanhotels.com";
const GM = process.env.E2E_ENTERPRISE_GM || "gm@harmattanhotels.com";
const DESK = process.env.E2E_ENTERPRISE_DESK || "frontdesk.abuja@harmattanhotels.com";
const PASSWORD = process.env.E2E_PASSWORD || "Demo1234!";
const PLATFORM_EMAIL = process.env.E2E_PLATFORM_EMAIL || "admin@devstrike.ng";
const PLATFORM_PASSWORD = process.env.E2E_PLATFORM_PASSWORD || "Admin1234!";
const PORTAL = process.env.E2E_STAFF_PORTAL || "staff.harmattanhotels.com";
const stamp = Date.now().toString().slice(-6);

type Tokens = { accessToken: string; refreshToken: string };
let owner: Tokens;
let ctx: BrowserContext;
let page: Page;

async function login(email: string, password = PASSWORD): Promise<Tokens & { user: { id: string } }> {
  const r = await fetch(`${API}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  if (!r.ok) throw new Error(`login ${email} -> ${r.status} ${await r.text()}`);
  return (await r.json()) as Tokens & { user: { id: string } };
}

async function call<T>(method: string, path: string, body?: unknown, token = owner.accessToken): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { "content-type": "application/json" } : {}), "Idempotency-Key": `e2e-${Math.random().toString(36).slice(2)}` },
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
      if (t) localStorage.setItem("admin.session.hotel", t);
      else localStorage.removeItem("admin.session.hotel");
    } catch {}
};

async function context(browser: Browser, t: Tokens | null) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: "Africa/Lagos", locale: "en-NG", acceptDownloads: true });
  await c.addInitScript(INIT, [t ? JSON.stringify({ accessToken: t.accessToken, refreshToken: t.refreshToken }) : "", APP_API] as [string, string]);
  return c;
}

test.describe.configure({ mode: "default" });

test.beforeAll(async ({ browser }) => {
  owner = await login(OWNER);
  ctx = await context(browser, owner);
  page = await ctx.newPage();
});

const teardown: (() => Promise<void>)[] = [];
test.afterAll(async () => {
  for (const t of teardown.reverse()) await t().catch(() => undefined);
  await ctx?.close();
});

test("an API key's secret is shown once, then only its last four characters", async () => {
  const name = `E2E key ${stamp}`;
  await page.goto("/developers/api-keys");
  await page.getByTestId("new-api-key").click();
  await page.getByTestId("key-name").fill(name);
  await page.getByTestId("mode-test").click();
  await page.getByTestId("create-key").click();

  const secretEl = page.getByTestId("secret-value");
  await expect(secretEl).toBeVisible();
  const secret = (await secretEl.getAttribute("data-secret"))!;
  expect(secret).toMatch(/^hk_test_[a-z0-9]{10}_[A-Za-z0-9]+$/);
  // the dialog cannot be closed until the secret is stored
  await expect(page.getByTestId("secret-done")).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(secretEl).toBeVisible();
  await page.getByText("I have stored the key somewhere safe").click();
  await page.getByTestId("secret-done").click();
  await expect(secretEl).toHaveCount(0);

  const row = page.getByTestId("api-key-row").filter({ hasText: name });
  await expect(row).toBeVisible();
  await expect(row).toContainText(secret.slice(-4));
  await expect(page.locator("body")).not.toContainText(secret);
  const keys = await call<{ id: string; name: string }[]>("GET", "/api-keys");
  const k = keys.find((x) => x.name === name)!;
  teardown.push(() => call("POST", `/api-keys/${k.id}/revoke`));

  // the secret works against the partner API, once
  const partner = API.replace(/\/api\/v1$/, "/api/partner/v1");
  const r = await fetch(`${partner}/properties`, { headers: { Authorization: `Bearer ${secret}` } });
  expect(r.status).toBe(200);
});

test("a webhook endpoint gets a test ping that lands in its delivery log", async () => {
  const url = `https://hooks.harmattanhotels.com/e2e-${stamp}`;
  await page.goto("/developers/webhooks");
  await page.getByTestId("new-endpoint").click();
  await page.getByTestId("endpoint-url-input").fill(url);
  await page.getByTestId("save-endpoint").click();
  await expect(page.getByTestId("webhook-secret")).toBeVisible();
  expect(await page.getByTestId("webhook-secret").getAttribute("data-secret")).toMatch(/^whsec_/);
  await page.getByText("I have stored the secret somewhere safe").click();
  await page.getByTestId("secret-done").click();

  await expect(page.getByTestId("endpoint-url")).toHaveText(url);
  const eps = await call<{ id: string; url: string }[]>("GET", "/webhook-endpoints");
  const ep = eps.find((e) => e.url === url)!;
  teardown.push(() => call("DELETE", `/webhook-endpoints/${ep.id}`));

  await page.getByTestId("send-test").click();
  // the ping opens in the request / response viewer, and is in the log
  await expect(page.getByTestId("delivery-detail")).toBeVisible();
  await page.getByTestId("delivery-detail").getByRole("radio", { name: "Request" }).click();
  await expect(page.getByTestId("payload")).toContainText("webhook.ping");
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("delivery-row").filter({ hasText: "webhook.ping" }).first()).toBeVisible();
});

test("a brand-kit change shows on the preview and on the staff portal's sign-in", async ({ browser }) => {
  const before = await call<{ brandName: string | null; primaryColor: string | null }>("GET", "/white-label");
  teardown.push(() => call("PUT", "/white-label", { brandName: before.brandName, primaryColor: before.primaryColor }));
  const name = `Harmattan Suites ${stamp}`;
  await page.goto("/settings/white-label");
  await page.getByTestId("brand-name").fill(name);
  await expect(page.getByTestId("preview-name")).toHaveText(name);
  await page.getByTestId("brand-primary").fill("#123D5C");
  await expect(page.getByTestId("contrast-primary")).toHaveAttribute("data-grade", /AA/);
  await page.getByTestId("save-brand").click();
  await expect(page.getByText("Brand kit saved")).toBeVisible();

  const anon = await context(browser, null);
  const p = await anon.newPage();
  await p.goto(`/login?portal=${PORTAL}`);
  await expect(p.getByTestId("portal-brand-name")).toHaveText(name);
  await expect(p.getByTestId("branded-login")).not.toContainText(process.env.NEXT_PUBLIC_APP_NAME || "HotelOS");
  await anon.close();
});

test("staff sign in with single sign-on through the dev OIDC provider", async ({ browser }) => {
  const anon = await context(browser, null);
  const p = await anon.newPage();
  await p.goto("/login");
  await p.getByTestId("use-sso").click();
  await p.getByTestId("sso-email").fill(GM);
  await p.getByTestId("sso-continue").click();
  // the email typed here travels to the provider as login_hint (API-M6 section 19), so the dev provider signs
  // straight through; without it, its sign-in page asks for the account
  await p.waitForURL(/\/dev\/oidc\/authorize|\/today/, { timeout: 30_000 });
  if (/\/dev\/oidc\/authorize/.test(p.url())) {
    await p.locator('input[name="login_hint"]').fill(GM);
    await p.getByRole("button", { name: "Continue" }).click();
  }
  await p.waitForURL(/\/today/, { timeout: 45_000 });
  await expect(p.getByTestId("topbar-property-lg")).toBeVisible();
  const tok = await p.evaluate(() => localStorage.getItem("admin.session.hotel"));
  expect(tok).toBeTruthy();
  await anon.close();
});

test("a full data export is prepared and downloads as a zip", async () => {
  await page.goto("/data-export");
  await page.getByTestId("request-export").click();
  await expect(page.getByTestId("export-current")).toHaveAttribute("data-status", /QUEUED|RUNNING|READY/);
  await expect(page.getByTestId("export-current")).toHaveAttribute("data-status", "READY", { timeout: 120_000 });
  const link = page.getByTestId("download-export");
  await expect(link).toBeVisible();
  const href = (await link.getAttribute("href"))!;
  const r = await fetch(href);
  expect(r.status).toBe(200);
  expect(r.headers.get("content-type")).toContain("zip");
  const buf = Buffer.from(await r.arrayBuffer());
  expect(buf.subarray(0, 2).toString()).toBe("PK");
});

test("a support request is opened with the page it came from", async () => {
  await page.goto("/developers/webhooks");
  await page.getByTestId("help-button").click();
  await expect(page.getByTestId("support-context")).toContainText("/developers/webhooks");
  const subject = `E2E: webhooks question ${stamp}`;
  await page.getByTestId("support-subject").fill(subject);
  await page.getByTestId("support-message").fill("Is there a way to resend every failed delivery from yesterday at once?");
  await page.getByTestId("support-send").click();
  await page.waitForURL(/\/support\/[^/]+$/);
  await expect(page.getByTestId("support-title")).toHaveText(subject);
  await expect(page.getByTestId("support-thread")).toContainText("resend every failed delivery");
  const id = page.url().split("/").pop()!;
  teardown.push(() => call("POST", `/support/requests/${id}/close`));
});

test("a support session shows its banner and refuses writes while read-only", async ({ browser }) => {
  // the platform API, server to server (no Origin), as the dev super admin
  const P = `${API}/platform`;
  const j = async (r: Response) => {
    const t = await r.text();
    if (!r.ok) throw new Error(`${r.url} -> ${r.status} ${t.slice(0, 300)}`);
    return JSON.parse(t);
  };
  const ch = await j(await fetch(`${P}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: PLATFORM_EMAIL, password: PLATFORM_PASSWORD }) }));
  // a TOTP code works once; if another sign-in just used this one, wait for the next
  let s: { accessToken: string } | null = null;
  for (let i = 0; i < 3 && !s; i++) {
    const { code } = await j(await fetch(`${P}/auth/dev/totp?email=${encodeURIComponent(PLATFORM_EMAIL)}`));
    const r = await fetch(`${P}/auth/mfa/verify`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mfaToken: ch.mfaToken, code }) });
    if (r.ok) s = await r.json();
    else {
      const e = await r.json();
      if (e.code !== "MFA_CODE_ALREADY_USED") throw new Error(`mfa verify -> ${r.status} ${JSON.stringify(e)}`);
      await new Promise((ok) => setTimeout(ok, ((e.details?.secondsLeft ?? 30) + 1) * 1000));
    }
  }
  if (!s) throw new Error("no usable TOTP code");
  const desk = await login(DESK);
  const me = await call<{ tenant: { id: string }; user: { fullName: string } }>("GET", "/me", undefined, desk.accessToken);
  const started = await j(
    await fetch(`${P}/impersonations`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${s.accessToken}` },
      body: JSON.stringify({ tenantId: me.tenant.id, userId: desk.user.id, reason: `E2E ${stamp}: checking the desk view for a support request`, durationMinutes: 10 }),
    }),
  );
  teardown.push(async () => void (await fetch(`${P}/impersonations/${started.session.id}/end`, { method: "POST", headers: { Authorization: `Bearer ${s.accessToken}` } })));

  const c = await context(browser, null);
  const p = await c.newPage();
  const handoff = new URL(started.handoffUrl);
  await p.goto(`${handoff.pathname}${handoff.hash}`);
  await p.waitForURL(/\/(today|hk)/);
  const bar = p.getByTestId("impersonation-banner");
  await expect(bar).toBeVisible();
  await expect(bar).toHaveAttribute("data-mode", "READ_ONLY");
  await expect(p.getByTestId("impersonated-as")).toHaveText(me.user.fullName);
  await expect(bar).toContainText("E2E");
  // the token lives in this tab only, never with the user's own sign-in
  expect(await p.evaluate(() => localStorage.getItem("admin.session.hotel"))).toBeNull();

  // a write is refused, with a plain explanation, and nothing reaches the API
  await p.goto("/support");
  await p.getByTestId("new-support-request").click();
  await p.getByTestId("support-subject").fill("Should not be sent");
  await p.getByTestId("support-message").fill("Written during a read-only support session.");
  await p.getByTestId("support-send").click();
  await expect(p.getByTestId("readonly-write-blocked")).toBeVisible();
  await expect(p.getByTestId("readonly-write-blocked")).toContainText("Nothing was changed");
  const mine = await call<{ items: { subject: string }[] }>("GET", "/support/requests?pageSize=100", undefined, desk.accessToken);
  expect(mine.items.some((r) => r.subject === "Should not be sent")).toBe(false);

  // and the server refuses too, whatever the client does
  const direct = await fetch(`${API}/support/requests`, { method: "POST", headers: { Authorization: `Bearer ${await p.evaluate(() => JSON.parse(sessionStorage.getItem("admin.session.impersonation")!).accessToken)}`, "content-type": "application/json" }, body: JSON.stringify({ subject: "Direct", category: "OTHER", message: "x" }) });
  expect(direct.status).toBe(403);
  expect((await direct.json()).code).toBe("IMPERSONATION_READ_ONLY");

  await p.keyboard.press("Escape");
  await p.getByRole("button", { name: "End session" }).click();
  await expect(p.getByTestId("impersonation-ended")).toBeVisible();
  await c.close();
});
