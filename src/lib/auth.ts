"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { authApi } from "./api/endpoints";
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
export function usePlatformSession() {
  return useSyncExternalStore(session.subscribe, session.platform, () => null);
}

export function storeAuth(res: AuthResponse) {
  session.setHotel({ accessToken: res.accessToken, refreshToken: res.refreshToken });
}

export function useLogout() {
  const qc = useQueryClient();
  const router = useRouter();
  return useCallback(async () => {
    const s = session.hotel();
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
