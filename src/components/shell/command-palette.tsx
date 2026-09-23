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
import { useCan } from "@/lib/permissions";
import { useReservations } from "@/lib/api/hooks-m2";
import { openNewReservation, openPayment } from "@/lib/store-m2";
import { STAY_STATUS } from "@/lib/catalog-m2";
import { naira } from "@/lib/format";
import { StatusSwatch } from "@/components/keyrack/status-swatch";

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

        <Command.Group heading="Actions" className={groupCls}>
          <Action icon={<Rows size={17} weight="duotone" />} label="Add rooms in bulk" hint="e.g. 101 to 120" keywords="add rooms bulk range create" onSelect={() => run(() => router.push("/rooms?new=bulk"))} />
          <Action icon={<Plus size={17} weight="duotone" />} label="Add a room" keywords="new room create" onSelect={() => run(() => router.push("/rooms?new=room"))} />
          <Action icon={<Bed size={17} weight="duotone" />} label="New room type" keywords="create category rate" onSelect={() => run(() => router.push("/rooms/types?new=1"))} />
          <Action icon={<UserPlus size={17} weight="duotone" />} label="Add staff member" keywords="invite team user" onSelect={() => run(() => router.push("/staff?new=1"))} />
          <Action icon={<ArrowCircleUp size={17} weight="duotone" />} label="Compare plans and upgrade" keywords="billing plan pricing subscription" onSelect={() => run(() => router.push("/billing#plans"))} />
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
}: {
  icon: React.ReactNode;
  label: string;
  hint?: string;
  keywords?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item value={`${label} ${keywords ?? ""}`} onSelect={onSelect} className={itemCls}>
      <span className="text-ink-muted group-data-[selected=true]:text-laterite">{icon}</span>
      <span>{label}</span>
      {hint && <span className="ml-auto text-[12px] text-ink-faint">{hint}</span>}
    </Command.Item>
  );
}
