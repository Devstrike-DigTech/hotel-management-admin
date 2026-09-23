import type { RoomStatus } from "@/lib/api/types";
import { DAY_MS, dayKeyOf, dayStartMs, type DayKey } from "@/lib/dates";

/* ------------------------------------------------------------------------ */
/* The Ledger's own view model. API shapes are adapted into these so the     */
/* chart engine stays independent of the wire contract.                      */
/* ------------------------------------------------------------------------ */

export type StayStatus = "PENDING" | "CONFIRMED" | "CHECKED_IN" | "CHECKED_OUT" | "CANCELLED" | "NO_SHOW";
export type StayType = "NIGHTLY" | "DAY_USE";

export interface LedgerRoom {
  id: string;
  number: string;
  floor: number;
  roomTypeId: string;
  roomTypeName: string;
  status: RoomStatus;
}

export interface LedgerStay {
  id: string;
  code: string;
  roomId: string | null;
  roomTypeId: string;
  guestName: string;
  arrivalAt: string;
  departureAt: string;
  status: StayStatus;
  stayType: StayType;
  balanceKobo?: number | null;
  vip?: boolean;
  adults?: number;
  source?: string;
  /** M3: online bookings */
  paymentMode?: "ONLINE" | "PAY_AT_HOTEL" | null;
  holdExpiresAt?: string | null;
}

export interface LedgerChange {
  stay: LedgerStay;
  roomId: string | null;
  arrivalAt: string;
  departureAt: string;
  kind: "move" | "extend" | "assign";
}

export const ACTIVE: StayStatus[] = ["PENDING", "CONFIRMED", "CHECKED_IN"];
export const isActive = (s: StayStatus) => ACTIVE.includes(s);

export type GroupBy = "floor" | "type";

export type LedgerRow =
  | { kind: "group"; key: string; label: string; sub: string; y: number; h: number }
  | { kind: "room"; key: string; room: LedgerRoom; y: number; h: number; index: number }
  | { kind: "lane"; key: string; roomTypeId: string; label: string; lane: number; y: number; h: number };

export const ROW_H = 40;
export const GROUP_H = 30;
export const HEADER_H = 64;

export function sortRooms(a: LedgerRoom, b: LedgerRoom) {
  return a.number.localeCompare(b.number, undefined, { numeric: true });
}

/**
 * Pack unassigned stays of each room type into lanes so they never overlap.
 * Returns stayId -> lane and the lane count per type.
 */
export function packLanes(stays: LedgerStay[]) {
  const laneOf = new Map<string, number>();
  const lanesByType = new Map<string, number>();
  const byType = new Map<string, LedgerStay[]>();
  for (const s of stays) {
    const list = byType.get(s.roomTypeId) ?? [];
    list.push(s);
    byType.set(s.roomTypeId, list);
  }
  for (const [type, list] of byType) {
    list.sort((a, b) => +new Date(a.arrivalAt) - +new Date(b.arrivalAt));
    const ends: number[] = [];
    for (const s of list) {
      const a = +new Date(s.arrivalAt);
      let lane = ends.findIndex((e) => e <= a);
      if (lane === -1) {
        lane = ends.length;
        ends.push(0);
      }
      ends[lane] = +new Date(s.departureAt);
      laneOf.set(s.id, lane);
    }
    lanesByType.set(type, ends.length);
  }
  return { laneOf, lanesByType };
}

export function buildRows(
  rooms: LedgerRoom[],
  unassigned: LedgerStay[],
  groupBy: GroupBy,
  typeNames: Map<string, string>,
): { rows: LedgerRow[]; height: number; laneOf: Map<string, number> } {
  const rows: LedgerRow[] = [];
  let y = 0;
  const { laneOf, lanesByType } = packLanes(unassigned);

  if (unassigned.length) {
    rows.push({ kind: "group", key: "g-unassigned", label: "Unassigned", sub: `${unassigned.length} to place`, y, h: GROUP_H });
    y += GROUP_H;
    for (const [typeId, lanes] of lanesByType) {
      for (let lane = 0; lane < lanes; lane++) {
        rows.push({
          kind: "lane",
          key: `lane-${typeId}-${lane}`,
          roomTypeId: typeId,
          label: typeNames.get(typeId) ?? "Room",
          lane,
          y,
          h: ROW_H,
        });
        y += ROW_H;
      }
    }
  }

  const groups = new Map<string, { label: string; rooms: LedgerRoom[]; order: number | string }>();
  for (const r of rooms) {
    const key = groupBy === "floor" ? `f-${r.floor}` : `t-${r.roomTypeId}`;
    const g = groups.get(key) ?? {
      label: groupBy === "floor" ? floorLabel(r.floor) : r.roomTypeName,
      rooms: [],
      order: groupBy === "floor" ? r.floor : r.roomTypeName,
    };
    g.rooms.push(r);
    groups.set(key, g);
  }
  const ordered = [...groups.entries()].sort(([, a], [, b]) =>
    typeof a.order === "number" && typeof b.order === "number" ? a.order - b.order : String(a.order).localeCompare(String(b.order)),
  );
  let index = 0;
  for (const [key, g] of ordered) {
    g.rooms.sort(sortRooms);
    rows.push({ kind: "group", key: `g-${key}`, label: g.label, sub: `${g.rooms.length} ${g.rooms.length === 1 ? "room" : "rooms"}`, y, h: GROUP_H });
    y += GROUP_H;
    for (const room of g.rooms) {
      rows.push({ kind: "room", key: room.id, room, y, h: ROW_H, index: index++ });
      y += ROW_H;
    }
  }
  return { rows, height: y, laneOf };
}

