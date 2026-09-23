"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardText, Minus, Package, Plus, Truck, Warning, Wine, X } from "@phosphor-icons/react";
import { useCan } from "@/lib/permissions";
import { useRooms, useRoomTypes } from "@/lib/api/hooks";
import { stockApi } from "@/lib/api/endpoints-m5";
import { qk5, useMinibarPar, useStockCounts, useStockItems, useStockMovements, useStockVariance } from "@/lib/api/hooks-m5";
import type { MinibarPar, StockItem, StockMovementType } from "@/lib/api/types-m5";
import { addDays, todayKey } from "@/lib/dates";
import { formatDateTime, naira, number } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/overlay";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge, EmptyState, PageHeader, Panel, PanelHeader, Segmented, Skeleton } from "@/components/ui/primitives";
import { NairaInput } from "@/components/m2/bits";

type Tab = "stock" | "counts" | "moves" | "minibar";
const plural = (unit: string, n = 2) => (n === 1 || unit === "kg" ? unit : /(ch|sh|s|x)$/.test(unit) ? `${unit}es` : `${unit}s`);
const qty = (n: number) => (Number.isInteger(n) ? number(n) : n.toFixed(2).replace(/0$/, ""));
const MOVE_LABEL: Record<StockMovementType, string> = { PURCHASE: "Delivery", SALE: "Sold", VOID_RETURN: "Void, back to stock", WASTE: "Waste", ADJUSTMENT: "Adjustment", COUNT: "Count", MINIBAR: "Minibar" };

export function StockAdmin() {
  const sp = useSearchParams();
  const router = useRouter();
  const { can } = useCan();
  const onlyMinibar = !can("stock.view") && can("minibar.record");
  const tab = onlyMinibar ? "minibar" : ((sp.get("tab") as Tab) ?? "stock");
  const setTab = (t: Tab) => router.replace(t === "stock" ? "/pos/stock" : `/pos/stock?tab=${t}`, { scroll: false });
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Package size={14} weight="duotone" /> Stock & minibar
          </>
        }
        title={
          <>
            Every bottle, <em>accounted for</em>.
          </>
        }
        description="Stock counts down as the tills sell, goes up with each delivery, and is checked against a count. Minibars have a par level per room type, and what a guest takes goes straight to their folio."
      />
      {!onlyMinibar && (
        <Segmented
          label="Stock sections"
          value={tab}
          onChange={setTab}
          className="mb-6"
          options={[
            { value: "stock", label: "Stock" },
            { value: "counts", label: "Counts & variance" },
            { value: "moves", label: "Movements" },
            { value: "minibar", label: "Minibar" },
          ]}
        />
      )}
      {tab === "counts" ? <Counts /> : tab === "moves" ? <Moves /> : tab === "minibar" ? <Minibar /> : <Stock />}
    </>
  );
}

/* ---------------- stock ---------------- */

