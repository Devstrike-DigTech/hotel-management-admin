"use client";

import { api, isApiError, type ApiError } from "@/lib/api/client";
import { createStore, useStore } from "@/lib/store";
import { idb } from "./idb";
import { networkStore } from "./network";

/**
 * The offline outbox. Desk actions that can be taken without a connection:
 * check-in, payment, room status, check-out, and a housekeeper's start,
 * checklist ticks, finish and skip. Each action gets its own
 * Idempotency-Key the moment the clerk presses the button; the same key is
 * used for the first attempt and every replay, so an action that did reach
 * the server before the line dropped is never applied twice.
 */

export type OutboxKind = "check-in" | "payment" | "room-status" | "check-out" | "housekeeping";

export interface OutboxItem {
  id: string; // also the Idempotency-Key
  kind: OutboxKind;
  title: string;
  subtitle?: string;
  method: "POST" | "PATCH" | "PUT";
  path: string;
  body: Record<string, unknown>;
  createdAt: string; // when it happened at the desk (sent as clientCreatedAt)
  attempts: number;
  status: "queued" | "syncing" | "conflict";
  error?: { code: string; message: string; status: number };
  /** query keys to refresh once this lands */
  invalidate?: string[][];
}

export const outboxStore = createStore<OutboxItem[]>([]);
export const syncState = createStore<{ syncing: boolean; lastSyncedAt: number | null; lastResult: string | null }>({
  syncing: false,
  lastSyncedAt: null,
  lastResult: null,
});

let loaded = false;
let onLanded: ((item: OutboxItem, result: unknown) => void) | null = null;

export function newIdempotencyKey(kind: string) {
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `desk:${kind}:${rand}`.slice(0, 128);
}

export async function loadOutbox(landed: (item: OutboxItem, result: unknown) => void) {
  onLanded = landed;
  if (loaded) return;
  loaded = true;
  const items = await idb.all<OutboxItem>("outbox");
  // anything left "syncing" by a closed tab goes back in the queue
  outboxStore.set(
    items.map((i) => (i.status === "syncing" ? { ...i, status: "queued" as const } : i)).sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );
}

async function save(item: OutboxItem) {
  outboxStore.set((list) => {
    const i = list.findIndex((x) => x.id === item.id);
    if (i === -1) return [...list, item];
    const next = [...list];
    next[i] = item;
    return next;
  });
  await idb.put("outbox", item);
}

async function remove(id: string) {
  outboxStore.set((list) => list.filter((x) => x.id !== id));
  await idb.delete("outbox", id);
}

export async function enqueue(item: Omit<OutboxItem, "attempts" | "status">) {
  await save({ ...item, attempts: 0, status: "queued" });
}

export async function discard(id: string) {
  await remove(id);
}

export async function retry(id: string) {
  const item = outboxStore.get().find((x) => x.id === id);
  if (!item) return;
  await save({ ...item, status: "queued", error: undefined });
  void syncOutbox();
}

/** 409 IDEMPOTENCY_IN_PROGRESS with details.applied: the action already committed. */
export function isAlreadyApplied(e: unknown) {
  return isApiError(e) && e.code === "IDEMPOTENCY_IN_PROGRESS" && e.details?.applied === true;
}

let running: Promise<void> | null = null;

/** Replay queued actions in the order they happened. Stops at the first network failure. */
export function syncOutbox(): Promise<void> {
  if (running) return running;
  running = (async () => {
    const queue = outboxStore.get().filter((i) => i.status === "queued");
    if (!queue.length || !networkStore.get().online) return;
    syncState.set((s) => ({ ...s, syncing: true }));
    let landed = 0;
    let conflicts = 0;
    for (const item of queue) {
      await save({ ...item, status: "syncing", attempts: item.attempts + 1 });
      try {
        const result = await api<unknown>(item.path, {
          method: item.method,
          body: item.body,
          headers: { "Idempotency-Key": item.id },
        });
        await remove(item.id);
        landed++;
        onLanded?.(item, result);
      } catch (e) {
        const err = e as ApiError;
        if (!isApiError(e) || err.code === "NETWORK") {
          await save({ ...item, status: "queued", attempts: item.attempts + 1 });
          break;
        }
        if (isAlreadyApplied(err)) {
          // the server did the work but never stored its reply: it will not run again,
          // so treat it as landed and let the refetch show the real state
          await remove(item.id);
          landed++;
          onLanded?.(item, null);
          continue;
        }
        if (err.code === "IDEMPOTENCY_IN_PROGRESS") {
          // the first attempt is still running on the server: leave it queued for the next pass
          await save({ ...item, status: "queued", attempts: item.attempts + 1 });
          continue;
        }
        conflicts++;
        await save({
          ...item,
          status: "conflict",
          attempts: item.attempts + 1,
          error: { code: err.code, message: err.message, status: err.status },
        });
      }
    }
    syncState.set({
      syncing: false,
      lastSyncedAt: Date.now(),
      lastResult:
        landed || conflicts
          ? `${landed} synced${conflicts ? `, ${conflicts} need${conflicts === 1 ? "s" : ""} attention` : ""}`
          : null,
    });
  })().finally(() => {
    running = null;
  });
  return running;
}

export function useOutbox() {
  return useStore(outboxStore);
}
export function useSyncState() {
  return useStore(syncState);
}
