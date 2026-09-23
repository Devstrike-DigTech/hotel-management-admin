/**
 * Runtime identity + endpoints. The product name is not final: it is always read
 * from env and never hard-coded in components.
 * NEXT_PUBLIC_* values must be referenced literally so Next can inline them.
 */
const apiOrigin = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000").replace(/\/$/, "");

export const config = {
  apiOrigin,
  apiBase: `${apiOrigin}/api/v1`,
  appName: process.env.NEXT_PUBLIC_APP_NAME || "HotelOS",
  appDomain: process.env.NEXT_PUBLIC_APP_DOMAIN || "hotelos.ng",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@hotelos.ng",
  webUrl: (process.env.NEXT_PUBLIC_WEB_URL || "http://localhost:3000").replace(/\/$/, ""),
} as const;
