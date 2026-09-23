"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowCounterClockwise, CaretLeft, CaretRight, Check, EyeSlash, Flag, SealCheck } from "@phosphor-icons/react";
import { usePlatformReviews, qk3 } from "@/lib/api/hooks-m3";
import { platformM3Api } from "@/lib/api/endpoints-m3";
import type { ModerationReason, ModerationReview } from "@/lib/api/types-m3";
import { toast } from "@/lib/store";
import { formatDateTime, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, Textarea } from "@/components/ui/form";
import { EmptyState, ErrorState, PageHeader, Panel, Skeleton } from "@/components/ui/primitives";
import { Stars } from "@/components/m3/bits";
import { ChipRadio } from "@/components/m2/bits";

type Tab = "FLAGGED" | "PUBLISHED" | "HIDDEN";
const TABS: { value: Tab; label: string; blurb: string }[] = [
  { value: "FLAGGED", label: "Flagged", blurb: "Reported by a hotel or caught by the filter. Decide: leave it up or hide it." },
  { value: "PUBLISHED", label: "Live", blurb: "Everything guests can read now, newest first." },
  { value: "HIDDEN", label: "Hidden", blurb: "Taken down, with the reason. Restore if the call was wrong." },
];

const REASONS: { value: ModerationReason; label: string }[] = [
  { value: "ABUSE", label: "Abuse or hate" },
  { value: "PII", label: "Personal details" },
  { value: "OFF_TOPIC", label: "Not about the stay" },
  { value: "SPAM", label: "Spam" },
  { value: "OTHER", label: "Other" },
];
type Reason = ModerationReason;

export function ModerationView() {
  const [tab, setTab] = useState<Tab>("FLAGGED");
  const [page, setPage] = useState(1);
  const q = usePlatformReviews({ status: tab, page, pageSize: 12 });
  const [hide, setHide] = useState<ModerationReview | null>(null);
  const pages = Math.max(1, Math.ceil((q.data?.total ?? 0) / 12));
  const current = TABS.find((t) => t.value === tab)!;

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Flag size={14} weight="duotone" /> Review moderation
          </>
        }
        title={
          <>
            Keep reviews <em>honest</em>
          </>
        }
        description="Reviews come only from verified stays and hotels can't delete them. Hide one only for abuse, personal information or spam, never because it is critical."
      />
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex gap-1 border-b border-line" role="tablist" aria-label="Queue">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => {
                setTab(t.value);
                setPage(1);
              }}
              className={cn("relative h-10 px-3 text-[13.5px] font-medium", tab === t.value ? "text-ink" : "text-ink-muted hover:text-ink")}
            >
              {t.label}
              {tab === t.value && q.data && <span className="ml-1.5 font-mono text-[11.5px] text-ink-muted">{q.data.total}</span>}
              {tab === t.value && <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-laterite" />}
            </button>
          ))}
        </div>
        <p className="text-[12.5px] text-ink-muted">{current.blurb}</p>
      </div>

      {q.isError ? (
        <Panel>
          <ErrorState error={q.error} onRetry={() => q.refetch()} />
        </Panel>
      ) : q.isLoading ? (
        <div className="grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-52" />
          ))}
        </div>
      ) : !q.data?.items.length ? (
        <Panel>
          <EmptyState glyph="rings" title={tab === "FLAGGED" ? "The queue is clear" : "Nothing here"} body={tab === "FLAGGED" ? "No reviews are waiting for a decision." : undefined} />
        </Panel>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2" data-testid="moderation-list">
          {q.data.items.map((r) => (
            <ModCard key={r.id} r={r} onHide={() => setHide(r)} />
          ))}
        </ul>
      )}

      {pages > 1 && (
        <div className="mt-5 flex items-center justify-end gap-2">
          <span className="font-mono text-[12px] text-ink-muted">
            {page} / {pages}
          </span>
          <Button size="icon" variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
            <CaretLeft size={14} />
          </Button>
          <Button size="icon" variant="secondary" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
            <CaretRight size={14} />
          </Button>
        </div>
      )}
      <HideDialog review={hide} onOpenChange={(o) => !o && setHide(null)} />
    </>
  );
}

