"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMe } from "./hooks";
import { channelsApi, domainsApi, inboxApi, loyaltyApi, posApi, pricingApi, propertiesApi, stockApi } from "./endpoints-m5";
import type { Me } from "./types";
import type { MeM5, PropertySummary } from "./types-m5";

export const qk5 = {
  properties: ["properties"] as const,
  groupReport: (f: string, t: string, ids: string) => ["properties", "group-report", f, t, ids] as const,
  groupDash: ["properties", "group-dashboard"] as const,
  outlets: ["pos", "outlets"] as const,
  categories: ["pos", "categories"] as const,
  items: (q: object) => ["pos", "items", q] as const,
  priceRules: ["pos", "price-rules"] as const,
  menu: (outletId: string) => ["pos", "menu", outletId] as const,
  orders: (q: object) => ["pos", "orders", q] as const,
  order: (id: string) => ["pos", "order", id] as const,
  inHouse: ["pos", "in-house"] as const,
  kds: (q: object) => ["kds", q] as const,
  posReport: (f: string, t: string, o?: string) => ["pos", "report", f, t, o ?? ""] as const,
  stock: (q: object) => ["stock", "items", q] as const,
  stockCounts: ["stock", "counts"] as const,
  stockMoves: (q: object) => ["stock", "movements", q] as const,
  variance: (f: string, t: string) => ["stock", "variance", f, t] as const,
  par: ["minibar", "par"] as const,
  channels: ["channels", "summary"] as const,
  connections: ["channels", "connections"] as const,
  exports: (id: string) => ["channels", "exports", id] as const,
  feeds: (id: string) => ["channels", "feeds", id] as const,
  remote: (id: string) => ["channels", "remote", id] as const,
  mappings: (id: string) => ["channels", "mappings", id] as const,
  otaBookings: (q: object) => ["channels", "bookings", q] as const,
  syncLogs: (q: object) => ["channels", "logs", q] as const,
  cost: (m?: string) => ["channels", "cost", m ?? ""] as const,
  pricing: ["pricing"] as const,
  pricingSettings: ["pricing", "settings"] as const,
  guardrails: ["pricing", "guardrails"] as const,
  frozen: (f?: string, t?: string) => ["pricing", "frozen", f ?? "", t ?? ""] as const,
  events: (f?: string, t?: string) => ["pricing", "events", f ?? "", t ?? ""] as const,
  competitors: (f?: string, t?: string) => ["pricing", "competitors", f ?? "", t ?? ""] as const,
  suggestions: (q: object) => ["pricing", "suggestions", q] as const,
  changes: (q: object) => ["pricing", "changes", q] as const,
  pricingReport: (f: string, t: string) => ["pricing", "report", f, t] as const,
  inbox: ["inbox"] as const,
  inboxSummary: ["inbox", "summary"] as const,
  conversations: (q: object) => ["inbox", "list", q] as const,
  conversation: (id: string) => ["inbox", "one", id] as const,
  quickReplies: ["inbox", "quick-replies"] as const,
  inboxSettings: ["inbox", "settings"] as const,
  loyalty: ["loyalty"] as const,
  programme: ["loyalty", "programme"] as const,
  loyaltySummary: ["loyalty", "summary"] as const,
  members: (q: object) => ["loyalty", "members", q] as const,
  member: (id: string) => ["loyalty", "member", id] as const,
  memberByGuest: (id: string) => ["loyalty", "by-guest", id] as const,
  domains: ["domains"] as const,
};

/**
 * The properties this user can work in. `/me` carries them (M5); `GET /properties`
 * is the fallback. The default is the one the API ran the /me request in.
 */
export function useMyProperties() {
  const me = useMe();
  const m = me.data as (Me & MeM5) | undefined;
  const fromMe = m?.properties;
  const list = useQuery({ queryKey: qk5.properties, queryFn: propertiesApi.list, enabled: !!me.data && !fromMe, staleTime: 5 * 60_000 });
  const items: PropertySummary[] = fromMe ?? list.data ?? [];
  return {
    data: me.data ? { items, defaultPropertyId: m?.currentProperty?.id ?? items[0]?.id ?? null, group: m?.group ?? null } : undefined,
    isLoading: me.isLoading || (!fromMe && list.isLoading),
    refetch: () => (fromMe ? me.refetch() : list.refetch()),
  };
}

export const useGroupReport = (from: string, to: string, ids: string[], enabled = true) =>
  useQuery({ queryKey: qk5.groupReport(from, to, ids.join(",")), queryFn: () => propertiesApi.groupReport(from, to, ids), enabled, placeholderData: keepPreviousData });