export function floorLabel(floor: number) {
  if (floor === 0) return "Ground floor";
  const s = ["th", "st", "nd", "rd"];
  const v = floor % 100;
  return `${floor}${s[(v - 20) % 10] || s[v] || s[0]} floor`;
}

/** Binary search the first row whose bottom is below `y`. */
export function firstRowAt(rows: LedgerRow[], y: number) {
  let lo = 0;
  let hi = rows.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (rows[mid].y + rows[mid].h <= y) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/* ---------------- geometry ---------------- */

export function xOf(iso: string | number, fromKey: DayKey, dayWidth: number) {
  const ms = typeof iso === "number" ? iso : +new Date(iso);
  return ((ms - dayStartMs(fromKey)) / DAY_MS) * dayWidth;
}

export function msAtX(x: number, fromKey: DayKey, dayWidth: number) {
  return dayStartMs(fromKey) + (x / dayWidth) * DAY_MS;
}

/** Shift an ISO instant by whole days or minutes. */
export function shiftIso(iso: string, ms: number) {
  return new Date(+new Date(iso) + ms).toISOString();
}

/* ---------------- validation ---------------- */

export interface Verdict {
  ok: boolean;
  reason?: string;
  note?: string;
}

export function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Local pre-check of a proposed placement. The server re-validates with the
 * exclusion constraint; this only gives instant feedback while dragging.
 */
export function validatePlacement(opts: {
  stay?: LedgerStay;
  roomId: string | null;
  arrivalAt: string;
  departureAt: string;
  rooms: Map<string, LedgerRoom>;
  staysByRoom: Map<string, LedgerStay[]>;
  nowMs: number;
}): Verdict {
  const { stay, roomId, arrivalAt, departureAt, rooms, staysByRoom, nowMs } = opts;
  const a = +new Date(arrivalAt);
  const d = +new Date(departureAt);
  if (!(d > a)) return { ok: false, reason: "Departure must be after arrival" };
  if (stay?.stayType === "DAY_USE" && d - a < 2 * 3600_000) return { ok: false, reason: "Day use is at least 2 hours" };
  const arrivalChanged = !stay || +new Date(stay.arrivalAt) !== a;
  if (arrivalChanged && stay?.status !== "CHECKED_IN" && dayKeyOf(a) < dayKeyOf(nowMs))
    return { ok: false, reason: "Arrival can't be in the past" };
  if (stay?.status === "CHECKED_IN" && d < nowMs) return { ok: false, reason: "Departure can't be in the past for a guest in house" };
  if (!roomId) return { ok: true };
  const room = rooms.get(roomId);
  if (!room) return { ok: false, reason: "Unknown room" };
  if (room.status === "OUT_OF_ORDER") return { ok: false, reason: `Room ${room.number} is out of order` };
  for (const other of staysByRoom.get(roomId) ?? []) {
    if (other.id === stay?.id || !isActive(other.status)) continue;
    if (overlaps(a, d, +new Date(other.arrivalAt), +new Date(other.departureAt)))
      return { ok: false, reason: `Clashes with ${other.code}, ${other.guestName}` };
  }
  const note = stay && room.roomTypeId !== stay.roomTypeId ? `Changes room type to ${room.roomTypeName}` : undefined;
  return { ok: true, note };
}

/** Rooms free per night across the range (excluding out-of-order), for the header strip. */
export function freeByNight(days: DayKey[], rooms: LedgerRoom[], stays: LedgerStay[]) {
  const sellable = rooms.filter((r) => r.status !== "OUT_OF_ORDER").length;
  return days.map((k) => {
    // a night is "sold" when a nightly stay covers 20:00 that evening
    const probe = dayStartMs(k) + 20 * 3600_000;
    let used = 0;
    for (const s of stays) {
      if (!isActive(s.status) || s.stayType === "DAY_USE") continue;
      if (+new Date(s.arrivalAt) <= probe && +new Date(s.departureAt) > probe) used++;
    }
    return Math.max(0, sellable - used);
  });
}
