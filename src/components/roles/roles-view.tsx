"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, LockSimple, Minus, Plus, ShieldCheck, Trash, Warning } from "@phosphor-icons/react";
import { usePermissionCatalog, useRoles, qk4 } from "@/lib/api/hooks-m4";
import { rolesApi } from "@/lib/api/endpoints-m4";
import { isApiError } from "@/lib/api/client";
import type { RoleWire } from "@/lib/api/types-m4";
import { useCan } from "@/lib/permissions";
import { useEntitlements } from "@/lib/auth";
import { mergeCatalog, permissionInfo } from "@/lib/permission-catalog";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/overlay";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { LockedInline } from "@/components/gating/gate";
import { PermissionMatrix, RolePermissionList, diffRole, type Draft, type RoleView } from "./matrix";

export function RolesView() {
  const roles = useRoles();
  const catalog = usePermissionCatalog();
  const { mine, isOwner, can } = useCan();
  const { has } = useEntitlements();
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft>({});
  const [reviewing, setReviewing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [removing, setRemoving] = useState<RoleWire | null>(null);
  const [focusRole, setFocusRole] = useState<string>("");
  const [escalation, setEscalation] = useState<string[] | null>(null);

  const groups = useMemo(() => mergeCatalog(catalog.data?.flatMap((g) => g.permissions.map((p) => ({ ...p, group: g.group })))), [catalog.data]);
  const everything = useMemo(() => new Set(groups.flatMap((g) => g.items.map((i) => i.code))), [groups]);
  const myPerms = isOwner ? everything : mine;
  const customOn = has("custom_roles");
  const canEdit = customOn && can("staff.manage");
  const list: RoleView[] = (roles.data ?? []).map((r) => ({ ...r, system: r.system || !customOn }));
  const changed = list.filter((r) => {
    const d = diffRole(r, draft);
    return d.added.length + d.removed.length > 0;
  });

  const toggle = (roleId: string, codes: string[], on: boolean) =>
    setDraft((d) => {
      const role = list.find((r) => r.id === roleId)!;
      const cur = new Set(d[roleId] ?? role.permissions);
      for (const c of codes) {
        if (on) cur.add(c);
        else cur.delete(c);
      }
      return { ...d, [roleId]: [...cur] };
    });

  const save = useMutation({
    mutationFn: async () => {
      for (const r of changed) await rolesApi.update(r.id, { permissions: draft[r.id] });
    },
    onSuccess: async () => {
      await Promise.all([qc.invalidateQueries({ queryKey: qk4.roles }), qc.invalidateQueries({ queryKey: ["me"] })]);
      toast.success(changed.length === 1 ? `${changed[0].name} saved` : `${changed.length} roles saved`, "Everyone holding them has the new access on their next click. No sign-out needed.");
      setDraft({});
      setReviewing(false);
      setEscalation(null);
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "PERMISSION_ESCALATION") setEscalation((e.details?.missing as string[]) ?? []);
    },
    meta: { errorTitle: "Roles not saved", silentCodes: ["PERMISSION_ESCALATION"] },
  });

  const remove = useMutation({
    mutationFn: (r: RoleWire) => rolesApi.remove(r.id),
    onSuccess: async (_x, r) => {
      await qc.invalidateQueries({ queryKey: qk4.roles });
      toast.success(`${r.name} deleted`);
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "ROLE_IN_USE") toast.error("Still in use", `${e.details?.staffCount ?? "Some"} staff hold this role. Give them another role first.`);
    },
    meta: { errorTitle: "Role not deleted", silentCodes: ["ROLE_IN_USE"] },
  });

  const focused = list.find((r) => r.id === focusRole) ?? list.find((r) => !r.system) ?? list[0];

  return (
    <>
      <Link href="/staff" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> Staff
      </Link>
      <PageHeader
        eyebrow={
          <>
            <ShieldCheck size={14} weight="duotone" /> Roles &amp; permissions
          </>
        }
        title={
          <>
            Who can do <em>what</em>, exactly.
          </>
        }
        description="Built-in roles are locked so they always behave the way the manual says. Clone one to make your own, like a Night Auditor who reads the money but can't refund it. You can only hand out access you hold yourself."
        actions={
          canEdit && (
            <Button onClick={() => setCreating(true)}>
              <Plus size={15} weight="bold" /> New role
            </Button>
          )
        }
      />
      {!customOn && <LockedInline feature="custom_roles" className="mb-5" text="The built-in roles below work on every plan. Your own roles, cloned and tuned, come with the upgrade." />}

      {roles.isError ? (
        <Panel>
          <ErrorState error={roles.error} onRetry={() => roles.refetch()} />
        </Panel>
      ) : !roles.data ? (
        <Skeleton className="h-[520px]" />
      ) : (
        <>
          <Panel className="hidden overflow-hidden md:block">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-line px-5 py-2.5 text-[11.5px] text-ink-muted">
              <span className="inline-flex items-center gap-1.5">
                <span className="grid h-4 w-4 place-items-center rounded-[3px] bg-laterite" /> granted
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-4 w-4 rounded-[3px] border border-line-strong bg-surface-2" /> granted, built-in
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="hatch h-4 w-4 rounded-[3px] border border-dashed border-line-strong text-ink-faint" /> you don&rsquo;t hold it, so you can&rsquo;t give it
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Warning size={11} weight="fill" className="text-ochre" /> sensitive: money or access
              </span>
              <span className="inline-flex items-center gap-1.5">
                <LockSimple size={11} weight="bold" /> built-in, read-only
              </span>
            </div>
            <PermissionMatrix roles={list} groups={groups} mine={myPerms} draft={draft} onToggle={toggle} canEdit={canEdit} />
          </Panel>

          {/* phones: one role at a time */}
          <div className="md:hidden">
            <label htmlFor="role-pick" className="eyebrow mb-1.5 block">
              Role
            </label>
            <Select id="role-pick" value={focused?.id ?? ""} onChange={(e) => setFocusRole(e.target.value)}>
              {list.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.system ? " (built-in)" : ""} &middot; {(draft[r.id] ?? r.permissions).length} permissions
                </option>
              ))}
            </Select>
            {focused && (
              <div className="mt-4">
                {focused.system && <p className="mb-3 text-[12.5px] text-ink-muted">Built-in roles are read-only. Clone it to make your own.</p>}
                <RolePermissionList role={focused} groups={groups} mine={myPerms} draft={draft} onToggle={toggle} canEdit={canEdit} />
              </div>
            )}
          </div>

          {canEdit && (
            <div className="mt-5 flex flex-wrap gap-2">
              {list
                .filter((r) => !r.system)
                .map((r) => (
                  <Button key={r.id} variant="ghost" size="sm" className="text-danger hover:bg-danger-wash hover:text-danger" onClick={() => setRemoving(roles.data!.find((x) => x.id === r.id)!)}>
                    <Trash size={13} /> Delete {r.name}
                  </Button>
                ))}
            </div>
          )}
        </>
      )}

      {/* the save bar */}
      {changed.length > 0 && (
        <div className="fixed inset-x-0 bottom-[68px] z-40 px-4 lg:bottom-6 lg:left-[252px]">
          <div className="mx-auto flex max-w-[760px] items-center gap-3 rounded-lg border border-line-strong bg-surface px-4 py-3 shadow-float animate-[rise_200ms_ease-out]">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-brass-wash text-brass">
              <ShieldCheck size={16} weight="duotone" />
            </span>
            <p className="min-w-0 flex-1 text-[13.5px] text-ink">
              Unsaved changes to <span className="font-medium">{changed.map((r) => r.name).join(", ")}</span>
            </p>
            <Button variant="ghost" size="sm" onClick={() => setDraft({})}>
              Discard
            </Button>
            <Button size="sm" onClick={() => setReviewing(true)}>
              Review and save
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={reviewing}
        onOpenChange={(o) => {
          setReviewing(o);
          if (!o) setEscalation(null);
        }}
        eyebrow="Before you save"
        title="What changes"
        description="People holding these roles get the new access immediately."
        className="max-w-xl"
        footer={
          <>
            <Button variant="secondary" onClick={() => setReviewing(false)}>
              Keep editing
            </Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>
              Save {changed.length === 1 ? "role" : `${changed.length} roles`}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-5">
          {changed.map((r) => {
            const d = diffRole(r, draft);
            return (
              <section key={r.id}>
                <h3 className="flex items-baseline gap-2 text-[14px] font-medium text-ink">
                  {r.name}
                  <span className="font-mono text-[11.5px] font-normal text-ink-muted">
                    {r.staffCount} {r.staffCount === 1 ? "person" : "people"}
                  </span>
                </h3>
                <ul className="mt-2 flex flex-col gap-1">
                  {d.added.map((p) => (
                    <DiffLine key={p} code={p} kind="add" />
                  ))}
                  {d.removed.map((p) => (
                    <DiffLine key={p} code={p} kind="remove" />
                  ))}
                </ul>
              </section>
            );
          })}
          {escalation && (
            <p role="alert" className="rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-wash px-3 py-2.5 text-[12.5px] text-ink">
              The server refused: you don&rsquo;t hold <span className="font-mono">{escalation.join(", ") || "some of these permissions"}</span>, so you can&rsquo;t grant them or edit a role that has them.
            </p>
          )}
        </div>
      </Dialog>

      <NewRoleDialog
        open={creating}
        onOpenChange={setCreating}
        roles={roles.data ?? []}
        mine={myPerms}
        onCreated={(r) => {
          setFocusRole(r.id);
          requestAnimationFrame(() => document.querySelector(`[data-role="${CSS.escape(r.name)}"]`)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" }));
        }}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Delete ${removing?.name ?? ""}?`}
        body={removing?.staffCount ? `${removing.staffCount} staff hold it. Give them another role first.` : "Nobody holds it. This can't be undone."}
        confirmLabel="Delete role"
        danger
        onConfirm={() => (removing ? remove.mutateAsync(removing) : undefined)}
      />
    </>
  );
}

function DiffLine({ code, kind }: { code: string; kind: "add" | "remove" }) {
  const p = permissionInfo(code);
  return (
    <li className={cn("flex items-start gap-2 rounded-sm px-2 py-1.5 text-[13px]", kind === "add" ? "bg-palm-wash/60" : "bg-danger-wash/60")}>
      <span className={cn("mt-0.5", kind === "add" ? "text-palm" : "text-danger")}>{kind === "add" ? <Plus size={13} weight="bold" /> : <Minus size={13} weight="bold" />}</span>
      <span className="min-w-0 flex-1">
        <span className="text-ink">{p.label}</span> <span className="font-mono text-[11px] text-ink-faint">{code}</span>
        {p.sensitive && kind === "add" && (
          <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-ochre">
            <Warning size={11} weight="fill" /> {p.description}
          </span>
        )}
      </span>
    </li>
  );
}

function NewRoleDialog({ open, onOpenChange, roles, mine, onCreated }: { open: boolean; onOpenChange: (o: boolean) => void; roles: RoleWire[]; mine: Set<string>; onCreated: (r: RoleWire) => void }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [from, setFrom] = useState("FRONT_DESK");
  const [err, setErr] = useState<string | null>(null);
  const m = useMutation({
    mutationFn: () => rolesApi.create({ name: name.trim(), description: description.trim() || undefined, cloneFrom: from || undefined, permissions: from ? undefined : [] }),
    onSuccess: async (r) => {
      await qc.invalidateQueries({ queryKey: qk4.roles });
      toast.success(`${r.name} created`, "Tick and untick in its column, then save.");
      onOpenChange(false);
      setName("");
      setDescription("");
      onCreated(r);
    },
    onError: (e) => {
      if (isApiError(e) && e.code === "PERMISSION_ESCALATION") setErr(`You can't clone a role with more access than you have (${((e.details?.missing as string[]) ?? []).join(", ")}).`);
      else if (isApiError(e)) setErr(e.message);
    },
    meta: { silent: true },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setErr(null);
      }}
      eyebrow="Custom role"
      title="A role of your own"
      description="Start from the closest built-in role and adjust it in the matrix."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={name.trim().length < 2} loading={m.isPending} onClick={() => m.mutate()}>
            <Copy size={14} /> Create role
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Name" htmlFor="role-name">
          <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Night Auditor" autoFocus />
        </Field>
        <Field label="What it's for" htmlFor="role-desc" optional>
          <Textarea id="role-desc" className="min-h-14" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Runs the night, reads the money, no refunds" />
        </Field>
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-ink">Start from</legend>
          <div className="grid gap-1.5 sm:grid-cols-2" role="radiogroup">
            {[...roles, { id: "", name: "Nothing", description: "An empty role", permissions: [], system: true } as unknown as RoleWire].map((r) => {
              const missing = r.permissions.filter((p) => !mine.has(p)).length;
              const on = from === r.id;
              return (
                <label
                  key={r.id || "none"}
                  className={cn(
                    "flex flex-col rounded-md border px-3 py-2 transition-colors",
                    missing ? "cursor-not-allowed border-dashed border-line opacity-60" : "cursor-pointer",
                    on ? "border-laterite bg-laterite-wash/40" : !missing && "border-line hover:border-line-strong",
                  )}
                >
                  <input type="radio" className="sr-only" name="clone" checked={on} disabled={!!missing} onChange={() => setFrom(r.id)} />
                  <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink">
                    {r.name}
                    <span className="ml-auto font-mono text-[11px] font-normal text-ink-faint">{r.permissions.length}</span>
                  </span>
                  <span className="text-[11.5px] text-ink-muted">{missing ? `${missing} you don't hold` : r.description}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
        {err && (
          <p role="alert" className="text-[12.5px] text-danger">
            {err}
          </p>
        )}
      </div>
    </Dialog>
  );
}
