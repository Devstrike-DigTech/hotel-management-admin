"use client";

import { config } from "@/lib/config";
import { createStore, useStore } from "@/lib/store";

/**
 * Connectivity as the desk experiences it. navigator.onLine only knows about
 * the network interface; a Lagos hotel on generator power often has Wi-Fi with
 * no upstream. So we also mark ourselves offline when an API call fails at the
 * network level, and probe /health until it answers again.
 */

export const networkStore = createStore<{ online: boolean; since: number }>({ online: true, since: Date.now() });

let probeTimer: number | null = null;
let started = false;

function set(online: boolean) {
  const cur = networkStore.get();
  if (cur.online === online) return;
  networkStore.set({ online, since: Date.now() });
  if (!online) scheduleProbe();
}

async function probe() {
  probeTimer = null;
  try {
    const ctl = new AbortController();
    const t = window.setTimeout(() => ctl.abort(), 4000);
    const res = await fetch(`${config.apiBase}/health`, { cache: "no-store", signal: ctl.signal });
    window.clearTimeout(t);
    if (res.ok) {
      set(true);
      return;
    }
  } catch {
    /* still offline */
  }
  scheduleProbe();
}

function scheduleProbe() {
  if (typeof window === "undefined" || probeTimer !== null) return;
  probeTimer = window.setTimeout(probe, 5000);
}

/** Called by the API layer when a request fails before reaching the server. */
export function reportNetworkFailure() {
  set(false);
}
export function reportNetworkSuccess() {
  set(true);
}

/** Simulate an outage (development and e2e tests): `window.__offline(true)`. */
export function forceOffline(v: boolean) {
  forced = v;
  set(!v && (typeof navigator === "undefined" || navigator.onLine));
}
let forced = false;
export const isForcedOffline = () => forced;

export function startNetworkWatch() {
  if (started || typeof window === "undefined") return;
  started = true;
  if (!navigator.onLine) set(false);
  window.addEventListener("online", () => {
    if (!forced) void probe();
  });
  window.addEventListener("offline", () => set(false));
  (window as unknown as { __offline?: (v: boolean) => void }).__offline = forceOffline;
}

export function useOnline() {
  return useStore(networkStore).online;
}
export function useNetwork() {
  return useStore(networkStore);
}
