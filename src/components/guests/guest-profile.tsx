"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowLeft,
  DownloadSimple,
  Eye,
  EyeSlash,
  IdentificationCard,
  PencilSimple,
  Plus,
  ShieldCheck,
  UserMinus,
  WarningOctagon,
} from "@phosphor-icons/react";
import { useGuest } from "@/lib/api/hooks-m2";
import { guestsApi } from "@/lib/api/endpoints-m2";
import { normalisePhone, useDeskRefresh } from "@/lib/api/mutations-m2";
import type { Guest, GuestUpdate, IdDocument } from "@/lib/api/types-m2";
import { useCan } from "@/lib/permissions";
import { openNewReservation } from "@/lib/store-m2";
import { toast } from "@/lib/store";
import { formatDate, formatPhone, relativeTime } from "@/lib/format";
import { formatDay } from "@/lib/dates";
import { ID_TYPES, ID_TYPE_ORDER, type IdType } from "@/lib/catalog-m2";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/form";
import { ErrorState, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { BalancePill, GuestName, KV, StayBadge } from "@/components/m2/bits";

export function GuestProfile({ id }: { id: string }) {
  const q = useGuest(id);
  const { can } = useCan();
  const [edit, setEdit] = useState(false);
  const [anon, setAnon] = useState(false);
  const g = q.data;
  const exportData = useMutation({
    mutationFn: () => guestsApi.exportData(id),
    onSuccess: (data) => {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `guest-data-${(g?.fullName ?? "guest").toLowerCase().replace(/\s+/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Export downloaded", "The export is recorded in the audit log.");
    },
    meta: { errorTitle: "Export failed" },
  });

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} className="py-24" />;
  if (!g)
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-80 w-full" />
      </div>
    );
  const anonymised = !!g.anonymisedAt;

  return (
    <>
      <Link href="/guests" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> Guests
      </Link>
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow mb-2">
            Guest since {formatDate(g.createdAt, { month: "long", year: "numeric", day: undefined })} &middot; {g.stayCount} {g.stayCount === 1 ? "stay" : "stays"}
          </p>
          <h1 className="display text-[34px] leading-[1.02] text-ink md:text-[44px]">
            {anonymised ? <em className="text-ink-muted">Anonymised guest</em> : <GuestName name={g.fullName} vip={g.vip} />}
          </h1>
        </div>
        {!anonymised && (
          <div className="flex flex-wrap gap-2">
            {can("guest.write") && (
              <Button variant="secondary" onClick={() => setEdit(true)}>
                <PencilSimple size={15} /> Edit
              </Button>
            )}
            {can("reservations.write") && (
              <Button onClick={() => openNewReservation({ guestId: g.id, guestName: g.fullName })}>
                <Plus size={15} weight="bold" /> Book a stay
              </Button>
            )}
          </div>
        )}
      </div>

      {anonymised && (
        <div className="mb-6 flex items-start gap-3 rounded-md border border-line-strong bg-surface-2/60 px-4 py-3">
          <UserMinus size={18} weight="duotone" className="mt-0.5 text-ink-muted" />
          <p className="text-[13.5px] text-ink-muted">
            Personal data was wiped {relativeTime(g.anonymisedAt)} at the guest&rsquo;s request. Stays, folios and invoices are kept for the accounts.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-4">
          <Panel>
            <PanelHeader eyebrow="Contact" title="Details" />
            <dl className="divide-y divide-line px-5 py-1">
              <KV k="Phone" v={<span className="font-mono">{formatPhone(g.phone)}</span>} />
              <KV k="Email" v={<span className="break-all">{g.email ?? "-"}</span>} />
              <KV k="Nationality" v={g.nationality} />
              {g.gender && <KV k="Sex" v={g.gender === "UNDISCLOSED" ? "Not stated" : g.gender === "MALE" ? "Male" : "Female"} />}
              {g.dateOfBirth && <KV k="Born" v={formatDate(g.dateOfBirth)} />}
              {g.address && <KV k="Address" v={g.address} />}
              {g.company && <KV k="Company" v={g.company} />}
              {g.vehiclePlate && <KV k="Vehicle" v={<span className="font-mono">{g.vehiclePlate}</span>} />}
              <KV k="Marketing" v={g.marketingOptIn ? "Opted in" : "No"} />
            </dl>
            {g.notes && <p className="border-t border-line px-5 py-3 text-[13px] italic text-ink-muted">{g.notes}</p>}
          </Panel>
          <IdPanel g={g} />
          {can("guest.ndpa") && !anonymised && (
            <Panel>
              <PanelHeader eyebrow="Nigeria Data Protection Act" title="The guest's data" />
              <div className="flex flex-col gap-3 px-5 py-4">
                <p className="text-[12.5px] leading-relaxed text-ink-muted">
                  {g.consentAt ? `Consent recorded ${formatDate(g.consentAt)}.` : "No consent on record."} A guest can ask for a copy of their data, or
                  for it to be erased. Both are logged.
                </p>
                <Button variant="secondary" onClick={() => exportData.mutate()} loading={exportData.isPending}>
                  <DownloadSimple size={15} /> Export their data (JSON)
                </Button>
                <Button variant="ghost" className="text-danger hover:bg-danger-wash hover:text-danger" onClick={() => setAnon(true)}>
                  <UserMinus size={15} /> Anonymise this guest
                </Button>
              </div>
            </Panel>
          )}
        </div>
        <Panel className="self-start lg:col-span-8">
          <PanelHeader eyebrow="History" title="Stays" />
          {g.stays.length ? (
            <ul className="divide-y divide-line">
              {g.stays.map((s) => (
                <li key={s.id}>
                  <Link href={`/reservations/${s.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-surface-2/50">
                    <span className="w-[86px] font-mono text-[12.5px] text-ink">{s.code}</span>
                    <span className="min-w-[150px] flex-1 text-[13.5px] text-ink">
                      {formatDay(s.arrivalDate, { day: "numeric", month: "short", year: "numeric" })}
                      <span className="text-ink-muted"> &middot; {s.stayType === "DAY_USE" ? "day use" : `${s.nights}n`}</span>
                    </span>
                    <span className="text-[12.5px] text-ink-muted">{s.room ? `Room ${s.room.number}` : s.roomType.name}</span>
                    <StayBadge status={s.status} />
                    <BalancePill kobo={s.balanceKobo} />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-8 text-center text-[13px] italic text-ink-faint">No stays yet.</p>
          )}
        </Panel>
      </div>
      {edit && <EditGuest g={g} onClose={() => setEdit(false)} />}
      <AnonymiseDialog g={g} open={anon} onOpenChange={setAnon} />
    </>
  );
}

function IdPanel({ g }: { g: Guest }) {
  const { can } = useCan();
  const [doc, setDoc] = useState<IdDocument | null>(null);
  const reveal = useMutation({
    mutationFn: () => guestsApi.idDocument(g.id),
    onSuccess: (d) => {
      setDoc(d);
      window.setTimeout(() => setDoc(null), 60_000);
    },
    meta: { errorTitle: "Couldn't open the ID" },
  });
  return (
    <Panel>
      <PanelHeader
        eyebrow="Identification"
        title={g.idType ? ID_TYPES[g.idType] : "No ID on file"}
        actions={
          g.idType && can("id.reveal") ? (
            doc ? (
              <Button size="sm" variant="ghost" onClick={() => setDoc(null)}>
                <EyeSlash size={14} /> Hide
              </Button>
            ) : (
              <Button size="sm" variant="ghost" onClick={() => reveal.mutate()} loading={reveal.isPending}>
                <Eye size={14} /> Reveal
              </Button>
            )
          ) : undefined
        }
      />
      <div className="px-5 py-4">
        <div className="flex items-center gap-3 rounded-md border border-dashed border-line-strong bg-paper/60 px-4 py-3">
          <IdentificationCard size={22} weight="duotone" className="text-ink-muted" />
          <span className="font-mono text-[17px] tracking-[0.12em] text-ink">{doc?.idNumber ?? g.idNumberMasked ?? "-"}</span>
        </div>
        {doc && (
          <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-ochre">
            <ShieldCheck size={13} weight="duotone" /> Revealed for a minute. This view is in the audit log.
          </p>
        )}
        {doc?.idImageUrl && (
          <a href={doc.idImageUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-[12.5px] text-laterite underline underline-offset-4">
            Open the ID image
          </a>
        )}
        {!doc && <p className="mt-2 text-[12px] text-ink-faint">{g.hasIdImage ? "An ID image is on file." : "No ID image on file."}</p>}
      </div>
    </Panel>
  );
}

function EditGuest({ g, onClose }: { g: Guest; onClose: () => void }) {
  const refresh = useDeskRefresh();
  const [f, setF] = useState({
    fullName: g.fullName,
    phone: formatPhone(g.phone),
    email: g.email ?? "",
    company: g.company ?? "",
    address: g.address ?? "",
    nationality: g.nationality,
    idType: (g.idType ?? "") as IdType | "",
    idNumber: "",
    vip: g.vip,
    marketingOptIn: g.marketingOptIn,
    notes: g.notes,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((x) => ({ ...x, [k]: v }));
  const m = useMutation({
    mutationFn: () => {
      const ph = normalisePhone(f.phone);
      if (!ph) throw new Error("Enter a valid phone number");
      const patch: GuestUpdate = {
        fullName: f.fullName.trim(),
        phone: ph,
        email: f.email.trim() || undefined,
        company: f.company.trim() || undefined,
        address: f.address.trim() || undefined,
        nationality: f.nationality.trim() || undefined,
        idType: f.idType || undefined,
        idNumber: f.idNumber.trim() || undefined,
        vip: f.vip,
        marketingOptIn: f.marketingOptIn,
        notes: f.notes,
      };
      return guestsApi.update(g.id, patch);
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Guest updated");
      onClose();
    },
    meta: { errorTitle: "Guest not saved" },
  });
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title="Edit guest"
      className="max-w-xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => m.mutate()} loading={m.isPending}>
            Save
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name" htmlFor="eg-name" className="sm:col-span-2">
          <Input id="eg-name" value={f.fullName} onChange={(e) => set("fullName", e.target.value)} />
        </Field>
        <Field label="Phone" htmlFor="eg-phone">
          <Input id="eg-phone" value={f.phone} onChange={(e) => set("phone", e.target.value)} className="font-mono" />
        </Field>
        <Field label="Email" htmlFor="eg-email" optional>
          <Input id="eg-email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        </Field>
        <Field label="Company" htmlFor="eg-co" optional>
          <Input id="eg-co" value={f.company} onChange={(e) => set("company", e.target.value)} />
        </Field>
        <Field label="Nationality" htmlFor="eg-nat">
          <Input id="eg-nat" value={f.nationality} onChange={(e) => set("nationality", e.target.value)} />
        </Field>
        <Field label="Address" htmlFor="eg-addr" optional className="sm:col-span-2">
          <Input id="eg-addr" value={f.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="ID type" htmlFor="eg-idt">
          <Select id="eg-idt" value={f.idType} onChange={(e) => set("idType", e.target.value as IdType)}>
            <option value="">None</option>
            {ID_TYPE_ORDER.map((t) => (
              <option key={t} value={t}>
                {ID_TYPES[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="New ID number" htmlFor="eg-idn" optional hint={g.idNumberMasked ? `On file: ${g.idNumberMasked}` : undefined}>
          <Input id="eg-idn" value={f.idNumber} onChange={(e) => set("idNumber", e.target.value)} className="font-mono" autoComplete="off" />
        </Field>
        <Field label="Notes" htmlFor="eg-notes" optional className="sm:col-span-2">
          <Textarea id="eg-notes" value={f.notes} onChange={(e) => set("notes", e.target.value)} className="min-h-16" />
        </Field>
        <Checkbox checked={f.vip} onChange={(v) => set("vip", v)} label="VIP guest" />
        <Checkbox checked={f.marketingOptIn} onChange={(v) => set("marketingOptIn", v)} label="Happy to receive offers" />
      </div>
    </Dialog>
  );
}

function AnonymiseDialog({ g, open, onOpenChange }: { g: Guest; open: boolean; onOpenChange: (o: boolean) => void }) {
  const refresh = useDeskRefresh();
  const [reason, setReason] = useState("");
  const [typed, setTyped] = useState("");
  const word = "ANONYMISE";
  const m = useMutation({
    mutationFn: () => guestsApi.anonymise(g.id, reason.trim()),
    onSuccess: async () => {
      await refresh();
      toast.success("Guest anonymised", "Personal details are gone; the accounts are intact.");
      onOpenChange(false);
    },
    meta: { errorTitle: "Not anonymised" },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Right to erasure"
      title={`Anonymise ${g.fullName}?`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => m.mutate()} loading={m.isPending} disabled={typed !== word || reason.trim().length < 4}>
            Anonymise permanently
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-start gap-3 rounded-md bg-danger-wash px-3.5 py-3">
          <WarningOctagon size={18} weight="duotone" className="mt-px shrink-0 text-danger" />
          <p className="text-[13px] text-ink">
            Name, phone, email, date of birth, address, ID number, ID image, vehicle, company and notes are wiped, along with the register entries.
            Stays, folios and invoices stay for the accounts. <strong className="font-medium">This cannot be undone.</strong>
          </p>
        </div>
        <Field label="Why?" htmlFor="an-reason" hint="For the audit log, e.g. Guest emailed an erasure request on 20 Sept.">
          <Textarea id="an-reason" value={reason} onChange={(e) => setReason(e.target.value)} className="min-h-16" />
        </Field>
        <Field label={`Type ${word} to confirm`} htmlFor="an-typed">
          <Input id="an-typed" value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} className="font-mono tracking-widest" autoComplete="off" />
        </Field>
      </div>
    </Dialog>
  );
}
