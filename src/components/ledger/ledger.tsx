"use client";

import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowsOutLineHorizontal,
  Check,
  Crown,
  LockSimple,
  X,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/api/client";
import { toast } from "@/lib/store";
import { naira } from "@/lib/format";
import {
  DAY_MS,
  addDays,
  dayKeyOf,
  dayRange,
  dayStartMs,
  formatDay,
  hhmmToMinutes,
  isWeekend,
  lagosHHMM,
  lagosIso,
  stayWindow,
  type DayKey,
} from "@/lib/dates";
import { STAY_STATUS } from "@/lib/catalog-m2";
import { ROOM_STATUS } from "@/lib/catalog";
import { StatusSwatch } from "@/components/keyrack/status-swatch";
import {
  GROUP_H,
  HEADER_H,
  ROW_H,
  buildRows,
  firstRowAt,
  freeByNight,
  isActive,
  shiftIso,
  validatePlacement,
  xOf,
  type GroupBy,
  type LedgerChange,
  type LedgerRoom,
  type LedgerRow,
  type LedgerStay,
  type Verdict,
} from "./model";

export interface LedgerHandle {
  scrollToDay: (key: DayKey, behavior?: ScrollBehavior) => void;
  undo: () => void;
  canUndo: () => boolean;
}

export interface LedgerProps {
  rooms: LedgerRoom[];
  stays: LedgerStay[];
  from: DayKey;
  days: number;
  dayWidth: number;
  groupBy: GroupBy;
  checkInTime?: string;
  checkOutTime?: string;
  editable?: boolean;
  onChange?: (c: LedgerChange) => Promise<unknown>;
  onCreate?: (p: { roomId: string; roomTypeId: string; arrival: DayKey; departure: DayKey }) => void;
  onOpen?: (stay: LedgerStay) => void;
  className?: string;
  style?: React.CSSProperties;
  onUndoChange?: (n: number) => void;
  /** day scrolled into view on mount (default today) */
  initialDay?: DayKey;
}

interface Placement {
  roomId: string | null;
  arrivalAt: string;
  departureAt: string;
}

interface Ghost extends Placement {
  stayId: string | null;
  roomTypeId: string;
  mode: "move" | "extend" | "create";
  verdict: Verdict;
  label: string;
}

interface DragState {
  mode: "move" | "extend" | "create";
  stay: LedgerStay | null;
  startX: number;
  startY: number;
  pointerId: number;
  moved: boolean;
  anchorDay?: number;
  roomId?: string;
  roomTypeId?: string;
}

const OVERSCAN_PX = 320;
const MIN_BAR_PX = 6;

