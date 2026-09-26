"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChatCircleText,
  CheckCircle,
  Clock,
  Copy,
  EyeSlash,
  Flag,
  Handshake,
  Lock,
  NotePencil,
  PaperPlaneTilt,
  PhoneSlash,
  Play,
  Receipt,
  Storefront,
  UserCircle,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import { useMe, useStaff } from "@/lib/api/hooks";
import { isApiError } from "@/lib/api/client";
import { conciergeApi } from "@/lib/api/endpoints-m8";
import { qk8, useConciergeAccess, useConciergeRequest, useConciergeSettings, useVendors } from "@/lib/api/hooks-m8";
import type { RequestDetail, TimelineEvent } from "@/lib/api/types-m8";
import { firstName, formatDateTime, formatPhone, naira, relativeTime } from "@/lib/format";
import { dayKeyOf, formatDay, lagosHHMM } from "@/lib/dates";
import { toast } from "@/lib/store";
import { Button, ButtonLink } from "@/components/ui/button";
import { Dialog } from "@/components/ui/overlay";
import { Field, Select, Switch, Textarea } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { CONTACT, SOURCE, categoryMeta, pricingLabel } from "./catalog";
import { CategoryGlyph, DISCREET_HOLDERS, DiscreetSeal, ReqStatus, SealGlyph, SecurityTint, SlaTimer, StarInput } from "./bits";
import { QuoteComposer } from "./quote-composer";
import { Highlight } from "./highlight";
import { useRequestActions } from "./actions";

const FINAL = ["COMPLETED", "DECLINED", "CANCELLED"];
const when = (iso: string | null) => (iso ? `${formatDay(dayKeyOf(iso), { weekday: "short", day: "numeric", month: "short" })} ${lagosHHMM(iso)}` : null);

