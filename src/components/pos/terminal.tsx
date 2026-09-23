"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CaretUp, CheckCircle, CookingPot, Printer, Receipt as ReceiptIcon, Storefront, WifiSlash } from "@phosphor-icons/react";
import { useEntitlements } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import { errorMessage, isApiError } from "@/lib/api/client";
import { posApi } from "@/lib/api/endpoints-m5";
import { shiftsApi } from "@/lib/api/endpoints-m2";
import { qk5, useInHouseForPos, useOutlets, usePosOrder, usePosOrders, useTerminalMenu } from "@/lib/api/hooks-m5";
import { qk2, useApprovers, useCurrentShift, useTaxSettings } from "@/lib/api/hooks-m2";
import { useCorporateAccounts } from "@/lib/api/hooks-m4";
import type { PosOrder, SettleInput, SettleResult } from "@/lib/api/types-m5";
import { deskAction } from "@/lib/offline/desk-action";
import { useNetwork } from "@/lib/offline/network";
import { useOutbox } from "@/lib/offline/outbox";
import { usePropertyId } from "@/lib/property";
import { naira } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/use-now";
import { LogoMark } from "@/components/brand";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog, Sheet } from "@/components/ui/overlay";
import { Skeleton } from "@/components/ui/primitives";
import { OutboxChip } from "@/components/offline/offline";
import { ShiftChip } from "@/components/shell/shift-chip";
import { usePropertyScope } from "@/components/shell/property-switcher";
import { MenuBoard } from "./menu-board";
import { TicketRail, ticketTitle } from "./ticket-rail";
import { ModifiersSheet, NewTicketSheet, NoteDialog, SettleSheet, SplitSheet, VoidLineDialog, type InHouseGuest, type SettlePayload, type SplitResult } from "./sheets";
import { adaptMenu, adaptTax, tableLabelFor, ticketFromListItem, ticketFromOrder } from "./adapters";
import { addToTicket, draftCount, lineTotal, totalsFor, type ChosenModifier, type PosItem, type TabKind, type Ticket, type TicketLine } from "./model";

/* ------------------------------------------------------------------ */
/* Local tickets: drafts live on the device until they are sent       */
/* ------------------------------------------------------------------ */

interface LocalTicket {
  key: string;
  /** server order id once it exists (we create orders with our own uuid, so usually === key) */
  serverId: string | null;
  outletId: string;
  kind: TabKind;
  label: string;
  covers: number;
  reservationId: string | null;
  guestName: string | null;
  openedAt: string;
  drafts: TicketLine[];
  /** lines handed to the outbox, shown as sent until the server has them */
  queued: TicketLine[];
}

const storeKey = (pid: string | null) => `admin.pos.local.${pid ?? "default"}`;
function loadLocal(pid: string | null): Record<string, LocalTicket> {
  try {
    const raw = localStorage.getItem(storeKey(pid));
    return raw ? (JSON.parse(raw) as Record<string, LocalTicket>) : {};
  } catch {
    return {};
  }
}
function saveLocal(pid: string | null, v: Record<string, LocalTicket>) {
  try {
    localStorage.setItem(storeKey(pid), JSON.stringify(v));
  } catch {
    /* memory only */
  }
}
const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx".replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));

const toLineInput = (l: TicketLine) => ({ itemId: l.itemId, quantity: l.qty, modifierOptionIds: l.modifiers.map((m) => m.optionId), note: l.note || undefined });

const OUTLET_KEY = (pid: string | null) => `admin.pos.outlet.${pid ?? "default"}`;
const VOID_PIN_KOBO = 1_000_000;

