"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { bookingSettingsApi, notificationsApi, payoutsApi, platformM3Api, publicM3Api, reviewsApi } from "./endpoints-m3";
import type { ReviewQuery } from "./types-m3";

export const qk3 = {
  payouts: ["payouts"] as const,
  payoutAccount: ["payouts", "account"] as const,
  banks: ["payouts", "banks"] as const,
  payoutSummary: (f: string, t: string) => ["payouts", "summary", f, t] as const,
  payoutTx: (q: object) => ["payouts", "transactions", q] as const,
  bookingConfig: ["public", "booking-config"] as const,
  bookingSettings: ["booking-settings"] as const,
  feed: ["online-bookings", "feed"] as const,
  reviews: (q: object) => ["reviews", "list", q] as const,
  reviewsAll: ["reviews"] as const,
  reviewSummary: ["reviews", "summary"] as const,
  resNotifications: (id: string) => ["notifications", "reservation", id] as const,
  notificationPreview: (id: string) => ["notifications", "preview", id] as const,
  pMarketplace: (f?: string, t?: string) => ["platform", "marketplace", f ?? "", t ?? ""] as const,
  pReceivables: (m?: string) => ["platform", "receivables", m ?? ""] as const,
  pReceivablesAll: ["platform", "receivables"] as const,
  pOrphaned: (q: object) => ["platform", "orphaned", q] as const,
  pOrphanedAll: ["platform", "orphaned"] as const,
  pReviews: (q: object) => ["platform", "reviews", q] as const,
  pReviewsAll: ["platform", "reviews"] as const,
};

export const useBookingConfig = () =>
  useQuery({ queryKey: qk3.bookingConfig, queryFn: publicM3Api.bookingConfig, staleTime: 30 * 60_000 });

export const usePayoutAccount = (enabled = true) => useQuery({ queryKey: qk3.payoutAccount, queryFn: payoutsApi.account, enabled });
export const useBanks = (enabled = true) => useQuery({ queryKey: qk3.banks, queryFn: payoutsApi.banks, enabled, staleTime: 60 * 60_000 });
export const usePayoutSummary = (from: string, to: string, enabled = true) =>
  useQuery({ queryKey: qk3.payoutSummary(from, to), queryFn: () => payoutsApi.summary(from, to), enabled, placeholderData: keepPreviousData });
export const usePayoutTransactions = (q: { from?: string; to?: string; page?: number; pageSize?: number }, enabled = true) =>
  useQuery({ queryKey: qk3.payoutTx(q), queryFn: () => payoutsApi.transactions(q), enabled, placeholderData: keepPreviousData });

export const useBookingSettings = (enabled = true) =>
  useQuery({ queryKey: qk3.bookingSettings, queryFn: bookingSettingsApi.get, enabled });

export const useReviews = (q: ReviewQuery, enabled = true) =>
  useQuery({ queryKey: qk3.reviews(q), queryFn: () => reviewsApi.list(q), enabled, placeholderData: keepPreviousData });
export const useReviewSummary = (enabled = true) => useQuery({ queryKey: qk3.reviewSummary, queryFn: () => reviewsApi.summary(12), enabled });

export const useReservationNotifications = (id: string | null | undefined) =>
  useQuery({ queryKey: qk3.resNotifications(id ?? ""), queryFn: () => notificationsApi.forReservation(id!), enabled: !!id });

export const useMarketplaceSummary = (from?: string, to?: string) =>
  useQuery({ queryKey: qk3.pMarketplace(from, to), queryFn: () => platformM3Api.marketplace(from, to), placeholderData: keepPreviousData });
export const useReceivables = (month?: string) =>
  useQuery({ queryKey: qk3.pReceivables(month), queryFn: () => platformM3Api.receivables(month), placeholderData: keepPreviousData });
export const useOrphanedPayments = (q: { status?: "open" | "all"; page?: number; pageSize?: number }) =>
  useQuery({ queryKey: qk3.pOrphaned(q), queryFn: () => platformM3Api.orphaned(q), placeholderData: keepPreviousData });
export const usePlatformReviews = (q: { status?: string; page?: number; pageSize?: number; q?: string }) =>
  useQuery({ queryKey: qk3.pReviews(q), queryFn: () => platformM3Api.reviews(q), placeholderData: keepPreviousData });
