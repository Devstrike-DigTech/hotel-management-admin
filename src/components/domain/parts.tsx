"use client";

import { useState } from "react";
import { Check, CheckCircle, CircleNotch, Copy, Hourglass, WarningCircle, XCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export type CheckState = "OK" | "MISSING" | "MISMATCH" | "PENDING";

export interface DnsRecordView {
  type: "TXT" | "CNAME" | "A";
  /** the full name to create, e.g. _hotelos-verify.book.hotel.com */
  name: string;
  /** what a typical DNS panel wants in "Host" (relative to the zone) */
  host?: string | null;
  value: string;
  ttl?: number;
  purpose: string;
  state?: CheckState;
  found?: string[] | null;
}

export function CopyField({ value, label, mono = true, testId }: { value: string; label: string; mono?: boolean; testId?: string }) {
  const [done, setDone] = useState(false);
  return (
    <div className="flex min-w-0 items-stretch overflow-hidden rounded-sm border border-line-strong bg-paper">
      <code className={cn("min-w-0 flex-1 overflow-x-auto whitespace-nowrap px-2.5 py-2 text-[12.5px] text-ink", mono && "font-mono")} data-testid={testId}>
        {value}
      </code>
      <button
        type="button"
        aria-label={`Copy ${label}`}
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => {
            setDone(true);
            window.setTimeout(() => setDone(false), 1500);
          });
        }}
        className={cn("flex shrink-0 items-center gap-1 border-l border-line px-2.5 text-[12px] font-medium transition-colors", done ? "bg-palm-wash text-palm" : "text-ink-muted hover:bg-surface-2 hover:text-ink")}
      >
        {done ? <Check size={13} weight="bold" /> : <Copy size={13} />}
        {done ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

export function CheckMark({ state, checking }: { state?: CheckState; checking?: boolean }) {
  if (checking) return <CircleNotch size={18} className="animate-spin text-ink-muted" aria-label="checking" />;
  if (state === "OK") return <CheckCircle size={18} weight="fill" className="text-palm" aria-label="found" />;
  if (state === "MISMATCH") return <WarningCircle size={18} weight="fill" className="text-ochre" aria-label="found with a different value" />;
  if (state === "MISSING") return <XCircle size={18} weight="fill" className="text-danger" aria-label="not found yet" />;
  return <Hourglass size={18} className="text-ink-faint" aria-label="not checked yet" />;
}

/** The records to add, as a card per record with copy buttons: easier to follow on a phone than a table. */
export function DnsRecords({ records, checking }: { records: DnsRecordView[]; checking?: boolean }) {
  return (
    <ol className="flex flex-col gap-3">
      {records.map((r, i) => (
        <li key={r.type + r.name} className="rounded-md border border-line bg-surface">
          <div className="flex items-center gap-3 border-b border-line px-4 py-2.5">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-ink font-mono text-[11px] text-paper">{i + 1}</span>
            <span className="rounded-xs border border-line-strong px-1.5 font-mono text-[11px] font-medium tracking-wider text-ink">{r.type}</span>
            <span className="flex-1 text-[13px] text-ink-muted">{r.purpose}</span>
            <CheckMark state={r.state} checking={checking} />
          </div>
          <div className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto]">
            <div className="min-w-0">
              <p className="mb-1 text-[11.5px] text-ink-muted">Host / name</p>
              <CopyField value={r.host ?? r.name} label={`${r.type} host`} testId={`dns-${r.type}-host`} />
              {r.host && r.host !== r.name && <p className="mt-1 truncate font-mono text-[10.5px] text-ink-faint" title={r.name}>full name: {r.name}</p>}
            </div>
            <div className="min-w-0">
              <p className="mb-1 text-[11.5px] text-ink-muted">{r.type === "CNAME" ? "Points to" : "Value"}</p>
              <CopyField value={r.value} label={`${r.type} value`} testId={`dns-${r.type}-value`} />
            </div>
            <div>
              <p className="mb-1 text-[11.5px] text-ink-muted">TTL</p>
              <p className="flex h-[34px] items-center font-mono text-[12.5px] text-ink">{r.ttl ?? 3600}</p>
            </div>
          </div>
          {r.state === "MISMATCH" && r.found?.length ? (
            <p className="border-t border-line bg-ochre-wash/50 px-4 py-2 text-[12.5px] text-ink">
              We found <span className="font-mono">{r.found.join(", ")}</span> instead. Edit the record so it matches exactly.
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}

export const DNS_PROVIDERS: { name: string; tip: string }[] = [
  { name: "Cloudflare", tip: "DNS, Records, Add record. Set the CNAME's proxy status to DNS only (grey cloud) until the domain shows Verified." },
  { name: "Whogohost", tip: "Client area, Domains, Manage DNS. Enter the host without your domain at the end; it is added for you." },
  { name: "Qservers / cPanel", tip: "cPanel, Zone Editor, Manage. Add a TXT and a CNAME record with the values below." },
  { name: "GoDaddy", tip: "My Products, DNS. The Name field is the host only; GoDaddy adds your domain." },
  { name: "Google / Squarespace", tip: "DNS, Custom records. Use the host only, and leave the TTL at the default." },
];