export const Ledger = forwardRef<LedgerHandle, LedgerProps>(function Ledger(
  {
    rooms,
    stays,
    from,
    days,
    dayWidth: dw,
    groupBy,
    checkInTime = "14:00",
    checkOutTime = "12:00",
    editable = true,
    onChange,
    onCreate,
    onOpen,
    className,
    style,
    onUndoChange,
    initialDay,
  },
  ref,
) {
  const scroller = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ top: 0, left: 0, w: 1200, h: 700 });
  const [now, setNow] = useState(() => Date.now());
  const [overrides, setOverrides] = useState<Map<string, Placement>>(new Map());
  const [ghost, setGhost] = useState<Ghost | null>(null);
  const [kb, setKb] = useState<(Placement & { stayId: string }) | null>(null);
  const [hover, setHover] = useState<{ stay: LedgerStay; rect: DOMRect } | null>(null);
  const [announce, setAnnounce] = useState("");
  const drag = useRef<DragState | null>(null);
  const undoRef = useRef<() => Promise<void>>(async () => {});
  // Window listeners are added once per drag; they call the latest handlers through a ref.
  const handlers = useRef({
    move: (() => {}) as (e: PointerEvent) => void,
    up: (() => {}) as (e: PointerEvent) => void,
    cancel: () => {},
  });
  const [stable] = useState(() => ({
    move: (e: PointerEvent) => handlers.current.move(e),
    up: (e: PointerEvent) => handlers.current.up(e),
    cancel: () => handlers.current.cancel(),
  }));
  const suppressClick = useRef(false);
  const undoStack = useRef<{ stay: LedgerStay; prev: Placement; next: Placement; kind: LedgerChange["kind"] }[]>([]);
  const barRefs = useRef(new Map<string, HTMLButtonElement>());

  const labelW = view.w < 640 ? 84 : 164;
  const trackW = days * dw;
  const totalW = labelW + trackW;

  /* ---------------- data ---------------- */

  const effective = useMemo(
    () =>
      stays
        .filter((s) => s.status !== "CANCELLED")
        .map((s) => {
          const o = overrides.get(s.id);
          return o ? { ...s, ...o } : s;
        }),
    [stays, overrides],
  );
  const roomMap = useMemo(() => new Map(rooms.map((r) => [r.id, r])), [rooms]);
  const typeNames = useMemo(() => new Map(rooms.map((r) => [r.roomTypeId, r.roomTypeName])), [rooms]);
  const staysByRoom = useMemo(() => {
    const m = new Map<string, LedgerStay[]>();
    for (const s of effective) {
      if (!s.roomId) continue;
      const list = m.get(s.roomId) ?? [];
      list.push(s);
      m.set(s.roomId, list);
    }
    for (const list of m.values()) list.sort((a, b) => +new Date(a.arrivalAt) - +new Date(b.arrivalAt));
    return m;
  }, [effective]);
  const unassigned = useMemo(() => effective.filter((s) => !s.roomId && isActive(s.status)), [effective]);
  const { rows, height: bodyH, laneOf } = useMemo(
    () => buildRows(rooms, unassigned, groupBy, typeNames),
    [rooms, unassigned, groupBy, typeNames],
  );
  const roomRows = useMemo(() => rows.filter((r): r is Extract<LedgerRow, { kind: "room" }> => r.kind === "room"), [rows]);
  const rowOfRoom = useMemo(() => new Map(roomRows.map((r) => [r.room.id, r])), [roomRows]);
  const dayKeys = useMemo(() => dayRange(from, days), [from, days]);
  const free = useMemo(() => freeByNight(dayKeys, rooms, effective), [dayKeys, rooms, effective]);
  const totalSellable = rooms.filter((r) => r.status !== "OUT_OF_ORDER").length;

  /* ---------------- viewport ---------------- */

  const syncView = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    setView({ top: el.scrollTop, left: el.scrollLeft, w: el.clientWidth, h: el.clientHeight });
  }, []);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el) return;
    syncView();
    const ro = new ResizeObserver(syncView);
    ro.observe(el);
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(syncView);
      setHover(null);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      ro.disconnect();
      el.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [syncView]);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const scrollToDay = useCallback(
    (key: DayKey, behavior: ScrollBehavior = "smooth") => {
      const el = scroller.current;
      if (!el) return;
      const x = xOf(dayStartMs(key), from, dw);
      el.scrollTo({ left: Math.max(0, x - dw * 1.5), behavior });
    },
    [from, dw],
  );

  // open on the requested day (default today) the first time the chart has a size
  const didInitialScroll = useRef(false);
  useLayoutEffect(() => {
    if (didInitialScroll.current || !scroller.current) return;
    didInitialScroll.current = true;
    scrollToDay(initialDay ?? dayKeyOf(Date.now()), "auto");
  }, [scrollToDay, initialDay]);

  /* ---------------- commits + undo ---------------- */

  const setOverride = (id: string, p: Placement | null) =>
    setOverrides((prev) => {
      const next = new Map(prev);
      if (p) next.set(id, p);
      else next.delete(id);
      return next;
    });

  const describe = useCallback(
    (p: Placement) => {
      const room = p.roomId ? roomMap.get(p.roomId) : null;
      return `${room ? `room ${room.number}` : "unassigned"}, ${stayWindow(p.arrivalAt, p.departureAt)}`;
    },
    [roomMap],
  );

  const commit = useCallback(
    async (stay: LedgerStay, next: Placement, kind: LedgerChange["kind"], isUndo = false) => {
      if (!onChange) return;
      const prev: Placement = { roomId: stay.roomId, arrivalAt: stay.arrivalAt, departureAt: stay.departureAt };
      setOverride(stay.id, next);
      try {
        await onChange({ stay, ...next, kind });
        if (!isUndo) {
          undoStack.current.push({ stay: { ...stay, ...next }, prev, next, kind });
          if (undoStack.current.length > 20) undoStack.current.shift();
          onUndoChange?.(undoStack.current.length);
          toast.success(
            `${stay.code} ${kind === "extend" ? "updated" : kind === "assign" ? "placed" : "moved"}`,
            `${stay.guestName}, ${describe(next)}`,
            { label: "Undo", onClick: () => void undoRef.current() },
          );
        } else {
          toast.info(`${stay.code} restored`, describe(next));
        }
        setAnnounce(`${stay.code} saved: ${describe(next)}`);
      } catch (e) {
        toast.error(`${stay.code} not moved`, errorMessage(e));
        setAnnounce(`${stay.code} was not moved. ${errorMessage(e)}`);
      } finally {
        setOverride(stay.id, null);
      }
    },
    [onChange, describe, onUndoChange],
  );

  const undo = useCallback(async () => {
    const last = undoStack.current.pop();
    onUndoChange?.(undoStack.current.length);
    if (!last) return;
    const current = stays.find((s) => s.id === last.stay.id) ?? last.stay;
    await commit(current, last.prev, last.kind, true);
  }, [commit, stays, onUndoChange]);
  useEffect(() => {
    undoRef.current = undo;
  }, [undo]);

  useImperativeHandle(ref, () => ({ scrollToDay, undo: () => void undo(), canUndo: () => undoStack.current.length > 0 }), [scrollToDay, undo]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && !e.shiftKey && undoStack.current.length) {
        e.preventDefault();
        void undoRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ---------------- pointer geometry ---------------- */

  const toContent = (clientX: number, clientY: number) => {
    const el = scroller.current!;
    const r = el.getBoundingClientRect();
    return {
      x: clientX - r.left + el.scrollLeft - labelW,
      y: clientY - r.top + el.scrollTop - HEADER_H,
    };
  };

  const roomRowAt = (y: number) => {
    if (y < 0 || !rows.length) return null;
    const row = rows[firstRowAt(rows, y)];
    return row && row.kind === "room" && y >= row.y && y < row.y + row.h ? row : null;
  };

  const place = useCallback(
    (stay: LedgerStay | undefined, p: Placement): Verdict =>
      validatePlacement({ stay, ...p, rooms: roomMap, staysByRoom, nowMs: now }),
    [roomMap, staysByRoom, now],
  );

  const stepMs = (stay: LedgerStay | null) => (stay?.stayType === "DAY_USE" ? 30 * 60_000 : DAY_MS);

  const computeGhost = (d: DragState, clientX: number, clientY: number): Ghost | null => {
    const c = toContent(clientX, clientY);
    if (d.mode === "create") {
      const day = Math.floor(c.x / dw);
      const a = Math.min(d.anchorDay!, day);
      const b = Math.max(d.anchorDay!, day) + 1;
      const arrivalAt = lagosIso(addDays(from, a), checkInTime);
      const departureAt = lagosIso(addDays(from, b), checkOutTime);
      const p = { roomId: d.roomId!, arrivalAt, departureAt };
      const nights = b - a;
      return {
        ...p,
        stayId: null,
        roomTypeId: d.roomTypeId!,
        mode: "create",
        verdict: place(undefined, p),
        label: `${nights} ${nights === 1 ? "night" : "nights"}`,
      };
    }
    const stay = d.stay!;
    const step = stepMs(stay);
    const pxPerStep = (step / DAY_MS) * dw;
    const steps = Math.round((clientX - d.startX) / pxPerStep);
    if (d.mode === "extend") {
      const minLen = stay.stayType === "DAY_USE" ? 2 * 3600_000 : DAY_MS - (hhmmToMinutes(checkInTime) - hhmmToMinutes(checkOutTime)) * 60_000;
      let dep = +new Date(stay.departureAt) + steps * step;
      dep = Math.max(dep, +new Date(stay.arrivalAt) + Math.max(minLen, step / 2));
      const p = { roomId: stay.roomId, arrivalAt: stay.arrivalAt, departureAt: new Date(dep).toISOString() };
      return { ...p, stayId: stay.id, roomTypeId: stay.roomTypeId, mode: "extend", verdict: place(stay, p), label: lengthLabel(stay, p) };
    }
    // move
    const row = roomRowAt(c.y);
    const moveDates = stay.status !== "CHECKED_IN";
    const delta = moveDates ? steps * step : 0;
    const p = {
      roomId: row ? row.room.id : stay.roomId,
      arrivalAt: shiftIso(stay.arrivalAt, delta),
      departureAt: shiftIso(stay.departureAt, delta),
    };
    return { ...p, stayId: stay.id, roomTypeId: stay.roomTypeId, mode: "move", verdict: place(stay, p), label: describe(p) };
  };

  const endDrag = () => {
    window.removeEventListener("pointermove", stable.move);
    window.removeEventListener("pointerup", stable.up);
    window.removeEventListener("pointercancel", stable.cancel);
    drag.current = null;
    setGhost(null);
  };

  function onWindowMove(e: PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return;
    d.moved = true;
    setHover(null);
    const g = computeGhost(d, e.clientX, e.clientY);
    setGhost(g);
    autoScroll(e.clientX, e.clientY);
  }

  function onWindowUp(e: PointerEvent) {
    const d = drag.current;
    if (!d || e.pointerId !== d.pointerId) return;
    suppressClick.current = true;
    window.setTimeout(() => (suppressClick.current = false), 0);
    if (!d.moved) {
      if (d.mode === "create") {
        const day = d.anchorDay!;
        const k = addDays(from, day);
        if (k >= dayKeyOf(now)) onCreate?.({ roomId: d.roomId!, roomTypeId: d.roomTypeId!, arrival: k, departure: addDays(k, 1) });
      } else if (d.stay) onOpen?.(d.stay);
      endDrag();
      return;
    }
    const g = computeGhost(d, e.clientX, e.clientY);
    endDrag();
    if (!g) return;
    if (!g.verdict.ok) {
      toast.warning("Can't place it there", g.verdict.reason);
      return;
    }
    if (g.mode === "create") {
      onCreate?.({
        roomId: g.roomId!,
        roomTypeId: g.roomTypeId,
        arrival: dayKeyOf(g.arrivalAt),
        departure: dayKeyOf(g.departureAt),
      });
      return;
    }
    const stay = d.stay!;
    const changed = g.roomId !== stay.roomId || g.arrivalAt !== stay.arrivalAt || g.departureAt !== stay.departureAt;
    if (!changed) return;
    void commit(stay, g, g.mode === "extend" ? "extend" : !stay.roomId && g.roomId ? "assign" : "move");
  }

  function onWindowCancel() {
    endDrag();
  }

  const autoScroll = (clientX: number, clientY: number) => {
    const el = scroller.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const edge = 36;
    if (clientX > r.right - edge) el.scrollLeft += 14;
    else if (clientX < r.left + labelW + edge) el.scrollLeft -= 14;
    if (clientY > r.bottom - edge) el.scrollTop += 12;
    else if (clientY < r.top + HEADER_H + edge) el.scrollTop -= 12;
  };

  useEffect(() => {
    handlers.current = { move: onWindowMove, up: onWindowUp, cancel: onWindowCancel };
  });

  const locked = (s: LedgerStay) => !editable || !onChange || !isActive(s.status);

  const startDrag = (e: React.PointerEvent, d: Omit<DragState, "startX" | "startY" | "pointerId" | "moved">) => {
    if (e.button !== 0) return;
    // Touch: let the chart scroll; touch users move stays with the move panel instead.
    if (e.pointerType === "touch" && d.mode !== "create") {
      drag.current = { ...d, mode: "move", startX: e.clientX, startY: e.clientY, pointerId: e.pointerId, moved: false };
      const cancelOnMove = (ev: PointerEvent) => {
        if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) > 8) drag.current = null;
      };
      const up = () => {
        window.removeEventListener("pointermove", cancelOnMove);
        window.removeEventListener("pointerup", up);
        if (drag.current?.stay) onOpen?.(drag.current.stay);
        drag.current = null;
        suppressClick.current = true;
        window.setTimeout(() => (suppressClick.current = false), 0);
      };
      window.addEventListener("pointermove", cancelOnMove);
      window.addEventListener("pointerup", up, { once: true });
      return;
    }
    if (e.pointerType === "touch" && d.mode === "create") {
      // a tap on an empty night creates one night; a swipe scrolls
      const startX = e.clientX;
      const startY = e.clientY;
      const anchor = d.anchorDay!;
      const up = (ev: PointerEvent) => {
        window.removeEventListener("pointerup", up);
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) > 8) return;
        const k = addDays(from, anchor);
        if (k >= dayKeyOf(now)) onCreate?.({ roomId: d.roomId!, roomTypeId: d.roomTypeId!, arrival: k, departure: addDays(k, 1) });
      };
      window.addEventListener("pointerup", up);
      return;
    }
    e.preventDefault();
    drag.current = { ...d, startX: e.clientX, startY: e.clientY, pointerId: e.pointerId, moved: false };
    window.addEventListener("pointermove", stable.move);
    window.addEventListener("pointerup", stable.up);
    window.addEventListener("pointercancel", stable.cancel);
  };

  /* ---------------- keyboard / touch move mode ---------------- */

  const kbStay = kb ? effective.find((s) => s.id === kb.stayId) : undefined;
  const kbVerdict = kb && kbStay ? place(kbStay, kb) : null;

  const startMoveMode = (stay: LedgerStay) => {
    if (locked(stay)) return;
    setKb({ stayId: stay.id, roomId: stay.roomId, arrivalAt: stay.arrivalAt, departureAt: stay.departureAt });
    setAnnounce(
      `Moving ${stay.code}. Arrow keys change dates and room, Shift with arrows changes length, Enter saves, Escape cancels.`,
    );
  };

  const nudge = (kind: "left" | "right" | "up" | "down" | "longer" | "shorter") => {
    if (!kb || !kbStay) return;
    const step = stepMs(kbStay);
    const next = { ...kb };
    if (kind === "left" || kind === "right") {
      if (kbStay.status === "CHECKED_IN") return;
      const d = kind === "left" ? -step : step;
      next.arrivalAt = shiftIso(kb.arrivalAt, d);
      next.departureAt = shiftIso(kb.departureAt, d);
    } else if (kind === "longer" || kind === "shorter") {
      const d = kind === "shorter" ? -step : step;
      const dep = +new Date(kb.departureAt) + d;
      if (dep <= +new Date(kb.arrivalAt) + (kbStay.stayType === "DAY_USE" ? 2 * 3600_000 - 1 : 3600_000)) return;
      next.departureAt = new Date(dep).toISOString();
    } else {
      const idx = kb.roomId ? roomRows.findIndex((r) => r.room.id === kb.roomId) : -1;
      const target = roomRows[kind === "up" ? Math.max(0, idx - 1) : Math.min(roomRows.length - 1, idx + 1)];
      if (target) next.roomId = target.room.id;
    }
    setKb(next);
    const v = place(kbStay, next);
    setAnnounce(`${describe(next)}. ${v.ok ? (v.note ?? "Press Enter to save.") : v.reason}`);
    // keep the ghost in view
    const el = scroller.current;
    if (el) {
      const x = labelW + xOf(next.arrivalAt, from, dw);
      if (x < el.scrollLeft + labelW || x > el.scrollLeft + el.clientWidth - 80) el.scrollTo({ left: x - labelW - dw * 2, behavior: "smooth" });
      const row = next.roomId ? rowOfRoom.get(next.roomId) : null;
      if (row) {
        const y = HEADER_H + row.y;
        if (y < el.scrollTop + HEADER_H || y > el.scrollTop + el.clientHeight - ROW_H)
          el.scrollTo({ top: y - HEADER_H - ROW_H * 2, behavior: "smooth" });
      }
    }
  };

  const confirmMove = () => {
    if (!kb || !kbStay) return;
    if (!kbVerdict?.ok) {
      setAnnounce(kbVerdict?.reason ?? "Not a valid placement");
      return;
    }
    const changed = kb.roomId !== kbStay.roomId || kb.arrivalAt !== kbStay.arrivalAt || kb.departureAt !== kbStay.departureAt;
    const kind: LedgerChange["kind"] =
      kb.arrivalAt === kbStay.arrivalAt && kb.roomId === kbStay.roomId ? "extend" : !kbStay.roomId && kb.roomId ? "assign" : "move";
    const stay = kbStay;
    const target = { roomId: kb.roomId, arrivalAt: kb.arrivalAt, departureAt: kb.departureAt };
    setKb(null);
    if (changed) void commit(stay, target, kind);
    window.setTimeout(() => barRefs.current.get(stay.id)?.focus(), 50);
  };

  const onBarKey = (e: React.KeyboardEvent, stay: LedgerStay) => {
    if (kb && kb.stayId === stay.id) {
      const map: Record<string, Parameters<typeof nudge>[0] | undefined> = {
        ArrowLeft: e.shiftKey ? "shorter" : "left",
        ArrowRight: e.shiftKey ? "longer" : "right",
        ArrowUp: "up",
        ArrowDown: "down",
      };
      if (map[e.key]) {
        e.preventDefault();
        nudge(map[e.key]!);
      } else if (e.key === "Enter") {
        e.preventDefault();
        confirmMove();
      } else if (e.key === "Escape") {
        e.preventDefault();
        setKb(null);
        setAnnounce("Move cancelled");
      }
      return;
    }
    if (e.key === "m" || e.key === "M") {
      e.preventDefault();
      startMoveMode(stay);
      return;
    }
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const list = stay.roomId ? (staysByRoom.get(stay.roomId) ?? []) : [];
      const i = list.findIndex((s) => s.id === stay.id);
      const next = list[e.key === "ArrowRight" ? i + 1 : i - 1];
      if (next) barRefs.current.get(next.id)?.focus();
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!stay.roomId) return;
      const idx = roomRows.findIndex((r) => r.room.id === stay.roomId);
      const mid = (+new Date(stay.arrivalAt) + +new Date(stay.departureAt)) / 2;
      for (let k = 1; k < 30; k++) {
        const row = roomRows[e.key === "ArrowDown" ? idx + k : idx - k];
        if (!row) break;
        const list = staysByRoom.get(row.room.id) ?? [];
        if (!list.length) continue;
        const best = list.reduce((a, b) =>
          Math.abs((+new Date(a.arrivalAt) + +new Date(a.departureAt)) / 2 - mid) <
          Math.abs((+new Date(b.arrivalAt) + +new Date(b.departureAt)) / 2 - mid)
            ? a
            : b,
        );
        const el = barRefs.current.get(best.id);
        if (el) {
          el.focus();
          break;
        }
      }
    }
  };

  /* ---------------- visible window ---------------- */

  const visTop = view.top - HEADER_H - 200;
  const visBottom = view.top + view.h + 200;
  const startIdx = rows.length ? firstRowAt(rows, Math.max(0, visTop)) : 0;
  const visibleRows: LedgerRow[] = [];
  for (let i = startIdx; i < rows.length; i++) {
    if (rows[i].y > visBottom) break;
    visibleRows.push(rows[i]);
  }
  const xMin = view.left - labelW - OVERSCAN_PX;
  const xMax = view.left + view.w + OVERSCAN_PX;

  const nowX = xOf(now, from, dw);
  const todayK = dayKeyOf(now);

  const barGeom = (s: { arrivalAt: string; departureAt: string }) => {
    const x1 = xOf(s.arrivalAt, from, dw);
    const x2 = xOf(s.departureAt, from, dw);
    return { x: x1, w: Math.max(MIN_BAR_PX, x2 - x1) };
  };

  const renderBar = (s: LedgerStay, top: number) => {
    const g = barGeom(s);
    if (g.x + g.w < xMin || g.x > xMax) return null;
    const dragging = ghost?.stayId === s.id || kb?.stayId === s.id;
    return (
      <StayBar
        key={s.id}
        ref={(el) => {
          if (el) barRefs.current.set(s.id, el);
          else barRefs.current.delete(s.id);
        }}
        stay={s}
        room={s.roomId ? roomMap.get(s.roomId) : undefined}
        x={g.x}
        w={g.w}
        top={top}
        dimmed={dragging}
        locked={locked(s)}
        moving={kb?.stayId === s.id}
        onPointerDown={(e, mode) => {
          // locked stays (checked out, no rights) still open through onClick
          if (locked(s)) return;
          startDrag(e, { mode, stay: s });
        }}
        onClick={() => {
          if (suppressClick.current) return;
          onOpen?.(s);
        }}
        onKeyDown={(e) => onBarKey(e, s)}
        onHover={(rect) => setHover(rect ? { stay: s, rect } : null)}
      />
    );
  };

  const ghostRow = ghost?.roomId ? rowOfRoom.get(ghost.roomId) : null;
  const kbRow = kb?.roomId ? rowOfRoom.get(kb.roomId) : null;

  return (
    <div className={cn("relative", className)}>
      <div
        ref={scroller}
        role="region"
        aria-label="Reservation ledger"
        aria-describedby="ledger-help"
        className="scrollbar-thin relative overflow-auto overscroll-contain rounded-lg border border-line bg-surface"
        style={style}
      >
        <div style={{ width: totalW, height: HEADER_H + bodyH }} className="relative select-none">
          {/* ---------- header ---------- */}
          <div className="sticky top-0 z-30 flex border-b border-line-strong bg-surface" style={{ width: totalW, height: HEADER_H }}>
            <div
              className="sticky left-0 z-10 flex flex-col justify-between border-r border-line bg-surface px-3 pb-[3px] pt-2.5"
              style={{ width: labelW, minWidth: labelW }}
            >
              <span className="display-sm truncate text-[14px] italic leading-none text-ink" aria-hidden>
                {formatDay(addDays(from, Math.max(0, Math.min(days - 1, Math.floor(view.left / dw) + 1))), { month: view.w < 640 ? "short" : "long" })}
              </span>
              <span className="mt-auto hidden font-mono text-[10px] leading-none text-ink-faint sm:block">rooms free of {totalSellable}</span>
            </div>
            <div className="relative" style={{ width: trackW }}>
              {dayKeys.map((k, i) => {
                const x = i * dw;
                if (x + dw < xMin || x > xMax) return null;
                const first = k.endsWith("-01");
                const isToday = k === todayK;
                const f = free[i];
                return (
                  <div key={k} className="absolute inset-y-0" style={{ left: x, width: dw }}>
                    {first && (
                      <span className="display-sm absolute left-1.5 top-1 whitespace-nowrap text-[12px] italic text-ink-muted">
                        {formatDay(k, { month: "long", year: "numeric" })}
                      </span>
                    )}
                    <div
                      className={cn(
                        "absolute inset-x-0 top-[20px] flex h-[28px] flex-col items-center justify-center border-l border-line",
                        isWeekend(k) && "bg-surface-2/60",
                        k.endsWith("-01") && "border-l-line-strong",
                      )}
                    >
                      <span className={cn("font-mono text-[9px] uppercase leading-none tracking-wider", isToday ? "text-laterite" : "text-ink-faint")}>
                        {formatDay(k, { weekday: "narrow" })}
                      </span>
                      <span
                        className={cn(
                          "mt-0.5 font-mono text-[12.5px] leading-none",
                          isToday ? "font-semibold text-laterite" : "text-ink",
                        )}
                      >
                        {Number(k.slice(8))}
                      </span>
                    </div>
                    <div
                      className="absolute inset-x-0 bottom-0 flex h-[16px] items-center justify-center border-l border-t border-line font-mono text-[10px]"
                      title={`${f} of ${totalSellable} rooms free on the night of ${formatDay(k)}`}
                      style={{
                        color: f === 0 ? "var(--danger)" : f <= Math.max(1, Math.round(totalSellable * 0.1)) ? "var(--ochre)" : "var(--ink-faint)",
                        background: f === 0 ? "var(--danger-wash)" : undefined,
                      }}
                    >
                      {dw >= 30 ? f : ""}
                    </div>
                    {isToday && <span className="absolute inset-x-1 top-[47px] h-[2px] rounded-full bg-laterite" aria-hidden />}
                  </div>
                );
              })}
              {nowX >= 0 && nowX <= trackW && (
                <span
                  className="absolute top-[2px] z-10 -translate-x-1/2 rounded-xs bg-laterite px-1 font-mono text-[9.5px] leading-[14px] text-laterite-ink"
                  style={{ left: nowX }}
                  suppressHydrationWarning
                >
                  {lagosHHMM(now)}
                </span>
              )}
            </div>
          </div>

          {/* ---------- body ---------- */}
          <div className="absolute left-0" style={{ top: HEADER_H, width: totalW, height: bodyH }}>
            {/* grid, weekends, today */}
            <div
              aria-hidden
              className="absolute inset-y-0"
              style={{
                left: labelW,
                width: trackW,
                backgroundImage: `repeating-linear-gradient(to right, var(--line) 0 1px, transparent 1px ${dw}px)`,
              }}
            >
              {dayKeys.map((k, i) =>
                isWeekend(k) || k === todayK ? (
                  <div
                    key={k}
                    className="absolute inset-y-0"
                    style={{
                      left: i * dw + 1,
                      width: dw - 1,
                      background: k === todayK ? "color-mix(in oklab, var(--laterite) 6%, transparent)" : "color-mix(in oklab, var(--surface-2) 55%, transparent)",
                    }}
                  />
                ) : null,
              )}
            </div>

            {visibleRows.map((row) => {
              if (row.kind === "group")
                return (
                  <div
                    key={row.key}
                    className="absolute left-0 flex items-end border-b border-line bg-paper/70"
                    style={{ top: row.y, height: row.h, width: totalW }}
                  >
                    <div className="sticky left-0 flex h-full items-end gap-2 px-3 pb-1.5" style={{ width: Math.min(360, view.w) }}>
                      <span className="display-sm whitespace-nowrap text-[13px] italic text-ink">{row.label}</span>
                      <span className="whitespace-nowrap font-mono text-[10px] text-ink-faint">{row.sub}</span>
                    </div>
                  </div>
                );
              if (row.kind === "lane") {
                const lane = unassigned.filter((s) => s.roomTypeId === row.roomTypeId && laneOf.get(s.id) === row.lane);
                return (
                  <div key={row.key} className="absolute left-0 border-b border-dashed border-line" style={{ top: row.y, height: row.h, width: totalW }}>
                    <div
                      className="sticky left-0 z-10 flex h-full flex-col justify-center border-r border-line bg-surface px-3"
                      style={{ width: labelW }}
                    >
                      {row.lane === 0 && (
                        <>
                          <span className="truncate text-[12px] font-medium text-ink">{row.label}</span>
                          <span className="hidden text-[10.5px] text-ink-faint sm:block">drag onto a room</span>
                        </>
                      )}
                    </div>
                    <div className="absolute inset-y-0" style={{ left: labelW, width: trackW }}>
                      {lane.map((s) => renderBar(s, 6))}
                    </div>
                  </div>
                );
              }
              const room = row.room;
              const list = staysByRoom.get(room.id) ?? [];
              const ooo = room.status === "OUT_OF_ORDER";
              return (
                <div key={row.key} className="group/row absolute left-0 border-b border-line" style={{ top: row.y, height: row.h, width: totalW }}>
                  <div
                    className="sticky left-0 z-10 flex h-full items-center gap-2 border-r border-line bg-surface px-3 group-hover/row:bg-surface-2"
                    style={{ width: labelW }}
                  >
                    <StatusSwatch status={room.status} size={15} />
                    <span className="font-mono text-[13.5px] text-ink">{room.number}</span>
                    <span className="hidden min-w-0 truncate text-[11.5px] text-ink-muted sm:block" title={ROOM_STATUS[room.status].label}>
                      {room.roomTypeName}
                    </span>
                  </div>
                  <div
                    className={cn("absolute inset-y-0", editable && onCreate && !ooo && "cursor-cell")}
                    style={{ left: labelW, width: trackW }}
                    onPointerDown={(e) => {
                      if (!editable || !onCreate || ooo || e.target !== e.currentTarget) return;
                      const c = toContent(e.clientX, e.clientY);
                      startDrag(e, { mode: "create", stay: null, anchorDay: Math.floor(c.x / dw), roomId: room.id, roomTypeId: room.roomTypeId });
                    }}
                  >
                    {ooo && (
                      <div
                        aria-hidden
                        className="hatch pointer-events-none absolute inset-y-1 left-0 right-0 text-danger opacity-50"
                        style={{ maskImage: "linear-gradient(to right, black, black)" }}
                      />
                    )}
                    {list.map((s) => renderBar(s, 6))}
                  </div>
                </div>
              );
            })}

            {/* now line */}
            {nowX >= 0 && nowX <= trackW && (
              <div aria-hidden className="pointer-events-none absolute inset-y-0 z-[5] w-px bg-laterite" style={{ left: labelW + nowX }}>
                <span className="absolute -left-[3px] top-0 h-[7px] w-[7px] rounded-full bg-laterite" />
              </div>
            )}

            {/* drag ghost */}
            {ghost && (
              <GhostBar
                x={labelW + xOf(ghost.arrivalAt, from, dw)}
                w={Math.max(MIN_BAR_PX, xOf(ghost.departureAt, from, dw) - xOf(ghost.arrivalAt, from, dw))}
                top={(ghostRow ? ghostRow.y : (rows.find((r) => r.kind === "lane" && ghost.stayId && laneOf.get(ghost.stayId) === r.lane && r.roomTypeId === ghost.roomTypeId)?.y ?? 0)) + 4}
                verdict={ghost.verdict}
                label={ghost.mode === "create" ? `New, ${ghost.label}` : ghost.label}
              />
            )}
            {kb && kbStay && (
              <GhostBar
                x={labelW + xOf(kb.arrivalAt, from, dw)}
                w={Math.max(MIN_BAR_PX, xOf(kb.departureAt, from, dw) - xOf(kb.arrivalAt, from, dw))}
                top={(kbRow ? kbRow.y : (rows.find((r) => r.kind === "lane" && laneOf.get(kbStay.id) === r.lane && r.roomTypeId === kbStay.roomTypeId)?.y ?? 0)) + 4}
                verdict={kbVerdict ?? { ok: true }}
                label={describe(kb)}
              />
            )}
          </div>
        </div>
      </div>

      {/* move panel: keyboard and touch alternative to dragging */}
      {kb && kbStay && (
        <MovePanel
          stay={kbStay}
          verdict={kbVerdict}
          summary={describe(kb)}
          canShiftDates={kbStay.status !== "CHECKED_IN"}
          onNudge={nudge}
          onConfirm={confirmMove}
          onCancel={() => {
            setKb(null);
            setAnnounce("Move cancelled");
          }}
        />
      )}

      {hover && !ghost && !kb && <HoverCard stay={hover.stay} rect={hover.rect} room={hover.stay.roomId ? roomMap.get(hover.stay.roomId) : undefined} />}

      <p id="ledger-help" className="sr-only">
        Each reservation is a button. Press Enter to open it. Press M to move it with the arrow keys; Shift with Left or
        Right changes its length; Enter saves and Escape cancels. Control Z undoes the last move.
      </p>
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>

      {/* expose the move-mode starter for the detail sheet */}
      <MoveModeBridge start={(id) => {
        const s = effective.find((x) => x.id === id);
        if (s) startMoveMode(s);
      }} />
    </div>
  );
});

