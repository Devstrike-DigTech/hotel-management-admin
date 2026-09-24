"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowClockwise, Check, DownloadSimple, FileZip, Info, Link as LinkIcon, WarningOctagon } from "@phosphor-icons/react";
import { useCan } from "@/lib/permissions";
import { exportApi } from "@/lib/api/endpoints-m6";
import { qk6, useExports } from "@/lib/api/hooks-m6";
import type { DataExport } from "@/lib/api/types-m6";
import { errorMessage, isApiError } from "@/lib/api/client";
import { formatDateTime, number, relativeTime } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";

const INCLUDED = [
  "Properties, room types and rooms",
  "Staff (no passwords)",
  "Guests, with ID numbers",
  "Reservations and stays",
  "Folios, invoices, receipts, payments",
  "Shifts and counts",
  "Housekeeping and maintenance",
  "Rates, promo codes, companies, City Ledger",
  "Point of sale, stock and loyalty",
  "Reviews, channel bookings",
  "The full audit log",
];

export function bytes(n: number | null | undefined) {
  if (n == null) return "--";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function ExportView() {
  const q = useExports();
  const qc = useQueryClient();
  const { can } = useCan();
  const allowed = can("data.export");
  const [json, setJson] = useState(true);
  const [csv, setCsv] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const req = useMutation({
    mutationFn: () => exportApi.request([...(json ? ["json" as const] : []), ...(csv ? ["csv" as const] : [])]),
    onSuccess: (r) => {
      qc.setQueryData(qk6.exports, (x: DataExport[] | undefined) => [r, ...(x ?? []).filter((e) => e.id !== r.id)]);
      void qc.invalidateQueries({ queryKey: qk6.exports });
    },
    onError: (e) => setErr(isApiError(e) && e.code === "INVALID_STATE" ? "An export is already being prepared. It will be ready in a moment." : errorMessage(e)),
    meta: { silent: true },
  });
  const list = q.data ?? [];
  const current = list[0];
  const busy = current && (current.status === "QUEUED" || current.status === "RUNNING");
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <FileZip size={14} weight="duotone" /> Data export
          </>
        }
        title={
          <>
            Everything, <em>in one file</em>.
          </>
        }
        description="A zip of every record the hotel keeps here, as JSON and spreadsheets, with a README that explains each file. Yours to archive, audit or take elsewhere."
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-80" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-w-0 flex-col gap-6">
            {current ? <Current e={current} /> : null}
            <Panel className="p-5">
              <h2 className="display-sm text-[18px] text-ink">{current ? "Make a new export" : "Make an export"}</h2>
              <p className="mt-1 text-[13px] text-ink-muted">It takes a minute or two for a busy hotel. You can leave this page; the file waits for you here for 7 days.</p>
              <div className="mt-4 flex flex-wrap gap-5">
                <Checkbox checked={json} onChange={setJson} label={<>JSON <span className="text-ink-muted">for developers</span></>} />
                <Checkbox checked={csv} onChange={setCsv} label={<>CSV <span className="text-ink-muted">for spreadsheets</span></>} />
              </div>
              {err && (
                <p role="alert" className="mt-3 text-[13px] text-danger">
                  {err}
                </p>
              )}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Button
                  onClick={() => {
                    setErr(null);
                    req.mutate();
                  }}
                  loading={req.isPending}
                  disabled={!allowed || busy || (!json && !csv)}
                  data-testid="request-export"
                >
                  <FileZip size={15} /> Request export
                </Button>
                {!allowed && <span className="text-[12.5px] text-ink-muted">Only the owner can export all data.</span>}
              </div>
            </Panel>
            {list.length > 1 && (
              <Panel className="overflow-hidden">
                <h2 className="display-sm border-b border-line px-5 py-3 text-[17px] text-ink">Earlier exports</h2>
                <ul className="divide-y divide-line">
                  {list.slice(1).map((e) => (
                    <HistoryRow key={e.id} e={e} />
                  ))}
                </ul>
              </Panel>
            )}
            {list.length === 0 && (
              <Panel>
                <EmptyState compact glyph="ladder" title="No exports yet" body="The first one is a good way to see exactly what we hold." />
              </Panel>
            )}
          </div>
          <aside className="flex flex-col gap-4 self-start">
            <Panel className="p-5">
              <p className="eyebrow">In the zip</p>
              <ul className="mt-3 flex flex-col gap-1.5 text-[13px] text-ink">
                {INCLUDED.map((i) => (
                  <li key={i} className="flex gap-2">
                    <Check size={14} weight="bold" className="mt-0.5 shrink-0 text-palm" />
                    {i}
                  </li>
                ))}
              </ul>
              <p className="mt-4 border-t border-line pt-3 font-mono text-[11.5px] leading-relaxed text-ink-muted">
                README.txt
                <br />
                manifest.json
                <br />
                json/reservations.json
                <br />
                csv/reservations.csv ...
              </p>
            </Panel>
            <Panel className="flex gap-3 p-4 text-[12.5px] leading-relaxed text-ink-muted">
              <Info size={17} weight="duotone" className="mt-0.5 shrink-0 text-adire" />
              <p>The file holds guests&rsquo; personal data, ID numbers included. Store it as you would the guest register. Every request and download is in the audit log (NDPA).</p>
            </Panel>
          </aside>
        </div>
      )}
    </>
  );
}