export const useGroupDashboard = (enabled = true) => useQuery({ queryKey: qk5.groupDash, queryFn: propertiesApi.groupDashboard, enabled, refetchInterval: 60_000 });

export const useOutlets = (enabled = true) => useQuery({ queryKey: qk5.outlets, queryFn: posApi.outlets, enabled, staleTime: 60_000 });
export const useMenuCategories = (enabled = true) => useQuery({ queryKey: qk5.categories, queryFn: posApi.categories, enabled });
export const useMenuItems = (q: { outletId?: string; categoryId?: string; q?: string } = {}, enabled = true) =>
  useQuery({ queryKey: qk5.items(q), queryFn: () => posApi.items(q), enabled, placeholderData: keepPreviousData });
export const usePriceRules = (enabled = true) => useQuery({ queryKey: qk5.priceRules, queryFn: posApi.priceRules, enabled });
export const useTerminalMenu = (outletId: string | null) =>
  useQuery({ queryKey: qk5.menu(outletId ?? ""), queryFn: () => posApi.menu(outletId!), enabled: !!outletId, staleTime: 60_000, refetchInterval: 5 * 60_000 });
export const usePosOrders = (q: { status?: string; outletId?: string; date?: string; q?: string; page?: number; pageSize?: number }, enabled = true, poll = 15_000) =>
  useQuery({ queryKey: qk5.orders(q), queryFn: () => posApi.orders(q), enabled, refetchInterval: poll, placeholderData: keepPreviousData });
export const usePosOrder = (id: string | null) => useQuery({ queryKey: qk5.order(id ?? ""), queryFn: () => posApi.order(id!), enabled: !!id });
export const useInHouseForPos = (enabled = true) => useQuery({ queryKey: qk5.inHouse, queryFn: () => posApi.inHouse(), enabled, staleTime: 60_000 });
export const useKds = (q: { station?: "KITCHEN" | "BAR"; outletId?: string }, enabled = true) =>
  useQuery({ queryKey: qk5.kds(q), queryFn: () => posApi.kds(q), enabled, refetchInterval: 5_000, refetchIntervalInBackground: true });
export const usePosReport = (from: string, to: string, outletId?: string, enabled = true) =>
  useQuery({ queryKey: qk5.posReport(from, to, outletId), queryFn: () => posApi.report(from, to, outletId), enabled, placeholderData: keepPreviousData });

export const useStockItems = (q: { q?: string; lowStock?: boolean; category?: string } = {}, enabled = true) =>
  useQuery({ queryKey: qk5.stock(q), queryFn: () => stockApi.items(q), enabled, placeholderData: keepPreviousData });
export const useStockCounts = (enabled = true) => useQuery({ queryKey: qk5.stockCounts, queryFn: () => stockApi.counts(1), enabled });
export const useStockMovements = (q: { stockItemId?: string; type?: string; from?: string; to?: string; page?: number }, enabled = true) =>
  useQuery({ queryKey: qk5.stockMoves(q), queryFn: () => stockApi.movements(q), enabled, placeholderData: keepPreviousData });
export const useStockVariance = (from: string, to: string, enabled = true) => useQuery({ queryKey: qk5.variance(from, to), queryFn: () => stockApi.variance(from, to), enabled });
export const useMinibarPar = (enabled = true) => useQuery({ queryKey: qk5.par, queryFn: () => stockApi.par(), enabled });

export const useChannelSummary = (enabled = true) => useQuery({ queryKey: qk5.channels, queryFn: channelsApi.summary, enabled, refetchInterval: 60_000 });
export const useConnections = (enabled = true) => useQuery({ queryKey: qk5.connections, queryFn: channelsApi.connections, enabled });
export const useIcalExports = (id: string | null) => useQuery({ queryKey: qk5.exports(id ?? ""), queryFn: () => channelsApi.exports(id!), enabled: !!id });
export const useIcalFeeds = (id: string | null) => useQuery({ queryKey: qk5.feeds(id ?? ""), queryFn: () => channelsApi.feeds(id!), enabled: !!id });
export const useRemoteCatalogue = (id: string | null) => useQuery({ queryKey: qk5.remote(id ?? ""), queryFn: () => channelsApi.remote(id!), enabled: !!id, staleTime: 5 * 60_000 });
export const useMappings = (id: string | null) => useQuery({ queryKey: qk5.mappings(id ?? ""), queryFn: () => channelsApi.mappings(id!), enabled: !!id });
export const useOtaBookings = (q: { channel?: string; status?: string; from?: string; to?: string; page?: number; pageSize?: number }, enabled = true) =>
  useQuery({ queryKey: qk5.otaBookings(q), queryFn: () => channelsApi.bookings(q), enabled, placeholderData: keepPreviousData });
