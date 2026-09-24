"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Fingerprint, Key, ShieldCheck, SignIn, Trash, WarningDiamond, XCircle } from "@phosphor-icons/react";
import { useCan } from "@/lib/permissions";
import { useStaff } from "@/lib/api/hooks";
import { useRoles } from "@/lib/api/hooks-m4";
import { ssoApi } from "@/lib/api/endpoints-m6";
import { qk6, useSso } from "@/lib/api/hooks-m6";
import type { SsoConfig, SsoInput, SsoProvider } from "@/lib/api/types-m6";
import { errorMessage } from "@/lib/api/client";
import { formatDateTime } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/use-now";
import { SSO_PRESETS } from "@/lib/m6-catalog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { Field, Input, PasswordInput, Select, Switch } from "@/components/ui/form";
import { TagInput } from "@/components/ui/tag-input";
import { Badge, ErrorState, PageHeader, Panel, Segmented, Skeleton } from "@/components/ui/primitives";
import { CopyField } from "@/components/domain/parts";

const TEST_MSG = "sso-test-result";

export function SsoView() {
  const q = useSso();
  const qc = useQueryClient();
  const params = useSearchParams();
  const router = useRouter();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // The test sign-in comes back to /settings/sso?test=ok|failed&message=. In the
  // pop-up we hand the result to the opener and close; in a full tab we show it.
  useEffect(() => {
    const t = params.get("test");
    if (!t) return;
    const r = { ok: t === "ok", message: params.get("message") ?? "" };
    if (window.opener && window.opener !== window) {
      try {
        window.opener.postMessage({ type: TEST_MSG, ...r }, window.location.origin);
        window.close();
        return;
      } catch {
        /* fall through and show it here */
      }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-off read of the redirect result
    setResult(r);
    void qc.invalidateQueries({ queryKey: qk6.sso });
    router.replace("/settings/sso");
  }, [params, qc, router]);

  useEffect(() => {
    const on = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== TEST_MSG) return;
      setResult({ ok: !!e.data.ok, message: String(e.data.message ?? "") });
      void qc.invalidateQueries({ queryKey: qk6.sso });
    };
    window.addEventListener("message", on);
    return () => window.removeEventListener("message", on);
  }, [qc]);

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Fingerprint size={14} weight="duotone" /> Single sign-on
          </>
        }
        title={
          <>
            One company login, <em>one off-switch</em>.
          </>
        }
        description="Staff sign in with their Google Workspace or Microsoft account. When someone leaves and IT closes their account, they are locked out of the hotel too."
      />
      {result && (
        <div role="status" data-testid="sso-test-result" data-ok={result.ok ? "1" : "0"} className={cn("mb-6 flex items-start gap-3 rounded-md border px-4 py-3", result.ok ? "border-[color-mix(in_oklab,var(--palm)_35%,transparent)] bg-palm-wash" : "border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-danger-wash")}>
          {result.ok ? <CheckCircle size={20} weight="fill" className="shrink-0 text-palm" /> : <XCircle size={20} weight="fill" className="shrink-0 text-danger" />}
          <div className="text-[13.5px]">
            <p className="font-medium text-ink">{result.ok ? "Test sign-in worked" : "Test sign-in failed"}</p>
            {result.message && <p className="text-ink-muted">{result.message}</p>}
          </div>
          <button type="button" className="ml-auto text-[12.5px] text-ink-muted hover:text-ink" onClick={() => setResult(null)}>
            Dismiss
          </button>
        </div>
      )}
      {q.isError ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : q.isPending ? <Skeleton className="h-[480px]" /> : <SsoForm key={q.data ? `${q.data.provider}-${q.data.clientId}` : "new"} s={q.data ?? null} />}
    </>
  );
}

