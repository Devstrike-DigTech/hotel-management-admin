"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowClockwise,
  Broom,
  CloudArrowUp,
  CloudSlash,
  Door,
  Money,
  SignIn,
  Trash,
  WarningCircle,
  WifiSlash,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { formatTime, relativeTime } from "@/lib/format";
import { toast } from "@/lib/store";
import { useEntitlements } from "@/lib/auth";
import { startNetworkWatch, useNetwork } from "@/lib/offline/network";
import {
  discard,
  loadOutbox,
  retry,
  syncOutbox,
  useOutbox,
  useSyncState,
  type OutboxItem,
  type OutboxKind,
} from "@/lib/offline/outbox";
import { Sheet } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState } from "@/components/ui/primitives";

const KIND: Record<OutboxKind, { label: string; icon: React.ReactNode }> = {
  "check-in": { label: "Check-in", icon: <SignIn size={16} weight="duotone" /> },
  payment: { label: "Payment", icon: <Money size={16} weight="duotone" /> },
  "room-status": { label: "Room status", icon: <Broom size={16} weight="duotone" /> },
  "check-out": { label: "Check-out", icon: <Door size={16} weight="duotone" /> },
  housekeeping: { label: "Housekeeping", icon: <Broom size={16} weight="duotone" /> },
};

/** Mount once inside the hotel shell: network watch, outbox load, auto-sync, service worker. */
export function OfflineRuntime() {
  const qc = useQueryClient();
  const net = useNetwork();
  const items = useOutbox();
  const queued = items.filter((i) => i.status === "queued").length;

  useEffect(() => {
    startNetworkWatch();
    void loadOutbox((item) => {
      for (const key of item.invalidate ?? []) void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["front-desk"] });
      void qc.invalidateQueries({ queryKey: ["rooms"] });
      void qc.invalidateQueries({ queryKey: ["tape-chart"] });
      void qc.invalidateQueries({ queryKey: ["shifts"] });
    });
  }, [qc]);

  // sync when we come back, and keep trying while there is a queue
  useEffect(() => {
    if (!net.online || !queued) return;
    const run = () => void syncOutbox();
    run();
    const id = window.setInterval(run, 20_000);
    return () => window.clearInterval(id);
  }, [net.online, queued]);

  // announce reconnection results
  const sync = useSyncState();
  const [lastAnnounced, setLastAnnounced] = useState<number | null>(null);
  useEffect(() => {
    if (sync.lastSyncedAt && sync.lastSyncedAt !== lastAnnounced && sync.lastResult) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- remember which sync we already announced
      setLastAnnounced(sync.lastSyncedAt);
      toast.success("Back online", `Outbox: ${sync.lastResult}.`);
    }
  }, [sync.lastSyncedAt, sync.lastResult, lastAnnounced]);

  // service worker: production builds only (dev HMR and a caching worker don't mix)
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
  }, []);

  return null;
}

export function OfflineBanner() {
  const net = useNetwork();
  const items = useOutbox();
  const { has } = useEntitlements();
  const [open, setOpen] = useState(false);
  if (net.online) return null;
  const offlineMode = has("offline_mode");
  return (
    <>
      <div role="status" className="border-b border-[color-mix(in_oklab,var(--ochre)_40%,transparent)] bg-ochre-wash">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:px-6 lg:px-10">
          <WifiSlash size={18} weight="duotone" className="shrink-0 text-ochre" />
          <p className="min-w-0 flex-1 text-[13px] text-ink">
            <strong className="font-medium">Working offline</strong>
            <span className="text-ink-muted" suppressHydrationWarning>
              {" "}
              since {formatTime(new Date(net.since).toISOString())}.{" "}
              {offlineMode
                ? "Check-ins, payments, room status and check-outs are saved on this device and sync when the line returns."
                : "Changes can't be saved until the connection returns. Offline mode keeps the desk running on every plan that includes it."}
            </span>
          </p>
          {items.length > 0 && (
            <button onClick={() => setOpen(true)} className="text-[13px] font-medium text-ochre underline underline-offset-4">
              {items.length} queued
            </button>
          )}
        </div>
      </div>
      <SyncSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

/** Top-bar chip: queued count, syncing state, conflicts. Opens the sync sheet. */
export function OutboxChip({ className }: { className?: string }) {
  const items = useOutbox();
  const net = useNetwork();
  const sync = useSyncState();
  const [open, setOpen] = useState(false);
  const conflicts = items.filter((i) => i.status === "conflict").length;
  if (!items.length && net.online && !open) return null;
  const tone = conflicts ? "danger" : !net.online ? "ochre" : "brass";
  const color = `var(--${tone})`;
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        data-testid="outbox-chip"
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-full border pl-2 pr-2.5 text-[12.5px] font-medium transition-colors",
          className,
        )}
        style={{
          color,
          borderColor: `color-mix(in oklab, ${color} 40%, transparent)`,
          background: `color-mix(in oklab, ${color} 10%, var(--surface))`,
        }}
        aria-label={`${items.length} actions waiting to sync${conflicts ? `, ${conflicts} need attention` : ""}`}
      >
        {sync.syncing ? (
          <ArrowClockwise size={15} weight="bold" className="animate-spin [animation-duration:1.2s]" />
        ) : !net.online ? (
          <CloudSlash size={15} weight="duotone" />
        ) : conflicts ? (
          <WarningCircle size={15} weight="duotone" />
        ) : (
          <CloudArrowUp size={15} weight="duotone" />
        )}
        {items.length > 0 && <span className="font-mono">{items.length}</span>}
        <span className={items.length ? "hidden sm:inline" : undefined}>
          {!net.online ? (items.length ? "queued offline" : "Offline") : conflicts ? "to review" : "queued"}
        </span>
      </button>
      <SyncSheet open={open} onOpenChange={setOpen} />
    </>
  );
}