/* ------------------------------------------------------------------------ */

function lengthLabel(stay: LedgerStay, p: Placement) {
  const ms = +new Date(p.departureAt) - +new Date(p.arrivalAt);
  if (stay.stayType === "DAY_USE") return `${Math.round((ms / 3600_000) * 2) / 2}h, until ${lagosHHMM(p.departureAt)}`;
  const nights = Math.max(1, Math.round(ms / DAY_MS));
  return `${nights} ${nights === 1 ? "night" : "nights"}, out ${formatDay(dayKeyOf(p.departureAt), { weekday: "short", day: "numeric", month: "short" })}`;
}

/* Allow outside callers (e.g. the reservation sheet's "Move" button) to start move mode. */
type Starter = (id: string) => void;
let bridge: Starter | null = null;
export function startLedgerMove(id: string) {
  bridge?.(id);
}
function MoveModeBridge({ start }: { start: Starter }) {
  useEffect(() => {
    bridge = start;
    return () => {
      if (bridge === start) bridge = null;
    };
  }, [start]);
  return null;
}

/* ------------------------------------------------------------------------ */

const StayBar = memo(
  forwardRef<
    HTMLButtonElement,
    {
      stay: LedgerStay;
      room?: LedgerRoom;
      x: number;
      w: number;
      top: number;
      dimmed: boolean;
      locked: boolean;
      moving: boolean;
      onPointerDown: (e: React.PointerEvent, mode: "move" | "extend") => void;
      onClick: () => void;
      onKeyDown: (e: React.KeyboardEvent) => void;
      onHover: (rect: DOMRect | null) => void;
    }
  >(function StayBar({ stay, room, x, w, top, dimmed, locked, moving, onPointerDown, onClick, onKeyDown, onHover }, ref) {
    const m = STAY_STATUS[stay.status];
    const dayUse = stay.stayType === "DAY_USE";
    const owes = (stay.balanceKobo ?? 0) > 0;
    const h = ROW_H - 12;
    const label = `${stay.code}, ${stay.guestName}, ${room ? `room ${room.number}` : "unassigned"}, ${stayWindow(stay.arrivalAt, stay.departureAt)}, ${m.label}${dayUse ? ", day use" : ""}${owes ? `, owes ${naira(stay.balanceKobo)}` : ""}`;
    const surname = stay.guestName.split(/\s+/).slice(-1)[0] ?? stay.guestName;
    return (
      <button
        ref={ref}
        type="button"
        aria-label={label}
        aria-pressed={moving || undefined}
        onPointerDown={(e) => onPointerDown(e, "move")}
        onClick={onClick}
        onKeyDown={onKeyDown}
        onPointerEnter={(e) => onHover(e.currentTarget.getBoundingClientRect())}
        onPointerLeave={() => onHover(null)}
        className={cn(
          "group/bar absolute z-[2] flex items-center overflow-hidden text-left outline-none transition-[opacity,box-shadow] duration-150",
          "focus-visible:z-[4] focus-visible:shadow-[0_0_0_2px_var(--surface),0_0_0_4px_var(--laterite)]",
          dayUse ? "rounded-[3px]" : "rounded-[3px] rounded-l-[2px]",
          !locked && "cursor-grab active:cursor-grabbing",
          dimmed && "opacity-35",
        )}
        style={{
          left: x,
          width: w,
          top: dayUse ? top - 2 : top,
          height: dayUse ? h + 4 : h,
          color: m.color,
          background: dayUse ? `color-mix(in oklab, ${m.wash} 70%, var(--surface))` : m.wash,
          border: `1px ${stay.status === "PENDING" ? "dashed" : "solid"} color-mix(in oklab, ${m.color} ${stay.status === "CHECKED_OUT" ? 30 : 42}%, transparent)`,
          boxShadow: dayUse ? undefined : `inset 3px 0 0 ${m.color}, inset 0 -1px 0 color-mix(in oklab, ${m.color} 22%, transparent)`,
        }}
      >
        {dayUse ? (
          <span aria-hidden className="hatch absolute inset-0" />
        ) : (
          <span className={cn("flex min-w-0 flex-1 items-baseline gap-1.5 pl-2 pr-1.5", w < 34 && "justify-center pl-1 pr-1")}>
            {stay.vip && w > 60 && <Crown size={11} weight="fill" className="shrink-0 self-center text-brass" aria-hidden />}
            <span
              className={cn(
                "truncate text-[12px] font-medium leading-none",
                stay.status === "CHECKED_OUT" ? "text-ink-muted" : "text-ink",
                stay.status === "NO_SHOW" && "line-through decoration-danger",
              )}
            >
              {w < 34 ? surname.slice(0, 1) : w < 90 ? surname : stay.guestName}
            </span>
            {w > 150 && <span className="shrink-0 font-mono text-[10px] leading-none text-ink-faint">{stay.code}</span>}
          </span>
        )}
        {owes && !dayUse && w > 24 && (
          <span
            aria-hidden
            className="absolute right-0 top-0 h-0 w-0 border-l-[7px] border-t-[7px] border-l-transparent"
            style={{ borderTopColor: "var(--ochre)" }}
          />
        )}
        {locked && stay.status === "CHECKED_OUT" && w > 110 && (
          <LockSimple size={10} className="mr-1.5 shrink-0 text-ink-faint" aria-hidden />
        )}
        {!locked && (
          <span
            aria-hidden
            onPointerDown={(e) => {
              e.stopPropagation();
              onPointerDown(e, "extend");
            }}
            className="absolute inset-y-0 right-0 flex w-2 cursor-ew-resize items-center justify-center opacity-0 transition-opacity group-hover/bar:opacity-100"
          >
            <span className="h-3 w-[2px] rounded-full" style={{ background: m.color }} />
          </span>
        )}
      </button>
    );
  }),
);

