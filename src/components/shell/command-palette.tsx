"use client";

import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bed,
  Desktop,
  LockSimple,
  MagnifyingGlass,
  Moon,
  Plus,
  Rows,
  SignOut,
  Sun,
  UserPlus,
  ArrowCircleUp,
} from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { allNavItems, navVisible } from "@/lib/nav";
import { useEntitlements, useLogout } from "@/lib/auth";
import { hotelApi } from "@/lib/api/endpoints";
import { qk } from "@/lib/api/hooks";
import { useRoomStatus } from "@/lib/api/mutations";
import { ROOM_STATUS, ROOM_STATUS_ORDER } from "@/lib/catalog";
import { paletteStore, useStore } from "@/lib/store";
import { setThemePref } from "./theme-toggle";
import { BookBookmark, BookOpenText, CalendarPlus, ChartBar, Coins, Door, Money, ShieldWarning, SignIn } from "@phosphor-icons/react";
import { Bank, CalendarX, ChatsTeardrop, Globe, GlobeHemisphereWest, Storefront } from "@phosphor-icons/react";
import { Bell, BellRinging, CalendarDots, DeviceMobile, DownloadSimple, GasPump, Package, Scales, SealCheck, ShieldCheck, Tag, Ticket, Wrench } from "@phosphor-icons/react";
import { useCan } from "@/lib/permissions";
import { useReservations } from "@/lib/api/hooks-m2";
import { openNewReservation, openPayment } from "@/lib/store-m2";
import { STAY_STATUS } from "@/lib/catalog-m2";
import { naira } from "@/lib/format";
import { StatusSwatch } from "@/components/keyrack/status-swatch";
import { CashRegister, ChartLineUp, ChatCircleText, CookingPot, Crown, ForkKnife, Plugs, TreeStructure, Truck, Wine } from "@phosphor-icons/react";
import { usePropertyScope, useSwitchProperty } from "./property-switcher";

const itemCls =
  "group flex h-10 cursor-pointer items-center gap-3 rounded-md px-3 text-[14px] text-ink outline-none data-[selected=true]:bg-surface-2 data-[disabled=true]:opacity-50";
const groupCls =
  "[&_[cmdk-group-heading]]:eyebrow [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[10px]";