function Stock() {
  const { can } = useCan();
  const manage = can("stock.manage");
  const [low, setLow] = useState(false);
  const items = useStockItems({ lowStock: low || undefined });
  const [buy, setBuy] = useState(false);
  const [count, setCount] = useState(false);
  const [adj, setAdj] = useState<StockItem | null>(null);
  const [add, setAdd] = useState(false);
  const list = items.data ?? [];
  const value = list.reduce((s, i) => s + i.valueKobo, 0);
  const lowN = list.filter((i) => i.lowStock).length;
  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 sm:px-5">
        <button type="button" aria-pressed={low} onClick={() => setLow((v) => !v)} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[12.5px] font-medium", low ? "border-ochre bg-ochre-wash text-ochre" : "border-line-strong text-ink-muted")}>
          <Warning size={13} /> Running low {lowN ? `· ${lowN}` : ""}
        </button>
        <span className="text-[12.5px] text-ink-muted">
          On hand: <span className="font-mono text-ink">{naira(value)}</span> at cost
        </span>
        {manage && (
          <div className="ml-auto flex flex-wrap gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => setAdd(true)}>
              <Plus size={13} /> Stock item
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setCount(true)}>
              <ClipboardText size={14} /> Count
            </Button>
            <Button size="sm" onClick={() => setBuy(true)}>
              <Truck size={14} /> Record a delivery
            </Button>
          </div>
        )}
      </div>
      {items.isLoading ? (
        <Skeleton className="m-5 h-60" />
      ) : !list.length ? (
        <EmptyState glyph="dots" title={low ? "Nothing running low" : "No stock items"} body={low ? undefined : "Add the bottles and ingredients you count, then link them to menu items."} />
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left">
                {["Item", "On hand", "", "Unit cost", "Value", ""].map((h, i) => (
                  <th key={i} className={cn("eyebrow px-4 py-2.5 text-[10px] font-normal", (i === 3 || i === 4) && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((s) => {
                const par = s.parLevel ?? Math.max(s.reorderLevel * 2, s.onHand, 1);
                return (
                  <tr key={s.id} className="border-b border-line last:border-b-0">
                    <td className="px-4 py-2.5">
                      <span className="block font-medium text-ink">{s.name}</span>
                      <span className="text-[11.5px] text-ink-muted">
                        {s.category}
                        {s.sku ? ` · ${s.sku}` : ""}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <span className={cn("font-mono text-[14px]", s.lowStock ? "text-ochre" : "text-ink")}>{qty(s.onHand)}</span> <span className="text-ink-muted">{plural(s.unit, s.onHand)}</span>
                      {s.lowStock && (
                        <Badge tone="ochre" className="ml-2">
                          low
                        </Badge>
                      )}
                    </td>
                    <td className="w-[200px] px-4 py-2.5">
                      <span className="relative block h-2 rounded-full bg-line" aria-label={`${qty(s.onHand)} of par ${qty(par)}, reorder at ${qty(s.reorderLevel)}`}>
                        <span className={cn("absolute inset-y-0 left-0 rounded-full", s.lowStock ? "bg-ochre" : "bg-palm")} style={{ width: `${Math.min(100, (s.onHand / par) * 100)}%` }} />
                        <span className="absolute inset-y-[-3px] w-[2px] bg-ink-muted" style={{ left: `${Math.min(100, (s.reorderLevel / par) * 100)}%` }} title="reorder level" />
                      </span>
                      <span className="mt-1 flex justify-between font-mono text-[10px] text-ink-faint">
                        <span>reorder {qty(s.reorderLevel)}</span>
                        <span>par {qty(par)}</span>
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-ink-muted">{naira(s.unitCostKobo)}</td>
                    <td className="px-4 py-2.5 text-right font-mono text-ink">{naira(s.valueKobo)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {manage && (
                        <Button size="sm" variant="ghost" onClick={() => setAdj(s)}>
                          Waste or adjust
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <PurchaseSheet open={buy} onOpenChange={setBuy} items={items.data ?? []} />
      <CountSheet open={count} onOpenChange={setCount} />
      <AdjustDialog item={adj} onClose={() => setAdj(null)} />
      <NewStockItem open={add} onOpenChange={setAdd} />
    </Panel>
  );
}

function PurchaseSheet({ open, onOpenChange, items }: { open: boolean; onOpenChange: (o: boolean) => void; items: StockItem[] }) {
  const qc = useQueryClient();
  const [supplier, setSupplier] = useState("");
  const [ref, setRef] = useState("");
  const [lines, setLines] = useState<{ stockItemId: string; quantity: string; unitCostKobo: number | null }[]>([]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- start each delivery with one line
    if (open) setLines([{ stockItemId: items[0]?.id ?? "", quantity: "", unitCostKobo: items[0]?.unitCostKobo ?? null }]);
  }, [open, items]);
  const total = lines.reduce((s, l) => s + Number(l.quantity || 0) * (l.unitCostKobo ?? 0), 0);
  const save = useMutation({
    mutationFn: () => stockApi.purchase({ supplier: supplier || undefined, reference: ref || undefined, lines: lines.filter((l) => l.stockItemId && Number(l.quantity) > 0).map((l) => ({ stockItemId: l.stockItemId, quantity: Number(l.quantity), unitCostKobo: l.unitCostKobo ?? 0 })) }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["stock"] });
      toast.success("Delivery recorded", `${r.movements.length} ${r.movements.length === 1 ? "item" : "items"} added to stock.`);
      onOpenChange(false);
      setSupplier("");
      setRef("");
    },
    meta: { errorTitle: "Not recorded" },
  });
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Stock in"
      title="Record a delivery"
      width="max-w-xl"
      footer={
        <>
          <span className="self-center font-mono text-[14px] text-ink">{naira(total)}</span>
          <Button className="ml-auto" onClick={() => save.mutate()} loading={save.isPending} disabled={!lines.some((l) => Number(l.quantity) > 0)}>
            Add to stock
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field label="Supplier" optional>
          <Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Nigerian Breweries depot" />
        </Field>
        <Field label="Invoice or waybill" optional>
          <Input value={ref} onChange={(e) => setRef(e.target.value)} className="font-mono" />
        </Field>
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {lines.map((l, i) => (
          <li key={i} className="grid grid-cols-[1fr_80px_130px_auto] items-center gap-2">
            <Select value={l.stockItemId} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, stockItemId: e.target.value, unitCostKobo: items.find((s) => s.id === e.target.value)?.unitCostKobo ?? x.unitCostKobo } : x)))} aria-label="Item">
              {items.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <Input inputMode="decimal" value={l.quantity} onChange={(e) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, quantity: e.target.value.replace(/[^\d.]/g, "") } : x)))} placeholder="qty" className="font-mono" aria-label="Quantity" />
            <NairaInput kobo={l.unitCostKobo} onChange={(v) => setLines((ls) => ls.map((x, j) => (j === i ? { ...x, unitCostKobo: v } : x)))} aria-label="Unit cost" />
            <Button size="icon-sm" variant="ghost" aria-label="Remove line" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}>
              <X size={13} />
            </Button>
          </li>
        ))}
      </ul>
      <Button size="sm" variant="ghost" className="mt-2" onClick={() => setLines((ls) => [...ls, { stockItemId: items[0]?.id ?? "", quantity: "", unitCostKobo: items[0]?.unitCostKobo ?? null }])}>
        <Plus size={13} /> Another item
      </Button>
      <p className="mt-3 text-[12px] text-ink-muted">Unit costs feed the average cost used for stock value and variance.</p>
    </Sheet>
  );
}

function CountSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const items = useStockItems({}, open);
  const [counted, setCounted] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a fresh count each time
    if (open) setCounted({});
  }, [open]);
  const rows = (items.data ?? []).map((s) => {
    const c = counted[s.id];
    const v = c === undefined || c === "" ? null : Number(c) - s.onHand;
    return { s, v, value: v === null ? 0 : Math.round(v * s.unitCostKobo) };
  });
  const shortage = rows.reduce((a, r) => a + Math.min(0, r.value), 0);
  const save = useMutation({
    mutationFn: () => stockApi.count({ note: note || undefined, lines: rows.filter((r) => r.v !== null).map((r) => ({ stockItemId: r.s.id, counted: Number(counted[r.s.id]) })) }),
    onSuccess: (c) => {
      void qc.invalidateQueries({ queryKey: ["stock"] });
      toast[c.flagged ? "warning" : "success"](c.flagged ? "Count saved, with a variance flag" : "Count saved", c.flagged ? `Short by ${naira(Math.abs(c.varianceValueKobo))}: Revenue Guard has it.` : "Stock now matches the count.");
      onOpenChange(false);
    },
    meta: { errorTitle: "Count not saved" },
  });
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Stock count"
      title="Count what is on the shelf"
      description="Type what you count; the difference shows as you go. Items you leave blank are not counted."
      width="max-w-2xl"
      footer={
        <>
          <span className={cn("self-center font-mono text-[14px]", shortage < 0 ? "text-danger" : "text-ink-muted")}>{shortage < 0 ? `short ${naira(-shortage)}` : "no shortage"}</span>
          <Button className="ml-auto" onClick={() => save.mutate()} loading={save.isPending} disabled={!rows.some((r) => r.v !== null)}>
            Save the count
          </Button>
        </>
      }
    >
      <table className="w-full text-[13px]">
        <thead>
          <tr className="border-b border-line text-left">
            <th className="eyebrow py-2 text-[10px] font-normal">Item</th>
            <th className="eyebrow py-2 text-right text-[10px] font-normal">Expected</th>
            <th className="eyebrow py-2 pl-3 text-[10px] font-normal">Counted</th>
            <th className="eyebrow py-2 text-right text-[10px] font-normal">Difference</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ s, v, value }) => (
            <tr key={s.id} className="border-b border-dashed border-line last:border-b-0">
              <td className="py-2 text-ink">
                {s.name} <span className="text-[11.5px] text-ink-muted">({plural(s.unit)})</span>
              </td>
              <td className="py-2 text-right font-mono text-ink-muted">{qty(s.onHand)}</td>
              <td className="py-2 pl-3">
                <Input inputMode="decimal" value={counted[s.id] ?? ""} onChange={(e) => setCounted((c) => ({ ...c, [s.id]: e.target.value.replace(/[^\d.]/g, "") }))} className="h-9 w-24 font-mono" aria-label={`Counted ${s.name}`} />
              </td>
              <td className={cn("py-2 text-right font-mono", v === null ? "text-ink-faint" : v < 0 ? "text-danger" : v > 0 ? "text-palm" : "text-ink-muted")}>
                {v === null ? "-" : `${v > 0 ? "+" : ""}${qty(v)}`}
                {v ? <span className="block text-[11px]">{naira(Math.abs(value))}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <Field label="Note" optional className="mt-4">
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Sunday bar count" />
      </Field>
    </Sheet>
  );
}

