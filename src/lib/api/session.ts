/**
 * Token storage for the hotel staff app.
 *  - the user's own session: access + rotating refresh token, in localStorage (shared by tabs)
 *  - a Devstrike support session (impersonation): an access token only, in sessionStorage, so it
 *    lives in the one tab it was opened in and never replaces the user's own tokens there or elsewhere
 * Both are guarded, mirrored in memory and observable for React.
 */

import type { ImpersonationBanner } from "./types-m6";

export interface HotelSession {
  accessToken: string;
  refreshToken: string;
}

export interface ImpersonationState {
  accessToken: string;
  expiresAt: string;
  user: { id: string; fullName: string; email: string; role: string };
  banner: ImpersonationBanner;
}

const HOTEL_KEY = "admin.session.hotel";
const IMP_KEY = "admin.session.impersonation";

type Listener = () => void;
const listeners = new Set<Listener>();
const cache: { hotel?: HotelSession | null; imp?: ImpersonationState | null; view?: HotelSession | null } = {};

function readHotel(): HotelSession | null {
  if (typeof window === "undefined") return null;
  if (cache.hotel !== undefined) return cache.hotel;
  try {
    const raw = localStorage.getItem(HOTEL_KEY);
    cache.hotel = raw ? (JSON.parse(raw) as HotelSession) : null;
  } catch {
    cache.hotel = null;
  }
  return cache.hotel;
}

function readImp(): ImpersonationState | null {
  if (typeof window === "undefined") return null;
  if (cache.imp !== undefined) return cache.imp;
  try {
    const raw = sessionStorage.getItem(IMP_KEY);
    cache.imp = raw ? (JSON.parse(raw) as ImpersonationState) : null;
  } catch {
    cache.imp = null;
  }
  return cache.imp;
}

function emit() {
  delete cache.view;
  listeners.forEach((l) => l());
}

export const session = {
  /**
   * The session requests in this tab use: a support session when one is open
   * here (no refresh token), otherwise the user's own. Stable per change so it
   * can back useSyncExternalStore.
   */
  hotel(): HotelSession | null {
    if (typeof window === "undefined") return null;
    if (cache.view !== undefined) return cache.view;
    const imp = readImp();
    cache.view = imp ? { accessToken: imp.accessToken, refreshToken: "" } : readHotel();
    return cache.view;
  },
  /** The user's own tokens. While a support session is open in this tab, clearing ends the support session instead. */
  setHotel(s: HotelSession | null) {
    if (readImp()) {
      if (s === null) {
        session.setImpersonation(null);
        return;
      }
      // a real sign-in in this tab replaces the support session
      cache.imp = null;
      try {
        sessionStorage.removeItem(IMP_KEY);
      } catch {
        /* ignore */
      }
    }
    cache.hotel = s;
    try {
      if (s) localStorage.setItem(HOTEL_KEY, JSON.stringify(s));
      else localStorage.removeItem(HOTEL_KEY);
    } catch {
      /* storage unavailable: memory only */
    }
    emit();
  },
  impersonation: () => readImp(),
  setImpersonation(s: ImpersonationState | null) {
    cache.imp = s;
    try {
      if (s) sessionStorage.setItem(IMP_KEY, JSON.stringify(s));
      else sessionStorage.removeItem(IMP_KEY);
    } catch {
      /* memory only */
    }
    emit();
  },
  /** Keep the stored banner in step with /me (mode changes). */
  updateImpersonationBanner(b: ImpersonationBanner) {
    const cur = readImp();
    if (!cur || JSON.stringify(cur.banner) === JSON.stringify(b)) return;
    session.setImpersonation({ ...cur, banner: b, expiresAt: b.expiresAt });
  },
  subscribe(l: Listener) {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === HOTEL_KEY) {
        delete cache.hotel;
        delete cache.view;
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
