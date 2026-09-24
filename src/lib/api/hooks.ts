"use client";

import { useQuery } from "@tanstack/react-query";
import { authApi, hotelApi, publicApi } from "./endpoints";
import type { RoomStatus } from "./types";

export const qk = {
  me: ["me"] as const,
  dashboard: ["dashboard"] as const,
  property: ["property"] as const,
  roomTypes: ["room-types"] as const,
  rooms: (f: object = {}) => ["rooms", f] as const,
  roomsAll: ["rooms"] as const,
  staff: ["staff"] as const,
  audit: (page: number) => ["audit", page] as const,
  housekeeping: ["housekeeping"] as const,
  billing: ["billing", "subscription"] as const,
  invoices: ["billing", "invoices"] as const,
  plans: ["public", "plans"] as const,
  features: ["public", "features"] as const,
};

export const useMe = (enabled = true) =>
  useQuery({ queryKey: qk.me, queryFn: authApi.me, enabled, staleTime: 60_000 });
export const useDashboard = () =>
  useQuery({ queryKey: qk.dashboard, queryFn: hotelApi.dashboard, refetchInterval: 60_000 });
export const useProperty = () => useQuery({ queryKey: qk.property, queryFn: hotelApi.property });
export const useRoomTypes = () => useQuery({ queryKey: qk.roomTypes, queryFn: hotelApi.roomTypes });
export const useRooms = (f: { status?: RoomStatus | ""; floor?: number | ""; roomTypeId?: string } = {}) =>
  useQuery({ queryKey: qk.rooms(f), queryFn: () => hotelApi.rooms(f), refetchInterval: 30_000 });
export const useStaff = () => useQuery({ queryKey: qk.staff, queryFn: hotelApi.staff });
export const useAuditLogs = (page: number, pageSize = 30) =>
  useQuery({ queryKey: qk.audit(page), queryFn: () => hotelApi.auditLogs(page, pageSize) });
export const useHousekeeping = (enabled: boolean) =>
  useQuery({ queryKey: qk.housekeeping, queryFn: hotelApi.housekeepingTasks, enabled });
export const useBilling = () => useQuery({ queryKey: qk.billing, queryFn: hotelApi.billingSubscription });
export const useInvoices = () => useQuery({ queryKey: qk.invoices, queryFn: hotelApi.invoices });
export const usePublicPlans = (enabled = true) =>
  useQuery({ queryKey: qk.plans, queryFn: publicApi.plans, staleTime: 5 * 60_000, enabled });
export const usePublicFeatures = (enabled = true) =>
  useQuery({ queryKey: qk.features, queryFn: publicApi.features, staleTime: 30 * 60_000, enabled });

