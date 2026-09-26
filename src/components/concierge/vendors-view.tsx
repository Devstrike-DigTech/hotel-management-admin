"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { EnvelopeSimple, LockKey, Phone, Plus, Star, Storefront, WhatsappLogo } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { conciergeApi } from "@/lib/api/endpoints-m8";
import { qk8, useConciergeAccess, useVendors } from "@/lib/api/hooks-m8";
import type { CommissionType, Vendor, VendorInput } from "@/lib/api/types-m8";
import { formatPhone, naira } from "@/lib/format";
import { openUpgrade, toast } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { AffixInput, Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { EmptyState, ErrorState, PageHeader, Panel, Segmented, Skeleton } from "@/components/ui/primitives";
import { LockedInline } from "@/components/gating/gate";
import { CATEGORIES, categoryMeta } from "./catalog";
import { CategoryGlyph } from "./bits";
import { ConciergeTabs } from "./tabs";

const EMPTY: VendorInput = { name: "", category: "WELLNESS", contactName: null, phone: null, whatsapp: null, email: null, notes: null, active: true, commissionType: "NONE", commissionValue: 0, payoutNotes: null };

export function commissionText(v: Pick<Vendor, "commissionType" | "commissionValue">) {
  if (v.commissionType === "NONE" || !v.commissionValue) return "None";
  return v.commissionType === "PERCENT" ? `${(v.commissionValue / 100).toLocaleString("en-NG", { maximumFractionDigits: 2 })}%` : `${naira(v.commissionValue)} a job`;
}

export function Rating({ value, count }: { value: number | null; count?: number }) {
  if (value == null) return <span className="text-[12px] text-ink-faint">Not rated</span>;
  return (
    <span className="inline-flex items-center gap-1 text-[12.5px] text-ink">
      <Star size={13} weight="fill" className="text-brass" />
      <span className="font-mono">{value.toFixed(1)}</span>
      {count != null && <span className="text-ink-faint">({count})</span>}
    </span>
  );
}

export function VendorsView() {
  const access = useConciergeAccess();
  const q = useVendors();
  const [editing, setEditing] = useState<Vendor | "new" | null>(null);
  const list = q.data ?? [];
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Storefront size={14} weight="duotone" /> Concierge
          </>
        }
        title={
          <>
            The people <em>you trust</em>.
          </>
        }
        description="Licensed spas, chefs, drivers, photographers and guides you send work to. Their numbers stay with your team; guests never see them."
        actions={
          access.catalogue ? (
            <Button onClick={() => setEditing("new")} data-testid="add-vendor">
              <Plus size={15} weight="bold" /> Add a vendor
            </Button>
          ) : undefined
        }
      />
      <ConciergeTabs />
      {!access.vendors && <LockedInline feature="concierge_vendors" className="mb-5" text="Track each vendor's commission, what you owe them after each job, and settle up in one go." />}
      {q.isError ? (
        <Panel>
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </Panel>
      ) : !q.data ? (
        <Skeleton className="h-72" />
      ) : !list.length ? (
        <Panel>
          <EmptyState glyph="river" title="No vendors yet" body="Add the outside providers you already call: the spa down the road, a chef, a car hire firm." />
        </Panel>
      ) : (
        <Panel className="overflow-hidden">
          <table className="w-full text-[13.5px] max-md:hidden" data-testid="vendor-table">
            <thead>
              <tr className="border-b border-line text-left text-[11px] uppercase tracking-[0.1em] text-ink-muted">
                <th className="px-5 py-2.5 font-medium">Vendor</th>
                <th className="px-3 py-2.5 font-medium">Contact</th>
                <th className="px-3 py-2.5 font-medium">Commission {!access.vendors && <LockKey size={11} className="inline text-brass" aria-label="on Pro" />}</th>
                <th className="px-3 py-2.5 text-right font-medium">Owed to them</th>
                <th className="px-3 py-2.5 font-medium">Rating</th>
                <th className="px-5 py-2.5 text-right font-medium">Jobs, 30 days</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {list.map((v) => (
                <tr key={v.id} className={cn("cursor-pointer hover:bg-surface-2/50", !v.active && "text-ink-muted")} data-vendor={v.name} onClick={() => setEditing(v)}>
                  <td className="px-5 py-3">
                    <button type="button" onClick={() => setEditing(v)} className="flex items-center gap-2.5 text-left">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-line bg-surface-2 text-ink-muted">
                        <CategoryGlyph category={v.category} size={16} />
                      </span>
                      <span>
                        <span className="block font-medium text-ink">{v.name}</span>
                        <span className="block text-[12px] text-ink-muted">
                          {categoryMeta(v.category).label}
                          {!v.active && " · paused"}
                        </span>
                      </span>
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <span className="block text-ink">{v.contactName ?? "-"}</span>
                    <span className="flex items-center gap-1.5 font-mono text-[12px] text-ink-muted">
                      {v.whatsapp && <WhatsappLogo size={13} aria-label="WhatsApp" />}
                      {formatPhone(v.whatsapp ?? v.phone)}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-[12.5px]">{access.vendors ? commissionText(v) : <span className="font-sans text-ink-faint">On Pro</span>}</td>
                  <td className="px-3 py-3 text-right font-mono text-[12.5px]">{v.unsettledPayableKobo == null ? <span className="text-ink-faint">-</span> : naira(v.unsettledPayableKobo)}</td>
                  <td className="px-3 py-3">
                    <Rating value={v.rating} count={v.ratingCount} />
                  </td>
                  <td className="px-5 py-3 text-right font-mono">{v.jobsLast30Days}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <ul className="divide-y divide-line md:hidden">
            {list.map((v) => (
              <li key={v.id}>
                <button type="button" onClick={() => setEditing(v)} className="flex w-full items-center gap-3 px-4 py-3 text-left">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-line bg-surface-2 text-ink-muted">
                    <CategoryGlyph category={v.category} size={17} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">{v.name}</span>
                    <span className="block truncate text-[12px] text-ink-muted">
                      {categoryMeta(v.category).label} &middot; {v.jobsLast30Days} jobs
                    </span>
                  </span>
                  <Rating value={v.rating} />
                </button>
              </li>
            ))}
          </ul>
        </Panel>
      )}
      {editing && <VendorEditor key={editing === "new" ? "new" : editing.id} vendor={editing === "new" ? null : editing} canEdit={access.catalogue} commissions={access.vendors} onClose={() => setEditing(null)} />}
    </>
  );
}

function VendorEditor({ vendor, canEdit, commissions, onClose }: { vendor: Vendor | null; canEdit: boolean; commissions: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const [d, setD] = useState<VendorInput>(() =>
    vendor ? { name: vendor.name, category: vendor.category, contactName: vendor.contactName, phone: vendor.phone, whatsapp: vendor.whatsapp, email: vendor.email, notes: vendor.notes, active: vendor.active, commissionType: vendor.commissionType, commissionValue: vendor.commissionValue, payoutNotes: vendor.payoutNotes } : EMPTY,
  );
  const [cv, setCv] = useState(() => (vendor && vendor.commissionType !== "NONE" ? String(vendor.commissionValue / 100) : ""));
  const [removing, setRemoving] = useState(false);
  const set = (p: Partial<VendorInput>) => setD((x) => ({ ...x, ...p }));
  const save = useMutation({
    mutationFn: () => {
      const n = Math.round(Number(cv.replace(/[^\d.]/g, "") || 0) * 100);
      const body: VendorInput = { name: d.name.trim(), category: d.category, contactName: d.contactName, phone: d.phone, whatsapp: d.whatsapp, email: d.email, notes: d.notes, active: d.active };
      if (commissions) Object.assign(body, { commissionType: d.commissionType, commissionValue: d.commissionType === "NONE" ? 0 : n, payoutNotes: d.payoutNotes });
      return vendor ? conciergeApi.updateVendor(vendor.id, body) : conciergeApi.createVendor(body);
    },
    onSuccess: async (v) => {
      await qc.invalidateQueries({ queryKey: qk8.vendors });
      toast.success(vendor ? "Vendor saved" : "Vendor added", v.name);
      onClose();
    },
    meta: { errorTitle: "Vendor not saved" },
  });
  const remove = useMutation({
    mutationFn: () => conciergeApi.removeVendor(vendor!.id),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk8.vendors });
      toast.success("Vendor removed");
      onClose();
    },
    meta: { errorTitle: "Not removed" },
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      eyebrow="Vendor"
      title={vendor ? vendor.name : "New vendor"}
      description="Only your team sees these details. Job messages leave out the guest's surname and room unless your settings allow them, and never carry the guest's phone."
      className="max-w-xl"
      footer={
        canEdit ? (
          <>
            {vendor && (
              <Button variant="ghost" className="mr-auto hover:text-danger" onClick={() => setRemoving(true)}>
                Remove
              </Button>
            )}
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={() => save.mutate()} loading={save.isPending} disabled={d.name.trim().length < 2 || !(d.phone || d.whatsapp)} data-testid="save-vendor">
              {vendor ? "Save" : "Add vendor"}
            </Button>
          </>
        ) : undefined
      }
    >
      <fieldset disabled={!canEdit} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_190px]">
          <Field label="Name" htmlFor="v-name">
            <Input id="v-name" value={d.name} onChange={(e) => set({ name: e.target.value })} placeholder="Lagoon Spa, Lekki" data-testid="v-name" />
          </Field>
          <Field label="What they do" htmlFor="v-cat">
            <Select id="v-cat" value={d.category} onChange={(e) => set({ category: e.target.value as VendorInput["category"] })}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Contact person" htmlFor="v-contact" optional>
          <Input id="v-contact" value={d.contactName ?? ""} onChange={(e) => set({ contactName: e.target.value || null })} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={<span className="inline-flex items-center gap-1.5"><Phone size={13} /> Phone</span>} htmlFor="v-phone">
            <Input id="v-phone" inputMode="tel" className="font-mono" value={d.phone ?? ""} onChange={(e) => set({ phone: e.target.value || null })} placeholder="+234 803 000 0000" data-testid="v-phone" />
          </Field>
          <Field label={<span className="inline-flex items-center gap-1.5"><WhatsappLogo size={13} /> WhatsApp</span>} htmlFor="v-wa" optional>
            <Input id="v-wa" inputMode="tel" className="font-mono" value={d.whatsapp ?? ""} onChange={(e) => set({ whatsapp: e.target.value || null })} />
          </Field>
        </div>
        <Field label={<span className="inline-flex items-center gap-1.5"><EnvelopeSimple size={13} /> Email</span>} htmlFor="v-email" optional>
          <Input id="v-email" type="email" value={d.email ?? ""} onChange={(e) => set({ email: e.target.value || null })} />
        </Field>
        <Field label="Notes for the team" htmlFor="v-notes" optional>
          <Textarea id="v-notes" className="min-h-14" maxLength={500} value={d.notes ?? ""} onChange={(e) => set({ notes: e.target.value || null })} placeholder="Licensed therapists only; call before 8 pm." />
        </Field>

        <div className={cn("flex flex-col gap-3 rounded-md border p-4", commissions ? "border-line" : "border-dashed border-[color-mix(in_oklab,var(--brass)_50%,transparent)] bg-brass-wash/30")}>
          <div className="flex items-center gap-2">
            <p className="text-[13.5px] font-medium text-ink">Commission</p>
            {!commissions && (
              <button type="button" onClick={() => openUpgrade({ kind: "feature", feature: "concierge_vendors", requiredPlan: "pro" })} className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-medium text-brass">
                <LockKey size={12} /> Pro
              </button>
            )}
          </div>
          <div className={cn("flex flex-col gap-3", !commissions && "pointer-events-none opacity-55")} aria-disabled={!commissions}>
            <Segmented<CommissionType>
              label="Commission"
              size="sm"
              value={d.commissionType ?? "NONE"}
              onChange={(v) => set({ commissionType: v })}
              options={[
                { value: "NONE", label: "None" },
                { value: "PERCENT", label: "A share" },
                { value: "FIXED", label: "Per job" },
              ]}
            />
            {d.commissionType !== "NONE" && (
              <Field label={d.commissionType === "PERCENT" ? "Your share of each job" : "Yours from each job"} htmlFor="v-cv" hint="Recorded when a job is completed; the rest is what you owe them.">
                <AffixInput id="v-cv" prefix={d.commissionType === "FIXED" ? "₦" : undefined} suffix={d.commissionType === "PERCENT" ? "%" : undefined} inputMode="decimal" className="w-44 font-mono" value={cv} onChange={(e) => setCv(e.target.value)} data-testid="v-commission" />
              </Field>
            )}
            <Field label="Payout notes" htmlFor="v-payout" optional>
              <Textarea id="v-payout" className="min-h-14" maxLength={500} value={d.payoutNotes ?? ""} onChange={(e) => set({ payoutNotes: e.target.value || null })} placeholder="Settles on the 5th by transfer; invoice to accounts." />
            </Field>
          </div>
          {!commissions && <p className="text-[12px] text-ink-muted">Commission and settling up are on Pro. You can still send vendors jobs and rate them.</p>}
        </div>
        <Switch checked={d.active} onChange={(v) => set({ active: v })} label={<span className="text-[13.5px]">Available for jobs</span>} />
        {vendor && (
          <p className="flex flex-wrap items-center gap-3 text-[12.5px] text-ink-muted">
            <Rating value={vendor.rating} count={vendor.ratingCount} />
            <span>&middot; {vendor.jobsLast30Days} jobs in 30 days</span>
          </p>
        )}
      </fieldset>
      <ConfirmDialog open={removing} onOpenChange={setRemoving} title={`Remove ${vendor?.name ?? "this vendor"}?`} body="If requests or services use them, switch them off instead; past requests keep their record." confirmLabel="Remove vendor" danger onConfirm={() => remove.mutateAsync()} />
    </Dialog>
  );
}
