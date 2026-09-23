"use client";

import { onlineManager, type QueryClient, type QueryKey } from "@tanstack/react-query";
import { idb } from "./idb";
import { networkStore } from "./network";

/**
 * Keep the last-known copy of the queries a desk needs when the line drops
 * (Today, rooms, the tape chart, the current shift ...) in IndexedDB, and
 * restore them on start so a reload while offline still shows the house.
 */
const PERSISTED: QueryKey[] = [
  ["me"],
  ["dashboard"],
  ["rooms"],
  ["room-types"],
  ["property"],
  ["front-desk", "today"],
  ["tape-chart"],
  ["shifts", "current"],
  ["tax-settings"],
  ["reservations", "detail"],
  ["folio"],
  ["housekeeping", "mine"],
];

const matches = (key: QueryKey) =>
  PERSISTED.some((p) => p.every((part, i) => JSON.stringify(key[i]) === JSON.stringify(part)));

interface CacheRow {
  key: string;
  queryKey: QueryKey;
  data: unknown;
  updatedAt: number;
}

const MAX_AGE = 3 * 24 * 3600_000;

export function setupQueryPersistence(qc: QueryClient) {
  // TanStack pauses queries while we are offline instead of failing them.
  onlineManager.setEventListener((setOnline) => networkStore.subscribe(() => setOnline(networkStore.get().online)));

  void idb.all<CacheRow>("cache").then((rows) => {
    const now = Date.now();
    for (const r of rows) {
      if (now - r.updatedAt > MAX_AGE) {
        void idb.delete("cache", r.key);
        continue;
      }
      if (qc.getQueryData(r.queryKey) === undefined) qc.setQueryData(r.queryKey, r.data, { updatedAt: r.updatedAt });
    }
  });

  const pending = new Map<string, CacheRow>();
  let timer: number | null = null;
  const flush = () => {
    timer = null;
    for (const row of pending.values()) void idb.put("cache", row);
    pending.clear();
  };

  return qc.getQueryCache().subscribe((ev) => {
    if (ev.type !== "updated" || ev.action.type !== "success") return;
    const { queryKey } = ev.query;
    if (!matches(queryKey)) return;
    const key = JSON.stringify(queryKey);
    pending.set(key, { key, queryKey, data: ev.query.state.data, updatedAt: ev.query.state.dataUpdatedAt });
    if (timer === null) timer = window.setTimeout(flush, 800);
  });
}

export function clearPersistedQueries() {
  return idb.clear("cache");
}
