import { api } from "./client";
import type {
  Bank,
  BookingSettings,
  BookingSettingsInput,
  CommissionEntry,
  HotelReview,
  HotelReviewSummary,
  NotificationLogItem,
  NotificationPreview,
  OnlineFeed,
  Paginated,
  PayoutAccount,
  PayoutSummary,
  PayoutTransaction,
  ResolvedAccount,
  ReviewQuery,
} from "./types-m3";

function items<T>(v: T[] | { items: T[] } | undefined | null): T[] {
  if (!v) return [];
  return Array.isArray(v) ? v : (v.items ?? []);
}

type Q = Record<string, string | number | boolean | null | undefined>;

export const publicM3Api = {
  bookingConfig: () =>
    api<{ holdMinutes: number; quoteTtlMinutes: number; paymentProvider: "paystack" | "mock"; devMode: boolean }>("/public/booking-config", {
      auth: "none",
    }),
};

export const bookingSettingsApi = {
  get: () => api<BookingSettings>("/booking-settings"),
  update: (patch: BookingSettingsInput) => api<BookingSettings>("/booking-settings", { method: "PUT", body: patch }),
};

export const payoutsApi = {
  banks: async () => items(await api<Bank[] | { items: Bank[] }>("/payouts/banks")),
  resolve: (bankCode: string, accountNumber: string) =>
    api<ResolvedAccount>("/payouts/resolve-account", { method: "POST", body: { bankCode, accountNumber } }),
  account: async () => (await api<PayoutAccount | null>("/payouts/account")) ?? null,
  saveAccount: (bankCode: string, accountNumber: string, businessName?: string) =>
    api<PayoutAccount>("/payouts/account", { method: "PUT", body: { bankCode, accountNumber, businessName: businessName || undefined } }),
  summary: (from: string, to: string) => api<PayoutSummary>("/payouts/summary", { query: { from, to } }),
  transactions: (q: { from?: string; to?: string; page?: number; pageSize?: number }) =>
    api<Paginated<PayoutTransaction>>("/payouts/transactions", { query: q }),
  commission: (q: { from?: string; to?: string; kind?: string; page?: number; pageSize?: number }) =>
    api<Paginated<CommissionEntry>>("/payouts/commission", { query: q }),
};

export const onlineApi = {
  feed: (since?: string, limit = 20) => api<OnlineFeed>("/online-bookings/feed", { query: { since, limit } }),
};

export const reviewsApi = {
  list: (q: ReviewQuery) => api<Paginated<HotelReview>>("/reviews", { query: q as Q }),
  summary: (months = 12) => api<HotelReviewSummary>("/reviews/summary", { query: { months } }),
  reply: (id: string, body: string) => api<HotelReview>(`/reviews/${id}/reply`, { method: "PUT", body: { body } }),
  flag: (id: string, reason: string) => api<HotelReview>(`/reviews/${id}/flag`, { method: "POST", body: { reason } }),
};

export const notificationsApi = {
  forReservation: async (reservationId: string) =>
    items(await api<NotificationLogItem[] | { items: NotificationLogItem[] }>(`/reservations/${reservationId}/notifications`)),
  preview: (id: string) => api<NotificationPreview>(`/notifications/${id}/preview`),
};

