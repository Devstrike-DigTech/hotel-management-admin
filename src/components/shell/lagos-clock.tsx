"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { LAGOS_TZ } from "@/lib/format";

/** The front-desk clock: always Lagos time, whatever the device thinks. */
export function LagosClock({ className }: { className?: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = window.setInterval(tick, 15_000);
    return () => window.clearInterval(id);
  }, []);
  const t = now
    ? new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: LAGOS_TZ }).format(now)
    : "--:--";
  return (
    <span
      className={cn("h-8 items-center gap-1.5 rounded-md border border-line px-2.5 text-[12px] text-ink-muted", className)}
      title="Time in Lagos (WAT)"
    >
      <span className="font-mono text-ink" suppressHydrationWarning>
        {t}
      </span>
      <span className="font-mono text-[10px] tracking-[0.12em]">WAT</span>
    </span>
  );
}
