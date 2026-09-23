"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Bed, LockSimple, Plus, Ruler, Users } from "@phosphor-icons/react";
import { hotelApi } from "@/lib/api/endpoints";
import { qk, useRoomTypes } from "@/lib/api/hooks";
import type { RoomType } from "@/lib/api/types";
import { useEntitlements } from "@/lib/auth";
import { naira } from "@/lib/format";
import { openUpgrade, toast } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { AffixInput, Field, Input, Textarea } from "@/components/ui/form";
import { EmptyState, ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { ConfirmDialog, Sheet } from "@/components/ui/overlay";
import { RowMenu } from "@/components/ui/table";
import { TagInput } from "@/components/ui/tag-input";

export function RoomTypesView() {
  const types = useRoomTypes();
  const params = useSearchParams();
  const router = useRouter();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<RoomType | null>(null);
  const [deleting, setDeleting] = useState<RoomType | null>(null);
  const creating = params.get("new") === "1";

  const del = useMutation({
    mutationFn: (t: RoomType) => hotelApi.deleteRoomType(t.id),
    onSuccess: (_d, t) => {
      toast.success(`${t.name} deleted`);
      void qc.invalidateQueries({ queryKey: qk.roomTypes });
    },
    meta: { errorTitle: "Room type not deleted" },
  });

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Bed size={14} weight="duotone" /> Room types
          </>
        }
        title={
          <>
            What you sell, <em>and for how much</em>.
          </>
        }
        description="Each type carries a nightly rate in naira, an optional hourly rate for short stays, and the details guests see on your booking page."
        actions={
          <Button onClick={() => router.push("/rooms/types?new=1", { scroll: false })}>
            <Plus size={15} weight="bold" /> New room type
          </Button>
        }
      />

      {types.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[112px] w-full rounded-lg" />
          ))}
        </div>
      ) : types.isError ? (
        <Panel>
          <ErrorState error={types.error} onRetry={() => types.refetch()} />
        </Panel>
      ) : !types.data?.length ? (
        <Panel>
          <EmptyState
            glyph="cross"
            title="No room types yet"
            body="Start with the rooms you sell most, like a Standard Queen, then add the rest."
            action={
              <Button onClick={() => router.push("/rooms/types?new=1", { scroll: false })}>
                <Plus size={15} weight="bold" /> New room type
              </Button>
            }
          />
        </Panel>
      ) : (
        <Panel as="div" className="divide-y divide-line">
          {types.data.map((t, i) => (
            <TypeRow key={t.id} t={t} index={i} onEdit={() => setEditing(t)} onDelete={() => setDeleting(t)} />
          ))}
        </Panel>
      )}

      <RoomTypeSheet
        open={creating || !!editing}
        type={editing}
        onOpenChange={(o) => {
          if (!o) {
            setEditing(null);
            if (creating) router.replace("/rooms/types", { scroll: false });
          }
        }}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title={`Delete ${deleting?.name ?? "room type"}?`}
        body={
          deleting?.roomCount
            ? `${deleting.roomCount} rooms use this type. Move them to another type first, or the server will refuse.`
            : "Guests will no longer see this type on your booking page."
        }
        confirmLabel="Delete type"
        danger
        onConfirm={() => (deleting ? del.mutateAsync(deleting) : undefined)}
      />
    </>
  );
}

