"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowSquareOut, CheckCircle, Flask, Globe, LockSimple, MagnifyingGlass, Trash, WarningCircle } from "@phosphor-icons/react";
import { useCan } from "@/lib/permissions";
import { domainsApi } from "@/lib/api/endpoints-m5";
import { qk5, useDomains } from "@/lib/api/hooks-m5";
import type { CustomDomain, DomainCheckFailure } from "@/lib/api/types-m5";
import { errorMessage, isApiError } from "@/lib/api/client";
import { formatDateTime, relativeTime } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/overlay";
import { Field } from "@/components/ui/form";
import { Badge, ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { CheckMark, DNS_PROVIDERS, DnsRecords, type CheckState } from "./parts";

const FAILURE: Record<DomainCheckFailure, string> = {
  TXT_MISSING: "The TXT record isn't there yet.",
  TXT_MISMATCH: "A TXT record is there, but its value is different. Copy it again exactly.",
  CNAME_MISSING: "The CNAME record isn't there yet.",
  CNAME_MISMATCH: "The CNAME points somewhere else. It must point to the address shown.",
  DNS_ERROR: "The DNS lookup failed. That usually passes; we'll try again.",
};

/** The host a DNS panel wants: the name without the registrable domain (book.hotel.com -> book). */
function hostOf(name: string, domain: string) {
  const parts = domain.split(".");
  const secondLevel = ["com", "org", "net", "gov", "edu", "co"];
  const apexLen = parts.length >= 3 && secondLevel.includes(parts[parts.length - 2]) && parts[parts.length - 1].length === 2 ? 3 : 2;
  const apex = parts.slice(-apexLen).join(".");
  return name.endsWith(`.${apex}`) ? name.slice(0, -(apex.length + 1)) : name;
}

const RECHECK_MS = 30_000;

export function DomainView() {
  const q = useDomains();
  const { can } = useCan();
  const manage = can("settings.manage");
  const d = q.data?.domain ?? null;
  const step = !d ? 1 : d.status === "VERIFIED" ? 4 : 2;
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Globe size={14} weight="duotone" /> Custom domain
          </>
        }
        title={
          <>
            Your booking site, <em>at your own address</em>.
          </>
        }
        description="Guests book on book.yourhotel.com instead of our address. You add two records at the company that sells you the domain; we check them and switch the site on, with a secure certificate."
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-96" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
          <ol className="flex gap-2 lg:flex-col lg:gap-0" aria-label="Steps">
            {["Choose the address", "Add two DNS records", "We check them", "Live"].map((label, i) => {
              const n = i + 1;
              const done = n < step || (step === 4 && n === 4);
              const on = n === step || (step === 2 && n === 3);
              return (
                <li key={label} className="relative flex flex-1 items-start gap-3 lg:pb-7 lg:last:pb-0">
                  {i < 3 && <span aria-hidden className={cn("absolute left-[13px] top-7 hidden h-[calc(100%-24px)] w-px lg:block", done ? "bg-palm" : "bg-line-strong")} />}
                  <span className={cn("relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full border font-mono text-[12px]", done ? "border-palm bg-palm text-surface" : on ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink-muted")}>
                    {done ? <CheckCircle size={15} weight="fill" /> : n}
                  </span>
                  <span className={cn("hidden pt-1 text-[13px] sm:block", on || done ? "text-ink" : "text-ink-muted")}>{label}</span>
                </li>
              );
            })}
          </ol>
          <div className="min-w-0">
            {!d ? <ChooseDomain subdomain={q.data.subdomain} disabled={!manage} /> : d.status === "VERIFIED" ? <Live d={d} canonical={q.data.canonicalHost} manage={manage} /> : <Pending d={d} subdomain={q.data.subdomain} manage={manage} />}
          </div>
        </div>
      )}
    </>
  );
}

