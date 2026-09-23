"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Key, LockKey, Percent, Prohibit, SealCheck, ShieldCheck } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/store";
import { naira } from "@/lib/format";
import { isApiError } from "@/lib/api/client";
import { foliosApi } from "@/lib/api/endpoints-m2";
import { useApprovers, useTaxSettings } from "@/lib/api/hooks-m2";
import { useDeskRefresh } from "@/lib/api/mutations-m2";
import type { Folio, FolioEntry } from "@/lib/api/types-m2";
import { useEntitlements } from "@/lib/auth";
import { Dialog } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/form";
import { Segmented } from "@/components/ui/primitives";
import { ChipRadio, NairaInput, Stepper } from "@/components/m2/bits";

const QUICK_CHARGES = ["Laundry", "Minibar", "Restaurant", "Late check-out", "Airport pickup", "Extra bed", "Damages"];

export function ChargeDialog({ folio, open, onOpenChange }: { folio: Folio; open: boolean; onOpenChange: (o: boolean) => void }) {
  const refresh = useDeskRefresh();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [taxable, setTaxable] = useState(true);
  const m = useMutation({
    mutationFn: () => {
      if (!description.trim()) throw new Error("Describe the charge");
      if (!amount) throw new Error("Enter an amount");
      return foliosApi.charge(folio.id, { description: description.trim(), amountKobo: amount, quantity: qty, taxable });
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Charge posted", `${description} ${qty > 1 ? `x${qty} ` : ""}${naira((amount ?? 0) * qty)}`);
      onOpenChange(false);
      setDescription("");
      setAmount(null);
      setQty(1);
    },
    meta: { errorTitle: "Charge not posted" },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={folio.name}
      title="Add a charge"
      description="Taxes are added from your tax settings unless you untick taxable."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => m.mutate()} loading={m.isPending}>
            Post {amount ? naira(amount * qty) : "charge"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_CHARGES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setDescription(c)}
              className={cn(
                "h-7 rounded-full border px-2.5 text-[12px] transition-colors",
                description === c ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:text-ink",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <Field label="Description" htmlFor="ch-desc">
          <Input id="ch-desc" value={description} onChange={(e) => setDescription(e.target.value)} autoFocus />
        </Field>
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <Field label="Amount each" htmlFor="ch-amt">
            <NairaInput id="ch-amt" kobo={amount} onChange={setAmount} />
          </Field>
          <Field label="Quantity">
            <Stepper label="quantity" value={qty} onChange={setQty} min={1} max={100} />
          </Field>
        </div>
        <Checkbox checked={taxable} onChange={setTaxable} label="Taxable (VAT and other enabled taxes)" />
      </div>
    </Dialog>
  );
}

export function VoidDialog({
  folio,
  entry,
  onOpenChange,
}: {
  folio: Folio;
  entry: FolioEntry | null;
  onOpenChange: (o: boolean) => void;
}) {
  const refresh = useDeskRefresh();
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => {
      if (reason.trim().length < 4) throw new Error("Give a reason the owner will understand");
      return foliosApi.voidEntry(folio.id, entry!.id, reason.trim());
    },
    onSuccess: async () => {
      await refresh();
      toast.success("Entry voided", entry?.type === "PAYMENT" ? "Revenue Guard has logged the voided payment." : undefined);
      setReason("");
      onOpenChange(false);
    },
    meta: { errorTitle: "Not voided" },
  });
  const taxes = entry ? folio.entries.filter((e) => e.parentEntryId === entry.id) : [];
  return (
    <Dialog
      open={!!entry}
      onOpenChange={onOpenChange}
      eyebrow="Correction"
      title="Void this entry?"
      description="Folio entries are never edited or deleted. A void posts a reversing line and keeps both on the record."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Keep it
          </Button>
          <Button variant="danger" onClick={() => m.mutate()} loading={m.isPending}>
            <Prohibit size={15} weight="bold" /> Void {entry ? naira(Math.abs(entry.amountKobo)) : ""}
          </Button>
        </>
      }
    >
      {entry && (
        <div className="flex flex-col gap-4">
          <div className="rounded-md border border-line bg-paper/60 px-4 py-3">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[14px] text-ink">{entry.description}</span>
              <span className="font-mono text-[14px] text-ink">{naira(Math.abs(entry.amountKobo))}</span>
            </div>
            {taxes.map((t) => (
              <div key={t.id} className="mt-1 flex items-baseline justify-between pl-3 text-[12px] text-ink-muted">
                <span>{t.description}</span>
                <span className="font-mono">{naira(t.amountKobo)}</span>
              </div>
            ))}
            {taxes.length > 0 && <p className="mt-2 text-[11.5px] text-ink-faint">Its tax lines are voided with it.</p>}
          </div>
          {entry.type === "PAYMENT" && (
            <p className="flex items-start gap-2 rounded-md bg-ochre-wash px-3 py-2 text-[12.5px] text-ink">
              <ShieldCheck size={16} weight="duotone" className="mt-px shrink-0 text-ochre" />
              Voiding a payment raises a Revenue Guard flag for the owner.
            </p>
          )}
          <Field label="Reason" htmlFor="void-reason">
            <Textarea
              id="void-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Posted to the wrong room"
              className="min-h-20"
              autoFocus
            />
          </Field>
        </div>
      )}
    </Dialog>
  );
}

