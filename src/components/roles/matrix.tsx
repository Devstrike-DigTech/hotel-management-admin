"use client";

import { Fragment, useState } from "react";
import { CaretDown, Check, LockSimple, Minus, Warning } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import type { PermissionGroup, PermissionInfo } from "@/lib/permission-catalog";
import { Tip } from "@/components/ui/primitives";

export interface RoleView {
  id: string;
  name: string;
  description?: string | null;
  system: boolean;
  permissions: string[];
  staffCount: number;
  key?: string | null;
}

export type Draft = Record<string, string[]>;

export function effective(role: RoleView, draft: Draft) {
  return new Set(draft[role.id] ?? role.permissions);
}

export function diffRole(role: RoleView, draft: Draft) {
  const before = new Set(role.permissions);
  const after = effective(role, draft);
  return {
    added: [...after].filter((p) => !before.has(p)),
    removed: [...before].filter((p) => !after.has(p)),
  };
}

/**
 * Permission groups down, roles across. System roles are read-only; a custom
 * role's cells toggle. Cells the signed-in user does not hold are disabled with
 * the reason, since nobody can grant what they do not have.
 */
export function PermissionMatrix({
  roles,
  groups,
  mine,
  draft,
  onToggle,
  canEdit,
}: {
  roles: RoleView[];
  groups: PermissionGroup[];
  mine: Set<string>;
  draft: Draft;
  onToggle: (roleId: string, codes: string[], on: boolean) => void;
  canEdit: boolean;
}) {
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const sets = new Map(roles.map((r) => [r.id, effective(r, draft)]));
  const orig = new Map(roles.map((r) => [r.id, new Set(r.permissions)]));

  return (
    <div className="scrollbar-thin max-h-[calc(100dvh-190px)] overflow-auto overscroll-contain">
      <table className="w-full min-w-[720px] border-separate border-spacing-0 text-left">
        <caption className="sr-only">Permissions by role</caption>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 top-0 z-30 w-[300px] min-w-[240px] border-b border-line bg-surface px-4 pb-3 pt-4 align-bottom">
              <span className="eyebrow">Permission</span>
            </th>
            {roles.map((r) => {
              const d = diffRole(r, draft);
              const dirty = d.added.length + d.removed.length > 0;
              return (
                <th key={r.id} scope="col" className="sticky top-0 z-20 min-w-[104px] border-b border-l border-line bg-surface px-2 pb-3 pt-4 text-center align-bottom">
                  <div className="flex flex-col items-center gap-1">
                    {r.system ? (
                      <LockSimple size={12} weight="bold" className="text-ink-faint" aria-label="System role, read-only" />
                    ) : (
                      <span className="rounded-xs border border-[color-mix(in_oklab,var(--laterite)_35%,transparent)] px-1 font-mono text-[9px] uppercase tracking-[0.14em] text-laterite">Custom</span>
                    )}
                    <span className="display-sm text-[13.5px] leading-tight text-ink">{r.name}</span>
                    <span className="font-mono text-[10.5px] text-ink-faint">
                      {r.staffCount} {r.staffCount === 1 ? "person" : "people"}
                    </span>
                    {dirty && (
                      <span className="font-mono text-[10.5px] text-laterite">
                        {d.added.length ? `+${d.added.length}` : ""}
                        {d.added.length && d.removed.length ? " " : ""}
                        {d.removed.length ? `−${d.removed.length}` : ""}
                      </span>
                    )}
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => {
            const open = !closed.has(g.key);
            const codes = g.items.map((i) => i.code);
            return (
              <Fragment key={g.key}>
                <tr className="bg-surface-2/50">
                  <th scope="rowgroup" className="sticky left-0 z-10 border-b border-line bg-[color-mix(in_oklab,var(--surface-2)_50%,var(--surface))] px-2 py-1.5">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setClosed((s) => {
                        const n = new Set(s);
                        if (n.has(g.key)) n.delete(g.key);
                        else n.add(g.key);
                        return n;
                      })}
                      className="flex w-full items-center gap-2 rounded-sm px-2 py-1 text-left hover:bg-surface-2"
                    >
                      <CaretDown size={12} weight="bold" className={cn("text-ink-muted transition-transform", !open && "-rotate-90")} />
                      <span className="text-[12.5px] font-semibold tracking-wide text-ink">{g.label}</span>
                      <span className="font-mono text-[10.5px] text-ink-faint">{g.items.length}</span>
                    </button>
                  </th>
                  {roles.map((r) => {
                    const s = sets.get(r.id)!;
                    const n = codes.filter((c) => s.has(c)).length;
                    const state = n === 0 ? "none" : n === codes.length ? "all" : "some";
                    const locked = r.system || !canEdit;
                    const grantable = codes.filter((c) => mine.has(c));
                    return (
                      <td key={r.id} className="border-b border-l border-line text-center">
                        <button
                          type="button"
                          disabled={locked || !grantable.length}
                          onClick={() => onToggle(r.id, state === "all" ? codes : grantable, state !== "all")}
                          aria-label={`${g.label} for ${r.name}: ${n} of ${codes.length}. ${locked ? "Read-only" : state === "all" ? "Remove all" : "Grant all you can"}`}
                          className="mx-auto flex h-7 items-center gap-1 rounded-sm px-1.5 font-mono text-[10.5px] text-ink-muted enabled:hover:bg-surface-2 enabled:hover:text-ink disabled:cursor-default"
                        >
                          <GroupMark state={state} />
                          {n}/{codes.length}
                        </button>
                      </td>
                    );
                  })}
                </tr>
                {open &&
                  g.items.map((p) => (
                    <tr key={p.code} className="group/row">
                      <th scope="row" className="sticky left-0 z-10 border-b border-line bg-surface px-4 py-2 font-normal group-hover/row:bg-[color-mix(in_oklab,var(--surface-2)_40%,var(--surface))]">
                        <PermLabel p={p} />
                      </th>
                      {roles.map((r) => {
                        const on = sets.get(r.id)!.has(p.code);
                        const was = orig.get(r.id)!.has(p.code);
                        const cantGrant = !mine.has(p.code) && !on;
                        const locked = r.system || !canEdit;
                        const cell = (
                          <button
                            type="button"
                            role="checkbox"
                            aria-checked={on}
                            aria-disabled={locked || cantGrant}
                            aria-label={`${p.label} for ${r.name}`}
                            data-perm={p.code}
                            data-role={r.name}
                            onClick={() => {
                              if (locked || cantGrant) return;
                              onToggle(r.id, [p.code], !on);
                            }}
                            className={cn(
                              "relative mx-auto grid h-7 w-7 place-items-center rounded-sm border transition-[background-color,border-color,transform] duration-150",
                              on
                                ? locked
                                  ? "border-line-strong bg-surface-2 text-ink"
                                  : "border-transparent bg-laterite text-laterite-ink"
                                : cantGrant && !locked
                                  ? "hatch border-dashed border-line-strong text-ink-faint"
                                  : "border-line-strong bg-surface text-transparent",
                              !locked && !cantGrant && "hover:scale-105 hover:border-laterite",
                              locked && "cursor-default",
                              cantGrant && !locked && "cursor-not-allowed",
                            )}
                          >
                            {on && <Check size={13} weight="bold" />}
                            {on !== was && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full border border-surface bg-brass" aria-hidden />}
                          </button>
                        );
                        return (
                          <td key={r.id} className={cn("border-b border-l border-line py-1.5 text-center group-hover/row:bg-[color-mix(in_oklab,var(--surface-2)_40%,var(--surface))]", on !== was && "bg-brass-wash/40")}>
                            {cantGrant && !locked ? (
                              <Tip content="You don't hold this permission yourself, so you can't grant it.">{cell}</Tip>
                            ) : r.system && canEdit ? (
                              <Tip content={`${r.name} is a system role. Clone it to change it.`}>{cell}</Tip>
                            ) : (
                              cell
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GroupMark({ state }: { state: "all" | "some" | "none" }) {
  return (
    <span
      className={cn(
        "grid h-3.5 w-3.5 place-items-center rounded-[3px] border",
        state === "all" ? "border-ink bg-ink text-paper" : state === "some" ? "border-ink text-ink" : "border-line-strong",
      )}
      aria-hidden
    >
      {state === "all" && <Check size={9} weight="bold" />}
      {state === "some" && <Minus size={9} weight="bold" />}
    </span>
  );
}

export function PermLabel({ p }: { p: PermissionInfo }) {
  return (
    <span className="flex min-w-0 flex-col" title={p.code}>
      <span className="flex items-center gap-1.5 text-[13px] text-ink">
        {p.label}
        {p.sensitive && <Warning size={11} weight="fill" className="text-ochre" aria-label="Sensitive" />}
      </span>
      <span className="text-[11.5px] leading-snug text-ink-muted">{p.description}</span>

    </span>
  );
}

/** Phone layout: one role at a time, as a list of switches. */
export function RolePermissionList({
  role,
  groups,
  mine,
  draft,
  onToggle,
  canEdit,
}: {
  role: RoleView;
  groups: PermissionGroup[];
  mine: Set<string>;
  draft: Draft;
  onToggle: (roleId: string, codes: string[], on: boolean) => void;
  canEdit: boolean;
}) {
  const s = effective(role, draft);
  const orig = new Set(role.permissions);
  const locked = role.system || !canEdit;
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => (
        <section key={g.key}>
          <h3 className="eyebrow mb-1.5 px-1">{g.label}</h3>
          <ul className="divide-y divide-line rounded-md border border-line bg-surface">
            {g.items.map((p) => {
              const on = s.has(p.code);
              const cantGrant = !mine.has(p.code) && !on;
              return (
                <li key={p.code} className={cn("flex items-center gap-3 px-3 py-2.5", on !== orig.has(p.code) && "bg-brass-wash/40")}>
                  <div className="min-w-0 flex-1">
                    <PermLabel p={p} />
                    {cantGrant && !locked && <p className="mt-0.5 text-[11px] text-ochre">You can&rsquo;t grant what you don&rsquo;t hold.</p>}
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={p.label}
                    disabled={locked || cantGrant}
                    onClick={() => onToggle(role.id, [p.code], !on)}
                    className={cn(
                      "relative inline-flex h-[26px] w-[44px] shrink-0 items-center rounded-full border transition-colors disabled:opacity-50",
                      on ? "border-laterite bg-laterite" : "border-line-strong bg-surface-2",
                    )}
                  >
                    <span className={cn("inline-block h-5 w-5 rounded-full shadow-sm transition-transform", on ? "translate-x-[20px] bg-laterite-ink" : "translate-x-[2px] bg-surface")} />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
