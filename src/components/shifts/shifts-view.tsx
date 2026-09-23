"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Coins, EyeSlash, LockKey, Play, Stop } from "@phosphor-icons/react";
import { useCurrentShift, useShifts } from "@/lib/api/hooks-m2";
import { shiftsApi } from "@/lib/api/endpoints-m2";
import { useDeskRefresh } from "@/lib/api/mutations-m2";
import type { ShiftDetail } from "@/lib/api/types-m2";
import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/store";
import { formatDuration, lagosHHMM } from "@/lib/dates";
import { formatDate, naira } from "@/lib/format";
import { SHIFT_STATUS } from "@/lib/catalog-m2";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, Textarea } from "@/components/ui/form";
import { Badge, EmptyState, PageHeader, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { NairaInput } from "@/components/m2/bits";
import { DenominationCounter, countsTotalKobo, emptyCounts, type Counts } from "./denomination-counter";
import { PaymentsList, VarianceChip, VarianceHeadline, VarianceTable } from "./shift-parts";

export function ShiftsView() {
  const { can, ready } = useCan();
  if (ready && !can("shift.own"))
    return (
      <>
        <PageHeader eyebrow="Cashiers" title={<><em>Shifts</em></>} description="Every cashier shift with its count against the books." />
        <History />
      </>
    );
  return <MyShift />;
}

function MyShift() {
  const current = useCurrentShift();
  const [closing, setClosing] = useState(false);
  const [result, setResult] = useState<ShiftDetail | null>(null);
  const now = useNow(60_000);
  const s = current.data;

  if (result) return <Reveal s={result} onDone={() => setResult(null)} />;
  if (closing && s) return <CloseShift shiftId={s.id} float={s.openingFloatKobo} openedAt={s.openedAt} onCancel={() => setClosing(false)} onClosed={(d) => { setClosing(false); setResult(d); }} />;

  return (
    <>
      <PageHeader
        eyebrow="Cashier"
        title={
          <>
            My <em>shift</em>
          </>
        }
        description="Every cash, transfer and POS payment you take is counted against your till. You close with a blind count: the expected totals stay hidden until you've counted."
      />
      {current.isLoading ? (
        <Skeleton className="h-56 w-full" />
      ) : s ? (
        <Panel className="overflow-hidden">
          <div className="grid gap-0 md:grid-cols-[1fr_320px]">
            <div className="flex flex-col gap-5 px-6 py-6">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-[breathe_2s_ease-in-out_infinite] rounded-full bg-palm" />
                </span>
                <span className="eyebrow text-palm">Open</span>
              </div>
              <div className="grid grid-cols-3 gap-6">
                <Big label="Opened" value={lagosHHMM(s.openedAt)} sub={formatDate(s.openedAt, { weekday: "short", day: "numeric", month: "short", year: undefined })} />
                <Big label="On shift" value={formatDuration(now - +new Date(s.openedAt))} />
                <Big label="Float" value={naira(s.openingFloatKobo)} />
              </div>
              <p className="flex items-start gap-2 rounded-md border border-dashed border-line-strong bg-paper/60 px-3.5 py-2.5 text-[12.5px] text-ink-muted">
                <EyeSlash size={15} className="mt-px shrink-0" />
                Your takings are hidden while the shift is open. Count honestly; the variance is shown the moment you submit.
              </p>
            </div>
            <div className="flex flex-col justify-center gap-3 border-t border-line bg-surface-2/40 px-6 py-6 md:border-l md:border-t-0">
              <p className="display-sm text-[17px] text-ink">End of shift?</p>
              <p className="text-[13px] text-ink-muted">Count the drawer note by note, then enter the POS and transfer totals.</p>
              <Button size="lg" onClick={() => setClosing(true)} data-testid="close-shift">
                <Stop size={16} weight="fill" /> Close and count
              </Button>
            </div>
          </div>
        </Panel>
      ) : (
        <OpenShift />
      )}
      <History />
    </>
  );
}

function Big({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="display-sm text-[13.5px] italic text-ink-muted">{label}</p>
      <p className="mt-1 font-mono text-[24px] leading-none text-ink md:text-[28px]">{value}</p>
      {sub && <p className="mt-1 text-[12px] text-ink-faint">{sub}</p>}
    </div>
  );
}

function OpenShift() {
  const refresh = useDeskRefresh();
  const [float, setFloat] = useState<number | null>(2000000);
  const [notes, setNotes] = useState("");
  const m = useMutation({
    mutationFn: () => shiftsApi.open(float ?? 0, notes.trim() || undefined),
    onSuccess: async () => {
      await refresh();
      toast.success("Shift opened", "Payments you take now go to your till.");
    },
    meta: { errorTitle: "Shift not opened" },
  });
  return (
    <Panel className="overflow-hidden">
      <div className="grid md:grid-cols-[1fr_360px]">
        <div className="flex flex-col justify-center gap-2 px-6 py-7">
          <Coins size={28} weight="duotone" className="text-brass" />
          <p className="display-sm text-[22px] text-ink">No shift open</p>
          <p className="max-w-md text-[13.5px] text-ink-muted">
            Count the float you are starting with and open your shift. You can&rsquo;t take cash, transfer or POS payments without one.
          </p>
        </div>
        <div className="flex flex-col gap-4 border-t border-line bg-surface-2/40 px-6 py-6 md:border-l md:border-t-0">
          <Field label="Opening float" htmlFor="open-float">
            <NairaInput id="open-float" kobo={float} onChange={setFloat} large />
          </Field>
          <Field label="Note" htmlFor="open-notes" optional>
            <Textarea id="open-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-14" placeholder="Handover from night shift ..." />
          </Field>
          <Button size="lg" onClick={() => m.mutate()} loading={m.isPending} data-testid="open-shift">
            <Play size={16} weight="fill" /> Open shift
          </Button>
        </div>
      </div>
    </Panel>
  );
}

function CloseShift({
  shiftId,
  float,
  openedAt,
  onCancel,
  onClosed,
}: {
  shiftId: string;
  float: number;
  openedAt: string;
  onCancel: () => void;
  onClosed: (d: ShiftDetail) => void;
}) {
  const refresh = useDeskRefresh();
  const [counts, setCounts] = useState<Counts>(emptyCounts());
  const [loose, setLoose] = useState(0);
  const [pos, setPos] = useState<number | null>(null);
  const [trf, setTrf] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [confirm, setConfirm] = useState(false);
  const cash = countsTotalKobo(counts, loose);
  const m = useMutation({
    mutationFn: () =>
      shiftsApi.close(shiftId, {
        countedCashKobo: cash,
        declaredPosKobo: pos ?? 0,
        declaredTransferKobo: trf ?? 0,
        denominations: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, v])),
        notes: notes.trim() || undefined,
      }),
    onSuccess: async (d) => {
      await refresh();
      onClosed(d);
    },
    meta: { errorTitle: "Shift not closed" },
  });
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <LockKey size={14} weight="duotone" /> Blind count &middot; shift from {lagosHHMM(openedAt)}
          </>
        }
        title={
          <>
            Count the <em>drawer</em>
          </>
        }
        description="Count what is physically there. The system's expected totals appear only after you submit."
        actions={
          <Button variant="ghost" onClick={onCancel}>
            Not yet
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-12">
        <Panel className="lg:col-span-7">
          <PanelHeader eyebrow="Step 1" title="Cash, note by note" description={`Include the ${naira(float)} float you opened with.`} />
          <div className="px-5 pb-2">
            <DenominationCounter counts={counts} onChange={setCounts} loose={loose} onLoose={setLoose} />
          </div>
          <div className="flex items-baseline justify-between border-t-2 border-double border-line-strong px-5 py-4">
            <span className="display-sm text-[17px] text-ink">Cash counted</span>
            <span className="font-mono text-[30px] leading-none tracking-tight text-ink" data-testid="cash-total">
              {naira(cash)}
            </span>
          </div>
        </Panel>
        <div className="flex flex-col gap-6 lg:col-span-5">
          <Panel>
            <PanelHeader eyebrow="Step 2" title="Cards and transfers" description="From the POS end-of-day slip and your bank alerts." />
            <div className="flex flex-col gap-4 px-5 py-5">
              <Field label="POS settlement total" htmlFor="close-pos">
                <NairaInput id="close-pos" kobo={pos} onChange={setPos} />
              </Field>
              <Field label="Transfers received" htmlFor="close-trf">
                <NairaInput id="close-trf" kobo={trf} onChange={setTrf} />
              </Field>
              <Field label="Note for the manager" htmlFor="close-notes" optional>
                <Textarea id="close-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-16" />
              </Field>
            </div>
          </Panel>
          <Panel className="px-5 py-5">
            <dl className="flex flex-col gap-1.5 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Cash</dt>
                <dd className="font-mono text-ink">{naira(cash)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">POS</dt>
                <dd className="font-mono text-ink">{naira(pos ?? 0)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Transfers</dt>
                <dd className="font-mono text-ink">{naira(trf ?? 0)}</dd>
              </div>
            </dl>
            <Button size="lg" className="mt-4 w-full" onClick={() => setConfirm(true)} data-testid="submit-count">
              Submit my count
            </Button>
          </Panel>
        </div>
      </div>
      <Dialog
        open={confirm}
        onOpenChange={setConfirm}
        title="Submit this count?"
        description="Once submitted the shift is closed and your count can't be changed. The expected totals are revealed next."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              Recount
            </Button>
            <Button onClick={() => m.mutate()} loading={m.isPending} data-testid="confirm-count">
              Submit {naira(cash + (pos ?? 0) + (trf ?? 0))}
            </Button>
          </>
        }
      />
    </>
  );
}

