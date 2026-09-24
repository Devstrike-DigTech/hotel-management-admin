"use client";

import { useEffect, useId } from "react";
import { ArrowRight, Buildings, CheckCircle, Key, WarningCircle, XCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { BRAND_FONTS, contrastRatio, fontNote, grade, inkOn, loadGoogleFont, parseHex, type BrandFont } from "@/lib/m6-catalog";

export interface BrandDraft {
  displayName: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  accentColor: string;
  headingFont: string;
  bodyFont: string;
}

/* ---------- contrast readout ---------- */

export function ContrastReadout({ fg, bg, label, testId }: { fg: string; bg: string; label: string; testId?: string }) {
  const r = contrastRatio(fg, bg);
  const g = grade(r);
  const ok = g === "AA" || g === "AAA";
  const Icon = ok ? CheckCircle : g === "AA large" ? WarningCircle : XCircle;
  return (
    <div className="flex items-center gap-2.5 text-[12.5px]" data-testid={testId} data-grade={g}>
      <span aria-hidden className="grid h-7 w-10 shrink-0 place-items-center rounded-xs border border-line font-medium" style={{ background: bg, color: fg }}>
        Aa
      </span>
      <span className="min-w-0 flex-1 text-ink-muted">{label}</span>
      <span className="font-mono text-ink">{r ? `${r.toFixed(2)}:1` : "--"}</span>
      <span className={cn("inline-flex items-center gap-1 font-medium", ok ? "text-palm" : g === "AA large" ? "text-ochre" : "text-danger")}>
        <Icon size={14} weight="fill" />
        {g}
      </span>
    </div>
  );
}

/* ---------- colour field ---------- */

export function ColorField({ label, value, onChange, hint, testId, disabled }: { label: string; value: string; onChange: (v: string) => void; hint?: string; testId?: string; disabled?: boolean }) {
  const id = useId();
  const valid = !!parseHex(value);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-ink">
        {label}
      </label>
      <div className={cn("flex h-10 items-stretch overflow-hidden rounded-md border bg-surface focus-within:border-laterite", valid ? "border-line-strong" : "border-danger")}>
        <span className="relative w-11 shrink-0 border-r border-line" style={{ background: valid ? value : "transparent" }}>
          <input
            type="color"
            aria-label={`${label} picker`}
            value={valid ? normalise(value) : "#000000"}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            disabled={disabled}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </span>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value.startsWith("#") ? e.target.value : `#${e.target.value}`)}
          className="min-w-0 flex-1 bg-transparent px-3 font-mono text-[14px] uppercase text-ink outline-none"
          maxLength={7}
          spellCheck={false}
          aria-invalid={!valid}
          disabled={disabled}
          data-testid={testId}
        />
      </div>
      {!valid ? <p className="text-[12px] text-danger">Use a hex colour such as #22324F.</p> : hint ? <p className="text-[12px] text-ink-muted">{hint}</p> : null}
    </div>
  );
}

