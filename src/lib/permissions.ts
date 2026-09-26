"use client";

import { useCallback, useMemo } from "react";
import { useMe } from "./api/hooks";
import type { Role } from "./api/types";

/**
 * UI gating by permission. Since M4 the API returns the signed-in user's
 * effective permissions on `/me` (custom roles included), and every screen asks
 * `can(...)`. The capability names the M2/M3 screens were written against are
 * kept as aliases for the permission (or permissions) that now carry them, so
 * the whole app reads one source. The API enforces every rule regardless.
 */
export type Capability =
  | "reservations.read"
  | "reservations.write"
  | "rate.override"
  | "frontdesk.act"
  | "override"
  | "payments.privileged"
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
  | "tax.read"
  | "guest.read"
  | "guest.write"
  | "guest.ndpa"
  | "register.fullIds"
  | "id.reveal"
  | "folio.read"
  | "digest.manage"
  | "approver"
  | "payouts.read"
  | "payouts.manage"
  | "booking.settings"
  | "reviews.read"
  | "reviews.reply"
  | "cancel.refund"
  | "notifications.preview"
  | "online.feed";

/** Permission codes (API-M4 section 2.3). */
export type Permission = string;

type Rule = Permission | { any: Permission[] } | { all: Permission[] };

const ALIAS: Record<Capability, Rule> = {
  "reservations.read": "reservations.view",
  "reservations.write": "reservations.create",
  "rate.override": "rates.manage",
  "frontdesk.act": { any: ["frontdesk.checkin", "frontdesk.checkout", "payments.take"] },
  override: "frontdesk.override",
  "payments.privileged": "payments.special",
  void: "folio.void",
  refund: "folio.refund",
  discount: "folio.discount",
  "shift.own": "shifts.own",
  "shift.viewAll": "shifts.view_all",
  "shift.approve": "shifts.approve",
  "guard.read": "guard.view",
  "guard.triage": "guard.resolve",
  "reports.read": "reports.view",
  "audit.run": "settings.manage",
  "tax.write": "settings.manage",
  "tax.read": "folio.view",
  "guest.read": "guests.view",
  "guest.write": "guests.edit",
  "guest.ndpa": "guests.export",
  "register.fullIds": "guests.export",
  "id.reveal": "guests.reveal_id",
  "folio.read": "folio.view",
  "digest.manage": "settings.manage",
  approver: "folio.approve",
  "payouts.read": "reports.financial",
  "payouts.manage": "payouts.manage",
  "booking.settings": "settings.manage",
  "reviews.read": "reviews.view",
  "reviews.reply": "reviews.reply",
  "cancel.refund": { all: ["reservations.cancel", "folio.refund"] },
  "notifications.preview": "reservations.create",
  "online.feed": "reservations.view",
};

/* Fallback for an API that does not send `permissions` (API-M4 section 2.4). */
const FRONT_DESK = [
  "reservations.view", "reservations.create", "reservations.edit", "reservations.cancel",
  "frontdesk.checkin", "frontdesk.checkout", "folio.view", "folio.charge", "folio.discount", "payments.take", "shifts.own",
  "guests.view", "guests.edit", "guests.reveal_id", "rooms.status", "housekeeping.view", "housekeeping.work",
  "maintenance.view", "maintenance.report", "rates.view", "corporate.view", "reviews.view", "support.request",
];
const ACCOUNTANT = [
  "reservations.view", "folio.view", "shifts.view_all", "guests.view", "reports.view", "reports.financial", "guard.view",
  "audit.view", "billing.manage", "rates.view", "corporate.view", "maintenance.view", "reviews.view", "support.request",
];
const LEGACY: Partial<Record<string, Permission[] | "*" | "*-payouts">> = {
  OWNER: "*",
  MANAGER: "*-payouts",
  FRONT_DESK,
  ACCOUNTANT,
  HOUSEKEEPING: ["housekeeping.view", "housekeeping.work", "maintenance.report", "support.request"],
  SUPERVISOR: ["housekeeping.view", "housekeeping.work", "housekeeping.assign", "housekeeping.inspect", "rooms.status", "maintenance.view", "maintenance.report", "reservations.view", "support.request"],
  MAINTENANCE: ["maintenance.view", "maintenance.report", "maintenance.work", "housekeeping.view", "support.request"],
  WAITER: ["pos.view", "pos.order", "pos.settle", "kds.view", "shifts.own", "payments.take", "loyalty.view", "support.request"],
  KITCHEN: ["kds.view", "pos.view", "stock.view", "support.request"],
  CONCIERGE: ["concierge.view", "concierge.work", "concierge.discreet", "concierge.catalogue", "reservations.view", "guests.view", "folio.view", "inbox.view", "inbox.reply", "transfers.view", "support.request"],
};

type Checker = (p: Permission) => boolean;

function evaluate(rule: Rule, has: Checker): boolean {
  if (typeof rule === "string") return has(rule);
  if ("any" in rule) return rule.any.some(has);
  return rule.all.every(has);
}

function checkerFor(role: string | undefined, permissions: string[] | undefined): Checker {
  if (permissions) {
    const set = new Set(permissions);
    return (p) => set.has(p);
  }
  const legacy = role ? LEGACY[role] : undefined;
  if (legacy === "*") return () => true;
  // M6: single sign-on and the full export are the owner's alone
  if (legacy === "*-payouts") return (p) => !["payouts.manage", "sso.manage", "data.export"].includes(p);
  const set = new Set(legacy ?? []);
  return (p) => set.has(p);
}

/** Whether a role/permission set allows a capability alias or a permission code. */
export function can(role: Role | string | undefined | null, cap: Capability | Permission, permissions?: string[]): boolean {
  if (!role && !permissions) return false;
  const has = checkerFor(role ?? undefined, permissions);
  const rule = (ALIAS as Record<string, Rule>)[cap];
  return rule ? evaluate(rule, has) : has(cap);
}

export function useCan() {
  const me = useMe();
  const role = me.data?.user.role;
  const permissions = me.data?.permissions;
  const has = useMemo(() => checkerFor(role, permissions), [role, permissions]);
  const check = useCallback(
    (cap: Capability | Permission) => {
      if (!role && !permissions) return false;
      const rule = (ALIAS as Record<string, Rule>)[cap];
      return rule ? evaluate(rule, has) : has(cap);
    },
    [has, role, permissions],
  );
  const mine = useMemo(() => new Set(permissions ?? []), [permissions]);
  return {
    role,
    roleName: me.data?.user.roleName ?? null,
    can: check,
    /** the raw permission set (empty until /me has loaded) */
    mine,
    isOwner: role === "OWNER",
    ready: !!role,
  };
}
