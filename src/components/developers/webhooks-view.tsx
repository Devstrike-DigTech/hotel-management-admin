"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowCounterClockwise,
  ArrowsClockwise,
  CaretRight,
  Pause,
  PaperPlaneTilt,
  PencilSimple,
  Play,
  Plus,
  Trash,
  WarningOctagon,
  WebhooksLogo,
} from "@phosphor-icons/react";
import { useCan } from "@/lib/permissions";
import { webhooksApi } from "@/lib/api/endpoints-m6";
import { qk6, useDeliveries, useDelivery, useEndpoints, useWebhookEvents } from "@/lib/api/hooks-m6";
import type { WebhookDelivery, WebhookEndpoint } from "@/lib/api/types-m6";
import { errorMessage } from "@/lib/api/client";
import { formatDateTime, formatTime, relativeTime } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/use-now";
import { ALL_EVENTS, groupEvents } from "@/lib/m6-catalog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, Sheet } from "@/components/ui/overlay";
import { Field, Input } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, Segmented, Skeleton } from "@/components/ui/primitives";
import { DevTabs } from "./dev-tabs";
import { EventPicker, HttpStatus, SecretReveal, prettyBody } from "./parts";

export function WebhooksView() {
  const q = useEndpoints();
  const { can } = useCan();
  const manage = can("integrations.manage");
  const [sel, setSel] = useState<string | null>(null);
  const [form, setForm] = useState<WebhookEndpoint | "new" | null>(null);
  const [secret, setSecret] = useState<{ value: string; url: string } | null>(null);
  const eps = q.data ?? [];
  const current = eps.find((e) => e.id === sel) ?? eps[0] ?? null;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <WebhooksLogo size={14} weight="duotone" /> Developers
          </>
        }
        title={
          <>
            Tell your systems <em>the moment</em> it happens.
          </>
        }
        description="We POST a signed JSON event to your URL when a booking is made, a guest checks in, a payment lands or a room turns clean. Failed deliveries are retried for up to 24 hours."
        actions={
          manage && (
            <Button onClick={() => setForm("new")} data-testid="new-endpoint">
              <Plus size={15} weight="bold" /> Add endpoint
            </Button>
          )
        }
      />
      <DevTabs />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-96" />
      ) : eps.length === 0 ? (
        <Panel>
          <EmptyState
            glyph="river"
            title="No endpoints yet"
            body="Add the HTTPS address of the system that should hear about bookings, payments and room changes. We send a test event straight away so you can see it arrive."
            action={manage && <Button onClick={() => setForm("new")}>Add an endpoint</Button>}
          />
        </Panel>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)]">
          <ul className="flex flex-col gap-2" aria-label="Endpoints">
            {eps.map((e) => {
              const on = current?.id === e.id;
              return (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSel(e.id)}
                    aria-current={on ? "true" : undefined}
                    data-testid="endpoint-item"
                    className={cn("w-full rounded-md border px-3.5 py-3 text-left transition-colors", on ? "border-ink bg-surface shadow-[0_0_0_1px_var(--ink)]" : "border-line bg-surface hover:border-line-strong")}
                  >
                    <span className="flex items-center gap-2">
                      <StatusDot e={e} />
                      <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] text-ink">{e.url.replace(/^https?:\/\//, "")}</span>
                      <CaretRight size={12} className="text-ink-faint" />
                    </span>
                    <span className="mt-1 flex items-center justify-between gap-2 pl-4 text-[11.5px] text-ink-muted">
                      <span className="truncate">{autoOff(e) ? <span className="text-danger">Switched off after failures</span> : e.status === "DISABLED" ? "Paused" : e.description || `${e.events.length} events`}</span>
                      <span className="shrink-0" title="Last 24 hours">
                        <span className="font-mono text-ink">{e.stats24h.delivered}</span> sent
                        {e.stats24h.failed > 0 && (
                          <>
                            {" "}
                            &middot; <span className="font-mono text-danger">{e.stats24h.failed}</span> failed
                          </>
                        )}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          {current && <EndpointDetail key={current.id} e={current} manage={manage} onEdit={() => setForm(current)} onSecret={(v) => setSecret({ value: v, url: current.url })} />}
        </div>
      )}
      <Sheet open={!!form} onOpenChange={(o) => !o && setForm(null)} eyebrow="Webhook endpoint" title={form === "new" ? "Add an endpoint" : "Edit endpoint"} width="max-w-xl">
        {form && (
          <EndpointForm
            key={form === "new" ? "new" : form.id}
            editing={form === "new" ? null : form}
            onClose={() => setForm(null)}
            onCreated={(ep, s) => {
              setForm(null);
              setSel(ep.id);
              setSecret({ value: s, url: ep.url });
            }}
          />
        )}
      </Sheet>
      <SigningSecretDialog secret={secret} onDone={() => setSecret(null)} />
    </>
  );
}

