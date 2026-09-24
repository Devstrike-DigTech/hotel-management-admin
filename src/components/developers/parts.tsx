"use client";

import { useId, useState } from "react";
import { Check, CheckSquare, Copy, Eye, EyeSlash, Square, WarningDiamond } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { EVENT_GROUPS, SCOPE_GROUPS, SCOPE_PRESETS, groupScopes, type ScopeGroup } from "@/lib/m6-catalog";
import type { ApiScopeInfo } from "@/lib/api/types-m6";
import { Checkbox } from "@/components/ui/form";

/* ---------- key stub: hk_live_ab12cd ···· 9f3e ---------- */

export function KeyStub({ display, className }: { display: string; className?: string }) {
  // "hk_live_ab12cd34ef_...9xQz"
  const i = display.indexOf("...");
  const head = i > 0 ? display.slice(0, i) : display;
  const last4 = i > 0 ? display.slice(i + 3) : "";
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1 font-mono text-[12.5px] text-ink", className)}>
      <span className="truncate">{head}</span>
      <span aria-hidden className="tracking-[0.2em] text-ink-faint">
        ····
      </span>
      <span className="sr-only">ending in</span>
      <span>{last4}</span>
    </span>
  );
}

export function ModeTag({ mode }: { mode: "LIVE" | "TEST" }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 items-center rounded-xs border px-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em]",
        mode === "LIVE" ? "border-[color-mix(in_oklab,var(--palm)_45%,transparent)] bg-palm-wash text-palm" : "border-dashed border-[color-mix(in_oklab,var(--ochre)_55%,transparent)] bg-ochre-wash/60 text-ochre",
      )}
    >
      {mode === "LIVE" ? "Live" : "Test"}
    </span>
  );
}

/* ---------- copy button ---------- */

export function CopyButton({ value, label = "Copy", className, testId, onCopied }: { value: string; label?: string; className?: string; testId?: string; onCopied?: () => void }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={() => {
        const finish = () => {
          setDone(true);
          onCopied?.();
          window.setTimeout(() => setDone(false), 1600);
        };
        try {
          void navigator.clipboard?.writeText(value).then(finish, finish);
        } catch {
          finish();
        }
      }}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-sm border px-2.5 text-[12.5px] font-medium transition-colors",
        done ? "border-[color-mix(in_oklab,var(--palm)_40%,transparent)] bg-palm-wash text-palm" : "border-line-strong bg-surface text-ink hover:bg-surface-2",
        className,
      )}
    >
      {done ? <Check size={13} weight="bold" /> : <Copy size={13} />}
      {done ? "Copied" : label}
    </button>
  );
}

/**
 * Show-once secret. The value sits on an ink slab like a stamped brass key tag;
 * it is masked until asked, can be copied, and the dialog around it can only
 * be closed once the person confirms they have stored it.
 */