function AdjustDialog({ item, onClose }: { item: StockItem | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [type, setType] = useState<"WASTE" | "ADJUSTMENT">("WASTE");
  const [sign, setSign] = useState<1 | -1>(-1);
  const [n, setN] = useState("");
  const [note, setNote] = useState("");
  const q = Number(n || 0) * (type === "WASTE" ? -1 : sign);
  const save = useMutation({
    mutationFn: () => stockApi.adjust({ stockItemId: item!.id, quantity: q, type, note }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["stock"] });
      toast.success("Recorded");
      onClose();
      setN("");
      setNote("");
    },
    meta: { errorTitle: "Not recorded" },
  });
  return (
    <Dialog
      open={!!item}
      onOpenChange={(o) => !o && onClose()}
      title={item ? `${item.name}` : ""}
      description={item ? `${qty(item.onHand)} ${plural(item.unit, item.onHand)} on hand.` : undefined}
      footer={
        <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!q || !note.trim()}>
          {type === "WASTE" ? "Record waste" : "Adjust"}
        </Button>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="inline-flex self-start rounded-md border border-line-strong p-0.5" role="radiogroup" aria-label="Kind">
          {(["WASTE", "ADJUSTMENT"] as const).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={type === t} onClick={() => setType(t)} className={cn("h-9 rounded-sm px-3 text-[13px] font-medium", type === t ? "bg-ink text-paper" : "text-ink-muted")}>
              {t === "WASTE" ? "Waste or breakage" : "Correction"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {type === "ADJUSTMENT" && (
            <div className="inline-flex rounded-md border border-line-strong p-0.5">
              {([1, -1] as const).map((s) => (
                <button key={s} type="button" aria-pressed={sign === s} onClick={() => setSign(s)} className={cn("grid h-9 w-9 place-items-center rounded-sm", sign === s ? "bg-ink text-paper" : "text-ink-muted")} aria-label={s === 1 ? "Add" : "Remove"}>
                  {s === 1 ? <Plus size={13} weight="bold" /> : <Minus size={13} weight="bold" />}
                </button>
              ))}
            </div>
          )}
          <Input inputMode="decimal" value={n} onChange={(e) => setN(e.target.value.replace(/[^\d.]/g, ""))} placeholder="1" className="w-28 font-mono" aria-label="Quantity" />
          <span className="text-[13px] text-ink-muted">{item ? plural(item.unit) : ""}</span>
        </div>
        <Field label="What happened">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === "WASTE" ? "Two bottles broke in the chiller" : "Miscounted at delivery"} />
        </Field>
      </div>
    </Dialog>
  );
}

