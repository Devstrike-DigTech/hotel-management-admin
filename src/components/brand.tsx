import { config } from "@/lib/config";
import { cn } from "@/lib/cn";

/** The key-fob silhouette shared by the logo mark and the key rack. 44 x 64 box. */
export const FOB_PATH =
  "M9 3.5 H35 Q40.5 3.5 40.5 9 V41 Q40.5 46.5 35.8 49.6 L25.2 57.6 Q22 60 18.8 57.6 L8.2 49.6 Q3.5 46.5 3.5 41 V9 Q3.5 3.5 9 3.5 Z";

export function LogoMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size * 0.72}
      height={size}
      viewBox="0 0 44 64"
      aria-hidden
      className={cn("shrink-0", className)}
    >
      <path d={FOB_PATH} fill="var(--laterite)" />
      <circle cx="22" cy="13" r="4.2" fill="var(--paper)" />
      <path d="M11 25 H33 M11 31 H33" stroke="var(--laterite-ink)" strokeOpacity="0.55" strokeWidth="1.4" />
      <path d="M22 37 L27 42 L22 47 L17 42 Z" fill="none" stroke="var(--laterite-ink)" strokeOpacity="0.8" strokeWidth="1.4" />
    </svg>
  );
}

export function Wordmark({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const text = size === "lg" ? "text-[28px]" : size === "sm" ? "text-[17px]" : "text-[21px]";
  const mark = size === "lg" ? 34 : size === "sm" ? 22 : 26;
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={mark} />
      <span
        className={cn("display-sm leading-none tracking-tight text-ink", text)}
        style={{ fontVariationSettings: '"opsz" 72, "SOFT" 100, "WONK" 1', fontWeight: 500 }}
      >
        {config.appName}
      </span>
    </span>
  );
}

/**
 * The hotel's own mark for white-labelled tenants: their logo when they have
 * one, else a monogram ring in the ink colour. No platform name anywhere.
 */
export function TenantMark({ name, logoUrl, size = 26, className }: { name: string; logoUrl?: string | null; size?: number; className?: string }) {
  if (logoUrl)
    // eslint-disable-next-line @next/next/no-img-element -- tenant-supplied logo on any host
    return <img src={logoUrl} alt="" style={{ height: size, maxWidth: size * 3.2 }} className={cn("shrink-0 object-contain", className)} />;
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
      <TenantMark name={name} logoUrl={logoUrl} size={logoUrl ? 24 : 26} />
      {!logoUrl && (
        <span className="display-sm truncate text-[16px] leading-tight text-ink" style={{ fontVariationSettings: '"opsz" 48, "SOFT" 100', fontWeight: 500 }}>
          {name}
        </span>
      )}
    </span>
  );
}
