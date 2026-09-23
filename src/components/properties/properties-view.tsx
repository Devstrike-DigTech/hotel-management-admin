"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Buildings, Check, Globe, LockSimple, Plus, Storefront, TreeStructure } from "@phosphor-icons/react";
import { useEntitlements } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import { useStaff } from "@/lib/api/hooks";
import { propertiesApi } from "@/lib/api/endpoints-m5";
import { useMyProperties } from "@/lib/api/hooks-m5";
import type { PropertyAccess, PropertySummary } from "@/lib/api/types-m5";
import type { Staff } from "@/lib/api/types";
import { usePropertyId } from "@/lib/property";
import { NIGERIAN_STATES, roleLabel } from "@/lib/catalog";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { Sheet } from "@/components/ui/overlay";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge, Meter, PageHeader, Panel, PanelHeader, PlanPlate, Skeleton } from "@/components/ui/primitives";
import { useSwitchProperty } from "@/components/shell/property-switcher";
import { PROPERTY_COLORS } from "@/components/group/group-view";

export function PropertiesView() {
  const { has, limit, usage, requiredPlan, me } = useEntitlements();
  const { can } = useCan();
  const props = useMyProperties();
  const list = props.data?.items ?? [];
  const current = usePropertyId();
  const switchTo = useSwitchProperty();
  const [add, setAdd] = useState(false);
  const multi = has("multi_property");
  const max = limit("max_properties");
  const used = usage?.properties ?? list.length;
  const full = max !== undefined && max >= 0 && used >= max;
  const plan = requiredPlan("multi_property");
  const group = props.data?.group?.name ?? me?.tenant.name ?? "";
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <TreeStructure size={14} weight="duotone" /> Properties &middot; {group}
          </>
        }
        title={
          <>
            One group, <em>{list.length > 1 ? `${list.length} houses` : "every house"}</em>.
          </>
        }
        description="Each property has its own rooms, rates, menus, cashier shifts and invoice numbers. Staff work in the properties you give them; guests, loyalty, company accounts and promo codes are shared by the group."
        actions={
          can("properties.manage") && multi ? (
            <Button onClick={() => setAdd(true)} disabled={full} data-testid="add-property">
              <Plus size={15} weight="bold" /> Add a property
            </Button>
          ) : undefined
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="grid gap-4 sm:grid-cols-2">
          {props.isLoading && [0, 1].map((i) => <Skeleton key={i} className="h-72" />)}
          {list.map((p, i) => (
            <PropertyCard key={p.id} p={p} color={PROPERTY_COLORS[i % PROPERTY_COLORS.length]} current={p.id === current || (!current && p.isPrimary)} onSwitch={() => switchTo(p.id, p.name)} />
          ))}
          {!multi && (
            <Panel className="flex flex-col items-start justify-center gap-3 border-dashed p-6">
              <span className="grid h-10 w-10 place-items-center rounded-full border border-[color-mix(in_oklab,var(--brass)_40%,transparent)] bg-brass-wash text-brass">
                <LockSimple size={18} weight="duotone" />
              </span>
              <p className="display-sm text-[19px] text-ink">A second hotel?</p>
              <p className="text-[13px] leading-relaxed text-ink-muted">Run several properties from one account on {plan.name}: switch between them, compare them in group reports, and share guests and loyalty across the group.</p>
              <ButtonLink href={`/billing?plan=${plan.code}#plans`} size="sm">
                Upgrade to {plan.name} <ArrowRight size={13} />
              </ButtonLink>
            </Panel>
          )}
        </div>
        <Panel className="self-start p-5">
          <p className="eyebrow">On your plan</p>
          <div className="mt-2 flex items-center gap-2">{me && <PlanPlate name={me.subscription.planName} code={me.subscription.planCode} />}</div>
          <Meter className="mt-4" label="Properties" used={used} max={max} />
          {full && multi && (
            <p className="mt-3 text-[12.5px] text-ink-muted">
              The group is full. <Link href="/billing#plans" className="font-medium text-laterite hover:underline">Enterprise</Link> has no limit.
            </p>
          )}
          {multi && list.length > 1 && (
            <Link href="/group" className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-laterite hover:underline">
              Group reports <ArrowRight size={12} />
            </Link>
          )}
        </Panel>
      </div>
      {multi && can("staff.manage") && list.length > 1 && <StaffAccess props={list} />}
      <AddPropertySheet open={add} onOpenChange={setAdd} props={list} />
    </>
  );
}

