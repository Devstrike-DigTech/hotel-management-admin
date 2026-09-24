"use client";

/* Locked-feature previews for plans below Enterprise, built from the real components with sample data. */

import { KeyStub, ModeTag, ScopeSummary, HttpStatus } from "@/components/developers/parts";
import { ContrastReadout, StaffLoginPreview, type BrandDraft } from "@/components/whitelabel/parts";
import { ProviderMark } from "@/components/sso/sso-view";
import { CheckCircle, FileZip, DownloadSimple } from "@phosphor-icons/react";

const SAMPLE_BRAND: BrandDraft = {
  displayName: "Harbour House Hotel",
  logoUrl: null,
  faviconUrl: null,
  primaryColor: "#1F3A34",
  accentColor: "#B4452A",
  headingFont: "Cormorant Garamond",
  bodyFont: "Work Sans",
};

export function ApiPreview() {
  const keys = [
    { name: "Channel sync", env: "LIVE" as const, display: "hk_live_q7m2x9c4ta_...9xQz", scopes: ["reservations:read", "reservations:write", "availability:read", "rates:read"], used: "2 min ago" },
    { name: "Power BI", env: "LIVE" as const, display: "hk_live_b81kd0ws3e_...m2Lp", scopes: ["reports:read", "folios:read"], used: "this morning" },
    { name: "Staging integration", env: "TEST" as const, display: "hk_test_z4n8r1yq6u_...Vv07", scopes: ["reservations:read", "reservations:write"], used: "yesterday" },
  ];
  const rows = [
    { t: "10:42", e: "reservation.created", s: 200, ms: 184 },
    { t: "10:39", e: "payment.received", s: 200, ms: 121 },
    { t: "10:31", e: "room.status_changed", s: 503, ms: 10004 },
    { t: "10:12", e: "reservation.checked_in", s: 200, ms: 96 },
  ];
  return (
    <div className="flex flex-col gap-5">
      <ul className="divide-y divide-line rounded-md border border-line bg-surface">
        {keys.map((k) => (
          <li key={k.name} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-center">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-[13.5px] font-medium text-ink">
                {k.name} <ModeTag mode={k.env} />
              </p>
              <KeyStub display={k.display} className="mt-0.5 text-ink-muted" />
            </div>
            <ScopeSummary scopes={k.scopes} />
            <span className="text-[12px] text-ink-muted">Used {k.used}</span>
          </li>
        ))}
      </ul>
      <div className="rounded-md border border-line bg-surface">
        <p className="border-b border-line px-4 py-2 font-mono text-[12px] text-ink">https://hooks.harbourhouse.ng/pms</p>
        <ul className="divide-y divide-line">
          {rows.map((r) => (
            <li key={r.t + r.e} className="flex items-center gap-3 px-4 py-2 text-[12.5px]">
              <span className="font-mono text-ink-muted">{r.t}</span>
              <span className="flex-1 font-mono text-ink">{r.e}</span>
              <HttpStatus code={r.s} />
              <span className="w-16 text-right font-mono text-ink-muted">{r.ms} ms</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function WhiteLabelPreview() {
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <StaffLoginPreview b={SAMPLE_BRAND} host="staff.harbourhouse.ng" sso="Google" />
      <div className="flex flex-col gap-3 rounded-md border border-line bg-surface p-4">
        <p className="eyebrow">Contrast</p>
        <ContrastReadout fg={SAMPLE_BRAND.primaryColor} bg="#FFFFFF" label="Primary on white" />
        <ContrastReadout fg="#FFFFFF" bg={SAMPLE_BRAND.accentColor} label="Button text" />
        <p className="eyebrow mt-2">Sending as</p>
        <p className="font-mono text-[12.5px] text-ink">reservations@mail.harbourhouse.ng</p>
        <p className="flex items-center gap-1.5 text-[12px] text-palm">
          <CheckCircle size={14} weight="fill" /> SPF, DKIM and return path verified
        </p>
        <p className="eyebrow mt-2">SMS sender</p>
        <p className="font-mono text-[13px] tracking-wider text-ink">HARBOURHSE</p>
      </div>
    </div>
  );
}

export function SsoPreview() {
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <div className="flex flex-col gap-2 rounded-md border border-line bg-surface p-4">
        {(["GOOGLE", "MICROSOFT", "OIDC"] as const).map((p, i) => (
          <div key={p} className={`flex items-center gap-3 rounded-sm border p-2.5 ${i === 0 ? "border-ink" : "border-line"}`}>
            <ProviderMark id={p} />
            <span className="text-[13px] text-ink">{p === "GOOGLE" ? "Google Workspace" : p === "MICROSOFT" ? "Microsoft Entra ID" : "Other OIDC provider"}</span>
          </div>
        ))}
      </div>
      <div className="flex flex-col justify-center gap-3 rounded-md border border-line bg-paper p-5">
        <p className="eyebrow">Staff sign in</p>
        <span className="flex h-10 items-center justify-center gap-2 rounded-md border border-line-strong bg-surface text-[13.5px] font-medium text-ink">
          <ProviderMark id="GOOGLE" className="h-5 w-5 text-[12px]" /> Continue with Google
        </span>
        <p className="text-center text-[11.5px] text-ink-muted">Only @harbourhouse.ng addresses</p>
      </div>
    </div>
  );
}

export function ExportPreview() {
  return (
    <div className="rounded-md border border-line bg-surface">
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <FileZip size={20} weight="duotone" className="text-palm" />
        <span className="flex-1 font-mono text-[13px] text-ink">harbour-house-export-2026-09-24.zip</span>
        <span className="inline-flex h-8 items-center gap-1.5 rounded-md bg-laterite px-3 text-[12.5px] font-medium text-laterite-ink">
          <DownloadSimple size={14} /> Download
        </span>
      </div>
      <ul className="grid grid-cols-2 gap-x-6 px-4 py-3 text-[12px]">
        {[
          ["reservations", "4,812"],
          ["guests", "3,977"],
          ["folio_entries", "31,440"],
          ["payments", "9,204"],
          ["housekeeping_tasks", "12,006"],
          ["audit_log", "58,113"],
        ].map(([n, r]) => (
          <li key={n} className="flex justify-between border-b border-dashed border-line py-1">
            <span className="font-mono text-ink">{n}</span>
            <span className="font-mono text-ink-muted">{r}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
