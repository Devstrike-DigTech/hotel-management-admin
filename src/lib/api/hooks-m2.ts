"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  availabilityApi,
  digestsApi,
  documentsApi,
  foliosApi,
  frontDeskApi,
  guardApi,
  guestsApi,
  pinApi,
  reportsApi,
  reservationsApi,
  shiftsApi,
  taxApi,
} from "./endpoints-m2";
import type { ReservationQuery, StayType } from "./types-m2";

export const qk2 = {
  today: ["front-desk", "today"] as const,
  reservations: (q: object) => ["reservations", "list", q] as const,
  reservationsAll: ["reservations"] as const,
  reservation: (id: string) => ["reservations", "detail", id] as const,
  tape: (from: string, to: string) => ["tape-chart", from, to] as const,
  tapeAll: ["tape-chart"] as const,
  availability: (from: string, to: string, t?: string) => ["availability", from, to, t ?? ""] as const,
  availabilityAll: ["availability"] as const,
  roomAvail: (q: object) => ["availability", "rooms", q] as const,
  guests: (q: object) => ["guests", "list", q] as const,
  guestsAll: ["guests"] as const,
  guest: (id: string) => ["guests", "detail", id] as const,
  tax: ["tax-settings"] as const,
  folio: (id: string) => ["folio", id] as const,
  foliosAll: ["folio"] as const,
  resFolio: (resId: string) => ["folio", "reservation", resId] as const,
  invoice: (id: string) => ["invoice", id] as const,
  receipt: (id: string) => ["receipt", id] as const,
  invoices: (q: object) => ["invoices", q] as const,
  receipts: (q: object) => ["receipts", q] as const,
  shiftCurrent: ["shifts", "current"] as const,
  shifts: (q: object) => ["shifts", "list", q] as const,
  shiftsAll: ["shifts"] as const,
  shift: (id: string) => ["shifts", "detail", id] as const,
  approvers: ["approvers"] as const,
  flags: (q: object) => ["guard", "flags", q] as const,
  guardAll: ["guard"] as const,
  rules: ["guard", "rules"] as const,
  guardSummary: ["guard", "summary"] as const,
  digests: (page: number) => ["digests", page] as const,
  digestSettings: ["digests", "settings"] as const,
  daily: (d?: string) => ["reports", "daily", d ?? "today"] as const,
  range: (f: string, t: string) => ["reports", "range", f, t] as const,
  payments: (f: string, t: string) => ["reports", "payments", f, t] as const,
  shiftsReport: (f: string, t: string) => ["reports", "shifts", f, t] as const,
  auditRuns: ["reports", "audit-runs"] as const,
  reportsAll: ["reports"] as const,
};

export const useFrontDeskToday = (enabled = true) =>
  useQuery({ queryKey: qk2.today, queryFn: frontDeskApi.today, refetchInterval: 45_000, enabled });

export const useReservations = (q: ReservationQuery, enabled = true) =>
  useQuery({
    queryKey: qk2.reservations(q),
    queryFn: () => reservationsApi.list(q),
    placeholderData: keepPreviousData,
    enabled,
  });
export const useReservation = (id: string | null | undefined) =>
  useQuery({ queryKey: qk2.reservation(id ?? ""), queryFn: () => reservationsApi.get(id!), enabled: !!id });

