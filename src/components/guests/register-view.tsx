"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DownloadSimple, Printer, ShieldCheck } from "@phosphor-icons/react";
import { guestsApi } from "@/lib/api/endpoints-m2";
import { useCan } from "@/lib/permissions";
import { useMe } from "@/lib/api/hooks";
import { toast } from "@/lib/store";
import { addDays, formatDay, lagosHHMM, dayKeyOf, todayKey } from "@/lib/dates";
import { ID_TYPES, PURPOSES } from "@/lib/catalog-m2";
import { formatPhone } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Checkbox, Input } from "@/components/ui/form";
import { EmptyState, ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";

/** The police / security guest book: who stayed, from where, with what ID. */
export function RegisterView() {
  const today = todayKey();
  const [from, setFrom] = useState(addDays(today, -6));
  const [to, setTo] = useState(today);
  const [full, setFull] = useState(false);
  const { can } = useCan();
  const me = useMe();
  const q = useQuery({ queryKey: ["register", from, to], queryFn: () => guestsApi.register(from, to) });
  const csv = useMutation({
    mutationFn: async () => {
      const res = await guestsApi.registerCsv(from, to, full && can("register.fullIds"));
      const blob = await res.blob();
      const name = /filename="?([^"]+)"?/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? `guest-register-${from}-to-${to}.csv`;
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    },
    onSuccess: () => toast.success("Register downloaded", full ? "Full ID numbers were included; the export is in the audit log." : undefined),
    meta: { errorTitle: "Download failed" },
  });
  const rows = q.data?.items ?? [];
  return (
    <>
      <PageHeader
        eyebrow="For the police and security services"
        title={
          <>
            Guest <em>register</em>
          </>
        }
        description="Everyone who checked in, with where they came from, where they're going and the ID they showed. Print it, or download it as a spreadsheet."
        actions={
          <>
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer size={15} /> Print
            </Button>
            <Button onClick={() => csv.mutate()} loading={csv.isPending} data-testid="register-csv">
              <DownloadSimple size={15} weight="bold" /> Download CSV
            </Button>
          </>
        }
      />
      <div className="no-print mb-4 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[12.5px] text-ink-muted">
          From
          <Input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="h-9 w-auto font-mono" />
        </label>
        <label className="flex flex-col gap-1 text-[12.5px] text-ink-muted">
          To
          <Input type="date" value={to} min={from} max={today} onChange={(e) => e.target.value && setTo(e.target.value)} className="h-9 w-auto font-mono" />
        </label>
        <div className="flex gap-1">
          {[
            ["Today", 0],
            ["7 days", 6],
            ["30 days", 29],
          ].map(([l, n]) => (
            <button
              key={l}
              onClick={() => {
                setFrom(addDays(today, -Number(n)));
                setTo(today);
              }}
              className="h-9 rounded-md border border-line bg-surface px-3 text-[12.5px] text-ink-muted hover:text-ink"
            >
              {l}
            </button>
          ))}
        </div>
        {can("register.fullIds") && (
          <div className="ml-auto flex items-center gap-2">
            <Checkbox checked={full} onChange={setFull} label="Include full ID numbers in the download" />
            <ShieldCheck size={15} weight="duotone" className="text-ochre" aria-label="Audited" />
          </div>
        )}
      </div>
      <div className="print-only mb-4">
        <p className="text-[18px] font-semibold">{me.data?.tenant.name} &middot; Guest register</p>
        <p className="text-[12px]">
          {formatDay(from, { day: "numeric", month: "long", year: "numeric" })} to {formatDay(to, { day: "numeric", month: "long", year: "numeric" })}
        </p>
      </div>
      <Panel className="overflow-hidden print:border-0">
        {q.isError ? (
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        ) : q.isLoading ? (
          <Skeleton className="m-5 h-48" />
        ) : !rows.length ? (
          <EmptyState glyph="ladder" title="No check-ins in these dates" />
        ) : (
          <div className="scrollbar-thin overflow-x-auto">
            <table className="w-full min-w-[1080px] text-[12.5px]">
              <thead>
                <tr className="border-b-2 border-double border-line-strong text-left">
                  {["In", "Room", "Guest", "Phone", "Nationality", "ID", "From", "To", "Purpose", "Vehicle", "Pax", "Out"].map((h) => (
                    <th key={h} className="eyebrow whitespace-nowrap px-3 py-2.5 text-[9.5px] font-normal first:pl-5">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.reservationCode + r.checkedInAt} className="border-b border-line align-top">
                    <td className="whitespace-nowrap py-2.5 pl-5 pr-3 font-mono text-[11.5px] text-ink-muted">
                      {formatDay(dayKeyOf(r.checkedInAt), { day: "2-digit", month: "short" })} {lagosHHMM(r.checkedInAt)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-ink">{r.roomNumber}</td>
                    <td className="px-3 py-2.5 text-ink">
                      {r.guestName}
                      <span className="block font-mono text-[10.5px] text-ink-faint">{r.reservationCode}</span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11.5px] text-ink-muted">{formatPhone(r.phone)}</td>
                    <td className="px-3 py-2.5 text-ink-muted">{r.nationality}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-ink-muted">
                      {r.idType ? ID_TYPES[r.idType].split(" ")[0] : "-"} <span className="font-mono">{r.idNumber}</span>
                    </td>
                    <td className="px-3 py-2.5 text-ink-muted">{r.arrivingFrom ?? "-"}</td>
                    <td className="px-3 py-2.5 text-ink-muted">{r.goingTo ?? "-"}</td>
                    <td className="px-3 py-2.5 text-ink-muted">{r.purpose ? PURPOSES[r.purpose] : "-"}</td>
                    <td className="px-3 py-2.5 font-mono text-[11.5px] text-ink-muted">{r.vehiclePlate ?? ""}</td>
                    <td className="px-3 py-2.5 font-mono text-ink-muted">
                      {r.adults}
                      {r.children ? `+${r.children}` : ""}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-[11.5px] text-ink-muted">
                      {r.checkedOutAt ? `${formatDay(dayKeyOf(r.checkedOutAt), { day: "2-digit", month: "short" })} ${lagosHHMM(r.checkedOutAt)}` : "in house"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <p className="mt-3 font-mono text-[11.5px] text-ink-faint">{rows.length} entries</p>
    </>
  );
}
