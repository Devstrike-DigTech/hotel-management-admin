import { config } from "@/lib/config";
import { session } from "./session";
import { isForcedOffline, reportNetworkFailure, reportNetworkSuccess } from "@/lib/offline/network";
import { PROPERTY_DENIED_CODES, currentPropertyId, emitPropertyDenied, setPropertyId } from "@/lib/property";
import type { ApiErrorBody, AuthResponse } from "./types";

export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;
  constructor(status: number, code: string, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
  get isEntitlement() {
    return this.code === "FEATURE_LOCKED" || this.code === "LIMIT_REACHED";
  }
  get isReadOnly() {
    return this.code === "SUBSCRIPTION_READ_ONLY";
  }
  get isSupportReadOnly() {
    return this.code === "IMPERSONATION_READ_ONLY";
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
  auth?: "hotel" | "none";
  signal?: AbortSignal;
  /** Extra headers, e.g. Idempotency-Key for offline-safe writes. */
  headers?: Record<string, string>;
  /**
   * The property scope (X-Property-Id). Defaults to the property selected in
   * the shell; pass a specific id to override, or null to send none (group-wide
   * calls such as the property list or group reports).
   */
  propertyId?: string | null;
}

/* ---- session-expiry signal (the shell listens and redirects) ---- */
type ExpiredReason = "hotel" | "impersonation";
type ExpiredListener = (why: ExpiredReason) => void;
const expiredListeners = new Set<ExpiredListener>();
export function onSessionExpired(l: ExpiredListener) {
  expiredListeners.add(l);
  return () => {
    expiredListeners.delete(l);
  };
}
function emitExpired(why: ExpiredReason) {
  expiredListeners.forEach((l) => l(why));
}

/**
 * During a read-only support session nothing that changes data leaves the
 * browser; the API refuses it too (403 IMPERSONATION_READ_ONLY). These POSTs
 * only read, and stay allowed (API-M6 section 6).
 */
const READ_STYLE_POST = [/^\/impersonation\/end$/, /^\/rates\/quote$/, /^\/reports\//, /^\/announcements\/[^/]+\/seen$/];

export function supportSessionBlocks(method: string, path: string) {
  const imp = session.impersonation();
  if (!imp || imp.banner.mode !== "READ_ONLY" || method === "GET") return false;
  return !READ_STYLE_POST.some((r) => r.test(path.split("?")[0]));
}

export const SUPPORT_READ_ONLY_MESSAGE = "This is a read-only support session, so nothing was changed.";

function buildUrl(path: string, query?: Query) {
  const url = new URL(config.apiBase + (path.startsWith("/") ? path : `/${path}`));
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function parseError(res: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> = {};
  try {
    body = await res.json();
  } catch {
    /* non-JSON error */
  }
  let msg = Array.isArray(body.message) ? body.message.join(". ") : body.message;
  // VALIDATION_ERROR carries details.fields = { field: string[] }; surface the first messages.
  const fields = (body.details as { fields?: Record<string, string[]> } | undefined)?.fields;
  if (body.code === "VALIDATION_ERROR" && fields && typeof fields === "object") {
    const parts = Object.values(fields)
      .map((v) => (Array.isArray(v) ? v[v.length - 1] : String(v)))
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1));
    if (parts.length) msg = parts.slice(0, 2).join(". ");
  }
  if (res.status === 429) msg = "Too many attempts. Wait a minute and try again.";
  const code =
    body.code ||
    (res.status === 401
      ? "UNAUTHORIZED"
      : res.status === 403
        ? "FORBIDDEN"
        : res.status === 404
          ? "NOT_FOUND"
          : res.status === 402
            ? "SUBSCRIPTION_READ_ONLY"
            : res.status >= 500
              ? "SERVER_ERROR"
              : "BAD_REQUEST");
  return new ApiError(res.status, code, msg || res.statusText || "Something went wrong", body.details);
}

/* ---- single-flight refresh for the hotel audience ---- */
let refreshing: Promise<boolean> | null = null;

export function refreshHotelSession(): Promise<boolean> {
  if (refreshing) return refreshing;
  const current = session.hotel();
  if (!current?.refreshToken) return Promise.resolve(false);
  refreshing = (async () => {
    try {
      const res = await fetch(buildUrl("/auth/refresh"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshToken: current.refreshToken }),
      });
      if (!res.ok) return false;
      const data = (await res.json()) as AuthResponse;
      session.setHotel({ accessToken: data.accessToken, refreshToken: data.refreshToken });
      return true;
    } catch {
      return false;
    } finally {
      setTimeout(() => {
        refreshing = null;
      }, 0);
    }
  })();
  return refreshing;
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await request(path, opts);
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Like `api` but returns the raw Response (downloads such as CSV). */
export async function apiRaw(path: string, opts: RequestOptions = {}): Promise<Response> {
  return request(path, opts);
}

async function request(path: string, opts: RequestOptions): Promise<Response> {
  const { method = "GET", body, query, auth = "hotel", signal } = opts;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  let sentPid: string | null = null;
  const send = async () => {
    const headers: Record<string, string> = { Accept: "application/json", ...(opts.headers ?? {}) };
    if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
    if (auth === "hotel") {
      const t = session.hotel()?.accessToken;
      if (t) headers.Authorization = `Bearer ${t}`;
      const pid = opts.propertyId === undefined ? currentPropertyId() : opts.propertyId;
      sentPid = pid ?? null;
      if (pid) headers["X-Property-Id"] = pid;
    }
    try {
      if (isForcedOffline()) throw new TypeError("Simulated outage");
      const r = await fetch(buildUrl(path, query), {
        method,
        headers,
        body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
        signal,
      });
      reportNetworkSuccess();
      return r;
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
      reportNetworkFailure();
      throw new ApiError(0, "NETWORK", "We couldn't reach the server. Check your connection and try again.");
    }
  };

  if (auth === "hotel" && supportSessionBlocks(method, path)) {
    throw new ApiError(403, "IMPERSONATION_READ_ONLY", SUPPORT_READ_ONLY_MESSAGE, { sessionId: session.impersonation()?.banner.sessionId, client: true });
  }

  let res = await send();

  if (res.status === 401 && auth === "hotel" && session.hotel()?.refreshToken) {
    const ok = await refreshHotelSession();
    if (ok) res = await send();
  }

  if (res.status === 401 && auth === "hotel") {
    const err = await parseError(res);
    const imp = !!session.impersonation();
    session.setHotel(null); // in a support-session tab this ends only the support session
    emitExpired(imp ? "impersonation" : "hotel");
    throw err;
  }

  if (!res.ok) {
    const err = await parseError(res);
    if (auth === "hotel" && res.status === 403 && PROPERTY_DENIED_CODES.has(err.code)) {
      const denied = sentPid;
      emitPropertyDenied({ propertyId: denied, message: err.message });
      // The stored property is not ours (access withdrawn, or another group's
      // property left in this browser): forget it so the server picks the
      // user's default, and read again. Only reads are retried: a write must
      // never land in a different property from the one it was made in.
      if (opts.propertyId === undefined && denied && method === "GET") {
        if (currentPropertyId() === denied) setPropertyId(null);
        if (currentPropertyId() !== denied) {
          const again = await send();
          if (again.ok) return again;
          throw await parseError(again);
        }
      }
    }
    throw err;
  }
  return res;
}

/** Human-friendly message for any thrown value. */
export function errorMessage(e: unknown): string {
  if (isApiError(e)) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}
