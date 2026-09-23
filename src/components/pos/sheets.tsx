"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowCounterClockwise,
  Bank,
  Bed,
  Briefcase,
  CheckCircle,
  Coins,
  CreditCard,
  ForkKnife,
  MagnifyingGlass,
  Money,
  Prohibit,
  Signature,
  Wine,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { naira, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/overlay";
import { Field, Input, Textarea } from "@/components/ui/form";
import { NairaInput } from "@/components/m2/bits";
import { PinInput } from "@/components/folio/folio-dialogs";
import {
  SETTLE_META,
  cashQuickAmounts,
  evenSplit,
  itemSplit,
  lineTotal,
  type ChosenModifier,
  type PosItem,
  type SettleMethod,
  type TabKind,
  type TaxProfile,
  type Ticket,
  type TicketLine,
} from "./model";

/* ------------------------------------------------------------------ */
/* Modifiers                                                           */
/* ------------------------------------------------------------------ */

export function ModifiersSheet({
  item,
  onOpenChange,
  onAdd,
  onEightySix,
}: {
  item: PosItem | null;
  onOpenChange: (o: boolean) => void;
  onAdd: (item: PosItem, mods: ChosenModifier[], qty: number, note?: string) => void;
  /** mark the item sold out on every terminal */
  onEightySix?: (item: PosItem) => void;
}) {
  const [picked, setPicked] = useState<Record<string, string[]>>({});
  const [qty, setQty] = useState(1);
  const [note, setNote] = useState("");
  const [lastId, setLastId] = useState<string | null>(null);
  if (item && item.id !== lastId) {
    setLastId(item.id);
    setPicked({});
    setQty(1);
    setNote("");
  }
  if (!item) return <Sheet open={false} onOpenChange={onOpenChange} title="" />;
  const mods: ChosenModifier[] = item.modifierGroups.flatMap((g) =>
    (picked[g.id] ?? []).map((oid) => {
      const o = g.options.find((x) => x.id === oid)!;
      return { groupId: g.id, optionId: o.id, name: o.name, priceKobo: o.priceKobo };
    }),
  );
  const missing = item.modifierGroups.filter((g) => (picked[g.id]?.length ?? 0) < g.min);
  const unit = (item.activePriceKobo ?? item.priceKobo) + mods.reduce((s, m) => s + m.priceKobo, 0);
  const toggle = (gid: string, oid: string, max: number) =>
    setPicked((p) => {
      const cur = p[gid] ?? [];
      if (cur.includes(oid)) return { ...p, [gid]: cur.filter((x) => x !== oid) };
      if (max === 1) return { ...p, [gid]: [oid] };
      if (cur.length >= max) return p;
      return { ...p, [gid]: [...cur, oid] };
    });
  return (
    <Sheet
      open
      onOpenChange={onOpenChange}
      eyebrow="Options"
      title={item.name}
      description={`${naira(item.activePriceKobo ?? item.priceKobo)}${item.activePriceLabel ? ` (${item.activePriceLabel})` : ""}`}
      width="max-w-lg"
      footer={
        <>
          <div className="inline-flex h-12 items-stretch overflow-hidden rounded-md border border-line-strong bg-surface">
            <button type="button" aria-label="Fewer" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-11 text-[20px] text-ink-muted hover:bg-surface-2">
              −
            </button>
            <span className="grid min-w-11 place-items-center border-x border-line font-mono text-[17px]">{qty}</span>
            <button type="button" aria-label="More" onClick={() => setQty((q) => q + 1)} className="w-11 text-[20px] text-ink-muted hover:bg-surface-2">
              +
            </button>
          </div>
          <Button
            size="lg"
            className="h-12 flex-1 text-[15px]"
            disabled={missing.length > 0}
            onClick={() => {
              onAdd(item, mods, qty, note.trim() || undefined);
              onOpenChange(false);
            }}
            data-testid="modifiers-add"
          >
            {missing.length ? `Choose ${missing[0].name.toLowerCase()}` : `Add ${qty} · ${naira(unit * qty)}`}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {item.modifierGroups.map((g) => (
          <fieldset key={g.id}>
            <legend className="mb-2.5 flex w-full items-baseline justify-between">
              <span className="text-[14px] font-medium text-ink">{g.name}</span>
              <span className="text-[12px] text-ink-muted">
                {g.min > 0 ? (g.max === 1 ? "choose one" : `choose ${g.min} to ${g.max}`) : g.max === 1 ? "optional" : `up to ${g.max}`}
              </span>
            </legend>
            <div className="grid grid-cols-2 gap-2">
              {g.options.map((o) => {
                const on = (picked[g.id] ?? []).includes(o.id);
                return (
                  <button
                    key={o.id}
                    type="button"
                    role={g.max === 1 ? "radio" : "checkbox"}
                    aria-checked={on}
                    onClick={() => toggle(g.id, o.id, g.max)}
                    className={cn(
                      "flex min-h-[52px] items-center justify-between gap-2 rounded-md border px-3.5 text-left text-[14.5px] transition-colors",
                      on ? "border-laterite bg-laterite-wash text-ink shadow-[0_0_0_1px_var(--laterite)]" : "border-line-strong bg-surface text-ink hover:border-ink-faint",
                    )}
                  >
                    <span>{o.name}</span>
                    {o.priceKobo > 0 && <span className="font-mono text-[12.5px] text-ink-muted">+{naira(o.priceKobo)}</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        <Field label="Note for the kitchen" optional>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. no onions, sauce on the side" maxLength={120} />
        </Field>
        {onEightySix && (
          <button type="button" onClick={() => onEightySix(item)} className="inline-flex items-center gap-2 self-start text-[13px] text-ink-muted hover:text-danger">
            <span className="rounded-xs border border-current px-1 font-mono text-[10px] font-medium">86</span> Sold out? Take it off every terminal
          </button>
        )}
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* New ticket                                                          */
/* ------------------------------------------------------------------ */

export interface InHouseGuest {
  reservationId: string;
  code?: string;
  room: string;
  guestName: string;
  balanceKobo?: number;
  departureAt?: string;
  vip?: boolean;
}

export function NewTicketSheet({
  open,
  onOpenChange,
  onCreate,
  guests,
  defaultKind = "TABLE",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (t: { kind: TabKind; label: string; covers?: number; reservationId?: string; guestName?: string }) => void;
  guests: InHouseGuest[];
  defaultKind?: TabKind;
}) {
  const [kind, setKind] = useState<TabKind>(defaultKind);
  const [table, setTable] = useState("");
  const [covers, setCovers] = useState(2);
  const [name, setName] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the form each time it opens
      setKind(defaultKind);
      setTable("");
      setName("");
      setQ("");
      setCovers(2);
    }
  }, [open, defaultKind]);
  const kinds: { k: TabKind; label: string; icon: React.ReactNode }[] = [
    { k: "TABLE", label: "Table", icon: <ForkKnife size={18} weight="duotone" /> },
    { k: "ROOM", label: "Room", icon: <Bed size={18} weight="duotone" /> },
    { k: "TAB", label: "Bar tab", icon: <Wine size={18} weight="duotone" /> },
  ];
  return (
    <Sheet open={open} onOpenChange={onOpenChange} eyebrow="New ticket" title="Who is it for?" width="max-w-md">
      <div role="radiogroup" aria-label="Ticket type" className="grid grid-cols-3 gap-2">
        {kinds.map((x) => (
          <button
            key={x.k}
            type="button"
            role="radio"
            aria-checked={kind === x.k}
            onClick={() => setKind(x.k)}
            className={cn(
              "flex h-[68px] flex-col items-center justify-center gap-1 rounded-md border text-[13.5px] font-medium",
              kind === x.k ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink-muted hover:text-ink",
            )}
          >
            {x.icon}
            {x.label}
          </button>
        ))}
      </div>

      {kind === "TABLE" && (
        <div className="mt-5">
          <p className="mb-2 text-[13px] font-medium text-ink">Table number</p>
          <div className="mb-3 flex h-14 items-center justify-center rounded-md border border-line-strong bg-paper font-mono text-[30px] tracking-tight text-ink" aria-live="polite">
            {table || <span className="text-ink-faint">&middot;</span>}
          </div>
          <Keypad value={table} onChange={setTable} max={3} />
          <div className="mt-4 flex items-center justify-between">
            <span className="text-[13px] text-ink-muted">Covers</span>
            <div className="inline-flex h-11 items-stretch overflow-hidden rounded-md border border-line-strong">
              <button type="button" className="w-11 text-[18px]" aria-label="Fewer covers" onClick={() => setCovers((c) => Math.max(1, c - 1))}>
                −
              </button>
              <span className="grid min-w-11 place-items-center border-x border-line font-mono">{covers}</span>
              <button type="button" className="w-11 text-[18px]" aria-label="More covers" onClick={() => setCovers((c) => Math.min(30, c + 1))}>
                +
              </button>
            </div>
          </div>
          <Button size="lg" className="mt-5 h-12 w-full" disabled={!table} onClick={() => onCreate({ kind, label: table, covers })} data-testid="pos-open-table">
            Open table {table}
          </Button>
        </div>
      )}

      {kind === "ROOM" && (
        <div className="mt-5">
          <GuestPicker guests={guests} q={q} setQ={setQ} onPick={(g) => onCreate({ kind: "ROOM", label: g.room, reservationId: g.reservationId, guestName: g.guestName })} />
        </div>
      )}

      {kind === "TAB" && (
        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) onCreate({ kind: "TAB", label: name.trim() });
          }}
        >
          <Field label="Name on the tab">
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tunde, blue shirt" maxLength={40} />
          </Field>
          <Button type="submit" size="lg" className="mt-4 h-12 w-full" disabled={!name.trim()}>
            Open tab
          </Button>
        </form>
      )}
    </Sheet>
  );
}

function Keypad({ value, onChange, max }: { value: string; onChange: (v: string) => void; max: number }) {
  const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"];
  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          aria-label={k === "⌫" ? "Delete" : k === "C" ? "Clear" : k}
          onClick={() => {
            if (k === "C") onChange("");
            else if (k === "⌫") onChange(value.slice(0, -1));
            else if (value.length < max) onChange(value + k);
          }}
          className="h-14 rounded-md border border-line-strong bg-surface font-mono text-[20px] text-ink transition-colors hover:bg-surface-2 active:bg-surface-2"
        >
          {k}
        </button>
      ))}
    </div>
  );
}

export function GuestPicker({
  guests,
  q,
  setQ,
  onPick,
  selected,
}: {
  guests: InHouseGuest[];
  q: string;
  setQ: (v: string) => void;
  onPick: (g: InHouseGuest) => void;
  selected?: string | null;
}) {
  const term = q.trim().toLowerCase();
  const list = guests.filter((g) => !term || g.room.toLowerCase().startsWith(term) || g.guestName.toLowerCase().includes(term) || (g.code ?? "").toLowerCase().includes(term));
  return (
    <div>
      <label className="relative flex items-center">
        <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 text-ink-muted" />
        <span className="sr-only">Find an in-house guest</span>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Room number or guest name"
          className="h-12 w-full rounded-md border border-line-strong bg-surface pl-9 pr-3 text-[16px] outline-none focus:border-laterite"
          data-testid="guest-search"
        />
      </label>
      <p className="mb-2 mt-3 eyebrow">In the house now &middot; {guests.length}</p>
      <ul className="scrollbar-thin max-h-[42vh] overflow-y-auto rounded-md border border-line">
        {list.length === 0 && <li className="px-4 py-6 text-center text-[13px] text-ink-muted">No guest in the house matches.</li>}
        {list.map((g) => (
          <li key={g.reservationId} className="border-b border-line last:border-b-0">
            <button
              type="button"
              onClick={() => onPick(g)}
              aria-pressed={selected === g.reservationId}
              className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-surface-2", selected === g.reservationId && "bg-adire-wash")}
              data-testid={`guest-${g.room}`}
            >
              <span className="grid h-10 w-12 shrink-0 place-items-center rounded-sm border border-[color-mix(in_oklab,var(--adire)_35%,transparent)] bg-adire-wash font-mono text-[15px] text-adire">{g.room}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium text-ink">{g.guestName}</span>
                <span className="block text-[12px] text-ink-muted">
                  {g.code && <span className="font-mono">{g.code}</span>}
                  {g.departureAt && <> &middot; leaves {formatDate(g.departureAt, { weekday: "short", day: "numeric", month: "short", year: undefined })}</>}
                </span>
              </span>
              {g.balanceKobo !== undefined && g.balanceKobo > 0 && <span className="font-mono text-[12px] text-ochre">owes {naira(g.balanceKobo)}</span>}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Note, void                                                          */
/* ------------------------------------------------------------------ */

export function NoteDialog({ line, onOpenChange, onSave }: { line: TicketLine | null; onOpenChange: (o: boolean) => void; onSave: (note: string) => void }) {
  const [v, setV] = useState("");
  const [last, setLast] = useState<string | null>(null);
  if (line && line.key !== last) {
    setLast(line.key);
    setV(line.note ?? "");
  }
  return (
    <Dialog
      open={!!line}
      onOpenChange={onOpenChange}
      title={`Note on ${line?.name ?? ""}`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onSave(v.trim());
              onOpenChange(false);
            }}
          >
            Save note
          </Button>
        </>
      }
    >
      <div className="mb-3 flex flex-wrap gap-1.5">
        {["No onions", "Well done", "Sauce on the side", "No pepper", "Takeaway pack", "Serve first"].map((s) => (
          <button key={s} type="button" onClick={() => setV(s)} className="h-9 rounded-full border border-line-strong px-3 text-[13px] text-ink-muted hover:text-ink">
            {s}
          </button>
        ))}
      </div>
      <Textarea value={v} onChange={(e) => setV(e.target.value)} maxLength={120} placeholder="What the kitchen should know" />
    </Dialog>
  );
}

export const VOID_REASONS = ["Guest changed their mind", "Wrong item rung up", "Kitchen could not make it", "Took too long", "Quality complaint"];

export function VoidLineDialog({
  line,
  onOpenChange,
  needsPin,
  approvers,
  onVoid,
  busy,
  error,
}: {
  line: TicketLine | null;
  onOpenChange: (o: boolean) => void;
  needsPin: boolean;
  approvers: { id: string; fullName: string }[];
  onVoid: (p: { reason: string; approverId?: string; pin?: string }) => void;
  busy?: boolean;
  error?: string | null;
}) {
  const [reason, setReason] = useState("");
  const [other, setOther] = useState("");
  const [approverId, setApproverId] = useState("");
  const [pin, setPin] = useState("");
  const [last, setLast] = useState<string | null>(null);
  if (line && line.key !== last) {
    setLast(line.key);
    setReason("");
    setOther("");
    setPin("");
    setApproverId("");
  }
  const why = reason === "Other" ? other.trim() : reason;
  const ok = !!why && (!needsPin || (approverId && pin.length >= 4));
  return (
    <Dialog
      open={!!line}
      onOpenChange={onOpenChange}
      eyebrow={<span className="inline-flex items-center gap-1.5 text-danger"><Prohibit size={13} weight="bold" /> Void after sending</span>}
      title={line ? `Void ${line.qty} × ${line.name}?` : ""}
      description={line ? `${naira(lineTotal(line))} comes off the ticket. The kitchen has already seen this item, so the void is recorded with your name and the reason, and Revenue Guard sees it.` : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Keep it
          </Button>
          <Button variant="danger" disabled={!ok} loading={busy} onClick={() => onVoid({ reason: why, approverId: needsPin ? approverId : undefined, pin: needsPin ? pin : undefined })} data-testid="void-confirm">
            Void item
          </Button>
        </>
      }
    >
      <p className="mb-2 text-[13px] font-medium text-ink">Reason</p>
      <div className="flex flex-wrap gap-1.5">
        {[...VOID_REASONS, "Other"].map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={reason === r}
            onClick={() => setReason(r)}
            className={cn("h-10 rounded-full border px-3.5 text-[13px]", reason === r ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:text-ink")}
          >
            {r}
          </button>
        ))}
      </div>
      {reason === "Other" && <Input className="mt-3" autoFocus value={other} onChange={(e) => setOther(e.target.value)} placeholder="Say what happened" maxLength={120} />}
      {needsPin && (
        <div className="mt-5 rounded-md border border-[color-mix(in_oklab,var(--brass)_40%,transparent)] bg-brass-wash/50 p-4">
          <p className="text-[13px] font-medium text-ink">A manager approves this on this screen</p>
          <p className="mt-0.5 text-[12.5px] text-ink-muted">Voids above the approval threshold need a second key.</p>
          {approvers.length === 0 ? (
            <p className="mt-3 text-[12.5px] text-danger">No manager has set an approval PIN yet.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {approvers.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    role="radio"
                    aria-checked={approverId === a.id}
                    onClick={() => setApproverId(a.id)}
                    className={cn("h-10 rounded-full border px-3.5 text-[13px]", approverId === a.id ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink-muted")}
                  >
                    {a.fullName}
                  </button>
                ))}
              </div>
              <PinInput value={pin} onChange={setPin} disabled={!approverId} />
            </div>
          )}
          {error && <p role="alert" className="mt-2 text-[12.5px] text-danger">{error}</p>}
        </div>
      )}
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/* Split                                                               */
/* ------------------------------------------------------------------ */

export interface SplitResult {
  mode: "EVEN" | "ITEMS";
  /** EVEN: amount per check; ITEMS: line keys per check */
  checks: { amountKobo: number; lineKeys?: string[] }[];
}

const CHECK_COLORS = ["var(--season-1)", "var(--season-2)", "var(--season-3)", "var(--season-4)", "var(--season-5)", "var(--adire)"];

export function SplitSheet({
  ticket,
  totalKobo,
  tax,
  open,
  onOpenChange,
  onDone,
}: {
  ticket: Ticket | null;
  totalKobo: number;
  tax?: TaxProfile;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onDone: (r: SplitResult) => void;
}) {
  const [mode, setMode] = useState<"EVEN" | "ITEMS">("EVEN");
  const [ways, setWays] = useState(2);
  const [checks, setChecks] = useState(2);
  const [active, setActive] = useState(1);
  const [assign, setAssign] = useState<Record<string, number>>({});
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset when opened
      setAssign({});
      setActive(1);
    }
  }, [open]);
  const lines = (ticket?.lines ?? []).filter((l) => l.state !== "VOID");
  const parts = mode === "EVEN" ? evenSplit(totalKobo, ways) : itemSplit(lines, assign, checks + 1, tax).map((t) => t.totalKobo); // [0] = not yet placed
  const unassigned = mode === "ITEMS" ? lines.filter((l) => (assign[l.key] ?? 0) === 0) : [];
  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Split the bill"
      title={`${naira(totalKobo)} between ${mode === "EVEN" ? ways : checks} checks`}
      width="max-w-xl"
      footer={
        <Button
          size="lg"
          className="h-12 w-full"
          disabled={mode === "ITEMS" && unassigned.length > 0}
          onClick={() =>
            onDone(
              mode === "EVEN"
                ? { mode, checks: parts.map((a) => ({ amountKobo: a })) }
                : {
                    mode,
                    checks: Array.from({ length: checks }, (_, c) => ({
                      amountKobo: parts[c + 1] ?? 0,
                      lineKeys: lines.filter((l) => (assign[l.key] ?? 0) === c + 1).map((l) => l.key),
                    })),
                  },
            )
          }
        >
          {mode === "ITEMS" && unassigned.length ? `${unassigned.length} ${unassigned.length === 1 ? "item" : "items"} still to place` : "Settle check by check"}
        </Button>
      }
    >
      <div role="radiogroup" aria-label="How to split" className="mb-5 grid grid-cols-2 gap-2">
        {(["EVEN", "ITEMS"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            onClick={() => setMode(m)}
            className={cn("h-12 rounded-md border text-[14px] font-medium", mode === m ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}
          >
            {m === "EVEN" ? "Evenly" : "By item"}
          </button>
        ))}
      </div>

      {mode === "EVEN" ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-ink">Ways</span>
            <div className="inline-flex h-12 items-stretch overflow-hidden rounded-md border border-line-strong">
              <button type="button" className="w-12 text-[20px]" aria-label="Fewer ways" onClick={() => setWays((w) => Math.max(2, w - 1))}>
                −
              </button>
              <span className="grid min-w-12 place-items-center border-x border-line font-mono text-[18px]">{ways}</span>
              <button type="button" className="w-12 text-[20px]" aria-label="More ways" onClick={() => setWays((w) => Math.min(12, w + 1))}>
                +
              </button>
            </div>
          </div>
          <ul className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {parts.map((p, i) => (
              <li key={i} className="rounded-md border border-line bg-paper px-3 py-2.5" style={{ boxShadow: `inset 3px 0 0 ${CHECK_COLORS[i % CHECK_COLORS.length]}` }}>
                <p className="eyebrow text-[9.5px]">Check {i + 1}</p>
                <p className="mt-0.5 font-mono text-[18px] text-ink">{naira(p)}</p>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12.5px] text-ink-muted">Split to the naira; the first checks carry any odd naira so the parts add up to the bill.</p>
        </>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            {Array.from({ length: checks }, (_, c) => (
              <button
                key={c}
                type="button"
                aria-pressed={active === c + 1}
                onClick={() => setActive(c + 1)}
                className={cn("inline-flex h-10 items-center gap-2 rounded-md border px-3 text-[13px] font-medium", active === c + 1 ? "border-ink text-ink shadow-[0_0_0_1px_var(--ink)]" : "border-line-strong text-ink-muted")}
              >
                <span className="h-3 w-3 rounded-[2px]" style={{ background: CHECK_COLORS[c % CHECK_COLORS.length] }} aria-hidden />
                Check {c + 1}
                <span className="font-mono text-[12px] text-ink-muted">{naira(parts[c + 1] ?? 0)}</span>
              </button>
            ))}
            <Button variant="ghost" size="sm" onClick={() => setChecks((c) => Math.min(6, c + 1))} disabled={checks >= 6}>
              + Check
            </Button>
          </div>
          <p className="mb-2 text-[12.5px] text-ink-muted">Choose a check, then tap the items that go on it.</p>
          <ul className="rounded-md border border-line">
            {lines.map((l) => {
              const c = assign[l.key] ?? 0;
              return (
                <li key={l.key} className="border-b border-line last:border-b-0">
                  <button
                    type="button"
                    onClick={() => setAssign((a) => ({ ...a, [l.key]: a[l.key] === active ? 0 : active }))}
                    className="flex w-full items-center gap-3 px-3 py-3 text-left hover:bg-surface-2"
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-[3px] border font-mono text-[11px]"
                      style={c ? { background: CHECK_COLORS[(c - 1) % CHECK_COLORS.length], borderColor: "transparent", color: "var(--surface)" } : { borderStyle: "dashed", borderColor: "var(--line-strong)", color: "var(--ink-faint)" }}
                    >
                      {c || "?"}
                    </span>
                    <span className="flex-1 text-[14px] text-ink">
                      {l.qty} × {l.name}
                    </span>
                    <span className="font-mono text-[13px] text-ink">{naira(lineTotal(l))}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Settle                                                              */
/* ------------------------------------------------------------------ */

export interface SettlePayload {
  method: SettleMethod;
  amountKobo: number;
  tenderedKobo?: number;
  reservationId?: string;
  corporateAccountId?: string;
  reference?: string;
  signature?: string | null;
  guestConfirmed?: boolean;
}

const METHOD_ICON: Record<SettleMethod, React.ReactNode> = {
  CASH: <Money size={20} weight="duotone" />,
  TRANSFER: <Bank size={20} weight="duotone" />,
  POS: <CreditCard size={20} weight="duotone" />,
  ROOM: <Bed size={20} weight="duotone" />,
  CITY_LEDGER: <Briefcase size={20} weight="duotone" />,
};

export function SettleSheet({
  open,
  onOpenChange,
  amountKobo,
  label,
  guests,
  companies,
  presetReservationId,
  shiftOpen,
  canOpenShift,
  onOpenShift,
  openingShift,
  onSettle,
  busy,
  allowed = ["CASH", "TRANSFER", "POS", "ROOM", "CITY_LEDGER"],
  error,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  amountKobo: number;
  label: string;
  guests: InHouseGuest[];
  companies: { id: string; name: string; availableKobo?: number | null }[];
  presetReservationId?: string | null;
  shiftOpen: boolean;
  canOpenShift: boolean;
  onOpenShift: (floatKobo: number) => void;
  openingShift?: boolean;
  onSettle: (p: SettlePayload) => void;
  busy?: boolean;
  allowed?: SettleMethod[];
  error?: string | null;
}) {
  const [method, setMethod] = useState<SettleMethod>("CASH");
  const [tendered, setTendered] = useState<number | null>(null);
  const [ref, setRef] = useState("");
  const [q, setQ] = useState("");
  const [guest, setGuest] = useState<string | null>(null);
  const [company, setCompany] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [sig, setSig] = useState<string | null>(null);
  const [float, setFloat] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset each time it opens
    setMethod(presetReservationId ? "ROOM" : "CASH");
    setGuest(presetReservationId ?? null);
    setTendered(null);
    setRef("");
    setQ("");
    setCompany(null);
    setConfirmed(false);
    setSig(null);
  }, [open, presetReservationId]);

  const needsShift = SETTLE_META[method].needsShift && !shiftOpen;
  const g = guests.find((x) => x.reservationId === guest) ?? null;
  const change = method === "CASH" && tendered != null ? tendered - amountKobo : null;
  const quick = useMemo(() => cashQuickAmounts(amountKobo), [amountKobo]);
  const ready =
    !needsShift &&
    (method === "CASH"
      ? tendered == null || tendered >= amountKobo
      : method === "ROOM"
        ? !!g && confirmed
        : method === "CITY_LEDGER"
          ? !!company
          : true);

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={label}
      title={
        <span className="flex items-baseline gap-3">
          Settle <span className="font-mono text-[26px] tracking-tight">{naira(amountKobo)}</span>
        </span>
      }
      width="max-w-xl"
      footer={
        <Button
          size="lg"
          className="h-14 w-full text-[16px]"
          disabled={!ready}
          loading={busy}
          data-testid="settle-confirm"
          onClick={() =>
            onSettle({
              method,
              amountKobo,
              tenderedKobo: method === "CASH" ? (tendered ?? amountKobo) : undefined,
              reservationId: method === "ROOM" ? (g?.reservationId ?? undefined) : undefined,
              corporateAccountId: method === "CITY_LEDGER" ? (company ?? undefined) : undefined,
              reference: ref.trim() || undefined,
              signature: method === "ROOM" ? sig : undefined,
              guestConfirmed: method === "ROOM" ? confirmed : undefined,
            })
          }
        >
          {method === "ROOM" ? (g ? `Charge to room ${g.room}` : "Choose the room") : method === "CITY_LEDGER" ? "Charge to the company" : change && change > 0 ? `Paid, change ${naira(change)}` : `Take ${SETTLE_META[method].short.toLowerCase()}`}
        </Button>
      }
    >
      <div role="radiogroup" aria-label="How is it paid" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {allowed.map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={method === m}
            onClick={() => setMethod(m)}
            data-testid={`method-${m}`}
            className={cn(
              "relative flex h-[76px] flex-col items-center justify-center gap-1.5 rounded-md border text-[12.5px] font-medium transition-colors",
              method === m ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink-muted hover:text-ink",
            )}
          >
            <span aria-hidden className="absolute inset-x-3 top-0 h-[3px] rounded-b-[2px]" style={{ background: SETTLE_META[m].color }} />
            {METHOD_ICON[m]}
            {SETTLE_META[m].short}
          </button>
        ))}
      </div>

      {needsShift && (
        <div className="mt-5 rounded-md border border-[color-mix(in_oklab,var(--ochre)_40%,transparent)] bg-ochre-wash/60 p-4" data-testid="shift-required">
          <p className="flex items-center gap-2 text-[14px] font-medium text-ink">
            <Coins size={17} weight="duotone" className="text-ochre" /> Open your shift first
          </p>
          <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">
            Cash, transfer and POS takings are counted against your till at the end of the shift. Charging a room or a company account does not need one.
          </p>
          {canOpenShift ? (
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <div className="w-44">
                <p className="mb-1 text-[12px] text-ink-muted">Opening float</p>
                <NairaInput kobo={float} onChange={setFloat} aria-label="Opening float" />
              </div>
              <Button variant="ink" onClick={() => onOpenShift(float ?? 0)} loading={openingShift} data-testid="pos-open-shift">
                Open shift
              </Button>
            </div>
          ) : (
            <p className="mt-2 text-[12.5px] text-danger">Your role cannot hold a till. Ask a cashier to settle it.</p>
          )}
        </div>
      )}

      {!needsShift && method === "CASH" && (
        <div className="mt-5">
          <p className="mb-2 text-[13px] font-medium text-ink">Cash handed over</p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {quick.map((a, i) => (
              <button
                key={a}
                type="button"
                onClick={() => setTendered(a)}
                aria-pressed={tendered === a}
                className={cn("h-14 rounded-md border font-mono text-[16px]", tendered === a ? "border-palm bg-palm-wash text-palm" : "border-line-strong bg-surface text-ink")}
              >
                {i === 0 ? "Exact" : naira(a)}
              </button>
            ))}
          </div>
          <div className="mt-2">
            <NairaInput kobo={tendered} onChange={setTendered} large aria-label="Amount handed over" placeholder={String(Math.round(amountKobo / 100))} />
          </div>
          {change !== null && (
            <p className={cn("mt-3 flex items-baseline justify-between rounded-md border px-4 py-3", change >= 0 ? "border-line bg-paper" : "border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-danger-wash")}>
              <span className="text-[13.5px] text-ink-muted">{change >= 0 ? "Change to give" : "Still short"}</span>
              <span className={cn("font-mono text-[26px] tracking-tight", change >= 0 ? "text-palm" : "text-danger")}>{naira(Math.abs(change))}</span>
            </p>
          )}
        </div>
      )}

      {!needsShift && (method === "TRANSFER" || method === "POS") && (
        <div className="mt-5">
          <Field label={method === "POS" ? "Terminal slip reference" : "Transfer reference or sender"} optional hint={method === "POS" ? "The last digits on the POS slip help at the end-of-day count." : "Check the alert has landed before you hand over."}>
            <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder={method === "POS" ? "e.g. 004512" : "e.g. Opay 2231 / A. Bello"} />
          </Field>
        </div>
      )}

      {method === "ROOM" && (
        <div className="mt-5 flex flex-col gap-4">
          {!g ? (
            <GuestPicker guests={guests} q={q} setQ={setQ} onPick={(x) => setGuest(x.reservationId)} selected={guest} />
          ) : (
            <>
              <div className="flex items-center gap-3 rounded-md border border-[color-mix(in_oklab,var(--adire)_35%,transparent)] bg-adire-wash/60 p-3">
                <span className="grid h-12 w-14 place-items-center rounded-sm bg-adire font-mono text-[18px] text-surface">{g.room}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-medium text-ink">{g.guestName}</p>
                  <p className="text-[12.5px] text-ink-muted">{g.code ? <span className="font-mono">{g.code}</span> : null} goes on this guest&rsquo;s folio as an extra</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setGuest(null); setConfirmed(false); }}>
                  Change
                </Button>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-line p-3" data-testid="confirm-guest">
                <input type="checkbox" className="mt-0.5 h-5 w-5 accent-[var(--laterite)]" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                <span className="text-[13.5px] leading-snug text-ink">
                  The guest told me their name and room, and they match: <strong className="font-medium">{g.guestName}</strong>, room <span className="font-mono">{g.room}</span>.
                </span>
              </label>
              <SignaturePad value={sig} onChange={setSig} />
            </>
          )}
        </div>
      )}

      {method === "CITY_LEDGER" && (
        <div className="mt-5">
          <p className="mb-2 text-[13px] font-medium text-ink">Company account</p>
          {companies.length === 0 ? (
            <p className="text-[13px] text-ink-muted">No company accounts yet. Add one under Corporate accounts.</p>
          ) : (
            <ul className="rounded-md border border-line">
              {companies.map((c) => {
                const over = c.availableKobo != null && c.availableKobo < amountKobo;
                return (
                  <li key={c.id} className="border-b border-line last:border-b-0">
                    <button
                      type="button"
                      disabled={over}
                      aria-pressed={company === c.id}
                      onClick={() => setCompany(c.id)}
                      className={cn("flex w-full items-center gap-3 px-3 py-3 text-left disabled:opacity-50", company === c.id ? "bg-surface-2" : "hover:bg-surface-2/60")}
                    >
                      <Briefcase size={18} weight="duotone" className="text-ink-muted" />
                      <span className="flex-1 text-[14px] text-ink">{c.name}</span>
                      {c.availableKobo != null && <span className={cn("font-mono text-[12px]", over ? "text-danger" : "text-ink-muted")}>{over ? "over limit" : `${naira(c.availableKobo)} left`}</span>}
                      {company === c.id && <CheckCircle size={18} weight="fill" className="text-palm" />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mt-4 rounded-md border border-[color-mix(in_oklab,var(--danger)_35%,transparent)] bg-danger-wash px-3 py-2 text-[13px] text-danger">
          {error}
        </p>
      )}
    </Sheet>
  );
}

/** A small signature pad: finger or stylus. Optional; stored with the room charge. */
export function SignaturePad({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [empty, setEmpty] = useState(!value);
  const ctx = () => {
    const c = ref.current;
    if (!c) return null;
    const x = c.getContext("2d");
    if (!x) return null;
    x.lineWidth = 2.2;
    x.lineCap = "round";
    x.lineJoin = "round";
    x.strokeStyle = getComputedStyle(c).color;
    return x;
  };
  const pos = (e: React.PointerEvent) => {
    const r = ref.current!.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * ref.current!.width, y: ((e.clientY - r.top) / r.height) * ref.current!.height };
  };
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink">
          <Signature size={16} /> Guest signature <span className="font-normal text-ink-faint">optional</span>
        </span>
        {!empty && (
          <button
            type="button"
            onClick={() => {
              const c = ref.current;
              c?.getContext("2d")?.clearRect(0, 0, c.width, c.height);
              setEmpty(true);
              onChange(null);
            }}
            className="inline-flex items-center gap-1 text-[12.5px] text-ink-muted hover:text-ink"
          >
            <ArrowCounterClockwise size={13} /> Clear
          </button>
        )}
      </div>
      <div className="relative rounded-md border border-dashed border-line-strong bg-paper">
        <canvas
          ref={ref}
          width={640}
          height={180}
          aria-label="Signature pad"
          className="block h-[110px] w-full touch-none text-ink"
          onPointerDown={(e) => {
            const x = ctx();
            if (!x) return;
            drawing.current = true;
            (e.target as HTMLElement).setPointerCapture(e.pointerId);
            const p = pos(e);
            x.beginPath();
            x.moveTo(p.x, p.y);
          }}
          onPointerMove={(e) => {
            if (!drawing.current) return;
            const x = ctx();
            if (!x) return;
            const p = pos(e);
            x.lineTo(p.x, p.y);
            x.stroke();
            if (empty) setEmpty(false);
          }}
          onPointerUp={() => {
            drawing.current = false;
            if (!empty) onChange(ref.current?.toDataURL("image/png") ?? null);
          }}
        />
        {empty && <span className="pointer-events-none absolute inset-x-0 bottom-4 text-center font-display text-[15px] italic text-ink-faint">Sign here</span>}
        <span aria-hidden className="pointer-events-none absolute inset-x-6 bottom-3 border-b border-line-strong" />
      </div>
    </div>
  );
}