export function SyncSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const items = useOutbox();
  const net = useNetwork();
  const sync = useSyncState();
  const conflicts = items.filter((i) => i.status === "conflict");
  const queued = items.filter((i) => i.status !== "conflict");
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={
        <span className="flex items-center gap-2">
          <span className={cn("h-1.5 w-1.5 rounded-full", net.online ? "bg-palm" : "bg-ochre")} />
          {net.online ? "Online" : "Offline"}
        </span>
      }
      title="Outbox"
      description="Desk actions saved on this device. Each one carries its own key, so a replay never applies twice."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="flex-1 sm:flex-none">
            Close
          </Button>
          <Button
            onClick={() => void syncOutbox()}
            disabled={!net.online || !queued.length}
            loading={sync.syncing}
            className="flex-1 sm:ml-auto sm:flex-none"
          >
            <ArrowClockwise size={15} weight="bold" /> Sync now
          </Button>
        </>
      }
    >
      {!items.length ? (
        <EmptyState
          compact
          glyph="river"
          title="Nothing waiting"
          body={sync.lastSyncedAt ? `Last synced ${relativeTime(new Date(sync.lastSyncedAt).toISOString())}.` : "Everything is saved on the server."}
        />
      ) : (
        <div className="flex flex-col gap-6">
          {conflicts.length > 0 && (
            <section>
              <p className="eyebrow mb-2 text-danger">Needs attention &middot; {conflicts.length}</p>
              <ul className="flex flex-col gap-2">
                {conflicts.map((i) => (
                  <OutboxRow key={i.id} item={i} />
                ))}
              </ul>
            </section>
          )}
          {queued.length > 0 && (
            <section>
              <p className="eyebrow mb-2">Waiting to sync &middot; {queued.length}</p>
              <ul className="flex flex-col gap-2">
                {queued.map((i) => (
                  <OutboxRow key={i.id} item={i} />
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </Sheet>
  );
}

function OutboxRow({ item }: { item: OutboxItem }) {
  const k = KIND[item.kind];
  const conflict = item.status === "conflict";
  return (
    <li
      className={cn(
        "relative rounded-md border bg-surface px-3.5 py-3",
        conflict ? "border-[color-mix(in_oklab,var(--danger)_35%,transparent)]" : "border-line",
      )}
    >
      <div className="flex items-start gap-3">
        <span className={cn("mt-0.5", conflict ? "text-danger" : "text-ink-muted")}>{k.icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[13.5px] font-medium text-ink">{item.title}</p>
            {item.status === "syncing" && <Badge tone="brass">syncing</Badge>}
          </div>
          {item.subtitle && <p className="truncate text-[12.5px] text-ink-muted">{item.subtitle}</p>}
          <p className="mt-1 font-mono text-[11px] text-ink-faint">
            {k.label} &middot; at the desk {formatTime(item.createdAt)} &middot; {item.attempts} {item.attempts === 1 ? "try" : "tries"}
          </p>
          {conflict && item.error && (
            <p className="mt-2 rounded-sm bg-danger-wash px-2.5 py-1.5 text-[12.5px] text-danger">
              <span className="font-mono text-[11px]">{item.error.code}</span> &middot; {item.error.message}
            </p>
          )}
        </div>
      </div>
      {conflict && (
        <div className="mt-3 flex justify-end gap-2">
          {item.error?.code === "SHIFT_REQUIRED" && (
            <a href="/shifts" className="mr-auto inline-flex h-8 items-center text-[12.5px] font-medium text-laterite underline-offset-4 hover:underline">
              Open my shift, then retry
            </a>
          )}
          <Button size="sm" variant="ghost" onClick={() => void discard(item.id)}>
            <Trash size={14} /> Discard
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void retry(item.id)}>
            <ArrowClockwise size={14} /> Retry
          </Button>
        </div>
      )}
    </li>
  );
}