function GhostBar({ x, w, top, verdict, label }: { x: number; w: number; top: number; verdict: Verdict; label: string }) {
  const color = verdict.ok ? "var(--laterite)" : "var(--danger)";
  return (
    <div className="pointer-events-none absolute z-[6]" style={{ left: x, top, width: w, height: ROW_H - 8 }}>
      <div
        className="h-full w-full rounded-[3px]"
        style={{
          border: `1.5px dashed ${color}`,
          background: `color-mix(in oklab, ${color} 10%, transparent)`,
        }}
      />
      <div
        className="absolute left-0 top-full mt-1 flex max-w-[320px] items-center gap-1.5 whitespace-nowrap rounded-sm px-2 py-1 text-[11.5px] shadow-float"
        style={{ background: verdict.ok ? "var(--ink)" : "var(--danger)", color: "var(--paper)" }}
      >
        {verdict.ok ? <Check size={11} weight="bold" /> : <X size={11} weight="bold" />}
        <span className="truncate">{verdict.ok ? (verdict.note ? `${label}. ${verdict.note}` : label) : verdict.reason}</span>
      </div>
    </div>
  );
}

function HoverCard({ stay, rect, room }: { stay: LedgerStay; rect: DOMRect; room?: LedgerRoom }) {
  const m = STAY_STATUS[stay.status];
  const nights = Math.round((+new Date(stay.departureAt) - +new Date(stay.arrivalAt)) / DAY_MS);
  const left = Math.min(Math.max(8, rect.left), (typeof window !== "undefined" ? window.innerWidth : 1200) - 280);
  const below = rect.bottom + 150 < (typeof window !== "undefined" ? window.innerHeight : 800);
  return (
    <div
      className="pointer-events-none fixed z-[60] w-[264px] rounded-md border border-line bg-surface p-3 shadow-float animate-[fade_120ms_ease-out]"
      style={{ left, top: below ? rect.bottom + 6 : undefined, bottom: below ? undefined : window.innerHeight - rect.top + 6 }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] tracking-wide text-ink-muted">{stay.code}</span>
        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: m.color }}>
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: m.color }} />
          {m.label}
        </span>
      </div>
      <p className="display-sm mt-1 text-[16px] leading-tight text-ink">{stay.guestName}</p>
      <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[12px]">
        <dt className="text-ink-muted">Room</dt>
        <dd className="font-mono text-ink">{room ? `${room.number} · ${room.roomTypeName}` : "Unassigned"}</dd>
        <dt className="text-ink-muted">{stay.stayType === "DAY_USE" ? "Day use" : "Stay"}</dt>
        <dd className="text-ink">
          {stay.stayType === "DAY_USE"
            ? `${lagosHHMM(stay.arrivalAt)} to ${lagosHHMM(stay.departureAt)}`
            : `${stayWindow(stay.arrivalAt, stay.departureAt)}, ${nights}n`}
        </dd>
        {(stay.balanceKobo ?? 0) !== 0 && stay.balanceKobo != null && (
          <>
            <dt className="text-ink-muted">Balance</dt>
            <dd className={cn("font-mono", stay.balanceKobo > 0 ? "text-ochre" : "text-palm")}>{naira(stay.balanceKobo)}</dd>
          </>
        )}
      </dl>
    </div>
  );
}