/* ---------------- Discount with second key ---------------- */

export function DiscountDialog({ folio, open, onOpenChange }: { folio: Folio; open: boolean; onOpenChange: (o: boolean) => void }) {
  const refresh = useDeskRefresh();
  const { has } = useEntitlements();
  const tax = useTaxSettings(open);
  const approvers = useApprovers(open);
  const [mode, setMode] = useState<"PERCENT" | "AMOUNT">("PERCENT");
  const [pct, setPct] = useState(10);
  const [amount, setAmount] = useState<number | null>(null);
  const [target, setTarget] = useState<string>("ALL");
  const [reason, setReason] = useState("");
  const [needKey, setNeedKey] = useState(false);
  const [approverId, setApproverId] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [shake, setShake] = useState(0);

  const charges = folio.entries.filter((e) => ["ROOM", "DAY_USE", "EXTRA"].includes(e.type) && !e.voided);
  const base = target === "ALL" ? charges.reduce((s, e) => s + e.amountKobo, 0) : (charges.find((c) => c.id === target)?.amountKobo ?? 0);
  const discountKobo = mode === "PERCENT" ? Math.round((base * pct) / 100) : (amount ?? 0);
  const discountBps = base ? Math.round((discountKobo / base) * 10000) : 0;
  const threshold = tax.data?.discountApprovalThresholdBps ?? 1000;
  const overThreshold = discountBps > threshold;
  const full = has("revenue_guard_full");
  const keyRequired = (overThreshold && full) || needKey;

  const m = useMutation({
    mutationFn: () => {
      if (!discountKobo) throw new Error("Enter a discount");
      if (reason.trim().length < 3) throw new Error("Give a reason for the discount");
      if (keyRequired && (!approverId || pin.length < 4)) throw new Error("A manager needs to choose their name and enter their PIN");
      return foliosApi.discount(folio.id, {
        mode,
        value: mode === "PERCENT" ? Math.round(pct * 100) : discountKobo,
        targetEntryId: target === "ALL" ? undefined : target,
        reason: reason.trim(),
        approval: keyRequired ? { approverId, pin } : undefined,
      });
    },
    onSuccess: async () => {
      await refresh();
      toast.success(
        "Discount applied",
        keyRequired
          ? `Approved by ${approvers.data?.find((a) => a.id === approverId)?.fullName ?? "a manager"}.`
          : overThreshold
            ? "Above the threshold, so Revenue Guard has noted it for the owner."
            : undefined,
      );
      onOpenChange(false);
    },
    onError: (e) => {
      if (!isApiError(e)) return;
      if (e.code === "APPROVAL_REQUIRED") setNeedKey(true);
      if (e.code === "APPROVAL_INVALID") {
        const left = (e.details as { attemptsLeft?: number } | undefined)?.attemptsLeft;
        setPinError(left !== undefined ? `That PIN didn't match. ${left} ${left === 1 ? "try" : "tries"} left.` : "That PIN didn't match.");
        setPin("");
        setShake((s) => s + 1);
      }
      if (e.code === "APPROVAL_LOCKED") setPinError("This manager's PIN is locked for 15 minutes after too many tries.");
    },
    meta: { errorTitle: "Discount not applied", silentCodes: ["APPROVAL_REQUIRED", "APPROVAL_INVALID", "APPROVAL_LOCKED"] },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={folio.name}
      title="Discount"
      className="max-w-[520px]"
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => m.mutate()} loading={m.isPending} disabled={!discountKobo}>
            {keyRequired ? <Key size={15} weight="bold" /> : <Percent size={15} weight="bold" />}
            {keyRequired ? "Approve and apply" : "Apply"} {discountKobo ? `−${naira(discountKobo)}` : ""}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3">
          <Segmented<"PERCENT" | "AMOUNT">
            label="Discount by"
            value={mode}
            onChange={setMode}
            options={[
              { value: "PERCENT", label: "Percent" },
              { value: "AMOUNT", label: "Amount" },
            ]}
          />
          <span className="text-[12px] text-ink-muted">
            on <span className="font-mono text-ink">{naira(base)}</span>
          </span>
        </div>
        {mode === "PERCENT" ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-[40px] leading-none tracking-tight text-ink">{pct}%</span>
              <span className="font-mono text-[15px] text-ink-muted">&minus;{naira(discountKobo)}</span>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              value={pct}
              onChange={(e) => setPct(Number(e.target.value))}
              aria-label="Discount percent"
              className="discount-range w-full"
              style={{ ["--pct" as string]: `${(pct / 50) * 100}%`, ["--thr" as string]: `${(threshold / 100 / 50) * 100}%` }}
            />
            <div className="relative h-4 text-[10.5px] text-ink-faint">
              <span className="absolute -translate-x-1/2 font-mono" style={{ left: `${(threshold / 100 / 50) * 100}%` }}>
                {threshold / 100}% needs a manager
              </span>
            </div>
          </div>
        ) : (
          <NairaInput kobo={amount} onChange={setAmount} large aria-label="Discount amount" />
        )}

        {charges.length > 1 && (
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium text-ink">Apply to</span>
            <ChipRadio
              label="Apply to"
              value={target}
              onChange={setTarget}
              options={[
                { value: "ALL", label: "Whole stay" },
                ...charges.slice(0, 6).map((c) => ({ value: c.id, label: c.description.length > 28 ? c.description.slice(0, 26) + "..." : c.description })),
              ]}
            />
          </div>
        )}

        <Field label="Reason" htmlFor="disc-reason">
          <Input id="disc-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Corporate rate, returning guest, AC fault in room ..." />
        </Field>

        {overThreshold && !full && (
          <p className="flex items-start gap-2 rounded-md bg-brass-wash px-3 py-2 text-[12.5px] text-ink">
            <ShieldCheck size={16} weight="duotone" className="mt-px shrink-0 text-brass" />
            Above your {threshold / 100}% threshold. It will go through, and Revenue Guard will note it for the owner.
          </p>
        )}

        {keyRequired && (
          <SecondKey
            approvers={approvers.data ?? []}
            loading={approvers.isLoading}
            approverId={approverId}
            onApprover={setApproverId}
            pin={pin}
            onPin={(p) => {
              setPin(p);
              setPinError(null);
            }}
            error={pinError}
            shake={shake}
            pct={discountBps / 100}
            threshold={threshold / 100}
          />
        )}
      </div>
      <style>{`
        .discount-range { -webkit-appearance: none; appearance: none; height: 6px; border-radius: 3px;
          background: linear-gradient(to right, var(--laterite) 0 var(--pct), var(--surface-2) var(--pct) 100%); outline: none; position: relative; }
        .discount-range::-webkit-slider-thumb { -webkit-appearance: none; width: 20px; height: 20px; border-radius: 50%; background: var(--surface); border: 2px solid var(--laterite); box-shadow: 0 1px 3px rgb(0 0 0 / .2); cursor: grab; }
        .discount-range::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: var(--surface); border: 2px solid var(--laterite); cursor: grab; }
      `}</style>
    </Dialog>
  );
}

