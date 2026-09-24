"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowSquareOut, ArrowUpRight, BookOpenText, CheckCircle, Circle, Code, Key, WebhooksLogo } from "@phosphor-icons/react";
import { config } from "@/lib/config";
import { useApiKeys, useEndpoints, useQuickstart } from "@/lib/api/hooks-m6";
import { cn } from "@/lib/cn";
import { PageHeader, Panel, Segmented } from "@/components/ui/primitives";
import { DevTabs } from "./dev-tabs";
import { CopyButton } from "./parts";

type Lang = "curl" | "node" | "python";

function snippets(base: string): Record<Lang, string> {
  return {
    curl: `curl ${base}/availability?checkIn=2026-10-02&checkOut=2026-10-04 \\
  -H "Authorization: Bearer $HOTEL_API_KEY"`,
    node: `const res = await fetch(
  "${base}/availability?checkIn=2026-10-02&checkOut=2026-10-04",
  { headers: { Authorization: \`Bearer \${process.env.HOTEL_API_KEY}\` } },
);
const { roomTypes } = await res.json();`,
    python: `import os, requests

r = requests.get(
    "${base}/availability",
    params={"checkIn": "2026-10-02", "checkOut": "2026-10-04"},
    headers={"Authorization": f"Bearer {os.environ['HOTEL_API_KEY']}"},
)
room_types = r.json()["roomTypes"]`,
  };
}

const VERIFY = `// Node: verify X-Signature before trusting the body
import crypto from "node:crypto";

function verify(rawBody, header, secret) {
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false; // replay window
  const mac = crypto.createHmac("sha256", secret).update(\`\${t}.\${rawBody}\`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(v1));
}`;