function ModCard({ r, onHide }: { r: ModerationReview; onHide: () => void }) {
  const qc = useQueryClient();
  const restore = useMutation({
    mutationFn: () => platformM3Api.moderate(r.id, { status: "PUBLISHED" }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk3.pReviewsAll });
      toast.success(r.status === "FLAGGED" ? "Kept up" : "Review restored", "It is live on the hotel's pages.");
    },
    meta: { errorTitle: "Not restored" },
  });
  return (
    <li>
      <Panel as="article" className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-line px-5 py-3">
          <Link href={`/platform/tenants/${r.tenantId}`} className="truncate text-[13px] font-medium text-ink hover:text-laterite">
            {r.hotelName}
          </Link>
          <span className="ml-auto text-[11.5px] text-ink-faint">{relativeTime(r.createdAt)}</span>
        </div>
        <div className="flex-1 px-5 py-4">
          <div className="flex items-center gap-2">
            <Stars value={r.overall} size={14} />
            <span className="text-[12.5px] text-ink-muted">
              {r.displayName} &middot; <SealCheck size={12} weight="fill" className="inline text-palm" /> verified
            </span>
          </div>
          {r.title && <h3 className="display-sm mt-2 text-[17px] leading-snug text-ink">{r.title}</h3>}
          <p className="mt-1.5 line-clamp-6 whitespace-pre-line text-[13.5px] leading-relaxed text-ink">{r.body}</p>
          {r.flaggedReason && (
            <p className="mt-3 flex items-start gap-1.5 rounded-sm bg-ochre-wash px-2.5 py-1.5 text-[12.5px] text-ink">
              <Flag size={13} weight="fill" className="mt-0.5 shrink-0 text-ochre" />
              <span>
                {r.flaggedReason}
                {r.flaggedAt && <span className="text-ink-muted"> &middot; {relativeTime(r.flaggedAt)}</span>}
              </span>
            </p>
          )}
          {r.status === "HIDDEN" && r.moderation && (
            <p className="mt-3 flex items-start gap-1.5 rounded-sm bg-surface-2 px-2.5 py-1.5 text-[12.5px] text-ink-muted">
              <EyeSlash size={13} className="mt-0.5 shrink-0" />
              {REASONS.find((x) => x.value === r.moderation!.reason)?.label ?? r.moderation.reason}
              {r.moderation.note ? `: ${r.moderation.note}` : ""}
            </p>
          )}
          {r.hotelReply && (
            <p className="mt-3 border-l-2 border-line-strong pl-3 text-[12.5px] italic text-ink-muted">
              Hotel replied: {r.hotelReply.body.slice(0, 160)}
              {r.hotelReply.body.length > 160 ? "..." : ""}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-line px-5 py-3">
          {r.status === "HIDDEN" ? (
            <Button size="sm" variant="secondary" onClick={() => restore.mutate()} loading={restore.isPending}>
              <ArrowCounterClockwise size={14} /> Restore
            </Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" onClick={onHide} data-testid="hide-review">
                <EyeSlash size={14} /> Hide
              </Button>
              {r.status === "FLAGGED" && (
                <Button size="sm" variant="ghost" onClick={() => restore.mutate()} loading={restore.isPending}>
                  <Check size={14} /> Keep it up
                </Button>
              )}
            </>
          )}
          <span className="ml-auto font-mono text-[11px] text-ink-faint" title={formatDateTime(r.createdAt)}>
            {r.reservationCode ?? r.id.slice(0, 8)}
          </span>
        </div>
      </Panel>
    </li>
  );
}

function HideDialog({ review, onOpenChange }: { review: ModerationReview | null; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState<Reason>("ABUSE");
  const [note, setNote] = useState("");
  const needsNote = reason === "OTHER";
  const m = useMutation({
    mutationFn: () => platformM3Api.moderate(review!.id, { status: "HIDDEN", reason, note: note.trim() || undefined }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk3.pReviewsAll });
      toast.success("Review hidden", "The hotel sees the reason; the rating is recalculated.");
      setNote("");
      onOpenChange(false);
    },
    meta: { errorTitle: "Not hidden" },
  });
  return (
    <Dialog
      open={!!review}
      onOpenChange={onOpenChange}
      eyebrow={review?.hotelName}
      title="Hide this review?"
      description="It comes off the hotel's pages and out of its rating. The hotel sees the reason you give."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Keep it up
          </Button>
          <Button variant="danger" onClick={() => m.mutate()} loading={m.isPending} disabled={needsNote && note.trim().length < 4}>
            <EyeSlash size={14} /> Hide review
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ChipRadio label="Reason" value={reason} onChange={setReason} options={REASONS.map((r) => ({ value: r.value, label: r.label }))} />
        <Field label="Note for the hotel" htmlFor="hide-note" optional={!needsNote} hint="Be specific: which line, and why. The hotel sees this.">
          <Textarea id="hide-note" value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" />
        </Field>
      </div>
    </Dialog>
  );
}