export function PosTerminal() {
  const qc = useQueryClient();
  const pid = usePropertyId();
  const { has } = useEntitlements();
  const { can } = useCan();
  const net = useNetwork();
  const outbox = useOutbox();
  const scope = usePropertyScope();
  const offlineOk = has("offline_mode");

  const outlets = useOutlets();
  const sellable = useMemo(() => (outlets.data ?? []).filter((o) => o.active && o.type !== "MINIBAR").sort((a, b) => a.sortOrder - b.sortOrder), [outlets.data]);
  const [outletId, setOutletIdState] = useState<string | null>(null);
  useEffect(() => {
    if (!sellable.length) return;
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(OUTLET_KEY(pid));
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- adopt the saved outlet once the list is known
    setOutletIdState((cur) => (cur && sellable.some((o) => o.id === cur) ? cur : sellable.find((o) => o.id === saved)?.id ?? sellable[0].id));
  }, [sellable, pid]);
  const setOutletId = (id: string) => {
    setOutletIdState(id);
    setSelected(null);
    try {
      localStorage.setItem(OUTLET_KEY(pid), id);
    } catch {
      /* ignore */
    }
  };
  const outlet = sellable.find((o) => o.id === outletId) ?? null;

  const menuQ = useTerminalMenu(outletId);
  const menu = useMemo(() => (menuQ.data ? adaptMenu(menuQ.data) : null), [menuQ.data]);
  const tax = adaptTax(useTaxSettings().data);
  const openQ = usePosOrders({ status: "OPEN", outletId: outletId ?? undefined, pageSize: 60 }, !!outletId, 10_000);
  const inHouse = useInHouseForPos(can("pos.settle"));
  const guests: InHouseGuest[] = useMemo(
    () => (inHouse.data ?? []).map((g) => ({ reservationId: g.reservationId, code: g.code, room: g.room.number, guestName: g.guestName, balanceKobo: g.balanceKobo, departureAt: `${g.departureDate}T11:00:00Z`, vip: g.vip })),
    [inHouse.data],
  );
  const shift = useCurrentShift(can("shifts.own"));
  const shiftOpen = shift.data?.status === "OPEN";
  const companies = useCorporateAccounts({ active: true }, has("promotions") && can("corporate.view"));
  const approvers = useApprovers(can("pos.void"));

  /* local drafts */
  const [local, setLocalState] = useState<Record<string, LocalTicket>>({});
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load the device's drafts for this property
    setLocalState(loadLocal(pid));
  }, [pid]);
  const setLocal = useCallback(
    (fn: (l: Record<string, LocalTicket>) => Record<string, LocalTicket>) =>
      setLocalState((cur) => {
        const next = fn(cur);
        saveLocal(pid, next);
        return next;
      }),
    [pid],
  );
  const [selected, setSelected] = useState<string | null>(null);

  const serverOpen = useMemo(() => openQ.data?.items ?? [], [openQ.data]);
  const queuedFor = useCallback((key: string) => outbox.some((i) => i.kind === "pos-order" && (i.path.includes(key) || (i.body as { id?: string }).id === key)), [outbox]);

  // tickets for the rail strip: server orders plus this device's unsynced ones
  const openTickets: Ticket[] = useMemo(() => {
    const out: Ticket[] = [];
    const seen = new Set<string>();
    for (const o of serverOpen) {
      const t = ticketFromListItem(o);
      const l = local[o.id];
      if (l) t.lines = [...l.queued, ...l.drafts];
      t.pending = queuedFor(o.id);
      out.push(t);
      seen.add(o.id);
    }
    for (const l of Object.values(local)) {
      if (seen.has(l.key) || l.outletId !== outletId) continue;
      if (l.serverId && !queuedFor(l.key) && !l.drafts.length) continue; // settled or gone elsewhere
      out.push({ key: l.key, id: l.serverId, outletId: l.outletId, kind: l.kind, label: l.label, covers: l.covers, openedAt: l.openedAt, status: "OPEN", reservationId: l.reservationId, guestName: l.guestName, lines: [...l.queued, ...l.drafts], pending: queuedFor(l.key) || (!l.serverId && l.queued.length > 0) });
    }
    return out.sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  }, [serverOpen, local, outletId, queuedFor]);

  const cur = selected ? openTickets.find((t) => t.key === selected) ?? null : null;
  const serverId = cur?.id && serverOpen.some((o) => o.id === cur.id) ? cur.id : null;
  const orderQ = usePosOrder(serverId);
  const ticket: Ticket | null = useMemo(() => {
    if (!cur) return null;
    if (orderQ.data && orderQ.data.id === cur.id) {
      const t = ticketFromOrder(orderQ.data);
      const l = local[cur.key];
      // the outbox may still hold lines the server hasn't seen: show them as sent
      if (l?.queued.length && queuedFor(cur.key)) t.lines = [...t.lines, ...l.queued];
      if (l?.drafts.length) t.lines = [...t.lines, ...l.drafts];
      t.pending = queuedFor(cur.key);
      return t;
    }
    return cur;
  }, [cur, orderQ.data, local, queuedFor]);

  // once the outbox has delivered a ticket's lines, forget the local copy of them
  useEffect(() => {
    const done = Object.values(local).filter((l) => l.queued.length && !queuedFor(l.key));
    if (!done.length) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the outbox (an external store) delivered them
    setLocal((all) => {
      const next = { ...all };
      for (const l of done) next[l.key] = { ...next[l.key], queued: [] };
      return next;
    });
    void qc.invalidateQueries({ queryKey: ["pos"] });
  }, [local, queuedFor, setLocal, qc]);

  /* sheets */
  const [newOpen, setNewOpen] = useState(false);
  const [pendingPick, setPendingPick] = useState<{ item: PosItem; mods: ChosenModifier[]; qty: number; note?: string } | null>(null);
  const [optionsFor, setOptionsFor] = useState<PosItem | null>(null);
  const [noteFor, setNoteFor] = useState<TicketLine | null>(null);
  const [voidFor, setVoidFor] = useState<TicketLine | null>(null);
  const [voidErr, setVoidErr] = useState<string | null>(null);
  const [voidPin, setVoidPin] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);
  const [settle, setSettle] = useState<{ order: PosOrder } | null>(null);
  const [even, setEven] = useState<{ order: PosOrder; parts: number[] } | null>(null);
  const [settleErr, setSettleErr] = useState<string | null>(null);
  const [done, setDone] = useState<{ result: SettleResult; changeKobo: number | null } | null>(null);
  const [ticketSheet, setTicketSheet] = useState(false);

  /* ---- actions ---- */
  const createTicket = (t: { kind: TabKind; label: string; covers?: number; reservationId?: string; guestName?: string }) => {
    if (!outletId) return;
    const key = uuid();
    const lt: LocalTicket = { key, serverId: null, outletId, kind: t.kind, label: t.label, covers: t.covers ?? 1, reservationId: t.reservationId ?? null, guestName: t.guestName ?? (t.kind === "TAB" ? t.label : null), openedAt: new Date().toISOString(), drafts: [], queued: [] };
    if (pendingPick) lt.drafts = addToTicket([], pendingPick.item, pendingPick.mods, pendingPick.qty, pendingPick.note);
    setLocal((l) => ({ ...l, [key]: lt }));
    setSelected(key);
    setNewOpen(false);
    setPendingPick(null);
  };

  const ensureLocal = (key: string): LocalTicket | null => {
    if (local[key]) return local[key];
    const t = openTickets.find((x) => x.key === key);
    if (!t) return null;
    const lt: LocalTicket = { key, serverId: t.id ?? null, outletId: t.outletId, kind: t.kind, label: t.label, covers: t.covers ?? 1, reservationId: t.reservationId ?? null, guestName: t.guestName ?? null, openedAt: t.openedAt, drafts: [], queued: [] };
    return lt;
  };

  const pick = (item: PosItem, mods: ChosenModifier[] = [], qty = 1, note?: string) => {
    if (!selected) {
      setPendingPick({ item, mods, qty, note });
      setNewOpen(true);
      return;
    }
    const base = ensureLocal(selected);
    if (!base) return;
    setLocal((l) => ({ ...l, [selected]: { ...base, ...(l[selected] ?? {}), drafts: addToTicket((l[selected] ?? base).drafts, item, mods, qty, note) } }));
  };

  const setDrafts = (key: string, fn: (d: TicketLine[]) => TicketLine[]) => setLocal((l) => (l[key] ? { ...l, [key]: { ...l[key], drafts: fn(l[key].drafts) } } : l));

  const patchServerLine = useMutation({
    mutationFn: async ({ line, qty }: { line: TicketLine; qty: number | null }) => {
      if (!serverId || !line.id) return null;
      return qty === null ? posApi.deleteLine(serverId, line.id) : posApi.patchLine(serverId, line.id, { quantity: qty });
    },
    onSuccess: (o) => o && qc.setQueryData(qk5.order(o.id), o),
    meta: { errorTitle: "Item not changed" },
  });

  const onQty = (line: TicketLine, qty: number) => {
    if (!selected) return;
    if (line.id) return patchServerLine.mutate({ line, qty });
    setDrafts(selected, (d) => d.map((x) => (x.key === line.key ? { ...x, qty } : x)));
  };
  const onRemove = (line: TicketLine) => {
    if (!selected) return;
    if (line.id) return patchServerLine.mutate({ line, qty: null });
    setDrafts(selected, (d) => d.filter((x) => x.key !== line.key));
  };

  /**
   * Put the ticket on the server: create the order with our own id (so a replay
   * is harmless) or add the drafts to it, and send them to the kitchen when asked.
   * Offline, the same requests go to the outbox with their Idempotency-Keys.
   */
  const push = async (key: string, send: boolean): Promise<{ order: PosOrder | null; queued: boolean }> => {
    const lt = local[key] ?? ensureLocal(key);
    if (!lt || !outletId) return { order: null, queued: false };
    const drafts = lt.drafts;
    const invalidate = [["pos"], ["kds"]];
    let order: PosOrder | null = null;
    let queued = false;
    if (!lt.serverId) {
      const r = await deskAction<PosOrder>({
        kind: "pos-order",
        title: `${outlet?.name ?? "Order"}: ${ticketTitle(lt)}`,
        subtitle: `${drafts.reduce((s, l) => s + l.qty, 0)} items${send ? ", to the kitchen" : ""}`,
        method: "POST",
        path: "/pos/orders",
        body: { id: lt.key, outletId, tableLabel: tableLabelFor(lt.kind, lt.label) ?? undefined, reservationId: lt.reservationId ?? undefined, guestName: lt.kind === "TAB" ? lt.label : (lt.guestName ?? undefined), covers: lt.covers, lines: drafts.map(toLineInput), send },
        offlineAllowed: offlineOk,
        invalidate,
      });
      queued = r.queued;
      if (!r.queued) order = r.result;
    } else {
      if (drafts.length) {
        const r = await deskAction<PosOrder>({ kind: "pos-order", title: `${outlet?.name ?? "Order"}: ${ticketTitle(lt)}`, subtitle: `${drafts.reduce((s, l) => s + l.qty, 0)} more items`, method: "POST", path: `/pos/orders/${lt.serverId}/lines`, body: { lines: drafts.map(toLineInput) }, offlineAllowed: offlineOk, invalidate });
        queued = r.queued;
        if (!r.queued) order = r.result;
      }
      const hasPending = (order ?? orderQ.data)?.lines.some((l) => l.status === "PENDING") || (queued && drafts.length > 0);
      if (send && (hasPending || drafts.length)) {
        const r = await deskAction<{ order: PosOrder }>({ kind: "pos-order", title: `Send ${ticketTitle(lt)} to the kitchen`, method: "POST", path: `/pos/orders/${lt.serverId}/send`, body: {}, offlineAllowed: offlineOk, invalidate });
        queued = queued || r.queued;
        if (!r.queued) order = r.result.order;
      }
    }
    setLocal((l) => ({ ...l, [key]: { ...lt, ...(l[key] ?? {}), serverId: lt.key === key && !lt.serverId ? lt.key : lt.serverId, drafts: [], queued: queued ? [...(l[key]?.queued ?? []), ...drafts.map((d) => ({ ...d, state: send ? ("SENT" as const) : d.state }))] : [] } }));
    if (order) {
      qc.setQueryData(qk5.order(order.id), order);
      void qc.invalidateQueries({ queryKey: ["pos", "orders"] });
    }
    return { order, queued };
  };

  const sendM = useMutation({
    mutationFn: async () => (selected ? push(selected, true) : null),
    onSuccess: (r) => {
      if (!r) return;
      if (r.queued) toast.warning("Saved on this tablet", "No connection: the order goes to the kitchen as soon as the line is back.");
      else toast.success("Sent to the kitchen", ticket ? ticketTitle(ticket) : undefined);
    },
    meta: { errorTitle: "Not sent", silentCodes: ["NOTHING_TO_SEND"] },
  });

  const openSettle = useMutation({
    mutationFn: async () => {
      if (!selected) return null;
      if (!net.online) throw new Error("Settling a bill needs a connection. The order is safe on this tablet.");
      const r = await push(selected, false);
      const id = r.order?.id ?? local[selected]?.serverId ?? serverId;
      if (!id) throw new Error("This ticket is not on the server yet.");
      return r.order ?? (await posApi.order(id));
    },
    onSuccess: (o) => {
      if (!o) return;
      qc.setQueryData(qk5.order(o.id), o);
      setSettleErr(null);
      setSettle({ order: o });
    },
    meta: { errorTitle: "Can't settle yet" },
  });

  const doSettle = useMutation({
    mutationFn: async ({ order, input }: { order: PosOrder; input: SettleInput; changeKobo: number | null }) => posApi.settle(order.id, input),
    onSuccess: (result, v) => {
      setSettle(null);
      setEven(null);
      setDone({ result, changeKobo: v.changeKobo });
      setLocal((l) => {
        const next = { ...l };
        delete next[v.order.id];
        return next;
      });
      setSelected(null);
      void qc.invalidateQueries({ queryKey: ["pos"] });
      void qc.invalidateQueries({ queryKey: qk2.foliosAll });
      void qc.invalidateQueries({ queryKey: ["reservations"] });
      void qc.invalidateQueries({ queryKey: qk2.shiftsAll });
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "SHIFT_REQUIRED") void qc.invalidateQueries({ queryKey: qk2.shiftCurrent });
      if (isApiError(e) && e.code === "ROOM_CHARGE_MISMATCH") setSettleErr(`The name doesn't match the guest in that room (${String(e.details?.expectedName ?? "")}). Check with the guest, or ask a manager.`);
      else setSettleErr(errorMessage(e));
    },
    meta: { silent: true },
  });

  const openShift = useMutation({
    mutationFn: (floatKobo: number) => shiftsApi.open(floatKobo),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk2.shiftsAll });
      toast.success("Shift opened", "Cash, transfer and POS takings now count against your till.");
    },
    meta: { errorTitle: "Shift not opened" },
  });

  const voidM = useMutation({
    mutationFn: (p: { reason: string; approverId?: string; pin?: string }) => {
      if (!serverId || !voidFor?.id) throw new Error("Only items the kitchen has seen can be voided here");
      return posApi.voidLine(serverId, voidFor.id, { reason: p.reason, approval: p.approverId && p.pin ? { approverId: p.approverId, pin: p.pin } : undefined });
    },
    onSuccess: (o) => {
      qc.setQueryData(qk5.order(o.id), o);
      void qc.invalidateQueries({ queryKey: ["kds"] });
      toast.success("Item voided", "Recorded with your name and the reason.");
      setVoidFor(null);
      setVoidPin(false);
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "APPROVAL_REQUIRED") {
        setVoidPin(true);
        setVoidErr("This void needs a manager's PIN.");
      } else if (isApiError(e) && (e.code === "APPROVAL_INVALID" || e.code === "APPROVAL_LOCKED")) setVoidErr(e.message);
      else setVoidErr(errorMessage(e));
    },
    meta: { silent: true },
  });

  const splitM = useMutation({
    mutationFn: async (r: SplitResult) => {
      if (!selected) return null;
      const pushed = await push(selected, false);
      const order = pushed.order ?? (serverId ? await posApi.order(serverId) : null);
      if (!order) throw new Error("This ticket is not on the server yet");
      if (r.mode === "EVEN") return { even: { order, parts: r.checks.map((c) => c.amountKobo) } };
      // by item: every check after the first becomes its own order
      const keyToId = new Map(order.lines.map((l) => [l.id, l.id])); // the sheet opened on server lines
      let latest = order;
      const made: PosOrder[] = [];
      for (const c of r.checks.slice(1)) {
        const lines = (c.lineKeys ?? []).map((k) => keyToId.get(k)).filter(Boolean).map((id) => ({ lineId: id!, quantity: latest.lines.find((l) => l.id === id)?.quantity ?? 1 }));
        if (!lines.length) continue;
        const res = await posApi.split(latest.id, lines);
        latest = res.order;
        made.push(res.newOrder);
      }
      return { made, latest };
    },
    onSuccess: (r) => {
      setSplitOpen(false);
      if (!r) return;
      if ("even" in r && r.even) {
        setEven(r.even);
        return;
      }
      if ("made" in r && r.latest) {
        qc.setQueryData(qk5.order(r.latest.id), r.latest);
        void qc.invalidateQueries({ queryKey: ["pos", "orders"] });
        toast.success(`Split into ${(r.made?.length ?? 0) + 1} checks`, "Each check is its own ticket now. Settle them one by one.");
      }
    },
    meta: { errorTitle: "Not split" },
  });

  const openSplit = useMutation({
    mutationFn: async () => {
      if (!selected) return null;
      if (!net.online) throw new Error("Splitting a bill needs a connection.");
      const r = await push(selected, false);
      if (r.order) qc.setQueryData(qk5.order(r.order.id), r.order);
      return true;
    },
    onSuccess: (ok) => ok && setSplitOpen(true),
    meta: { errorTitle: "Can't split yet" },
  });

  const eightySix = useMutation({
    mutationFn: (item: PosItem) => posApi.setAvailability(item.id, !item.available),
    onSuccess: (it) => {
      void qc.invalidateQueries({ queryKey: ["pos", "menu"] });
      toast.info(it.available ? `${it.name} is back on` : `${it.name} marked sold out`, it.available ? undefined : "It shows as 86 on every terminal.");
    },
    meta: { errorTitle: "Not changed" },
  });

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const l of ticket?.lines ?? []) if (l.state !== "VOID") c[l.itemId] = (c[l.itemId] ?? 0) + l.qty;
    return c;
  }, [ticket]);

  const settleAmount = settle?.order.totals.dueKobo ?? 0;
  const onSettle = (p: SettlePayload) => {
    if (!settle) return;
    const order = settle.order;
    setSettleErr(null);
    let input: SettleInput;
    if (p.method === "ROOM") {
      const g = guests.find((x) => x.reservationId === p.reservationId);
      input = { roomCharge: { reservationId: p.reservationId!, guestName: g?.guestName, signatureDataUrl: p.signature ?? undefined } };
    } else if (p.method === "CITY_LEDGER") input = { cityLedger: { corporateAccountId: p.corporateAccountId! } };
    else input = { payments: [{ method: p.method, amountKobo: order.totals.dueKobo, reference: p.reference }] };
    const change = p.method === "CASH" && p.tenderedKobo ? Math.max(0, p.tenderedKobo - order.totals.dueKobo) : null;
    doSettle.mutate({ order, input, changeKobo: change });
  };

  const drafts = ticket ? draftCount(ticket) : 0;
  const total = ticket ? totalsFor(ticket, tax).totalKobo : 0;
  const canSettle = can("pos.settle");
  const loading = outlets.isLoading || (!!outletId && menuQ.isLoading);

  if (outlets.data && !sellable.length)
    return (
      <div className="grid min-h-dvh place-items-center px-6 text-center">
        <div>
          <Storefront size={40} weight="thin" className="mx-auto text-ink-faint" />
          <p className="display-sm mt-3 text-[22px]">No outlets yet</p>
          <p className="mt-1 text-[14px] text-ink-muted">Add a restaurant or a bar under Menu & outlets, then come back to the till.</p>
          <ButtonLink href="/pos/menu" className="mt-4">
            Set up outlets
          </ButtonLink>
        </div>
      </div>
    );

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      {/* top bar */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-2 sm:gap-3 sm:px-3">
        <Link href="/today" className="flex h-10 items-center gap-1.5 rounded-md px-2 text-ink-muted hover:bg-surface-2 hover:text-ink" aria-label="Back to the admin">
          <ArrowLeft size={16} />
          <LogoMark size={22} />
        </Link>
        <div role="radiogroup" aria-label="Outlet" className="scrollbar-thin flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {sellable.map((o) => (
            <button
              key={o.id}
              role="radio"
              aria-checked={o.id === outletId}
              onClick={() => setOutletId(o.id)}
              className={cn(
                "inline-flex h-10 shrink-0 items-center gap-2 rounded-md px-3.5 text-[14px] font-medium transition-colors",
                o.id === outletId ? "bg-ink text-paper" : "text-ink-muted hover:bg-surface-2 hover:text-ink",
              )}
              data-testid={`outlet-${o.code}`}
            >
              {o.name}
              {o.openOrders > 0 && <span className={cn("font-mono text-[11px]", o.id === outletId ? "text-paper/70" : "text-ink-faint")}>{o.openOrders}</span>}
            </button>
          ))}
        </div>
        <span className="hidden truncate text-[12px] text-ink-faint xl:inline">{scope.current?.name}</span>
        {!net.online && (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-[color-mix(in_oklab,var(--ochre)_45%,transparent)] bg-ochre-wash px-2.5 text-[12px] font-medium text-ochre">
            <WifiSlash size={14} weight="bold" /> <span className="hidden sm:inline">Offline</span>
          </span>
        )}
        <OutboxChip />
        <ShiftChip className="hidden md:inline-flex" />
        {can("kds.view") && (
          <Link href="/kds" className="hidden h-10 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-ink-muted hover:bg-surface-2 hover:text-ink sm:inline-flex">
            <CookingPot size={17} weight="duotone" /> Kitchen
          </Link>
        )}
        <Clock />
      </header>

      <div className="flex min-h-0 flex-1">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-paper" aria-label="Menu">
          {loading || !menu ? (
            <div className="grid flex-1 grid-cols-[repeat(auto-fill,minmax(140px,1fr))] content-start gap-2.5 p-4">
              {Array.from({ length: 16 }, (_, i) => (
                <Skeleton key={i} className="h-[92px] rounded-md" />
              ))}
            </div>
          ) : (
            <>
              <div className="hidden min-h-0 min-w-0 flex-1 md:flex">
                <MenuBoard menu={menu} counts={counts} onPick={(i) => pick(i)} onOptions={setOptionsFor} disabled={!can("pos.order")} />
              </div>
              <div className="flex min-h-0 min-w-0 flex-1 md:hidden">
                <MenuBoard menu={menu} counts={counts} onPick={(i) => pick(i)} onOptions={setOptionsFor} compact disabled={!can("pos.order")} />
              </div>
            </>
          )}
        </main>
        <TicketRail
          className="hidden w-[340px] shrink-0 border-l border-line md:flex lg:w-[380px]"
          ticket={ticket}
          open={openTickets}
          tax={tax}
          onSelect={setSelected}
          onNew={() => setNewOpen(true)}
          onQty={onQty}
          onRemove={onRemove}
          onNote={setNoteFor}
          onVoid={(l) => {
            setVoidErr(null);
            setVoidPin(lineTotal({ ...l, state: "SENT" }) >= VOID_PIN_KOBO);
            setVoidFor(l);
          }}
          onSend={() => sendM.mutate()}
          onSplit={() => openSplit.mutate()}
          onSettle={() => openSettle.mutate()}
          sending={sendM.isPending || openSettle.isPending}
          offline={!net.online}
          canSettle={canSettle}
        />
      </div>

      {/* phone: the ticket as a bottom bar */}
      <button
        type="button"
        onClick={() => setTicketSheet(true)}
        className="flex h-16 shrink-0 items-center gap-3 border-t border-line bg-ink px-4 pb-[env(safe-area-inset-bottom)] text-left text-paper md:hidden"
        data-testid="pos-ticket-bar"
      >
        <ReceiptIcon size={20} weight="duotone" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-medium">{ticket ? ticketTitle(ticket) : openTickets.length ? "Pick a ticket" : "No ticket open"}</span>
          <span className="block text-[12px] text-paper/70">{ticket ? `${ticket.lines.filter((l) => l.state !== "VOID").reduce((s, l) => s + l.qty, 0)} items${drafts ? `, ${drafts} not sent` : ""}` : `${openTickets.length} open`}</span>
        </span>
        <span className="font-mono text-[18px]">{ticket ? naira(total) : ""}</span>
        <CaretUp size={16} />
      </button>
      <Sheet open={ticketSheet} onOpenChange={setTicketSheet} title={ticket ? ticketTitle(ticket) : "Tickets"} className="p-0 md:hidden">
        <TicketRail
          className="-mx-6 -my-5 min-h-[70dvh]"
          ticket={ticket}
          open={openTickets}
          tax={tax}
          onSelect={setSelected}
          onNew={() => {
            setTicketSheet(false);
            setNewOpen(true);
          }}
          onQty={onQty}
          onRemove={onRemove}
          onNote={setNoteFor}
          onVoid={(l) => {
            setVoidErr(null);
            setVoidPin(lineTotal({ ...l, state: "SENT" }) >= VOID_PIN_KOBO);
            setVoidFor(l);
          }}
          onSend={() => sendM.mutate()}
          onSplit={() => {
            setTicketSheet(false);
            openSplit.mutate();
          }}
          onSettle={() => {
            setTicketSheet(false);
            openSettle.mutate();
          }}
          sending={sendM.isPending || openSettle.isPending}
          offline={!net.online}
          canSettle={canSettle}
        />
      </Sheet>

      <NewTicketSheet
        open={newOpen}
        onOpenChange={(o) => {
          setNewOpen(o);
          if (!o) setPendingPick(null);
        }}
        onCreate={createTicket}
        guests={guests}
        defaultKind={outlet?.type === "ROOM_SERVICE" ? "ROOM" : outlet?.type === "BAR" || outlet?.type === "POOL_BAR" ? "TAB" : "TABLE"}
      />
      <ModifiersSheet item={optionsFor} onOpenChange={(o) => !o && setOptionsFor(null)} onAdd={(it, mods, qty, note) => pick(it, mods, qty, note)} onEightySix={can("pos.order") ? (it) => { eightySix.mutate(it); setOptionsFor(null); } : undefined} />
      <NoteDialog
        line={noteFor}
        onOpenChange={(o) => !o && setNoteFor(null)}
        onSave={(note) => {
          if (!selected || !noteFor) return;
          if (noteFor.id && serverId) void posApi.patchLine(serverId, noteFor.id, { note }).then((o) => qc.setQueryData(qk5.order(o.id), o));
          else setDrafts(selected, (d) => d.map((x) => (x.key === noteFor.key ? { ...x, note: note || undefined } : x)));
        }}
      />
      <VoidLineDialog
        line={voidFor}
        onOpenChange={(o) => !o && setVoidFor(null)}
        needsPin={voidPin}
        approvers={approvers.data ?? []}
        onVoid={(p) => voidM.mutate(p)}
        busy={voidM.isPending}
        error={voidErr}
      />
      <SplitSheet ticket={ticket} totalKobo={total} tax={tax} open={splitOpen} onOpenChange={setSplitOpen} onDone={(r) => splitM.mutate(r)} />
      <SettleSheet
        open={!!settle}
        onOpenChange={(o) => !o && setSettle(null)}
        amountKobo={settleAmount}
        label={ticket ? `${outlet?.name ?? ""} · ${ticketTitle(ticket)}${settle?.order.number ? ` · ${settle.order.number}` : ""}` : ""}
        guests={guests}
        companies={(companies.data ?? []).map((c) => ({ id: c.id, name: c.name, availableKobo: c.availableCreditKobo }))}
        presetReservationId={settle?.order.reservation?.id ?? null}
        shiftOpen={shiftOpen}
        canOpenShift={can("shifts.own")}
        onOpenShift={(f) => openShift.mutate(f)}
        openingShift={openShift.isPending}
        onSettle={onSettle}
        busy={doSettle.isPending}
        allowed={[
          ...(can("payments.take") || can("pos.settle") ? (["CASH", "TRANSFER", "POS"] as const) : []),
          ...(outlet?.allowRoomCharge !== false ? (["ROOM"] as const) : []),
          ...(outlet?.allowCityLedger && has("promotions") && can("corporate.view") ? (["CITY_LEDGER"] as const) : []),
        ]}
        error={settleErr}
      />
      <EvenSettle
        state={even}
        onClose={() => setEven(null)}
        shiftOpen={shiftOpen}
        busy={doSettle.isPending}
        error={settleErr}
        onSubmit={(payments) => even && doSettle.mutate({ order: even.order, input: { payments }, changeKobo: null })}
      />
      <DoneDialog done={done} onClose={() => setDone(null)} onNew={() => { setDone(null); setNewOpen(true); }} />
    </div>
  );
}

