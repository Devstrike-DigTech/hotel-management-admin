"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Paperclip, X } from "@phosphor-icons/react";
import { supportApi } from "@/lib/api/endpoints-m6";
import { qk6 } from "@/lib/api/hooks-m6";
import type { Attachment, SupportCategory, SupportPriority } from "@/lib/api/types-m6";
import { useMe } from "@/lib/api/hooks";
import { errorMessage } from "@/lib/api/client";
import { config } from "@/lib/config";
import { createStore, toast, useStore } from "@/lib/store";
import { roleLabel } from "@/lib/catalog";
import { usePropertyScope } from "@/components/shell/property-switcher";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/overlay";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { Segmented } from "@/components/ui/primitives";
import { bytes } from "@/components/export/export-view";

export const CATEGORIES: { v: SupportCategory; label: string }[] = [
  { v: "TECHNICAL", label: "Something isn't working" },
  { v: "BOOKINGS", label: "Bookings and reservations" },
  { v: "PAYMENTS", label: "Payments and payouts" },
  { v: "BILLING", label: "Our subscription and invoices" },
  { v: "ACCOUNT", label: "Account, staff and access" },
  { v: "DATA_PRIVACY", label: "Data and privacy (NDPA)" },
  { v: "FEATURE_REQUEST", label: "An idea or request" },
  { v: "OTHER", label: "Something else" },
];

export const SLA_HOURS: Record<string, number> = { starter: 48, growth: 24, pro: 8, enterprise: 2 };

/** Open the new-request sheet from anywhere; it captures the page you were on. */
export const supportStore = createStore<{ open: boolean; pageUrl: string | null; subject?: string }>({ open: false, pageUrl: null });
export function openSupport(opts: { pageUrl?: string | null; subject?: string } = {}) {
  const here = typeof window !== "undefined" ? window.location.pathname + window.location.search : null;
  supportStore.set({ open: true, pageUrl: opts.pageUrl ?? (here?.startsWith("/support") ? lastPage() : here), subject: opts.subject });
}

const LAST = "admin.lastPage";
export function rememberPage(path: string) {
  if (path.startsWith("/support")) return;
  try {
    sessionStorage.setItem(LAST, path);
  } catch {
    /* ignore */
  }
}
function lastPage(): string | null {
  try {
    return sessionStorage.getItem(LAST);
  } catch {
    return null;
  }
}

export function SupportHost() {
  const s = useStore(supportStore);
  return (
    <Sheet open={s.open} onOpenChange={(o) => !o && supportStore.set({ open: false, pageUrl: null })} eyebrow="Support" title="Ask for help" description="A person on our support team reads every request." width="max-w-xl">
      {s.open && <RequestForm pageUrl={s.pageUrl} subject={s.subject} onDone={() => supportStore.set({ open: false, pageUrl: null })} />}
    </Sheet>
  );
}

