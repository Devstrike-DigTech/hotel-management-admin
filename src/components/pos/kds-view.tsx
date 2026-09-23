"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowsOut, SpeakerHigh, SpeakerSlash, WifiSlash } from "@phosphor-icons/react";
import { posApi } from "@/lib/api/endpoints-m5";
import { qk5, useKds } from "@/lib/api/hooks-m5";
import type { KdsTicketWire } from "@/lib/api/types-m5";
import { useNetwork } from "@/lib/offline/network";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/store";
import { useNow } from "@/lib/use-now";
import { LogoMark } from "@/components/brand";
import { Skeleton } from "@/components/ui/primitives";
import { usePropertyScope } from "@/components/shell/property-switcher";
import { KdsBoard } from "./kds-board";
import { kdsFromWire } from "./adapters";
import type { KdsTicket } from "./model";

const SOUND_KEY = "admin.kds.sound";
const STATION_KEY = "admin.kds.station";
type Station = "ALL" | "KITCHEN" | "BAR";

/** A two-note chime from the Web Audio API (no file to load); quiet enough for a kitchen radio to win. */
function chime() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const note = (f: number, t: number) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.55);
    };
    note(880, 0);
    note(1318.5, 0.18);
    window.setTimeout(() => void ctx.close(), 1200);
  } catch {
    /* no audio: fine */
  }
}