function ChooseDomain({ subdomain, disabled }: { subdomain: string; disabled: boolean }) {
  const qc = useQueryClient();
  const [v, setV] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const clean = v.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const labels = clean.split(".").filter(Boolean);
  const looksApex = labels.length === 2 || (labels.length === 3 && /^(com|org|net|gov|edu)\.ng$/.test(labels.slice(-2).join(".")));
  const add = useMutation({
    mutationFn: () => domainsApi.add(clean),
    onSuccess: (r) => {
      qc.setQueryData(qk5.domains, (x: unknown) => ({ ...(x as object), domain: r }));
      toast.success(`${r.domain} added`, "Next: the two DNS records.");
    },
    onError: (e) => setErr(isApiError(e) && e.code === "DOMAIN_APEX_NOT_SUPPORTED" ? `Use a subdomain, such as book.${clean}: the bare domain can't point to another server.` : isApiError(e) && e.code === "DOMAIN_TAKEN" ? "That address is already used by another hotel on the platform." : errorMessage(e)),
    meta: { silent: true },
  });
  return (
    <Panel className="p-6">
      <p className="text-[13.5px] text-ink-muted">
        Today your booking site is at <span className="font-mono text-ink">{subdomain}</span>. It keeps working after you add your own address.
      </p>
      <form
        className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end"
        onSubmit={(e) => {
          e.preventDefault();
          setErr(null);
          if (clean) add.mutate();
        }}
      >
        <Field label="Your address" className="flex-1" error={err} hint={looksApex && !err ? `That looks like a bare domain. Use a subdomain such as book.${clean}.` : "A subdomain of a domain you own: book., stay. or reservations."}>
          <div className="flex h-12 items-stretch overflow-hidden rounded-md border border-line-strong bg-surface focus-within:border-laterite">
            <span className="flex items-center border-r border-line bg-surface-2/60 px-3 font-mono text-[13px] text-ink-muted">https://</span>
            <input value={v} onChange={(e) => setV(e.target.value)} placeholder="book.yourhotel.com" disabled={disabled} className="min-w-0 flex-1 bg-transparent px-3 font-mono text-[16px] text-ink outline-none" aria-label="Domain" data-testid="domain-input" autoComplete="off" spellCheck={false} />
          </div>
        </Field>
        <Button size="lg" type="submit" className="h-12" loading={add.isPending} disabled={disabled || labels.length < 2}>
          Continue
        </Button>
      </form>
    </Panel>
  );
}

