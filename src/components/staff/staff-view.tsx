"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowsClockwise, UserPlus, UsersThree } from "@phosphor-icons/react";
import { hotelApi } from "@/lib/api/endpoints";
import { qk, useMe, useStaff } from "@/lib/api/hooks";
import type { Role, Staff } from "@/lib/api/types";
import { ROLES, ROLE_ORDER, type Tone } from "@/lib/catalog";
import { formatPhone, initials, relativeTime } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { AffixInput, Field, Input } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, Meter, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { ConfirmDialog, Sheet } from "@/components/ui/overlay";
import { RowMenu, Th } from "@/components/ui/table";

const ROLE_TONE: Record<Role, Tone> = {
  OWNER: "laterite",
  MANAGER: "brass",
  FRONT_DESK: "adire",
  HOUSEKEEPING: "palm",
  ACCOUNTANT: "neutral",
};

export function StaffView() {
  const staff = useStaff();
  const me = useMe();
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Staff | null>(null);
  const [removing, setRemoving] = useState<Staff | null>(null);
  const creating = params.get("new") === "1";

  const del = useMutation({
    mutationFn: (s: Staff) => hotelApi.deleteStaff(s.id),
    onSuccess: (_d, s) => {
      toast.success(`${s.fullName} no longer has access`);
      void qc.invalidateQueries({ queryKey: qk.staff });
      void qc.invalidateQueries({ queryKey: qk.me });
    },
    meta: { errorTitle: "Staff member not removed" },
  });

  const max = me.data?.entitlements.limits.max_staff;
  const used = me.data?.entitlements.usage.staff ?? staff.data?.length ?? 0;
  const canManage = me.data ? ["OWNER", "MANAGER"].includes(me.data.user.role) : true;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <UsersThree size={14} weight="duotone" /> Staff
          </>
        }
        title={
          <>
            The people <em>behind the desk</em>.
          </>
        }
        description="Everyone who can sign in to this hotel. Roles decide what each person can see and change."
        actions={
          canManage && (
            <Button onClick={() => router.push("/staff?new=1", { scroll: false })}>
              <UserPlus size={15} weight="bold" /> Add staff
            </Button>
          )
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <Panel className="self-start overflow-hidden">
          {staff.isLoading ? (
            <div className="flex flex-col gap-3 p-5">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                </div>
              ))}
            </div>
          ) : staff.isError ? (
            <ErrorState error={staff.error} onRetry={() => staff.refetch()} />
          ) : !staff.data?.length ? (
            <EmptyState glyph="eye" title="Just you for now" body="Add your front desk, housekeeping and managers so each has their own sign-in." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] border-collapse text-left text-[13.5px]">
                <thead>
                  <tr className="border-b border-line text-ink-muted">
                    <Th className="pl-5">Name</Th>
                    <Th>Role</Th>
                    <Th>Phone</Th>
                    <Th>Last seen</Th>
                    <Th className="w-14 pr-5">
                      <span className="sr-only">Actions</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {staff.data.map((s) => {
                    const self = s.id === me.data?.user.id;
                    return (
                      <tr key={s.id} className="border-b border-line last:border-b-0 hover:bg-surface-2/50">
                        <td className="py-3 pl-5">
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                "grid h-9 w-9 shrink-0 place-items-center rounded-full border font-mono text-[11.5px] font-medium",
                              )}
                              style={{
                                color: `var(--${ROLE_TONE[s.role] === "neutral" ? "ink-muted" : ROLE_TONE[s.role]})`,
                                borderColor: "var(--line-strong)",
                                background: "var(--paper)",
                              }}
                            >
                              {initials(s.fullName)}
                            </span>
                            <div className="min-w-0">
                              <p className="truncate font-medium text-ink">
                                {s.fullName} {self && <span className="font-normal text-ink-faint">(you)</span>}
                              </p>
                              <p className="truncate text-[12.5px] text-ink-muted">{s.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-3">
                          <Badge tone={ROLE_TONE[s.role]}>{ROLES[s.role]?.label ?? s.role}</Badge>
                        </td>
                        <td className="py-3 font-mono text-[12.5px] text-ink-muted">{formatPhone(s.phone)}</td>
                        <td className="py-3 text-[12.5px] text-ink-muted">
                          {s.lastLoginAt ? relativeTime(s.lastLoginAt) : <span className="text-ink-faint">Never signed in</span>}
                        </td>
                        <td className="py-3 pr-5 text-right">
                          {canManage && s.role !== "OWNER" && !self && (
                            <RowMenu label={s.fullName} onEdit={() => setEditing(s)} onDelete={() => setRemoving(s)} deleteLabel="Remove access" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <aside className="flex flex-col gap-4">
          <Panel className="p-5">
            <p className="eyebrow mb-3">Seats</p>
            {me.data ? <Meter label="Staff seats in use" used={used} max={max} /> : <Skeleton className="h-8 w-full" />}
            <p className="mt-3 text-[12.5px] leading-relaxed text-ink-muted">
              Each person gets their own sign-in, so the audit log always shows who did what.
            </p>
          </Panel>
          <Panel className="p-5">
            <p className="eyebrow mb-3">Roles</p>
            <dl className="flex flex-col gap-3">
              {ROLE_ORDER.map((r) => (
                <div key={r}>
                  <dt>
                    <Badge tone={ROLE_TONE[r]}>{ROLES[r].label}</Badge>
                  </dt>
                  <dd className="mt-1 text-[12.5px] text-ink-muted">{ROLES[r].description}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </aside>
      </div>

      <StaffSheet
        open={creating || !!editing}
        member={editing}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            if (creating) router.replace("/staff", { scroll: false });
          }
        }}
      />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(o) => !o && setRemoving(null)}
        title={`Remove ${removing?.fullName ?? ""}?`}
        body="They will be signed out and can no longer access this hotel. Their past actions stay in the audit log."
        confirmLabel="Remove access"
        danger
        onConfirm={() => (removing ? del.mutateAsync(removing) : undefined)}
      />
    </>
  );
}

function generatePassword() {
  const words = ["Palm", "Brass", "Lagoon", "Kola", "Indigo", "Harmattan", "Ember", "Laterite"];
  const w = words[Math.floor(Math.random() * words.length)];
  return `${w}${Math.floor(1000 + Math.random() * 9000)}!`;
}

function StaffSheet({ open, member, onOpenChange }: { open: boolean; member: Staff | null; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const editing = !!member;
  const [form, setForm] = useState({ fullName: "", email: "", phone: "", role: "FRONT_DESK" as Role, password: "" });
  const [key, setKey] = useState("");
  const k = `${open}-${member?.id ?? "new"}`;
  if (k !== key) {
    setKey(k);
    setForm(
      member
        ? { fullName: member.fullName, email: member.email, phone: (member.phone ?? "").replace(/^\+234/, ""), role: member.role, password: "" }
        : { fullName: "", email: "", phone: "", role: "FRONT_DESK", password: generatePassword() },
    );
  }
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const m = useMutation({
    mutationFn: () => {
      const phone = form.phone ? `+234${form.phone.replace(/\D/g, "").replace(/^0/, "")}` : "";
      if (editing) {
        return hotelApi.updateStaff(member!.id, {
          fullName: form.fullName.trim(),
          phone,
          role: form.role,
          ...(form.password ? { password: form.password } : {}),
        });
      }
      return hotelApi.createStaff({ fullName: form.fullName.trim(), email: form.email.trim(), phone, role: form.role, password: form.password });
    },
    onSuccess: () => {
      toast.success(
        editing ? `${form.fullName} updated` : `${form.fullName} can now sign in`,
        editing ? undefined : `Share their temporary password: ${form.password}`,
      );
      void qc.invalidateQueries({ queryKey: qk.staff });
      void qc.invalidateQueries({ queryKey: qk.me });
      onOpenChange(false);
    },
    meta: { errorTitle: editing ? "Changes not saved" : "Staff member not added" },
  });

  const valid = form.fullName.trim() && /\S+@\S+\.\S+/.test(form.email) && (editing || form.password.length >= 8);
  const roles = ROLE_ORDER.filter((r) => r !== "OWNER");

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={editing ? "Edit staff" : "Add staff"}
      title={editing ? member!.fullName : "Give someone a key"}
      description={editing ? member!.email : "They sign in with their email and the password you set."}
      width="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="ml-auto">
            Cancel
          </Button>
          <Button loading={m.isPending} disabled={!valid} onClick={() => m.mutate()}>
            {editing ? "Save changes" : "Add staff member"}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) m.mutate();
        }}
      >
        <Field label="Full name" htmlFor="st-name">
          <Input id="st-name" value={form.fullName} onChange={(e) => set("fullName", e.target.value)} placeholder="Blessing Eze" autoFocus />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Email" htmlFor="st-email">
            <Input id="st-email" type="email" disabled={editing} title={editing ? "Email can't be changed" : undefined} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="blessing@yourhotel.ng" />
          </Field>
          <Field label="Phone" htmlFor="st-phone">
            <AffixInput id="st-phone" prefix="+234" inputMode="tel" className="font-mono" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="803 123 4567" />
          </Field>
        </div>

        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-ink">Role</legend>
          <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
            {roles.map((r) => {
              const on = form.role === r;
              return (
                <label
                  key={r}
                  className={cn(
                    "flex cursor-pointer flex-col gap-0.5 rounded-md border px-3 py-2.5 transition-colors",
                    on ? "border-laterite bg-laterite-wash/40" : "border-line hover:border-line-strong",
                  )}
                >
                  <input type="radio" name="role" className="sr-only" checked={on} onChange={() => set("role", r)} />
                  <span className="text-[13.5px] font-medium text-ink">{ROLES[r].label}</span>
                  <span className="text-[12px] text-ink-muted">{ROLES[r].description}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <Field
          label={editing ? "Reset password" : "Temporary password"}
          htmlFor="st-pass"
          optional={editing}
          hint={editing ? "Leave empty to keep their current password." : "At least 8 characters. Ask them to change it after signing in."}
        >
          <div className="flex gap-2">
            <Input id="st-pass" className="font-mono" value={form.password} onChange={(e) => set("password", e.target.value)} />
            <Button type="button" variant="secondary" onClick={() => set("password", generatePassword())} aria-label="Generate password">
              <ArrowsClockwise size={15} />
            </Button>
          </div>
        </Field>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