function normalise(v: string) {
  const rgb = parseHex(v);
  if (!rgb) return "#000000";
  return `#${rgb.map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

/* ---------- font chooser ---------- */

export function FontChooser({ role, value, onChange, fonts, disabled }: { role: "heading" | "body"; value: string; onChange: (v: string) => void; fonts?: BrandFont[]; disabled?: boolean }) {
  const all = fonts?.length ? fonts : BRAND_FONTS;
  // headings: serif and display faces first; body: the sans faces plus the reading serifs
  const list = role === "heading" ? all.filter((f) => f.category !== "sans") : all.filter((f) => f.category === "sans" || ["Lora", "Libre Baskerville"].includes(f.family));
  useEffect(() => {
    list.forEach((f) => loadGoogleFont(f.family, f.googleFontsUrl));
  }, [list]);
  return (
    <div role="radiogroup" aria-label={role === "heading" ? "Heading font" : "Body font"} className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-4">
      {list.map((f) => {
        const on = f.family === value;
        return (
          <button
            key={f.family}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={disabled}
            onClick={() => onChange(f.family)}
            data-font={f.family}
            className={cn(
              "flex min-w-0 flex-col items-start gap-1 rounded-md border px-3 py-2.5 text-left transition-colors disabled:opacity-60",
              on ? "border-ink bg-surface shadow-[0_0_0_1px_var(--ink)]" : "border-line bg-surface hover:border-line-strong",
            )}
          >
            <span className="text-[26px] leading-none text-ink" style={{ fontFamily: `"${f.family}", ${f.category === "sans" ? "sans-serif" : "serif"}` }}>
              {role === "heading" ? "Aa" : "Ag"}
            </span>
            <span className="w-full truncate text-[12.5px] font-medium text-ink">{f.family}</span>
            <span className="w-full truncate text-[11px] text-ink-muted">{f.note ?? fontNote(f.family) ?? f.category}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- live previews ---------- */

function Logo({ b, size = 28, light }: { b: BrandDraft; size?: number; light?: boolean }) {
  if (b.logoUrl)
    // eslint-disable-next-line @next/next/no-img-element -- tenant-supplied URL on any host
    return <img src={b.logoUrl} alt="" style={{ height: size, maxWidth: size * 4 }} className="object-contain" />;
  const initials = b.displayName
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w) && !["the", "and", "&"].includes(w.toLowerCase()))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full border font-medium"
      style={{ width: size, height: size, fontSize: size * 0.4, borderColor: light ? "rgba(255,255,255,.5)" : b.primaryColor, color: light ? "#fff" : b.primaryColor, fontFamily: `"${b.headingFont}", serif` }}
    >
      {initials || <Buildings size={size * 0.5} />}
    </span>
  );
}

/** The staff sign-in page as it will look at the hotel's own staff host. */
function useBrandFonts(b: BrandDraft, fonts?: BrandFont[]) {
  useEffect(() => {
    const url = (f: string) => fonts?.find((x) => x.family === f)?.googleFontsUrl;
    loadGoogleFont(b.headingFont, url(b.headingFont));
    loadGoogleFont(b.bodyFont, url(b.bodyFont));
  }, [b.headingFont, b.bodyFont, fonts]);
}

export function StaffLoginPreview({ b, host, sso, fonts }: { b: BrandDraft; host?: string | null; sso?: string | null; fonts?: BrandFont[] }) {
  useBrandFonts(b, fonts);
  const onPrimary = inkOn(b.primaryColor);
  return (
    <figure className="overflow-hidden rounded-md border border-line bg-[#fbf8f2] text-[#1b1a17] shadow-[0_1px_0_var(--line)]" data-testid="login-preview">
      <div className="flex items-center gap-1.5 border-b border-black/10 bg-[#ede6da] px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-black/15" />
        <span className="h-2 w-2 rounded-full bg-black/15" />
        <span className="h-2 w-2 rounded-full bg-black/15" />
        <span className="ml-2 truncate rounded-xs bg-white/70 px-2 py-0.5 font-mono text-[10.5px] text-black/60">{host || "staff.yourhotel.com"}/login</span>
      </div>
      <div className="grid grid-cols-[0.9fr_1fr]" style={{ fontFamily: `"${b.bodyFont}", sans-serif` }}>
        <div className="relative flex min-h-[250px] flex-col justify-between overflow-hidden p-4" style={{ background: b.primaryColor, color: onPrimary }}>
          <svg aria-hidden className="absolute inset-0 h-full w-full opacity-[0.14]" viewBox="0 0 120 160" preserveAspectRatio="xMidYMid slice">
            {Array.from({ length: 5 }, (_, i) => (
              <circle key={i} cx="96" cy="130" r={14 + i * 12} fill="none" stroke="currentColor" strokeWidth="0.6" />
            ))}
          </svg>
          <div className="relative flex items-center gap-2">
            <Logo b={b} size={24} light={onPrimary === "#FFFFFF"} />
            <span className="truncate text-[12px] font-medium" style={{ fontFamily: `"${b.headingFont}", serif` }} data-testid="preview-name">
              {b.displayName}
            </span>
          </div>
          <p className="relative text-[17px] leading-tight" style={{ fontFamily: `"${b.headingFont}", serif` }}>
            Good to have you on shift.
          </p>
        </div>
        <div className="flex flex-col justify-center gap-2 p-4">
          <p className="text-[9px] uppercase tracking-[0.16em] text-black/50">Staff sign in</p>
          <p className="text-[15px] leading-tight" style={{ fontFamily: `"${b.headingFont}", serif` }}>
            {b.displayName}
          </p>
          {sso && (
            <span className="mt-1 flex h-7 items-center justify-center gap-1.5 rounded-sm border border-black/20 bg-white text-[10.5px]">
              <Key size={11} /> Continue with {sso}
            </span>
          )}
          <span className="mt-1 h-6 rounded-sm border border-black/15 bg-white" />
          <span className="h-6 rounded-sm border border-black/15 bg-white" />
          <span className="mt-1 flex h-7 items-center justify-center gap-1 rounded-sm text-[10.5px] font-medium" style={{ background: b.accentColor, color: inkOn(b.accentColor) }}>
            Sign in <ArrowRight size={10} weight="bold" />
          </span>
        </div>
      </div>
      <figcaption className="border-t border-black/10 bg-[#f4efe6] px-3 py-1.5 text-[10.5px] text-black/55">No platform name or logo on this page.</figcaption>
    </figure>
  );
}

/** The booking site's header and first fold with the brand applied. */
export function BookingSitePreview({ b, host, whiteLabel, links, fonts }: { b: BrandDraft; host?: string | null; whiteLabel: boolean; links?: { label: string; url: string }[]; fonts?: BrandFont[] }) {
  useBrandFonts(b, fonts);
  const foot = (links ?? []).filter((l) => l.label.trim()).slice(0, 3);
  return (
    <figure className="overflow-hidden rounded-md border border-line bg-white text-[#1b1a17]">
      <div className="flex items-center gap-1.5 border-b border-black/10 bg-[#ede6da] px-3 py-1.5">
        <span className="h-2 w-2 rounded-full bg-black/15" />
        <span className="h-2 w-2 rounded-full bg-black/15" />
        <span className="h-2 w-2 rounded-full bg-black/15" />
        <span className="ml-2 flex min-w-0 items-center gap-1.5 truncate rounded-xs bg-white/70 px-2 py-0.5 font-mono text-[10.5px] text-black/60">
          {b.faviconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- tenant-supplied URL
            <img src={b.faviconUrl} alt="" className="h-3 w-3" />
          ) : (
            <span className="h-3 w-3 rounded-[2px]" style={{ background: b.primaryColor }} />
          )}
          {host || "book.yourhotel.com"}
        </span>
      </div>
      <div style={{ fontFamily: `"${b.bodyFont}", sans-serif` }}>
        <div className="flex items-center justify-between border-b border-black/10 px-4 py-2.5">
          <span className="flex items-center gap-2">
            <Logo b={b} size={22} />
            <span className="text-[13px]" style={{ fontFamily: `"${b.headingFont}", serif` }}>
              {b.displayName}
            </span>
          </span>
          <span className="flex gap-3 text-[10.5px] text-black/60">
            <span>Rooms</span>
            <span>Dining</span>
            <span>Contact</span>
          </span>
        </div>
        <div className="px-4 py-5" style={{ background: `color-mix(in oklab, ${b.primaryColor} 8%, white)` }}>
          <p className="text-[22px] leading-[1.05]" style={{ fontFamily: `"${b.headingFont}", serif`, color: b.primaryColor }}>
            Stay where the city slows down.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <span className="h-7 flex-1 rounded-sm border border-black/15 bg-white" />
            <span className="flex h-7 items-center rounded-sm px-3 text-[10.5px] font-medium" style={{ background: b.accentColor, color: inkOn(b.accentColor) }}>
              Check availability
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-black/10 px-4 py-2 text-[10px] text-black/50">
          <span>&copy; {b.displayName}</span>
          {whiteLabel ? <span>{foot.length ? foot.map((l) => l.label).join(" \u00b7 ") : "Privacy \u00b7 Terms"}</span> : <span className="rounded-xs bg-black/5 px-1.5 py-0.5">Powered by the marketplace</span>}
        </div>
      </div>
    </figure>
  );
}
