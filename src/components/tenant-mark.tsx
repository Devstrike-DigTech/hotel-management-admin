"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * The hotel's own mark for white-labelled tenants: their logo when they have
 * one, else a monogram ring in the ink colour. No platform name anywhere.
 */
export function TenantMark({ name, logoUrl, size = 26, className }: { name: string; logoUrl?: string | null; size?: number; className?: string }) {
  const [broken, setBroken] = useState<string | null>(null);
  if (logoUrl && broken !== logoUrl)
    // eslint-disable-next-line @next/next/no-img-element -- tenant-supplied logo on any host
    return <img src={logoUrl} alt="" onError={() => setBroken(logoUrl)} style={{ height: size, maxWidth: size * 3.2 }} className={cn("shrink-0 object-contain", className)} />;
  const initials = name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !["the", "and", "of"].includes(w.toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      aria-hidden
      className={cn("grid shrink-0 place-items-center rounded-full border border-ink/70 font-display font-medium text-ink", className)}
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initials}
    </span>
  );
}

export function TenantWordmark({ name, logoUrl, className }: { name: string; logoUrl?: string | null; className?: string }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)} data-testid="tenant-wordmark">
      <TenantMark name={name} logoUrl={logoUrl} size={26} />
      <span className="display-sm truncate text-[16px] leading-tight text-ink" style={{ fontVariationSettings: '"opsz" 48, "SOFT" 100', fontWeight: 500 }}>
        {name}
      </span>
    </span>
  );
}