function PropertyCard({ p, color, current, onSwitch }: { p: PropertySummary; color: string; current: boolean; onSwitch: () => void }) {
  return (
    <Panel className={cn("flex flex-col overflow-hidden", current && "shadow-[0_0_0_1px_var(--ink)]")} data-testid={`property-${p.slug}`}>
      <div className="relative h-32 overflow-hidden border-b border-line bg-surface-2">
        <div className="absolute inset-0 grid place-items-center text-ink-faint" aria-hidden>
          <Buildings size={34} weight="thin" />
        </div>
        {p.coverImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote hotel photos from any host
          <img src={p.coverImageUrl} alt="" className="relative h-full w-full object-cover" loading="lazy" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
        ) : (
          <div className="grid h-full place-items-center text-ink-faint">
            <Buildings size={34} weight="thin" />
          </div>
        )}
        <span className="absolute left-3 top-3 rounded-xs bg-[color-mix(in_oklab,var(--ink)_78%,transparent)] px-1.5 py-0.5 font-mono text-[11px] tracking-[0.14em] text-paper">{p.invoicePrefix ?? "-"}</span>
        <span className="absolute inset-x-0 bottom-0 h-[3px]" style={{ background: color }} aria-hidden />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start gap-2">
          <p className="display-sm min-w-0 flex-1 text-[18px] leading-tight text-ink">{p.name}</p>
          {p.isPrimary && <Badge tone="brass">Primary</Badge>}
        </div>
        <p className="mt-1 text-[12.5px] text-ink-muted">{[p.area, p.city, p.state].filter(Boolean).join(", ")}</p>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
          <div>
            <dt className="text-ink-muted">Rooms</dt>
            <dd className="font-mono text-ink">{p.roomCount}</dd>
          </div>
          <div>
            <dt className="text-ink-muted">Invoices</dt>
            <dd className="font-mono text-ink">{p.invoicePrefix ? `INV-${p.invoicePrefix}-…` : "INV-2026-…"}</dd>
          </div>
        </dl>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.listedOnMarketplace && (
            <Badge tone="brass" icon={<Storefront size={11} />}>
              Marketplace
            </Badge>
          )}
          {p.customDomain && (
            <Badge tone="adire" icon={<Globe size={11} />}>
              {p.customDomain}
            </Badge>
          )}
        </div>
        <div className="mt-auto pt-4">
          {current ? (
            <span className="inline-flex h-8 items-center gap-1.5 text-[13px] font-medium text-palm">
              <Check size={14} weight="bold" /> You are working here
            </span>
          ) : (
            <Button size="sm" variant="secondary" onClick={onSwitch} data-testid={`switch-to-${p.slug}`}>
              Work in this property <ArrowRight size={13} />
            </Button>
          )}
        </div>
      </div>
    </Panel>
  );
}

