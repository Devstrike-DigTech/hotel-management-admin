"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useHotelSession } from "@/lib/auth";
import { announcementsApi, apiKeysApi, exportApi, ssoApi, supportApi, webhooksApi, whiteLabelApi } from "./endpoints-m6";

export const qk6 = {
  scopes: ["developer", "scopes"] as const,
  quickstart: ["developer", "quickstart"] as const,
  apiKeys: ["developer", "keys"] as const,
  usage: ["developer", "usage"] as const,
  webhookEvents: ["developer", "webhook-events"] as const,
  endpoints: ["developer", "endpoints"] as const,
  deliveries: (id: string, q: object) => ["developer", "deliveries", id, q] as const,
  deliveriesAll: ["developer", "deliveries"] as const,
  delivery: (id: string) => ["developer", "delivery", id] as const,
  fonts: ["white-label", "fonts"] as const,
  whiteLabel: ["white-label"] as const,
  sso: ["sso"] as const,
  exports: ["exports"] as const,
  supportSummary: ["support", "summary"] as const,
  support: (q: object) => ["support", "requests", q] as const,
  supportAll: ["support", "requests"] as const,
  supportOne: (id: string) => ["support", "request", id] as const,
  sessions: ["support", "sessions"] as const,
  announcements: ["announcements"] as const,
};

export const useScopes = (enabled = true) => useQuery({ queryKey: qk6.scopes, queryFn: apiKeysApi.scopes, enabled, staleTime: 30 * 60_000 });
export const useQuickstart = (enabled = true) => useQuery({ queryKey: qk6.quickstart, queryFn: apiKeysApi.quickstart, enabled, staleTime: 10 * 60_000 });
export const useApiKeys = (enabled = true) => useQuery({ queryKey: qk6.apiKeys, queryFn: apiKeysApi.list, enabled });
export const useApiUsage = (enabled = true) => useQuery({ queryKey: qk6.usage, queryFn: () => apiKeysApi.usage(), enabled, staleTime: 60_000 });
export const useWebhookEvents = (enabled = true) => useQuery({ queryKey: qk6.webhookEvents, queryFn: webhooksApi.events, enabled, staleTime: 30 * 60_000 });
export const useEndpoints = (enabled = true) => useQuery({ queryKey: qk6.endpoints, queryFn: webhooksApi.list, enabled });
export const useDeliveries = (id: string, q: { status?: string; cursor?: string | null }) =>
  useQuery({ queryKey: qk6.deliveries(id, q), queryFn: () => webhooksApi.deliveries(id, { ...q, limit: 25 }), placeholderData: keepPreviousData, refetchInterval: 15_000 });
export const useDelivery = (id: string | null) => useQuery({ queryKey: qk6.delivery(id ?? ""), queryFn: () => webhooksApi.delivery(id!), enabled: !!id });
export const useFonts = (enabled = true) => useQuery({ queryKey: qk6.fonts, queryFn: whiteLabelApi.fonts, enabled, staleTime: 60 * 60_000 });
export const useWhiteLabel = (enabled = true) => useQuery({ queryKey: qk6.whiteLabel, queryFn: whiteLabelApi.get, enabled });
export const useSso = (enabled = true) => useQuery({ queryKey: qk6.sso, queryFn: ssoApi.get, enabled });
export const useExports = (enabled = true) =>
  useQuery({
    queryKey: qk6.exports,
    queryFn: exportApi.list,
    enabled,
    // poll while one is being built
    refetchInterval: (q) => (q.state.data?.some((e) => e.status === "QUEUED" || e.status === "RUNNING") ? 1200 : false),
  });
export const useSupportSummary = (enabled = true) => useQuery({ queryKey: qk6.supportSummary, queryFn: supportApi.summary, enabled, refetchInterval: 90_000, staleTime: 30_000 });
export const useSupportRequests = (q: { status?: string; page?: number }) =>
  useQuery({ queryKey: qk6.support(q), queryFn: () => supportApi.list({ ...q, pageSize: 100 }), placeholderData: keepPreviousData, refetchInterval: 60_000 });
export const useSupportRequest = (id: string) => useQuery({ queryKey: qk6.supportOne(id), queryFn: () => supportApi.get(id), refetchInterval: 20_000 });
export const useSupportSessions = (enabled = true) => useQuery({ queryKey: qk6.sessions, queryFn: () => supportApi.sessions(), enabled });

export function useAnnouncements() {
  const s = useHotelSession();
  return useQuery({ queryKey: qk6.announcements, queryFn: announcementsApi.list, enabled: !!s, refetchInterval: 5 * 60_000, staleTime: 60_000 });
}
