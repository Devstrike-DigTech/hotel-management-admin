"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowSquareOut, CashRegister, ForkKnife, MagnifyingGlass, Plus, Trash, X } from "@phosphor-icons/react";
import { useCan } from "@/lib/permissions";
import { posApi } from "@/lib/api/endpoints-m5";
import { qk5, useMenuCategories, useMenuItems, useOutlets, usePriceRules, useStockItems } from "@/lib/api/hooks-m5";
import type { KdsStation, MenuItem, MenuItemInput, Outlet, OutletType, PriceRule } from "@/lib/api/types-m5";
import { naira } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Sheet } from "@/components/ui/overlay";
import { Field, Input, Select, Switch, Textarea } from "@/components/ui/form";
import { Badge, EmptyState, PageHeader, Panel, Segmented, Skeleton } from "@/components/ui/primitives";
import { NairaInput } from "@/components/m2/bits";
import { catColor } from "./menu-board";
import { OUTLET_LABEL } from "./model";

type Tab = "menu" | "outlets" | "happy";
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATION_LABEL: Record<KdsStation, string> = { KITCHEN: "Kitchen", BAR: "Bar", NONE: "No ticket" };

export function MenuAdmin() {
  const sp = useSearchParams();
  const router = useRouter();
  const tab = (sp.get("tab") as Tab) ?? "menu";
  const setTab = (t: Tab) => router.replace(t === "menu" ? "/pos/menu" : `/pos/menu?tab=${t}`, { scroll: false });
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <ForkKnife size={14} weight="duotone" /> Menu & outlets
          </>
        }
        title={
          <>
            The menu, <em>priced and ready</em>.
          </>
        }
        description="Items with their options and the tills that sell them, the kitchen or bar that makes them, and the happy hours that change their price."
        actions={
          <Link href="/pos" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-ink px-3.5 text-[13px] font-medium text-paper hover:opacity-90">
            <CashRegister size={15} /> Open the till <ArrowSquareOut size={12} />
          </Link>
        }
      />
      <Segmented
        label="Menu sections"
        value={tab}
        onChange={setTab}
        className="mb-6"
        options={[
          { value: "menu", label: "Menu" },
          { value: "outlets", label: "Outlets" },
          { value: "happy", label: "Happy hours" },
        ]}
      />
      {tab === "outlets" ? <Outlets /> : tab === "happy" ? <HappyHours /> : <Menu />}
    </>
  );
}

/* ---------------- menu ---------------- */

