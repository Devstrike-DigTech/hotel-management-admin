"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChatCircleText, EnvelopeSimple, WhatsappLogo, WarningOctagon, CheckCircle, Clock, ArrowSquareOut, Tray } from "@phosphor-icons/react";
import { notificationsApi } from "@/lib/api/endpoints-m3";
import { qk3, useReservationNotifications } from "@/lib/api/hooks-m3";
import type { NotificationChannel, NotificationLogItem, NotificationStatus } from "@/lib/api/types-m3";
import { formatDateTime, relativeTime } from "@/lib/format";
import { useCan } from "@/lib/permissions";
import { cn } from "@/lib/cn";
import { Sheet } from "@/components/ui/overlay";
import { Panel, PanelHeader, Skeleton, ErrorState } from "@/components/ui/primitives";
import { EmailFrame } from "./email-frame";

const CHANNEL: Record<NotificationChannel, { label: string; icon: React.ElementType }> = {
  EMAIL: { label: "Email", icon: EnvelopeSimple },
  SMS: { label: "SMS", icon: ChatCircleText },
  WHATSAPP: { label: "WhatsApp", icon: WhatsappLogo },
};

const STATUS: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  QUEUED: { label: "Queued", color: "var(--ink-muted)", icon: Clock },
  SENT: { label: "Sent", color: "var(--palm)", icon: CheckCircle },
  OUTBOX: { label: "Dev outbox", color: "var(--adire)", icon: Tray },
  FAILED: { label: "Failed", color: "var(--danger)", icon: WarningOctagon },
};
const statusMeta = (s: NotificationStatus | string) => STATUS[s] ?? STATUS.QUEUED;

