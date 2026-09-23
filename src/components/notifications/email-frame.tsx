"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Renders an email's HTML in a sandboxed iframe: no scripts, no same-origin,
 * no forms, links open (if at all) in a new tab. Height follows the content
 * where the sandbox allows reading it; otherwise a fixed, scrollable frame.
 */
export function EmailFrame({ html, title, className }: { html: string; title: string; className?: string }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(520);
  // A strict CSP inside the document too, belt and braces with the sandbox.
  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com;"><base target="_blank"><style>html,body{margin:0}</style></head><body>${html}</body></html>`;

  useEffect(() => {
    // Without allow-same-origin the frame's DOM is unreadable; keep a sensible height by width.
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setH(e.contentRect.width < 480 ? 640 : 560));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <iframe
      ref={ref}
      title={title}
      sandbox="allow-popups allow-popups-to-escape-sandbox"
      referrerPolicy="no-referrer"
      srcDoc={doc}
      className={className}
      style={{ width: "100%", height: h, border: 0, background: "#fff", display: "block" }}
    />
  );
}