function RequestForm({ pageUrl, subject: initial, onDone }: { pageUrl: string | null; subject?: string; onDone: () => void }) {
  const me = useMe();
  const scope = usePropertyScope();
  const qc = useQueryClient();
  const router = useRouter();
  const file = useRef<HTMLInputElement>(null);
  const [subject, setSubject] = useState(initial ?? "");
  const [category, setCategory] = useState<SupportCategory>("TECHNICAL");
  const [priority, setPriority] = useState<SupportPriority>("NORMAL");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const plan = me.data?.subscription.planCode ?? "starter";
  const hours = SLA_HOURS[plan] ?? 24;
  const up = useMutation({ mutationFn: supportApi.upload, onSuccess: (a) => setFiles((f) => [...f, a]), meta: { errorTitle: "Not attached" } });
  const send = useMutation({
    mutationFn: () =>
      supportApi.create({
        subject: subject.trim(),
        category,
        priority,
        message: message.trim(),
        attachmentKeys: files.map((f) => f.key),
        context: { pageUrl: pageUrl ?? undefined, appVersion: config.appVersion },
      }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: qk6.supportAll });
      void qc.invalidateQueries({ queryKey: qk6.supportSummary });
      toast.success(`Request ${r.number} sent`, `We reply within ${r.slaHours} hours on your plan, here and by email.`);
      onDone();
      router.push(`/support/${r.id}`);
    },
    onError: (e) => setErr(errorMessage(e)),
    meta: { silent: true },
  });
  const valid = subject.trim().length >= 3 && message.trim().length >= 1;
  const ua = typeof navigator !== "undefined" ? browserName(navigator.userAgent) : "";
  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        if (valid) send.mutate();
      }}
    >
      <Field label="Subject">
        <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={150} placeholder="The Ledger won't load for room 204" data-testid="support-subject" autoFocus />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Field label="About">
          <Select value={category} onChange={(e) => setCategory(e.target.value as SupportCategory)} data-testid="support-category">
            {CATEGORIES.map((c) => (
              <option key={c.v} value={c.v}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="How urgent">
          <Segmented
            label="Priority"
            size="sm"
            value={priority}
            onChange={setPriority}
            options={[
              { value: "LOW", label: "Low" },
              { value: "NORMAL", label: "Normal" },
              { value: "HIGH", label: "High" },
              { value: "URGENT", label: "Urgent" },
            ]}
          />
        </Field>
      </div>
      <Field label="What happened" hint="What you did, what you expected and what you saw. Screenshots help.">
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} className="min-h-36" maxLength={5000} data-testid="support-message" />
      </Field>
      <div className="flex flex-col gap-2">
        <input ref={file} type="file" className="sr-only" accept="image/png,image/jpeg,image/webp,application/pdf,text/plain,text/csv" onChange={(e) => e.target.files?.[0] && up.mutate(e.target.files[0])} />
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => file.current?.click()} loading={up.isPending} disabled={files.length >= 5}>
            <Paperclip size={14} /> Attach a file
          </Button>
          <span className="text-[12px] text-ink-muted">Images, PDF, text or CSV, up to 10 MB</span>
        </div>
        {files.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {files.map((f) => (
              <li key={f.key} className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-line bg-surface-2/60 pl-2 pr-1 text-[12px] text-ink">
                <Paperclip size={12} /> {f.name} <span className="text-ink-muted">{bytes(f.size)}</span>
                <button type="button" aria-label={`Remove ${f.name}`} className="grid h-5 w-5 place-items-center rounded-xs text-ink-muted hover:bg-surface-2 hover:text-ink" onClick={() => setFiles(files.filter((x) => x.key !== f.key))}>
                  <X size={11} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="rounded-md border border-dashed border-line-strong bg-paper px-4 py-3" data-testid="support-context">
        <p className="eyebrow mb-2">Sent with it, so you don&rsquo;t have to explain</p>
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-[12px]">
          <dt className="text-ink-muted">Hotel</dt>
          <dd className="truncate text-ink">{me.data?.tenant.name}</dd>
          <dt className="text-ink-muted">Property</dt>
          <dd className="truncate text-ink">{scope.current?.name ?? "--"}</dd>
          <dt className="text-ink-muted">You</dt>
          <dd className="truncate text-ink">
            {me.data?.user.fullName} <span className="text-ink-muted">({roleLabel(me.data?.user)})</span>
          </dd>
          <dt className="text-ink-muted">Page</dt>
          <dd className="truncate font-mono text-ink">{pageUrl ?? "--"}</dd>
          <dt className="text-ink-muted">App</dt>
          <dd className="truncate font-mono text-ink">
            {config.appVersion} &middot; {ua}
          </dd>
        </dl>
      </div>
      {err && (
        <p role="alert" className="text-[13px] text-danger">
          {err}
        </p>
      )}
      <div className="flex items-center justify-between gap-3 border-t border-line pt-4">
        <p className="text-[12px] text-ink-muted">First reply within {hours} hours on your plan.</p>
        <Button type="submit" loading={send.isPending} disabled={!valid} data-testid="support-send">
          Send request
        </Button>
      </div>
    </form>
  );
}

function browserName(ua: string) {
  const m = /(Edg|Chrome|Firefox|Safari)\/(\d+)/.exec(ua);
  const name = m ? ({ Edg: "Edge", Chrome: "Chrome", Firefox: "Firefox", Safari: "Safari" } as Record<string, string>)[m[1]] : "Browser";
  const os = /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return `${name}${m ? ` ${m[2]}` : ""}${os ? ` on ${os}` : ""}`;
}