/** Human names for the M3 templates. Unknown keys fall back to a tidy version of the key. */
const TEMPLATES: Record<string, string> = {
  BOOKING_CONFIRMED: "Booking confirmed",
  PAYMENT_RECEIPT: "Payment receipt",
  PAY_AT_HOTEL_CONFIRMED: "Confirmed, pay at hotel",
  HOLD_EXPIRED: "Hold expired",
  BOOKING_CANCELLED: "Cancelled, with any refund",
  PRE_ARRIVAL: "The day before arrival",
  REVIEW_REQUEST: "Review request",
  PAYMENT_ORPHANED_REFUND: "Late payment refunded",
  OTP: "Sign-in code",
  MAGIC_LINK: "Sign-in link",
  HOTEL_NEW_BOOKING: "New online booking",
  HOTEL_BOOKING_CANCELLED: "Guest cancelled",
  ORPHANED_PAYMENT_ALERT: "Orphaned payment alert",
};
export const templateName = (t: string) =>
  TEMPLATES[t] ?? TEMPLATES[t.toUpperCase().replace(/[.\s-]+/g, "_")] ?? t.replace(/[._-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());

/** What the guest was sent about this booking: a timeline, newest first. */
export function NotificationLog({ reservationId }: { reservationId: string }) {
  const q = useReservationNotifications(reservationId);
  const { can } = useCan();
  const [open, setOpen] = useState<NotificationLogItem | null>(null);
  // the API returns oldest first; the timeline reads newest first
  const items = [...(q.data ?? [])].reverse();

  return (
    <Panel>
      <PanelHeader
        eyebrow="Messages"
        title="What the guest was sent"
        description={items.length ? `${items.length} ${items.length === 1 ? "message" : "messages"}, newest first` : undefined}
      />
      {q.isError ? (
        <ErrorState error={q.error} onRetry={() => q.refetch()} className="py-8" />
      ) : q.isLoading ? (
        <div className="flex flex-col gap-3 p-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : items.length === 0 ? (
        <p className="px-5 py-5 text-[13px] text-ink-muted">Nothing sent yet. Online bookings get a confirmation, a receipt, a note the day before arrival and a review request after check-out.</p>
      ) : (
        <ol className="relative px-5 py-4" data-testid="notification-log">
          <span aria-hidden className="absolute bottom-6 left-[33px] top-6 w-px bg-line" />
          {items.map((n) => {
            const C = CHANNEL[n.channel] ?? CHANNEL.EMAIL;
            const s = statusMeta(n.status);
            const SI = s.icon;
            const toHotel = n.audience !== "GUEST";
            return (
              <li key={n.id} className="relative flex gap-3 py-2">
                <span className="relative z-[1] grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line bg-surface text-ink-muted">
                  <C.icon size={14} weight="duotone" />
                </span>
                <button
                  type="button"
                  onClick={() => setOpen(n)}
                  className="group min-w-0 flex-1 rounded-sm text-left"
                  aria-label={`${templateName(n.template)} by ${C.label}, ${s.label}. Open preview`}
                >
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[13.5px] font-medium text-ink group-hover:underline group-hover:underline-offset-4">{templateName(n.template)}</span>
                    <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-ink-faint">
                      {C.label}
                      {toHotel ? " · to the hotel" : ""}
                    </span>
                  </span>
                  <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[12px] text-ink-muted">
                    <span className="inline-flex items-center gap-1" style={{ color: s.color }}>
                      <SI size={12} weight="fill" aria-hidden />
                      {s.label}
                    </span>
                    <span className="text-ink-faint">&middot;</span>
                    <span className="truncate font-mono text-[11.5px]">{n.recipientMasked}</span>
                    <span className="text-ink-faint">&middot;</span>
                    <time dateTime={n.createdAt} title={formatDateTime(n.createdAt)}>
                      {relativeTime(n.createdAt)}
                    </time>
                  </span>
                  {n.preview && <span className="mt-1 line-clamp-1 block text-[12px] text-ink-faint">{n.preview}</span>}
                  {n.status === "FAILED" && n.error && <span className="mt-1 block text-[12px] text-danger">{n.error}</span>}
                </button>
              </li>
            );
          })}
        </ol>
      )}
      <MessagePreview item={open} full={can("notifications.preview")} onClose={() => setOpen(null)} />
    </Panel>
  );
}

function MessagePreview({ item, full, onClose }: { item: NotificationLogItem | null; full: boolean; onClose: () => void }) {
  const detail = useQuery({
    queryKey: qk3.notificationPreview(item?.id ?? ""),
    queryFn: () => notificationsApi.preview(item!.id),
    enabled: !!item && full,
    staleTime: 5 * 60_000,
  });
  const n = item;
  const C = n ? (CHANNEL[n.channel] ?? CHANNEL.EMAIL) : CHANNEL.EMAIL;
  const s = n ? statusMeta(n.status) : STATUS.QUEUED;
  const html = detail.data?.html ?? null;
  const text = detail.data?.text ?? n?.preview ?? null;
  return (
    <Sheet
      open={!!item}
      onOpenChange={(o) => !o && onClose()}
      width="max-w-2xl"
      eyebrow={n ? `${C.label} · ${s.label}` : undefined}
      title={n ? templateName(n.template) : ""}
      description={n ? `To ${n.recipientMasked}, ${formatDateTime(n.sentAt ?? n.createdAt)}` : undefined}
    >
      {n && (
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[12.5px]">
            {(detail.data?.subject ?? n.subject) && (
              <>
                <dt className="text-ink-muted">Subject</dt>
                <dd className="text-ink">{detail.data?.subject ?? n.subject}</dd>
              </>
            )}
            <dt className="text-ink-muted">Status</dt>
            <dd style={{ color: s.color }}>
              {s.label}
              {n.attempts > 1 ? <span className="text-ink-muted"> after {n.attempts} tries</span> : null}
            </dd>
            {n.provider && (
              <>
                <dt className="text-ink-muted">Provider</dt>
                <dd className="font-mono text-ink">
                  {n.provider}
                  {n.providerMessageId ? <span className="text-ink-faint"> {n.providerMessageId}</span> : null}
                </dd>
              </>
            )}
            {n.error && (
              <>
                <dt className="text-ink-muted">Error</dt>
                <dd className="text-danger">{n.error}</dd>
              </>
            )}
          </dl>
          {!full && <p className="text-[12.5px] text-ink-muted">Only the first lines are shown to your role.</p>}
          {n.channel === "EMAIL" ? (
            detail.isLoading ? (
              <Skeleton className="h-[480px] w-full" />
            ) : html ? (
              <div className="overflow-hidden rounded-md border border-line">
                <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-3 py-2 text-[11.5px] text-ink-muted">
                  <span className="flex gap-1" aria-hidden>
                    <span className="h-2 w-2 rounded-full bg-line-strong" />
                    <span className="h-2 w-2 rounded-full bg-line-strong" />
                    <span className="h-2 w-2 rounded-full bg-line-strong" />
                  </span>
                  <span className="truncate">Sandboxed preview. Scripts and forms are off; links open in a new tab.</span>
                  <ArrowSquareOut size={12} className="ml-auto shrink-0" aria-hidden />
                </div>
                <EmailFrame html={html} title={`Email preview: ${n.subject ?? templateName(n.template)}`} />
              </div>
            ) : (
              <PlainBody text={text} />
            )
          ) : detail.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <PhoneBubble channel={n.channel} text={text} />
          )}
        </div>
      )}
    </Sheet>
  );
}

function PlainBody({ text }: { text: string | null }) {
  return <pre className="whitespace-pre-wrap rounded-md border border-line bg-surface-2/40 p-4 font-sans text-[13.5px] leading-relaxed text-ink">{text || "No body stored."}</pre>;
}

/** SMS and WhatsApp as the guest's phone shows them. */
function PhoneBubble({ channel, text }: { channel: NotificationChannel; text: string | null }) {
  const len = text?.length ?? 0;
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-line bg-surface-2/50 p-5">
      <div
        className={cn(
          "max-w-[34ch] whitespace-pre-wrap rounded-lg rounded-bl-xs px-3.5 py-2.5 text-[13.5px] leading-snug shadow-[0_1px_0_var(--line-strong)]",
          channel === "WHATSAPP" ? "bg-palm-wash text-ink" : "bg-surface text-ink",
        )}
      >
        {text || "No body stored."}
      </div>
      {channel === "SMS" && (
        <p className={cn("font-mono text-[11px]", len > 160 ? "text-ochre" : "text-ink-faint")}>
          {len} characters, {Math.max(1, Math.ceil(len / 153))} {len > 160 ? "parts" : "part"}
        </p>
      )}
    </div>
  );
}