function Clock() {
  const now = useNow(15_000);
  return (
    <span className="hidden font-mono text-[15px] tabular-nums text-ink sm:inline" suppressHydrationWarning>
      {new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Africa/Lagos" }).format(now)}
    </span>
  );
}

/** Even split: one tender per guest, settled together (tenders must add up to the bill). */
function EvenSettle({
  state,
  onClose,
  onSubmit,
  shiftOpen,
  busy,
  error,
}: {
  state: { order: PosOrder; parts: number[] } | null;
  onClose: () => void;
  onSubmit: (p: { method: "CASH" | "TRANSFER" | "POS"; amountKobo: number }[]) => void;
  shiftOpen: boolean;
  busy?: boolean;
  error?: string | null;
}) {
  const [methods, setMethods] = useState<("CASH" | "TRANSFER" | "POS")[]>([]);
  const n = state?.parts.length ?? 0;
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one tender per check, cash by default
    setMethods(Array.from({ length: n }, () => "CASH"));
  }, [n]);
  if (!state) return null;
  const due = state.order.totals.dueKobo;
  // the parts were split from the ticket; true them up to the amount the server says is due
  const parts = [...state.parts];
  const diff = due - parts.reduce((s, x) => s + x, 0);
  parts[0] += diff;
  return (
    <Sheet
      open
      onOpenChange={(o) => !o && onClose()}
      eyebrow={`${state.order.number} · split ${n} ways`}
      title={`${naira(due)} in ${n} payments`}
      width="max-w-lg"
      footer={
        <Button size="lg" className="h-14 w-full" disabled={!shiftOpen} loading={busy} onClick={() => onSubmit(parts.map((a, i) => ({ method: methods[i] ?? "CASH", amountKobo: a })))} data-testid="even-settle">
          {shiftOpen ? `Take ${n} payments` : "Open your shift to take payments"}
        </Button>
      }
    >
      <ol className="flex flex-col gap-2">
        {parts.map((a, i) => (
          <li key={i} className="flex items-center gap-3 rounded-md border border-line bg-paper px-3 py-2.5">
            <span className="eyebrow w-16 text-[10px]">Guest {i + 1}</span>
            <span className="flex-1 font-mono text-[18px] text-ink">{naira(a)}</span>
            <div className="inline-flex rounded-md border border-line-strong p-0.5">
              {(["CASH", "POS", "TRANSFER"] as const).map((m) => (
                <button key={m} type="button" aria-pressed={methods[i] === m} onClick={() => setMethods((x) => x.map((v, j) => (j === i ? m : v)))} className={cn("h-9 rounded-sm px-2.5 text-[12.5px] font-medium", methods[i] === m ? "bg-ink text-paper" : "text-ink-muted")}>
                  {m === "TRANSFER" ? "Transfer" : m === "POS" ? "POS" : "Cash"}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-[12.5px] text-ink-muted">One receipt per payment. Each counts against your shift under its method.</p>
      {error && <p role="alert" className="mt-3 text-[13px] text-danger">{error}</p>}
    </Sheet>
  );
}

function DoneDialog({ done, onClose, onNew }: { done: { result: SettleResult; changeKobo: number | null } | null; onClose: () => void; onNew: () => void }) {
  if (!done) return null;
  const o = done.result.order;
  const room = o.settlement === "ROOM_CHARGE";
  const receipt = done.result.receipts[0];
  return (
    <Dialog
      open
      onOpenChange={(v) => !v && onClose()}
      eyebrow={<span className="inline-flex items-center gap-1.5 text-palm"><CheckCircle size={14} weight="fill" /> {room ? "Charged to the room" : o.settlement === "CITY_LEDGER" ? "On the company account" : "Paid"}</span>}
      title={<span className="font-mono">{naira(o.totals.totalKobo)}</span>}
      description={
        room
          ? `${o.number} is on ${o.reservation?.guestName ?? "the guest"}'s folio${o.room ? `, room ${o.room.number}` : ""}. It appears as an extra with the outlet's name.`
          : `${o.number} is settled${receipt ? ` on receipt ${receipt.number}` : ""}.`
      }
      footer={
        <>
          {receipt && (
            <ButtonLink href={`/print/receipt/${receipt.id}`} variant="secondary" target="_blank" rel="noreferrer">
              <Printer size={15} /> Print receipt
            </ButtonLink>
          )}
          {room && o.folioId && (
            <ButtonLink href={`/folios/${o.folioId}`} variant="secondary" target="_blank" rel="noreferrer">
              Open the folio
            </ButtonLink>
          )}
          <Button onClick={onNew} data-testid="done-new">New ticket</Button>
        </>
      }
    >
      {done.changeKobo ? (
        <p className="flex items-baseline justify-between rounded-md border border-[color-mix(in_oklab,var(--palm)_35%,transparent)] bg-palm-wash px-4 py-3">
          <span className="text-[14px] text-ink">Change to give</span>
          <span className="font-mono text-[30px] tracking-tight text-palm">{naira(done.changeKobo)}</span>
        </p>
      ) : null}
      <ul className="mt-3 flex flex-col gap-1 font-mono text-[12.5px] text-ink-muted">
        {o.lines.filter((l) => l.status !== "VOIDED").map((l) => (
          <li key={l.id} className="flex justify-between gap-3">
            <span className="truncate">
              {l.quantity} × {l.name}
            </span>
            <span className="text-ink">{naira(l.lineTotalKobo)}</span>
          </li>
        ))}
      </ul>
    </Dialog>
  );
}
