import { defineConfig, devices } from "@playwright/test";
import fs from "node:fs";

/**
 * End-to-end tests run against the live stack: the admin dev server (:3001)
 * and the backend API (:4000) with its demo seed. Chromium comes from the
 * pre-installed browsers (PLAYWRIGHT_BROWSERS_PATH or /opt/pw-browsers).
 */
const local = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const executablePath = process.env.PW_CHROMIUM_PATH || (fs.existsSync(local) ? local : undefined);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
    timezoneId: "Africa/Lagos",
    locale: "en-NG",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, launchOptions: { executablePath } } }],
});
