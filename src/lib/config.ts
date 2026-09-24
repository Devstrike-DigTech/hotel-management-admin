/**
 * Runtime identity + endpoints. The product name is not final: it is always read
 * from env and never hard-coded in components.
 * NEXT_PUBLIC_* values must be referenced literally so Next can inline them.
 */
const envOrigin = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

/** Development only: `localStorage["admin.apiOrigin"]` points the app at another API (e.g. a contract mock). */
function devOverride(): string | null {
  if (process.env.NODE_ENV === "production" || typeof window === "undefined") return null;
  try {
    const v = window.localStorage.getItem("admin.apiOrigin");
    return v ? v.replace(/\/$/, "") : null;
  } catch {
    return null;
  }
}

export const config = {
  get apiOrigin() {
    return devOverride() ?? envOrigin;
  },
  get apiBase() {
    return `${devOverride() ?? envOrigin}/api/v1`;
  },
  appName: process.env.NEXT_PUBLIC_APP_NAME || "HotelOS",
  appDomain: process.env.NEXT_PUBLIC_APP_DOMAIN || "hotelos.ng",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@hotelos.ng",
  webUrl: (process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000").replace(/\/$/, ""),
  /** set from package.json at build time (next.config.ts); sent with support requests */
  appVersion: process.env.NEXT_PUBLIC_APP_VERSION || "dev",
};