function TypeRow({ t, index, onEdit, onDelete }: { t: RoomType; index: number; onEdit: () => void; onDelete: () => void }) {
  const { has } = useEntitlements();
  const hourly = has("hourly_bookings");
  return (
    <article className="grid gap-4 px-5 py-5 sm:grid-cols-[48px_minmax(0,1fr)_auto] sm:items-center sm:gap-6 sm:px-6">
      <span className="hidden font-mono text-[12px] text-ink-faint sm:block">{String(index + 1).padStart(2, "0")}</span>
      <div className="min-w-0">
        <div className="flex items-baseline gap-3">
          <h2 className="display-sm text-[21px] leading-tight text-ink">{t.name}</h2>
          <span className="font-mono text-[12px] text-ink-muted">
            {t.roomCount} {t.roomCount === 1 ? "room" : "rooms"}
          </span>
        </div>
        {t.description && <p className="mt-1 max-w-xl text-[13.5px] text-ink-muted">{t.description}</p>}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[12.5px] text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <Users size={14} weight="duotone" /> Sleeps <span className="font-mono text-ink">{t.capacity}</span>
          </span>
          {t.bedType && (
            <span className="inline-flex items-center gap-1.5">
              <Bed size={14} weight="duotone" /> {t.bedType}
            </span>
          )}
          {t.sizeSqm ? (
            <span className="inline-flex items-center gap-1.5">
              <Ruler size={14} weight="duotone" /> <span className="font-mono text-ink">{t.sizeSqm}</span> m&sup2;
            </span>
          ) : null}
          {t.amenities?.slice(0, 4).map((a) => (
            <span key={a} className="rounded-xs border border-line px-1.5 py-px text-[11.5px]">
              {a}
            </span>
          ))}
        </div>
      </div>
      <div className="flex items-center justify-between gap-6 sm:justify-end">
        <div className="text-right">
          <p className="font-mono text-[22px] leading-none tracking-tight text-ink">{naira(t.basePriceKobo)}</p>
          <p className="mt-1 text-[12px] text-ink-muted">per night</p>
        </div>
        <div className="w-px self-stretch bg-line" aria-hidden />
        <div className="min-w-[92px] text-right">
          {!hourly ? (
            <p className="inline-flex items-center gap-1 text-[12px] text-brass">
              <LockSimple size={12} weight="bold" /> Hourly
            </p>
          ) : t.hourlyPriceKobo ? (
            <>
              <p className="font-mono text-[16px] leading-none text-ink">{naira(t.hourlyPriceKobo)}</p>
              <p className="mt-1 text-[12px] text-ink-muted">per hour</p>
            </>
          ) : (
            <p className="text-[12px] text-ink-faint">No hourly rate</p>
          )}
        </div>
        <RowMenu onEdit={onEdit} onDelete={onDelete} label={t.name} deleteLabel="Delete" />
      </div>
    </article>
  );
}

const toNaira = (kobo: number | null | undefined) => (kobo === null || kobo === undefined ? "" : String(Math.round(kobo / 100)));
const toKobo = (v: string) => (v.trim() === "" ? null : Math.round(Number(v.replace(/[^\d.]/g, "")) * 100));

