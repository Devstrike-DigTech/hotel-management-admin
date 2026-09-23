"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChatCircleDots, Crown, Key } from "@phosphor-icons/react";
import { useEntitlements } from "@/lib/auth";
import { useCan } from "@/lib/permissions";
import { loyaltyApi } from "@/lib/api/endpoints-m5";
import { qk5, useLoyaltyProgramme, useMemberByGuest } from "@/lib/api/hooks-m5";
import { qk2, useApprovers } from "@/lib/api/hooks-m2";
import type { Folio } from "@/lib/api/types-m2";
import type { LoyaltyMember, RedeemChallenge } from "@/lib/api/types-m5";
import { errorMessage, isApiError } from "@/lib/api/client";
import { naira, number } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { PinInput } from "@/components/folio/folio-dialogs";
import { TierBadge } from "./parts";

/** "Redeem points" on a folio: shows only for a member of the group's programme with points to spend. */
export function RedeemPointsButton({ folio }: { folio: Folio }) {
  const { has } = useEntitlements();
  const { can } = useCan();
  const enabled = has("loyalty") && can("loyalty.redeem") && can("folio.discount") && folio.status === "OPEN" && !!folio.guest;
  const member = useMemberByGuest(folio.guest?.id, enabled);
  const [open, setOpen] = useState(false);
  if (!enabled || !member.data || member.data.points <= 0) return null;
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} data-testid="redeem-points" className="text-brass hover:text-brass">
        <Crown size={14} weight="fill" /> Redeem points
        <span className="font-mono text-[11.5px] text-ink-muted">{number(member.data.points)}</span>
      </Button>
      <RedeemDialog open={open} onOpenChange={setOpen} folio={folio} member={member.data} />
    </>
  );
}

