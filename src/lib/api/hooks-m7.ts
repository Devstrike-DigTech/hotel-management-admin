"use client";

import { useQuery } from "@tanstack/react-query";
import { useCan } from "@/lib/permissions";
import { extrasApi, formApi, pickupApi, setupApi, siteApi, transfersApi } from "./endpoints-m7";
import type { Channel } from "./types-m7";

export const qk7 = {
  templates: ["site", "templates"] as const,
  pairings: ["site", "pairings"] as const,
  gates: ["site", "gates"] as const,
  theme: ["site", "theme"] as const,
  themeVersions: ["site", "versions"] as const,
  preview: ["site", "preview"] as const,
  form: ["booking-form"] as const,
  library: ["booking-form", "library"] as const,
  presets: ["booking-form", "presets"] as const,
  formVersions: ["booking-form", "versions"] as const,
  render: (channel: string, source: string) => ["booking-form", "render", channel, source] as const,
  extras: ["extras"] as const,
  pickups: ["pickup-points"] as const,
  companies: ["transport-companies"] as const,
  trainRoutes: ["train-routes"] as const,
  transfers: (q: object) => ["transfers", q] as const,
  transfersAll: ["transfers"] as const,
  transfersToday: ["transfers", "today"] as const,
  setup: ["setup"] as const,
};

export const useSiteTemplates = () => useQuery({ queryKey: qk7.templates, queryFn: siteApi.templates, staleTime: 30 * 60_000 });
export const useFontPairings = () => useQuery({ queryKey: qk7.pairings, queryFn: siteApi.fontPairings, staleTime: 30 * 60_000 });
export const useSiteGates = (enabled = true) => useQuery({ queryKey: qk7.gates, queryFn: siteApi.gates, enabled, staleTime: 5 * 60_000 });
export const useSiteTheme = (enabled = true) => useQuery({ queryKey: qk7.theme, queryFn: siteApi.theme, enabled });
export const useThemeVersions = (enabled: boolean) => useQuery({ queryKey: qk7.themeVersions, queryFn: siteApi.versions, enabled });
/**
 * A signed preview link for the draft theme and form (API-M7 1.7). It is refreshed a few minutes before
 * its `expiresAt`, also while the tab is in the background, and again whenever the tab comes back into
 * view close to expiry, so the framed page never holds a dead token. The frame reports an expired one
 * anyway (`site-preview` message) and the studio mints a new one then too.
 */
const PREVIEW_MARGIN = 3 * 60_000;
const untilRefresh = (expiresAt: string | undefined) => (expiresAt ? Math.max(30_000, Date.parse(expiresAt) - Date.now() - PREVIEW_MARGIN) : 60_000);
export const usePreviewToken = (enabled = true) =>
  useQuery({
    queryKey: qk7.preview,
    queryFn: () => siteApi.previewToken(),
    enabled,
    staleTime: (q) => untilRefresh(q.state.data?.expiresAt),
    refetchInterval: (q) => untilRefresh(q.state.data?.expiresAt),
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    retry: 1,
  });

export const useBookingForm = (enabled = true) => useQuery({ queryKey: qk7.form, queryFn: formApi.get, enabled });
export const useFormLibrary = (enabled = true) => useQuery({ queryKey: qk7.library, queryFn: formApi.library, enabled, staleTime: 60_000 });
export const useFormPresets = (enabled = true) => useQuery({ queryKey: qk7.presets, queryFn: formApi.presets, enabled, staleTime: 30 * 60_000 });
export const useFormVersions = (enabled: boolean) => useQuery({ queryKey: qk7.formVersions, queryFn: formApi.versions, enabled });
export const useRenderedForm = (channel: Channel, source: "published" | "draft", enabled = true) =>
  useQuery({ queryKey: qk7.render(channel, source), queryFn: () => formApi.render(channel, source), enabled, staleTime: source === "published" ? 60_000 : 0, retry: 1 });

export const useExtras = (enabled = true) => useQuery({ queryKey: qk7.extras, queryFn: extrasApi.list, enabled });
export const usePickupPoints = (enabled = true) => useQuery({ queryKey: qk7.pickups, queryFn: pickupApi.list, enabled });
export const useTransportCompanies = (enabled = true) => useQuery({ queryKey: qk7.companies, queryFn: pickupApi.companies, enabled, staleTime: 10 * 60_000 });
export const useTrainRoutes = (enabled = true) => useQuery({ queryKey: qk7.trainRoutes, queryFn: pickupApi.trainRoutes, enabled, staleTime: 60 * 60_000 });
export const useTransfers = (q: { date?: string; from?: string; to?: string; status?: string; direction?: string }, enabled = true) =>
  useQuery({ queryKey: qk7.transfers(q), queryFn: () => transfersApi.list(q), enabled, refetchInterval: 30_000 });
export function useTransfersToday() {
  const { can } = useCan();
  return useQuery({ queryKey: qk7.transfersToday, queryFn: transfersApi.today, enabled: can("transfers.view"), refetchInterval: 60_000, retry: 1 });
}
export const useSetup = (enabled = true) => useQuery({ queryKey: qk7.setup, queryFn: setupApi.get, enabled, retry: 1 });