export function QuickStartView() {
  const keys = useApiKeys();
  const eps = useEndpoints();
  const meta = useQuickstart();
  const [lang, setLang] = useState<Lang>("curl");
  const base = meta.data?.baseUrl ?? `${config.apiOrigin}/api/partner/v1`;
  const docs = meta.data?.docsUrl ?? `${config.webUrl}/developers`;
  const hasTest = !!keys.data?.some((k) => k.environment === "TEST" && k.status !== "REVOKED");
  const used = !!keys.data?.some((k) => k.lastUsedAt);
  const hasHook = !!eps.data?.length;
  const code = lang === "curl" && meta.data?.sampleCurl ? meta.data.sampleCurl : snippets(base)[lang];
  const steps = [
    { done: hasTest, title: "Create a test key", body: "Test keys see your real rooms and rates, but writes are a dry run: nothing is booked, charged or messaged.", href: "/developers/api-keys", cta: "API keys", icon: Key },
    { done: used, title: "Make the first request", body: "Send the key as a Bearer token. Every response carries X-Request-Id; quote it if you write to us.", icon: Code },
    { done: hasHook, title: "Listen for events", body: "Add an HTTPS endpoint, pick the events, and check each request's signature with your signing secret.", href: "/developers/webhooks", cta: "Webhooks", icon: WebhooksLogo },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <BookOpenText size={14} weight="duotone" /> Developers
          </>
        }
        title={
          <>
            Connect in <em>an afternoon</em>.
          </>
        }
        description="The partner API gives your booking engine, BI tools and door locks the same rooms, rates and reservations the desk sees, with keys you control."
        actions={
          <a href={docs} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-md border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink hover:bg-surface-2" data-testid="docs-link">
            Read the docs <ArrowSquareOut size={14} />
          </a>
        }
      />
      <DevTabs />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-3">
              <span className="eyebrow">Three steps</span>
              <span className="font-mono text-[12px] text-ink-muted">
                {doneCount} / {steps.length}
              </span>
            </div>
            <ol className="divide-y divide-line">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-4 px-5 py-4">
                  <span className="mt-0.5">{s.done ? <CheckCircle size={22} weight="fill" className="text-palm" /> : <Circle size={22} className="text-line-strong" />}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-[14.5px] font-medium text-ink">
                      <span className="font-mono text-[12px] text-ink-faint">0{i + 1}</span> {s.title}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">{s.body}</p>
                  </div>
                  {s.href && (
                    <Link href={s.href} className="inline-flex h-8 shrink-0 items-center gap-1 self-center rounded-sm px-2 text-[13px] font-medium text-laterite hover:bg-laterite-wash">
                      {s.cta} <ArrowUpRight size={13} />
                    </Link>
                  )}
                </li>
              ))}
            </ol>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
              <h2 className="display-sm text-[18px] text-ink">Your first request</h2>
              <Segmented
                size="sm"
                label="Language"
                value={lang}
                onChange={setLang}
                options={[
                  { value: "curl", label: "curl" },
                  { value: "node", label: "Node" },
                  { value: "python", label: "Python" },
                ]}
                className="ml-auto"
              />
            </div>
            <div className="relative">
              <pre className="scrollbar-thin overflow-x-auto bg-[#1b1a17] p-5 pr-24 font-mono text-[12.5px] leading-relaxed text-[#efe8dc] dark:bg-[#0c0b09]">{code}</pre>
              <CopyButton value={code} className="absolute right-3 top-3 border-white/15 bg-white/5 text-[#efe8dc] hover:bg-white/10" />
            </div>
            <p className="border-t border-line px-5 py-3 text-[12.5px] text-ink-muted">
              Writes need an <span className="font-mono text-ink">Idempotency-Key</span> header; retries with the same key return the first result. Lists are cursor-paged: pass <span className="font-mono text-ink">nextCursor</span> back as <span className="font-mono text-ink">cursor</span>.
            </p>
          </Panel>

          <Panel className="overflow-hidden">
            <div className="flex items-center border-b border-line px-5 py-3">
              <h2 className="display-sm text-[18px] text-ink">Verify a webhook</h2>
              <CopyButton value={VERIFY} className="ml-auto" />
            </div>
            <pre className="scrollbar-thin overflow-x-auto bg-[#1b1a17] p-5 font-mono text-[12px] leading-relaxed text-[#efe8dc] dark:bg-[#0c0b09]">{VERIFY}</pre>
          </Panel>
        </div>

        <aside className="flex flex-col gap-4 self-start">
          <Panel className="p-5">
            <p className="eyebrow">Endpoint</p>
            <p className="mt-2 break-all font-mono text-[13px] text-ink">{base}</p>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[12.5px]">
              <dt className="text-ink-muted">Auth</dt>
              <dd className="font-mono text-ink">Bearer hk_live_...</dd>
              <dt className="text-ink-muted">Rate limit</dt>
              <dd className="font-mono text-ink">600/min per key</dd>
              <dt className="text-ink-muted">Format</dt>
              <dd className="text-ink">JSON, amounts in kobo</dd>
              <dt className="text-ink-muted">Spec</dt>
              <dd>
                <a href={meta.data?.openApiUrl ?? `${config.apiOrigin}/api/partner/v1/openapi.json`} target="_blank" rel="noreferrer" className="font-mono text-laterite hover:underline">
                  openapi.json
                </a>
              </dd>
            </dl>
          </Panel>
          <a href={docs} target="_blank" rel="noreferrer" className={cn("group relative block overflow-hidden rounded-lg border border-line bg-[#1f2d48] p-5 text-[#ece3d2] dark:bg-[#141d30]")}>
            <svg aria-hidden viewBox="0 0 200 120" className="absolute -right-6 -top-4 h-32 w-48 text-[#ece3d2] opacity-[0.12]">
              {Array.from({ length: 6 }, (_, i) => (
                <path key={i} d={`M0 ${20 + i * 16} q 25 -12 50 0 t 50 0 t 50 0 t 50 0`} fill="none" stroke="currentColor" strokeWidth="1" />
              ))}
            </svg>
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#d6a94a]">Developer docs</p>
            <p className="display-sm relative mt-2 text-[20px] leading-snug">Guides, errors, webhooks and the full reference.</p>
            <p className="relative mt-3 inline-flex items-center gap-1.5 text-[13px] text-[#ece3d2]/80 group-hover:text-[#ece3d2]">
              {docs.replace(/^https?:\/\//, "")} <ArrowSquareOut size={13} />
            </p>
          </a>
        </aside>
      </div>
    </>
  );
}
