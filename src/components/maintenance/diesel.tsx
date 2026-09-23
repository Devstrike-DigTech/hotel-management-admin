"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowDownRight, ArrowUpRight, GasPump, Plus } from "@phosphor-icons/react";
import { useFuelLogs, useFuelSummary } from "@/lib/api/hooks-m4";
import { mtApi } from "@/lib/api/endpoints-m4";
import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/store";
import { addDays, formatDay, todayKey } from "@/lib/dates";
import { naira, nairaCompact, number } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, Input } from "@/components/ui/form";
import { EmptyState, ErrorState, Panel, PanelHeader, Segmented, Skeleton, Stat } from "@/components/ui/primitives";
import { NairaInput } from "@/components/m2/bits";
import { Th } from "@/components/ui/table";
import { DieselChart } from "./diesel-chart";

type Range = "30" | "month" | "90";

/** The generator's appetite: naira and litres by day, price per litre, and every delivery. */
export function Diesel() {
  const { can } = useCan();
  const today = todayKey();
  const [range, setRange] = useState<Range>("30");
  const from = range === "month" ? today.slice(0, 8) + "01" : addDays(today, range === "30" ? -29 : -89);
  const sum = useFuelSummary(from, today);
  const logs = useFuelLogs({ from, to: today, pageSize: 40 });
  const [logging, setLogging] = useState(false);
  const s = sum.data;
  const change = s && s.previousPeriodCostKobo ? (s.costKobo - s.previousPeriodCostKobo) / s.previousPeriodCostKobo : null;

  return (
    <div className="flex flex-col gap-5">
      <Panel>
        <PanelHeader
          eyebrow="Generator and diesel"
          title="What the power costs"
          description="Every delivery logged at the gate. Litres and naira are drawn on the same days, one above the other."
          actions={
            <>
              <Segmented<Range>
                label="Range"
                size="sm"
                value={range}
                onChange={setRange}
                options={[
                  { value: "30", label: "30 days" },
                  { value: "month", label: "This month" },
                  { value: "90", label: "90 days" },
                ]}
              />
              {(can("maintenance.work") || can("maintenance.manage")) && (
                <Button size="sm" onClick={() => setLogging(true)}>
                  <Plus size={13} weight="bold" /> Log delivery
                </Button>
              )}
            </>
          }
        />
        {sum.isError ? (
          <ErrorState error={sum.error} onRetry={() => sum.refetch()} />
        ) : !s ? (
          <div className="p-5">
            <Skeleton className="h-72" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-6 border-b border-line px-5 py-5 md:grid-cols-4">
              <Stat
                label="Spent on diesel"
                value={nairaCompact(s.costKobo)}
                sub={
                  change !== null ? (
                    <span className={cn("inline-flex items-center gap-1", change > 0 ? "text-ochre" : "text-palm")}>
                      {change > 0 ? <ArrowUpRight size={12} weight="bold" /> : <ArrowDownRight size={12} weight="bold" />}
                      {Math.abs(Math.round(change * 100))}% on the period before
                    </span>
                  ) : undefined
                }
              />
              <Stat label="Litres" value={number(Math.round(s.litres))} sub={`${s.deliveries} deliveries`} />
              <Stat label="A day" value={`${s.litresPerDay} L`} sub={`${naira(s.costPerDayKobo)} a day`} />
              <Stat label="Per litre" value={naira(s.avgPricePerLitreKobo)} sub={s.litresPerRunHour ? `${s.litresPerRunHour} L per generator hour` : `${s.runHours} run hours`} />
            </div>
            <div className="px-3 pb-4 pt-3 sm:px-5">
              <DieselChart days={s.days.map((d) => ({ date: d.date, litres: d.litres, costKobo: d.costKobo, runHours: d.runHours }))} />
            </div>
          </>
        )}
      </Panel>

      <Panel className="overflow-hidden">
        <PanelHeader eyebrow="Deliveries" title="The diesel book" />
        {logs.isError ? (
          <ErrorState error={logs.error} onRetry={() => logs.refetch()} />
        ) : !logs.data ? (
          <div className="p-5">
            <Skeleton className="h-40" />
          </div>
        ) : !logs.data.items.length ? (
          <EmptyState compact glyph="river" title="No deliveries logged" body="Log each delivery as the tanker leaves: litres, what you paid and the supplier." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-[13px]">
              <thead>
                <tr className="border-b border-line text-ink-muted">
                  <Th className="pl-5">Date</Th>
                  <Th>Supplier</Th>
                  <Th className="text-right">Litres</Th>
                  <Th className="text-right">Paid</Th>
                  <Th className="text-right">Per litre</Th>
                  <Th className="pr-5 text-right">Run hours</Th>
                </tr>
              </thead>
              <tbody>
                {logs.data.items.map((f) => (
                  <tr key={f.id} className="border-b border-line last:border-b-0">
                    <td className="py-2.5 pl-5 text-ink">{formatDay(f.date)}</td>
                    <td className="py-2.5 text-ink-muted">
                      {f.supplier}
                      {f.generator && <span className="text-ink-faint"> &middot; {f.generator}</span>}
                    </td>
                    <td className="py-2.5 text-right font-mono text-ink">{number(f.litres)}</td>
                    <td className="py-2.5 text-right font-mono text-ink">{naira(f.costKobo)}</td>
                    <td className="py-2.5 text-right font-mono text-ink-muted">{naira(f.pricePerLitreKobo)}</td>
                    <td className="py-2.5 pr-5 text-right font-mono text-ink-muted">{f.runHours ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <FuelDialog open={logging} onOpenChange={setLogging} />
    </div>
  );
}

function FuelDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayKey());
  const [litres, setLitres] = useState("");
  const [cost, setCost] = useState<number | null>(null);
  const [supplier, setSupplier] = useState("");
  const [hours, setHours] = useState("");
  const l = Number(litres) || 0;
  const m = useMutation({
    mutationFn: () => mtApi.logFuel({ date, litres: l, costKobo: cost ?? 0, supplier: supplier.trim(), runHours: hours ? Number(hours) : undefined }),
    onSuccess: async (f) => {
      await qc.invalidateQueries({ queryKey: ["maintenance"] });
      toast.success(`${number(f.litres)} litres logged`, `${naira(f.pricePerLitreKobo)} a litre from ${f.supplier}.`);
      setLitres("");
      setCost(null);
      setHours("");
      onOpenChange(false);
    },
    meta: { errorTitle: "Delivery not logged" },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={
        <span className="inline-flex items-center gap-1.5">
          <GasPump size={13} weight="duotone" /> Diesel
        </span>
      }
      title="Log a delivery"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={!l || !cost || supplier.trim().length < 2} loading={m.isPending} onClick={() => m.mutate()}>
            Log it
          </Button>
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date" htmlFor="fl-date">
          <Input id="fl-date" type="date" max={todayKey()} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="font-mono" />
        </Field>
        <Field label="Supplier" htmlFor="fl-sup">
          <Input id="fl-sup" value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="Ardova Lekki" />
        </Field>
        <Field label="Litres" htmlFor="fl-l">
          <Input id="fl-l" inputMode="decimal" value={litres} onChange={(e) => setLitres(e.target.value.replace(/[^\d.]/g, ""))} className="font-mono" placeholder="200" />
        </Field>
        <Field label="Paid" htmlFor="fl-cost" hint={l && cost ? `${naira(Math.round(cost / l))} a litre` : undefined}>
          <NairaInput id="fl-cost" kobo={cost} onChange={setCost} />
        </Field>
        <Field label="Generator hours since last" htmlFor="fl-h" optional>
          <Input id="fl-h" inputMode="numeric" value={hours} onChange={(e) => setHours(e.target.value.replace(/\D/g, ""))} className="font-mono" />
        </Field>
      </div>
    </Dialog>
  );
}
