"use client";

import { useEffect, useRef, useState } from "react";

const EMAIL_W = 620; // emails are laid out for ~600px; render at that width and scale down to fit

/**
 * Renders an email's HTML in a sandboxed iframe: no scripts, no same-origin,
 * no forms; links open (if at all) in a new tab. A strict CSP inside the
 * document backs up the sandbox. On narrow screens the frame is laid out at
 * email width and scaled down, so the preview matches what a mail client shows.
 */
export function EmailFrame({ html, title, className }: { html: string; title: string; className?: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(EMAIL_W);
  const H = 620;
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=${EMAIL_W}"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com;"><base target="_blank"><style>html,body{margin:0}</style></head><body>${html}</body></html>`;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = Math.min(1, w / EMAIL_W);
  const frameW = scale < 1 ? EMAIL_W : w;
  return (
    <div ref={wrap} className={className} style={{ height: H * scale, overflow: "hidden", background: "#fff" }}>
      <iframe
        title={title}
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        srcDoc={doc}
        style={{ width: frameW, height: H, border: 0, display: "block", transform: `scale(${scale})`, transformOrigin: "0 0" }}
      />
    </div>
  );
}
