"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ArrowsClockwise, Buildings, CaretRight, DotsThree, Key, PencilSimple, Plus, Prohibit, ShieldCheck, Timer } from "@phosphor-icons/react";
import { useCan } from "@/lib/permissions";
import { useMe } from "@/lib/api/hooks";
import { apiKeysApi } from "@/lib/api/endpoints-m6";
import { qk6, useApiKeys, useScopes } from "@/lib/api/hooks-m6";
import type { ApiKey, ApiKeyInput, ApiScopeInfo, KeyEnvironment } from "@/lib/api/types-m6";
import type { MeM5 } from "@/lib/api/types-m5";
import { errorMessage } from "@/lib/api/client";
import { formatDate, formatDateTime, number, relativeTime } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog, Sheet } from "@/components/ui/overlay";
import { Field, Input } from "@/components/ui/form";
import { TagInput } from "@/components/ui/tag-input";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, Segmented, Skeleton, Tip } from "@/components/ui/primitives";
import { DevTabs } from "./dev-tabs";
import { KeyStub, ModeTag, ScopePicker, ScopeSummary, SecretReveal } from "./parts";

const CIDR = /^(\d{1,3}(\.\d{1,3}){3})(\/(3[0-2]|[12]?\d))?$|^[0-9a-f:]+(\/\d{1,3})?$/i;

export function ApiKeysView() {
  const q = useApiKeys();
  const scopes = useScopes();
  const { can } = useCan();
  const manage = can("integrations.manage");
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState<ApiKey | null>(null);
  const [secret, setSecret] = useState<{ value: string; key: ApiKey; rotated?: boolean } | null>(null);
  const [rotate, setRotate] = useState<ApiKey | null>(null);
  const [revoke, setRevoke] = useState<ApiKey | null>(null);
  const qc = useQueryClient();
  const now = useNow(60_000);

  const rot = useMutation({
    mutationFn: (k: ApiKey) => apiKeysApi.rotate(k.id),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: qk6.apiKeys });
      setSecret({ value: r.secret, key: r.apiKey, rotated: true });
    },
    meta: { errorTitle: "Not rotated" },
  });
  const rev = useMutation({
    mutationFn: (k: ApiKey) => apiKeysApi.revoke(k.id),
    onSuccess: (k) => {
      void qc.invalidateQueries({ queryKey: qk6.apiKeys });
      toast.success(`${k.name} revoked`, "Requests with it are refused from now on.");
    },
    meta: { errorTitle: "Not revoked" },
  });

  const keys = q.data ?? [];
  const live = keys.filter((k) => k.status !== "REVOKED" && k.status !== "EXPIRED");
  const old = keys.filter((k) => k.status === "REVOKED" || k.status === "EXPIRED");

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Key size={14} weight="duotone" /> Developers
          </>
        }
        title={
          <>
            Keys to <em>your own systems</em>.
          </>
        }
        description="Each integration gets its own key with only the access it needs. Keys are shown once, can be limited to a property and to your office IPs, and can be rotated without downtime."
        actions={
          manage && (
            <Button onClick={() => setCreate(true)} data-testid="new-api-key">
              <Plus size={15} weight="bold" /> New key
            </Button>
          )
        }
      />
      <DevTabs />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <Skeleton className="h-72" />
      ) : (
        <div className="flex flex-col gap-6">
          <Panel className="overflow-hidden">
            {live.length === 0 ? (
              <EmptyState
                glyph="cross"
                title="No keys yet"
                body="Create a key for each system that talks to the hotel: a booking engine, a BI dashboard, the door locks. Start with a test key: it never charges or messages anyone."
                action={manage && <Button onClick={() => setCreate(true)}>Create the first key</Button>}
              />
            ) : (
              <ul className="divide-y divide-line" data-testid="api-keys">
                {live.map((k) => (
                  <KeyRow key={k.id} k={k} now={now} manage={manage} onEdit={() => setEdit(k)} onRotate={() => setRotate(k)} onRevoke={() => setRevoke(k)} />
                ))}
              </ul>
            )}
          </Panel>
          {old.length > 0 && (
            <details className="group">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-medium text-ink-muted hover:text-ink">
                <CaretRight size={12} weight="bold" className="transition-transform group-open:rotate-90" />
                {old.length} revoked or expired {old.length === 1 ? "key" : "keys"}
              </summary>
              <Panel className="mt-3 overflow-hidden opacity-80">
                <ul className="divide-y divide-line">
                  {old.map((k) => (
                    <KeyRow key={k.id} k={k} now={now} manage={false} />
                  ))}
                </ul>
              </Panel>
            </details>
          )}
        </div>
      )}

      <KeySheet
        open={create || !!edit}
        editing={edit}
        onOpenChange={(o) => {
          if (!o) {
            setCreate(false);
            setEdit(null);
          }
        }}
        scopeInfo={scopes.data}
        onCreated={(value, key) => {
          setCreate(false);
          setSecret({ value, key });
        }}
      />
      <SecretDialog secret={secret} onDone={() => setSecret(null)} />
      <Dialog
        open={!!rotate}
        onOpenChange={(o) => !o && setRotate(null)}
        eyebrow="Rotate"
        title={`Rotate ${rotate?.name ?? ""}?`}
        description="You get a new secret now. The old one keeps working for 24 hours so you can deploy the new one without a gap, then it stops."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRotate(null)}>
              Cancel
            </Button>
            <Button
              loading={rot.isPending}
              data-testid="confirm-rotate"
              onClick={() => {
                if (rotate) rot.mutate(rotate, { onSettled: () => setRotate(null) });
              }}
            >
              <ArrowsClockwise size={15} /> Rotate
            </Button>
          </>
        }
      >
        <OverlayTimeline />
      </Dialog>
      <ConfirmDialog
        open={!!revoke}
        onOpenChange={(o) => !o && setRevoke(null)}
        title={`Revoke ${revoke?.name ?? ""}?`}
        body="Requests with this key are refused at once. This cannot be undone; create a new key if you need access again."
        confirmLabel="Revoke key"
        danger
        onConfirm={() => (revoke ? rev.mutateAsync(revoke) : undefined)}
      />
    </>
  );
}