/** Who works where: every staff member against every property. */
function StaffAccess({ props }: { props: PropertySummary[] }) {
  const staff = useStaff();
  const rows = (staff.data ?? []).filter((s) => s.isActive !== false) as (Staff & { propertyAccess?: PropertyAccess })[];
  return (
    <Panel className="mt-6 overflow-hidden">
      <PanelHeader eyebrow="Staff access" title="Who works where" description="A role applies in every property a person can open, and nowhere else. Owners open every property." />
      <div className="scrollbar-thin overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13px]">
          <thead>
            <tr className="border-b border-line">
              <th className="eyebrow px-5 py-2.5 text-left text-[10px] font-normal">Staff</th>
              <th className="eyebrow px-3 py-2.5 text-center text-[10px] font-normal">All, including new ones</th>
              {props.map((p) => (
                <th key={p.id} className="px-3 py-2.5 text-center text-[12px] font-medium text-ink">
                  {p.name}
                </th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {staff.isLoading && (
              <tr>
                <td colSpan={props.length + 3}>
                  <Skeleton className="m-5 h-24" />
                </td>
              </tr>
            )}
            {rows.map((s) => (
              <AccessRow key={s.id} s={s} props={props} />
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function AccessRow({ s, props }: { s: Staff & { propertyAccess?: PropertyAccess }; props: PropertySummary[] }) {
  const qc = useQueryClient();
  const owner = s.role === "OWNER";
  const init = useMemo(() => s.propertyAccess ?? { allProperties: true, propertyIds: [] }, [s.propertyAccess]);
  const [a, setA] = useState<PropertyAccess>(init);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- adopt the saved access
    setA(init);
  }, [init]);
  const dirty = JSON.stringify(a) !== JSON.stringify(init);
  const save = useMutation({
    mutationFn: () => propertiesApi.staffAccess(s.id, a.allProperties ? { allProperties: true, propertyIds: [] } : a),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["staff"] });
      toast.success(`${s.fullName}'s access saved`, a.allProperties ? "Every property, including new ones." : `${a.propertyIds.length} ${a.propertyIds.length === 1 ? "property" : "properties"}.`);
    },
    meta: { errorTitle: "Access not saved" },
  });
  const toggle = (id: string) =>
    setA((cur) => {
      const ids = cur.allProperties ? props.map((p) => p.id) : cur.propertyIds;
      const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
      return { allProperties: false, propertyIds: next };
    });
  return (
    <tr className="border-b border-line last:border-b-0" data-testid={`access-${s.email}`}>
      <td className="px-5 py-2.5">
        <span className="block font-medium text-ink">{s.fullName}</span>
        <span className="text-[11.5px] text-ink-muted">{roleLabel({ role: s.role, roleName: s.roleName })}</span>
      </td>
      <td className="px-3 py-2.5 text-center">
        <Box on={owner || a.allProperties} disabled={owner} onClick={() => setA((cur) => (cur.allProperties ? { allProperties: false, propertyIds: props.map((p) => p.id) } : { allProperties: true, propertyIds: [] }))} label={`${s.fullName}: every property`} />
      </td>
      {props.map((p) => (
        <td key={p.id} className="px-3 py-2.5 text-center">
          <Box on={owner || a.allProperties || a.propertyIds.includes(p.id)} disabled={owner || a.allProperties} faint={a.allProperties && !owner} onClick={() => toggle(p.id)} label={`${s.fullName}: ${p.name}`} />
        </td>
      ))}
      <td className="px-4 py-2.5 text-right">
        {dirty && (
          <Button size="sm" onClick={() => save.mutate()} loading={save.isPending} disabled={!a.allProperties && !a.propertyIds.length}>
            Save
          </Button>
        )}
      </td>
    </tr>
  );
}

function Box({ on, disabled, faint, onClick, label }: { on: boolean; disabled?: boolean; faint?: boolean; onClick: () => void; label: string }) {
  return (
    <button type="button" role="checkbox" aria-checked={on} aria-label={label} disabled={disabled} onClick={onClick} className={cn("inline-grid h-6 w-6 place-items-center rounded-xs border transition-colors disabled:cursor-default", on ? (faint ? "border-line-strong bg-surface-2 text-ink-muted" : "border-ink bg-ink text-paper") : "border-line-strong bg-surface hover:border-ink-faint")}>
      {on && <Check size={13} weight="bold" />}
    </button>
  );
}

function AddPropertySheet({ open, onOpenChange, props }: { open: boolean; onOpenChange: (o: boolean) => void; props: PropertySummary[] }) {
  const qc = useQueryClient();
  const switchTo = useSwitchProperty();
  const [f, setF] = useState({ name: "", city: "Lagos", state: "Lagos", area: "", address: "", phone: "", slug: "", invoicePrefix: "", copyFrom: props[0]?.id ?? "" });
  const slug = f.slug || f.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const prefix = f.invoicePrefix || f.name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 4).toUpperCase();
  const create = useMutation({
    mutationFn: () => propertiesApi.create({ name: f.name.trim(), city: f.city, state: f.state, area: f.area || undefined, address: f.address || undefined, phone: f.phone || undefined, slug: slug || undefined, invoicePrefix: prefix || undefined, copyFromPropertyId: f.copyFrom || undefined }),
    onSuccess: (p) => {
      void qc.invalidateQueries({ queryKey: ["me"] });
      void qc.invalidateQueries({ queryKey: ["properties"] });
      onOpenChange(false);
      toast.success(`${p.name} added`, "Switch to it to add its rooms, rates and menus.", { label: "Work in it now", onClick: () => switchTo(p.id as string, p.name as string) });
    },
    meta: { errorTitle: "Property not added" },
  });
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="The group"
      title="Add a property"
      description="It starts empty: rooms, room types, rates and menus are added from inside it."
      width="max-w-lg"
      footer={
        <Button className="w-full" onClick={() => create.mutate()} loading={create.isPending} disabled={f.name.trim().length < 2 || !f.city}>
          Add the property
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Palmwine House Abuja" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="City">
            <Input value={f.city} onChange={(e) => setF({ ...f, city: e.target.value })} />
          </Field>
          <Field label="State">
            <Select value={f.state} onChange={(e) => setF({ ...f, state: e.target.value })}>
              {NIGERIAN_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Area" optional>
          <Input value={f.area} onChange={(e) => setF({ ...f, area: e.target.value })} placeholder="Maitama" />
        </Field>
        <Field label="Address" optional>
          <Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Web address" hint={`${slug || "your-hotel"}.hotelos.ng`}>
            <Input value={f.slug} onChange={(e) => setF({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })} placeholder={slug} className="font-mono" />
          </Field>
          <Field label="Invoice prefix" hint={`INV-${prefix || "XXX"}-2026-000001`}>
            <Input value={f.invoicePrefix} onChange={(e) => setF({ ...f, invoicePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6) })} placeholder={prefix} className="font-mono" />
          </Field>
        </div>
        <Field label="Copy settings from" hint="Taxes, booking and cancellation policy, housekeeping checklists and alerts. Not rooms, rates or menus.">
          <Select value={f.copyFrom} onChange={(e) => setF({ ...f, copyFrom: e.target.value })}>
            <option value="">Start from the defaults</option>
            {props.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Sheet>
  );
}