function Pending({ d, subdomain, manage }: { d: CustomDomain; subdomain: string; manage: boolean }) {
  const qc = useQueryClient();
  const now = useNow(1000);
  const [lastRun, setLastRun] = useState(() => Date.now());
  const [remove, setRemove] = useState(false);
  const verify = useMutation({
    mutationFn: () => domainsApi.verify(d.id),
    onSuccess: (r) => {
      qc.setQueryData(qk5.domains, (x: unknown) => ({ ...(x as object), domain: r }));
      if (r.status === "VERIFIED") {
        void qc.invalidateQueries({ queryKey: ["me"] });
        toast.success(`${r.domain} is live`, "Guests can book there now.");
      }
    },
    onSettled: () => setLastRun(Date.now()),
    meta: { silent: true },
  });
  const publish = useMutation({
    mutationFn: async () => {
      await domainsApi.devPublish(d.id);
      return domainsApi.verify(d.id);
    },
    onSuccess: (r) => qc.setQueryData(qk5.domains, (x: unknown) => ({ ...(x as object), domain: r })),
    meta: { errorTitle: "Not published" },
  });
  const del = useMutation({ mutationFn: () => domainsApi.remove(d.id), onSuccess: () => void qc.invalidateQueries({ queryKey: qk5.domains }), meta: { errorTitle: "Not removed" } });
  // live verification: check again every 30 seconds while this page is open
  const due = lastRun + RECHECK_MS - now;
  const { mutate: runVerify, isPending: verifying } = verify;
  useEffect(() => {
    if (d.status !== "PENDING" || verifying || !manage) return;
    if (due <= 0) runVerify();
  }, [due, d.status, verifying, runVerify, manage]);
  const state = (type: "TXT" | "CNAME"): CheckState => {
    const r = d.records.find((x) => x.type === type);
    if (r?.ok) return "OK";
    if (d.failures.includes(type === "TXT" ? "TXT_MISMATCH" : "CNAME_MISMATCH")) return "MISMATCH";
    if (d.failures.includes(type === "TXT" ? "TXT_MISSING" : "CNAME_MISSING")) return "MISSING";
    return "PENDING";
  };
  const records = d.records.map((r) => ({
    type: r.type,
    name: r.name,
    host: hostOf(r.name, d.domain),
    value: r.value,
    ttl: 3600,
    purpose: r.type === "TXT" ? "Proves the domain is yours" : `Points ${d.domain} at your booking site`,
    state: state(r.type),
  }));
  return (
    <div className="flex flex-col gap-5">
      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <span className="font-mono text-[17px] text-ink" data-testid="domain-name">
            {d.domain}
          </span>
          <span data-testid="domain-status">
            <Badge tone={d.status === "FAILED" ? "danger" : "ochre"} dot>
              {d.status === "FAILED" ? "Not verified" : "Waiting for DNS"}
            </Badge>
          </span>
          {manage && (
            <Button size="sm" variant="ghost" className="ml-auto text-ink-muted" onClick={() => setRemove(true)}>
              <Trash size={14} /> Use a different address
            </Button>
          )}
        </div>
        <div className="p-5">
          <p className="mb-4 text-[13.5px] leading-relaxed text-ink">
            Sign in where you bought <span className="font-mono">{d.domain.split(".").slice(-2).join(".")}</span> (Whogohost, Qservers, GoDaddy, Cloudflare ...), open its DNS settings and add these two records. Copy each value exactly.
          </p>
          <DnsRecords records={records} checking={verify.isPending} />
          <details className="group mt-4 rounded-md border border-line bg-paper">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-[13px] font-medium text-ink">
              Where to add them, by provider
              <span className="text-ink-faint group-open:rotate-180">
                <MagnifyingGlass size={13} />
              </span>
            </summary>
            <ul className="divide-y divide-line border-t border-line">
              {DNS_PROVIDERS.map((p) => (
                <li key={p.name} className="grid gap-1 px-4 py-2.5 text-[12.5px] sm:grid-cols-[150px_1fr]">
                  <span className="font-medium text-ink">{p.name}</span>
                  <span className="text-ink-muted">{p.tip}</span>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </Panel>

      <Panel className="p-5" aria-live="polite">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="display-sm text-[18px] text-ink">{d.status === "FAILED" ? "We couldn't verify it for three days" : "Checking the records"}</p>
            <ul className="mt-3 flex flex-col gap-1.5">
              {records.map((r) => (
                <li key={r.type} className="flex items-center gap-2 text-[13px] text-ink">
                  <CheckMark state={r.state} checking={verify.isPending} />
                  {r.type} record {r.state === "OK" ? "found" : r.state === "MISMATCH" ? "found, but different" : "not found yet"}
                </li>
              ))}
            </ul>
            {d.failures.filter((f) => f === "DNS_ERROR").map((f) => (
              <p key={f} className="mt-2 flex items-center gap-1.5 text-[12.5px] text-ochre">
                <WarningCircle size={13} /> {FAILURE[f]}
              </p>
            ))}
            <p className="mt-3 text-[12px] text-ink-muted" suppressHydrationWarning>
              {d.lastCheckedAt ? `Last checked ${relativeTime(d.lastCheckedAt, now)} (${d.checkCount} ${d.checkCount === 1 ? "check" : "checks"}). ` : ""}
              {d.status === "PENDING" && manage ? (verify.isPending ? "Checking now..." : `Checking again in ${Math.max(0, Math.ceil(due / 1000))}s.`) : ""} DNS changes usually show within minutes, sometimes a few hours.
            </p>
          </div>
          {manage && (
            <div className="flex flex-col gap-2">
              <Button onClick={() => verify.mutate()} loading={verify.isPending} data-testid="verify-domain">
                Check now
              </Button>
              {process.env.NODE_ENV !== "production" && (
                <Button variant="ghost" size="sm" onClick={() => publish.mutate()} loading={publish.isPending} title="Development only: writes the records into the mock DNS" data-testid="dev-publish">
                  <Flask size={14} /> Publish in mock DNS
                </Button>
              )}
            </div>
          )}
        </div>
        <p className="mt-4 border-t border-line pt-3 text-[12.5px] text-ink-muted">
          Until then your site stays at <span className="font-mono text-ink">{subdomain}</span>.
        </p>
      </Panel>
      <ConfirmDialog open={remove} onOpenChange={setRemove} title={`Remove ${d.domain}?`} body="You can add another address straight after." confirmLabel="Remove" danger onConfirm={() => del.mutateAsync()} />
    </div>
  );
}

function Live({ d, canonical, manage }: { d: CustomDomain; canonical: string; manage: boolean }) {
  const qc = useQueryClient();
  const [remove, setRemove] = useState(false);
  const del = useMutation({ mutationFn: () => domainsApi.remove(d.id), onSuccess: () => { void qc.invalidateQueries({ queryKey: qk5.domains }); toast.success("Custom domain removed", "The booking site is back on its original address."); }, meta: { errorTitle: "Not removed" } });
  return (
    <Panel className="overflow-hidden">
      <div className="relative bg-[linear-gradient(160deg,color-mix(in_oklab,var(--palm)_10%,var(--surface)),var(--surface))] px-6 py-8">
        <span className="stamp absolute right-6 top-6 rotate-[-6deg] px-2 py-0.5 font-mono text-[12px] uppercase tracking-[0.2em] text-palm" style={{ ["--card" as string]: "var(--surface)" }}>
          Live
        </span>
        <p className="eyebrow">Your booking site</p>
        <p className="mt-3 flex min-w-0 items-center gap-2 break-all font-mono text-[16px] text-ink min-[420px]:text-[20px] sm:text-[28px]" data-testid="domain-live">
          <LockSimple size={20} weight="bold" className="text-palm" /> {d.domain}
        </p>
        <p className="mt-2 text-[13.5px] text-ink-muted">
          Verified {d.verifiedAt ? formatDateTime(d.verifiedAt) : ""}. Search engines see this address as the real one ({canonical}).
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <a href={`https://${d.domain}`} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink px-3.5 text-[13px] font-medium text-paper hover:opacity-90">
            Open it <ArrowSquareOut size={13} />
          </a>
          {manage && (
            <Button variant="ghost" onClick={() => setRemove(true)}>
              <Trash size={14} /> Remove
            </Button>
          )}
        </div>
      </div>
      <div className="grid gap-px border-t border-line bg-line sm:grid-cols-2">
        {d.records.map((r) => (
          <div key={r.type} className="bg-surface px-5 py-3">
            <p className="flex items-center gap-2 text-[12.5px] text-ink">
              <CheckCircle size={15} weight="fill" className="text-palm" /> {r.type} record in place
            </p>
            <p className="mt-0.5 truncate font-mono text-[11.5px] text-ink-muted">{r.value}</p>
          </div>
        ))}
      </div>
      <p className="border-t border-line px-5 py-3 text-[12.5px] text-ink-muted">We check the records every day. Keep them in place: if they disappear for three days the address stops working.</p>
      <ConfirmDialog open={remove} onOpenChange={setRemove} title={`Remove ${d.domain}?`} body="Guests who type it will stop reaching the booking site." confirmLabel="Remove" danger onConfirm={() => del.mutateAsync()} />
    </Panel>
  );
}