function MovePanel({
  stay,
  verdict,
  summary,
  canShiftDates,
  onNudge,
  onConfirm,
  onCancel,
}: {
  stay: LedgerStay;
  verdict: Verdict | null;
  summary: string;
  canShiftDates: boolean;
  onNudge: (k: "left" | "right" | "up" | "down" | "longer" | "shorter") => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const btn =
    "inline-flex h-9 min-w-9 items-center justify-center rounded-md border border-line-strong bg-surface text-ink hover:bg-surface-2 disabled:opacity-40";
  return (
    <div
      role="toolbar"
      aria-label={`Move ${stay.code}`}
      className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-[55] mx-auto flex max-w-[640px] flex-wrap items-center gap-2 rounded-lg border border-line bg-surface p-2.5 shadow-float animate-[rise_200ms_cubic-bezier(0.22,1,0.36,1)] sm:bottom-6"
    >
      <div className="min-w-0 flex-1 basis-[180px] px-1">
        <p className="text-[12.5px] font-medium text-ink">
          Moving <span className="font-mono">{stay.code}</span>
        </p>
        <p className={cn("truncate text-[12px]", verdict && !verdict.ok ? "text-danger" : "text-ink-muted")}>
          {verdict && !verdict.ok ? verdict.reason : verdict?.note ? `${summary}. ${verdict.note}` : summary}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button className={btn} onClick={() => onNudge("left")} disabled={!canShiftDates} aria-label="Earlier by a day">
          <ArrowLeft size={15} />
        </button>
        <button className={btn} onClick={() => onNudge("right")} disabled={!canShiftDates} aria-label="Later by a day">
          <ArrowRight size={15} />
        </button>
        <button className={btn} onClick={() => onNudge("up")} aria-label="Room above">
          <ArrowUp size={15} />
        </button>
        <button className={btn} onClick={() => onNudge("down")} aria-label="Room below">
          <ArrowDown size={15} />
        </button>
        <button className={cn(btn, "w-auto px-2 text-[12px]")} onClick={() => onNudge("shorter")} aria-label="Shorter">
          &minus;1
        </button>
        <button className={cn(btn, "w-auto gap-1 px-2 text-[12px]")} onClick={() => onNudge("longer")} aria-label="Longer">
          <ArrowsOutLineHorizontal size={14} />
          +1
        </button>
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={onCancel} className="h-9 rounded-md px-3 text-[13px] text-ink-muted hover:bg-surface-2 hover:text-ink">
          Cancel
        </button>
        <button
          onClick={onConfirm}
          disabled={!verdict?.ok}
          className="inline-flex h-9 items-center gap-1.5 rounded-md bg-laterite px-3.5 text-[13px] font-medium text-laterite-ink disabled:opacity-40"
        >
          <Check size={14} weight="bold" /> Save
        </button>
      </div>
    </div>
  );
}

export { GROUP_H, ROW_H, HEADER_H };