function Menu() {
  const qc = useQueryClient();
  const { can } = useCan();
  const manage = can("pos.manage");
  const cats = useMenuCategories();
  const outlets = useOutlets();
  const [cat, setCat] = useState<string>("");
  const [q, setQ] = useState("");
  const items = useMenuItems({ categoryId: cat || undefined, q: q.trim() || undefined });
  const [edit, setEdit] = useState<Partial<MenuItem> | null>(null);
  const [newCat, setNewCat] = useState("");
  const sortedCats = useMemo(() => [...(cats.data ?? [])].sort((a, b) => a.sortOrder - b.sortOrder), [cats.data]);
  const catIndex = new Map(sortedCats.map((c, i) => [c.id, i]));
  const avail = useMutation({
    mutationFn: (it: MenuItem) => posApi.setAvailability(it.id, !it.available),
    onSuccess: (it) => {
      void qc.invalidateQueries({ queryKey: ["pos"] });
      toast.info(it.available ? `${it.name} is back on` : `${it.name} is 86`, it.available ? undefined : "It shows as sold out on every till.");
    },
    meta: { errorTitle: "Not changed" },
  });
  const addCat = useMutation({ mutationFn: () => posApi.createCategory({ name: newCat.trim() }), onSuccess: () => { setNewCat(""); void qc.invalidateQueries({ queryKey: qk5.categories }); }, meta: { errorTitle: "Category not added" } });
  return (
    <div className="grid gap-5 lg:grid-cols-[230px_1fr]">
      <Panel as="div" className="self-start p-2">
        {[{ id: "", name: "Everything", itemCount: sortedCats.reduce((s, c) => s + c.itemCount, 0) }, ...sortedCats].map((c) => (
          <button key={c.id || "all"} type="button" onClick={() => setCat(c.id)} className={cn("flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13.5px]", cat === c.id ? "bg-surface-2 font-medium text-ink" : "text-ink-muted hover:bg-surface-2/60 hover:text-ink")}>
            <span className="h-4 w-[3px] rounded-full" style={{ background: c.id ? catColor(catIndex.get(c.id) ?? 0) : "var(--line-strong)" }} aria-hidden />
            <span className="flex-1 truncate">{c.name}</span>
            <span className="font-mono text-[11px] text-ink-faint">{c.itemCount}</span>
          </button>
        ))}
        {manage && (
          <form className="mt-2 flex gap-1 border-t border-line p-1 pt-3" onSubmit={(e) => { e.preventDefault(); if (newCat.trim()) addCat.mutate(); }}>
            <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="New category" className="h-8 text-[13px]" aria-label="New category" />
            <Button type="submit" size="icon-sm" variant="secondary" aria-label="Add category" disabled={!newCat.trim()}>
              <Plus size={13} />
            </Button>
          </form>
        )}
      </Panel>
      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 sm:px-5">
          <label className="relative flex min-w-[200px] flex-1 items-center sm:max-w-xs">
            <MagnifyingGlass size={15} className="pointer-events-none absolute left-2.5 text-ink-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find an item" aria-label="Find an item" className="h-9 w-full rounded-md border border-line-strong bg-surface pl-8 pr-2 text-[16px] outline-none focus:border-laterite sm:text-[13.5px]" />
          </label>
          {manage && (
            <Button className="ml-auto" onClick={() => setEdit({ categoryId: cat || sortedCats[0]?.id, name: "", priceKobo: 0, available: true, vat: true, consumptionTax: true, outletIds: [], modifiers: [], stockLinks: [], station: null })}>
              <Plus size={14} weight="bold" /> Item
            </Button>
          )}
        </div>
        {items.isLoading ? (
          <Skeleton className="m-5 h-64" />
        ) : !(items.data ?? []).length ? (
          <EmptyState glyph="dots" title="No items here" body="Add jollof, suya and the drinks the bar sells; each can have options like pepper level." />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="border-b border-line text-left">
                  {["Item", "Price", "Sold at", "Options", "Tax", "On the menu"].map((h, i) => (
                    <th key={h} className={cn("eyebrow px-4 py-2.5 text-[10px] font-normal", i === 1 && "text-right")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(items.data ?? []).map((it) => (
                  <tr key={it.id} className={cn("border-b border-line last:border-b-0 hover:bg-surface-2/40", !it.available && "bg-[repeating-linear-gradient(-45deg,transparent_0_6px,color-mix(in_oklab,var(--ink)_4%,transparent)_6px_7px)]")}>
                    <td className="px-4 py-2.5">
                      <button type="button" className="text-left" onClick={() => manage && setEdit(it)} disabled={!manage}>
                        <span className="flex items-center gap-2">
                          <span className="h-4 w-[3px] rounded-full" style={{ background: catColor(catIndex.get(it.categoryId) ?? 0) }} aria-hidden />
                          <span className={cn("font-medium", it.available ? "text-ink hover:text-laterite" : "text-ink-muted")}>{it.name}</span>
                        </span>
                        <span className="block pl-[11px] text-[11.5px] text-ink-muted">
                          {it.categoryName}
                          {it.station ? ` · ${STATION_LABEL[it.station]}` : ""}
                          {it.stockLinks.length ? ` · stock: ${it.stockLinks.map((s) => `${s.quantity} ${s.unit}`).join(", ")}` : ""}
                        </span>
                      </button>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-ink">{naira(it.priceKobo)}</td>
                    <td className="px-4 py-2.5">
                      {it.outletIds.length ? (
                        <span className="flex flex-wrap gap-1">
                          {it.outletIds.map((id) => (
                            <Badge key={id}>{outlets.data?.find((o) => o.id === id)?.name ?? "outlet"}</Badge>
                          ))}
                        </span>
                      ) : (
                        <span className="text-[12px] text-ink-muted">every outlet</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-ink-muted">{it.modifiers.length ? it.modifiers.map((g) => g.name).join(", ") : "-"}</td>
                    <td className="px-4 py-2.5 font-mono text-[11px] text-ink-muted">{[it.vat && "VAT", it.consumptionTax && "CT"].filter(Boolean).join(" + ") || "none"}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2">
                        <Switch checked={it.available} onChange={() => avail.mutate(it)} disabled={!can("pos.order")} ariaLabel={`${it.name} on the menu`} />
                        {!it.available && <span className="rounded-xs border border-danger px-1 font-mono text-[10px] text-danger">86</span>}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <ItemSheet item={edit} onClose={() => setEdit(null)} cats={sortedCats} outlets={outlets.data ?? []} />
    </div>
  );
}

type GroupDraft = { id?: string; name: string; required: boolean; multiple: boolean; options: { id?: string; name: string; priceKobo: number }[] };

function ItemSheet({ item, onClose, cats, outlets }: { item: Partial<MenuItem> | null; onClose: () => void; cats: { id: string; name: string }[]; outlets: Outlet[] }) {
  const qc = useQueryClient();
  const stock = useStockItems({}, !!item);
  const [d, setD] = useState<Partial<MenuItem> | null>(null);
  const [groups, setGroups] = useState<GroupDraft[]>([]);
  const [links, setLinks] = useState<{ stockItemId: string; quantity: number }[]>([]);
  const [lastId, setLastId] = useState<string | undefined | null>(null);
  const [del, setDel] = useState(false);
  if (item && item.id !== lastId) {
    setLastId(item.id);
    setD(item);
    setGroups((item.modifiers ?? []).map((g) => ({ id: g.id, name: g.name, required: g.required, multiple: g.multiple, options: g.options.map((o) => ({ id: o.id, name: o.name, priceKobo: o.priceKobo })) })));
    setLinks((item.stockLinks ?? []).map((s) => ({ stockItemId: s.stockItemId, quantity: s.quantity })));
  }
  if (!item && lastId !== null) setLastId(null);
  const save = useMutation({
    mutationFn: () => {
      const b: MenuItemInput = {
        categoryId: d?.categoryId,
        name: d?.name?.trim(),
        description: d?.description ?? "",
        priceKobo: d?.priceKobo ?? 0,
        outletIds: d?.outletIds ?? [],
        available: d?.available ?? true,
        vat: d?.vat ?? true,
        consumptionTax: d?.consumptionTax ?? true,
        station: d?.station ?? null,
        modifiers: groups.filter((g) => g.name.trim() && g.options.some((o) => o.name.trim())).map((g) => ({ name: g.name.trim(), required: g.required, multiple: g.multiple, options: g.options.filter((o) => o.name.trim()).map((o) => ({ name: o.name.trim(), priceKobo: o.priceKobo })) })),
        stockLinks: links.filter((l) => l.stockItemId && l.quantity > 0),
      };
      return d?.id ? posApi.updateItem(d.id, b) : posApi.createItem(b);
    },
    onSuccess: (it) => {
      void qc.invalidateQueries({ queryKey: ["pos"] });
      toast.success(`${it.name} saved`, "Every till picks it up within a minute.");
      onClose();
    },
    meta: { errorTitle: "Item not saved" },
  });
  const remove = useMutation({ mutationFn: () => posApi.deleteItem(d!.id!), onSuccess: () => { void qc.invalidateQueries({ queryKey: ["pos"] }); onClose(); }, meta: { errorTitle: "Not removed" } });
  const setG = (i: number, patch: Partial<GroupDraft>) => setGroups((gs) => gs.map((g, j) => (j === i ? { ...g, ...patch } : g)));
  return (
    <Sheet
      open={!!item}
      onOpenChange={(o) => !o && onClose()}
      eyebrow="Menu item"
      title={d?.id ? (d.name ?? "Item") : "A new item"}
      width="max-w-xl"
      footer={
        <>
          {d?.id && (
            <Button variant="ghost" className="text-danger" onClick={() => setDel(true)}>
              <Trash size={14} /> Remove
            </Button>
          )}
          <Button className="ml-auto" onClick={() => save.mutate()} loading={save.isPending} disabled={!d?.name?.trim() || !d?.categoryId || !d?.priceKobo}>
            Save item
          </Button>
        </>
      }
    >
      {d && (
        <div className="flex flex-col gap-4">
          <Field label="Name">
            <Input value={d.name ?? ""} onChange={(e) => setD({ ...d, name: e.target.value })} placeholder="Party jollof rice" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <Select value={d.categoryId ?? ""} onChange={(e) => setD({ ...d, categoryId: e.target.value })}>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Price" hint="What the guest pays; inclusive taxes stay inside">
              <NairaInput kobo={d.priceKobo ?? null} onChange={(v) => setD({ ...d, priceKobo: v ?? 0 })} />
            </Field>
          </div>
          <Field label="Description" optional>
            <Textarea value={d.description ?? ""} onChange={(e) => setD({ ...d, description: e.target.value })} rows={2} />
          </Field>
          <div>
            <p className="mb-2 text-[13px] font-medium text-ink">Sold at</p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" aria-pressed={!(d.outletIds ?? []).length} onClick={() => setD({ ...d, outletIds: [] })} className={cn("h-8 rounded-full border px-3 text-[12.5px]", !(d.outletIds ?? []).length ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}>
                Every outlet
              </button>
              {outlets.map((o) => {
                const on = (d.outletIds ?? []).includes(o.id);
                return (
                  <button key={o.id} type="button" aria-pressed={on} onClick={() => setD({ ...d, outletIds: on ? (d.outletIds ?? []).filter((x) => x !== o.id) : [...(d.outletIds ?? []), o.id] })} className={cn("h-8 rounded-full border px-3 text-[12.5px]", on ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}>
                    {o.name}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Made at">
              <Select value={d.station ?? ""} onChange={(e) => setD({ ...d, station: (e.target.value || null) as KdsStation | null })}>
                <option value="">As the category / outlet</option>
                <option value="KITCHEN">Kitchen</option>
                <option value="BAR">Bar</option>
                <option value="NONE">No ticket (served at the counter)</option>
              </Select>
            </Field>
            <div className="flex flex-col justify-end gap-2">
              <Switch checked={d.vat ?? true} onChange={(v) => setD({ ...d, vat: v })} label="VAT applies" />
              <Switch checked={d.consumptionTax ?? true} onChange={(v) => setD({ ...d, consumptionTax: v })} label="Consumption tax applies" />
            </div>
          </div>

          <div className="rounded-md border border-line">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="text-[13px] font-medium text-ink">Options</span>
              <Button size="sm" variant="ghost" onClick={() => setGroups((g) => [...g, { name: "", required: false, multiple: false, options: [{ name: "", priceKobo: 0 }] }])}>
                <Plus size={13} /> Group
              </Button>
            </div>
            {groups.length === 0 && <p className="px-4 py-3 text-[12.5px] text-ink-muted">Pepper level, protein, extras: groups of choices the till asks for.</p>}
            {groups.map((g, i) => (
              <div key={i} className="border-b border-line px-4 py-3 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Input value={g.name} onChange={(e) => setG(i, { name: e.target.value })} placeholder="Pepper level" className="h-9 min-w-[160px] flex-1" aria-label="Group name" />
                  <label className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                    <input type="checkbox" checked={g.required} onChange={(e) => setG(i, { required: e.target.checked })} className="accent-[var(--laterite)]" /> required
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-muted">
                    <input type="checkbox" checked={g.multiple} onChange={(e) => setG(i, { multiple: e.target.checked })} className="accent-[var(--laterite)]" /> pick several
                  </label>
                  <Button size="icon-sm" variant="ghost" aria-label="Remove group" onClick={() => setGroups((gs) => gs.filter((_, j) => j !== i))}>
                    <X size={13} />
                  </Button>
                </div>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {g.options.map((o, k) => (
                    <li key={k} className="flex items-center gap-2">
                      <Input value={o.name} onChange={(e) => setG(i, { options: g.options.map((x, n) => (n === k ? { ...x, name: e.target.value } : x)) })} placeholder="Hot" className="h-9 flex-1" aria-label="Option" />
                      <NairaInput kobo={o.priceKobo || null} onChange={(v) => setG(i, { options: g.options.map((x, n) => (n === k ? { ...x, priceKobo: v ?? 0 } : x)) })} className="w-32" placeholder="0" aria-label="Extra price" />
                      <Button size="icon-sm" variant="ghost" aria-label="Remove option" onClick={() => setG(i, { options: g.options.filter((_, n) => n !== k) })}>
                        <X size={13} />
                      </Button>
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={() => setG(i, { options: [...g.options, { name: "", priceKobo: 0 }] })} className="mt-1.5 text-[12.5px] font-medium text-laterite hover:underline">
                  + option
                </button>
              </div>
            ))}
          </div>

          <div className="rounded-md border border-line">
            <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
              <span className="text-[13px] font-medium text-ink">Stock it uses</span>
              <Button size="sm" variant="ghost" onClick={() => setLinks((l) => [...l, { stockItemId: stock.data?.[0]?.id ?? "", quantity: 1 }])}>
                <Plus size={13} /> Link
              </Button>
            </div>
            {links.length === 0 && <p className="px-4 py-3 text-[12.5px] text-ink-muted">A Star lager uses one bottle; a shot of Hennessy uses 0.04 of a bottle. Stock counts down as it sells.</p>}
            <ul className="flex flex-col gap-2 p-3">
              {links.map((l, i) => (
                <li key={i} className="flex items-center gap-2">
                  <Select value={l.stockItemId} onChange={(e) => setLinks((ls) => ls.map((x, j) => (j === i ? { ...x, stockItemId: e.target.value } : x)))} aria-label="Stock item">
                    {(stock.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.unit})
                      </option>
                    ))}
                  </Select>
                  <Input inputMode="decimal" value={String(l.quantity)} onChange={(e) => setLinks((ls) => ls.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value.replace(/[^\d.]/g, "") || 0) } : x)))} className="w-24 font-mono" aria-label="Quantity per item sold" />
                  <Button size="icon-sm" variant="ghost" aria-label="Remove link" onClick={() => setLinks((ls) => ls.filter((_, j) => j !== i))}>
                    <X size={13} />
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <ConfirmDialog open={del} onOpenChange={setDel} title={`Remove ${d?.name ?? "this item"}?`} body="It leaves every menu. Past orders keep it." confirmLabel="Remove" danger onConfirm={() => remove.mutateAsync()} />
    </Sheet>
  );
}

/* ---------------- outlets ---------------- */

function Outlets() {
  const qc = useQueryClient();
  const { can } = useCan();
  const manage = can("pos.manage");
  const outlets = useOutlets();
  const [edit, setEdit] = useState<Partial<Outlet> | null>(null);
  const save = useMutation({
    mutationFn: (o: Partial<Outlet>) => {
      const b = { name: o.name, code: o.code, type: o.type, defaultStation: o.defaultStation, serviceChargeApplies: o.serviceChargeApplies, allowRoomCharge: o.allowRoomCharge, allowCityLedger: o.allowCityLedger, active: o.active };
      return o.id ? posApi.updateOutlet(o.id, b) : posApi.createOutlet(b);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pos"] });
      setEdit(null);
      toast.success("Outlet saved");
    },
    meta: { errorTitle: "Outlet not saved" },
  });
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {(outlets.data ?? []).map((o) => (
          <Panel key={o.id} className={cn("flex flex-col p-5", !o.active && "opacity-60")}>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-14 place-items-center rounded-sm border border-line-strong bg-paper font-mono text-[12px] tracking-[0.1em] text-ink">{o.code}</span>
              <div className="min-w-0 flex-1">
                <p className="display-sm truncate text-[18px] leading-tight text-ink">{o.name}</p>
                <p className="text-[12px] text-ink-muted">
                  {OUTLET_LABEL[o.type as OutletType]} &middot; tickets to {STATION_LABEL[o.defaultStation].toLowerCase()}
                </p>
              </div>
              {!o.active && <Badge>Closed</Badge>}
            </div>
            <ul className="mt-4 flex flex-col gap-1 text-[12.5px] text-ink-muted">
              <li>{o.allowRoomCharge ? "Charges to rooms" : "No room charges"}</li>
              <li>{o.allowCityLedger ? "Charges to company accounts" : "No company accounts"}</li>
              <li>{o.serviceChargeApplies ? "Adds the service charge" : "No service charge"}</li>
            </ul>
            <div className="mt-auto flex items-center justify-between pt-4">
              <span className="font-mono text-[12px] text-ink-muted">{o.openOrders} open</span>
              {manage && (
                <Button size="sm" variant="ghost" onClick={() => setEdit(o)}>
                  Edit
                </Button>
              )}
            </div>
          </Panel>
        ))}
        {manage && (
          <button type="button" onClick={() => setEdit({ name: "", code: "", type: "BAR", defaultStation: "BAR", serviceChargeApplies: false, allowRoomCharge: true, allowCityLedger: true, active: true })} className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-line-strong text-[13.5px] text-ink-muted hover:border-ink-faint hover:text-ink">
            <Plus size={20} /> Add an outlet
          </button>
        )}
      </div>
      <Sheet
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        eyebrow="Outlet"
        title={edit?.id ? `Edit ${edit.name}` : "A new outlet"}
        footer={
          <Button className="w-full" loading={save.isPending} disabled={!edit?.name?.trim() || !/^[A-Z]{2,6}$/.test(edit?.code ?? "")} onClick={() => edit && save.mutate(edit)}>
            Save outlet
          </Button>
        }
      >
        {edit && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-[1fr_120px] gap-3">
              <Field label="Name">
                <Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Pool Bar" />
              </Field>
              <Field label="Code" hint="2 to 6 letters">
                <Input value={edit.code ?? ""} onChange={(e) => setEdit({ ...edit, code: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) })} placeholder="POOL" className="font-mono" />
              </Field>
            </div>
            <Field label="Kind">
              <Select value={edit.type} onChange={(e) => { const t = e.target.value as OutletType; setEdit({ ...edit, type: t, defaultStation: t === "BAR" || t === "POOL_BAR" ? "BAR" : t === "RESTAURANT" || t === "ROOM_SERVICE" ? "KITCHEN" : "NONE" }); }}>
                {(Object.keys(OUTLET_LABEL) as OutletType[]).map((t) => (
                  <option key={t} value={t}>
                    {OUTLET_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tickets go to">
              <Select value={edit.defaultStation} onChange={(e) => setEdit({ ...edit, defaultStation: e.target.value as KdsStation })}>
                <option value="KITCHEN">The kitchen display</option>
                <option value="BAR">The bar display</option>
                <option value="NONE">Nowhere (served at the counter)</option>
              </Select>
            </Field>
            <Switch checked={!!edit.allowRoomCharge} onChange={(v) => setEdit({ ...edit, allowRoomCharge: v })} label="Charge to a room" description="In-house guests sign the bill to their folio." />
            <Switch checked={!!edit.allowCityLedger} onChange={(v) => setEdit({ ...edit, allowCityLedger: v })} label="Charge to a company account" />
            <Switch checked={!!edit.serviceChargeApplies} onChange={(v) => setEdit({ ...edit, serviceChargeApplies: v })} label="Service charge" description="When the property's service charge is on." />
            <Switch checked={edit.active ?? true} onChange={(v) => setEdit({ ...edit, active: v })} label="Open" description="Closed outlets disappear from the till." />
          </div>
        )}
      </Sheet>
    </>
  );
}

/* ---------------- happy hours ---------------- */

const hm = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));

function HappyHours() {
  const qc = useQueryClient();
  const { can } = useCan();
  const manage = can("pos.manage");
  const rules = usePriceRules();
  const outlets = useOutlets();
  const cats = useMenuCategories();
  const [edit, setEdit] = useState<Partial<PriceRule> | null>(null);
  const save = useMutation({
    mutationFn: (r: Partial<PriceRule>) => {
      const b = { name: r.name ?? "", active: r.active ?? true, outletIds: r.outletIds ?? [], categoryIds: r.categoryIds ?? [], itemIds: r.itemIds ?? [], daysOfWeek: r.daysOfWeek ?? [], startTime: r.startTime ?? "17:00", endTime: r.endTime ?? "19:00", adjustmentType: r.adjustmentType ?? "PERCENT", value: r.value ?? 2000 };
      return r.id ? posApi.updatePriceRule(r.id, b) : posApi.createPriceRule(b);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["pos"] });
      setEdit(null);
      toast.success("Happy hour saved", "Tills show the price during the window.");
    },
    meta: { errorTitle: "Not saved" },
  });
  const del = useMutation({ mutationFn: (id: string) => posApi.deletePriceRule(id), onSuccess: () => void qc.invalidateQueries({ queryKey: qk5.priceRules }), meta: { errorTitle: "Not removed" } });
  const describe = (r: PriceRule) => (r.adjustmentType === "PERCENT" ? `${r.value / 100}% off` : r.adjustmentType === "AMOUNT" ? `${naira(r.value)} off` : `${naira(r.value)} flat`);
  return (
    <>
      <Panel className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <p className="text-[13px] text-ink-muted">Where rules overlap, the lowest price wins.</p>
          {manage && (
            <Button size="sm" onClick={() => setEdit({ name: "Happy hour", startTime: "17:00", endTime: "19:00", adjustmentType: "PERCENT", value: 2000, daysOfWeek: [], outletIds: [], categoryIds: [], itemIds: [], active: true })}>
              <Plus size={13} weight="bold" /> Rule
            </Button>
          )}
        </div>
        <ul className="divide-y divide-line">
          {(rules.data ?? []).map((r) => {
            const s = hm(r.startTime);
            const e = hm(r.endTime);
            const spans = e > s ? [[s, e]] : [[s, 1440], [0, e]];
            return (
              <li key={r.id} className={cn("grid gap-3 px-5 py-4 md:grid-cols-[1fr_1.4fr_auto] md:items-center", !r.active && "opacity-55")}>
                <div>
                  <p className="text-[14px] font-medium text-ink">{r.name}</p>
                  <p className="text-[12.5px] text-ink-muted">
                    {describe(r)} &middot; {r.daysOfWeek.length ? r.daysOfWeek.map((x) => DOW[x]).join(", ") : "every day"} &middot; {r.outletIds.length ? r.outletIds.map((id) => outlets.data?.find((o) => o.id === id)?.name).filter(Boolean).join(", ") : "every outlet"}
                    {r.categoryIds.length ? ` · ${r.categoryIds.map((id) => cats.data?.find((c) => c.id === id)?.name).filter(Boolean).join(", ")}` : ""}
                  </p>
                </div>
                <div>
                  <div className="relative h-6 rounded-sm border border-line bg-paper" aria-label={`${r.startTime} to ${r.endTime}`}>
                    {[6, 12, 18].map((h) => (
                      <span key={h} className="absolute inset-y-0 w-px bg-line" style={{ left: `${(h / 24) * 100}%` }} aria-hidden />
                    ))}
                    {spans.map(([a, b], i) => (
                      <span key={i} className="absolute inset-y-[3px] rounded-[2px] bg-brass/80" style={{ left: `${(a / 1440) * 100}%`, width: `${((b - a) / 1440) * 100}%` }} />
                    ))}
                  </div>
                  <p className="mt-1 flex justify-between font-mono text-[10px] text-ink-faint">
                    <span>00</span>
                    <span>06</span>
                    <span>12</span>
                    <span>18</span>
                    <span>24</span>
                  </p>
                </div>
                {manage && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEdit(r)}>
                      Edit
                    </Button>
                    <Button size="icon-sm" variant="ghost" aria-label={`Remove ${r.name}`} onClick={() => del.mutate(r.id)}>
                      <Trash size={14} />
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
          {rules.data && !rules.data.length && <li className="px-5 py-8 text-center text-[13px] text-ink-muted">No happy hours. Add one for the bar&rsquo;s quiet early evening.</li>}
        </ul>
      </Panel>
      <Sheet
        open={!!edit}
        onOpenChange={(o) => !o && setEdit(null)}
        eyebrow="Happy hour"
        title={edit?.id ? `Edit ${edit.name}` : "A new rule"}
        footer={
          <Button className="w-full" onClick={() => edit && save.mutate(edit)} loading={save.isPending} disabled={!edit?.name?.trim()}>
            Save rule
          </Button>
        }
      >
        {edit && (
          <div className="flex flex-col gap-4">
            <Field label="Name">
              <Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From">
                <Input type="time" value={edit.startTime ?? "17:00"} onChange={(e) => setEdit({ ...edit, startTime: e.target.value })} />
              </Field>
              <Field label="Until">
                <Input type="time" value={edit.endTime ?? "19:00"} onChange={(e) => setEdit({ ...edit, endTime: e.target.value })} />
              </Field>
            </div>
            <div className="grid grid-cols-[1fr_1fr] gap-3">
              <Field label="Price change">
                <Select value={edit.adjustmentType} onChange={(e) => setEdit({ ...edit, adjustmentType: e.target.value as PriceRule["adjustmentType"] })}>
                  <option value="PERCENT">Percent off</option>
                  <option value="AMOUNT">Naira off</option>
                  <option value="FIXED">A fixed price</option>
                </Select>
              </Field>
              <Field label={edit.adjustmentType === "PERCENT" ? "Percent" : "Naira"}>
                {edit.adjustmentType === "PERCENT" ? (
                  <Input inputMode="numeric" value={(edit.value ?? 0) / 100} onChange={(e) => setEdit({ ...edit, value: Number(e.target.value.replace(/\D/g, "") || 0) * 100 })} />
                ) : (
                  <NairaInput kobo={edit.value ?? null} onChange={(v) => setEdit({ ...edit, value: v ?? 0 })} />
                )}
              </Field>
            </div>
            <Chips label="Days" all="Every day" options={DOW.map((dname, i) => ({ id: String(i), name: dname }))} value={(edit.daysOfWeek ?? []).map(String)} onChange={(v) => setEdit({ ...edit, daysOfWeek: v.map(Number) })} />
            <Chips label="Outlets" all="Every outlet" options={(outlets.data ?? []).map((o) => ({ id: o.id, name: o.name }))} value={edit.outletIds ?? []} onChange={(v) => setEdit({ ...edit, outletIds: v })} />
            <Chips label="Categories" all="Everything" options={(cats.data ?? []).map((c) => ({ id: c.id, name: c.name }))} value={edit.categoryIds ?? []} onChange={(v) => setEdit({ ...edit, categoryIds: v })} />
            <Switch checked={edit.active ?? true} onChange={(v) => setEdit({ ...edit, active: v })} label="On" />
          </div>
        )}
      </Sheet>
    </>
  );
}

function Chips({ label, all, options, value, onChange }: { label: string; all: string; options: { id: string; name: string }[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <p className="mb-2 text-[13px] font-medium text-ink">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        <button type="button" aria-pressed={!value.length} onClick={() => onChange([])} className={cn("h-8 rounded-full border px-3 text-[12.5px]", !value.length ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}>
          {all}
        </button>
        {options.map((o) => {
          const on = value.includes(o.id);
          return (
            <button key={o.id} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o.id) : [...value, o.id])} className={cn("h-8 rounded-full border px-3 text-[12.5px]", on ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}>
              {o.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
