"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowSquareOut, ChatText, CheckCircle, Clock, EnvelopeSimple, Flask, IdentificationBadge, Palette, Plus, Trash, X, XCircle } from "@phosphor-icons/react";
import { useCan } from "@/lib/permissions";
import { useMe } from "@/lib/api/hooks";
import { whiteLabelApi } from "@/lib/api/endpoints-m6";
import { qk6, useFonts, useSso, useWhiteLabel } from "@/lib/api/hooks-m6";
import type { EmailDomain, SmsSenderRequest, StaffPortalDomain, WhiteLabelSettings } from "@/lib/api/types-m6";
import { errorMessage } from "@/lib/api/client";
import { formatDateTime, relativeTime } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { contrastRatio, parseHex } from "@/lib/m6-catalog";
import { config } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Field, Input, Switch, Textarea } from "@/components/ui/form";
import { Badge, ErrorState, PageHeader, Panel, Segmented, Skeleton } from "@/components/ui/primitives";
import { DnsRecords, type CheckState } from "@/components/domain/parts";
import { BookingSitePreview, ColorField, ContrastReadout, FontChooser, StaffLoginPreview, type BrandDraft } from "./parts";

type Tab = "brand" | "email" | "sms" | "portal";

const TABS: { v: Tab; label: string; icon: React.ReactNode }[] = [
  { v: "brand", label: "Brand kit", icon: <Palette size={15} /> },
  { v: "email", label: "Email domain", icon: <EnvelopeSimple size={15} /> },
  { v: "sms", label: "SMS sender", icon: <ChatText size={15} /> },
  { v: "portal", label: "Staff portal", icon: <IdentificationBadge size={15} /> },
];

const DEFAULT_PRIMARY = "#22324F";
const DEFAULT_ACCENT = "#B4452A";

export function WhiteLabelView() {
  const q = useWhiteLabel();
  const { can } = useCan();
  const manage = can("whitelabel.manage");
  const [tab, setTab] = useState<Tab>("brand");
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.replace("#", "") as Tab;
      if (TABS.some((t) => t.v === h)) setTab(h);
    };
    read();
    // a link such as #email from the palette changes only the hash
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  const go = (t: Tab) => {
    setTab(t);
    try {
      history.replaceState(null, "", `#${t}`);
    } catch {
      /* ignore */
    }
  };
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Palette size={14} weight="duotone" /> White label
          </>
        }
        title={
          <>
            Only <em>your</em> name on it.
          </>
        }
        description={`Your logo, colours and type on the booking site, the staff sign-in, every email and receipt. Guests and staff never see ${config.appName}.`}
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-[520px]" />
      ) : (
        <div className="flex flex-col gap-6">
          <Summary s={q.data} manage={manage} onGo={go} />
          <nav aria-label="White-label sections" className="flex gap-1 overflow-x-auto border-b border-line">
            {TABS.map((t) => (
              <button
                key={t.v}
                type="button"
                onClick={() => go(t.v)}
                aria-current={tab === t.v ? "page" : undefined}
                data-testid={`wl-tab-${t.v}`}
                className={cn("-mb-px inline-flex h-10 shrink-0 items-center gap-2 border-b-2 px-3 text-[13.5px] font-medium", tab === t.v ? "border-laterite text-ink" : "border-transparent text-ink-muted hover:text-ink")}
              >
                {t.icon}
                {t.label}
                <TabDot s={q.data} t={t.v} />
              </button>
            ))}
          </nav>
          {tab === "brand" && <BrandKitEditor s={q.data} manage={manage} />}
          {tab === "email" && <EmailDomainWizard s={q.data} manage={manage} />}
          {tab === "sms" && <SmsSenderPanel r={q.data.smsSender} manage={manage} />}
          {tab === "portal" && <StaffPortalPanel p={q.data.staffPortal} manage={manage} />}
        </div>
      )}
    </>
  );
}

type Tri = "ok" | "wait" | "bad" | null;

function tabState(s: WhiteLabelSettings, t: Tab): Tri {
  if (t === "email") return !s.emailDomain ? null : s.emailDomain.status === "VERIFIED" ? "ok" : s.emailDomain.status === "FAILED" ? "bad" : "wait";
  if (t === "portal") return !s.staffPortal ? null : s.staffPortal.status === "VERIFIED" ? "ok" : s.staffPortal.status === "FAILED" ? "bad" : "wait";
  if (t === "sms") return !s.smsSender ? null : s.smsSender.status === "APPROVED" ? "ok" : s.smsSender.status === "REJECTED" ? "bad" : "wait";
  return null;
}

function TabDot({ s, t }: { s: WhiteLabelSettings; t: Tab }) {
  const st = tabState(s, t);
  if (!st) return null;
  return <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", st === "ok" ? "bg-palm" : st === "bad" ? "bg-danger" : "bg-ochre")} />;
}