function NewStockItem({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", unit: "bottle", category: "Beer", reorder: "12", par: "48", cost: null as number | null, opening: "" });
  const save = useMutation({
    mutationFn: () => stockApi.createItem({ name: f.name.trim(), unit: f.unit, category: f.category, reorderLevel: Number(f.reorder || 0), parLevel: f.par ? Number(f.par) : null, unitCostKobo: f.cost ?? 0, openingQuantity: Number(f.opening || 0) }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["stock"] });
      onOpenChange(false);
      toast.success("Stock item added", "Link it to menu items so sales count it down.");
    },
    meta: { errorTitle: "Not added" },
  });
  return (
    <Sheet open={open} onOpenChange={onOpenChange} eyebrow="Stock" title="A new stock item" footer={<Button className="w-full" onClick={() => save.mutate()} loading={save.isPending} disabled={!f.name.trim()}>Add item</Button>}>
      <div className="flex flex-col gap-4">
        <Field label="Name">
          <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Trophy lager 60cl" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Counted in">
            <Select value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })}>
              {["bottle", "can", "carton", "crate", "kg", "litre", "portion", "pack", "piece", "bunch"].map((u) => (
                <option key={u}>{u}</option>
              ))}
            </Select>
          </Field>
          <Field label="Category">
            <Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} />
          </Field>
          <Field label="Reorder at">
            <Input inputMode="decimal" value={f.reorder} onChange={(e) => setF({ ...f, reorder: e.target.value.replace(/[^\d.]/g, "") })} />
          </Field>
          <Field label="Par level" optional>
            <Input inputMode="decimal" value={f.par} onChange={(e) => setF({ ...f, par: e.target.value.replace(/[^\d.]/g, "") })} />
          </Field>
          <Field label="Unit cost">
            <NairaInput kobo={f.cost} onChange={(v) => setF({ ...f, cost: v })} />
          </Field>
          <Field label="On hand now">
            <Input inputMode="decimal" value={f.opening} onChange={(e) => setF({ ...f, opening: e.target.value.replace(/[^\d.]/g, "") })} placeholder="0" />
          </Field>
        </div>
      </div>
    </Sheet>
  );
}

/* ---------------- counts & variance ---------------- */

