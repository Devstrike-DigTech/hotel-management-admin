"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FloppyDisk, Info } from "@phosphor-icons/react";
import { useTaxSettings, qk2 } from "@/lib/api/hooks-m2";
import { taxApi } from "@/lib/api/endpoints-m2";
import type { TaxComponent, TaxSettings } from "@/lib/api/types-m2";
import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/store";
import { naira } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input, Switch } from "@/components/ui/form";
import { ErrorState, PageHeader, Panel, Segmented, Skeleton } from "@/components/ui/primitives";

const SAMPLE = 5_000_000; // ₦50,000 room night

export function TaxSettingsView() {
  const q = useTaxSettings();
  const qc = useQueryClient();
  const { can } = useCan();
  const editable = can("tax.write");
  const [draft, setDraft] = useState<TaxSettings | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- seed the editable copy once loaded
    if (q.data && !draft) setDraft(q.data);
  }, [q.data, draft]);
  const save = useMutation({
    mutationFn: () =>
      taxApi.update({
        vat: draft!.vat,
        consumptionTax: draft!.consumptionTax,
        serviceCharge: draft!.serviceCharge,
        discountApprovalThresholdBps: draft!.discountApprovalThresholdBps,
      }),
    onSuccess: (d) => {
      qc.setQueryData(qk2.tax, d);
      setDraft(d);
      toast.success("Tax settings saved", "They apply to charges posted from now on.");
    },
    meta: { errorTitle: "Not saved" },
  });

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const dirty = !!draft && !!q.data && JSON.stringify(draft) !== JSON.stringify(q.data);
  const set = (k: "vat" | "consumptionTax" | "serviceCharge", patch: Partial<TaxComponent & { label: string }>) =>
    setDraft((d) => (d ? { ...d, [k]: { ...d[k], ...patch } } : d));

  // worked example on a ₦50,000 night
  const example = (() => {
    if (!draft) return null;
    const comps = [
      { key: "VAT", c: draft.vat, label: "VAT" },
      { key: "CONS", c: draft.consumptionTax, label: draft.consumptionTax.label || "Consumption tax" },
      { key: "SC", c: draft.serviceCharge, label: "Service charge" },
    ].filter((x) => x.c.enabled);
    const inclRate = comps.filter((x) => x.c.inclusive).reduce((s, x) => s + x.c.rateBps / 10000, 0);
    const net = Math.round(SAMPLE / (1 + inclRate));
    const lines = comps.map((x) => ({ label: `${x.label} ${x.c.rateBps / 100}%${x.c.inclusive ? " incl." : ""}`, amount: Math.round(net * (x.c.rateBps / 10000)), inclusive: x.c.inclusive }));
    const netLine = SAMPLE - lines.filter((l) => l.inclusive).reduce((s, l) => s + l.amount, 0);
    const total = netLine + lines.reduce((s, l) => s + l.amount, 0);
    return { netLine, lines, total };
  })();

  return (
    <>
      <PageHeader
        eyebrow="The house"
        title={
          <>
            Taxes &amp; <em>charges</em>
          </>
        }
        description="How VAT, state consumption tax and service charge are added to every charge on a folio. Changes apply to new charges only."
        actions={
          editable && (
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!dirty}>
              <FloppyDisk size={15} weight="bold" /> Save changes
            </Button>
          )
        }
      />
      {!draft ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-7">
            <TaxRow title="VAT" blurb="Value added tax, 7.5% in Nigeria." c={draft.vat} onChange={(p) => set("vat", p)} disabled={!editable} />
            <TaxRow
              title={draft.consumptionTax.label || "Consumption tax"}
              blurb="State hotel consumption tax, e.g. Lagos 5%."
              c={draft.consumptionTax}
              onChange={(p) => set("consumptionTax", p)}
              disabled={!editable}
              label={draft.consumptionTax.label}
              onLabel={(label) => set("consumptionTax", { label })}
            />
            <TaxRow title="Service charge" blurb="Added for staff; shown on its own line." c={draft.serviceCharge} onChange={(p) => set("serviceCharge", p)} disabled={!editable} />
            <Panel className="px-5 py-5">
              <p className="display-sm text-[17px] text-ink">Discount approval threshold</p>
              <p className="mt-1 text-[13px] text-ink-muted">Discounts above this need a manager&rsquo;s PIN (Growth and up), or are flagged for the owner.</p>
              <div className="mt-4 flex items-center gap-4">
                <input
                  type="range"
                  min={0}
                  max={5000}
                  step={100}
                  value={draft.discountApprovalThresholdBps}
                  onChange={(e) => setDraft({ ...draft, discountApprovalThresholdBps: Number(e.target.value) })}
                  disabled={!editable}
                  className="flex-1 accent-[var(--laterite)]"
                  aria-label="Discount approval threshold"
                />
                <span className="w-16 text-right font-mono text-[20px] text-ink">{draft.discountApprovalThresholdBps / 100}%</span>
              </div>
            </Panel>
          </div>
          <Panel className="self-start lg:sticky lg:top-20 lg:col-span-5">
            <div className="border-b border-line px-5 py-4">
              <p className="eyebrow mb-1">Worked example</p>
              <p className="display-sm text-[18px] text-ink">A {naira(SAMPLE)} room night</p>
            </div>
            {example && (
              <dl className="px-5 py-4 text-[13.5px]">
                <div className="flex justify-between py-1.5">
                  <dt className="text-ink-muted">Room (net)</dt>
                  <dd className="font-mono text-ink">{naira(example.netLine)}</dd>
                </div>
                {example.lines.map((l) => (
                  <div key={l.label} className="flex justify-between py-1.5">
                    <dt className="text-ink-muted">{l.label}</dt>
                    <dd className="font-mono text-ink">{naira(l.amount)}</dd>
                  </div>
                ))}
                <div className="mt-2 flex items-baseline justify-between border-t-2 border-double border-line-strong pt-3">
                  <dt className="display-sm text-[16px] text-ink">Guest pays</dt>
                  <dd className="font-mono text-[22px] text-ink">{naira(example.total)}</dd>
                </div>
              </dl>
            )}
            <p className="flex items-start gap-2 border-t border-line px-5 py-3 text-[12px] text-ink-muted">
              <Info size={14} className="mt-px shrink-0" />
              Each tax is worked out on the net amount, never on another tax. Inclusive rates come out of the price you enter.
            </p>
          </Panel>
        </div>
      )}
    </>
  );
}

