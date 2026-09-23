"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, CaretLeft, CaretRight, ChatsCircle, EyeSlash, Flag, PencilSimple, SealCheck, X } from "@phosphor-icons/react";
import { useReviewSummary, useReviews, qk3 } from "@/lib/api/hooks-m3";
import { reviewsApi } from "@/lib/api/endpoints-m3";
import type { HotelReview as Review, ModerationReason, ReviewQuery, TravellerType } from "@/lib/api/types-m3";
import { useMe } from "@/lib/api/hooks";
import { useCan } from "@/lib/permissions";
import { toast } from "@/lib/store";
import { formatDate, relativeTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Field, Select, Textarea } from "@/components/ui/form";
import { Dialog } from "@/components/ui/overlay";
import { EmptyState, ErrorState, PageHeader, Panel, PanelHeader, Segmented, Skeleton } from "@/components/ui/primitives";
import { Stars } from "@/components/m3/bits";
import { RatingTrend, StarDistribution, SubscoreBars } from "./review-charts";

export const TRAVELLER: Record<TravellerType, string> = {
  BUSINESS: "Business",
  COUPLE: "Couple",
  FAMILY: "Family",
  SOLO: "Solo",
  FRIENDS: "Friends",
};

const stayMonthLabel = (m: string) => {
  const [y, mo] = m.slice(0, 7).split("-").map(Number);
  if (!y || !mo) return m;
  return new Date(Date.UTC(y, mo - 1, 15)).toLocaleDateString("en-NG", { month: "long", year: "numeric", timeZone: "UTC" });
};

type ReplyFilter = "" | "false" | "true";

export const MODERATION: Record<ModerationReason, string> = {
  ABUSE: "abusive language",
  PII: "personal information",
  SPAM: "spam",
  OFF_TOPIC: "not about the stay",
  OTHER: "moderator's decision",
};
const REPLY_MAX = 2000;

