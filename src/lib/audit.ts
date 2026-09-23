import {
  Bed,
  Buildings,
  CreditCard,
  Key,
  PencilSimpleLine,
  Plus,
  SignIn,
  Trash,
  UserPlus,
  UsersThree,
  type Icon,
} from "@phosphor-icons/react";
import type { AuditLog, RoomStatus } from "./api/types";
import { ROOM_STATUS } from "./catalog";

export interface AuditLine {
  icon: Icon;
  tone: string;
  actor: string;
  verb: string;
  object?: string;
  detail?: string;
}

const meta = (log: AuditLog) => (log.metadata ?? {}) as Record<string, unknown>;
const str = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : undefined);

function statusLabel(v: unknown) {
  const s = str(v) as RoomStatus | undefined;
  return s && ROOM_STATUS[s] ? ROOM_STATUS[s].label.toLowerCase() : s?.toLowerCase().replace(/_/g, " ");
}

/** Turn an audit row into a readable sentence, tolerant of unknown actions. */
export function describeAudit(log: AuditLog): AuditLine {
  const m = meta(log);
  const actor = log.actor?.fullName ?? "System";
  const number = str(m.number) ?? str(m.roomNumber);
  const action = log.action.toLowerCase();
  const [entity, rawVerb = ""] = action.includes(".") ? action.split(".") : [log.entityType?.toLowerCase() ?? "", action];
  const verb = rawVerb.replace(/_/g, " ");

  if (entity === "room" && (verb.includes("status") || m.to || m.status)) {
    const to = statusLabel(m.to ?? m.status ?? m.newStatus);
    return {
      icon: Key,
      tone: "var(--adire)",
      actor,
      verb: "marked",
      object: number ? `room ${number}` : "a room",
      detail: to ? to : undefined,
    };
  }
  if (entity === "room" && verb.includes("bulk")) {
    return { icon: Plus, tone: "var(--palm)", actor, verb: "added", object: `${str(m.count) ?? "several"} rooms` };
  }
  if (entity === "room" || entity === "rooms") {
    return {
      icon: verb.includes("delet") ? Trash : verb.includes("creat") ? Plus : PencilSimpleLine,
      tone: verb.includes("delet") ? "var(--danger)" : "var(--palm)",
      actor,
      verb: verb.includes("creat") ? "added" : verb.includes("delet") ? "removed" : "updated",
      object: number ? `room ${number}` : "a room",
    };
  }
  if (entity.startsWith("room_type") || entity === "roomtype") {
    return {
      icon: Bed,
      tone: "var(--brass)",
      actor,
      verb: verb.includes("creat") ? "created" : verb.includes("delet") ? "deleted" : "updated",
      object: str(m.name) ? `room type ${str(m.name)}` : "a room type",
    };
  }
  if (entity === "staff" || entity === "user") {
    return {
      icon: verb.includes("creat") || verb.includes("invit") ? UserPlus : UsersThree,
      tone: "var(--laterite)",
      actor,
      verb: verb.includes("creat") || verb.includes("invit") ? "added" : verb.includes("delet") ? "removed" : "updated",
      object: str(m.fullName) ?? "a staff member",
      detail: str(m.role)?.toLowerCase().replace(/_/g, " "),
    };
  }
  if (entity === "property") return { icon: Buildings, tone: "var(--brass)", actor, verb: "updated", object: "property details" };
  if (entity === "auth" || verb.includes("login"))
    return { icon: SignIn, tone: "var(--ink-muted)", actor, verb: "signed in" };
  if (entity.includes("subscription") || entity.includes("billing") || entity === "tenant")
    return {
      icon: CreditCard,
      tone: "var(--brass)",
      actor,
      verb: verb || "changed",
      object: "the subscription",
      detail: str(m.planCode) ?? str(m.status)?.toLowerCase(),
    };
  return {
    icon: PencilSimpleLine,
    tone: "var(--ink-muted)",
    actor,
    verb: verb || "changed",
    object: entity ? entity.replace(/_/g, " ") : undefined,
  };
}
