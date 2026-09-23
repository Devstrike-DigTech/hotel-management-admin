"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUUpLeft, Package, Plus, Trash } from "@phosphor-icons/react";
import { useLostFound } from "@/lib/api/hooks-m4";
import { lostFoundApi } from "@/lib/api/endpoints-m4";
import { useRooms } from "@/lib/api/hooks";
import type { LostFoundItem, LostFoundStatus } from "@/lib/api/types-m4";
import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/store";
import { formatDate, relativeTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, Input, Select } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, Panel, Skeleton } from "@/components/ui/primitives";
import { ChipRadio } from "@/components/m2/bits";

const STATUS: Record<LostFoundStatus, { label: string; tone: "brass" | "palm" | "neutral" }> = {
  HELD: { label: "Held", tone: "brass" },
  RETURNED: { label: "Returned", tone: "palm" },
  DISPOSED: { label: "Disposed", tone: "neutral" },
};
const CATEGORIES = ["Phone", "Charger", "Clothing", "Jewellery", "Documents", "Wallet", "Other"];

/** The lost and found book: what was found, where, who holds it, and how it left. */
export function LostFound() {
  const [status, setStatus] = useState<LostFoundStatus | "">("HELD");
  const q = useLostFound({ status });
  const { can } = useCan();
  const [logging, setLogging] = useState(false);
  const [returning, setReturning] = useState<LostFoundItem | null>(null);
  const qc = useQueryClient();
  const upd = useMutation({
    mutationFn: (v: { id: string; status: LostFoundStatus; returnedTo?: string }) => lostFoundApi.update(v.id, { status: v.status, returnedTo: v.returnedTo }),
    onSuccess: async (it) => {
      await qc.invalidateQueries({ queryKey: ["lost-found"] });
      toast.success(it.status === "RETURNED" ? `Returned to ${it.returnedTo}` : `${it.description} marked ${STATUS[it.status].label.toLowerCase()}`);
      setReturning(null);
    },
    meta: { errorTitle: "Not updated" },
  });
  const [to, setTo] = useState("");

  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3.5">
        <ChipRadio
          label="Status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "HELD", label: "Held" },
            { value: "RETURNED", label: "Returned" },
            { value: "DISPOSED", label: "Disposed" },
            { value: "", label: "All" },
          ]}
        />
        {can("housekeeping.work") && (
          <Button size="sm" className="ml-auto" onClick={() => setLogging(true)}>
            <Plus size={14} weight="bold" /> Log an item
          </Button>
        )}
      </div>
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="p-5">
          <Skeleton className="h-24" />
        </div>
      ) : !q.data.items.length ? (
        <EmptyState compact glyph="dots" title={status === "HELD" ? "Nothing held right now" : "Nothing here"} body="Log what housekeeping finds so it can be returned or cleared after 30 days." />
      ) : (
        <ul className="divide-y divide-line">
          {q.data.items.map((it) => (
            <li key={it.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 px-5 py-3.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-surface-2 text-ink-muted">
                <Package size={16} weight="duotone" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] text-ink">
                  {it.description} <span className="text-[12px] text-ink-muted">&middot; {it.category}</span>
                </p>
                <p className="text-[12px] text-ink-muted">
                  {it.room ? (
                    <>
                      Room <span className="font-mono">{it.room.number}</span>
                    </>
                  ) : (
                    it.location
                  )}
                  , found {relativeTime(it.foundAt)} by {it.foundBy?.fullName ?? "staff"}
                  {it.storageLocation && <> &middot; kept in {it.storageLocation}</>}
                </p>
                {it.guest && (
                  <p className="text-[12px] text-ink-muted">
                    Last guest: <span className="text-ink">{it.guest.fullName}</span>
                    {it.reservationCode && <span className="font-mono"> {it.reservationCode}</span>}
                  </p>
                )}
                {it.status === "RETURNED" && <p className="text-[12px] text-palm">Returned to {it.returnedTo} on {formatDate(it.returnedAt)}</p>}
                {it.status === "DISPOSED" && <p className="text-[12px] text-ink-faint">Disposed on {formatDate(it.disposedAt)}{it.notes ? `. ${it.notes}` : ""}</p>}
              </div>
              <Badge tone={STATUS[it.status].tone}>{STATUS[it.status].label}</Badge>
              {it.status === "HELD" && can("housekeeping.work") && (
                <div className="flex gap-1">
                  <Button size="sm" variant="secondary" onClick={() => { setTo(it.guest?.fullName ?? ""); setReturning(it); }}>
                    <ArrowUUpLeft size={13} /> Returned
                  </Button>
                  <Button size="sm" variant="ghost" aria-label={`Dispose of ${it.description}`} onClick={() => upd.mutate({ id: it.id, status: "DISPOSED" })}>
                    <Trash size={13} />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      <LogDialog open={logging} onOpenChange={setLogging} />
      <Dialog
        open={!!returning}
        onOpenChange={(o) => !o && setReturning(null)}
        title={`Return ${returning?.description ?? ""}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReturning(null)}>
              Cancel
            </Button>
            <Button disabled={to.trim().length < 2} loading={upd.isPending} onClick={() => returning && upd.mutate({ id: returning.id, status: "RETURNED", returnedTo: to.trim() })}>
              Mark returned
            </Button>
          </>
        }
      >
        <Field label="Returned to" htmlFor="lf-to" hint="The guest's name, or who collected it and how (courier, in person).">
          <Input id="lf-to" value={to} onChange={(e) => setTo(e.target.value)} autoFocus />
        </Field>
      </Dialog>
    </Panel>
  );
}

function LogDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const rooms = useRooms();
  const qc = useQueryClient();
  const [f, setF] = useState({ description: "", category: "Other", roomId: "", location: "", storageLocation: "Front desk safe" });
  const m = useMutation({
    mutationFn: () => lostFoundApi.create({ description: f.description.trim(), category: f.category, roomId: f.roomId || undefined, location: f.roomId ? undefined : f.location || undefined, storageLocation: f.storageLocation || undefined }),
    onSuccess: async (it) => {
      await qc.invalidateQueries({ queryKey: ["lost-found"] });
      toast.success(`${it.description} logged`, it.guest ? `Linked to ${it.guest.fullName}, the room's last guest.` : undefined);
      onOpenChange(false);
      setF({ description: "", category: "Other", roomId: "", location: "", storageLocation: "Front desk safe" });
    },
    meta: { errorTitle: "Not logged" },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Lost and found"
      title="Log a found item"
      description="The room's last guest is linked automatically."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={f.description.trim().length < 2 || (!f.roomId && !f.location.trim())} loading={m.isPending} onClick={() => m.mutate()}>
            Log it
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="What was found" htmlFor="lf-desc">
          <Input id="lf-desc" value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} placeholder="Black phone charger" autoFocus />
        </Field>
        <ChipRadio label="Category" value={f.category} onChange={(v) => setF({ ...f, category: v })} options={CATEGORIES.map((c) => ({ value: c, label: c }))} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Room" htmlFor="lf-room">
            <Select id="lf-room" value={f.roomId} onChange={(e) => setF({ ...f, roomId: e.target.value })}>
              <option value="">Not a room</option>
              {rooms.data?.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number}
                </option>
              ))}
            </Select>
          </Field>
          {!f.roomId && (
            <Field label="Where" htmlFor="lf-where">
              <Input id="lf-where" value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="Pool bar" />
            </Field>
          )}
        </div>
        <Field label="Kept in" htmlFor="lf-store">
          <Input id="lf-store" value={f.storageLocation} onChange={(e) => setF({ ...f, storageLocation: e.target.value })} />
        </Field>
      </div>
    </Dialog>
  );
}