function RedeemDialog({ open, onOpenChange, folio, member }: { open: boolean; onOpenChange: (o: boolean) => void; folio: Folio; member: LoyaltyMember }) {
  const qc = useQueryClient();
  const prog = useLoyaltyProgramme(open);
  const approvers = useApprovers(open);
  const p = prog.data;
  const pointKobo = p?.pointValueKobo ?? 100;
  const minPts = p?.minRedeemPoints ?? 1000;
  // at most maxRedeemBps of the folio's charges, and never more than the balance
  const capByFolio = p ? Math.floor(((folio.totals.chargesKobo - folio.totals.discountsKobo) * p.maxRedeemBps) / 10_000 / pointKobo) : member.points;
  const maxPts = Math.max(0, Math.min(member.points, capByFolio));
  const [pts, setPts] = useState(0);
  const [mode, setMode] = useState<"OTP" | "PIN">("OTP");
  const [challenge, setChallenge] = useState<RedeemChallenge | null>(null);
  const [code, setCode] = useState("");
  const [approverId, setApproverId] = useState("");
  const [pin, setPin] = useState("");
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset each time it opens
    setPts(Math.min(maxPts, Math.max(minPts, Math.floor(maxPts / 1000) * 1000)));
    setChallenge(null);
    setCode("");
    setPin("");
    setErr(null);
  }, [open, maxPts, minPts]);
  const chips = useMemo(() => [minPts, 2000, 5000, 10000].filter((x, i, a) => x <= maxPts && a.indexOf(x) === i), [minPts, maxPts]);
  const tooFew = pts < minPts;
  const tooMany = pts > maxPts;

  const done = async (r: { member: LoyaltyMember }) => {
    await Promise.all([qc.invalidateQueries({ queryKey: qk2.folio(folio.id) }), qc.invalidateQueries({ queryKey: qk5.loyalty }), qc.invalidateQueries({ queryKey: ["reservations"] })]);
    toast.success(`${number(pts)} points redeemed`, `${naira(pts * pointKobo)} off. ${number(r.member.points)} points left.`);
    onOpenChange(false);
  };
  const onErr = (e: unknown) => {
    if (isApiError(e) && e.code === "LOYALTY_CODE_INVALID") setErr(`That code didn't match.${e.details?.attemptsLeft !== undefined ? ` ${e.details.attemptsLeft} tries left.` : ""}`);
    else if (isApiError(e) && e.code === "LOYALTY_CODE_EXPIRED") {
      setErr("That code has expired. Send a new one.");
      setChallenge(null);
    } else setErr(errorMessage(e));
  };
  const start = useMutation({ mutationFn: () => loyaltyApi.redeemStart(member.id, folio.id, pts), onSuccess: (c) => { setErr(null); setChallenge(c); }, onError: onErr, meta: { silent: true } });
  const byCode = useMutation({ mutationFn: () => loyaltyApi.redeemCode(challenge!.challengeId, code), onSuccess: done, onError: onErr, meta: { silent: true } });
  const byPin = useMutation({ mutationFn: () => loyaltyApi.redeemPin({ memberId: member.id, folioId: folio.id, points: pts, approval: { approverId, pin } }), onSuccess: done, onError: onErr, meta: { silent: true } });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={<span className="inline-flex items-center gap-1.5 text-brass"><Crown size={13} weight="fill" /> {p?.name ?? "Loyalty"}</span>}
      title="Redeem points on this bill"
      description={`${member.guest.fullName} has ${number(member.points)} points, worth ${naira(member.points * pointKobo)}. The discount goes on the folio like any other and the points come off at once.`}
      className="max-w-lg"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {mode === "OTP" && !challenge ? (
            <Button onClick={() => start.mutate()} loading={start.isPending} disabled={tooFew || tooMany || !pts} data-testid="redeem-send-code">
              <ChatCircleDots size={15} /> Send the code
            </Button>
          ) : mode === "OTP" ? (
            <Button onClick={() => byCode.mutate()} loading={byCode.isPending} disabled={code.length < 6} data-testid="redeem-confirm">
              Redeem {number(pts)} points
            </Button>
          ) : (
            <Button onClick={() => byPin.mutate()} loading={byPin.isPending} disabled={tooFew || tooMany || !approverId || pin.length < 4} data-testid="redeem-confirm">
              Redeem {number(pts)} points
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3 rounded-md border border-line bg-paper px-3.5 py-2.5">
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-medium text-ink">{member.guest.fullName}</span>
            <span className="font-mono text-[11.5px] text-ink-muted">{member.memberNo}</span>
          </span>
          {member.tier && <TierBadge name={member.tier.name} color={member.tier.color} />}
        </div>

        <div>
          <div className="flex items-baseline justify-between">
            <label htmlFor="redeem-pts" className="text-[13px] font-medium text-ink">
              Points
            </label>
            <span className="text-[12px] text-ink-muted">
              {number(minPts)} to {number(maxPts)} on this bill
            </span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <input
              id="redeem-pts"
              inputMode="numeric"
              value={pts ? String(pts) : ""}
              onChange={(e) => {
                setPts(Number(e.target.value.replace(/\D/g, "") || 0));
                setChallenge(null);
              }}
              disabled={!!challenge}
              className="h-12 w-36 rounded-md border border-line-strong bg-surface px-3 font-mono text-[22px] text-ink outline-none focus:border-laterite"
              data-testid="redeem-points-input"
            />
            <span className="text-[14px] text-ink-muted">=</span>
            <span className="font-mono text-[24px] tracking-tight text-palm">{naira(pts * pointKobo)}</span>
            <span className="text-[13px] text-ink-muted">off</span>
          </div>
          <input type="range" min={0} max={maxPts} step={100} value={Math.min(pts, maxPts)} disabled={!!challenge} onChange={(e) => setPts(Number(e.target.value))} className="mt-3 w-full accent-[var(--brass)]" aria-label="Points to redeem" />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {[...chips, maxPts].filter((x, i, a) => x > 0 && a.indexOf(x) === i).map((c) => (
              <button key={c} type="button" disabled={!!challenge} onClick={() => setPts(c)} className={cn("h-8 rounded-full border px-3 font-mono text-[12px]", pts === c ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:text-ink")}>
                {c === maxPts ? `All ${number(c)}` : number(c)}
              </button>
            ))}
          </div>
          {tooMany && maxPts < member.points && <p className="mt-2 text-[12.5px] text-ochre">At most {Math.round((p?.maxRedeemBps ?? 5000) / 100)}% of this bill can be paid with points.</p>}
          {tooFew && pts > 0 && <p className="mt-2 text-[12.5px] text-ochre">Redeem at least {number(minPts)} points.</p>}
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-ink">How the guest proves it</p>
          <div role="radiogroup" aria-label="Proof" className="grid grid-cols-2 gap-2">
            {(
              [
                ["OTP", "A code to their phone", <ChatCircleDots key="o" size={16} />],
                ["PIN", "A manager's PIN", <Key key="p" size={16} />],
              ] as const
            ).map(([k, label, icon]) => (
              <button key={k} type="button" role="radio" aria-checked={mode === k} onClick={() => { setMode(k); setErr(null); }} className={cn("flex h-11 items-center justify-center gap-2 rounded-md border text-[13px] font-medium", mode === k ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}>
                {icon}
                {label}
              </button>
            ))}
          </div>
          {mode === "OTP" && challenge && (
            <div className="mt-4">
              <p className="mb-2 text-[13px] text-ink-muted">
                Sent to <span className="font-mono text-ink">{challenge.maskedPhone}</span>. Ask the guest to read out the 6 digits.
              </p>
              <PinInput value={code} onChange={setCode} length={6} />
            </div>
          )}
          {mode === "PIN" && (
            <div className="mt-4 flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {(approvers.data ?? []).map((a) => (
                  <button key={a.id} type="button" role="radio" aria-checked={approverId === a.id} onClick={() => setApproverId(a.id)} className={cn("h-9 rounded-full border px-3 text-[13px]", approverId === a.id ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}>
                    {a.fullName}
                  </button>
                ))}
                {approvers.data && !approvers.data.length && <p className="text-[12.5px] text-danger">No manager has set an approval PIN yet.</p>}
              </div>
              <PinInput value={pin} onChange={setPin} disabled={!approverId} />
            </div>
          )}
          {err && <p role="alert" className="mt-3 text-[12.5px] text-danger">{err}</p>}
        </div>
      </div>
    </Dialog>
  );
}
