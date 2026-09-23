/* Cancellation policy in plain language: the same words a guest reads on the
   hotel page and in the quote. Kept pure so the preview and tests agree. */

export interface PolicyTerms {
  freeCancellationHours: number;
  /** percent of the first night charged when cancelling inside the window */
  lateCancellationFeePct: number;
  /** percent of the first night charged when the guest does not arrive */
  noShowFeePct: number;
}

export function hoursPhrase(h: number): string {
  if (h <= 0) return "up to check-in time";
  if (h % 24 === 0) {
    const d = h / 24;
    return d === 1 ? "until 24 hours before check-in" : d === 7 ? "until a week before check-in" : `until ${d} days before check-in`;
  }
  return `until ${h} ${h === 1 ? "hour" : "hours"} before check-in`;
}

export function feePhrase(pct: number): string {
  if (pct <= 0) return "nothing";
  if (pct === 100) return "the first night";
  if (pct === 50) return "half of the first night";
  if (pct % 100 === 0) return `${pct / 100} nights`;
  return `${pct}% of the first night`;
}

/** Headline and sentences, as the guest sees them. */
export function describePolicy(p: PolicyTerms) {
  const headline =
    p.lateCancellationFeePct <= 0 && p.noShowFeePct <= 0
      ? "Free cancellation, any time"
      : p.freeCancellationHours <= 0
        ? "Free cancellation up to check-in"
        : `Free cancellation ${hoursPhrase(p.freeCancellationHours).replace(/^until /, "until ")}`;
  const lines: string[] = [];
  if (p.lateCancellationFeePct <= 0) {
    lines.push("Cancel any time before arrival and get everything back.");
  } else {
    lines.push(`Cancel ${hoursPhrase(p.freeCancellationHours)} and get everything back.`);
    lines.push(
      p.freeCancellationHours <= 0
        ? `After check-in time, cancelling costs ${feePhrase(p.lateCancellationFeePct)}.`
        : `After that, cancelling costs ${feePhrase(p.lateCancellationFeePct)}; the rest is refunded.`,
    );
  }
  lines.push(
    p.noShowFeePct <= 0
      ? "If you don't arrive, there is no charge."
      : `If you don't arrive, you are charged ${feePhrase(p.noShowFeePct)}.`,
  );
  return { headline, lines };
}

/** Fee for a stay: pct of the first night's rate, capped at what was paid. */
export function feeFor(pct: number, nightKobo: number, paidKobo?: number) {
  const fee = Math.round((nightKobo * pct) / 100);
  return paidKobo === undefined ? fee : Math.min(fee, paidKobo);
}

export const HOUR_PRESETS = [0, 24, 48, 72, 168];
export const PCT_PRESETS = [0, 50, 100];
