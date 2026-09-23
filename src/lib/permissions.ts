"use client";

import { useMe } from "./api/hooks";
import type { Role } from "./api/types";

/**
 * What each role may do in M2 (mirrors API-M2 0.5). The UI hides or disables
 * what a role can't do; the API enforces every rule regardless.
 */
export type Capability =
  | "reservations.read"
  | "reservations.write"
  | "rate.override"
  | "frontdesk.act" // check-in / check-out / payments / charges
  | "override" // dirty-room check-in, checkout with balance
  | "payments.privileged" // CARD_ONLINE, COMPLIMENTARY, CITY_LEDGER
  | "void"
  | "refund"
  | "discount"
  | "shift.own"
  | "shift.viewAll"
  | "shift.approve"
  | "guard.read"
  | "guard.triage"
  | "reports.read"
  | "audit.run"
  | "tax.write"
  | "guest.read"
  | "guest.write"
  | "guest.ndpa"
  | "register.fullIds"
  | "id.reveal"
  | "folio.read"
  | "digest.manage"
  | "approver";

const MANAGER: Capability[] = [
  "reservations.read",
  "reservations.write",
  "rate.override",
  "frontdesk.act",
  "override",
  "payments.privileged",
  "void",
  "refund",
  "discount",
  "shift.own",
  "shift.viewAll",
  "shift.approve",
  "guard.read",
  "guard.triage",
  "reports.read",
  "audit.run",
  "tax.write",
  "guest.read",
  "guest.write",
  "guest.ndpa",
  "register.fullIds",
  "id.reveal",
  "folio.read",
  "digest.manage",
  "approver",
];

const CAPS: Record<Role, Capability[]> = {
  OWNER: MANAGER,
  MANAGER,
  FRONT_DESK: [
    "reservations.read",
    "reservations.write",
    "frontdesk.act",
    "discount",
    "shift.own",
    "guest.read",
    "guest.write",
    "id.reveal",
    "folio.read",
  ],
  ACCOUNTANT: ["reservations.read", "shift.viewAll", "guard.read", "reports.read", "guest.read", "folio.read"],
  HOUSEKEEPING: [],
};

export function can(role: Role | undefined | null, cap: Capability): boolean {
  if (!role) return false;
  return CAPS[role]?.includes(cap) ?? false;
}

export function useCan() {
  const me = useMe();
  const role = me.data?.user.role;
  return { role, can: (cap: Capability) => can(role, cap), ready: !!role };
}