function OverlayTimeline() {
  return (
    <div className="rounded-md border border-line bg-paper p-4">
      <div className="relative h-14">
        <div className="absolute left-0 right-[35%] top-3 h-2 rounded-xs bg-ink-faint/50" />
        <div className="absolute left-[40%] right-[35%] top-3 h-2 bg-[repeating-linear-gradient(135deg,var(--brass)_0_4px,transparent_4px_8px)]" />
        <div className="absolute left-[40%] right-0 top-7 h-2 rounded-xs bg-palm" />
        <span className="absolute left-[40%] top-0 h-12 w-px bg-ink" />
        <span className="absolute right-[35%] top-0 h-12 w-px border-l border-dashed border-ink-muted" />
      </div>
      <div className="grid grid-cols-3 text-[11.5px] text-ink-muted">
        <span>Old secret</span>
        <span className="text-center text-ink">Now: both work</span>
        <span className="text-right">+24 h: only the new one</span>
      </div>
    </div>
  );
}

function KeyRow({ k, now, manage, onEdit, onRotate, onRevoke }: { k: ApiKey; now: number; manage: boolean; onEdit?: () => void; onRotate?: () => void; onRevoke?: () => void }) {
  const me = useMe();
  const props = ((me.data as unknown as MeM5 | undefined)?.properties ?? []).filter((p) => k.propertyIds?.includes(p.id));
  const expSoon = k.expiresAt && Date.parse(k.expiresAt) - now < 14 * 86400_000 && Date.parse(k.expiresAt) > now;
  return (
    <li className="relative grid gap-3 px-5 py-4 md:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto] md:items-center" data-testid="api-key-row" data-key-id={k.id}>
      <div className="min-w-0 pr-8 md:pr-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[14.5px] font-medium text-ink">{k.name}</span>
          <ModeTag mode={k.environment} />
          {k.previousSecretExpiresAt && Date.parse(k.previousSecretExpiresAt) > now && k.status === "ACTIVE" && (
            <Tip content={`The previous secret works until ${formatDateTime(k.previousSecretExpiresAt)}`}>
              <span>
                <Badge tone="brass" dot>
                  Old secret ends {relativeTime(k.previousSecretExpiresAt, now)}
                </Badge>
              </span>
            </Tip>
          )}
          {k.status === "REVOKED" && <Badge tone="danger">Revoked</Badge>}
          {k.status === "EXPIRED" && <Badge>Expired</Badge>}
        </div>
        <KeyStub display={k.display} className="mt-1 text-ink-muted" />
      </div>
      <div className="min-w-0">
        <ScopeSummary scopes={k.scopes} />
        <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[11.5px] text-ink-muted">
          <span className="inline-flex items-center gap-1">
            <Buildings size={12} /> {k.propertyIds?.length ? props.map((p) => p.name).join(", ") || `${k.propertyIds.length} property` : "All properties"}
          </span>
          {k.ipAllowlist.length > 0 && (
            <span className="inline-flex items-center gap-1" title={k.ipAllowlist.join(", ")}>
              <ShieldCheck size={12} /> {k.ipAllowlist.length} IP {k.ipAllowlist.length === 1 ? "range" : "ranges"}
            </span>
          )}
        </p>
      </div>
      <div className="flex flex-col gap-0.5 text-[12px] text-ink-muted">
        <p suppressHydrationWarning>
          {k.lastUsedAt ? (
            <>
              Used <span className="text-ink">{relativeTime(k.lastUsedAt, now)}</span>
              {k.lastUsedIp && <span className="font-mono text-[11.5px]"> &middot; {k.lastUsedIp}</span>}
            </>
          ) : (
            "Never used"
          )}
        </p>
        <p>
          <span className="font-mono text-ink">{number(k.requests30d)}</span> calls in 30 days
        </p>
        <p className={cn("inline-flex items-center gap-1", expSoon && "text-ochre")}>
          <Timer size={12} /> {k.expiresAt ? `${Date.parse(k.expiresAt) < now ? "Expired" : "Expires"} ${formatDate(k.expiresAt)}` : "No expiry"}
          <span className="text-ink-faint">&middot; {k.createdBy ? k.createdBy.fullName.split(" ")[0] : "Added"}, {formatDate(k.createdAt, { day: "numeric", month: "short" })}</span>
        </p>
      </div>
      <div className="absolute right-3 top-3 flex justify-end md:static">
        {manage && k.status !== "REVOKED" && k.status !== "EXPIRED" && (
          <Menu.Root>
            <Menu.Trigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${k.name}`} data-testid="key-actions">
                <DotsThree size={18} weight="bold" />
              </Button>
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Content align="end" sideOffset={4} className="z-50 min-w-44 rounded-md border border-line bg-surface p-1 shadow-float animate-[rise_140ms_ease-out]">
                <Menu.Item onSelect={onEdit} className="flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2.5 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2">
                  <PencilSimple size={15} /> Edit access
                </Menu.Item>
                <Menu.Item onSelect={onRotate} className="flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2.5 text-[13px] text-ink outline-none data-[highlighted]:bg-surface-2">
                  <ArrowsClockwise size={15} /> Rotate secret
                </Menu.Item>
                <Menu.Item onSelect={onRevoke} className="flex h-8 cursor-pointer items-center gap-2 rounded-sm px-2.5 text-[13px] text-danger outline-none data-[highlighted]:bg-danger-wash">
                  <Prohibit size={15} /> Revoke
                </Menu.Item>
              </Menu.Content>
            </Menu.Portal>
          </Menu.Root>
        )}
      </div>
    </li>
  );
}

const EXPIRY = [
  { v: "never", label: "Never" },
  { v: "30", label: "30 days" },
  { v: "90", label: "90 days" },
  { v: "365", label: "1 year" },
] as const;

function KeySheet({
  open,
  onOpenChange,
  editing,
  scopeInfo,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: ApiKey | null;
  scopeInfo?: ApiScopeInfo[];
  onCreated: (secret: string, key: ApiKey) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange} eyebrow="API key" title={editing ? `Edit ${editing.name}` : "New API key"} width="max-w-xl">
      {open && <KeyForm key={editing?.id ?? "new"} editing={editing} scopeInfo={scopeInfo} onCreated={onCreated} onClose={() => onOpenChange(false)} />}
    </Sheet>
  );
}

function KeyForm({ editing, scopeInfo, onCreated, onClose }: { editing: ApiKey | null; scopeInfo?: ApiScopeInfo[]; onCreated: (s: string, k: ApiKey) => void; onClose: () => void }) {
  const qc = useQueryClient();
  const me = useMe();
  const properties = (me.data as unknown as MeM5 | undefined)?.properties ?? [];
  const [name, setName] = useState(editing?.name ?? "");
  const [mode, setMode] = useState<KeyEnvironment>(editing?.environment ?? "TEST");
  const [scopes, setScopes] = useState<string[]>(editing?.scopes ?? ["availability:read", "rates:read", "reservations:read"]);
  const [restrict, setRestrict] = useState<"all" | "some">(editing?.propertyIds?.length ? "some" : "all");
  const [propertyIds, setPropertyIds] = useState<string[]>(editing?.propertyIds ?? []);
  const [ips, setIps] = useState<string[]>(editing?.ipAllowlist ?? []);
  const [expiry, setExpiry] = useState<string>(editing ? (editing.expiresAt ? "keep" : "never") : "365");
  const [err, setErr] = useState<string | null>(null);
  const badIps = ips.filter((i) => !CIDR.test(i));

  /** built when the button is pressed, so "90 days" counts from then */
  const buildBody = (): ApiKeyInput => {
    const expiresAt = expiry === "never" ? null : expiry === "keep" ? (editing?.expiresAt ?? null) : new Date(Date.now() + Number(expiry) * 86400_000).toISOString();
    return { name: name.trim(), environment: mode, scopes, propertyIds: restrict === "some" ? propertyIds : null, ipAllowlist: ips, expiresAt };
  };

  const save = useMutation({
    mutationFn: async () => {
      const body = buildBody();
      if (editing) {
        const { environment: _m, ...rest } = body;
        void _m;
        return { apiKey: await apiKeysApi.update(editing.id, rest), secret: null as string | null };
      }
      return apiKeysApi.create(body);
    },
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: qk6.apiKeys });
      if (r.secret) onCreated(r.secret, r.apiKey);
      else {
        toast.success("Key updated", "The new access applies to the next request.");
        onClose();
      }
    },
    onError: (e) => setErr(errorMessage(e)),
    meta: { silent: true },
  });

  const valid = name.trim().length >= 2 && scopes.length > 0 && badIps.length === 0 && (restrict === "all" || propertyIds.length > 0);

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        setErr(null);
        if (valid) save.mutate();
      }}
    >
      <Field label="Name" hint="Say what uses it, so the next person knows what breaks if it is revoked.">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Channel sync, Power BI, Door locks..." data-testid="key-name" autoFocus />
      </Field>
      {!editing && (
        <Field label="Environment">
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Environment">
            {(["TEST", "LIVE"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={mode === m}
                onClick={() => setMode(m)}
                data-testid={`mode-${m.toLowerCase()}`}
                className={cn("flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors", mode === m ? "border-ink shadow-[0_0_0_1px_var(--ink)]" : "border-line hover:border-line-strong")}
              >
                <span className="flex items-center gap-2">
                  <ModeTag mode={m} />
                  <span className="font-mono text-[11.5px] text-ink-muted">hk_{m.toLowerCase()}_...</span>
                </span>
                <span className="text-[12.5px] leading-snug text-ink-muted">
                  {m === "TEST" ? "Real data, but writes are a dry run: nothing is booked, charged or sent." : "Full access to the hotel as the scopes allow. Guests get real messages."}
                </span>
              </button>
            ))}
          </div>
        </Field>
      )}
      <Field label="Scopes">
        <ScopePicker value={scopes} onChange={setScopes} info={scopeInfo} />
      </Field>
      {properties.length > 1 && (
        <Field label="Properties">
          <Segmented
            label="Property restriction"
            value={restrict}
            onChange={setRestrict}
            options={[
              { value: "all", label: "All properties" },
              { value: "some", label: "Only some" },
            ]}
            size="sm"
          />
          {restrict === "some" && (
            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {properties.map((p) => {
                const on = propertyIds.includes(p.id);
                return (
                  <label key={p.id} className={cn("flex cursor-pointer items-center gap-2 rounded-sm border px-2.5 py-2 text-[13px]", on ? "border-ink bg-surface" : "border-line")}>
                    <input type="checkbox" checked={on} onChange={() => setPropertyIds(on ? propertyIds.filter((x) => x !== p.id) : [...propertyIds, p.id])} className="accent-[var(--laterite)]" />
                    <span className="truncate text-ink">{p.name}</span>
                    <span className="ml-auto text-[11.5px] text-ink-muted">{p.city}</span>
                  </label>
                );
              })}
            </div>
          )}
        </Field>
      )}
      <Field label="IP allowlist" optional error={badIps.length ? `Not an IP or CIDR range: ${badIps.join(", ")}` : null} hint="Addresses or ranges (CIDR) the key may be used from, such as 102.89.34.0/24. Leave empty to allow any.">
        <TagInput value={ips} onChange={setIps} placeholder="102.89.34.0/24" />
      </Field>
      <Field label="Expires">
        <Segmented
          label="Expiry"
          value={expiry}
          onChange={setExpiry}
          options={[...(editing?.expiresAt ? [{ value: "keep", label: `Keep (${formatDate(editing.expiresAt)})` }] : []), ...EXPIRY.map((e) => ({ value: e.v as string, label: e.label }))]}
          size="sm"
        />
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
        <Button type="submit" loading={save.isPending} disabled={!valid} data-testid="create-key">
          {editing ? "Save access" : "Create key"}
        </Button>
      </div>
    </form>
  );
}

/** The dialog cannot be dismissed until the person confirms the secret is stored. */
function SecretDialog({ secret, onDone }: { secret: { value: string; key: ApiKey; rotated?: boolean } | null; onDone: () => void }) {
  const [ok, setOk] = useState(false);
  return (
    <Dialog
      open={!!secret}
      onOpenChange={(o) => {
        if (!o && ok) {
          setOk(false);
          onDone();
        }
      }}
      eyebrow={secret?.rotated ? "Rotated" : "Created"}
      title={secret ? `${secret.key.name}` : ""}
      description={
        secret?.rotated && secret.key.previousSecretExpiresAt
          ? `The old secret keeps working until ${formatDateTime(secret.key.previousSecretExpiresAt)}. Deploy this one before then.`
          : "Copy the secret into your integration's settings or a password manager now."
      }
      className="max-w-xl"
      footer={
        <Button
          disabled={!ok}
          data-testid="secret-done"
          onClick={() => {
            setOk(false);
            onDone();
          }}
        >
          Done
        </Button>
      }
    >
      {secret && <SecretReveal secret={secret.value} label={`${secret.key.environment === "LIVE" ? "Live" : "Test"} secret key`} confirmed={ok} onConfirm={setOk} />}
    </Dialog>
  );
}
