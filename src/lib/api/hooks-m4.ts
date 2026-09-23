"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { cityLedgerApi, corporateApi, hkApi, lostFoundApi, mtApi, notifyApi, promoApi, ratesApi, rolesApi } from "./endpoints-m4";
import type { LostFoundStatus } from "./types-m4";

export const qk4 = {
  permissions: ["permissions"] as const,
  roles: ["roles"] as const,
  role: (id: string) => ["roles", id] as const,
  hk: ["housekeeping"] as const,
  hkBoard: (date?: string) => ["housekeeping", "board", date ?? ""] as const,
  hkMine: ["housekeeping", "mine"] as const,
  hkTask: (id: string) => ["housekeeping", "task", id] as const,
  hkInspections: ["housekeeping", "inspections"] as const,
  hkSettings: ["housekeeping", "settings"] as const,
  hkChecklists: ["housekeeping", "checklists"] as const,
  lostFound: (q: object) => ["lost-found", q] as const,
  mt: ["maintenance"] as const,
  mtTickets: (q: object) => ["maintenance", "tickets", q] as const,
  mtTicket: (id: string) => ["maintenance", "ticket", id] as const,
  mtSchedules: ["maintenance", "schedules"] as const,
  mtCalendar: (f: string, t: string) => ["maintenance", "calendar", f, t] as const,
  mtFuel: (q: object) => ["maintenance", "fuel", q] as const,
  mtFuelSummary: (f?: string, t?: string) => ["maintenance", "fuel-summary", f ?? "", t ?? ""] as const,
  mtReport: (f?: string, t?: string) => ["maintenance", "report", f ?? "", t ?? ""] as const,
  blocks: (q: object) => ["room-blocks", q] as const,
  rates: ["rates"] as const,
  calendar: (f: string, t: string, p?: string) => ["rates", "calendar", f, t, p ?? ""] as const,
  plans: ["rates", "plans"] as const,
  rules: ["rates", "rules"] as const,
  promos: (q: object) => ["promos", q] as const,
  promo: (id: string) => ["promos", "one", id] as const,
  corporate: (q: object) => ["corporate", q] as const,
  corporateOne: (id: string) => ["corporate", "one", id] as const,
  clSummary: ["city-ledger", "summary"] as const,
  clInvoices: (q: object) => ["city-ledger", "invoices", q] as const,
  clInvoice: (id: string) => ["city-ledger", "invoice", id] as const,
  clPayments: (q: object) => ["city-ledger", "payments", q] as const,
  waTemplates: ["notifications", "templates"] as const,
  notifySettings: ["notifications", "settings"] as const,
  alerts: (p: number) => ["notifications", "alerts", p] as const,
};

export const usePermissionCatalog = (enabled = true) => useQuery({ queryKey: qk4.permissions, queryFn: rolesApi.catalog, enabled, staleTime: 30 * 60_000 });
export const useRoles = (enabled = true) => useQuery({ queryKey: qk4.roles, queryFn: rolesApi.list, enabled });

export const useHkBoard = (enabled = true, date?: string) =>
  useQuery({ queryKey: qk4.hkBoard(date), queryFn: () => hkApi.board(date), enabled, refetchInterval: 30_000 });
export const useMyTasks = (enabled = true) => useQuery({ queryKey: qk4.hkMine, queryFn: hkApi.mine, enabled, refetchInterval: 45_000 });
export const useInspections = (enabled = true) => useQuery({ queryKey: qk4.hkInspections, queryFn: hkApi.inspections, enabled, refetchInterval: 30_000 });
export const useHkSettings = (enabled = true) => useQuery({ queryKey: qk4.hkSettings, queryFn: hkApi.settings, enabled });
export const useChecklists = (enabled = true) => useQuery({ queryKey: qk4.hkChecklists, queryFn: hkApi.checklists, enabled });
export const useLostFound = (q: { status?: LostFoundStatus | ""; q?: string; page?: number }, enabled = true) =>
  useQuery({ queryKey: qk4.lostFound(q), queryFn: () => lostFoundApi.list({ ...q, pageSize: 50 }), enabled, placeholderData: keepPreviousData });

export const useTickets = (q: { status?: string; priority?: string; category?: string; q?: string; overdue?: boolean; roomId?: string; page?: number; pageSize?: number }, enabled = true) =>
  useQuery({ queryKey: qk4.mtTickets(q), queryFn: () => mtApi.tickets(q), enabled, placeholderData: keepPreviousData, refetchInterval: 60_000 });
