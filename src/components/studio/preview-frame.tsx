"use client";

import { useEffect, useRef, useState } from "react";
import { config } from "@/lib/config";
import { ArrowClockwise, ArrowSquareOut, Desktop, DeviceMobile, DeviceTablet, LockSimple, WarningCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { Segmented, Tip } from "@/components/ui/primitives";

export type Device = "desktop" | "tablet" | "phone";
type PreviewState = "DRAFT" | "EXPIRED" | "NOT_FOUND" | "UNAVAILABLE";
const PREVIEW_STATES: PreviewState[] = ["DRAFT", "EXPIRED", "NOT_FOUND", "UNAVAILABLE"];
export const DEVICE_WIDTH: Record<Device, number> = { desktop: 1280, tablet: 820, phone: 390 };

export function DeviceToggle({ value, onChange, className }: { value: Device; onChange: (d: Device) => void; className?: string }) {
  return (
    <Segmented<Device>
      label="Preview size"
      size="sm"
      value={value}
      onChange={onChange}
      className={className}
      options={[
        { value: "desktop", label: <span className="sr-only xl:not-sr-only">Desktop</span>, icon: <Desktop size={14} /> },
        { value: "tablet", label: <span className="sr-only xl:not-sr-only">Tablet</span>, icon: <DeviceTablet size={14} /> },
        { value: "phone", label: <span className="sr-only xl:not-sr-only">Phone</span>, icon: <DeviceMobile size={14} /> },
      ]}
    />
  );
}

/**
 * The real web app in an iframe at a true device width, scaled to fit the
 * stage. `src` carries the signed, short-lived preview token; `version` bumps
 * after every draft save to reload it.
 */
export function PreviewFrame({
  src,
  device,
  host,
  version,
  busy,
  empty,
  title = "Live preview",
  testId = "preview-frame",
  fit = "width",
  onExpired,
  onRetry,
}: {
  src: string | null;
  device: Device;
  host: string;
  version: number;
  busy?: boolean;
  empty?: React.ReactNode;
  title?: string;
  testId?: string;
  /** "width" fills the stage width; "contain" also fits the height (phone view) */
  fit?: "width" | "contain";
  /** the framed page says its token ran out: mint a new one (the new src reloads the frame) */
  onExpired?: () => void;
  /** try again after NOT_FOUND / UNAVAILABLE */
  onRetry?: () => void;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [loaded, setLoaded] = useState(false);
  const [shown, setShown] = useState(0);
  const [state, setState] = useState<PreviewState | null>(null);
  const handled = useRef<string | null>(null);
  const expired = useRef(onExpired);
  useEffect(() => {
    expired.current = onExpired;
  }, [onExpired]);

  // the framed web page reports what it shows: { type: "site-preview", state, href }
  useEffect(() => {
    let web: string;
    try {
      web = new URL(config.webUrl).origin;
    } catch {
      return;
    }
    const onMessage = (e: MessageEvent) => {
      const frame = stage.current?.querySelector("iframe");
      if (e.origin !== web || !frame || e.source !== frame.contentWindow) return;
      const d = e.data as { type?: string; state?: string; href?: string } | null;
      if (!d || d.type !== "site-preview" || !PREVIEW_STATES.includes(d.state as PreviewState)) return;
      setState(d.state as PreviewState);
      // one fresh token per dead one, so a token that is refused straight away can't loop
      if (d.state === "EXPIRED" && handled.current !== frame.src) {
        handled.current = frame.src;
        expired.current?.();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    // a new draft version or device: show the loading rule until the frame answers
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset per load
    setLoaded(false);
    setState(null);
  }, [src, version, device]);

  const width = DEVICE_WIDTH[device];
  const chrome = device === "desktop" ? 30 : device === "tablet" ? 20 : 0;
  const pad = device === "phone" ? 24 : 32;
  const phoneH = 844;
  const scaleW = box.w ? Math.min(1, (box.w - pad * 2 - (device === "phone" ? 20 : 0)) / width) : 0.5;
  const scale = device === "phone" && fit === "contain" && box.h ? Math.min(scaleW, (box.h - pad * 2 - 20) / phoneH) : scaleW;
  const frameH = device === "phone" ? phoneH : Math.max(480, (box.h - pad * 2) / scale - chrome);
  const url = src ? `${src}${src.includes("?") ? "&" : "?"}v=${version}` : null;

  return (
    <div ref={stage} className="studio-stage relative flex min-h-0 flex-1 items-start justify-center overflow-hidden" data-testid={`${testId}-stage`} data-preview-state={state ?? undefined}>
      {!url ? (
        <div className="grid h-full w-full place-items-center p-8">{empty}</div>
      ) : (
        <div
          className="origin-top"
          style={{ transform: `scale(${scale})`, width: width + (device === "phone" ? 20 : 0), marginTop: pad, transition: "width 220ms ease-out" }}
        >
          <div
            className={cn(
              "overflow-hidden bg-white shadow-[0_30px_80px_-30px_rgb(40_25_10/0.45),0_0_0_1px_rgb(0_0_0/0.08)]",
              device === "phone" ? "rounded-[44px] border-[10px] border-[#191713] p-0" : device === "tablet" ? "rounded-[22px] border-[10px] border-[#191713]" : "rounded-[10px]",
            )}
          >
            {device === "desktop" && (
              <div className="flex h-[30px] items-center gap-2 border-b border-black/10 bg-[#ECE6DB] px-3">
                <span className="flex gap-1.5" aria-hidden>
                  <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
                  <span className="h-2.5 w-2.5 rounded-full bg-black/15" />
                </span>
                <span className="mx-auto flex h-[20px] min-w-0 max-w-[460px] flex-1 items-center justify-center gap-1.5 rounded-[5px] bg-white/80 px-3 font-mono text-[11.5px] text-black/60">
                  <LockSimple size={10} weight="bold" /> {host}
                </span>
                <span className="w-[46px]" />
              </div>
            )}
            {device === "phone" && <div className="mx-auto h-[22px] w-[120px] rounded-b-[14px] bg-[#191713]" aria-hidden />}
            <iframe
              key={`${device}-${version}`}
              title={title}
              src={url}
              data-testid={testId}
              onLoad={() => {
                setLoaded(true);
                setShown(version);
              }}
              style={{ width, height: frameH, display: "block", border: 0, marginTop: device === "phone" ? -22 : 0 }}
              className="bg-white"
            />
          </div>
        </div>
      )}
      {url && (!loaded || busy) && (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] overflow-hidden" aria-hidden>
          <div className="h-full w-1/3 animate-[studio-load_1.1s_ease-in-out_infinite] bg-laterite" />
        </div>
      )}
      {url && (state === "NOT_FOUND" || state === "UNAVAILABLE" || state === "EXPIRED") && (
        <div role="status" className="absolute left-3 top-3 flex max-w-[calc(100%-24px)] items-center gap-2.5 rounded-md border border-[color-mix(in_oklab,var(--ochre)_40%,transparent)] bg-surface px-3 py-2 text-[12.5px] text-ink shadow-float" data-testid={`${testId}-notice`}>
          <WarningCircle size={15} weight="fill" className="shrink-0 text-ochre" />
          <span className="min-w-0">
            {state === "EXPIRED" ? "The preview link ran out; opening a fresh one." : state === "NOT_FOUND" ? "The preview couldn't find this draft." : "The draft preview isn't available right now."}
          </span>
          {state !== "EXPIRED" && onRetry && (
            <button type="button" onClick={() => { handled.current = null; onRetry(); }} className="shrink-0 font-medium text-laterite hover:underline">
              Retry
            </button>
          )}
        </div>
      )}
      {url && (
        <div className="absolute bottom-3 right-3 flex gap-1.5">
          <Tip content="Reload the preview">
            <button
              type="button"
              aria-label="Reload the preview"
              onClick={() => {
                setLoaded(false);
                const f = stage.current?.querySelector("iframe");
                if (f) f.src = url;
              }}
              className="grid h-8 w-8 place-items-center rounded-md border border-line bg-surface text-ink-muted shadow-float hover:text-ink"
            >
              <ArrowClockwise size={14} />
            </button>
          </Tip>
          <Tip content="Open the preview in a new tab">
            <a href={url} target="_blank" rel="noreferrer" aria-label="Open the preview in a new tab" className="grid h-8 w-8 place-items-center rounded-md border border-line bg-surface text-ink-muted shadow-float hover:text-ink">
              <ArrowSquareOut size={14} />
            </a>
          </Tip>
        </div>
      )}
      <span className="sr-only" aria-live="polite">
        {loaded && shown === version ? "Preview updated" : ""}
      </span>
    </div>
  );
}
