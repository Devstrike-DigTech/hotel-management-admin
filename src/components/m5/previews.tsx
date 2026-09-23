"use client";

/* Locked-feature previews for lower plans, built from the real components with sample data. */

import { MenuBoard } from "@/components/pos/menu-board";
import { TicketRail } from "@/components/pos/ticket-rail";
import { KdsBoard } from "@/components/pos/kds-board";
import { SAMPLE_KDS, SAMPLE_MENU, SAMPLE_TICKET } from "@/components/pos/fixtures";
import { MessageStream, ThreadList } from "@/components/inbox/parts";
import type { InboxMessage, InboxThread } from "@/components/inbox/model";
import { MemberCard, TierLadder } from "@/components/loyalty/parts";
import { MappingGrid, OtaCostBars } from "@/components/channels/parts";
import { DnsRecords } from "@/components/domain/parts";
import { cn } from "@/lib/cn";
import { ArrowDownRight, ArrowUpRight } from "@phosphor-icons/react";
import { useNow } from "@/lib/use-now";

const noop = () => undefined;
const ago = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

export function PosTerminalPreview() {
  return (
    <div className="flex h-[440px] overflow-hidden rounded-md border border-line bg-paper">
      <div className="flex min-w-0 flex-1">
        <MenuBoard menu={SAMPLE_MENU} counts={{ "i-jollof": 2, "i-suya": 1, "i-chapman": 3, "i-star": 2 }} onPick={noop} onOptions={noop} />
      </div>
      <TicketRail className="hidden w-[300px] shrink-0 border-l border-line md:flex" ticket={SAMPLE_TICKET} open={[SAMPLE_TICKET, { ...SAMPLE_TICKET, key: "t2", label: "4", lines: [] }, { ...SAMPLE_TICKET, key: "t3", kind: "ROOM", label: "204", lines: [] }]} onSelect={noop} onNew={noop} onQty={noop} onRemove={noop} onNote={noop} onVoid={noop} onSend={noop} onSplit={noop} onSettle={noop} />
    </div>
  );
}

export function KdsPreview() {
  const now = useNow(30_000);
  return (
    <div className="theme-dark flex h-[420px] rounded-md bg-paper p-3">
      <KdsBoard tickets={SAMPLE_KDS} now={now} onAdvance={noop} />
    </div>
  );
}

const THREADS: InboxThread[] = [
  { id: "a", guestName: "Adaeze Okafor", phone: "+2348031234501", channel: "WHATSAPP", status: "OPEN", unread: 1, loyaltyTier: "Silver", lastMessage: { body: "Please can we get two extra towels and more toiletries?", direction: "IN", at: ago(4) }, windowExpiresAt: new Date(Date.now() + 23.9 * 3600_000).toISOString(), assignee: null, reservation: { id: "r", code: "PWH-7K3Q", status: "CHECKED_IN", roomNumber: "204", arrivalAt: ago(1500), departureAt: ago(-2000) }, waitingSince: ago(4) },
  { id: "b", guestName: "Emeka Nwankwo", phone: "+2348059876543", channel: "WHATSAPP", status: "OPEN", unread: 0, lastMessage: { body: "Glad to hear it. Enjoy the rest of your evening.", direction: "OUT", at: ago(46) }, windowExpiresAt: new Date(Date.now() + 22 * 3600_000).toISOString(), assignee: { id: "t", fullName: "Tunde Bakare" }, reservation: { id: "r2", code: "PWH-2M8D", status: "CHECKED_IN", roomNumber: "311", arrivalAt: ago(3000), departureAt: ago(-1400) } },
  { id: "c", guestName: "Olumide Balogun", phone: "+2348091112233", channel: "WHATSAPP", status: "OPEN", unread: 0, lastMessage: { body: "Yes, a Deluxe King is ₦85,000 a night for Friday and Saturday.", direction: "OUT", at: ago(2400) }, windowExpiresAt: null, assignee: null, reservation: null },
];
const MESSAGES: InboxMessage[] = [
  { id: "1", direction: "OUT", kind: "AUTOMATION", body: "Welcome to The Harbour House, Adaeze. You are in room 204. Reply to this message with any request and our team will help.", at: ago(300), status: "READ" },
  { id: "2", direction: "IN", kind: "TEXT", body: "Good evening. Please can we get two extra towels and more toiletries in the room?", at: ago(4), detected: { kind: "HOUSEKEEPING", keyword: "towels" } },
];