function RoomTypeSheet({
  open,
  type,
  onOpenChange,
}: {
  open: boolean;
  type: RoomType | null;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const { has, requiredPlan } = useEntitlements();
  const hourlyAllowed = has("hourly_bookings");
  const editing = !!type;

  const blank = {
    name: "",
    description: "",
    base: "",
    hourly: "",
    capacity: "2",
    size: "24",
    bedType: "Queen",
    amenities: [] as string[],
  };
  const [form, setForm] = useState(blank);
  const [key, setKey] = useState("");
  const k = `${open}-${type?.id ?? "new"}`;
  if (k !== key) {
    setKey(k);
    setForm(
      type
        ? {
            name: type.name,
            description: type.description ?? "",
            base: toNaira(type.basePriceKobo),
            hourly: toNaira(type.hourlyPriceKobo),
            capacity: String(type.capacity ?? 2),
            bedType: type.bedType ?? "",
            size: type.sizeSqm ? String(type.sizeSqm) : "",
            amenities: type.amenities ?? [],
          }
        : blank,
    );
  }
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const m = useMutation({
    mutationFn: () => {
      const body = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        basePriceKobo: toKobo(form.base) ?? 0,
        ...(hourlyAllowed ? { hourlyPriceKobo: toKobo(form.hourly) } : {}),
        capacity: Number(form.capacity) || 1,
        bedType: form.bedType.trim(),
        sizeSqm: Number(form.size),
        amenities: form.amenities,
      };
      return editing ? hotelApi.updateRoomType(type!.id, body) : hotelApi.createRoomType(body);
    },
    onSuccess: () => {
      toast.success(editing ? `${form.name} saved` : `${form.name} created`);
      void qc.invalidateQueries({ queryKey: qk.roomTypes });
      void qc.invalidateQueries({ queryKey: qk.roomsAll });
      onOpenChange(false);
    },
    meta: { errorTitle: "Room type not saved" },
  });

  const valid = form.name.trim() && toKobo(form.base) && form.bedType.trim() && Number(form.size) >= 1;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={editing ? "Edit room type" : "New room type"}
      title={editing ? type!.name : "Describe the room"}
      width="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)} className="ml-auto">
            Cancel
          </Button>
          <Button loading={m.isPending} disabled={!valid} onClick={() => m.mutate()}>
            {editing ? "Save changes" : "Create room type"}
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
        <Field label="Name" htmlFor="rt-name">
          <Input id="rt-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Deluxe King" autoFocus />
        </Field>
        <Field label="Description" htmlFor="rt-desc" optional hint="Shown to guests on your booking page.">
          <Textarea id="rt-desc" rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>

        <div className="rounded-md border border-line bg-paper/50 p-4">
          <p className="eyebrow mb-3">Rates</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nightly rate" htmlFor="rt-base">
              <AffixInput
                id="rt-base"
                prefix="₦"
                suffix="/night"
                inputMode="numeric"
                className="font-mono"
                value={form.base}
                onChange={(e) => set("base", e.target.value.replace(/[^\d]/g, ""))}
                placeholder="65000"
              />
            </Field>
            <Field
              label="Hourly rate"
              htmlFor="rt-hourly"
              optional={hourlyAllowed}
              locked={hourlyAllowed ? undefined : requiredPlan("hourly_bookings").name}
              hint={hourlyAllowed ? "Leave empty if you don't sell short stays." : undefined}
            >
              <div className="relative">
                <AffixInput
                  id="rt-hourly"
                  prefix="₦"
                  suffix="/hour"
                  inputMode="numeric"
                  disabled={!hourlyAllowed}
                  value={hourlyAllowed ? form.hourly : ""}
                  onChange={(e) => set("hourly", e.target.value.replace(/[^\d]/g, ""))}
                  placeholder={hourlyAllowed ? "15000" : "Locked"}
                />
                {!hourlyAllowed && (
                  <button
                    type="button"
                    onClick={() => openUpgrade({ kind: "feature", feature: "hourly_bookings" })}
                    className="absolute inset-0 rounded-md"
                    aria-label="Hourly bookings are locked. See upgrade options"
                  />

                )}
              </div>
            </Field>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <Field label="Sleeps" htmlFor="rt-cap">
            <Input id="rt-cap" type="number" min={1} className="font-mono" value={form.capacity} onChange={(e) => set("capacity", e.target.value)} />
          </Field>
          <Field label="Bed" htmlFor="rt-bed">
            <Input id="rt-bed" value={form.bedType} onChange={(e) => set("bedType", e.target.value)} placeholder="King" />
          </Field>
          <Field label="Size" htmlFor="rt-size">
            <AffixInput id="rt-size" suffix="m²" inputMode="numeric" className="font-mono" value={form.size} onChange={(e) => set("size", e.target.value.replace(/[^\d]/g, ""))} />
          </Field>
        </div>
        <Field label="Amenities" htmlFor="rt-amen" hint="Press Enter or comma to add.">
          <TagInput id="rt-amen" value={form.amenities} onChange={(v) => set("amenities", v)} placeholder="Air conditioning, Smart TV" />
        </Field>
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