export function ReviewsView() {
  const { can } = useCan();
  const summary = useReviewSummary();
  const search = useSearchParams();
  const [replied, setReplied] = useState<ReplyFilter>(() => (search.get("replied") === "false" ? "false" : search.get("replied") === "true" ? "true" : ""));
  const [rating, setRating] = useState<number | null>(null);
  const [traveller, setTraveller] = useState<TravellerType | "">("");
  const [page, setPage] = useState(1);
  const query: ReviewQuery = {
    replied: replied || undefined,
    rating: rating ?? undefined,
    travellerType: traveller || undefined,
    page,
    pageSize: 10,
  };
  const list = useReviews(query);
  const s = summary.data;
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 10));
  const filtered = !!(replied || rating || traveller);

  return (
    <>
      <PageHeader
        eyebrow="Guests"
        title={
          <>
            Re<em>views</em>
          </>
        }
        description="Only guests who stayed can review, one review per stay, from a link sent after check-out. You can reply once and edit it; reviews can't be deleted."
      />

      {summary.isError ? (
        <Panel className="mb-6">
          <ErrorState error={summary.error} onRetry={() => summary.refetch()} />
        </Panel>
      ) : (
        <Panel className="mb-6 grid md:grid-cols-12 md:divide-x md:divide-line max-md:divide-y max-md:divide-line">
          <div className="flex flex-col justify-between gap-4 px-5 py-5 md:col-span-3">
            <p className="eyebrow text-[10px]">Overall</p>
            {s ? (
              <div>
                <p className="display text-[64px] leading-[0.9] text-ink" data-testid="review-rating">
                  {s.rating != null ? s.rating.toFixed(1) : "-"}
                </p>
                <Stars value={s.rating ?? 0} size={16} className="mt-2" />
                <p className="mt-2 text-[13px] text-ink-muted">
                  from <span className="font-mono text-ink">{s.count}</span> verified {s.count === 1 ? "stay" : "stays"}
                </p>
              </div>
            ) : (
              <Skeleton className="h-28 w-32" />
            )}
            {s && (
              <p className="text-[12.5px] text-ink-muted">
                <span className={cn("font-mono", s.unreplied ? "text-laterite" : "text-ink")}>{s.unreplied}</span> waiting for a reply
              </p>
            )}
          </div>
          <div className="px-5 py-5 md:col-span-4">
            <p className="eyebrow mb-3 text-[10px]">By stars {rating ? <span className="normal-case tracking-normal text-laterite">(filtering)</span> : null}</p>
            {s ? (
              <StarDistribution
                counts={s.distribution}
                total={s.count}
                active={rating}
                onPick={(v) => {
                  setRating(v);
                  setPage(1);
                }}
              />
            ) : (
              <Skeleton className="h-28 w-full" />
            )}
          </div>
          <div className="px-5 py-5 md:col-span-5">
            <p className="eyebrow mb-3 text-[10px]">What guests scored</p>
            {s ? (
              <SubscoreBars
                items={[
                  { key: "cleanliness", label: "Cleanliness", value: s.subscores.cleanliness },
                  { key: "service", label: "Service", value: s.subscores.service },
                  { key: "location", label: "Location", value: s.subscores.location },
                  { key: "value", label: "Value", value: s.subscores.value },
                ]}
              />
            ) : (
              <Skeleton className="h-28 w-full" />
            )}
          </div>
        </Panel>
      )}

      {s && s.trend.some((t) => t.count > 0) && (
        <Panel className="mb-8">
          <PanelHeader eyebrow="Trend" title="Average rating by month" description="The line is the month's average; the small columns are how many reviews it rests on." />
          <div className="px-4 pb-4 pt-4 sm:px-5">
            <RatingTrend data={s.trend.map((t) => ({ month: t.month, average: t.rating, count: t.count }))} />
          </div>
        </Panel>
      )}

      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <Segmented<ReplyFilter>
          label="Reply status"
          value={replied}
          onChange={(v) => {
            setReplied(v);
            setPage(1);
          }}
          options={[
            { value: "", label: "All" },
            { value: "false", label: <>Needs a reply{s?.unreplied ? <span className="ml-1 font-mono text-laterite">{s.unreplied}</span> : null}</> },
            { value: "true", label: "Replied" },
          ]}
        />
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <Select
            value={traveller}
            onChange={(e) => {
              setTraveller(e.target.value as TravellerType | "");
              setPage(1);
            }}
            className="h-9 w-auto min-w-[150px]"
            aria-label="Traveller type"
          >
            <option value="">All travellers</option>
            {(Object.keys(TRAVELLER) as TravellerType[]).map((t) => (
              <option key={t} value={t}>
                {TRAVELLER[t]}
                {s?.byTravellerType?.[t] ? ` (${s.byTravellerType[t]})` : ""}
              </option>
            ))}
          </Select>
          {rating && (
            <button
              onClick={() => setRating(null)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-ink bg-ink px-3 text-[12.5px] font-medium text-paper"
            >
              {rating} stars <X size={12} weight="bold" />
            </button>
          )}
          <span className="ml-auto font-mono text-[12px] text-ink-muted">{list.data ? `${list.data.total} ${list.data.total === 1 ? "review" : "reviews"}` : ""}</span>
        </div>
      </div>

      {list.isError ? (
        <Panel>
          <ErrorState error={list.error} onRetry={() => list.refetch()} />
        </Panel>
      ) : list.isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : !list.data?.items.length ? (
        <Panel>
          <EmptyState
            glyph="dots"
            title={filtered ? "No reviews match" : "No reviews yet"}
            body={filtered ? "Try another filter." : "After a guest checks out, they get a link to review their stay. Their review lands here."}
          />
        </Panel>
      ) : (
        <ol className="flex flex-col gap-4" data-testid="review-list">
          {list.data.items.map((r) => (
            <ReviewCard key={r.id} r={r} canReply={can("reviews.reply")} />
          ))}
        </ol>
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
    </>
  );
}

function ReviewCard({ r, canReply }: { r: Review; canReply: boolean }) {
  const [composing, setComposing] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const low = r.overall <= 2;
  return (
    <li>
      <Panel as="article" className={cn("overflow-hidden", r.status === "HIDDEN" && "opacity-75")} aria-label={`Review by ${r.displayName}`}>
        <div className="grid gap-5 px-5 py-5 md:grid-cols-[1fr_200px]">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <Stars value={r.overall} size={15} label={`${r.overall} out of 5`} className={low ? "text-danger" : undefined} />
              <span className="font-mono text-[12px] text-ink-muted">{r.overall}/5</span>
              {r.status === "HIDDEN" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-line-strong px-2 py-0.5 text-[11px] font-medium text-ink-muted">
                  <EyeSlash size={11} /> Hidden by moderators
                </span>
              )}
              {r.status === "FLAGGED" && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_oklab,var(--ochre)_35%,transparent)] bg-ochre-wash px-2 py-0.5 text-[11px] font-medium text-ochre">
                  Under review
                </span>
              )}
            </div>
            {r.title && <h3 className="display-sm mt-2 text-[19px] leading-snug text-ink">{r.title}</h3>}
            <p className={cn("whitespace-pre-line text-[14px] leading-relaxed text-ink", r.title ? "mt-1.5" : "mt-2.5")}>{r.body}</p>
            {r.status === "HIDDEN" && r.moderation && (
              <p className="mt-2 text-[12.5px] text-ink-muted">
                Hidden from your pages for {MODERATION[r.moderation.reason] ?? r.moderation.reason}
                {r.moderation.note ? `: ${r.moderation.note}` : "."}
              </p>
            )}
            {r.status === "FLAGGED" && r.flaggedReason && <p className="mt-2 text-[12.5px] text-ink-muted">Reported: {r.flaggedReason}</p>}
          </div>
          <dl className="flex flex-col gap-1.5 border-line text-[12.5px] md:border-l md:pl-5 max-md:border-t max-md:pt-4">
            <div>
              <dt className="sr-only">Guest</dt>
              <dd className="text-[14px] font-medium text-ink" title={r.guestName}>
                {r.guestName || r.displayName}
                {r.guestName && <span className="block text-[11.5px] font-normal text-ink-faint">shown as {r.displayName}</span>}
              </dd>
            </div>
            <div className="flex gap-1.5 text-ink-muted">
              <dt className="sr-only">Travelling as</dt>
              <dd>{TRAVELLER[r.travellerType] ?? r.travellerType}</dd>
              <span aria-hidden>&middot;</span>
              <dt className="sr-only">Stayed</dt>
              <dd>{stayMonthLabel(r.stayMonth)}</dd>
            </div>
            <div className="mt-1">
              <dt className="sr-only">Verification</dt>
              <dd>
                {r.reservationId ? (
                  <Link
                    href={`/reservations/${r.reservationId}`}
                    className="inline-flex items-center gap-1 rounded-sm text-palm underline-offset-4 hover:underline"
                    data-testid="verified-stay"
                  >
                    <SealCheck size={14} weight="fill" /> Verified stay
                    {r.reservationCode && <span className="font-mono text-[11.5px] text-ink-muted">{r.reservationCode}</span>}
                    <ArrowUpRight size={11} className="text-ink-faint" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1 text-palm">
                    <SealCheck size={14} weight="fill" /> Verified stay
                  </span>
                )}
              </dd>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[11.5px] text-ink-muted">
              <span>Clean {r.cleanliness}</span>
              <span>Service {r.service}</span>
              <span>Location {r.location}</span>
              <span>Value {r.value}</span>
            </div>
            <p className="mt-auto pt-2 text-[11.5px] text-ink-faint">Written {relativeTime(r.createdAt)}</p>
          </dl>
        </div>

        {r.hotelReply && !composing ? (
          <div className="border-t border-line bg-surface-2/40 px-5 py-4">
            <div className="border-l-2 border-laterite pl-4">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <p className="text-[12.5px] font-medium text-ink">Response from the hotel</p>
                <p className="text-[12px] text-ink-muted">{formatDate(r.hotelReply.repliedAt)}</p>
                {canReply && (
                  <button onClick={() => setComposing(true)} className="ml-auto inline-flex items-center gap-1 text-[12.5px] text-ink-muted hover:text-ink">
                    <PencilSimple size={13} /> Edit
                  </button>
                )}
              </div>
              <p className="mt-1.5 whitespace-pre-line text-[13.5px] leading-relaxed text-ink-muted" data-testid="hotel-reply">
                {r.hotelReply.body}
              </p>
            </div>
          </div>
        ) : composing ? (
          <ReplyComposer r={r} onDone={() => setComposing(false)} />
        ) : canReply ? (
          <div className="flex flex-wrap items-center gap-3 border-t border-line px-5 py-3">
            <Button size="sm" variant={low ? "primary" : "secondary"} onClick={() => setComposing(true)} data-testid="reply-review">
              <ChatsCircle size={15} weight="duotone" /> Reply
            </Button>
            <p className="flex-1 text-[12.5px] text-ink-muted">{low ? "A calm, specific reply matters most on a low score." : "Your reply shows under the review on your pages."}</p>
            {r.status === "PUBLISHED" && (
              <button onClick={() => setFlagging(true)} className="inline-flex items-center gap-1 text-[12.5px] text-ink-muted hover:text-ink">
                <Flag size={13} /> Report
              </button>
            )}
          </div>
        ) : null}
        {canReply && <FlagDialog r={r} open={flagging} onOpenChange={setFlagging} />}
      </Panel>
    </li>
  );
}