export const useTicket = (id: string | null) => useQuery({ queryKey: qk4.mtTicket(id ?? ""), queryFn: () => mtApi.ticket(id!), enabled: !!id });
export const useSchedules = (enabled = true) => useQuery({ queryKey: qk4.mtSchedules, queryFn: mtApi.schedules, enabled });
export const useScheduleCalendar = (from: string, to: string, enabled = true) =>
  useQuery({ queryKey: qk4.mtCalendar(from, to), queryFn: () => mtApi.scheduleCalendar(from, to), enabled, placeholderData: keepPreviousData });
export const useFuelLogs = (q: { from?: string; to?: string; page?: number; pageSize?: number }, enabled = true) =>
  useQuery({ queryKey: qk4.mtFuel(q), queryFn: () => mtApi.fuel(q), enabled, placeholderData: keepPreviousData });
export const useFuelSummary = (from?: string, to?: string, enabled = true) =>
  useQuery({ queryKey: qk4.mtFuelSummary(from, to), queryFn: () => mtApi.fuelSummary(from, to), enabled, placeholderData: keepPreviousData });
export const useMaintenanceReport = (from?: string, to?: string, enabled = true) =>
  useQuery({ queryKey: qk4.mtReport(from, to), queryFn: () => mtApi.report(from, to), enabled, placeholderData: keepPreviousData });
export const useRoomBlocks = (q: { from?: string; to?: string; roomId?: string; active?: boolean }, enabled = true) =>
  useQuery({ queryKey: qk4.blocks(q), queryFn: () => mtApi.blocks(q), enabled });

export const useRateCalendar = (from: string, to: string, ratePlanId?: string, enabled = true) =>
  useQuery({ queryKey: qk4.calendar(from, to, ratePlanId), queryFn: () => ratesApi.calendar(from, to, ratePlanId), enabled, placeholderData: keepPreviousData });
export const useRatePlans = (enabled = true) => useQuery({ queryKey: qk4.plans, queryFn: () => ratesApi.plans(), enabled });
export const useRateRules = (enabled = true) => useQuery({ queryKey: qk4.rules, queryFn: () => ratesApi.rules(), enabled });

export const usePromos = (q: { status?: string; q?: string } = {}, enabled = true) =>
  useQuery({ queryKey: qk4.promos(q), queryFn: () => promoApi.list(q), enabled, placeholderData: keepPreviousData });
export const usePromo = (id: string | null) => useQuery({ queryKey: qk4.promo(id ?? ""), queryFn: () => promoApi.get(id!), enabled: !!id });

export const useCorporateAccounts = (q: { active?: boolean; q?: string } = {}, enabled = true) =>
  useQuery({ queryKey: qk4.corporate(q), queryFn: () => corporateApi.list(q), enabled, placeholderData: keepPreviousData });
export const useCorporateAccount = (id: string | null) => useQuery({ queryKey: qk4.corporateOne(id ?? ""), queryFn: () => corporateApi.get(id!), enabled: !!id });

export const useCityLedgerSummary = (enabled = true) => useQuery({ queryKey: qk4.clSummary, queryFn: cityLedgerApi.summary, enabled });
export const useCityLedgerInvoices = (q: { accountId?: string; status?: string; overdue?: boolean; bucket?: string; page?: number; pageSize?: number }, enabled = true) =>
  useQuery({ queryKey: qk4.clInvoices(q), queryFn: () => cityLedgerApi.invoices(q), enabled, placeholderData: keepPreviousData });
export const useCityLedgerInvoice = (id: string | null) => useQuery({ queryKey: qk4.clInvoice(id ?? ""), queryFn: () => cityLedgerApi.invoice(id!), enabled: !!id });

export const useWhatsAppTemplates = (enabled = true) => useQuery({ queryKey: qk4.waTemplates, queryFn: notifyApi.templates, enabled, staleTime: 10 * 60_000 });
export const useNotificationSettings = (enabled = true) => useQuery({ queryKey: qk4.notifySettings, queryFn: notifyApi.settings, enabled });
export const useGuardAlerts = (page = 1, enabled = true) => useQuery({ queryKey: qk4.alerts(page), queryFn: () => notifyApi.alerts(page), enabled, placeholderData: keepPreviousData });
