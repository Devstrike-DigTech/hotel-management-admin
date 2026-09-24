"use client";

import { useSyncExternalStore } from "react";

/** Minimal observable store (no dependency) for cross-tree UI state. */
export function createStore<T>(initial: T) {
  let state = initial;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next: T | ((prev: T) => T)) {
      state = typeof next === "function" ? (next as (p: T) => T)(state) : next;
      listeners.forEach((l) => l());
    },
    subscribe(l: () => void) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

export function useStore<T>(store: ReturnType<typeof createStore<T>>): T {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}

/* ---------- toasts ---------- */
export type ToastTone = "neutral" | "success" | "error" | "warning";
export interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
}
export const toastStore = createStore<ToastItem[]>([]);
let toastId = 0;

function push(tone: ToastTone, title: string, body?: string, action?: ToastItem["action"]) {
  const id = ++toastId;
  toastStore.set((t) => [...t.slice(-3), { id, tone, title, body, action }]);
  setTimeout(() => dismissToast(id), tone === "error" ? 7000 : 4200);
  return id;
}
export function dismissToast(id: number) {
  toastStore.set((t) => t.filter((x) => x.id !== id));
}
export const toast = {
  success: (title: string, body?: string, action?: ToastItem["action"]) => push("success", title, body, action),
  error: (title: string, body?: string) => push("error", title, body),
  warning: (title: string, body?: string) => push("warning", title, body),
  info: (title: string, body?: string, action?: ToastItem["action"]) => push("neutral", title, body, action),
};

/* ---------- entitlement / upgrade dialog ---------- */
export type UpgradePrompt =
  | { kind: "feature"; feature: string; requiredPlan?: string; message?: string }
  | { kind: "limit"; limit: string; max?: number; current?: number; upgradePlan?: string; message?: string }
  | { kind: "readonly"; message?: string };

export const upgradeStore = createStore<UpgradePrompt | null>(null);
export const openUpgrade = (p: UpgradePrompt) => upgradeStore.set(p);
export const closeUpgrade = () => upgradeStore.set(null);

/** Set when any write returns SUBSCRIPTION_READ_ONLY (the banner also reads /me). */
export const readOnlyStore = createStore<boolean>(false);

/* ---------- command palette ---------- */
export const paletteStore = createStore<boolean>(false);

/* ---------- support session (impersonation) ---------- */
/** Set when a write is refused because the support session is read-only. */
export const supportBlockStore = createStore<number>(0);
