import { config } from "@/lib/config";
import { session, type Audience } from "./session";
import { isForcedOffline, reportNetworkFailure, reportNetworkSuccess } from "@/lib/offline/network";
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
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}

type Query = Record<string, string | number | boolean | null | undefined>;

export interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  query?: Query;
  auth?: Audience | "none";
  signal?: AbortSignal;
  /** Extra headers, e.g. Idempotency-Key for offline-safe writes. */
  headers?: Record<string, string>;
}

/* ---- session-expiry signal (the shell listens and redirects) ---- */
type ExpiredListener = (aud: Audience) => void;
const expiredListeners = new Set<ExpiredListener>();
export function onSessionExpired(l: ExpiredListener) {
  expiredListeners.add(l);
  return () => {
    expiredListeners.delete(l);
  };
}
function emitExpired(aud: Audience) {
  expiredListeners.forEach((l) => l(aud));
}

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

  const send = async () => {
    const headers: Record<string, string> = { Accept: "application/json", ...(opts.headers ?? {}) };
    if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
    if (auth === "hotel") {
      const t = session.hotel()?.accessToken;
      if (t) headers.Authorization = `Bearer ${t}`;
    } else if (auth === "platform") {
      const t = session.platform()?.accessToken;
      if (t) headers.Authorization = `Bearer ${t}`;
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

  let res = await send();

  if (res.status === 401 && auth === "hotel" && session.hotel()?.refreshToken) {
    const ok = await refreshHotelSession();
    if (ok) res = await send();
  }

  if (res.status === 401 && auth !== "none") {
    const err = await parseError(res);
    if (auth === "hotel") session.setHotel(null);
    else session.setPlatform(null);
    emitExpired(auth);
    throw err;
  }

  if (!res.ok) throw await parseError(res);
  return res;
}

/** Human-friendly message for any thrown value. */
export function errorMessage(e: unknown): string {
  if (isApiError(e)) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}
