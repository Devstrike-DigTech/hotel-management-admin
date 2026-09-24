"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "./api/endpoints";
import { impersonationApi } from "./api/endpoints-m6";
import { refreshHotelSession } from "./api/client";
import { jwtExpiry, session } from "./api/session";
import { useMe, usePublicPlans } from "./api/hooks";
import type { AuthResponse } from "./api/types";
import { minimumPlanFor } from "./catalog";
import { clearPersistedQueries } from "./offline/persist";

const noop = () => () => {};
export function useHydrated() {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

export function useHotelSession() {
  return useSyncExternalStore(session.subscribe, session.hotel, () => null);
}
/** The Devstrike support session open in this tab, if any. */
export function useImpersonation() {
  return useSyncExternalStore(session.subscribe, session.impersonation, () => null);
}

export function storeAuth(res: AuthResponse) {
  session.setHotel({ accessToken: res.accessToken, refreshToken: res.refreshToken });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useCallback(async () => {
    const s = session.hotel();
    if (session.impersonation()) {
      // never sign the real user out from a support tab: end the support session instead
      await impersonationApi.end().catch(() => undefined);
      session.setImpersonation(null);
      qc.clear();
      router.replace("/impersonate?ended=1");
      return;
    }
    if (s?.refreshToken) await authApi.logout(s.refreshToken);
    session.setHotel(null);
    qc.clear();
    void clearPersistedQueries();
    router.replace("/login");
  }, [qc, router]);
}

/** Refresh the access token a minute before it expires, so requests rarely 401. */
export function useSilentRefresh() {
  const s = useHotelSession();
  useEffect(() => {
    if (!s?.accessToken) return;
    const exp = jwtExpiry(s.accessToken);
    if (!exp) return;
    const wait = Math.max(5_000, exp - Date.now() - 60_000);
    const id = window.setTimeout(() => {
      void refreshHotelSession();
    }, wait);
    return () => window.clearTimeout(id);
  }, [s?.accessToken]);
}

/** Entitlement helpers derived from /me. */
export function useEntitlements() {
  const me = useMe();
  const plans = usePublicPlans();
  const ent = me.data?.entitlements;
  const has = useCallback((feature: string) => !!ent?.features.includes(feature), [ent]);
  const limit = (code: string): number | undefined => ent?.limits?.[code];
  const requiredPlan = (feature: string) => minimumPlanFor(feature, plans.data);
  return {
    me: me.data,
    loading: me.isLoading,
    has,
    limit,
    usage: ent?.usage,
    requiredPlan,
    plans: plans.data,
  };
}