function Summary({ s, manage, onGo }: { s: WhiteLabelSettings; manage: boolean; onGo: (t: Tab) => void }) {
  const qc = useQueryClient();
  const upd = useMutation({
    mutationFn: (b: { enabled?: boolean; hidePoweredBy?: boolean }) => whiteLabelApi.update(b),
    onSuccess: (r) => {
      qc.setQueryData(qk6.whiteLabel, r);
      void qc.invalidateQueries({ queryKey: ["me"] });
    },
    meta: { errorTitle: "Not changed" },
  });
  const domainOk = s.requirements.customDomainVerified;
  const rows: { t: Tab; label: string; v: string | null | undefined }[] = [
    { t: "email", label: "Guest email from your domain", v: s.emailDomain?.fromAddress },
    { t: "sms", label: "SMS sender ID", v: s.smsSender?.senderId },
    { t: "portal", label: "Staff portal at your address", v: s.staffPortal?.domain },
  ];
  return (
    <Panel className="grid grid-cols-1 gap-px overflow-hidden bg-line lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4 bg-surface p-5">
        <div className="flex items-center gap-3">
          <span data-testid="wl-active">
            {s.active ? (
              <Badge tone="palm" dot>
                Live
              </Badge>
            ) : s.enabled ? (
              <Badge tone="ochre" dot>
                On, waiting for a verified domain
              </Badge>
            ) : (
              <Badge dot>Off</Badge>
            )}
          </span>
        </div>
        <Switch
          checked={s.enabled}
          disabled={!manage || upd.isPending}
          onChange={(v) => upd.mutate({ enabled: v })}
          label="White label"
          description="Your brand everywhere guests and staff look: the booking site, sign-in, emails, invoices and receipts."
        />
        <Switch
          checked={s.hidePoweredBy}
          disabled={!manage || upd.isPending || (!domainOk && !s.hidePoweredBy)}
          onChange={(v) => upd.mutate({ hidePoweredBy: v })}
          label="Hide the marketplace on your booking site"
          description={
            domainOk ? (
              "No marketplace header, no “Powered by” line; your favicon, fonts and footer links instead."
            ) : (
              <>
                Needs your own verified booking domain.{" "}
                <Link href="/settings/domain" className="font-medium text-laterite hover:underline">
                  Set up a custom domain
                </Link>
              </>
            )
          }
        />
      </div>
      <ul className="flex min-w-0 flex-col justify-center gap-2.5 bg-surface p-5 text-[13px]">
        {rows.map((r) => {
          const st = tabState(s, r.t);
          return (
            <li key={r.t}>
              <button type="button" onClick={() => onGo(r.t)} className="grid w-full grid-cols-[16px_minmax(0,1fr)] items-center gap-x-2.5 text-left sm:flex">
                {st === "ok" ? <CheckCircle size={16} weight="fill" className="text-palm" /> : st === "wait" ? <Clock size={16} weight="fill" className="text-ochre" /> : st === "bad" ? <XCircle size={16} weight="fill" className="text-danger" /> : <span className="grid h-4 w-4 place-items-center"><span className="h-3 w-3 rounded-full border border-line-strong" /></span>}
                <span className="text-ink">{r.label}</span>
                <span className="col-start-2 min-w-0 truncate font-mono text-[12px] text-ink-muted sm:ml-auto">{r.v ?? (manage ? "Set up" : "--")}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

/* ---------------- brand kit ---------------- */

function toDraft(s: WhiteLabelSettings, tenantName: string): BrandDraft {
  return {
    displayName: s.brandName ?? tenantName,
    logoUrl: s.logoUrl,
    faviconUrl: s.faviconUrl,
    primaryColor: s.primaryColor ?? DEFAULT_PRIMARY,
    accentColor: s.accentColor ?? DEFAULT_ACCENT,
    headingFont: s.headingFont ?? "Fraunces",
    bodyFont: s.bodyFont ?? "Schibsted Grotesk",
  };
}

const httpsOk = (v: string | null) => !v || /^https:\/\/\S+$/.test(v) || (process.env.NODE_ENV !== "production" && /^http:\/\/localhost[:/]\S*$/.test(v));

function BrandKitEditor({ s, manage }: { s: WhiteLabelSettings; manage: boolean }) {
  const qc = useQueryClient();
  const me = useMe();
  const fonts = useFonts();
  const sso = useSso();
  const tenantName = me.data?.tenant.name ?? "";
  const base = useMemo(() => toDraft(s, tenantName), [s, tenantName]);
  const [b, setB] = useState<BrandDraft>(base);
  const [links, setLinks] = useState(s.footerLinks ?? []);
  const [view, setView] = useState<"login" | "site">("login");
  const set = <K extends keyof BrandDraft>(k: K, v: BrandDraft[K]) => setB((x) => ({ ...x, [k]: v }));
  const dirty = JSON.stringify(b) !== JSON.stringify(base) || JSON.stringify(links) !== JSON.stringify(s.footerLinks ?? []);
  const colorsOk = !!parseHex(b.primaryColor) && !!parseHex(b.accentColor);
  const linkOk = (u: string) => !u || httpsOk(u) || /^mailto:\S+@\S+$/.test(u);
  const urlsOk = httpsOk(b.logoUrl) && httpsOk(b.faviconUrl) && links.every((l) => linkOk(l.url));
  const accentText = (contrastRatio(b.accentColor, "#FFFFFF") ?? 0) >= (contrastRatio(b.accentColor, "#1B1A17") ?? 0) ? "#FFFFFF" : "#1B1A17";
  const save = useMutation({
    mutationFn: () =>
      whiteLabelApi.update({
        brandName: b.displayName.trim(),
        logoUrl: b.logoUrl?.trim() || null,
        faviconUrl: b.faviconUrl?.trim() || null,
        primaryColor: b.primaryColor.toUpperCase(),
        accentColor: b.accentColor.toUpperCase(),
        headingFont: b.headingFont,
        bodyFont: b.bodyFont,
        footerLinks: links.filter((l) => l.label.trim() && l.url.trim()),
      }),
    onSuccess: (r) => {
      qc.setQueryData(qk6.whiteLabel, r);
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Brand kit saved", "The booking site and the staff sign-in use it from the next page load.");
    },
    meta: { errorTitle: "Not saved" },
  });
  const ssoName = sso.data?.enabled ? (sso.data.provider === "GOOGLE" ? "Google" : sso.data.provider === "MICROSOFT" ? "Microsoft" : "single sign-on") : null;
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_440px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Panel className="p-5">
          <h2 className="display-sm text-[18px] text-ink">Name and marks</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Name guests and staff see" className="sm:col-span-2">
              <Input value={b.displayName} onChange={(e) => set("displayName", e.target.value)} disabled={!manage} data-testid="brand-name" maxLength={80} />
            </Field>
            <ImageUrlField label="Logo" hint="An https link to an SVG or PNG on a transparent background, 240 px wide or more." value={b.logoUrl} onChange={(v) => set("logoUrl", v)} disabled={!manage} testId="brand-logo" />
            <ImageUrlField label="Favicon" hint="An https link to a square PNG or ICO, 64 px or larger." value={b.faviconUrl} onChange={(v) => set("faviconUrl", v)} disabled={!manage} square testId="brand-favicon" />
          </div>
        </Panel>
        <Panel className="p-5">
          <h2 className="display-sm text-[18px] text-ink">Colours</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <ColorField label="Primary" value={b.primaryColor} onChange={(v) => set("primaryColor", v)} hint="Headings, the sign-in panel, links." testId="brand-primary" disabled={!manage} />
            <ColorField label="Accent" value={b.accentColor} onChange={(v) => set("accentColor", v)} hint="Buttons such as Book now and Sign in." testId="brand-accent" disabled={!manage} />
          </div>
          {colorsOk && (
            <div className="mt-5 flex flex-col gap-2.5 rounded-md border border-line bg-paper p-3.5">
              <p className="eyebrow mb-0.5">Contrast, WCAG 2.1</p>
              <ContrastReadout fg={b.primaryColor} bg="#FFFFFF" label="Primary text on white" testId="contrast-primary" />
              <ContrastReadout fg={accentText} bg={b.accentColor} label={`Button text (${accentText === "#FFFFFF" ? "white" : "dark"}) on the accent`} testId="contrast-accent" />
              <ContrastReadout fg={b.primaryColor} bg="#F4EFE6" label="Primary text on a warm page" />
              <p className="mt-0.5 text-[11.5px] leading-snug text-ink-muted">Body text needs AA, 4.5:1. AA large (3:1) is enough for big headings only. Button text is white or dark, whichever reads better.</p>
            </div>
          )}
        </Panel>
        <Panel className="p-5">
          <h2 className="display-sm text-[18px] text-ink">Type</h2>
          <p className="mt-1 text-[12.5px] text-ink-muted">A short list of Google fonts that read well on phones and carry Yoruba, Igbo and Hausa marks.</p>
          <p className="eyebrow mb-2 mt-5">Headings</p>
          <FontChooser role="heading" value={b.headingFont} onChange={(v) => set("headingFont", v)} fonts={fonts.data} disabled={!manage} />
          <p className="eyebrow mb-2 mt-5">Body</p>
          <FontChooser role="body" value={b.bodyFont} onChange={(v) => set("bodyFont", v)} fonts={fonts.data} disabled={!manage} />
        </Panel>
        <Panel className="p-5">
          <h2 className="display-sm text-[18px] text-ink">Footer links</h2>
          <p className="mt-1 text-[12.5px] text-ink-muted">At the foot of your booking site, in place of the marketplace links. Up to eight.</p>
          <ul className="mt-4 flex flex-col gap-2">
            {links.map((l, i) => (
              <li key={i} className="grid grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)_auto] gap-2">
                <Input value={l.label} placeholder="Privacy" aria-label="Link label" onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} disabled={!manage} />
                <Input value={l.url} placeholder="https://yourhotel.com/privacy" aria-label="Link address" aria-invalid={!linkOk(l.url)} className="font-mono" onChange={(e) => setLinks(links.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))} disabled={!manage} />
                <Button variant="ghost" size="icon" aria-label="Remove link" onClick={() => setLinks(links.filter((_, j) => j !== i))} disabled={!manage}>
                  <X size={14} />
                </Button>
              </li>
            ))}
          </ul>
          {manage && links.length < 8 && (
            <Button size="sm" variant="ghost" className="-ml-2 mt-2" onClick={() => setLinks([...links, { label: "", url: "https://" }])}>
              <Plus size={13} /> Add a link
            </Button>
          )}
        </Panel>
      </div>
      <aside className="flex flex-col gap-3 self-start xl:sticky xl:top-20">
        <div className="flex items-center justify-between gap-3">
          <span className="eyebrow">Live preview</span>
          <Segmented
            size="sm"
            label="Preview"
            value={view}
            onChange={setView}
            options={[
              { value: "login", label: "Staff sign-in" },
              { value: "site", label: "Booking site" },
            ]}
          />
        </div>
        {view === "login" ? <StaffLoginPreview b={b} host={s.staffPortal?.domain} sso={ssoName} fonts={fonts.data} /> : <BookingSitePreview b={b} whiteLabel={s.hidePoweredBy} links={links} fonts={fonts.data} />}
        {manage && (
          <div className="flex items-center justify-end gap-2 rounded-md border border-line bg-surface px-3 py-2.5">
            {dirty && <span className="mr-auto text-[12.5px] text-ochre">Unsaved changes</span>}
            <Button
              variant="ghost"
              size="sm"
              disabled={!dirty}
              onClick={() => {
                setB(base);
                setLinks(s.footerLinks ?? []);
              }}
            >
              Reset
            </Button>
            <Button size="sm" disabled={!dirty || !colorsOk || !urlsOk || !b.displayName.trim()} loading={save.isPending} onClick={() => save.mutate()} data-testid="save-brand">
              Save brand kit
            </Button>
          </div>
        )}
      </aside>
    </div>
  );
}

function ImageUrlField({ label, hint, value, onChange, disabled, square, testId }: { label: string; hint: string; value: string | null; onChange: (v: string | null) => void; disabled?: boolean; square?: boolean; testId?: string }) {
  const bad = !httpsOk(value);
  const [broken, setBroken] = useState(false);
  return (
    <Field label={label} hint={bad ? undefined : broken ? "That link doesn't load an image." : hint} error={bad ? "Use an https:// link." : null}>
      <div className="flex items-center gap-3">
        <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-sm border border-dashed border-line-strong bg-[repeating-conic-gradient(var(--surface-2)_0_25%,var(--surface)_0_50%)] bg-[length:12px_12px]", square ? "h-11 w-11" : "h-11 w-20")}>
          {value && !bad && !broken ? (
            // eslint-disable-next-line @next/next/no-img-element -- tenant-supplied URL on any host
            <img src={value} alt="" className="max-h-full max-w-full object-contain p-1" onError={() => setBroken(true)} />
          ) : (
            <span className="text-[10.5px] text-ink-faint">None</span>
          )}
        </span>
        <Input
          value={value ?? ""}
          onChange={(e) => {
            setBroken(false);
            onChange(e.target.value.trim() ? e.target.value : null);
          }}
          placeholder="https://"
          className="font-mono text-[13px]"
          disabled={disabled}
          aria-invalid={bad}
          data-testid={testId}
          spellCheck={false}
        />
      </div>
    </Field>
  );
}

/* ---------------- shared bits ---------------- */

function Steps({ step, labels }: { step: number; labels: string[] }) {
  return (
    <ol className="mb-5 flex flex-wrap items-center gap-x-2 gap-y-2 text-[12.5px]" aria-label="Steps">
      {labels.map((l, i) => {
        const n = i + 1;
        const done = n < step;
        const on = n === step;
        return (
          <li key={l} className="flex items-center gap-2" aria-current={on ? "step" : undefined}>
            <span className={cn("grid h-6 w-6 place-items-center rounded-full border font-mono text-[11px]", done ? "border-palm bg-palm text-surface" : on ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}>{done ? <CheckCircle size={13} weight="fill" /> : n}</span>
            <span className={on || done ? "text-ink" : "text-ink-muted"}>{l}</span>
            {i < labels.length - 1 && <span aria-hidden className="mx-1 hidden h-px w-6 bg-line-strong sm:block" />}
          </li>
        );
      })}
    </ol>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "VERIFIED")
    return (
      <Badge tone="palm" dot>
        Verified
      </Badge>
    );
  if (status === "FAILED")
    return (
      <Badge tone="danger" dot>
        Not verified
      </Badge>
    );
  if (status === "TEMPORARY_FAILURE")
    return (
      <Badge tone="ochre" dot>
        Check failed, retrying
      </Badge>
    );
  return (
    <Badge tone="ochre" dot>
      Waiting for DNS
    </Badge>
  );
}

function relHost(name: string, zone: string) {
  const apex = zone.split(".").slice(-2).join(".");
  if (name === apex) return "@";
  return name.endsWith(`.${apex}`) ? name.slice(0, -(apex.length + 1)) : name;
}

/* ---------------- email domain ---------------- */

const PURPOSE: Record<string, string> = {
  SPF: "SPF: lets our mail servers send for you",
  DKIM: "DKIM: signs every email so it isn't spoofed",
  RETURN_PATH: "Return path: bounces come back to us",
  DMARC: "DMARC: what inboxes do with fakes",
};

function EmailDomainWizard({ s, manage }: { s: WhiteLabelSettings; manage: boolean }) {
  const qc = useQueryClient();
  const d = s.emailDomain;
  const [domain, setDomain] = useState("");
  const [local, setLocal] = useState("reservations");
  const [fromName, setFromName] = useState(s.emailFromName ?? "");
  const [err, setErr] = useState<string | null>(null);
  const [rm, setRm] = useState(false);
  const setData = (r: EmailDomain | null) => qc.setQueryData(qk6.whiteLabel, (x: WhiteLabelSettings | undefined) => (x ? { ...x, emailDomain: r, requirements: { ...x.requirements, emailDomainVerified: r?.status === "VERIFIED" } } : x));
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^.*@/, "");
  const add = useMutation({
    mutationFn: () => whiteLabelApi.addEmailDomain({ domain: clean, fromLocalPart: local.trim() || "reservations" }),
    onSuccess: setData,
    onError: (e) => setErr(errorMessage(e)),
    meta: { silent: true },
  });
  const verify = useMutation({
    mutationFn: whiteLabelApi.verifyEmailDomain,
    onSuccess: (r) => {
      setData(r);
      if (r.status === "VERIFIED") toast.success(`${r.domain} verified`, "Guest emails go out from your address now.");
    },
    meta: { errorTitle: "Check failed" },
  });
  const devVerify = useMutation({ mutationFn: whiteLabelApi.devVerifyEmailDomain, onSuccess: setData, meta: { errorTitle: "Not verified" } });
  const del = useMutation({ mutationFn: whiteLabelApi.removeEmailDomain, onSuccess: () => setData(null), meta: { errorTitle: "Not removed" } });
  const name = useMutation({
    mutationFn: () => whiteLabelApi.update({ emailFromName: fromName.trim() || null }),
    onSuccess: (r) => {
      qc.setQueryData(qk6.whiteLabel, r);
      toast.success("Sender name saved");
    },
    meta: { errorTitle: "Not saved" },
  });

  const senderName = (
    <Panel className="flex flex-col gap-3 p-5 sm:flex-row sm:items-end">
      <Field label="Sender name" className="flex-1" hint={`What guests see in their inbox, such as “${s.brandName ?? "Your Hotel"} Reservations”.`}>
        <Input value={fromName} onChange={(e) => setFromName(e.target.value)} placeholder={`${s.brandName ?? "Your Hotel"} Reservations`} disabled={!manage} data-testid="email-from-name" maxLength={60} />
      </Field>
      {manage && (
        <Button variant="secondary" onClick={() => name.mutate()} loading={name.isPending} disabled={(fromName.trim() || null) === (s.emailFromName ?? null)}>
          Save name
        </Button>
      )}
    </Panel>
  );

  if (!d)
    return (
      <div className="flex flex-col gap-5">
        <Panel className="p-6">
          <Steps step={1} labels={["Your domain", "Add the DNS records", "Verified"]} />
          <p className="max-w-xl text-[13.5px] leading-relaxed text-ink-muted">Confirmations, receipts and reminders go out from an address at your own domain. Until it is verified they come from our sending address with your hotel&rsquo;s name, so nothing stops in the meantime.</p>
          <form
            className="mt-5 grid max-w-xl gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              setErr(null);
              if (clean.includes(".")) add.mutate();
            }}
          >
            <Field label="Sending domain" error={err} hint="A subdomain just for email, such as mail.yourhotel.com, keeps your office mailboxes untouched.">
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="mail.yourhotel.com" className="font-mono" disabled={!manage} data-testid="email-domain-input" spellCheck={false} />
            </Field>
            <Field label="From address">
              <div className="flex h-10 items-stretch overflow-hidden rounded-md border border-line-strong bg-surface focus-within:border-laterite">
                <input value={local} onChange={(e) => setLocal(e.target.value.replace(/[^a-z0-9._-]/gi, "").toLowerCase())} className="w-40 min-w-0 bg-transparent px-3 font-mono text-[14px] text-ink outline-none" aria-label="Mailbox" disabled={!manage} />
                <span className="flex min-w-0 flex-1 items-center truncate border-l border-line bg-surface-2/60 px-3 font-mono text-[12.5px] text-ink-muted">@{clean || "mail.yourhotel.com"}</span>
              </div>
            </Field>
            <div>
              <Button type="submit" loading={add.isPending} disabled={!manage || !clean.includes(".")} data-testid="email-domain-continue">
                Continue
              </Button>
            </div>
          </form>
        </Panel>
        {senderName}
      </div>
    );

  const verified = d.status === "VERIFIED";
  return (
    <div className="flex flex-col gap-5">
      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <span className="font-mono text-[16px] text-ink" data-testid="email-domain-name">
            {d.domain}
          </span>
          <span data-testid="email-domain-status" data-status={d.status}>
            <StatusBadge status={d.status} />
          </span>
          <span className="text-[12.5px] text-ink-muted">
            sends as <span className="font-mono text-ink">{s.emailFromName ? `${s.emailFromName} <${d.fromAddress}>` : d.fromAddress}</span>
          </span>
          {manage && (
            <Button size="sm" variant="ghost" className="ml-auto text-ink-muted" onClick={() => setRm(true)}>
              <Trash size={14} /> Remove
            </Button>
          )}
        </div>
        <div className="p-5">
          <Steps step={verified ? 4 : 2} labels={["Your domain", "Add the DNS records", "Verified"]} />
          <p className="mb-4 max-w-2xl text-[13.5px] leading-relaxed text-ink">
            {verified
              ? `Verified ${d.verifiedAt ? formatDateTime(d.verifiedAt) : ""}. Keep these records in place; if they go, email falls back to our sending address.`
              : `Add these ${d.records.length} records where you manage DNS for ${d.domain.split(".").slice(-2).join(".")}. They prove the mail is really from you, so it lands in the inbox and not in spam.`}
          </p>
          <DnsRecords
            checking={verify.isPending}
            records={d.records.map((r) => ({
              type: r.type,
              name: r.name,
              host: relHost(r.name, d.domain),
              value: r.value,
              ttl: Number(r.ttl) || 3600,
              priority: r.priority,
              purpose: PURPOSE[r.purpose] ?? r.purpose,
              state: (r.status === "verified" ? "OK" : r.status === "failed" ? "MISSING" : "PENDING") as CheckState,
            }))}
          />
        </div>
        {!verified && (
          <div className="flex flex-wrap items-center gap-3 border-t border-line bg-surface-2/40 px-5 py-3.5">
            <p className="min-w-0 flex-1 text-[12.5px] text-ink-muted" suppressHydrationWarning>
              {d.lastCheckedAt ? `Last checked ${relativeTime(d.lastCheckedAt)}. ` : ""}DNS changes usually show within minutes, sometimes a few hours.
            </p>
            {manage && (
              <>
                {process.env.NODE_ENV !== "production" && d.provider === "mock" && (
                  <Button variant="ghost" size="sm" onClick={() => devVerify.mutate()} loading={devVerify.isPending} title="Development only: marks the mock records verified" data-testid="email-dev-verify">
                    <Flask size={14} /> Verify in mock
                  </Button>
                )}
                <Button onClick={() => verify.mutate()} loading={verify.isPending} data-testid="email-verify">
                  Check records
                </Button>
              </>
            )}
          </div>
        )}
      </Panel>
      {senderName}
      <ConfirmDialog open={rm} onOpenChange={setRm} title={`Stop sending from ${d.domain}?`} body="Guest emails go back to our sending address, with your hotel's name as the sender." confirmLabel="Remove" danger onConfirm={() => del.mutateAsync()} />
    </div>
  );
}

/* ---------------- SMS sender ID ---------------- */

function SmsSenderPanel({ r, manage }: { r: SmsSenderRequest | null; manage: boolean }) {
  const qc = useQueryClient();
  const [id, setId] = useState(r && r.status !== "REJECTED" ? r.senderId : "");
  const [useCase, setUseCase] = useState(r?.useCase ?? "");
  const idOk = /^[A-Za-z0-9]{3,11}$/.test(id.trim()) && /[A-Za-z]/.test(id);
  const useOk = useCase.trim().length >= 20 && useCase.trim().length <= 500;
  const req = useMutation({
    mutationFn: () => whiteLabelApi.requestSender({ senderId: id.trim(), useCase: useCase.trim() }),
    onSuccess: (x) => {
      qc.setQueryData(qk6.whiteLabel, (w: WhiteLabelSettings | undefined) => (w ? { ...w, smsSender: x } : w));
      toast.success("Sender ID requested", "The networks usually decide within 3 to 7 working days.");
    },
    meta: { errorTitle: "Not requested" },
  });
  const status = r?.status;
  const steps = [
    { label: "Requested", at: r?.requestedAt, state: r ? "done" : "todo" },
    { label: "With the networks", at: null, state: status === "APPROVED" || status === "REJECTED" ? "done" : status ? "on" : "todo" },
    { label: status === "REJECTED" ? "Rejected" : "Approved", at: r?.decidedAt, state: status === "APPROVED" ? "done" : status === "REJECTED" ? "bad" : "todo" },
  ];
  const shown = status === "APPROVED" ? r!.senderId : id.trim().toUpperCase() || "YOURHOTEL";
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <Panel className="p-5">
        <h2 className="display-sm text-[18px] text-ink">The name guests see on your texts</h2>
        <p className="mt-1 max-w-xl text-[13px] leading-relaxed text-ink-muted">
          Up to 11 letters or numbers, such as <span className="font-mono text-ink">HARMATTAN</span>. MTN, Airtel, Glo and 9mobile approve it through our SMS provider; until then texts come from our shared sender.
        </p>
        {r && (
          <ol className="mt-5 grid grid-cols-3 gap-3" data-testid="sms-status" data-status={r.status}>
            {steps.map((st) => (
              <li key={st.label} className={cn("border-t-2 pt-2", st.state === "bad" ? "border-danger" : st.state === "done" ? "border-palm" : st.state === "on" ? "border-ochre" : "border-line-strong")}>
                <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink">
                  {st.state === "bad" ? <XCircle size={14} weight="fill" className="text-danger" /> : st.state === "done" ? <CheckCircle size={14} weight="fill" className="text-palm" /> : st.state === "on" ? <Clock size={14} weight="fill" className="text-ochre" /> : null}
                  {st.label}
                </p>
                {st.at && <p className="mt-0.5 text-[11.5px] text-ink-muted">{formatDateTime(st.at)}</p>}
              </li>
            ))}
          </ol>
        )}
        {r && (
          <p className="mt-4 text-[13px] text-ink">
            <span className="font-mono text-[15px] tracking-wider">{r.senderId}</span> <span className="text-ink-muted">for &ldquo;{r.useCase}&rdquo;</span>
          </p>
        )}
        {r?.note && <p className={cn("mt-3 rounded-md border px-3 py-2 text-[12.5px]", r.status === "REJECTED" ? "border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-wash text-ink" : "border-line bg-paper text-ink-muted")}>{r.note}</p>}
        {(!r || r.status === "REJECTED") && manage && (
          <form
            className="mt-5 flex max-w-xl flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (idOk && useOk) req.mutate();
            }}
          >
            <Field label="Sender ID" error={id && !idOk ? "3 to 11 letters or numbers, with at least one letter. No spaces." : null} hint={`${id.trim().length} of 11`}>
              <Input value={id} onChange={(e) => setId(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11))} className="font-mono uppercase tracking-wider" placeholder="HARMATTAN" data-testid="sender-id" />
            </Field>
            <Field label="What you send with it" error={useCase && !useOk ? "Say a little more: 20 characters or more." : null} hint="The networks read this. For example: booking confirmations, check-in codes and receipts for our guests.">
              <Textarea value={useCase} onChange={(e) => setUseCase(e.target.value)} className="min-h-20" maxLength={500} data-testid="sender-use-case" />
            </Field>
            <div>
              <Button type="submit" disabled={!idOk || !useOk} loading={req.isPending} data-testid="request-sender">
                {r?.status === "REJECTED" ? "Request again" : "Request sender ID"}
              </Button>
            </div>
          </form>
        )}
      </Panel>
      <div className="self-start">
        <p className="eyebrow mb-2">On a guest&rsquo;s phone</p>
        <div className="rounded-[26px] border border-line-strong bg-paper p-2.5 shadow-[0_1px_0_var(--line)]">
          <div className="rounded-[18px] bg-surface px-3 pb-5 pt-3">
            <p className="text-center font-mono text-[12.5px] font-medium tracking-wider text-ink">{shown}</p>
            <p className="mb-4 text-center text-[10px] text-ink-muted">Text message &middot; today 09:14</p>
            <p className="max-w-[90%] rounded-[14px] rounded-bl-[4px] bg-surface-2 px-3 py-2 text-[12px] leading-snug text-ink">Your booking HHA-7K3Q9 is confirmed: Deluxe King, 2 to 4 Oct. Check-in from 2pm. Reply STOP to opt out.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- staff portal ---------------- */

