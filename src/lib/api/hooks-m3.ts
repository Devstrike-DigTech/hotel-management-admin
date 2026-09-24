"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { bookingSettingsApi, notificationsApi, payoutsApi, publicM3Api, reviewsApi } from "./endpoints-m3";
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