export function RequestDetailView({ id }: { id: string }) {
  const q = useConciergeRequest(id);
  const access = useConciergeAccess();
  if (q.isError)
    return isApiError(q.error) && q.error.status === 404 ? (
      <Panel className="mx-auto mt-6 max-w-lg">
        <EmptyState glyph="rings" title="Nothing to show" body={`This request isn't there, or it's private and handled by ${DISCREET_HOLDERS}.`} action={<ButtonLink href="/concierge" variant="secondary">Back to the board</ButtonLink>} />
      </Panel>
    ) : (
      <Panel>
        <ErrorState error={q.error} onRetry={() => q.refetch()} />
      </Panel>
    );
  if (!q.data) return <Skeleton className="h-[70vh]" />;
  const r = q.data;
  return (
    <div data-testid="request-detail" data-masked={r.masked || undefined}>
      <Link href="/concierge" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink">
        <ArrowLeft size={14} /> Concierge
      </Link>
      <header className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          <p className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[12px] text-ink-muted">{r.number}</span>
            <ReqStatus s={r.status} />
            {r.discreet && <DiscreetSeal readable={!r.masked} />}
            {r.flagged && r.flag?.status !== "CLEARED" && (
              <Badge tone="ochre" icon={<Flag size={11} weight="fill" />}>
                Held for a manager
              </Badge>
            )}
          </p>
          <h1 className="display text-[30px] leading-[1.05] text-ink md:text-[38px]" data-testid="request-title">
            {r.masked ? "Private request" : r.title}
          </h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] text-ink-muted">
            {r.roomNumber ? (
              <span>
                Room <span className="font-mono text-ink">{r.roomNumber}</span>
              </span>
            ) : (
              <span>Before arrival</span>
            )}
            {!r.masked && r.guest && (
              <>
                <span aria-hidden>&middot;</span>
                <span className="text-ink">{r.guest.fullName}</span>
                {r.guest.vip && <Badge tone="brass">VIP</Badge>}
              </>
            )}
            <span aria-hidden>&middot;</span> asked {relativeTime(r.createdAt)} via {SOURCE[r.source].toLowerCase()}
          </p>
        </div>
        <SlaTimer r={r} className="text-[13px]" />
      </header>

      {r.discreet && !r.masked && (
        <div className="mb-5 flex items-start gap-3 rounded-md border border-[color-mix(in_oklab,var(--brass)_40%,transparent)] bg-brass-wash/45 px-4 py-3" data-testid="discreet-notice">
          <SealGlyph size={18} className="mt-0.5 shrink-0 text-brass" />
          <div className="text-[13px] leading-snug text-ink">
            <p className="font-medium">A private request.</p>
            <p className="text-ink-muted">Only {DISCREET_HOLDERS} can see the service, the notes and who asked. Opening it is recorded in the audit log. The bill and every message to the guest use neutral wording{r.doNotCallRoom ? ", and the guest is never called on the room phone" : ""}.</p>
          </div>
        </div>
      )}
      {r.redactedAt && (
        <p className="mb-5 flex items-center gap-2 text-[12.5px] text-ink-muted">
          <EyeSlash size={14} /> Notes and answers were blanked out on {formatDateTime(r.redactedAt)}, as your retention setting asks.
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col gap-6">
          {r.masked ? <SealedEnvelope r={r} /> : <WhatTheyAsked r={r} />}
          <Timeline r={r} canNote={access.work && !r.masked} />
        </div>
        <aside className="flex min-w-0 flex-col gap-6">
          <NextStep r={r} />
          {!r.masked && access.work && !FINAL.includes(r.status) && <AssignPanel r={r} />}
          {!r.masked && r.payment.folioEntryId && <FolioCard r={r} />}
          {!r.masked && r.status === "COMPLETED" && r.vendor && access.work && <RateVendor r={r} />}
        </aside>
      </div>
    </div>
  );
}

/** What someone without concierge.discreet sees: an envelope they can't read through. */
function SealedEnvelope({ r }: { r: RequestDetail }) {
  return (
    <Panel className="relative overflow-hidden" data-testid="sealed-envelope">
      <SecurityTint className="text-line-strong opacity-50" />
      <div className="relative flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full border border-[color-mix(in_oklab,var(--brass)_50%,transparent)] bg-surface text-brass">
          <SealGlyph size={30} />
        </span>
        <h2 className="display-sm text-[21px] text-ink">This request is private</h2>
        <p className="max-w-md bg-surface/80 text-[13.5px] leading-relaxed text-ink-muted">
          Only {DISCREET_HOLDERS} can see what was asked for and by whom.
          {r.assignee ? ` ${r.assignee.fullName} is looking after it.` : " The concierge team is looking after it."}
        </p>
        <dl className="mt-2 grid grid-cols-[auto_auto] gap-x-8 gap-y-1 rounded-md border border-line bg-surface px-5 py-3 text-left text-[12.5px]">
          <dt className="text-ink-muted">Room</dt>
          <dd className="font-mono text-ink">{r.roomNumber ?? "Before arrival"}</dd>
          <dt className="text-ink-muted">When</dt>
          <dd className="font-mono text-ink">{when(r.preferredStart) ?? "Not set"}</dd>
          <dt className="text-ink-muted">With</dt>
          <dd className="text-ink">{r.assignee?.fullName ?? "Concierge team"}</dd>
        </dl>
      </div>
    </Panel>
  );
}

function WhatTheyAsked({ r }: { r: RequestDetail }) {
  const cat = categoryMeta(r.category);
  const terms = r.flag?.status === "PENDING" ? r.flag.terms : [];
  const rows: [string, React.ReactNode][] = [];
  if (r.variant) rows.push(["Option", r.variant.name]);
  if (r.preferredStart) rows.push(["When", <span key="w" className="font-mono">{when(r.preferredStart)}{r.preferredEnd ? ` to ${lagosHHMM(r.preferredEnd)}` : ""}</span>]);
  if (r.hours) rows.push(["Hours", <span key="h" className="font-mono">{r.hours}</span>]);
  if (r.partySize) rows.push(["People", <span key="p" className="font-mono">{r.partySize}</span>]);
  for (const a of r.answers ?? []) rows.push([a.label, a.sensitive ? <span key={a.key} className="text-ink-muted">{a.display}</span> : a.display]);
  rows.push([
    "Reply by",
    <span key="c" className="inline-flex items-center gap-1.5">
      {CONTACT[r.contactPreference]}
      {r.contactPreference !== "IN_APP" && (r.contact.phone || r.contact.email) && <span className="font-mono text-[12px] text-ink-muted">{r.contactPreference === "EMAIL" ? r.contact.email : formatPhone(r.contact.phone)}</span>}
      {r.doNotCallRoom && (
        <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-muted">
          <PhoneSlash size={12} /> not the room phone
        </span>
      )}
    </span>,
  ]);
  return (
    <Panel>
      <PanelHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <CategoryGlyph category={r.category} size={13} /> {cat.label}
            {r.service ? <span className="text-ink-faint">&middot; {pricingLabel(r.service.pricing)}</span> : <span className="text-ink-faint">&middot; in their own words</span>}
          </span>
        }
        title="What they asked for"
        actions={
          r.reservation ? (
            <ButtonLink href={`/reservations/${r.reservation.id}`} size="sm" variant="ghost">
              <span className="font-mono">{r.reservation.code}</span>
            </ButtonLink>
          ) : undefined
        }
      />
      {r.requestText && (
        <div className="border-b border-line px-5 py-4">
          <p className="whitespace-pre-line font-display text-[17px] leading-relaxed text-ink" data-testid="request-text">
            &ldquo;<Highlight text={r.requestText} terms={terms} />&rdquo;
          </p>
        </div>
      )}
      <dl className="grid grid-cols-[minmax(96px,max-content)_minmax(0,1fr)] gap-x-6 gap-y-2.5 px-5 py-4 text-[13.5px]" data-testid="request-answers">
        {rows.map(([k, v], i) => (
          <div key={`${k}-${i}`} className="contents">
            <dt className="text-ink-muted">{k}</dt>
            <dd className="min-w-0 text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      {r.notes && (
        <div className="border-t border-line px-5 py-4">
          <p className="eyebrow mb-1.5">Their note</p>
          <p className="whitespace-pre-line text-[14px] leading-relaxed text-ink" data-testid="request-notes">
            <Highlight text={r.notes} terms={terms} />
          </p>
        </div>
      )}
      {r.internalNotes && (
        <div className="border-t border-dashed border-line bg-surface-2/40 px-5 py-3">
          <p className="eyebrow mb-1">For the team</p>
          <p className="whitespace-pre-line text-[13px] text-ink">{r.internalNotes}</p>
        </div>
      )}
    </Panel>
  );
}

const EVENT_ICON: Record<string, React.ReactNode> = {
  CREATED: <ChatCircleText size={13} weight="fill" />,
  QUOTED: <Receipt size={13} weight="fill" />,
  QUOTE_ACCEPTED: <CheckCircle size={13} weight="fill" />,
  CONFIRMED: <CheckCircle size={13} weight="fill" />,
  ASSIGNED: <UserCircle size={13} weight="fill" />,
  VENDOR_SENT: <Storefront size={13} weight="fill" />,
  IN_PROGRESS: <Play size={13} weight="fill" />,
  COMPLETED: <CheckCircle size={13} weight="fill" />,
  NOTE: <NotePencil size={13} weight="fill" />,
  FLAGGED: <Flag size={13} weight="fill" />,
  DECLINED: <XCircle size={13} weight="fill" />,
  POSTED: <Receipt size={13} weight="fill" />,
};

const eventText = (e: TimelineEvent) => {
  const base = e.type.toLowerCase().replace(/[._]/g, " ");
  return e.note ? e.note : base.charAt(0).toUpperCase() + base.slice(1);
};

function Timeline({ r, canNote }: { r: RequestDetail; canNote: boolean }) {
  const { note } = useRequestActions();
  const [text, setText] = useState("");
  const events = [...r.timeline].reverse();
  return (
    <Panel>
      <PanelHeader title="Timeline" description={r.masked ? "Times and who moved it on. The contents are for the concierge team." : "Every step, message and note. Notes stay with the team."} />
      {canNote && (
        <form
          className="flex flex-col gap-2 border-b border-line px-5 py-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) note.mutate({ id: r.id, text: text.trim() }, { onSuccess: () => setText("") });
          }}
        >
          <label htmlFor="team-note" className="sr-only">
            Note for the team
          </label>
          <Textarea id="team-note" className="min-h-14" placeholder="A note for the team. The guest never sees it." value={text} onChange={(e) => setText(e.target.value)} maxLength={500} />
          <Button type="submit" size="sm" variant="secondary" className="self-end" loading={note.isPending} disabled={!text.trim()}>
            <NotePencil size={14} /> Add note
          </Button>
        </form>
      )}
      <ol className="relative flex flex-col px-5 py-4" data-testid="timeline">
        <span aria-hidden className="absolute bottom-6 left-[31px] top-6 w-px bg-line" />
        {events.map((e, i) => (
          <li key={`${e.at}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
            <span className={cn("relative z-[1] grid h-6 w-6 shrink-0 place-items-center rounded-full border bg-surface", e.guestVisible ? "border-[color-mix(in_oklab,var(--laterite)_35%,transparent)] text-laterite" : "border-line-strong text-ink-muted")}>
              {EVENT_ICON[e.type.split(".").pop()!.toUpperCase()] ?? EVENT_ICON[e.status ?? ""] ?? <Clock size={13} />}
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className={cn("text-[13.5px] leading-snug", e.guestVisible ? "text-ink" : "text-ink-muted")}>{eventText(e)}</p>
              <p className="mt-0.5 text-[11.5px] text-ink-faint">
                {e.by ?? "Automatic"} &middot; <span className="font-mono">{formatDateTime(e.at)}</span>
                {e.guestVisible ? <> &middot; the guest sees this</> : <> &middot; team only</>}
              </p>
            </div>
          </li>
        ))}
        {!events.length && <li className="text-[13px] text-ink-muted">Opened {formatDateTime(r.createdAt)}.</li>}
      </ol>
    </Panel>
  );
}

function folioLine(r: RequestDetail, labels?: { inRoom: string; other: string }) {
  if (r.discreet) return `${r.service?.location === "IN_ROOM" || !r.service ? (labels?.inRoom ?? "In-room service") : (labels?.other ?? "Guest service")} (${r.number})`;
  return `${r.title} (${r.number})`;
}

function NextStep({ r }: { r: RequestDetail }) {
  const access = useConciergeAccess();
  const me = useMe();
  const settings = useConciergeSettings(access.view);
  const { progress, confirm, decline, flagReview } = useRequestActions();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [review, setReview] = useState<"CLEAR" | "DECLINE" | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [vendorScore, setVendorScore] = useState(0);
  const amount = r.quote?.totalKobo ?? r.price?.totalKobo ?? null;
  const work = access.work && !r.masked;
  const mine = r.assignee?.id === me.data?.user.id;

  useEffect(() => {
    if (window.location.hash === "#finish") document.getElementById("finish")?.scrollIntoView({ block: "center" });
  }, []);

  let title = "Next step";
  let body: React.ReactNode = null;
  const pendingFlag = r.flagged && r.flag?.status === "PENDING";

  if (r.masked) {
    title = FINAL.includes(r.status) ? "Closed" : "Helping it along";
    body = (
      <div className="flex flex-col gap-3 px-5 py-4">
        <p className="text-[13px] text-ink-muted">{mine ? "It's with you. When you've delivered it, mark it here; the details stay with the concierge team." : `Only ${r.assignee?.fullName ?? "the person it's assigned to"} or the concierge team can move it on.`}</p>
        {mine && (r.status === "CONFIRMED" || r.status === "SCHEDULED") && (
          <Button onClick={() => progress.mutate({ r, status: "IN_PROGRESS" })} loading={progress.isPending} data-testid="start-request">
            <Play size={15} /> Start
          </Button>
        )}
        {mine && r.status === "IN_PROGRESS" && (
          <Button onClick={() => progress.mutate({ r, status: "COMPLETED" })} loading={progress.isPending} data-testid="complete-request">
            <CheckCircle size={15} /> Mark done
          </Button>
        )}
      </div>
    );
  } else if (pendingFlag) {
    title = "Held for a manager";
    body = (
      <div className="flex flex-col gap-3 px-5 py-4" data-testid="flag-explainer">
        <p className="text-[13px] leading-relaxed text-ink">The wording may fall outside what the hotel can arrange, so it was not priced, confirmed or sent to anyone, and the guest was told you&rsquo;ll get back to them.</p>
        {!!r.flag?.terms.length && (
          <p className="flex flex-wrap items-center gap-1 text-[12.5px] text-ink-muted">
            Caught by
            {r.flag.terms.map((t) => (
              <mark key={t} className="rounded-xs bg-ochre-wash px-1 font-mono text-[12px] text-ink">
                {t}
              </mark>
            ))}
          </p>
        )}
        {access.review ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => setReview("CLEAR")} data-testid="flag-clear">
              <CheckCircle size={15} /> It&rsquo;s fine, carry on
            </Button>
            <Button variant="ghost" className="hover:text-danger" onClick={() => setReview("DECLINE")} data-testid="flag-decline">
              <XCircle size={15} /> Decline
            </Button>
          </div>
        ) : (
          <p className="text-[12.5px] text-ink-muted">An owner or manager decides.</p>
        )}
      </div>
    );
  } else if (r.status === "NEW") {
    const priced = !!r.price && r.service?.pricing !== "FROM";
    title = priced ? "Confirm it" : "Send a quote";
    body = !work ? (
      <p className="px-5 py-4 text-[13px] text-ink-muted">Waiting for the concierge team.</p>
    ) : priced ? (
      <div className="flex flex-col gap-3 px-5 py-4">
        <p className="flex items-baseline justify-between gap-3 text-[13px] text-ink-muted">
          <span>{r.price!.description}</span>
          <span className="font-mono text-[18px] text-ink">{naira(r.price!.totalKobo)}</span>
        </p>
        <Button onClick={() => confirm.mutate({ id: r.id, paymentMethod: r.price!.totalKobo === 0 ? "NONE" : r.reservation?.folioOpen ? "FOLIO" : "ONLINE" })} loading={confirm.isPending} data-testid="confirm-request">
          <CheckCircle size={15} /> {r.price!.totalKobo === 0 ? "Confirm" : r.reservation?.folioOpen ? "Confirm, on the bill" : "Confirm and send a payment link"}
        </Button>
        <details className="text-[12.5px] text-ink-muted">
          <summary className="cursor-pointer">Quote a different price</summary>
          <div className="mt-3">
            <QuoteComposer r={r} />
          </div>
        </details>
      </div>
    ) : (
      <div className="px-5 py-4">
        <QuoteComposer r={r} />
      </div>
    );
  } else if (r.status === "QUOTED" || r.status === "AWAITING_GUEST") {
    title = r.status === "QUOTED" ? "With the guest" : "Waiting to pay";
    body = (
      <div className="flex flex-col gap-3 px-5 py-4" data-testid="awaiting-guest">
        {r.quote && (
          <>
            <div className="flex items-baseline justify-between">
              <span className="text-[13px] text-ink-muted">Quote {r.quote.version > 1 ? `v${r.quote.version}` : ""}</span>
              <span className="font-mono text-[20px] text-ink" data-testid="quote-total">
                {naira(r.quote.totalKobo)}
              </span>
            </div>
            {r.quote.taxes.length > 0 && (
              <ul className="-mt-1 flex flex-col gap-0.5 text-[11.5px] text-ink-muted">
                <li className="flex justify-between">
                  <span>Price</span>
                  <span className="font-mono">{naira(r.quote.netKobo)}</span>
                </li>
                {r.quote.taxes.map((t) => (
                  <li key={t.code} className="flex justify-between">
                    <span>{t.label}</span>
                    <span className="font-mono">{naira(t.amountKobo)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="text-[12.5px] text-ink-muted">
              Sent by {CONTACT[r.contactPreference]} {relativeTime(r.quote.sentAt)}; {r.quote.expired ? <span className="text-laterite">it has run out</span> : <>holds until {when(r.quote.validUntil)}</>}. They can reply YES or NO, or use the link.
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="self-start"
              onClick={() => {
                void navigator.clipboard?.writeText(r.quote!.acceptUrl);
                toast.success("Link copied");
              }}
            >
              <Copy size={14} /> Copy the guest&rsquo;s link
            </Button>
          </>
        )}
        {work && r.status === "QUOTED" && (
          <Button variant="secondary" onClick={() => confirm.mutate({ id: r.id, paymentMethod: r.reservation?.folioOpen ? "FOLIO" : "ONLINE", note: "Accepted with the desk" })} loading={confirm.isPending} data-testid="record-accept">
            <CheckCircle size={15} /> They said yes to us
          </Button>
        )}
        {work && (
          <details className="text-[12.5px] text-ink-muted">
            <summary className="cursor-pointer">Change the quote</summary>
            <div className="mt-3">
              <QuoteComposer r={r} />
            </div>
          </details>
        )}
      </div>
    );
  } else if (r.status === "CONFIRMED" || r.status === "SCHEDULED") {
    title = r.status === "SCHEDULED" ? "Booked in" : "Confirmed";
    body = (
      <div className="flex flex-col gap-3 px-5 py-4">
        <p className="text-[13px] text-ink-muted">
          {r.payment.status === "PAID" ? "Paid online. " : r.payment.method === "FOLIO" ? "Goes on the bill when it's done. " : ""}
          {r.preferredStart ? `For ${when(r.preferredStart)}.` : ""}
        </p>
        {work && (
          <Button onClick={() => progress.mutate({ r, status: "IN_PROGRESS" })} loading={progress.isPending} data-testid="start-request">
            <Play size={15} /> Start
          </Button>
        )}
      </div>
    );
  } else if (r.status === "IN_PROGRESS") {
    title = "Finish up";
    const posts = r.payment.method === "FOLIO" && r.payment.status !== "PAID" && amount != null && amount > 0;
    body = (
      <div id="finish" className="flex scroll-mt-24 flex-col gap-3 px-5 py-4">
        {posts && (
          <div className="rounded-md border border-dashed border-line-strong bg-surface-2/40 px-3 py-2.5" data-testid="folio-preview">
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-ink-faint">On the bill it will read</p>
            <p className="mt-1 flex items-baseline justify-between gap-3 text-[13.5px] text-ink">
              <span className="truncate">{folioLine(r, settings.data?.folioLabels)}</span>
              <span className="font-mono">{naira(amount)}</span>
            </p>
            {r.discreet && <p className="mt-1 text-[11.5px] text-ink-muted">Neutral wording. The real service stays in this request.</p>}
          </div>
        )}
        {r.payment.status === "PAID" && <p className="text-[12.5px] text-ink-muted">Paid online; nothing more goes on the bill.</p>}
        {r.vendor && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[12.5px] text-ink-muted">How was {r.vendor.name}?</span>
            <StarInput value={vendorScore} onChange={setVendorScore} label={`Rate ${r.vendor.name}`} size={18} />
          </div>
        )}
        {work && (
          <Button onClick={() => progress.mutate({ r, status: "COMPLETED", vendorRating: vendorScore || undefined })} loading={progress.isPending} data-testid="complete-request">
            <CheckCircle size={15} /> Mark completed
          </Button>
        )}
      </div>
    );
  } else if (r.status === "COMPLETED") {
    title = "Completed";
    body = (
      <div className="flex flex-col gap-2 px-5 py-4">
        <p className="text-[13px] text-ink-muted">
          Done {relativeTime(r.completedAt ?? r.updatedAt)}.{r.rating ? "" : " The guest has been asked how it went."}
        </p>
        {r.rating && (
          <p className="text-[13px] text-ink">
            They gave it <span className="font-mono">{r.rating.rating}/5</span>
            {r.rating.comment ? <>: &ldquo;{r.rating.comment}&rdquo;</> : ""}
          </p>
        )}
      </div>
    );
  } else {
    title = r.status === "DECLINED" ? "Declined" : "Cancelled";
    body = <p className="px-5 py-4 text-[13px] text-ink-muted">{r.declineReason ?? r.cancelReason ?? "Nothing more to do."}</p>;
  }

  return (
    <Panel data-testid="next-step">
      <PanelHeader title={title} />
      {body}
      {!FINAL.includes(r.status) && work && !pendingFlag && (
        <div className="border-t border-line px-5 py-2.5">
          <Button size="sm" variant="ghost" onClick={() => setDeclining(true)} className="hover:text-danger" data-testid="decline-request">
            <XCircle size={14} /> Decline kindly
          </Button>
        </div>
      )}
      <Dialog
        open={declining}
        onOpenChange={setDeclining}
        eyebrow={r.number}
        title="Decline this request?"
        description="The guest gets a short, polite note with your reason in plain words."
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeclining(false)}>
              Keep it
            </Button>
            <Button variant="danger" disabled={reason.trim().length < 3} loading={decline.isPending} onClick={() => decline.mutate({ id: r.id, reason: reason.trim() }, { onSuccess: () => setDeclining(false) })}>
              Decline
            </Button>
          </>
        }
      >
        <Field label="Reason" htmlFor="decline-reason" hint="The guest reads this, so keep it kind.">
          <Textarea id="decline-reason" className="min-h-20" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="We're fully booked for private dinners that evening." />
        </Field>
      </Dialog>
      <Dialog
        open={!!review}
        onOpenChange={(o) => !o && setReview(null)}
        eyebrow={r.number}
        title={review === "CLEAR" ? "Let it carry on?" : "Decline it?"}
        description={review === "CLEAR" ? "It will be priced and handled like any other request, and can go to a vendor." : "The guest is told, in neutral words, that the hotel can't arrange it."}
        footer={
          <>
            <Button variant="secondary" onClick={() => setReview(null)}>
              Back
            </Button>
            <Button variant={review === "DECLINE" ? "danger" : "primary"} disabled={reviewNote.trim().length < 3} loading={flagReview.isPending} onClick={() => flagReview.mutate({ id: r.id, decision: review!, note: reviewNote.trim() }, { onSuccess: () => setReview(null) })} data-testid="flag-review-submit">
              {review === "CLEAR" ? "Carry on" : "Decline"}
            </Button>
          </>
        }
      >
        <Field label="Note for the record" htmlFor="flag-note" hint="Kept with the request and in the audit log.">
          <Textarea id="flag-note" className="min-h-20" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} placeholder={review === "CLEAR" ? "A garden herb, for the chef; fine." : "Not something we can arrange."} />
        </Field>
      </Dialog>
    </Panel>
  );
}

function AssignPanel({ r }: { r: RequestDetail }) {
  const staff = useStaff();
  const me = useMe();
  const vendors = useVendors();
  const settings = useConciergeSettings();
  const { assign, refresh } = useRequestActions();
  const qc = useQueryClient();
  const [channel, setChannel] = useState<"WHATSAPP" | "SMS">("WHATSAPP");
  const [surname, setSurname] = useState(false);
  const [room, setRoom] = useState(false);
  const [vnote, setVnote] = useState("");
  const send = useMutation({
    mutationFn: () => conciergeApi.sendToVendor(r.id, { channel, note: vnote.trim() || undefined, includeGuestSurname: surname, includeRoom: room }),
    onSuccess: (x) => {
      refresh(x);
      void qc.invalidateQueries({ queryKey: qk8.request(r.id) });
      toast.success(`Sent to ${x.vendor?.name ?? "the vendor"}`, `${x.sent.channel === "SMS" ? "SMS" : "WhatsApp"} to ${x.sent.to}.`);
      setVnote("");
    },
    meta: { errorTitle: "Not sent" },
  });
  const people = (staff.data ?? []).filter((s) => s.isActive !== false);
  const self = me.data?.user;
  const options = people.length ? people : self ? [{ id: self.id, fullName: self.fullName }] : [];
  const activeVendors = (vendors.data ?? []).filter((v) => v.active);
  const vendor = (vendors.data ?? []).find((v) => v.id === r.vendor?.id);
  const allowSurname = settings.data?.vendorSharing.guestSurname ?? false;
  const allowRoom = settings.data?.vendorSharing.roomNumber ?? false;
  const blocked = r.flagged && r.flag?.status === "PENDING";
  const guestFirst = r.guest ? firstName(r.guest.fullName) : "the guest";
  const guestName = surname && r.guest ? r.guest.fullName : guestFirst;
  const message = `${r.number}: ${r.title}${r.variant ? `, ${r.variant.name}` : ""}${r.preferredStart ? ` on ${when(r.preferredStart)}` : ""}${r.partySize ? ` for ${r.partySize}` : ""}. Ask for ${guestName} ${room && r.roomNumber ? `in room ${r.roomNumber}` : "at the front desk"}.${vnote.trim() ? ` ${vnote.trim()}` : ""}`;

  return (
    <Panel data-testid="assign-panel">
      <PanelHeader title="Who's doing it" />
      <div className="flex flex-col gap-4 px-5 py-4">
        <Field label="Someone on the team" htmlFor="assign-staff" hint={r.discreet ? "Only people who can see private requests." : undefined}>
          <Select id="assign-staff" value={r.assignee?.id ?? ""} onChange={(e) => assign.mutate({ id: r.id, assigneeId: e.target.value || null })} data-testid="assign-staff">
            <option value="">Nobody yet</option>
            {r.assignee && !options.some((o) => o.id === r.assignee!.id) && <option value={r.assignee.id}>{r.assignee.fullName}</option>}
            {options.map((s) => (
              <option key={s.id} value={s.id}>
                {s.fullName}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="A vendor" htmlFor="assign-vendor" hint="An outside provider you work with. Guests never see their details.">
          <Select id="assign-vendor" value={r.vendor?.id ?? ""} onChange={(e) => assign.mutate({ id: r.id, vendorId: e.target.value || null })} data-testid="assign-vendor" disabled={blocked}>
            <option value="">In-house</option>
            {activeVendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} &middot; {categoryMeta(v.category).label}
              </option>
            ))}
          </Select>
        </Field>
        {blocked && (
          <p className="-mt-2 flex items-center gap-1.5 text-[12px] text-ochre">
            <WarningCircle size={13} weight="fill" /> Nothing goes to a vendor while a manager looks at it.
          </p>
        )}

        {r.vendor && !blocked && (
          <div className="flex flex-col gap-3 rounded-md border border-line bg-surface-2/40 p-3" data-testid="vendor-job">
            <div className="flex items-center gap-2">
              <Handshake size={16} weight="duotone" className="text-ink-muted" />
              <p className="text-[13px] font-medium text-ink">Send {r.vendor.name} the job</p>
              {r.vendorSentAt && <span className="ml-auto text-[11.5px] text-palm">sent {relativeTime(r.vendorSentAt)}</span>}
            </div>
            <div className="flex items-center gap-1.5" role="radiogroup" aria-label="Send by">
              {(["WHATSAPP", "SMS"] as const).map((c) => (
                <button key={c} type="button" role="radio" aria-checked={channel === c} onClick={() => setChannel(c)} className={cn("h-7 rounded-sm border px-2.5 text-[12px]", channel === c ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted")}>
                  {c === "WHATSAPP" ? "WhatsApp" : "SMS"}
                </button>
              ))}
              {vendor && <span className="ml-auto font-mono text-[11px] text-ink-faint">{formatPhone(channel === "WHATSAPP" ? (vendor.whatsapp ?? vendor.phone) : vendor.phone)}</span>}
            </div>
            <Textarea className="min-h-12 text-[13px]" placeholder="Anything they should know (optional)" value={vnote} maxLength={300} onChange={(e) => setVnote(e.target.value)} aria-label="Note for the vendor" />
            <p className="whitespace-pre-line rounded-sm border border-line bg-surface px-3 py-2 text-[12.5px] leading-relaxed text-ink" data-testid="vendor-message">
              {message}
            </p>
            <div className="flex flex-col gap-2">
              <Switch checked={surname && allowSurname} disabled={!allowSurname} onChange={setSurname} label={<span className="text-[12.5px]">Include the surname</span>} description={allowSurname ? undefined : "Off in your concierge settings."} />
              <Switch checked={room && allowRoom} disabled={!allowRoom} onChange={setRoom} label={<span className="text-[12.5px]">Include the room number</span>} description={allowRoom ? undefined : "Off in your concierge settings."} />
            </div>
            <p className="flex flex-wrap gap-1.5 text-[11px]">
              <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_oklab,var(--palm)_35%,transparent)] px-2 py-0.5 text-palm">
                <Lock size={11} /> Never the guest&rsquo;s phone
              </span>
              {r.discreet && (
                <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_oklab,var(--brass)_40%,transparent)] px-2 py-0.5 text-brass">
                  <SealGlyph size={11} /> Private request
                </span>
              )}
            </p>
            <Button size="sm" onClick={() => send.mutate()} loading={send.isPending} data-testid="send-to-vendor">
              <PaperPlaneTilt size={14} /> {r.vendorSentAt ? "Send again" : `Send by ${channel === "WHATSAPP" ? "WhatsApp" : "SMS"}`}
            </Button>
          </div>
        )}
      </div>
    </Panel>
  );
}

function FolioCard({ r }: { r: RequestDetail }) {
  return (
    <Panel data-testid="folio-card">
      <PanelHeader title="On the bill" />
      <div className="flex flex-col gap-2 px-5 py-4">
        <p className="flex items-baseline justify-between gap-3 text-[14px] text-ink">
          <span className="truncate" data-testid="folio-line">
            {r.payment.folioDescription}
          </span>
          <span className="font-mono">{naira(r.quote?.totalKobo ?? r.price?.totalKobo ?? r.totalKobo)}</span>
        </p>
        <p className="text-[12px] text-ink-muted">
          {r.payment.status === "PAID" ? "Paid online" : "Posted"} {relativeTime(r.payment.postedAt ?? r.payment.paidAt)}
          {r.discreet ? ", with neutral wording" : ""}.
        </p>
        {r.commission && r.commission.commissionKobo != null && (
          <p className="flex items-baseline justify-between text-[12.5px] text-ink-muted">
            <span>Commission (yours)</span>
            <span className="font-mono text-ink">{naira(r.commission.commissionKobo)}</span>
          </p>
        )}
        {r.commission && r.commission.vendorPayableKobo != null && (
          <p className="flex items-baseline justify-between text-[12.5px] text-ink-muted">
            <span>Owed to {r.vendor?.name ?? "the vendor"}</span>
            <span className="font-mono text-ink">{naira(r.commission.vendorPayableKobo)}</span>
          </p>
        )}
        {r.reservation && (
          <ButtonLink href={`/reservations/${r.reservation.id}`} size="sm" variant="secondary" className="mt-1 self-start">
            <Receipt size={14} /> Open the stay&rsquo;s folio
          </ButtonLink>
        )}
      </div>
    </Panel>
  );
}

function RateVendor({ r }: { r: RequestDetail }) {
  const qc = useQueryClient();
  const [score, setScore] = useState(r.vendorRating ?? 0);
  const m = useMutation({
    mutationFn: (n: number) => conciergeApi.rateVendor(r.id, n),
    onSuccess: async (x, n) => {
      qc.setQueryData(qk8.request(r.id), x);
      await qc.invalidateQueries({ queryKey: qk8.vendors });
      toast.success("Thanks", `${r.vendor?.name} rated ${n} of 5.`);
    },
    meta: { errorTitle: "Rating not saved" },
  });
  useEffect(() => {
    if (window.location.hash === "#rate") document.getElementById("rate")?.scrollIntoView({ block: "center" });
  }, []);
  return (
    <Panel id="rate" className="scroll-mt-24" data-testid="rate-vendor">
      <PanelHeader title={`How was ${r.vendor!.name}?`} description="For your team only. It helps choose who to call next time." />
      <div className="px-5 py-4">
        <StarInput
          value={score}
          onChange={(n) => {
            setScore(n);
            m.mutate(n);
          }}
          label={`Rate ${r.vendor!.name}`}
        />
      </div>
    </Panel>
  );
}