function Reveal({ s, onDone }: { s: ShiftDetail; onDone: () => void }) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 py-4">
      <div className="animate-[rise_500ms_cubic-bezier(0.22,1,0.36,1)]">
        <VarianceHeadline s={s} />
      </div>
      <VarianceTable s={s} animate />
      {s.payments && (
        <Panel>
          <PanelHeader eyebrow="On this shift" title={`${s.payments.length} payments`} />
          <PaymentsList payments={s.payments} />
        </Panel>
      )}
      <div className="flex justify-center gap-2">
        <Button onClick={onDone} size="lg">
          Done
        </Button>
      </div>
      <p className="text-center text-[12.5px] text-ink-faint">A manager approves the shift next. You can open a new one when you are back on the desk.</p>
    </div>
  );
}

function History() {
  const { can } = useCan();
  const all = can("shift.viewAll");
  const q = useShifts({ pageSize: 15 });
  const list = (q.data?.items ?? []).filter((s) => s.status !== "OPEN");
  return (
    <Panel className="mt-8">
      <PanelHeader
        eyebrow={all ? "All cashiers" : "Your shifts"}
        title="Recent shifts"
        actions={
          can("shift.approve") && (
            <Link href="/approvals" className="inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink">
              Approvals <ArrowRight size={13} />
            </Link>
          )
        }
      />
      {q.isLoading ? (
        <div className="p-5">
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !list.length ? (
        <EmptyState compact glyph="ladder" title="No closed shifts yet" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-[13px]">
            <thead>
              <tr className="border-b border-line text-left">
                <th className="eyebrow py-2.5 pl-5 text-[10px] font-normal">Date</th>
                {all && <th className="eyebrow py-2.5 text-[10px] font-normal">Cashier</th>}
                <th className="eyebrow py-2.5 text-[10px] font-normal">Hours</th>
                <th className="eyebrow py-2.5 text-right text-[10px] font-normal">Cash counted</th>
                <th className="eyebrow py-2.5 text-right text-[10px] font-normal">Variance</th>
                <th className="eyebrow py-2.5 pr-5 text-right text-[10px] font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {list.map((s) => (
                <tr key={s.id} className="border-b border-line last:border-0">
                  <td className="py-2.5 pl-5 text-ink">{formatDate(s.openedAt, { weekday: "short", day: "numeric", month: "short", year: undefined })}</td>
                  {all && <td className="py-2.5 text-ink">{s.user.fullName}</td>}
                  <td className="py-2.5 font-mono text-[12px] text-ink-muted">
                    {lagosHHMM(s.openedAt)}&ndash;{s.closedAt ? lagosHHMM(s.closedAt) : ""}
                  </td>
                  <td className="py-2.5 text-right font-mono text-ink">{naira(s.countedCashKobo, "-")}</td>
                  <td className="py-2.5 text-right">
                    <VarianceChip v={s.varianceTotalKobo} />
                  </td>
                  <td className="py-2.5 pr-5 text-right">
                    <Badge tone={SHIFT_STATUS[s.status].tone}>{SHIFT_STATUS[s.status].label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
