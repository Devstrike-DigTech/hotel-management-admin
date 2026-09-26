"use client";

import { useQuery } from "@tanstack/react-query";
import { useCan } from "@/lib/permissions";
import { useEntitlements } from "@/lib/auth";
import { conciergeApi, type RequestQuery } from "./endpoints-m8";

export const qk8 = {
  all: ["concierge"] as const,
  gates: ["concierge", "gates"] as const,
  aup: ["concierge", "aup"] as const,
  services: ["concierge", "services"] as const,
  library: ["concierge", "question-library"] as const,
  vendors: ["concierge", "vendors"] as const,
  board: ["concierge", "board"] as const,
  requests: (q: RequestQuery) => ["concierge", "requests", q] as const,
  requestsAll: ["concierge", "requests"] as const,
  request: (id: string) => ["concierge", "request", id] as const,
  today: ["concierge", "today"] as const,
  settings: ["concierge", "settings"] as const,
  report: (q: object) => ["concierge", "report", q] as const,
};

/** The concierge is on (plan) and what the viewer may do there (API-M8 0.2). */
export function useConciergeAccess() {
  const { can, ready } = useCan();
  const { has, loading } = useEntitlements();
  const on = has("concierge");
  return {
    ready: ready && !loading,
    on,
    view: on && can("concierge.view"),
    work: on && can("concierge.work"),
    catalogue: on && can("concierge.catalogue"),
    review: on && can("concierge.review"),
    settings: on && can("concierge.settings"),
    reports: on && can("concierge.reports"),
    discreet: can("concierge.discreet"),
    vendors: has("concierge_vendors"),
  };
}

export const useConciergeGates = (enabled = true) => useQuery({ queryKey: qk8.gates, queryFn: conciergeApi.gates, enabled, staleTime: 60_000, retry: 1 });
export const useAup = (enabled = true) => useQuery({ queryKey: qk8.aup, queryFn: conciergeApi.aup, enabled, staleTime: 5 * 60_000, retry: 1 });
export const useConciergeServices = (enabled = true) => useQuery({ queryKey: qk8.services, queryFn: conciergeApi.services, enabled });
export const useQuestionLibrary = (enabled = true) => useQuery({ queryKey: qk8.library, queryFn: conciergeApi.questionLibrary, enabled, staleTime: 30 * 60_000 });
export const useVendors = (enabled = true) => useQuery({ queryKey: qk8.vendors, queryFn: conciergeApi.vendors, enabled });
export const useConciergeBoard = (enabled = true) => useQuery({ queryKey: qk8.board, queryFn: conciergeApi.board, enabled, refetchInterval: 30_000 });
export const useConciergeRequests = (q: RequestQuery, enabled = true) => useQuery({ queryKey: qk8.requests(q), queryFn: () => conciergeApi.requests(q), enabled, refetchInterval: 30_000 });
export const useConciergeRequest = (id: string, enabled = true) => useQuery({ queryKey: qk8.request(id), queryFn: () => conciergeApi.request(id), enabled, refetchInterval: 30_000, retry: 1 });
export const useConciergeSettings = (enabled = true) => useQuery({ queryKey: qk8.settings, queryFn: conciergeApi.settings, enabled });
export const useConciergeReport = (q: { from: string; to: string }, enabled = true) => useQuery({ queryKey: qk8.report(q), queryFn: () => conciergeApi.report(q), enabled });

export function useConciergeToday() {
  const a = useConciergeAccess();
  return useQuery({ queryKey: qk8.today, queryFn: conciergeApi.today, enabled: a.view, refetchInterval: 60_000, retry: 1 });
}