function StaffPortalPanel({ p, manage }: { p: StaffPortalDomain | null; manage: boolean }) {
  const qc = useQueryClient();
  const [host, setHost] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [rm, setRm] = useState(false);
  const setData = (r: StaffPortalDomain | null) => qc.setQueryData(qk6.whiteLabel, (x: WhiteLabelSettings | undefined) => (x ? { ...x, staffPortal: r } : x));
  const clean = host.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const add = useMutation({ mutationFn: () => whiteLabelApi.addStaffPortal(clean), onSuccess: setData, onError: (e) => setErr(errorMessage(e)), meta: { silent: true } });
  const verify = useMutation({
    mutationFn: whiteLabelApi.verifyStaffPortal,
    onSuccess: (r) => {
      setData(r);
      if (r.status === "VERIFIED") toast.success(`${r.domain} is live`, "Staff can sign in there now.");
    },
    meta: { errorTitle: "Check failed" },
  });
  const publish = useMutation({
    mutationFn: async () => {
      await whiteLabelApi.devPublishStaffPortal();
      return whiteLabelApi.verifyStaffPortal();
    },
    onSuccess: setData,
    meta: { errorTitle: "Not published" },
  });
  const del = useMutation({ mutationFn: whiteLabelApi.removeStaffPortal, onSuccess: () => setData(null), meta: { errorTitle: "Not removed" } });
  const records = useMemo(
    () =>
      p
        ? p.records.map((r) => ({
            type: r.type,
            name: r.name,
            host: relHost(r.name, p.domain),
            value: r.value,
            ttl: 3600,
            purpose: r.type === "TXT" ? "Proves the domain is yours" : `Points ${p.domain} at the staff app`,
            state: (r.ok === true ? "OK" : r.ok === false ? (p.failures.some((f) => f.includes("MISMATCH") && f.startsWith(r.type)) ? "MISMATCH" : "MISSING") : "PENDING") as CheckState,
          }))
        : [],
    [p],
  );

  if (!p)
    return (
      <Panel className="p-6">
        <Steps step={1} labels={["Choose the address", "Add the DNS records", "Live"]} />
        <p className="max-w-xl text-[13.5px] leading-relaxed text-ink-muted">
          Staff sign in at an address of yours, such as <span className="font-mono text-ink">staff.yourhotel.com</span>, and see your logo and name on the sign-in page, not ours. This address keeps working too.
        </p>
        <form
          className="mt-5 flex max-w-xl flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            setErr(null);
            if (clean.split(".").length >= 3) add.mutate();
          }}
        >
          <Field label="Staff address" className="flex-1" error={err} hint="A subdomain of a domain you own.">
            <Input value={host} onChange={(e) => setHost(e.target.value)} placeholder="staff.yourhotel.com" className="font-mono" disabled={!manage} data-testid="portal-host-input" spellCheck={false} />
          </Field>
          <Button type="submit" loading={add.isPending} disabled={!manage || clean.split(".").length < 3}>
            Continue
          </Button>
        </form>
      </Panel>
    );

  const live = p.status === "VERIFIED";
  return (
    <div className="flex flex-col gap-5">
      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <span className="font-mono text-[16px] text-ink" data-testid="portal-host">
            {p.domain}
          </span>
          <StatusBadge status={p.status} />
          {live && (
            <a href={`https://${p.domain}/login`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-laterite hover:underline">
              Open <ArrowSquareOut size={12} />
            </a>
          )}
          {manage && (
            <Button size="sm" variant="ghost" className="ml-auto text-ink-muted" onClick={() => setRm(true)}>
              <Trash size={14} /> Remove
            </Button>
          )}
        </div>
        <div className="p-5">
          <Steps step={live ? 4 : 2} labels={["Choose the address", "Add the DNS records", "Live"]} />
          <p className="mb-4 max-w-2xl text-[13.5px] leading-relaxed text-ink">
            {live
              ? `Staff who open ${p.domain} see your sign-in page with your logo and name${p.verifiedAt ? `; live since ${formatDateTime(p.verifiedAt)}` : ""}. Inside, the platform name is gone from the shell.`
              : "Add these at the company that sells you the domain, then check."}
          </p>
          <DnsRecords records={records} checking={verify.isPending} />
        </div>
        {!live && manage && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line bg-surface-2/40 px-5 py-3.5">
            <p className="mr-auto text-[12.5px] text-ink-muted" suppressHydrationWarning>
              {p.lastCheckedAt ? `Last checked ${relativeTime(p.lastCheckedAt)}.` : "Not checked yet."}
            </p>
            {process.env.NODE_ENV !== "production" && (
              <Button variant="ghost" size="sm" onClick={() => publish.mutate()} loading={publish.isPending} title="Development only: writes the records into the mock DNS" data-testid="portal-dev-publish">
                <Flask size={14} /> Publish in mock DNS
              </Button>
            )}
            <Button onClick={() => verify.mutate()} loading={verify.isPending}>
              Check records
            </Button>
          </div>
        )}
      </Panel>
      <ConfirmDialog open={rm} onOpenChange={setRm} title={`Remove ${p.domain}?`} body="Staff who use it will need this admin's standard address again." confirmLabel="Remove" danger onConfirm={() => del.mutateAsync()} />
    </div>
  );
}