function ReplyComposer({ r, onDone }: { r: Review; onDone: () => void }) {
  const qc = useQueryClient();
  const me = useMe();
  const [text, setText] = useState(r.hotelReply?.body ?? `Dear ${r.displayName.split(" ")[0]},\n\n`);
  const m = useMutation({
    mutationFn: () => reviewsApi.reply(r.id, text.trim()),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk3.reviewsAll });
      toast.success(r.hotelReply ? "Reply updated" : "Reply posted", "It shows under the review on your pages.");
      onDone();
    },
    meta: { errorTitle: "Reply not saved" },
  });
  const len = text.trim().length;
  const tooShort = len < 10;
  const hints = [
    { ok: /thank|grateful|appreciate/i.test(text), text: "Thank them for staying" },
    { ok: len > 120, text: "Answer the specific point they raised" },
    { ok: !/\b(0[789]\d{9}|\+234\d{10})\b/.test(text) && !/room\s*\d{3}/i.test(text), text: "No phone numbers or room numbers" },
  ];
  return (
    <div className="border-t border-line bg-surface-2/40 px-5 py-4" data-testid="reply-composer">
      <div className="grid gap-4 lg:grid-cols-[1fr_220px]">
        <div>
          <label htmlFor={`reply-${r.id}`} className="text-[13px] font-medium text-ink">
            {r.hotelReply ? "Edit your reply" : `Reply to ${r.displayName}`}
          </label>
          <Textarea
            id={`reply-${r.id}`}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, REPLY_MAX))}
            className="mt-1.5 min-h-32"
            autoFocus
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => m.mutate()} loading={m.isPending} disabled={tooShort}>
              {r.hotelReply ? "Save reply" : "Post reply"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
            <span className={cn("ml-auto font-mono text-[11.5px]", len > REPLY_MAX * 0.9 ? "text-ochre" : "text-ink-faint")}>
              {len} / {REPLY_MAX}
            </span>
          </div>
        </div>
        <div className="text-[12.5px]">
          <p className="eyebrow mb-2 text-[10px]">A good reply</p>
          <ul className="flex flex-col gap-1.5">
            {hints.map((h) => (
              <li key={h.text} className={cn("flex items-start gap-2", h.ok ? "text-palm" : "text-ink-muted")}>
                <span aria-hidden className={cn("mt-[5px] h-2 w-2 shrink-0 rounded-full border", h.ok ? "border-palm bg-palm" : "border-line-strong")} />
                {h.text}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[12px] text-ink-faint">Posted as {me.data?.tenant.name ?? "the hotel"}, not as you.</p>
        </div>
      </div>
    </div>
  );
}

function FlagDialog({ r, open, onOpenChange }: { r: Review; open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [reason, setReason] = useState("");
  const m = useMutation({
    mutationFn: () => reviewsApi.flag(r.id, reason.trim()),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: qk3.reviewsAll });
      toast.success("Reported for review", "It stays up until a moderator decides.");
      setReason("");
      onOpenChange(false);
    },
    meta: { errorTitle: "Not reported" },
  });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow={`${r.displayName}, ${r.overall}/5`}
      title="Report this review?"
      description="Moderators hide reviews only for abuse, personal information, spam, or text that isn't about the stay. A low score alone is not a reason."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => m.mutate()} loading={m.isPending} disabled={reason.trim().length < 5}>
            <Flag size={14} /> Report
          </Button>
        </>
      }
    >
      <Field label="What is wrong with it?" htmlFor={`flag-${r.id}`} hint="At least a few words. The moderators read this.">
        <Textarea id={`flag-${r.id}`} value={reason} onChange={(e) => setReason(e.target.value.slice(0, 300))} className="min-h-20" />
      </Field>
    </Dialog>
  );
}