export const useSyncLogs = (q: { connectionId?: string; status?: string; page?: number; pageSize?: number }, enabled = true) =>
  useQuery({ queryKey: qk5.syncLogs(q), queryFn: () => channelsApi.logs(q), enabled, placeholderData: keepPreviousData, refetchInterval: 30_000 });
export const useChannelCost = (month?: string, enabled = true) => useQuery({ queryKey: qk5.cost(month), queryFn: () => channelsApi.cost(month), enabled, placeholderData: keepPreviousData });

export const usePricingSettings = (enabled = true) => useQuery({ queryKey: qk5.pricingSettings, queryFn: pricingApi.settings, enabled });
export const useGuardrails = (enabled = true) => useQuery({ queryKey: qk5.guardrails, queryFn: pricingApi.guardrails, enabled });
export const useFrozenDates = (from?: string, to?: string, enabled = true) => useQuery({ queryKey: qk5.frozen(from, to), queryFn: () => pricingApi.frozen(from, to), enabled });
export const usePricingEvents = (from?: string, to?: string, enabled = true) =>
  useQuery({ queryKey: qk5.events(from, to), queryFn: () => pricingApi.events(from, to), enabled, placeholderData: keepPreviousData });
export const useCompetitors = (from?: string, to?: string, enabled = true) => useQuery({ queryKey: qk5.competitors(from, to), queryFn: () => pricingApi.competitors(from, to), enabled });
export const useSuggestions = (q: { from?: string; to?: string; roomTypeId?: string; status?: string }, enabled = true) =>
  useQuery({ queryKey: qk5.suggestions(q), queryFn: () => pricingApi.suggestions(q), enabled, placeholderData: keepPreviousData });
export const usePriceChanges = (q: { from?: string; to?: string; roomTypeId?: string; source?: string; page?: number; pageSize?: number }, enabled = true) =>
  useQuery({ queryKey: qk5.changes(q), queryFn: () => pricingApi.changes(q), enabled, placeholderData: keepPreviousData });
export const usePricingReport = (from: string, to: string, enabled = true) =>
  useQuery({ queryKey: qk5.pricingReport(from, to), queryFn: () => pricingApi.report(from, to), enabled, placeholderData: keepPreviousData });

export const useInboxSummary = (enabled = true) => useQuery({ queryKey: qk5.inboxSummary, queryFn: inboxApi.summary, enabled, refetchInterval: 20_000 });
export const useConversations = (q: { status?: string; assigneeId?: string; mine?: boolean; unread?: boolean; q?: string; page?: number; pageSize?: number }, enabled = true) =>
  useQuery({ queryKey: qk5.conversations(q), queryFn: () => inboxApi.list(q), enabled, refetchInterval: 10_000, placeholderData: keepPreviousData });
export const useConversation = (id: string | null) => useQuery({ queryKey: qk5.conversation(id ?? ""), queryFn: () => inboxApi.get(id!), enabled: !!id, refetchInterval: 8_000 });
export const useQuickReplies = (enabled = true) => useQuery({ queryKey: qk5.quickReplies, queryFn: inboxApi.quickReplies, enabled, staleTime: 5 * 60_000 });
export const useInboxSettings = (enabled = true) => useQuery({ queryKey: qk5.inboxSettings, queryFn: inboxApi.settings, enabled });

export const useLoyaltyProgramme = (enabled = true) => useQuery({ queryKey: qk5.programme, queryFn: loyaltyApi.programme, enabled, staleTime: 5 * 60_000 });
export const useLoyaltySummary = (enabled = true) => useQuery({ queryKey: qk5.loyaltySummary, queryFn: loyaltyApi.summary, enabled });
export const useLoyaltyMembers = (q: { q?: string; tierId?: string; page?: number; pageSize?: number }, enabled = true) =>
  useQuery({ queryKey: qk5.members(q), queryFn: () => loyaltyApi.members(q), enabled, placeholderData: keepPreviousData });
export const useLoyaltyMember = (id: string | null) => useQuery({ queryKey: qk5.member(id ?? ""), queryFn: () => loyaltyApi.member(id!), enabled: !!id });
export const useMemberByGuest = (guestId: string | null | undefined, enabled = true) =>
  useQuery({ queryKey: qk5.memberByGuest(guestId ?? ""), queryFn: () => loyaltyApi.byGuest(guestId!), enabled: !!guestId && enabled, retry: false });

export const useDomains = (enabled = true, poll?: number) => useQuery({ queryKey: qk5.domains, queryFn: domainsApi.get, enabled, refetchInterval: poll });