function Counts() {
  const counts = useStockCounts();
  const today = todayKey();
  const v = useStockVariance(addDays(today, -30), today);
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-5">
      <Panel className="overflow-hidden">
        <PanelHeader eyebrow="Counts" title="What the shelf said" />
        <ul className="divide-y divide-line">
          {(counts.data?.items ?? []).map((c) => (
            <li key={c.id}>
              <button type="button" onClick={() => setOpen(open === c.id ? null : c.id)} aria-expanded={open === c.id} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-2/40">
                <span className="w-40 font-mono text-[12px] text-ink-muted">{formatDateTime(c.countedAt)}</span>
                <span className="min-w-0 flex-1 truncate text-[13.5px] text-ink">
                  {c.note || "Count"} <span className="text-ink-muted">by {c.countedBy?.fullName ?? "staff"}</span>
                </span>
                {c.flagged && <Badge tone="danger">Flagged</Badge>}
                <span className={cn("w-28 text-right font-mono text-[13px]", c.varianceValueKobo < 0 ? "text-danger" : "text-ink-muted")}>{c.varianceValueKobo < 0 ? `−${naira(-c.varianceValueKobo)}` : naira(c.varianceValueKobo)}</span>
              </button>
              {open === c.id && (
                <table className="mb-3 ml-5 w-[calc(100%-40px)] text-[12.5px]">
                  <tbody>
                    {c.lines.map((l) => (
                      <tr key={l.stockItemId} className="border-t border-dashed border-line">
                        <td className="py-1.5 text-ink">{l.name}</td>
                        <td className="py-1.5 text-right font-mono text-ink-muted">
                          {qty(l.expected)} expected, {qty(l.counted)} counted
                        </td>
                        <td className={cn("w-28 py-1.5 text-right font-mono", l.variance < 0 ? "text-danger" : "text-ink-muted")}>
                          {l.variance > 0 ? "+" : ""}
                          {qty(l.variance)} {l.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </li>
          ))}
          {counts.data && !counts.data.items.length && <li className="px-5 py-6 text-center text-[13px] text-ink-muted">No counts yet.</li>}
        </ul>
      </Panel>
      <Panel className="overflow-hidden">
        <PanelHeader eyebrow="Last 30 days" title="Where the stock went" description="Opening + deliveries − sold − minibar − waste ± adjustments should equal the closing count. The gap is the variance." />
        {!v.data ? (
          <Skeleton className="m-5 h-48" />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[820px] text-[12.5px]">
              <thead>
                <tr className="border-b border-line text-right">
                  {["Item", "Opening", "In", "Sold", "Minibar", "Waste", "Adjusted", "Count gap", "Closing", "Variance"].map((h, i) => (
                    <th key={h} className={cn("eyebrow px-3 py-2.5 text-[10px] font-normal", i === 0 && "text-left")}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {v.data.items.map((i) => (
                  <tr key={i.stockItemId} className="border-b border-line text-right font-mono last:border-b-0">
                    <td className="px-3 py-2 text-left font-sans text-ink">{i.name}</td>
                    <td className="px-3 py-2 text-ink-muted">{qty(i.opening)}</td>
                    <td className="px-3 py-2 text-palm">+{qty(i.purchased)}</td>
                    <td className="px-3 py-2 text-ink">−{qty(i.sold)}</td>
                    <td className="px-3 py-2 text-ink-muted">{i.minibar ? `−${qty(i.minibar)}` : "-"}</td>
                    <td className="px-3 py-2 text-ink-muted">{i.wasted ? `−${qty(i.wasted)}` : "-"}</td>
                    <td className="px-3 py-2 text-ink-muted">{i.adjusted ? qty(i.adjusted) : "-"}</td>
                    <td className={cn("px-3 py-2", i.countVariance < 0 ? "text-danger" : "text-ink-muted")}>{i.countVariance ? qty(i.countVariance) : "-"}</td>
                    <td className="px-3 py-2 text-ink">{qty(i.closing)}</td>
                    <td className={cn("px-3 py-2", i.varianceValueKobo < 0 ? "text-danger" : "text-ink-muted")}>{i.varianceValueKobo ? naira(i.varianceValueKobo) : "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function Moves() {
  const [page, setPage] = useState(1);
  const q = useStockMovements({ page });
  const items = q.data?.items ?? [];
  return (
    <Panel className="overflow-hidden">
      <ul className="divide-y divide-line">
        {items.map((m) => (
          <li key={m.id} className="grid grid-cols-[1fr_auto] gap-2 px-5 py-2.5 text-[13px] sm:grid-cols-[150px_1fr_140px_auto]">
            <span className="font-mono text-[12px] text-ink-muted">{formatDateTime(m.createdAt)}</span>
            <span className="text-ink">
              {m.stockItemName}
              <span className="block text-[11.5px] text-ink-muted sm:inline sm:pl-2">
                {MOVE_LABEL[m.type]}
                {m.note ? `: ${m.note}` : ""}
                {m.reference ? ` · ${m.reference}` : ""}
              </span>
            </span>
            <span className="hidden text-[12px] text-ink-muted sm:block">{m.createdBy?.fullName ?? ""}</span>
            <span className={cn("text-right font-mono", m.quantity < 0 ? "text-ink" : "text-palm")}>
              {m.quantity > 0 ? "+" : ""}
              {qty(m.quantity)}
            </span>
          </li>
        ))}
        {q.data && !items.length && <li className="px-5 py-8 text-center text-[13px] text-ink-muted">No movements yet.</li>}
      </ul>
      {(q.data?.total ?? 0) > items.length * page && (
        <div className="flex justify-end border-t border-line px-4 py-2">
          <Button size="sm" variant="ghost" onClick={() => setPage((p) => p + 1)}>
            Older
          </Button>
        </div>
      )}
    </Panel>
  );
}

/* ---------------- minibar ---------------- */

function Minibar() {
  const { can } = useCan();
  const par = useMinibarPar(can("stock.view") || can("minibar.record"));
  const types = useRoomTypes();
  const [rec, setRec] = useState(false);
  return (
    <div className="flex flex-col gap-5">
      <Panel className="flex flex-wrap items-center gap-4 p-5">
        <Wine size={24} weight="duotone" className="text-brass" />
        <p className="min-w-0 flex-1 text-[13.5px] text-ink">
          Housekeeping checks the minibar when they clean. What was taken is charged to the guest&rsquo;s folio at once; with nobody in the room it waits for the desk.
        </p>
        {can("minibar.record") && (
          <Button onClick={() => setRec(true)} data-testid="record-minibar">
            Record what was taken
          </Button>
        )}
      </Panel>
      <Panel className="overflow-hidden">
        <PanelHeader eyebrow="Par levels" title="What each room type starts with" />
        {!par.data ? <Skeleton className="m-5 h-40" /> : <ParGrid par={par.data} typeName={(id) => types.data?.find((t) => t.id === id)?.name ?? "Room type"} canEdit={can("stock.manage")} />}
      </Panel>
      <ConsumptionDialog open={rec} onOpenChange={setRec} />
    </div>
  );
}

function ParGrid({ par, typeName, canEdit }: { par: MinibarPar[]; typeName: (id: string) => string; canEdit: boolean }) {
  const qc = useQueryClient();
  const items = useMemo(() => {
    const m = new Map<string, { itemId: string; name: string; priceKobo: number }>();
    for (const p of par) for (const i of p.items) m.set(i.itemId, i);
    return [...m.values()];
  }, [par]);
  const [draft, setDraft] = useState<Record<string, Record<string, number>>>({});
  const val = (typeId: string, itemId: string) => draft[typeId]?.[itemId] ?? par.find((p) => p.roomTypeId === typeId)?.items.find((i) => i.itemId === itemId)?.parQty ?? 0;
  const save = useMutation({
    mutationFn: (typeId: string) => stockApi.savePar({ roomTypeId: typeId, items: items.map((i) => ({ itemId: i.itemId, parQty: val(typeId, i.itemId) })) }),
    onSuccess: (_r, typeId) => {
      setDraft((d) => {
        const n = { ...d };
        delete n[typeId];
        return n;
      });
      void qc.invalidateQueries({ queryKey: qk5.par });
      toast.success(`${typeName(typeId)} par levels saved`);
    },
    meta: { errorTitle: "Not saved" },
  });
  return (
    <div className="scrollbar-thin overflow-x-auto">
      <table className="w-full min-w-[560px] text-[13px]">
        <thead>
          <tr className="border-b border-line">
            <th className="eyebrow px-5 py-2.5 text-left text-[10px] font-normal">Item</th>
            {par.map((p) => (
              <th key={p.roomTypeId} className="px-3 py-2.5 text-center text-[12.5px] font-medium text-ink">
                {typeName(p.roomTypeId)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((i) => (
            <tr key={i.itemId} className="border-b border-line last:border-b-0">
              <td className="px-5 py-2">
                <span className="text-ink">{i.name}</span> <span className="font-mono text-[11.5px] text-ink-muted">{naira(i.priceKobo)}</span>
              </td>
              {par.map((p) => (
                <td key={p.roomTypeId} className="px-3 py-2 text-center">
                  <span className="inline-flex h-8 items-stretch overflow-hidden rounded-sm border border-line-strong">
                    <button type="button" disabled={!canEdit} aria-label={`Fewer ${i.name} in ${typeName(p.roomTypeId)}`} className="w-7 text-ink-muted hover:bg-surface-2 disabled:opacity-40" onClick={() => setDraft((d) => ({ ...d, [p.roomTypeId]: { ...(d[p.roomTypeId] ?? {}), [i.itemId]: Math.max(0, val(p.roomTypeId, i.itemId) - 1) } }))}>
                      −
                    </button>
                    <span className="grid w-8 place-items-center border-x border-line font-mono">{val(p.roomTypeId, i.itemId)}</span>
                    <button type="button" disabled={!canEdit} aria-label={`More ${i.name} in ${typeName(p.roomTypeId)}`} className="w-7 text-ink-muted hover:bg-surface-2 disabled:opacity-40" onClick={() => setDraft((d) => ({ ...d, [p.roomTypeId]: { ...(d[p.roomTypeId] ?? {}), [i.itemId]: val(p.roomTypeId, i.itemId) + 1 } }))}>
                      +
                    </button>
                  </span>
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td />
            {par.map((p) => (
              <td key={p.roomTypeId} className="px-3 py-2 text-center">
                {draft[p.roomTypeId] && (
                  <Button size="sm" onClick={() => save.mutate(p.roomTypeId)} loading={save.isPending && save.variables === p.roomTypeId}>
                    Save
                  </Button>
                )}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ConsumptionDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const rooms = useRooms({});
  const [roomId, setRoomId] = useState("");
  const [taken, setTaken] = useState<Record<string, number>>({});
  const room = useQuery({ queryKey: ["minibar", "room", roomId], queryFn: () => stockApi.minibarRoom(roomId), enabled: open && !!roomId });
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new room starts at zero
    setTaken({});
  }, [roomId]);
  const total = (room.data?.items ?? []).reduce((s, i) => s + (taken[i.itemId] ?? 0) * i.priceKobo, 0);
  const save = useMutation({
    mutationFn: () => stockApi.consume({ roomId, items: Object.entries(taken).filter(([, q]) => q > 0).map(([itemId, quantity]) => ({ itemId, quantity })) }),
    onSuccess: (r) => {
      void qc.invalidateQueries({ queryKey: ["stock"] });
      void qc.invalidateQueries({ queryKey: ["folio"] });
      toast.success(r.charged ? `Charged ${naira(r.order.totals.totalKobo)} to the room` : "Recorded for the desk", r.charged ? `On ${room.data?.stay?.guestName ?? "the guest"}'s folio.` : "Nobody is in the room: the desk will settle it.");
      onOpenChange(false);
      setRoomId("");
    },
    meta: { errorTitle: "Not recorded" },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="What was taken from the minibar"
      footer={
        <>
          <span className="mr-auto self-center font-mono text-[14px] text-ink">{naira(total)}</span>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!roomId || !total}>
            {room.data?.stay ? "Charge to the room" : "Record it"}
          </Button>
        </>
      }
    >
      <Field label="Room">
        <Select value={roomId} onChange={(e) => setRoomId(e.target.value)}>
          <option value="">Choose the room</option>
          {(rooms.data ?? []).map((r) => (
            <option key={r.id} value={r.id}>
              {r.number} &middot; {r.roomType.name}
            </option>
          ))}
        </Select>
      </Field>
      {room.data && (
        <>
          <p className="mt-3 text-[12.5px] text-ink-muted">{room.data.stay ? <>In the room: <span className="text-ink">{room.data.stay.guestName}</span> ({room.data.stay.code})</> : "Nobody is checked in."}</p>
          <ul className="mt-3 divide-y divide-line rounded-md border border-line">
            {room.data.items.map((i) => (
              <li key={i.itemId} className="flex items-center gap-3 px-3 py-2">
                <span className="flex-1 text-[13.5px] text-ink">
                  {i.name} <span className="font-mono text-[11.5px] text-ink-muted">par {i.parQty}</span>
                </span>
                <span className="font-mono text-[12px] text-ink-muted">{naira(i.priceKobo)}</span>
                <span className="inline-flex h-9 items-stretch overflow-hidden rounded-sm border border-line-strong">
                  <button type="button" className="w-9" aria-label={`Fewer ${i.name}`} onClick={() => setTaken((t) => ({ ...t, [i.itemId]: Math.max(0, (t[i.itemId] ?? 0) - 1) }))}>
                    −
                  </button>
                  <span className="grid w-9 place-items-center border-x border-line font-mono">{taken[i.itemId] ?? 0}</span>
                  <button type="button" className="w-9" aria-label={`More ${i.name}`} onClick={() => setTaken((t) => ({ ...t, [i.itemId]: (t[i.itemId] ?? 0) + 1 }))}>
                    +
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </Dialog>
  );
}