const autoOff = (e: WebhookEndpoint) => e.status === "DISABLED" && e.disabledReason === "SUSTAINED_FAILURE";

function StatusDot({ e }: { e: WebhookEndpoint }) {
  const failing = e.status === "ACTIVE" && !!e.failingSince;
  return <span aria-label={autoOff(e) ? "switched off after failures" : e.status === "DISABLED" ? "paused" : failing ? "failing" : "active"} className={cn("h-2 w-2 shrink-0 rounded-full", autoOff(e) ? "bg-danger" : e.status === "DISABLED" ? "bg-ink-faint" : failing ? "bg-ochre" : "bg-palm")} />;
}

function EndpointDetail({ e, manage, onEdit, onSecret }: { e: WebhookEndpoint; manage: boolean; onEdit: () => void; onSecret: (s: string) => void }) {
  const qc = useQueryClient();
  const now = useNow(30_000);
  const [filter, setFilter] = useState<"all" | "FAILED" | "SUCCEEDED">("all");
  const [cursor, setCursor] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [del, setDel] = useState(false);
  const [rotate, setRotate] = useState(false);
  const d = useDeliveries(e.id, { status: filter === "all" ? undefined : filter, cursor });
  const refresh = () => {
    void qc.invalidateQueries({ queryKey: qk6.endpoints });
    void qc.invalidateQueries({ queryKey: qk6.deliveriesAll });
  };
  const ping = useMutation({
    mutationFn: () => webhooksApi.test(e.id),
    onSuccess: (r) => {
      setFresh(r.id);
      setFilter("all");
      setCursor(null);
      qc.setQueryData(qk6.delivery(r.id), r);
      refresh();
      if (r.status === "SUCCEEDED") toast.success("Test event delivered", `Your endpoint answered ${r.responseStatus}${r.durationMs != null ? ` in ${r.durationMs} ms` : ""}.`);
      else toast.warning("Test event not accepted", r.error || (r.responseStatus ? `Your endpoint answered ${r.responseStatus}.` : "No answer from your endpoint."));
      setOpen(r.id);
    },
    meta: { errorTitle: "Test not sent" },
  });
  const toggle = useMutation({
    mutationFn: () => webhooksApi.update(e.id, { status: e.status === "ACTIVE" ? "DISABLED" : "ACTIVE" }),
    onSuccess: (r) => {
      refresh();
      toast.success(r.status === "ACTIVE" ? "Endpoint on" : "Endpoint paused", r.status === "ACTIVE" ? "New events will be delivered." : "Events are kept and not sent until you resume.");
    },
    meta: { errorTitle: "Not changed" },
  });
  const remove = useMutation({ mutationFn: () => webhooksApi.remove(e.id), onSuccess: refresh, meta: { errorTitle: "Not removed" } });
  const rot = useMutation({
    mutationFn: () => webhooksApi.rotateSecret(e.id),
    onSuccess: (r) => {
      refresh();
      onSecret(r.secret);
    },
    meta: { errorTitle: "Not rotated" },
  });

  useEffect(() => {
    if (!fresh) return;
    const id = window.setTimeout(() => setFresh(null), 6000);
    return () => window.clearTimeout(id);
  }, [fresh]);

  const groups = groupEvents(e.events);
  return (
    <div className="flex min-w-0 flex-col gap-5">
      {autoOff(e) && (
        <div role="alert" data-testid="auto-disabled" className="flex flex-col gap-3 rounded-md border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-danger-wash px-4 py-3.5 sm:flex-row sm:items-center">
          <WarningOctagon size={20} weight="duotone" className="shrink-0 text-danger" />
          <div className="min-w-0 flex-1 text-[13px]">
            <p className="font-medium text-ink">Switched off after repeated failures</p>
            <p className="text-ink-muted">
              {`Every delivery failed for 24 hours${e.failingSince ? `, since ${formatDateTime(e.failingSince)}` : ""} (${e.consecutiveFailures} attempts in a row).`} {e.disabledAt ? `Switched off ${formatDateTime(e.disabledAt)}. ` : ""}The owner was emailed. Fix the endpoint, send a test, then switch it back on; missed events can be replayed from the log.
            </p>
          </div>
          {manage && (
            <Button size="sm" variant="secondary" onClick={() => toggle.mutate()} loading={toggle.isPending}>
              <Play size={13} /> Switch back on
            </Button>
          )}
        </div>
      )}
      <Panel className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-line px-5 py-4 md:flex-row md:items-start">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2">
              <StatusDot e={e} />
              <span className="break-all font-mono text-[14px] text-ink" data-testid="endpoint-url">
                {e.url}
              </span>
            </p>
            <p className="mt-1 pl-4 text-[12.5px] text-ink-muted">
              {e.description ? `${e.description} · ` : ""}
              {autoOff(e) ? "Off" : e.status === "DISABLED" ? "Paused" : e.failingSince ? `Failing since ${relativeTime(e.failingSince, now)}` : "Delivering"}
              {e.lastSuccessAt && <span suppressHydrationWarning> · last delivered {relativeTime(e.lastSuccessAt, now)}</span>}
            </p>
          </div>
          {manage && (
            <div className="flex flex-wrap gap-1.5">
              <Button size="sm" onClick={() => ping.mutate()} loading={ping.isPending} data-testid="send-test">
                <PaperPlaneTilt size={14} /> Send test event
              </Button>
              {!autoOff(e) && (
                <Button size="sm" variant="secondary" onClick={() => toggle.mutate()} loading={toggle.isPending}>
                  {e.status === "ACTIVE" ? <Pause size={13} /> : <Play size={13} />}
                  {e.status === "ACTIVE" ? "Pause" : "Resume"}
                </Button>
              )}
              <Button size="icon-sm" variant="ghost" aria-label="Edit endpoint" onClick={onEdit}>
                <PencilSimple size={15} />
              </Button>
              <Button size="icon-sm" variant="ghost" aria-label="Remove endpoint" onClick={() => setDel(true)}>
                <Trash size={15} />
              </Button>
            </div>
          )}
        </div>
        <div className="grid gap-px bg-line md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="bg-surface px-5 py-4">
            <p className="eyebrow mb-2">Events</p>
            <div className="flex flex-col gap-1.5">
              {groups.map((g) => (
                <div key={g.group} className="grid gap-1.5 text-[12px] sm:grid-cols-[112px_minmax(0,1fr)]">
                  <span className="pt-0.5 text-ink-muted">{g.group}</span>
                  <span className="flex flex-wrap gap-1">
                    {g.events.map((ev) => (
                      <span key={ev.code} title={ev.code} className="rounded-xs border border-line bg-surface-2/60 px-1.5 py-0.5 text-[11.5px] text-ink">
                        {ev.label}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="bg-surface px-5 py-4">
            <p className="eyebrow mb-2">Signing secret</p>
            <p className="font-mono text-[13px] text-ink" data-testid="secret-preview">
              {e.secretPreview}
            </p>
            <p className="mt-1.5 text-[12px] leading-snug text-ink-muted">
              Each request carries <span className="font-mono text-ink">X-Signature: t=..,v1=..</span>, an HMAC-SHA256 of <span className="font-mono">t.body</span> with this secret.
            </p>
            {manage && (
              <Button size="sm" variant="ghost" className="-ml-2 mt-1.5" onClick={() => setRotate(true)}>
                <ArrowsClockwise size={13} /> Roll secret
              </Button>
            )}
          </div>
        </div>
      </Panel>

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
          <h2 className="display-sm text-[18px] text-ink">Deliveries</h2>
          <Segmented
            size="sm"
            label="Filter deliveries"
            value={filter}
            onChange={(v) => {
              setFilter(v);
              setCursor(null);
            }}
            options={[
              { value: "all", label: "All" },
              { value: "FAILED", label: "Failed" },
              { value: "SUCCEEDED", label: "Delivered" },
            ]}
            className="ml-auto"
          />
        </div>
        {d.isError ? (
          <ErrorState error={d.error} onRetry={() => d.refetch()} />
        ) : !d.data ? (
          <Skeleton className="m-5 h-40" />
        ) : d.data.items.length === 0 ? (
          <EmptyState compact glyph="dots" title={filter === "FAILED" ? "No failures" : "Nothing delivered yet"} body={manage ? "Send a test event to see what arrives." : undefined} />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[13px]" data-testid="deliveries">
                <thead className="border-b border-line text-left">
                  <tr>
                    <th className="eyebrow py-2.5 pl-5 text-[10.5px] font-normal">When</th>
                    <th className="eyebrow py-2.5 text-[10.5px] font-normal">Event</th>
                    <th className="eyebrow py-2.5 text-[10.5px] font-normal">Result</th>
                    <th className="eyebrow py-2.5 text-right text-[10.5px] font-normal">Time</th>
                    <th className="eyebrow py-2.5 pr-5 text-right text-[10.5px] font-normal">Try</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {d.data.items.map((x) => (
                    <DeliveryRow key={x.id} x={x} fresh={fresh === x.id} onOpen={() => setOpen(x.id)} now={now} />
                  ))}
                </tbody>
              </table>
            </div>
            {d.data.nextCursor && (
              <div className="border-t border-line px-5 py-2.5 text-right">
                <Button size="sm" variant="ghost" onClick={() => setCursor(d.data!.nextCursor)}>
                  Older
                </Button>
              </div>
            )}
          </>
        )}
      </Panel>
      <DeliverySheet id={open} onClose={() => setOpen(null)} manage={manage} onReplayed={(id) => setFresh(id)} />
      <ConfirmDialog open={del} onOpenChange={setDel} title="Remove this endpoint?" body="Events stop at once. The delivery log goes with it." confirmLabel="Remove" danger onConfirm={() => remove.mutateAsync()} />
      <ConfirmDialog open={rotate} onOpenChange={setRotate} title="Roll the signing secret?" body="Requests are signed with the new secret from now on. Update your verification code straight after, or signatures will not match." confirmLabel="Roll secret" onConfirm={() => rot.mutateAsync()} />
    </div>
  );
}

function DeliveryRow({ x, fresh, onOpen, now }: { x: WebhookDelivery; fresh: boolean; onOpen: () => void; now: number }) {
  return (
    <tr onClick={onOpen} data-testid="delivery-row" data-event={x.eventType} data-status={x.status} className={cn("cursor-pointer transition-colors hover:bg-surface-2/60", fresh && "bg-brass-wash/60")}>
      <td className="py-2.5 pl-5 font-mono text-[12px] text-ink-muted" suppressHydrationWarning title={formatDateTime(x.createdAt)}>
        {now - Date.parse(x.createdAt) < 86400_000 ? formatTime(x.createdAt) : formatDateTime(x.createdAt)}
      </td>
      <td className="py-2.5">
        <button type="button" onClick={onOpen} className="font-mono text-[12.5px] text-ink hover:underline">
          {x.eventType}
        </button>
        {x.isTest && <span className="ml-2 rounded-xs border border-dashed border-line-strong px-1 text-[10px] uppercase tracking-wider text-ink-muted">test</span>}
        {x.replayOf && <span className="ml-2 text-[11px] text-ink-muted">replay</span>}
      </td>
      <td className="py-2.5">
        <span className="flex items-center gap-2">
          <HttpStatus code={x.responseStatus} />
          <span className={cn("text-[12px]", x.status === "SUCCEEDED" ? "text-ink-muted" : x.status === "FAILED" ? "text-danger" : "text-ochre")}>
            {x.status === "SUCCEEDED" ? "Delivered" : x.status === "FAILED" ? "Failed" : x.status === "RETRYING" ? `Retry ${x.nextAttemptAt ? relativeTime(x.nextAttemptAt, now) : "soon"}` : "Sending"}
          </span>
        </span>
      </td>
      <td className="py-2.5 text-right font-mono text-[12px] text-ink-muted">{x.durationMs != null ? `${x.durationMs} ms` : "--"}</td>
      <td className="py-2.5 pr-5 text-right font-mono text-[12px] text-ink-muted">{x.attempts}</td>
    </tr>
  );
}

function DeliverySheet({ id, onClose, manage, onReplayed }: { id: string | null; onClose: () => void; manage: boolean; onReplayed: (id: string) => void }) {
  const q = useDelivery(id);
  const qc = useQueryClient();
  const [tab, setTab] = useState<"request" | "response" | "attempts">("response");
  const replay = useMutation({
    mutationFn: () => webhooksApi.replay(id!),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: qk6.deliveriesAll });
      onReplayed(r.id);
      toast.success("Replayed", r.status === "SUCCEEDED" ? `Delivered, ${r.responseStatus}.` : "Queued again; watch the log.");
      onClose();
    },
    meta: { errorTitle: "Not replayed" },
  });
  const x = q.data;
  return (
    <Sheet
      open={!!id}
      onOpenChange={(o) => !o && onClose()}
      eyebrow="Delivery"
      title={x ? <span className="font-mono text-[18px]">{x.eventType}</span> : "Delivery"}
      description={x ? `${formatDateTime(x.createdAt)} · event ${x.eventId}` : undefined}
      width="max-w-2xl"
      footer={
        manage && x ? (
          <Button onClick={() => replay.mutate()} loading={replay.isPending} data-testid="replay">
            <ArrowCounterClockwise size={14} /> Replay this event
          </Button>
        ) : undefined
      }
    >
      {!x ? (
        q.isError ? (
          <ErrorState error={q.error} />
        ) : (
          <Skeleton className="h-64" />
        )
      ) : (
        <div className="flex flex-col gap-4" data-testid="delivery-detail">
          <div className="flex flex-wrap items-center gap-3 text-[13px]">
            <HttpStatus code={x.responseStatus} />
            <span className="text-ink">{x.status === "SUCCEEDED" ? "Delivered" : x.status === "FAILED" ? "Failed" : x.status === "RETRYING" ? "Will retry" : "Sending"}</span>
            {x.durationMs != null && <span className="font-mono text-ink-muted">{x.durationMs} ms</span>}
            <span className="text-ink-muted">{x.attempts} {x.attempts === 1 ? "attempt" : "attempts"}</span>
            {x.error && <Badge tone="danger">{x.error}</Badge>}
          </div>
          <Segmented
            label="Show"
            value={tab}
            onChange={setTab}
            size="sm"
            options={[
              { value: "request", label: "Request" },
              { value: "response", label: "Response" },
              ...(x.attemptLog?.length > 1 ? [{ value: "attempts" as const, label: `Attempts (${x.attemptLog.length})` }] : []),
            ]}
          />
          {tab === "request" && (
            <>
              <p className="break-all font-mono text-[12.5px] text-ink">
                <span className="mr-2 rounded-xs bg-ink px-1.5 py-0.5 text-[11px] text-paper">POST</span>
                {x.request.url}
              </p>
              <Headers h={x.request.headers} />
              <Code body={prettyBody(x.request.body)} />
            </>
          )}
          {tab === "response" &&
            (x.response ? (
              <>
                <Headers h={x.response.headers} />
                <Code body={prettyBody(x.response.body) || "(empty body)"} />
                <p className="text-[12px] text-ink-muted">We keep the first 2 KB of a response body.</p>
              </>
            ) : (
              <p className="rounded-md border border-line bg-paper px-4 py-3 text-[13px] text-ink-muted">No response: {x.error || "the connection failed before an answer came back."}</p>
            ))}
          {tab === "attempts" && (
            <ol className="flex flex-col gap-2">
              {x.attemptLog.map((a, i) => (
                <li key={a.at} className="flex items-center gap-3 rounded-sm border border-line px-3 py-2 text-[12.5px]">
                  <span className="font-mono text-ink-muted">#{i + 1}</span>
                  <HttpStatus code={a.responseStatus} />
                  <span className="text-ink-muted">{formatDateTime(a.at)}</span>
                  <span className="ml-auto font-mono text-ink-muted">{a.durationMs != null ? `${a.durationMs} ms` : ""}</span>
                  {a.error && <span className="truncate text-danger">{a.error}</span>}
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </Sheet>
  );
}

function Headers({ h }: { h: Record<string, string> }) {
  const entries = Object.entries(h ?? {});
  if (!entries.length) return null;
  return (
    <dl className="grid grid-cols-[minmax(0,160px)_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-md border border-line bg-paper px-3.5 py-2.5 font-mono text-[11.5px]">
      {entries.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="truncate text-ink-muted">{k}</dt>
          <dd className="break-all text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function Code({ body }: { body: string }) {
  return (
    <pre className="scrollbar-thin max-h-[46dvh] overflow-auto rounded-md bg-[#1b1a17] p-4 font-mono text-[12px] leading-relaxed text-[#efe8dc] dark:bg-[#0c0b09]" data-testid="payload">
      {body}
    </pre>
  );
}

function EndpointForm({ editing, onClose, onCreated }: { editing: WebhookEndpoint | null; onClose: () => void; onCreated: (e: WebhookEndpoint, secret: string) => void }) {
  const qc = useQueryClient();
  const available = useWebhookEvents();
  const [url, setUrl] = useState(editing?.url ?? "https://");
  const [description, setDescription] = useState(editing?.description ?? "");
  const [events, setEvents] = useState<string[]>(editing ? (editing.events.includes("*") ? ALL_EVENTS.map((x) => x.code) : editing.events) : ["reservation.created", "reservation.updated", "reservation.cancelled"]);
  const [err, setErr] = useState<string | null>(null);
  const httpsOk = /^https:\/\/[^\s/]+\.[^\s]+/.test(url) || (process.env.NODE_ENV !== "production" && /^https?:\/\/[^\s]+/.test(url));
  const save = useMutation({
    mutationFn: async () => {
      const b = { url: url.trim(), description: description.trim() || undefined, events };
      if (editing) return { endpoint: await webhooksApi.update(editing.id, b), secret: null as string | null };
      return webhooksApi.create(b);
    },
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: qk6.endpoints });
      if (r.secret) onCreated(r.endpoint, r.secret);
      else {
        toast.success("Endpoint saved");
        onClose();
      }
    },
    onError: (e) => setErr(errorMessage(e)),
    meta: { silent: true },
  });
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        if (httpsOk && events.length) save.mutate();
      }}
    >
      <Field label="Endpoint URL" error={url.length > 8 && !httpsOk ? "Use an https:// address that is reachable from the internet." : null} hint="HTTPS only. Private and internal addresses are refused.">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} className="font-mono" placeholder="https://hooks.yourhotel.com/pms" data-testid="endpoint-url-input" spellCheck={false} />
      </Field>
      <Field label="Description" optional>
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Revenue dashboard, channel sync ..." />
      </Field>
      <Field label="Events to send">
        <EventPicker value={events} onChange={setEvents} available={available.data?.map((x) => x.type).filter((t) => t !== "webhook.ping")} />
      </Field>
      {err && (
        <p role="alert" className="rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-wash px-3 py-2 text-[13px] text-danger">
          {err}
        </p>
      )}
      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" loading={save.isPending} disabled={!httpsOk || !events.length} data-testid="save-endpoint">
          {editing ? "Save" : "Add endpoint"}
        </Button>
      </div>
    </form>
  );
}

function SigningSecretDialog({ secret, onDone }: { secret: { value: string; url: string } | null; onDone: () => void }) {
  const [ok, setOk] = useState(false);
  const close = () => {
    setOk(false);
    onDone();
  };
  return (
    <Dialog open={!!secret} onOpenChange={(o) => !o && ok && close()} eyebrow="Signing secret" title="Verify every request with this" description={secret ? `For ${secret.url}. Your code recomputes the HMAC and compares it with X-Signature before trusting the body.` : undefined} className="max-w-xl" footer={<Button disabled={!ok} onClick={close} data-testid="secret-done">Done</Button>}>
      {secret && <SecretReveal secret={secret.value} label="Webhook signing secret" what="secret" confirmed={ok} onConfirm={setOk} testId="webhook-secret" />}
    </Dialog>
  );
}