function TaxRow({
  title,
  blurb,
  c,
  onChange,
  disabled,
  label,
  onLabel,
}: {
  title: string;
  blurb: string;
  c: TaxComponent;
  onChange: (p: Partial<TaxComponent>) => void;
  disabled?: boolean;
  label?: string;
  onLabel?: (v: string) => void;
}) {
  return (
    <Panel className={cn("px-5 py-5 transition-opacity", !c.enabled && "opacity-80")}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="display-sm text-[17px] text-ink">{title}</p>
          <p className="mt-0.5 text-[13px] text-ink-muted">{blurb}</p>
        </div>
        <Switch checked={c.enabled} onChange={(v) => onChange({ enabled: v })} disabled={disabled} ariaLabel={`${title} on`} />
      </div>
      {c.enabled && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {onLabel && (
            <Input value={label ?? ""} onChange={(e) => onLabel(e.target.value)} disabled={disabled} className="h-9 max-w-[220px]" aria-label="Label on invoices" />
          )}
          <div className="flex h-9 items-stretch overflow-hidden rounded-md border border-line-strong bg-surface">
            <input
              inputMode="decimal"
              value={c.rateBps / 100}
              disabled={disabled}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onChange({ rateBps: Number.isFinite(v) ? Math.max(0, Math.min(5000, Math.round(v * 100))) : 0 });
              }}
              className="w-16 bg-transparent px-2.5 text-right font-mono text-[14px] text-ink outline-none"
              aria-label={`${title} rate percent`}
            />
            <span className="flex items-center border-l border-line bg-surface-2/60 px-2 font-mono text-[12px] text-ink-muted">%</span>
          </div>
          <Segmented<"ex" | "in">
            label={`${title} is`}
            size="sm"
            value={c.inclusive ? "in" : "ex"}
            onChange={(v) => !disabled && onChange({ inclusive: v === "in" })}
            options={[
              { value: "ex", label: "Added on top" },
              { value: "in", label: "Included in price" },
            ]}
          />
        </div>
      )}
    </Panel>
  );
}