export const useTapeChart = (from: string, to: string) =>
  useQuery({
    queryKey: qk2.tape(from, to),
    queryFn: () => availabilityApi.tapeChart(from, to),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

export const useAvailability = (from: string, to: string, roomTypeId?: string, enabled = true) =>
  useQuery({
    queryKey: qk2.availability(from, to, roomTypeId),
    queryFn: () => availabilityApi.byType(from, to, roomTypeId),
    placeholderData: keepPreviousData,
    enabled,
  });

export const useRoomAvailability = (
  q: {
    roomTypeId: string;
    stayType?: StayType;
    arrivalDate?: string;
    departureDate?: string;
    arrivalAt?: string;
    departureAt?: string;
    excludeReservationId?: string;
    forCheckIn?: boolean;
  } | null,
) =>
  useQuery({
    queryKey: qk2.roomAvail(q ?? {}),
    queryFn: () => availabilityApi.rooms(q!),
    enabled: !!q?.roomTypeId,
    placeholderData: keepPreviousData,
  });

export const useGuests = (q: { q?: string; vip?: boolean; page?: number; pageSize?: number }) =>
  useQuery({ queryKey: qk2.guests(q), queryFn: () => guestsApi.list(q), placeholderData: keepPreviousData });
export const useGuest = (id: string | null | undefined) =>
  useQuery({ queryKey: qk2.guest(id ?? ""), queryFn: () => guestsApi.get(id!), enabled: !!id });

export const useTaxSettings = (enabled = true) => useQuery({ queryKey: qk2.tax, queryFn: taxApi.get, enabled, staleTime: 5 * 60_000 });

export const useFolio = (id: string | null | undefined) =>
  useQuery({ queryKey: qk2.folio(id ?? ""), queryFn: () => foliosApi.get(id!), enabled: !!id });

export const useInvoice = (id: string | null | undefined) =>
  useQuery({ queryKey: qk2.invoice(id ?? ""), queryFn: () => documentsApi.invoice(id!), enabled: !!id });
export const useReceipt = (id: string | null | undefined) =>
  useQuery({ queryKey: qk2.receipt(id ?? ""), queryFn: () => documentsApi.receipt(id!), enabled: !!id });

export const useCurrentShift = (enabled = true) =>
  useQuery({ queryKey: qk2.shiftCurrent, queryFn: shiftsApi.current, enabled, refetchInterval: 60_000 });
export const useShifts = (q: { status?: string; userId?: string; from?: string; to?: string; page?: number; pageSize?: number }, enabled = true) =>
  useQuery({ queryKey: qk2.shifts(q), queryFn: () => shiftsApi.list(q), enabled, placeholderData: keepPreviousData });
export const useShift = (id: string | null | undefined) =>
  useQuery({ queryKey: qk2.shift(id ?? ""), queryFn: () => shiftsApi.get(id!), enabled: !!id });

export const useApprovers = (enabled = true) =>
  useQuery({ queryKey: qk2.approvers, queryFn: pinApi.approvers, enabled, staleTime: 60_000 });

export const useGuardFlags = (q: { status?: string; severity?: string; rule?: string; page?: number; pageSize?: number }, enabled = true) =>
  useQuery({ queryKey: qk2.flags(q), queryFn: () => guardApi.flags(q), enabled, placeholderData: keepPreviousData });
export const useGuardRules = (enabled = true) => useQuery({ queryKey: qk2.rules, queryFn: guardApi.rules, enabled, staleTime: 5 * 60_000 });
export const useGuardSummary = (enabled = true) =>
  useQuery({ queryKey: qk2.guardSummary, queryFn: guardApi.summary, enabled, refetchInterval: 60_000 });

export const useDigests = (page: number, enabled = true) =>
  useQuery({ queryKey: qk2.digests(page), queryFn: () => digestsApi.list(page, 20), enabled });
export const useDigestSettings = (enabled = true) =>
  useQuery({ queryKey: qk2.digestSettings, queryFn: digestsApi.settings, enabled });

export const useDailyFlash = (date?: string, enabled = true) =>
  useQuery({ queryKey: qk2.daily(date), queryFn: () => reportsApi.daily(date), enabled, placeholderData: keepPreviousData });
export const useRangeReport = (from: string, to: string, enabled = true) =>
  useQuery({ queryKey: qk2.range(from, to), queryFn: () => reportsApi.range(from, to), enabled, placeholderData: keepPreviousData });
export const usePaymentsReport = (from: string, to: string, enabled = true) =>
  useQuery({ queryKey: qk2.payments(from, to), queryFn: () => reportsApi.payments(from, to), enabled, placeholderData: keepPreviousData });
export const useShiftsReport = (from: string, to: string, enabled = true) =>
  useQuery({ queryKey: qk2.shiftsReport(from, to), queryFn: () => reportsApi.shifts(from, to), enabled, placeholderData: keepPreviousData });
export const useAuditRuns = (enabled = true) =>
  useQuery({ queryKey: qk2.auditRuns, queryFn: () => reportsApi.auditRuns(1, 10), enabled });