function SsoForm({ s }: { s: SsoConfig | null }) {
  const qc = useQueryClient();
  const roles = useRoles();
  const staff = useStaff();
  const { can } = useCan();
  const manage = can("sso.manage");
  const [provider, setProvider] = useState<SsoProvider>(s?.provider ?? "GOOGLE");
  const [issuer, setIssuer] = useState(s?.provider === "OIDC" ? s.issuer : "");
  const [entraTenant, setEntraTenant] = useState(() => /microsoftonline\.com\/([^/]+)/.exec(s?.issuer ?? "")?.[1] ?? "");
  const [clientId, setClientId] = useState(s?.clientId ?? "");
  const [secret, setSecret] = useState("");
  const [domains, setDomains] = useState<string[]>(s?.allowedDomains ?? []);
  const [provisioning, setProvisioning] = useState<"JIT" | "EXISTING_ONLY">(s?.provisioning ?? "JIT");
  const [defaultRole, setDefaultRole] = useState(s?.defaultRole ?? "FRONT_DESK");
  const [enforced, setEnforced] = useState(s?.enforced ?? false);
  const [breakGlass, setBreakGlass] = useState<string>(s?.breakGlassUserId ?? "");
  const [enabled, setEnabled] = useState(s?.enabled ?? false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmOnly, setConfirmOnly] = useState(false);
  const [remove, setRemove] = useState(false);
  const preset = SSO_PRESETS.find((p) => p.id === provider)!;
  const effIssuer = provider === "GOOGLE" ? preset.issuer() : provider === "MICROSOFT" ? preset.issuer(entraTenant.trim()) : issuer.trim();
  const owners = (staff.data ?? []).filter((m) => m.role === "OWNER" && m.isActive !== false);
  const now = useNow(60_000);
  const recentTest = !!s?.lastTest?.ok && now - Date.parse(s.lastTest.at) < 24 * 3600_000;
  const body: SsoInput = {
    provider,
    issuer: effIssuer,
    clientId: clientId.trim(),
    allowedDomains: domains.map((d) => d.toLowerCase().replace(/^@/, "")),
    provisioning,
    defaultRole,
    enforced,
    breakGlassUserId: breakGlass || null,
    enabled,
    ...(secret ? { clientSecret: secret } : {}),
  };
  const complete = !!effIssuer && !effIssuer.includes("<") && !!clientId.trim() && (!!s?.clientSecretSet || !!secret) && domains.length > 0;
  const onSaved = (r: SsoConfig) => {
    qc.setQueryData(qk6.sso, r);
    void qc.invalidateQueries({ queryKey: ["me"] });
    setSecret("");
  };
  const save = useMutation({
    mutationFn: () => ssoApi.save(body),
    onSuccess: (r) => {
      onSaved(r);
      toast.success("Single sign-on saved", r.enabled ? "Staff see the SSO button on the sign-in page." : "Saved, and switched off for now.");
    },
    onError: (e) => setErr(errorMessage(e)),
    meta: { silent: true },
  });
  const test = useMutation({
    mutationFn: async () => {
      // a test needs the settings on the server; save what is typed (never switching SSO on by itself)
      onSaved(await ssoApi.save({ ...body, enabled: s?.enabled ?? false, enforced: s?.enforced ?? false }));
      return ssoApi.test();
    },
    onSuccess: (r) => {
      const w = window.open(r.authorizeUrl, "sso-test", "width=520,height=700");
      if (!w) window.location.assign(r.authorizeUrl);
    },
    onError: (e) => setErr(errorMessage(e)),
    meta: { silent: true },
  });
  const del = useMutation({
    mutationFn: ssoApi.remove,
    onSuccess: () => {
      qc.setQueryData(qk6.sso, null);
      void qc.invalidateQueries({ queryKey: ["me"] });
      toast.success("Single sign-on removed", "Staff sign in with their passwords again.");
    },
    meta: { errorTitle: "Not removed" },
  });

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex min-w-0 flex-col gap-6">
        <Panel className="p-5">
          <h2 className="display-sm text-[18px] text-ink">Identity provider</h2>
          <div className="mt-4 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Provider">
            {SSO_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                role="radio"
                aria-checked={provider === p.id}
                disabled={!manage}
                onClick={() => setProvider(p.id)}
                data-testid={`sso-preset-${p.id.toLowerCase()}`}
                className={cn("flex items-center gap-3 rounded-md border p-3 text-left transition-colors sm:flex-col sm:items-start", provider === p.id ? "border-ink shadow-[0_0_0_1px_var(--ink)]" : "border-line hover:border-line-strong")}
              >
                <ProviderMark id={p.id} />
                <span className="text-[13.5px] font-medium text-ink">{p.name}</span>
              </button>
            ))}
          </div>
          <details className="group mt-4 rounded-md border border-line bg-paper">
            <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-2.5 text-[13px] font-medium text-ink">
              Set it up in the {preset.consoleName}
              <span className="text-[11.5px] font-normal text-ink-muted group-open:hidden">4 steps</span>
            </summary>
            <ol className="list-decimal border-t border-line py-3 pl-9 pr-4 text-[12.5px] leading-relaxed text-ink-muted">
              {preset.steps.map((st) => (
                <li key={st}>{st}</li>
              ))}
            </ol>
          </details>
          <div className="mt-5 grid gap-4">
            <Field label="Redirect URI" hint="Register this exact address with the provider.">
              <CopyField value={s?.redirectUri ?? "Saved with the first settings"} label="redirect URI" testId="sso-redirect" />
            </Field>
            {provider === "MICROSOFT" && (
              <Field label="Directory (tenant) ID">
                <Input value={entraTenant} onChange={(e) => setEntraTenant(e.target.value)} className="font-mono" placeholder="8f3c2d1e-5b6a-4c7d-9e0f-a4b7c2d1e0f9" disabled={!manage} spellCheck={false} />
              </Field>
            )}
            {provider === "OIDC" ? (
              <Field label="Issuer URL" hint="We read its /.well-known/openid-configuration to find the rest.">
                <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} className="font-mono" placeholder={preset.issuerHint} disabled={!manage} data-testid="sso-issuer" spellCheck={false} />
              </Field>
            ) : (
              <p className="text-[12.5px] text-ink-muted">
                Issuer <span className="break-all font-mono text-ink">{effIssuer}</span>
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Client ID">
                <Input value={clientId} onChange={(e) => setClientId(e.target.value)} className="font-mono" disabled={!manage} data-testid="sso-client-id" spellCheck={false} autoComplete="off" />
              </Field>
              <Field label="Client secret" hint={s?.clientSecretSet && !secret ? `Stored encrypted${s.clientSecretLast4 ? `, ends ${s.clientSecretLast4}` : ""}. Type to replace it.` : "Stored encrypted and never shown again."}>
                <PasswordInput value={secret} onChange={(e) => setSecret(e.target.value)} placeholder={s?.clientSecretSet ? "••••••••••••" : ""} className="font-mono" disabled={!manage} autoComplete="new-password" data-testid="sso-client-secret" />
              </Field>
            </div>
          </div>
        </Panel>

        <Panel className="p-5">
          <h2 className="display-sm text-[18px] text-ink">Who may sign in</h2>
          <div className="mt-4 grid gap-5">
            <Field label="Allowed email domains" hint="Only verified addresses at these domains can use SSO. Press Enter after each.">
              <TagInput value={domains} onChange={setDomains} placeholder="yourhotel.com" />
            </Field>
            <Field label="When someone new signs in">
              <Segmented
                label="Provisioning"
                value={provisioning}
                onChange={setProvisioning}
                size="sm"
                options={[
                  { value: "JIT", label: "Create their account" },
                  { value: "EXISTING_ONLY", label: "Refuse unless added as staff" },
                ]}
              />
            </Field>
            {provisioning === "JIT" && (
              <Field label="Role for new accounts" hint="Never Owner. They start at your default property; change the role from Staff afterwards. Staff seats still count.">
                <Select value={defaultRole} onChange={(e) => setDefaultRole(e.target.value)} disabled={!manage} data-testid="sso-default-role">
                  {(roles.data ?? [{ id: "FRONT_DESK", key: "FRONT_DESK", name: "Front desk" }])
                    .filter((r) => r.key !== "OWNER")
                    .map((r) => (
                      <option key={r.id} value={r.key ?? r.id}>
                        {r.name}
                      </option>
                    ))}
                </Select>
              </Field>
            )}
          </div>
        </Panel>

        <Panel className={cn("p-5", enforced && "border-[color-mix(in_oklab,var(--brass)_45%,transparent)]")}>
          <Switch
            checked={enforced}
            disabled={!manage || !complete}
            onChange={(v) => (v ? setConfirmOnly(true) : setEnforced(false))}
            label="Require SSO for everyone"
            description="Password sign-in is refused for staff; only your identity provider works."
          />
          <div className="mt-4 rounded-md border border-line bg-paper p-4">
            <div className="flex gap-3">
              <Key size={18} weight="duotone" className="mt-0.5 shrink-0 text-brass" />
              <div className="min-w-0 flex-1 text-[12.5px] leading-relaxed text-ink-muted">
                <p className="font-medium text-ink">Break-glass access</p>
                One owner keeps a password, so an outage at your provider or a wrong setting never locks the hotel out. Keep that password in a safe; every break-glass sign-in is recorded in the audit log.
              </div>
            </div>
            <Field label="Break-glass owner" className="mt-3">
              <Select value={breakGlass} onChange={(e) => setBreakGlass(e.target.value)} disabled={!manage} data-testid="sso-break-glass">
                <option value="">Choose an owner</option>
                {owners.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.fullName} ({o.email})
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Panel>
      </div>

      <aside className="flex flex-col gap-4 self-start xl:sticky xl:top-20">
        <Panel className="p-5">
          <div className="flex items-center justify-between">
            <span className="eyebrow">Status</span>
            <span data-testid="sso-status">
              {s?.enabled ? (
                <Badge tone="palm" dot>
                  {s.enforced ? "On, required" : "On"}
                </Badge>
              ) : s ? (
                <Badge dot>Off</Badge>
              ) : (
                <Badge>Not set up</Badge>
              )}
            </span>
          </div>
          <div className="mt-4">
            <Switch checked={enabled} onChange={setEnabled} disabled={!manage || !complete} label="Offer SSO at sign-in" />
          </div>
          <div className="mt-4 rounded-md border border-line bg-paper px-3.5 py-3 text-[12.5px]">
            {s?.lastTest ? (
              <p className="flex items-start gap-2">
                {s.lastTest.ok ? <CheckCircle size={16} weight="fill" className="mt-px shrink-0 text-palm" /> : <XCircle size={16} weight="fill" className="mt-px shrink-0 text-danger" />}
                <span data-testid="sso-last-test" data-ok={s.lastTest.ok ? "1" : "0"}>
                  <span className="text-ink">Test {s.lastTest.ok ? "worked" : "failed"}</span>, {formatDateTime(s.lastTest.at)}
                  {s.lastTest.email && <span className="block font-mono text-ink-muted">{s.lastTest.email}</span>}
                  {s.lastTest.message && <span className={cn("block", s.lastTest.ok ? "text-ink-muted" : "text-danger")}>{s.lastTest.message}</span>}
                </span>
              </p>
            ) : (
              <p className="text-ink-muted">Not tested yet. A test opens your provider in a small window and signs nobody in here.</p>
            )}
          </div>
          {err && (
            <p role="alert" className="mt-3 text-[12.5px] text-danger">
              {err}
            </p>
          )}
          {manage && (
            <div className="mt-4 flex flex-col gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setErr(null);
                  test.mutate();
                }}
                loading={test.isPending}
                disabled={!complete}
                data-testid="sso-test"
              >
                <SignIn size={15} /> Test sign-in
              </Button>
              <Button
                onClick={() => {
                  setErr(null);
                  save.mutate();
                }}
                loading={save.isPending}
                disabled={!complete || (enforced && (!breakGlass || !recentTest))}
                data-testid="sso-save"
              >
                Save
              </Button>
              {enforced && (!breakGlass || !recentTest) && <p className="text-[12px] text-ochre">Requiring SSO needs a break-glass owner and a test that worked in the last 24 hours.</p>}
              {process.env.NODE_ENV !== "production" && (
                <p className="text-[11.5px] leading-snug text-ink-faint">
                  Development: provider Other OIDC, issuer <span className="font-mono">/api/v1/dev/oidc</span>, client <span className="font-mono">dev-client</span> / <span className="font-mono">dev-secret</span>.
                </p>
              )}
            </div>
          )}
        </Panel>
        <Panel className="p-5 text-[12.5px] text-ink-muted">
          <p className="flex items-center gap-2 font-medium text-ink">
            <ShieldCheck size={16} weight="duotone" className="text-palm" /> How it is protected
          </p>
          <p className="mt-2 leading-relaxed">Authorization code flow with PKCE, a one-time state and nonce, and the ID token checked against your provider&rsquo;s keys, audience and expiry. Only addresses the provider has verified are accepted.</p>
        </Panel>
        {s && manage && (
          <Button variant="ghost" className="self-start text-ink-muted" onClick={() => setRemove(true)}>
            <Trash size={14} /> Remove single sign-on
          </Button>
        )}
      </aside>

      <Dialog
        open={confirmOnly}
        onOpenChange={setConfirmOnly}
        eyebrow="Require SSO"
        title="Turn off passwords for staff?"
        description="Everyone except the break-glass owner must sign in through your identity provider. Anyone signed in with a password stays in until their session ends."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmOnly(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setEnforced(true);
                setConfirmOnly(false);
              }}
              data-testid="confirm-sso-only"
            >
              Require SSO
            </Button>
          </>
        }
      >
        {!recentTest && (
          <p className="flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--ochre)_40%,transparent)] bg-ochre-wash/70 px-3 py-2.5 text-[13px] text-ink">
            <WarningDiamond size={16} weight="duotone" className="mt-0.5 shrink-0 text-ochre" />
            Run a test sign-in first: it must have worked in the last 24 hours before this can be saved.
          </p>
        )}
      </Dialog>
      <ConfirmDialog open={remove} onOpenChange={setRemove} title="Remove single sign-on?" body="The SSO button disappears and everyone signs in with a password. Staff created by SSO keep their accounts but need a password reset." confirmLabel="Remove" danger onConfirm={() => del.mutateAsync()} />
    </div>
  );
}

/** Plain monochrome marks: we do not draw vendors' logos. */
export function ProviderMark({ id, className }: { id: SsoProvider | string; className?: string }) {
  if (id === "GOOGLE")
    return (
      <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-line-strong font-display text-[17px] font-semibold text-ink", className)} aria-hidden>
        G
      </span>
    );
  if (id === "MICROSOFT")
    return (
      <span className={cn("grid h-8 w-8 shrink-0 grid-cols-2 gap-[3px] rounded-sm border border-line-strong p-[7px]", className)} aria-hidden>
        <span className="bg-ink" />
        <span className="bg-ink-muted" />
        <span className="bg-ink-muted" />
        <span className="bg-ink" />
      </span>
    );
  return (
    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-sm border border-line-strong text-ink", className)} aria-hidden>
      <Fingerprint size={17} />
    </span>
  );
}
