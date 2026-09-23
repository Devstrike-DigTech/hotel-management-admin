/**
 * Token storage for the two audiences this app talks to:
 *  - "hotel": staff access + rotating refresh token
 *  - "platform": Devstrike console access token (separate JWT audience)
 * Persisted to localStorage (guarded), mirrored in memory, observable for React.
 */

export type Audience = "hotel" | "platform";

export interface HotelSession {
  accessToken: string;
  refreshToken: string;
}
export interface PlatformSession {
  accessToken: string;
  email?: string;
  fullName?: string;
}

const KEYS: Record<Audience, string> = {
  hotel: "admin.session.hotel",
  platform: "admin.session.platform",
};

type Listener = () => void;
const listeners = new Set<Listener>();
const cache: { hotel?: HotelSession | null; platform?: PlatformSession | null } = {};

function read<T>(aud: Audience): T | null {
  if (typeof window === "undefined") return null;
  if (cache[aud] !== undefined) return cache[aud] as T | null;
  try {
    const raw = localStorage.getItem(KEYS[aud]);
    const v = raw ? (JSON.parse(raw) as T) : null;
    (cache as Record<Audience, unknown>)[aud] = v;
    return v;
  } catch {
    return null;
  }
}

function write(aud: Audience, value: unknown) {
  (cache as Record<Audience, unknown>)[aud] = value;
  try {
    if (value) localStorage.setItem(KEYS[aud], JSON.stringify(value));
    else localStorage.removeItem(KEYS[aud]);
  } catch {
    /* storage unavailable: memory only */
  }
  listeners.forEach((l) => l());
}

export const session = {
  hotel: () => read<HotelSession>("hotel"),
  platform: () => read<PlatformSession>("platform"),
  setHotel: (s: HotelSession | null) => write("hotel", s),
  setPlatform: (s: PlatformSession | null) => write("platform", s),
  subscribe(l: Listener) {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEYS.hotel || e.key === KEYS.platform) {
        delete cache.hotel;
        delete cache.platform;
        l();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
  },
};

/** Decode a JWT payload without verifying (only used to schedule refresh). */
export function jwtExpiry(token: string | undefined | null): number | null {
  if (!token) return null;
  try {
    const part = token.split(".")[1];
    const json = JSON.parse(atob(part.replace(/-/g, "+").replace(/_/g, "/")));
    return typeof json.exp === "number" ? json.exp * 1000 : null;
  } catch {
    return null;
  }
}