export function SecretReveal({
  secret,
  label,
  what = "key",
  confirmed,
  onConfirm,
  testId = "secret-value",
}: {
  secret: string;
  label: string;
  what?: string;
  confirmed: boolean;
  onConfirm: (v: boolean) => void;
  testId?: string;
}) {
  const [show, setShow] = useState(true);
  const [copied, setCopied] = useState(false);
  const cut = secret.lastIndexOf("_");
  const head = cut > 0 ? secret.slice(0, cut + 1) : "";
  const tail = cut > 0 ? secret.slice(cut + 1) : secret;
  return (
    <div className="flex flex-col gap-4">
      <div className="relative overflow-hidden rounded-md bg-[#1b1a17] text-[#efe8dc] shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)] dark:bg-[#0c0b09]">
        <div aria-hidden className="absolute inset-y-0 left-0 w-1.5 bg-[repeating-linear-gradient(180deg,#d6a94a_0_6px,transparent_6px_10px)] opacity-70" />
        <div className="flex items-center justify-between gap-3 border-b border-white/10 py-2 pl-5 pr-3">
          <span className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-[#d6a94a]">{label}</span>
          <button type="button" onClick={() => setShow((s) => !s)} className="inline-flex items-center gap-1.5 rounded-xs px-1.5 py-1 text-[11.5px] text-[#efe8dc]/70 hover:text-[#efe8dc]" aria-pressed={!show}>
            {show ? <EyeSlash size={13} /> : <Eye size={13} />}
            {show ? "Hide" : "Show"}
          </button>
        </div>
        <p className="break-all py-4 pl-5 pr-4 font-mono text-[14px] leading-relaxed sm:text-[15px]" data-testid={testId} data-secret={secret}>
          {show ? (
            <>
              <span className="text-[#efe8dc]/55">{head}</span>
              <span>{tail}</span>
            </>
          ) : (
            <span className="tracking-[0.3em] text-[#efe8dc]/50">{"•".repeat(Math.min(40, secret.length))}</span>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 py-2.5 pl-5 pr-3">
          <CopyButton value={secret} label={`Copy ${what}`} className="border-white/15 bg-white/5 text-[#efe8dc] hover:bg-white/10" testId="copy-secret" onCopied={() => setCopied(true)} />
          {copied && <span className="text-[12px] text-[#9fd1b0]">On your clipboard. Paste it somewhere safe now.</span>}
        </div>
      </div>
      <div className="flex gap-3 rounded-md border border-[color-mix(in_oklab,var(--ochre)_40%,transparent)] bg-ochre-wash/70 px-3.5 py-3">
        <WarningDiamond size={18} weight="duotone" className="mt-0.5 shrink-0 text-ochre" />
        <div className="text-[13px] leading-snug text-ink">
          <p className="font-medium">This is the only time you will see this {what}.</p>
          <p className="mt-0.5 text-ink-muted">We keep a one-way fingerprint of it, not the {what} itself. If it is lost, rotate it and update your integration.</p>
        </div>
      </div>
      <Checkbox checked={confirmed} onChange={onConfirm} label={`I have stored the ${what} somewhere safe`} />
    </div>
  );
}

/* ---------- scope picker ---------- */

export function ScopePicker({ value, onChange, info }: { value: string[]; onChange: (v: string[]) => void; info?: ApiScopeInfo[] }) {
  const allowed = info?.map((i) => i.scope);
  // the API's labels and descriptions win; our catalogue only groups them
  const groups: ScopeGroup[] = (allowed?.length ? groupScopes(allowed) : SCOPE_GROUPS).map((g) => ({
    ...g,
    scopes: g.scopes.map((sc) => {
      const x = info?.find((i) => i.scope === sc.code);
      return x ? { ...sc, description: x.description || sc.description } : sc;
    }),
  }));
  const set = new Set(value);
  const toggle = (code: string) => {
    const next = new Set(set);
    const [res, access] = code.split(":");
    if (next.has(code)) {
      next.delete(code);
      // no write without read
      if (access === "read") next.delete(`${res}:write`);
    } else {
      next.add(code);
      if (access === "write" && groups.some((g) => g.scopes.some((s) => s.code === `${res}:read`))) next.add(`${res}:read`);
    }
    onChange([...next]);
  };
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Presets">
        {SCOPE_PRESETS.map((p) => {
          const on = p.scopes.every((s) => set.has(s)) && p.scopes.length === value.length;
          return (
            <button
              key={p.id}
              type="button"
              title={p.hint}
              onClick={() => onChange(p.scopes.filter((s) => !allowed?.length || allowed.includes(s)))}
              className={cn(
                "h-7 rounded-full border px-2.5 text-[12px] transition-colors",
                on ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:border-ink-faint hover:text-ink",
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="overflow-hidden rounded-md border border-line" role="group" aria-label="Scopes by resource">
        {groups.map((g, i) => (
          <div key={g.resource} className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-2.5", i > 0 && "border-t border-line")}>
            <div className="min-w-0">
              <p className="text-[13.5px] font-medium text-ink">{g.label}</p>
              <p className="truncate text-[12px] text-ink-muted">{g.description}</p>
            </div>
            <div className="flex gap-1">
              {(["read", "write", "manage"] as const).map((a) => {
                const s = g.scopes.find((x) => x.access === a);
                if (!s) return a === "manage" ? null : <span key={a} className="w-[64px]" aria-hidden />;
                const on = set.has(s.code);
                return (
                  <button
                    key={a}
                    type="button"
                    role="checkbox"
                    aria-checked={on}
                    aria-label={`${g.label}: ${s.label}`}
                    title={s.description}
                    data-scope={s.code}
                    onClick={() => toggle(s.code)}
                    className={cn(
                      "inline-flex h-7 w-[64px] items-center justify-center gap-1 rounded-sm border font-mono text-[11px] uppercase tracking-wider transition-colors",
                      on
                        ? a === "read"
                          ? "border-adire bg-adire text-paper"
                          : "border-laterite bg-laterite text-laterite-ink"
                        : "border-line-strong text-ink-muted hover:border-ink-faint hover:text-ink",
                    )}
                  >
                    {on ? <CheckSquare size={12} weight="fill" /> : <Square size={12} />}
                    {a}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-ink-muted">Write includes read. Give a key only what the integration needs; you can change scopes later without a new secret.</p>
    </div>
  );
}

/** Scopes as compact chips, grouped: "Reservations r/w · Rates r". */
export function ScopeSummary({ scopes, className }: { scopes: string[]; className?: string }) {
  const by = new Map<string, string[]>();
  for (const s of scopes) {
    const [res, a] = s.split(":");
    by.set(res, [...(by.get(res) ?? []), a]);
  }
  return (
    <span className={cn("flex flex-wrap gap-1", className)}>
      {[...by.entries()].map(([res, acc]) => (
        <span key={res} className="inline-flex h-5 items-center gap-1 rounded-xs border border-line bg-surface-2/60 px-1.5 text-[11px] text-ink">
          {SCOPE_GROUPS.find((g) => g.resource === res)?.label ?? res}
          <span className="font-mono text-[10px] uppercase text-ink-muted">{acc.map((a) => (a === "manage" ? "m" : a[0])).join("/")}</span>
        </span>
      ))}
    </span>
  );
}

/* ---------- event picker ---------- */

export function EventPicker({ value, onChange, available }: { value: string[]; onChange: (v: string[]) => void; available?: string[] }) {
  const id = useId();
  const groups = available?.length
    ? EVENT_GROUPS.map((g) => ({ ...g, events: g.events.filter((e) => available.includes(e.code)) })).filter((g) => g.events.length)
    : EVENT_GROUPS;
  const all = groups.flatMap((g) => g.events.map((e) => e.code));
  const set = new Set(value);
  const allOn = all.every((c) => set.has(c));
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] text-ink-muted" id={id}>
          {value.length} of {all.length} events
        </span>
        <button type="button" className="text-[12.5px] font-medium text-laterite hover:underline" onClick={() => onChange(allOn ? [] : all)}>
          {allOn ? "Clear all" : "Select all"}
        </button>
      </div>
      <div className="grid gap-px overflow-hidden rounded-md border border-line bg-line sm:grid-cols-2" aria-labelledby={id}>
        {groups.map((g) => (
          <fieldset key={g.group} className="bg-surface px-3.5 py-3">
            <legend className="sr-only">{g.group}</legend>
            <div className="mb-2 flex items-center justify-between">
              <span className="eyebrow">{g.group}</span>
            </div>
            <div className="flex flex-col gap-2">
              {g.events.map((e) => (
                <label key={e.code} className="flex cursor-pointer items-center gap-2.5" data-event={e.code}>
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={set.has(e.code)}
                    onChange={() => {
                      const n = new Set(set);
                      if (n.has(e.code)) n.delete(e.code);
                      else n.add(e.code);
                      onChange([...n]);
                    }}
                  />
                  <span aria-hidden className="grid h-4 w-4 place-items-center rounded-xs border border-line-strong bg-surface peer-checked:border-laterite peer-checked:bg-laterite peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-laterite">
                    {set.has(e.code) && <Check size={10} weight="bold" className="text-laterite-ink" />}
                  </span>
                  <span className="flex min-w-0 flex-1 items-baseline justify-between gap-2">
                    <span className="text-[13px] text-ink">{e.label}</span>
                    <span className="truncate font-mono text-[10.5px] text-ink-faint">{e.code}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>
    </div>
  );
}

/* ---------- HTTP status chip ---------- */

export function HttpStatus({ code, className }: { code: number | null | undefined; className?: string }) {
  const tone = code == null || code === 0 ? "danger" : code < 300 ? "palm" : code < 500 ? "ochre" : "danger";
  const cls = {
    palm: "text-palm border-[color-mix(in_oklab,var(--palm)_40%,transparent)] bg-palm-wash",
    ochre: "text-ochre border-[color-mix(in_oklab,var(--ochre)_45%,transparent)] bg-ochre-wash",
    danger: "text-danger border-[color-mix(in_oklab,var(--danger)_40%,transparent)] bg-danger-wash",
  }[tone];
  return <span className={cn("inline-flex h-5 min-w-[38px] items-center justify-center rounded-xs border px-1 font-mono text-[11px] font-medium", cls, className)}>{code ? code : "ERR"}</span>;
}

/** Pretty-print JSON when it parses, otherwise return as-is. */
export function prettyBody(body: string | null | undefined): string {
  if (!body) return "";
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}