export function InboxPreview() {
  const now = useNow(30_000);
  return (
    <div className="flex h-[400px] overflow-hidden rounded-md border border-line bg-surface">
      <div className="hidden w-[280px] shrink-0 border-r border-line sm:block">
        <ThreadList threads={THREADS} activeId="a" onOpen={noop} now={now} />
      </div>
      <div className="min-w-0 flex-1 bg-paper/60">
        <MessageStream messages={MESSAGES} />
      </div>
    </div>
  );
}

export function LoyaltyPreview() {
  return (
    <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
      <MemberCard m={{ id: "m", number: "HHC-000118", guestName: "Adaeze Okafor", tierName: "Silver", tierIndex: 1, points: 8450, pointsValueKobo: 845_000, nights12m: 14, nextTier: { name: "Gold", minNights: 25 }, programmeName: "Harbour Circle" }} />
      <div className="rounded-md border border-line bg-surface p-5">
        <TierLadder
          tiers={[
            { id: "a", name: "Member", minNights: 0, bonusPct: 0, perks: [], members: 212 },
            { id: "b", name: "Silver", minNights: 10, bonusPct: 10, perks: [], members: 64 },
            { id: "c", name: "Gold", minNights: 25, bonusPct: 25, perks: [], members: 17 },
          ]}
        />
      </div>
    </div>
  );
}

export function ChannelPreview() {
  const rows = [
    { roomTypeId: "a", roomTypeName: "Standard Queen", rooms: 10 },
    { roomTypeId: "b", roomTypeName: "Deluxe King", rooms: 10 },
    { roomTypeId: "c", roomTypeName: "Palm Suite", rooms: 4 },
  ];
  const cols = [
    { connectionId: "x", channel: "BOOKING_COM", name: "Booking.com", remote: [] },
    { connectionId: "y", channel: "EXPEDIA", name: "Expedia", remote: [] },
    { connectionId: "z", channel: "AIRBNB", name: "Airbnb (iCal)", remote: [] },
  ];
  const cells = {
    a: { x: { remoteId: "4410023", remoteName: "Standard Double" }, y: { remoteId: "EX-221", remoteName: "Standard Room" }, z: { remoteId: "ical", remoteName: "Whole calendar" } },
    b: { x: { remoteId: "4410024", remoteName: "Deluxe King Room" }, y: null, z: { remoteId: "ical", remoteName: "Whole calendar" } },
    c: { x: null, y: null, z: null },
  };
  return (
    <div className="flex flex-col gap-6">
      <div className="overflow-hidden rounded-md border border-line bg-surface">
        <MappingGrid rows={rows} cols={cols} cells={cells} onEdit={noop} editable={false} />
      </div>
      <OtaCostBars
        rows={[
          { channel: "BOOKING_COM", name: "Booking.com", bookings: 11, roomNights: 26, revenueKobo: 214_500_000, commissionKobo: 32_175_000, commissionPct: 15 },
          { channel: "EXPEDIA", name: "Expedia", bookings: 4, roomNights: 9, revenueKobo: 78_000_000, commissionKobo: 14_040_000, commissionPct: 18 },
          { channel: "AIRBNB", name: "Airbnb", bookings: 3, roomNights: 7, revenueKobo: 49_000_000, commissionKobo: 1_470_000, commissionPct: 3 },
        ]}
        directSavingsKobo={44_715_000}
      />
    </div>
  );
}

