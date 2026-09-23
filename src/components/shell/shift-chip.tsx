"use client";

import Link from "next/link";
import { Coins } from "@phosphor-icons/react";
import { useCurrentShift } from "@/lib/api/hooks-m2";
import { useCan } from "@/lib/permissions";
import { formatDuration } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/use-now";

/** Top-bar reminder of the cashier's shift: payments need an open one. */
export function ShiftChip({ className }: { className?: string }) {
  const { can, ready } = useCan();
  const enabled = ready && can("shift.own");
  const shift = useCurrentShift(enabled);
  const now = useNow(60_000);
  if (!enabled || shift.isLoading) return null;
  const open = shift.data && shift.data.status === "OPEN";
  return (
    <Link
      href="/shifts"
      data-testid="shift-chip"
      className={cn(
        "h-8 items-center gap-2 rounded-full border px-2.5 text-[12.5px] font-medium transition-colors",
        open
          ? "border-[color-mix(in_oklab,var(--palm)_35%,transparent)] bg-palm-wash text-palm hover:border-palm"
          : "border-dashed border-line-strong text-ink-muted hover:border-ink-faint hover:text-ink",
        className,
      )}
      title={open ? "Your cashier shift is open" : "Open a shift before taking cash, transfer or POS payments"}
    >
      {open ? (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-[breathe_2s_ease-in-out_infinite] rounded-full bg-palm" />
        </span>
      ) : (
        <Coins size={14} weight="duotone" />
      )}
      <span suppressHydrationWarning>
        {open ? <>Shift <span className="font-mono">{formatDuration(now - +new Date(shift.data!.openedAt))}</span></> : "No shift"}
      </span>
    </Link>
  );
}
