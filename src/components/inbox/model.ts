/* The guest inbox's view model; the API's conversations are adapted into these. */

export type MsgDirection = "IN" | "OUT";
export type MsgKind = "TEXT" | "TEMPLATE" | "NOTE" | "SYSTEM" | "AUTOMATION";
export type MsgStatus = "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED" | "RECEIVED";

export interface InboxMessage {
  id: string;
  direction: MsgDirection;
  kind: MsgKind;
  body: string;
  at: string;
  status?: MsgStatus | null;
  author?: { id: string; fullName: string } | null;
  templateName?: string | null;
  /** a task made from this message */
  task?: { id: string; kind: "HOUSEKEEPING" | "MAINTENANCE"; label: string } | null;
  /** keyword the automation spotted (towels, AC, water) */
  detected?: { kind: "HOUSEKEEPING" | "MAINTENANCE"; keyword: string } | null;
  error?: string | null;
}

export interface InboxReservation {
  id: string;
  code: string;
  status: string;
  roomNumber?: string | null;
  roomType?: string | null;
  arrivalAt: string;
  departureAt: string;
  adults?: number;
  balanceKobo?: number | null;
  source?: string | null;
  specialRequests?: string | null;
}

export interface InboxThread {
  id: string;
  guestName: string;
  phone: string;
  guestId?: string | null;
  vip?: boolean;
  loyaltyTier?: string | null;
  channel: "WHATSAPP" | "SMS";
  status: "OPEN" | "SNOOZED" | "CLOSED";
  unread: number;
  lastMessage: { body: string; direction: MsgDirection; at: string } | null;
  /** when free-text replies stop being allowed (24h after the guest's last message) */
  windowExpiresAt: string | null;
  assignee: { id: string; fullName: string } | null;
  reservation: InboxReservation | null;
  /** first inbound message still waiting for a reply since */
  waitingSince?: string | null;
  propertyName?: string | null;
}

export interface QuickReply {
  id: string;
  label: string;
  body: string;
}

export interface WaTemplateOption {
  name: string;
  label: string;
  /** body with {{1}}, {{2}} ... placeholders */
  body: string;
  /** placeholders in order: key "1", "2" ... with a human label */
  params: { key: string; label: string; example?: string }[];
  status?: "APPROVED" | "PENDING" | "REJECTED";
}

export function windowLeft(expiresAt: string | null, now: number) {
  if (!expiresAt) return 0;
  return Math.max(0, Date.parse(expiresAt) - now);
}

export function windowLabel(ms: number) {
  if (ms <= 0) return "closed";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return h > 0 ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

/** Fill {{guest_name}}-style placeholders for a preview. */
export function fillTemplate(body: string, values: Record<string, string>) {
  return body.replace(/\{\{\s*([\w.]+)\s*\}\}|\{\{(\d+)\}\}/g, (_m, k, n) => values[k ?? n] ?? `[${k ?? n}]`);
}

