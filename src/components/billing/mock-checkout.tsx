"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, Flask, ShieldCheck, WarningOctagon } from "@phosphor-icons/react";
import { hotelApi } from "@/lib/api/endpoints";
import { errorMessage } from "@/lib/api/client";
import { useHotelSession, useHydrated } from "@/lib/auth";
import { naira } from "@/lib/format";
import { Button, ButtonLink } from "@/components/ui/button";
import { Wordmark } from "@/components/brand";
import { AdireRule } from "@/components/motifs/adire";
import { PENDING_CHECKOUT_KEY } from "./billing-view";

interface Pending {
  reference: string;
  planCode: string;
  planName: string;
  interval: "MONTHLY" | "YEARLY";
  amountKobo: number | null;
}

function readPending(): Pending | null {
  try {
    const raw = sessionStorage.getItem(PENDING_CHECKOUT_KEY);
    return raw ? (JSON.parse(raw) as Pending) : null;
  } catch {
    return null;
  }
}

/** Local stand-in for the payment provider, used only when the API runs without a Paystack key. */
export function MockCheckout() {
  const params = useSearchParams();
  const reference = params.get("reference") ?? "";
  const hydrated = useHydrated();
  const s = useHotelSession();
  const router = useRouter();
  const qc = useQueryClient();
  // sessionStorage is client-only: read it after hydration to keep SSR and client in step.
  const pending = useMemo(() => (hydrated ? readPending() : null), [hydrated]);

  useEffect(() => {
    if (hydrated && !s) router.replace(`/login?next=${encodeURIComponent(`/billing/mock-checkout?reference=${reference}`)}`);
  }, [hydrated, s, router, reference]);

  const confirm = useMutation({
    mutationFn: () => hotelApi.devConfirm(reference),
    onSuccess: () => {
      try {
        sessionStorage.removeItem(PENDING_CHECKOUT_KEY);
      } catch {
        /* ignore */
      }
      void qc.invalidateQueries();
    },
    meta: { silent: true },
  });

  const info = pending && pending.reference === reference ? pending : pending;

  return (
    <div className="flex min-h-dvh flex-col items-center px-4 py-10">
      <div className="mb-10">
        <Wordmark size="sm" />
      </div>
      <div className="w-full max-w-[440px] overflow-hidden rounded-lg border border-line bg-surface shadow-float">
        <div className="flex items-center gap-2 border-b border-dashed border-line-strong bg-ochre-wash px-5 py-2.5 text-[12.5px] text-ink">
          <Flask size={15} weight="duotone" className="text-ochre" />
          Development checkout. No card is charged.
        </div>

        {confirm.isSuccess ? (
          <div className="flex flex-col items-center px-6 py-10 text-center">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-palm-wash text-palm animate-[rise_300ms_ease-out]">
              <CheckCircle size={30} weight="duotone" />
            </span>
            <h1 className="display mt-5 text-[30px] leading-tight text-ink">
              Payment <em>received</em>.
            </h1>
            <p className="mt-2 text-[14px] text-ink-muted">
              {info ? `You're on ${info.planName}, billed ${info.interval === "YEARLY" ? "yearly" : "monthly"}.` : "Your plan is active."}
            </p>
            <ButtonLink href="/billing" className="mt-7">
              Back to billing
            </ButtonLink>
          </div>
        ) : (
          <div className="px-6 pb-6 pt-6">
            <p className="eyebrow">Paying for</p>
            <div className="mt-2 flex items-baseline justify-between gap-4">
              <h1 className="display-sm text-[26px] text-ink">{info ? `${info.planName} plan` : "Subscription"}</h1>
              <span className="text-[12.5px] text-ink-muted">{info ? (info.interval === "YEARLY" ? "Yearly" : "Monthly") : ""}</span>
            </div>
            <AdireRule className="my-5 text-line-strong" count={18} />
            <dl className="flex flex-col gap-2.5 text-[13.5px]">
              <div className="flex justify-between">
                <dt className="text-ink-muted">Amount</dt>
                <dd className="font-mono text-[20px] text-ink">{info?.amountKobo != null ? naira(info.amountKobo) : "-"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-ink-muted">Reference</dt>
                <dd className="max-w-[60%] truncate font-mono text-[12.5px] text-ink">{reference || "missing"}</dd>
              </div>
            </dl>

            {confirm.isError && (
              <p role="alert" className="mt-5 flex items-start gap-2 rounded-md border border-[color-mix(in_oklab,var(--danger)_30%,transparent)] bg-danger-wash px-3 py-2.5 text-[13px] text-danger">
                <WarningOctagon size={16} weight="duotone" className="mt-px shrink-0" />
                {errorMessage(confirm.error)}
              </p>
            )}

            <Button size="lg" className="mt-6 w-full" disabled={!reference} loading={confirm.isPending} onClick={() => confirm.mutate()}>
              <ShieldCheck size={17} weight="duotone" /> Approve test payment
            </Button>
            <Link href="/billing" className="mt-3 block text-center text-[13px] text-ink-muted underline-offset-4 hover:text-ink hover:underline">
              Cancel and go back
            </Link>
          </div>
        )}
      </div>
      <p className="mt-6 max-w-sm text-center text-[12px] text-ink-faint">
        In production this step happens on the payment provider&rsquo;s secure page.
      </p>
    </div>
  );
}