function Current({ e }: { e: DataExport }) {
  const qc = useQueryClient();
  const now = useNow(1000);
  const link = useMutation({
    mutationFn: () => exportApi.link(e.id),
    onSuccess: (r) => {
      qc.setQueryData(qk6.exports, (x: DataExport[] | undefined) => (x ?? []).map((y) => (y.id === r.id ? r : y)));
      toast.success("New link ready", "It works for 24 hours.");
    },
    meta: { errorTitle: "No new link" },
  });
  const running = e.status === "QUEUED" || e.status === "RUNNING";
  const linkLive = e.status === "READY" && !!e.downloadUrl && (!e.expiresAt || Date.parse(e.expiresAt) > now);
  const pct = e.status === "READY" ? 100 : Math.max(e.status === "QUEUED" ? 2 : 4, Math.min(99, e.progressPct));
  const rows = e.entities.reduce((a, x) => a + x.rows, 0);
  return (
    <Panel className="overflow-hidden" data-testid="export-current" data-status={e.status}>
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
        <FileZip size={20} weight="duotone" className={cn(e.status === "READY" ? "text-palm" : e.status === "FAILED" ? "text-danger" : "text-ink-muted")} />
        <span className="min-w-0 flex-1 truncate font-mono text-[13.5px] text-ink">{e.fileName ?? "Preparing the export"}</span>
        <StatusBadge e={e} now={now} />
      </div>
      <div className="px-5 py-5">
        {running && (
          <>
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-ink">{e.status === "QUEUED" ? "Waiting to start" : e.entities.length ? `Writing ${e.entities[e.entities.length - 1].name.replace(/_/g, " ")}` : "Reading the records"}</span>
              <span className="font-mono text-ink" data-testid="export-progress">
                {Math.round(pct)}%
              </span>
            </div>
            <div className="relative mt-2 h-2 overflow-hidden rounded-xs bg-surface-2" role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100} aria-label="Export progress">
              <div className="absolute inset-y-0 left-0 bg-laterite transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
              <div className="absolute inset-0 bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgb(255_255_255/0.18)_6px_12px)]" />
            </div>
            <p className="mt-2 text-[12px] text-ink-muted">
              Requested by {e.requestedBy.fullName} {relativeTime(e.createdAt, now)}. {e.entities.length ? `${number(rows)} rows so far.` : ""}
            </p>
          </>
        )}
        {e.status === "READY" && (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <dl className="grid flex-1 grid-cols-3 gap-4">
              <div>
                <dt className="text-[11.5px] text-ink-muted">Size</dt>
                <dd className="font-mono text-[18px] text-ink">{bytes(e.sizeBytes)}</dd>
              </div>
              <div>
                <dt className="text-[11.5px] text-ink-muted">Records</dt>
                <dd className="font-mono text-[18px] text-ink">{number(rows)}</dd>
              </div>
              <div>
                <dt className="text-[11.5px] text-ink-muted">Files</dt>
                <dd className="font-mono text-[18px] text-ink">{e.entities.length}</dd>
              </div>
            </dl>
            {linkLive ? (
              <a href={e.downloadUrl!} className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-laterite px-5 text-[15px] font-medium text-laterite-ink hover:bg-laterite-hover" data-testid="download-export" download={e.fileName ?? undefined}>
                <DownloadSimple size={17} weight="bold" /> Download
              </a>
            ) : (
              <Button size="lg" variant="secondary" onClick={() => link.mutate()} loading={link.isPending} data-testid="export-new-link">
                <LinkIcon size={16} /> Get a new link
              </Button>
            )}
          </div>
        )}
        {e.status === "FAILED" && (
          <p className="flex items-start gap-2 text-[13px] text-ink">
            <WarningOctagon size={17} weight="duotone" className="mt-0.5 shrink-0 text-danger" />
            The export stopped: {e.error ?? "an unexpected error"}. Request it again; if it fails twice, contact support.
          </p>
        )}
        {e.status === "EXPIRED" && <p className="text-[13px] text-ink-muted">The file was deleted after 7 days. Request a new export for current data.</p>}
        {e.status === "READY" && e.expiresAt && (
          <p className="mt-3 text-[12px] text-ink-muted" suppressHydrationWarning>
            {linkLive ? `The link works until ${formatDateTime(e.expiresAt)} (${relativeTime(e.expiresAt, now)}).` : "The link has run out; the file is still here."} Made {formatDateTime(e.finishedAt)} for {e.requestedBy.fullName}
            {e.reason === "OFFBOARDING" ? ", for offboarding" : ""}.
          </p>
        )}
      </div>
      {e.entities.length > 0 && (
        <details className="group border-t border-line">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-2.5 text-[12.5px] font-medium text-ink-muted hover:text-ink">
            {e.entities.length} tables
            <ArrowClockwise size={12} className="opacity-0" />
          </summary>
          <ul className="grid grid-cols-1 gap-x-6 gap-y-1 px-5 pb-4 sm:grid-cols-2">
            {e.entities.map((x) => (
              <li key={x.name} className="flex justify-between border-b border-dashed border-line py-1 text-[12.5px]">
                <span className="font-mono text-ink">{x.name}</span>
                <span className="font-mono text-ink-muted">{number(x.rows)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </Panel>
  );
}

function StatusBadge({ e, now }: { e: DataExport; now: number }) {
  if (e.status === "READY" && e.expiresAt && Date.parse(e.expiresAt) < now) return <Badge tone="ochre">Link ran out</Badge>;
  const m = { QUEUED: ["neutral", "Queued"], RUNNING: ["adire", "Preparing"], READY: ["palm", "Ready"], FAILED: ["danger", "Failed"], EXPIRED: ["neutral", "Deleted"] } as const;
  const [tone, label] = m[e.status];
  return (
    <Badge tone={tone} dot>
      {label}
    </Badge>
  );
}

function HistoryRow({ e }: { e: DataExport }) {
  const now = useNow(60_000);
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]">
      <span className="font-mono text-ink-muted">{formatDateTime(e.createdAt)}</span>
      <span className="text-ink">{e.requestedBy.fullName}</span>
      {e.reason === "OFFBOARDING" && <Badge tone="brass">Offboarding</Badge>}
      <span className="ml-auto font-mono text-[12px] text-ink-muted">{bytes(e.sizeBytes)}</span>
      <StatusBadge e={e} now={now} />
    </li>
  );
}
