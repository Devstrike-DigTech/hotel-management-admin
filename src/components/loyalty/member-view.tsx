"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Minus, Plus, WarningCircle } from "@phosphor-icons/react";
import { useCan } from "@/lib/permissions";
import { loyaltyApi } from "@/lib/api/endpoints-m5";
import { qk5, useLoyaltyMember, useLoyaltyProgramme } from "@/lib/api/hooks-m5";
import type { LoyaltyTxn } from "@/lib/api/types-m5";
import { formatDate, formatPhone, naira, number } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, Input, Textarea } from "@/components/ui/form";
import { ErrorState, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { MemberCard, PointsStatement, tierLook, type StatementRow } from "./parts";

const rowOf = (t: LoyaltyTxn): StatementRow => ({
  id: t.id,
  at: t.createdAt,
  kind: t.type === "REVERSAL" ? "ADJUST" : t.type,
  points: t.points,
  balance: t.balanceAfter,
  description: t.reason ? `${t.description} (${t.reason})` : t.description,
  reference: t.reservation?.code ?? null,
  propertyName: t.property?.name ?? null,
  actor: t.by?.fullName ?? null,
});

export function MemberView({ id }: { id: string }) {
  const q = useLoyaltyMember(id);
  const prog = useLoyaltyProgramme();
  const { can } = useCan();
  const [adjust, setAdjust] = useState(false);
  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const m = q.data;
  const tiers = [...(prog.data?.tiers ?? [])].sort((a, b) => a.minNights - b.minNights);
  const tierIndex = m?.tier ? Math.max(0, tiers.findIndex((t) => t.id === m.tier!.id)) : 0;
  const next = m?.nextTier ? tiers.find((t) => t.name === m.nextTier!.name) : null;
  return (
    <>
      <Link href="/loyalty?tab=members" className="mb-5 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> Members
      </Link>
      {!m ? (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
          <div className="flex flex-col gap-5">
            <MemberCard
              m={{
                id: m.id,
                number: m.memberNo,
                guestName: m.guest.fullName,
                tierName: m.tier?.name ?? "Member",
                tierIndex,
                tierColor: m.tier?.color,
                points: m.points,
                pointsValueKobo: m.valueKobo,
                nights12m: m.nights12m,
                nextTier: m.nextTier && next ? { name: m.nextTier.name, minNights: next.minNights } : m.nextTier ? { name: m.nextTier.name, minNights: m.nights12m + m.nextTier.nightsNeeded } : null,
                expiringPoints: m.expiringSoon?.points,
                expiringAt: m.expiringSoon?.date,
                programmeName: prog.data?.name ?? "Loyalty",
              }}
            />
            <Panel className="overflow-hidden">
              <PanelHeader
                eyebrow="Statement"
                title="Every point in and out"
                actions={
                  can("loyalty.adjust") ? (
                    <Button size="sm" variant="secondary" onClick={() => setAdjust(true)} data-testid="adjust-points">
                      Adjust points
                    </Button>
                  ) : undefined
                }
              />
              <PointsStatement rows={m.statement.map(rowOf)} />
            </Panel>
          </div>
          <div className="flex flex-col gap-5">
            <Panel className="p-5">
              <p className="eyebrow text-[10px]">Guest</p>
              <p className="display-sm mt-1 text-[19px] text-ink">{m.guest.fullName}</p>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
                <dt className="text-ink-muted">Phone</dt>
                <dd className="text-right font-mono text-ink">{formatPhone(m.guest.phone)}</dd>
                <dt className="text-ink-muted">Email</dt>
                <dd className="truncate text-right text-ink">{m.guest.email ?? "-"}</dd>
                <dt className="text-ink-muted">Joined</dt>
                <dd className="text-right text-ink">
                  {formatDate(m.enrolledAt)} <span className="text-ink-muted">{m.enrolledVia === "ONLINE" ? "online" : m.enrolledVia === "CHECK_IN" ? "at check-in" : "at the desk"}</span>
                </dd>
                <dt className="text-ink-muted">Points ever earned</dt>
                <dd className="text-right font-mono text-ink">{number(m.lifetimePoints)}</dd>
              </dl>
              <Link href={`/guests/${m.guest.id}`} className="mt-4 inline-flex text-[13px] font-medium text-laterite hover:underline">
                Open the guest profile
              </Link>
            </Panel>
            {m.tier && (
              <Panel className="p-5" style={{ background: tierLook(m.tier.color).plate }}>
                <p className="eyebrow text-[10px]">{m.tier.name} perks</p>
                <ul className="mt-2 flex flex-col gap-1.5">
                  {m.tier.perks.map((p) => (
                    <li key={p} className="flex gap-2 text-[13.5px] text-ink">
                      <span className="mt-[8px] h-1 w-1 shrink-0 rounded-full" style={{ background: tierLook(m.tier!.color).ink }} aria-hidden />
                      {p}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[12px] text-ink-muted">The desk sees these at check-in.</p>
              </Panel>
            )}
          </div>
        </div>
      )}
      {m && <AdjustDialog open={adjust} onOpenChange={setAdjust} memberId={m.id} balance={m.points} flagAt={prog.data?.adjustmentFlagPoints ?? 5000} pointKobo={prog.data?.pointValueKobo ?? 100} />}
    </>
  );
}

function AdjustDialog({ open, onOpenChange, memberId, balance, flagAt, pointKobo }: { open: boolean; onOpenChange: (o: boolean) => void; memberId: string; balance: number; flagAt: number; pointKobo: number }) {
  const qc = useQueryClient();
  const [sign, setSign] = useState<1 | -1>(1);
  const [pts, setPts] = useState("");
  const [reason, setReason] = useState("");
  const n = Number(pts || 0) * sign;
  const m = useMutation({
    mutationFn: () => loyaltyApi.adjust(memberId, n, reason.trim()),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk5.loyalty });
      toast.success(n > 0 ? `${number(n)} points added` : `${number(-n)} points removed`, Math.abs(n) >= flagAt ? "Recorded, and Revenue Guard has a flag for the owner to see." : "Recorded with your name and the reason.");
      onOpenChange(false);
      setPts("");
      setReason("");
    },
    meta: { errorTitle: "Not adjusted" },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Adjust points"
      description="For goodwill or to correct a mistake. Every adjustment carries your name and the reason."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => m.mutate()} loading={m.isPending} disabled={!n || !reason.trim() || balance + n < 0}>
            {n >= 0 ? "Add" : "Remove"} {number(Math.abs(n))} points
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-line-strong p-0.5" role="radiogroup" aria-label="Add or remove">
            {([1, -1] as const).map((s) => (
              <button key={s} type="button" role="radio" aria-checked={sign === s} onClick={() => setSign(s)} className={cn("inline-flex h-9 items-center gap-1 rounded-sm px-3 text-[13px] font-medium", sign === s ? "bg-ink text-paper" : "text-ink-muted")}>
                {s === 1 ? <Plus size={13} weight="bold" /> : <Minus size={13} weight="bold" />}
                {s === 1 ? "Add" : "Remove"}
              </button>
            ))}
          </div>
          <Input inputMode="numeric" value={pts} onChange={(e) => setPts(e.target.value.replace(/\D/g, ""))} placeholder="500" className="w-32 font-mono" aria-label="Points" />
          <span className="text-[13px] text-ink-muted">= {naira(Math.abs(n) * pointKobo)}</span>
        </div>
        <Field label="Reason">
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="e.g. AC fault during the stay" />
        </Field>
        {Math.abs(n) >= flagAt && (
          <p className="flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--ochre)_40%,transparent)] bg-ochre-wash/60 px-3 py-2 text-[12.5px] text-ink">
            <WarningCircle size={15} className="mt-px shrink-0 text-ochre" /> {number(flagAt)} points or more raises a Revenue Guard flag for the owner.
          </p>
        )}
        {balance + n < 0 && <p className="text-[12.5px] text-danger">That would take the balance below zero.</p>}
      </div>
    </Dialog>
  );
}
