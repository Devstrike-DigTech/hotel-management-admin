"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { CaretDown, SealCheck } from "@phosphor-icons/react";
import { useShift, useShifts } from "@/lib/api/hooks-m2";
import { shiftsApi } from "@/lib/api/endpoints-m2";
import { useDeskRefresh } from "@/lib/api/mutations-m2";
import type { Shift } from "@/lib/api/types-m2";
import { toast } from "@/lib/store";
import { lagosHHMM } from "@/lib/dates";
import { formatDate, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/form";
import { EmptyState, ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { PaymentsList, VarianceChip, VarianceTable } from "./shift-parts";

export function ApprovalsView() {
  const q = useShifts({ status: "CLOSED", pageSize: 50 });
  return (
    <>
      <PageHeader
        eyebrow="Manager"
        title={
          <>
            Shift <em>approvals</em>
          </>
        }
        description="Closed shifts wait here with their count against the books. Look at the variance, read the cashier's note, then approve."
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      ) : q.isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : !q.data?.items.length ? (
        <Panel>
          <EmptyState glyph="frond" title="Nothing waiting" body="Every closed shift has been approved." />
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {q.data.items.map((s) => (
            <ApprovalCard key={s.id} s={s} />
          ))}
        </div>
      )}
    </>
  );
}

function ApprovalCard({ s }: { s: Shift }) {
  const refresh = useDeskRefresh();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const detail = useShift(open ? s.id : null);
  const m = useMutation({
    mutationFn: () => shiftsApi.approve(s.id, notes.trim() || undefined),
    onSuccess: async () => {
      await refresh();
      toast.success(`${s.user.fullName.split(" ")[0]}'s shift approved`);
    },
    meta: { errorTitle: "Not approved" },
  });
  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="display-sm text-[18px] text-ink">{s.user.fullName}</p>
          <p className="text-[12.5px] text-ink-muted">
            {formatDate(s.openedAt, { weekday: "short", day: "numeric", month: "short", year: undefined })}, {lagosHHMM(s.openedAt)} to{" "}
            {s.closedAt ? lagosHHMM(s.closedAt) : ""} &middot; closed {relativeTime(s.closedAt)}
          </p>
        </div>
        <div className="text-right">
          <p className="eyebrow text-[10px]">Variance</p>
          <VarianceChip v={s.varianceTotalKobo} />
        </div>
      </div>
      <div className="border-t border-line px-5 py-4">
        <VarianceTable s={s} />
        {s.closeNotes && <p className="mt-3 rounded-md bg-paper/70 px-3.5 py-2.5 text-[13px] italic text-ink-muted">&ldquo;{s.closeNotes}&rdquo;</p>}
      </div>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 border-t border-line px-5 py-2.5 text-left text-[12.5px] font-medium text-ink-muted hover:text-ink"
      >
        <CaretDown size={13} className={cn("transition-transform", open && "rotate-180")} />
        {s.paymentsCount ?? ""} payments on this shift
      </button>
      {open && <div className="border-t border-line">{detail.data?.payments ? <PaymentsList payments={detail.data.payments} /> : <Skeleton className="m-4 h-16" />}</div>}
      <div className="flex flex-col gap-2 border-t border-line bg-surface-2/40 px-5 py-3 sm:flex-row sm:items-center">
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Note (optional), e.g. Short covered by cashier" className="h-9 flex-1" aria-label="Approval note" />
        <Button onClick={() => m.mutate()} loading={m.isPending}>
          <SealCheck size={15} weight="bold" /> Approve
        </Button>
      </div>
    </Panel>
  );
}