/** Cmd/Ctrl+K: jump anywhere, run actions, and change room status by typing "204 dirty". */
export function CommandPalette() {
  const open = useStore(paletteStore);
  const setOpen = (v: boolean) => paletteStore.set(v);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const logout = useLogout();
  const { has } = useEntitlements();
  const { can } = useCan();
  const setStatus = useRoomStatus();
  const scope = usePropertyScope();
  const props = scope.props;
  const switchTo = useSwitchProperty();

  const rooms = useQuery({ queryKey: qk.rooms({}), queryFn: () => hotelApi.rooms({}), enabled: open });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        paletteStore.set(!paletteStore.get());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const term = search
    .replace(/^\s*(check\s*in|check\s*out|take\s*payment|pay|open)\s*/i, "")
    .trim();
  const resQ = useReservations(
    { q: term, pageSize: 5, status: "PENDING,CONFIRMED,CHECKED_IN" },
    open && term.length >= 3 && /[a-z]/i.test(term) && can("reservations.read"),
  );
  const stays = term.length >= 3 ? (resQ.data?.items ?? []) : [];
  const digits = /^\d+(\s|$)/.test(search.trim()) ? (search.match(/\d+/)?.[0] ?? "") : "";
  const matchedRooms = useMemo(() => {
    if (!digits || !rooms.data) return [];
    return rooms.data.filter((r) => r.number.includes(digits)).slice(0, 4);
  }, [digits, rooms.data]);

  const run = (fn: () => void) => {
    setOpen(false);
    setSearch("");
    fn();
  };

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setSearch("");
      }}
      label="Command palette"
      loop
      overlayClassName="fixed inset-0 z-[75] bg-[color-mix(in_oklab,var(--ink)_24%,transparent)] dark:bg-[rgb(0_0_0/0.55)] animate-[fade_150ms_ease-out]"
      contentClassName="fixed left-1/2 top-[12vh] z-[76] w-[calc(100vw-24px)] max-w-[600px] -translate-x-1/2 overflow-hidden rounded-lg border border-line bg-surface shadow-float animate-[dialog-in_200ms_cubic-bezier(0.22,1,0.36,1)]"
    >
      <div className="flex items-center gap-3 border-b border-line px-4">
        <MagnifyingGlass size={18} className="text-ink-muted" />
        <Command.Input
          value={search}
          onValueChange={setSearch}
          placeholder="Jump to, a booking code, or &ldquo;204 dirty&rdquo;"
          className="h-14 flex-1 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-faint"
        />
        <span className="kbd">esc</span>
      </div>
      <Command.List className="scrollbar-thin max-h-[min(60vh,440px)] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-10 text-center text-[13.5px] text-ink-muted">
          Nothing matches. Try a page name or a room number.
        </Command.Empty>

        {matchedRooms.length > 0 && (
          <Command.Group heading="Rooms" className={groupCls}>
            {matchedRooms.flatMap((room) =>
              ROOM_STATUS_ORDER.filter((s) => s !== room.status).map((s) => (
                <Command.Item
                  key={`${room.id}-${s}`}
                  value={`mark room ${room.number} ${ROOM_STATUS[s].label} ${s.replace(/_/g, " ")} ${ROOM_STATUS[s].short}`}
                  onSelect={() => run(() => setStatus.mutate({ id: room.id, status: s, number: room.number }))}
                  className={itemCls}
                >
                  <StatusSwatch status={s} size={16} />
                  <span>
                    Mark room <span className="font-mono">{room.number}</span>{" "}
                    <span className="text-ink-muted">{ROOM_STATUS[s].label.toLowerCase()}</span>
                  </span>
                  <span className="ml-auto text-[12px] text-ink-faint">
                    now {ROOM_STATUS[room.status].label.toLowerCase()}
                  </span>
                </Command.Item>
              )),
            )}
          </Command.Group>
        )}

        {stays.length > 0 && (
          <Command.Group heading="Reservations" className={groupCls}>
            {stays.flatMap((r) => {
              const base = `${r.code} ${r.guest.fullName} ${r.room?.number ?? ""} ${term}`;
              const out: React.ReactNode[] = [];
              if (["PENDING", "CONFIRMED"].includes(r.status) && can("frontdesk.act"))
                out.push(
                  <Command.Item key={`${r.id}-in`} value={`check in ${base}`} onSelect={() => run(() => router.push(`/reservations/${r.id}/check-in`))} className={itemCls}>
                    <SignIn size={17} weight="duotone" className="text-ink-muted group-data-[selected=true]:text-laterite" />
                    <span>
                      Check in <span className="font-mono">{r.code}</span> <span className="text-ink-muted">{r.guest.fullName}</span>
                    </span>
                    <span className="ml-auto text-[12px] text-ink-faint">{r.room ? `room ${r.room.number}` : r.roomType.name}</span>
                  </Command.Item>,
                );
              if (r.status === "CHECKED_IN" && can("frontdesk.act")) {
                out.push(
                  <Command.Item
                    key={`${r.id}-pay`}
                    value={`take payment pay ${base}`}
                    onSelect={() => run(() => openPayment({ folioId: r.folioId, label: r.guest.fullName, balanceKobo: r.balanceKobo, reservationCode: r.code }))}
                    className={itemCls}
                  >
                    <Money size={17} weight="duotone" className="text-ink-muted group-data-[selected=true]:text-laterite" />
                    <span>
                      Take payment from <span className="text-ink-muted">{r.guest.fullName}</span>
                    </span>
                    <span className="ml-auto font-mono text-[12px] text-ink-faint">{r.balanceKobo > 0 ? `owes ${naira(r.balanceKobo)}` : r.code}</span>
                  </Command.Item>,
                );
                out.push(
                  <Command.Item key={`${r.id}-out`} value={`check out ${base}`} onSelect={() => run(() => router.push(`/reservations/${r.id}?checkout=1`))} className={itemCls}>
                    <Door size={17} weight="duotone" className="text-ink-muted group-data-[selected=true]:text-laterite" />
                    <span>
                      Check out <span className="font-mono">{r.code}</span> <span className="text-ink-muted">{r.guest.fullName}</span>
                    </span>
                  </Command.Item>,
                );
              }
              out.push(
                <Command.Item key={`${r.id}-open`} value={`open reservation ${base}`} onSelect={() => run(() => router.push(`/reservations/${r.id}`))} className={itemCls}>
                  <BookBookmark size={17} weight="duotone" className="text-ink-muted group-data-[selected=true]:text-laterite" />
                  <span>
                    Open <span className="font-mono">{r.code}</span> <span className="text-ink-muted">{r.guest.fullName}</span>
                  </span>
                  <span className="ml-auto text-[12px] text-ink-faint">{STAY_STATUS[r.status].label}</span>
                </Command.Item>,
              );
              return out;
            })}
          </Command.Group>
        )}

        <Command.Group heading="Front desk" className={groupCls}>
          {can("reservations.write") && (
            <Action icon={<CalendarPlus size={17} weight="duotone" />} label="New reservation" hint="walk-in or phone" keywords="book booking walk in create stay" onSelect={() => run(() => openNewReservation({}))} />
          )}
          {can("frontdesk.act") && (
            <Action icon={<SignIn size={17} weight="duotone" />} label="Check in a guest" hint="type a code or name" keywords="arrival register card" onSelect={() => setSearch("check in ")} />
          )}
          {can("frontdesk.act") && (
            <Action icon={<Money size={17} weight="duotone" />} label="Take payment" hint="type a guest or code" keywords="cash pos transfer receipt folio" onSelect={() => setSearch("pay ")} />
          )}
          {can("shift.own") && (
            <Action icon={<Coins size={17} weight="duotone" />} label="Close my shift" hint="blind count" keywords="cashier till count end shift variance" onSelect={() => run(() => router.push("/shifts"))} />
          )}
          {can("shift.own") && <Action icon={<Coins size={17} weight="duotone" />} label="Open my shift" keywords="cashier till float start" onSelect={() => run(() => router.push("/shifts"))} />}
          {can("guard.read") && <Action icon={<ShieldWarning size={17} weight="duotone" />} label="Review Revenue Guard flags" keywords="fraud leakage alerts" onSelect={() => run(() => router.push("/guard"))} />}
          {can("reports.read") && <Action icon={<ChartBar size={17} weight="duotone" />} label="Today's flash report" keywords="occupancy adr revpar revenue" onSelect={() => run(() => router.push("/reports"))} />}
          {can("guest.write") && <Action icon={<BookOpenText size={17} weight="duotone" />} label="Download the guest register" keywords="police csv export" onSelect={() => run(() => router.push("/register"))} />}
        </Command.Group>

        {(can("reservations.read") || can("reviews.read") || can("payouts.read")) && (
          <Command.Group heading="Online" className={groupCls}>
            {can("reservations.read") && (
              <Action icon={<Storefront size={17} weight="duotone" />} label="Marketplace bookings" hint="commission applies" keywords="online reservations source channel marketplace" onSelect={() => run(() => router.push("/reservations?source=MARKETPLACE&view=all"))} />
            )}
            {can("reservations.read") && (
              <Action icon={<Globe size={17} weight="duotone" />} label="Booking site bookings" hint="no commission" keywords="online reservations source channel microsite own website" onSelect={() => run(() => router.push("/reservations?source=BOOKING_SITE&view=all"))} />
            )}
            {can("reviews.reply") && (
              <Action icon={<ChatsTeardrop size={17} weight="duotone" />} label="Reply to reviews" hint="waiting for a reply" keywords="reviews ratings respond feedback" onSelect={() => run(() => router.push("/reviews?replied=false"))} />
            )}
            {can("booking.settings") && (
              <Action icon={<CalendarX size={17} weight="duotone" />} label="Change cancellation policy" keywords="refund free cancellation fee no-show online booking settings" onSelect={() => run(() => router.push("/settings/booking"))} />
            )}
            {can("booking.settings") && (
              <Action icon={<GlobeHemisphereWest size={17} weight="duotone" />} label="Turn online booking on or off" keywords="pay at hotel booking site marketplace settings" onSelect={() => run(() => router.push("/settings/booking"))} />
            )}
            {can("payouts.manage") && (
              <Action icon={<Bank size={17} weight="duotone" />} label="Set up or change the payout account" keywords="bank paystack subaccount settlement nuban" onSelect={() => run(() => router.push("/payouts"))} />
            )}
            {can("payouts.read") && (
              <Action icon={<Bank size={17} weight="duotone" />} label="Online revenue and commission" keywords="payouts paystack commission deducted net" onSelect={() => run(() => router.push("/payouts"))} />
            )}
          </Command.Group>
        )}

        <Command.Group heading="The house at work" className={groupCls}>
          {can("maintenance.report") && (
            <Action icon={<Wrench size={17} weight="duotone" />} label="Report a fault" hint="opens a ticket" keywords="maintenance broken repair ac leaking generator ticket" onSelect={() => run(() => router.push("/maintenance?new=1"))} />
          )}
          {can("housekeeping.assign") && (
            <Action icon={<Scales size={17} weight="duotone" />} label="Hand out rooms to housekeeping" keywords="assign balance board cleaning" onSelect={() => run(() => router.push("/housekeeping"))} />
          )}
          {can("housekeeping.inspect") && (
            <Action icon={<SealCheck size={17} weight="duotone" />} label="Inspect cleaned rooms" keywords="inspection queue supervisor pass send back" onSelect={() => run(() => router.push("/housekeeping?tab=inspection"))} />
          )}
          {can("housekeeping.work") && <Action icon={<DeviceMobile size={17} weight="duotone" />} label="My rooms" hint="phone view" keywords="housekeeper my tasks clean start finish" onSelect={() => run(() => router.push("/hk"))} />}
          {can("housekeeping.view") && <Action icon={<Package size={17} weight="duotone" />} label="Log a lost item" keywords="lost and found phone charger left behind" onSelect={() => run(() => router.push("/housekeeping?tab=lost"))} />}
          {(can("maintenance.work") || can("maintenance.manage")) && (
            <Action icon={<GasPump size={17} weight="duotone" />} label="Log a diesel delivery" keywords="fuel generator litres supplier" onSelect={() => run(() => router.push("/maintenance?tab=diesel"))} />
          )}
          {can("rates.manage") && <Action icon={<CalendarDots size={17} weight="duotone" />} label="Paint a season" hint="Rate Almanac" keywords="rates weekend detty december price override min stay close arrival" onSelect={() => run(() => router.push("/rates"))} />}
          {can("promotions.manage") && <Action icon={<Ticket size={17} weight="duotone" />} label="New promo code" keywords="discount voucher code offer" onSelect={() => run(() => router.push("/promotions"))} />}
          {can("payments.take") && can("corporate.view") && (
            <Action icon={<Tag size={17} weight="duotone" />} label="Record a company payment" hint="City Ledger" keywords="corporate transfer cheque statement receivable" onSelect={() => run(() => router.push("/city-ledger"))} />
          )}
          {can("corporate.manage") && <Action icon={<Bell size={17} weight="duotone" />} label="Remind a company to pay" keywords="city ledger overdue reminder statement" onSelect={() => run(() => router.push("/city-ledger"))} />}
        </Command.Group>

        {(props.length > 1 || has("pos") || has("whatsapp_messaging") || can("settings.manage")) && (
          <Command.Group heading="Across the group" className={groupCls}>
            {props
              .filter((p) => p.id !== scope.current?.id)
              .map((p) => (
                <Action key={p.id} icon={<TreeStructure size={17} weight="duotone" />} label={`Switch to ${p.name}`} hint={[p.area, p.city].filter(Boolean).join(", ")} keywords="property switch hotel work in change" onSelect={() => run(() => switchTo(p.id, p.name))} />
              ))}
            {props.length > 1 && can("reports.read") && <Action icon={<ChartBar size={17} weight="duotone" />} label="Group reports" hint="all properties" keywords="consolidated compare occupancy adr revpar group" onSelect={() => run(() => router.push("/group"))} />}
            {can("settings.manage") && <Action icon={<TreeStructure size={17} weight="duotone" />} label="Add a property" locked={!has("multi_property")} keywords="new hotel property group second" onSelect={() => run(() => router.push("/properties"))} />}
          </Command.Group>
        )}

        <Command.Group heading="Outlets, guests and channels" className={groupCls}>
          {can("pos.view") && <Action icon={<CashRegister size={17} weight="duotone" />} label="Open the till" locked={!has("pos")} keywords="pos point of sale bar restaurant order table tab" onSelect={() => run(() => router.push("/pos"))} />}
          {can("kds.view") && <Action icon={<CookingPot size={17} weight="duotone" />} label="Kitchen display" locked={!has("pos")} keywords="kds kitchen tickets bump" onSelect={() => run(() => router.push("/kds"))} />}
          {can("pos.manage") && <Action icon={<ForkKnife size={17} weight="duotone" />} label="Mark an item sold out" hint="86" keywords="menu unavailable 86 finished" locked={!has("pos")} onSelect={() => run(() => router.push("/pos/menu"))} />}
          {can("stock.manage") && <Action icon={<Truck size={17} weight="duotone" />} label="Record a stock delivery" locked={!has("pos")} keywords="stock purchase crates beer supplier" onSelect={() => run(() => router.push("/pos/stock"))} />}
          {can("minibar.record") && <Action icon={<Wine size={17} weight="duotone" />} label="Record minibar use" locked={!has("pos")} keywords="minibar consumption charge room" onSelect={() => run(() => router.push("/pos/stock?tab=minibar"))} />}
          {can("inbox.view") && <Action icon={<ChatCircleText size={17} weight="duotone" />} label="Guest inbox" hint="WhatsApp" locked={!has("whatsapp_messaging")} keywords="messages reply whatsapp chat unread" onSelect={() => run(() => router.push("/inbox"))} />}
          {can("pricing.manage") && <Action icon={<ChartLineUp size={17} weight="duotone" />} label="Review pricing suggestions" hint="Rate Almanac" locked={!has("dynamic_pricing")} keywords="dynamic pricing accept suggestion yield" onSelect={() => run(() => router.push("/rates"))} />}
          {can("pricing.manage") && <Action icon={<ChartLineUp size={17} weight="duotone" />} label="Add an event to the pricing calendar" locked={!has("dynamic_pricing")} keywords="concert afcon conference event uplift detty december" onSelect={() => run(() => router.push("/dynamic-pricing?tab=events"))} />}
          {can("pricing.manage") && <Action icon={<ChartLineUp size={17} weight="duotone" />} label="Turn autopilot on or off" locked={!has("dynamic_pricing")} keywords="dynamic pricing autopilot guardrails floor ceiling" onSelect={() => run(() => router.push("/dynamic-pricing?tab=settings"))} />}
          {can("channels.view") && <Action icon={<Plugs size={17} weight="duotone" />} label="What the OTAs cost this month" locked={!has("channel_manager")} keywords="booking.com expedia airbnb commission direct" onSelect={() => run(() => router.push("/channel-manager"))} />}
          {can("channels.view") && <Action icon={<Plugs size={17} weight="duotone" />} label="Copy the iCal calendar links" locked={!has("channel_manager")} keywords="airbnb ical feed export import sync" onSelect={() => run(() => router.push("/channel-manager?tab=connections"))} />}
          {can("loyalty.view") && <Action icon={<Crown size={17} weight="duotone" />} label="Find a loyalty member" locked={!has("loyalty")} keywords="points member tier circle enrol" onSelect={() => run(() => router.push("/loyalty?tab=members"))} />}
          {can("settings.manage") && <Action icon={<Globe size={17} weight="duotone" />} label="Set up a custom domain" locked={!has("custom_domain")} keywords="domain dns cname booking site address" onSelect={() => run(() => router.push("/settings/domain"))} />}
        </Command.Group>

        <Command.Group heading="Actions" className={groupCls}>
          {can("rooms.manage") && (
            <>
              <Action icon={<Rows size={17} weight="duotone" />} label="Add rooms in bulk" hint="e.g. 101 to 120" keywords="add rooms bulk range create" onSelect={() => run(() => router.push("/rooms?new=bulk"))} />
              <Action icon={<Plus size={17} weight="duotone" />} label="Add a room" keywords="new room create" onSelect={() => run(() => router.push("/rooms?new=room"))} />
              <Action icon={<Bed size={17} weight="duotone" />} label="New room type" keywords="create category rate" onSelect={() => run(() => router.push("/rooms/types?new=1"))} />
            </>
          )}
          {can("staff.manage") && (
            <>
              <Action icon={<UserPlus size={17} weight="duotone" />} label="Add staff member" keywords="invite team user" onSelect={() => run(() => router.push("/staff?new=1"))} />
              <Action icon={<ShieldCheck size={17} weight="duotone" />} label="Create a custom role" keywords="permissions access night auditor clone matrix" onSelect={() => run(() => router.push("/staff/roles"))} />
            </>
          )}
          {can("audit.export") && <Action icon={<DownloadSimple size={17} weight="duotone" />} label="Export the audit log" keywords="csv json download trail history" onSelect={() => run(() => router.push("/audit"))} />}
          {can("settings.manage") && (
            <Action icon={<BellRinging size={17} weight="duotone" />} label="WhatsApp alerts and quiet hours" keywords="notifications owner alerts digest templates" onSelect={() => run(() => router.push("/settings/notifications"))} />
          )}
          {can("billing.manage") && (
            <Action icon={<ArrowCircleUp size={17} weight="duotone" />} label="Compare plans and upgrade" keywords="billing plan pricing subscription" onSelect={() => run(() => router.push("/billing#plans"))} />
          )}
        </Command.Group>

        <Command.Group heading="Go to" className={groupCls}>
          {allNavItems().filter((i) => navVisible(i, can)).map((item) => {
            const I = item.icon;
            const locked = !!item.feature && !has(item.feature);
            return (
              <Command.Item
                key={item.href}
                value={`go ${item.label} ${item.keywords ?? ""}`}
                onSelect={() => run(() => router.push(item.href))}
                className={itemCls}
              >
                <I size={17} weight="duotone" className="text-ink-muted group-data-[selected=true]:text-laterite" />
                <span>{item.label}</span>
                {locked && <LockSimple size={12} weight="bold" className="text-brass" />}
                <ArrowRight size={14} className="ml-auto text-ink-faint opacity-0 group-data-[selected=true]:opacity-100" />
              </Command.Item>
            );
          })}
        </Command.Group>

        <Command.Group heading="Preferences" className={groupCls}>
          <Action icon={<Sun size={17} weight="duotone" />} label="Light theme" keywords="theme appearance" onSelect={() => run(() => setThemePref("light"))} />
          <Action icon={<Moon size={17} weight="duotone" />} label="Dark theme" keywords="theme appearance night" onSelect={() => run(() => setThemePref("dark"))} />
          <Action icon={<Desktop size={17} weight="duotone" />} label="Match system theme" keywords="theme appearance auto" onSelect={() => run(() => setThemePref("system"))} />
          <Action icon={<SignOut size={17} weight="duotone" />} label="Log out" keywords="sign out exit" onSelect={() => run(() => void logout())} />
        </Command.Group>

        {!digits && (
          <p className="px-3 pb-2 pt-3 text-[12px] text-ink-faint">
            Tip: type a room number and a status, like <span className="font-mono text-ink-muted">204 clean</span>.
          </p>
        )}
      </Command.List>
    </Command.Dialog>
  );
}

function Action({
  icon,
  label,
  hint,
  keywords,
  onSelect,
  locked,
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  keywords?: string;
  onSelect: () => void;
  locked?: boolean;
}) {
  return (
    <Command.Item value={`${label} ${keywords ?? ""}`} onSelect={onSelect} className={itemCls}>
      <span className="text-ink-muted group-data-[selected=true]:text-laterite">{icon}</span>
      <span>{label}</span>
      {locked && <LockSimple size={12} weight="bold" className="text-brass" aria-label="on a higher plan" />}
      {hint && <span className="ml-auto text-[12px] text-ink-faint">{hint}</span>}
    </Command.Item>
  );
}