export function PricingPreview() {
  const days = ["Thu 1", "Fri 2", "Sat 3", "Sun 4", "Mon 5", "Tue 6", "Wed 7"];
  const types = [
    { name: "Standard Queen", base: [45, 45, 45, 45, 45, 45, 45], ghost: [52, 58, 61, null, null, 42, null] },
    { name: "Deluxe King", base: [65, 65, 65, 65, 65, 65, 65], ghost: [75, 82, 86, 70, null, null, 60] },
    { name: "Palm Suite", base: [120, 120, 120, 120, 120, 120, 120], ghost: [138, 150, 150, null, null, null, null] },
  ];
  return (
    <div className="overflow-x-auto rounded-md border border-line bg-surface">
      <table className="w-full min-w-[560px] text-[12px]">
        <thead>
          <tr className="border-b border-line">
            <th className="w-[140px] px-3 py-2 text-left font-normal text-ink-muted">Night of</th>
            {days.map((d, i) => (
              <th key={d} className={cn("px-2 py-2 text-right font-mono font-normal", i === 0 || i === 1 || i === 2 ? "text-laterite" : "text-ink-muted")}>
                {d}
              </th>
            ))}
          </tr>
          <tr className="border-b border-line">
            <td className="px-3 py-1 text-[10.5px] text-ink-faint">Events</td>
            <td colSpan={4} className="px-2 py-1">
              <span className="inline-flex h-5 w-full items-center rounded-[3px] border border-[color-mix(in_oklab,var(--brass)_55%,transparent)] bg-brass-wash px-2 text-[10.5px] font-medium text-ink">Independence Day weekend +18%</span>
            </td>
            <td colSpan={3} />
          </tr>
        </thead>
        <tbody>
          {types.map((t) => (
            <tr key={t.name} className="border-b border-line last:border-b-0">
              <td className="px-3 py-2.5 font-medium text-ink">{t.name}</td>
              {t.base.map((b, i) => {
                const g = t.ghost[i];
                return (
                  <td key={i} className="px-2 py-1.5 text-right align-top">
                    <span className="block font-mono text-ink-muted">{b},000</span>
                    {g != null && (
                      <span className={cn("mt-0.5 inline-flex items-center rounded-[3px] border border-dashed px-1 font-mono text-[10.5px]", g > b ? "border-[color-mix(in_oklab,var(--palm)_60%,transparent)] bg-palm-wash/70 text-palm" : "border-[color-mix(in_oklab,var(--ochre)_60%,transparent)] bg-ochre-wash/70 text-ochre")}>
                        {g > b ? <ArrowUpRight size={10} weight="bold" /> : <ArrowDownRight size={10} weight="bold" />} {g},000
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line px-3 py-2 text-[11.5px] text-ink-muted">&ldquo;86% booked 9 days out, 20 points ahead of usual pace; Independence Day weekend: +18%&rdquo;</p>
    </div>
  );
}

export function DomainPreview() {
  return (
    <DnsRecords
      records={[
        { type: "TXT", name: "_hotelos-verify.book.yourhotel.com", host: "_hotelos-verify.book", value: "hotelos-verify=4f2a9c71e0b84d3aa6c1", purpose: "Proves the domain is yours", state: "OK" },
        { type: "CNAME", name: "book.yourhotel.com", host: "book", value: "sites.hotelos.ng", purpose: "Sends visitors to your booking site", state: "PENDING" },
      ]}
    />
  );
}

export function GroupPreview() {
  const rows = [
    ["Harbour House Lekki", 71, 74000, 52.5],
    ["Harbour House Ikoyi", 63, 128000, 80.6],
    ["Harbour House Abuja", 58, 91000, 52.8],
  ] as const;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {rows.map(([n, occ, adr, revpar]) => (
        <div key={n} className="rounded-md border border-line bg-surface p-4">
          <p className="display-sm truncate text-[15px] text-ink">{n}</p>
          <p className="mt-3 font-mono text-[26px] leading-none text-ink">{occ}%</p>
          <p className="mt-1 text-[11.5px] text-ink-muted">occupancy</p>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-adire" style={{ width: `${occ}%` }} />
          </div>
          <p className="mt-3 flex justify-between font-mono text-[11.5px] text-ink-muted">
            <span>ADR ₦{adr.toLocaleString("en-NG")}</span>
            <span>RevPAR ₦{revpar}k</span>
          </p>
        </div>
      ))}
    </div>
  );
}
