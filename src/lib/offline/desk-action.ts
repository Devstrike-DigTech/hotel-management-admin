"use client";

import { api, isApiError } from "@/lib/api/client";
import { enqueue, newIdempotencyKey, type OutboxKind } from "./outbox";
import { networkStore } from "./network";

export type DeskResult<T> = { queued: false; result: T } | { queued: true; id: string };

/**
 * Run an offline-capable desk action. It always carries an Idempotency-Key and
 * clientCreatedAt. When the device is offline (or the request dies on the
 * network) and the plan includes offline mode, the action goes to the outbox
 * with the same key and syncs later.
 */
export async function deskAction<T>(opts: {
  kind: OutboxKind;
  title: string;
  subtitle?: string;
  method: "POST" | "PATCH" | "PUT";
  path: string;
  body: Record<string, unknown>;
  offlineAllowed: boolean;
  invalidate?: string[][];
}): Promise<DeskResult<T>> {
  const id = newIdempotencyKey(opts.kind);
  const createdAt = new Date().toISOString();
  const body = { ...opts.body, clientCreatedAt: createdAt };
  const queue = async () => {
    await enqueue({
      id,
      kind: opts.kind,
      title: opts.title,
      subtitle: opts.subtitle,
      method: opts.method,
      path: opts.path,
      body,
      createdAt,
      invalidate: opts.invalidate,
    });
    return { queued: true as const, id };
  };
  if (!networkStore.get().online && opts.offlineAllowed) return queue();
  try {
    const result = await api<T>(opts.path, { method: opts.method, body, headers: { "Idempotency-Key": id } });
    return { queued: false, result };
  } catch (e) {
    if (isApiError(e) && e.code === "NETWORK" && opts.offlineAllowed) return queue();
    throw e;
  }
}
