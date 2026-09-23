import { config } from "@/lib/config";
import { session, type Audience } from "./session";
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
  const msg = Array.isArray(body.message) ? body.message.join(". ") : body.message;
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
  const { method = "GET", body, query, auth = "hotel", signal } = opts;

  const send = async () => {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (body !== undefined) headers["Content-Type"] = "application/json";
    if (auth === "hotel") {
      const t = session.hotel()?.accessToken;
      if (t) headers.Authorization = `Bearer ${t}`;
    } else if (auth === "platform") {
      const t = session.platform()?.accessToken;
      if (t) headers.Authorization = `Bearer ${t}`;
    }
    try {
      return await fetch(buildUrl(path, query), {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal,
      });
    } catch (e) {
      if ((e as Error)?.name === "AbortError") throw e;
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
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

/** Human-friendly message for any thrown value. */
export function errorMessage(e: unknown): string {
  if (isApiError(e)) return e.message;
  if (e instanceof Error) return e.message;
  return "Something went wrong";
}