function SecondKey({
  approvers,
  loading,
  approverId,
  onApprover,
  pin,
  onPin,
  error,
  shake,
  pct,
  threshold,
}: {
  approvers: { id: string; fullName: string; role: string }[];
  loading: boolean;
  approverId: string;
  onApprover: (id: string) => void;
  pin: string;
  onPin: (p: string) => void;
  error: string | null;
  shake: number;
  pct: number;
  threshold: number;
}) {
  return (
    <div className="relative overflow-hidden rounded-md border border-[color-mix(in_oklab,var(--brass)_55%,transparent)] bg-[color-mix(in_oklab,var(--brass-wash)_55%,var(--surface))]">
      <div className="flex items-center gap-3 border-b border-dashed border-[color-mix(in_oklab,var(--brass)_45%,transparent)] px-4 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[color-mix(in_oklab,var(--brass)_50%,transparent)] bg-surface text-brass">
          <LockKey size={18} weight="duotone" />
        </span>
        <div>
          <p className="text-[13.5px] font-medium text-ink">Second key needed</p>
          <p className="text-[12px] text-ink-muted">
            {pct.toFixed(pct % 1 ? 1 : 0)}% is above the {threshold}% threshold. A manager approves it on this screen with their PIN.
          </p>
        </div>
      </div>
      <div className="flex flex-col gap-4 px-4 py-4">
        {loading ? (
          <p className="text-[12.5px] text-ink-muted">Finding managers ...</p>
        ) : approvers.length === 0 ? (
          <p className="text-[12.5px] text-danger">No manager has set an approval PIN yet. An owner can set one under Staff.</p>
        ) : (
          <ChipRadio
            label="Approving manager"
            value={approverId}
            onChange={onApprover}
            options={approvers.map((a) => ({ value: a.id, label: a.fullName }))}
          />
        )}
        <div>
          <p className="mb-2 text-[12.5px] text-ink-muted">Manager&rsquo;s PIN</p>
          <PinInput value={pin} onChange={onPin} shake={shake} disabled={!approverId} />
          {error && (
            <p role="alert" className="mt-2 text-[12.5px] text-danger">
              {error}
            </p>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-[11.5px] text-ink-faint">
          <SealCheck size={13} /> The approval is stamped on the folio line and in the audit log.
        </p>
      </div>
    </div>
  );
}

/** 4-6 digit PIN as separate masked cells; one hidden input drives it (paste works). */
export function PinInput({
  value,
  onChange,
  length = 6,
  shake = 0,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  length?: number;
  shake?: number;
  disabled?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const cells = useMemo(() => Array.from({ length }, (_, i) => value[i] ?? ""), [value, length]);
  useEffect(() => {
    if (shake && ref.current) ref.current.focus();
  }, [shake]);
  return (
    <div
      key={shake}
      className={cn("relative inline-flex gap-2", shake > 0 && "animate-[pin-shake_360ms_ease-out]", disabled && "opacity-50")}
      onClick={() => ref.current?.focus()}
    >
      <input
        ref={ref}
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        aria-label="PIN"
        maxLength={length}
        disabled={disabled}
        value={value}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, length))}
        className="absolute inset-0 z-10 cursor-text opacity-0"
      />
      {cells.map((c, i) => {
        const active = focused && (i === value.length || (i === length - 1 && value.length === length));
        return (
          <span
            key={i}
            aria-hidden
            className={cn(
              "grid h-12 w-10 place-items-center rounded-md border bg-surface font-mono text-[20px] text-ink transition-colors",
              active ? "border-laterite shadow-[0_0_0_3px_color-mix(in_oklab,var(--laterite)_18%,transparent)]" : "border-line-strong",
              i >= 4 && !c && !active && "border-dashed",
            )}
          >
            {c ? <span className="h-2.5 w-2.5 rounded-full bg-ink" /> : ""}
          </span>
        );
      })}
      <style>{`@keyframes pin-shake { 0%,100% { transform: translateX(0) } 20% { transform: translateX(-6px) } 40% { transform: translateX(5px) } 60% { transform: translateX(-3px) } 80% { transform: translateX(2px) } }`}</style>
    </div>
  );
}