export function KdsView() {
  const qc = useQueryClient();
  const net = useNetwork();
  const scope = usePropertyScope();
  const now = useNow(1000);
  const [station, setStationState] = useState<Station>("ALL");
  const [sound, setSound] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- read the screen's saved preferences
      setSound(localStorage.getItem(SOUND_KEY) === "1");
      const s = localStorage.getItem(STATION_KEY) as Station | null;
      if (s === "KITCHEN" || s === "BAR" || s === "ALL") setStationState(s);
    } catch {
      /* ignore */
    }
  }, []);
  // the kitchen screen is always dark: legible from the pass, easy on the eyes at night
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.dataset.theme;
    html.dataset.theme = "dark";
    return () => {
      if (prev) html.dataset.theme = prev;
    };
  }, []);

  const setStation = (s: Station) => {
    setStationState(s);
    try {
      localStorage.setItem(STATION_KEY, s);
    } catch {
      /* ignore */
    }
  };
  const q = useKds({ station: station === "ALL" ? undefined : station });
  const tickets: KdsTicket[] = useMemo(() => (q.data ?? []).map(kdsFromWire), [q.data]);

  // chime for tickets we have not seen before (not on the first load)
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!q.data) return;
    const ids = new Set(q.data.filter((t) => t.status === "NEW").map((t) => t.id));
    if (seen.current) {
      const fresh = [...ids].some((id) => !seen.current!.has(id));
      if (fresh && sound) chime();
    }
    seen.current = new Set([...(seen.current ?? []), ...ids]);
  }, [q.data, sound]);

  const [busy, setBusy] = useState<string | null>(null);
  const move = useMutation({
    mutationFn: async ({ t, back }: { t: KdsTicket; back?: boolean }) => {
      setBusy(t.id);
      if (back) return posApi.kdsStatus(t.id, t.status === "READY" ? "PREPARING" : "NEW");
      if (t.status === "NEW") return posApi.kdsStatus(t.id, "PREPARING");
      return posApi.kdsBump(t.id);
    },
    onMutate: async ({ t, back }) => {
      // optimistic: the cook sees the ticket move at once
      const key = qk5.kds({ station: station === "ALL" ? undefined : station });
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<KdsTicketWire[]>(key);
      const next: KdsTicketWire["status"] = back ? (t.status === "READY" ? "PREPARING" : "NEW") : t.status === "NEW" ? "PREPARING" : t.status === "PREPARING" ? "READY" : "SERVED";
      qc.setQueryData<KdsTicketWire[]>(key, (list) => (list ?? []).map((x) => (x.id === t.id ? { ...x, status: next } : x)).filter((x) => x.status !== "SERVED"));
      return { prev, key };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(ctx.key, ctx.prev);
      toast.error("Not moved", "Check the connection and tap again.");
    },
    onSettled: () => {
      setBusy(null);
      void qc.invalidateQueries({ queryKey: ["kds"] });
    },
    meta: { silent: true },
  });

  const counts = { NEW: 0, PREPARING: 0, READY: 0 } as Record<string, number>;
  for (const t of tickets) counts[t.status] = (counts[t.status] ?? 0) + 1;
  const late = tickets.filter((t) => t.status !== "READY" && now - Date.parse(t.createdAt) > 18 * 60_000).length;

  return (
    <div className="flex h-dvh flex-col gap-3 overflow-hidden bg-paper p-3 text-ink">
      <header className="flex shrink-0 flex-wrap items-center gap-2 sm:gap-3">
        <Link href="/pos" className="flex h-12 items-center gap-2 rounded-md px-2 text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Back to the till">
          <ArrowLeft size={18} />
          <LogoMark size={24} />
        </Link>
        <div>
          <h1 className="display-sm text-[24px] leading-none text-ink">Kitchen display</h1>
          <p className="mt-1 text-[12.5px] text-ink-muted">{scope.current?.name}</p>
        </div>
        <div role="radiogroup" aria-label="Station" className="ml-2 inline-flex rounded-md border border-line bg-surface p-1">
          {(["ALL", "KITCHEN", "BAR"] as Station[]).map((s) => (
            <button key={s} role="radio" aria-checked={station === s} onClick={() => setStation(s)} className={cn("h-11 rounded-sm px-4 text-[16px] font-medium", station === s ? "bg-ink text-paper" : "text-ink-muted hover:text-ink")}>
              {s === "ALL" ? "All" : s === "KITCHEN" ? "Kitchen" : "Bar"}
            </button>
          ))}
        </div>
        {late > 0 && <span className="inline-flex h-11 items-center rounded-md border border-[color-mix(in_oklab,var(--danger)_45%,transparent)] bg-danger-wash px-3 font-mono text-[16px] text-danger">{late} late</span>}
        {!net.online && (
          <span className="inline-flex h-11 items-center gap-2 rounded-md border border-[color-mix(in_oklab,var(--ochre)_45%,transparent)] bg-ochre-wash px-3 text-[14px] text-ochre">
            <WifiSlash size={18} weight="bold" /> Offline: showing the last tickets
          </span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              const v = !sound;
              setSound(v);
              if (v) chime();
              try {
                localStorage.setItem(SOUND_KEY, v ? "1" : "0");
              } catch {
                /* ignore */
              }
            }}
            aria-pressed={sound}
            className={cn("inline-flex h-11 items-center gap-2 rounded-md border px-3 text-[14px] font-medium", sound ? "border-palm bg-palm-wash text-palm" : "border-line-strong text-ink-muted")}
          >
            {sound ? <SpeakerHigh size={20} weight="duotone" /> : <SpeakerSlash size={20} weight="duotone" />}
            <span className="hidden sm:inline">{sound ? "Chime on" : "Chime off"}</span>
          </button>
          <button
            type="button"
            onClick={() => (document.fullscreenElement ? void document.exitFullscreen() : void document.documentElement.requestFullscreen?.().catch(() => undefined))}
            className="hidden h-11 w-11 place-items-center rounded-md border border-line-strong text-ink-muted hover:text-ink sm:grid"
            aria-label="Full screen"
          >
            <ArrowsOut size={20} />
          </button>
          <span className="font-mono text-[28px] tabular-nums text-ink" suppressHydrationWarning>
            {new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" }).format(now)}
          </span>
        </div>
      </header>
      {q.isLoading ? (
        <div className="grid flex-1 grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <div className="hidden min-h-0 flex-1 md:flex">
            <KdsBoard tickets={tickets} now={now} onAdvance={(t) => move.mutate({ t })} onRecall={(t) => move.mutate({ t, back: true })} busyId={busy} />
          </div>
          <div className="scrollbar-thin flex min-h-0 flex-1 overflow-y-auto md:hidden">
            <KdsBoard tickets={tickets} now={now} onAdvance={(t) => move.mutate({ t })} onRecall={(t) => move.mutate({ t, back: true })} busyId={busy} compact />
          </div>
        </>
      )}
      <p className="sr-only" aria-live="polite">
        {counts.NEW} new, {counts.PREPARING} cooking, {counts.READY} ready
      </p>
    </div>
  );
}
