"use client";

import { CallBell } from "@phosphor-icons/react";
import { FeaturePage } from "@/components/gating/feature-page";
import { RequireAny } from "@/components/m7/routes";
import type { ColumnKey, RequestListItem } from "@/lib/api/types-m8";
import { ConciergeBoard, RequestCard } from "./board";
import { RequestDetailView } from "./request-detail";
import { ServicesView } from "./services-view";
import { VendorsView } from "./vendors-view";
import { ReportsView } from "./reports-view";
import { ConciergeSettingsView } from "./settings-view";
import { AupGate } from "./aup";

const BULLETS = [
  "Your own menu: massage by licensed therapists, a private chef, barber, car with driver, city tours, babysitting",
  "Requests from booking, the trip page, WhatsApp or the desk on one board, with a clock for the first answer",
  "Quotes the guest accepts from a link or with a YES, paid online or added to the bill",
  "Private requests only the right people can open, with neutral wording on the bill",
];

const at = (h: number) => {
  const d = new Date();
  d.setUTCHours(h - 1, 0, 0, 0);
  return d.toISOString();
};
const sample = (id: string, number: string, title: string, category: RequestListItem["category"], status: RequestListItem["status"], more: Partial<RequestListItem> = {}): RequestListItem => ({
  id,
  number,
  propertyId: "p",
  status,
  source: "TRIP_PAGE",
  discreet: false,
  masked: false,
  title,
  label: title,
  category,
  guestName: "Ifeoma Nwosu",
  roomNumber: "204",
  reservationCode: null,
  preferredStart: at(19),
  preferredEnd: null,
  partySize: 2,
  assignee: null,
  vendor: null,
  flagged: false,
  totalKobo: null,
  paymentStatus: "NONE",
  sla: { dueAt: at(23), firstResponseAt: null, overdue: false, minutesLeft: 12, escalatedAt: null, target: "IN_STAY" },
  createdAt: at(9),
  updatedAt: at(9),
  ...more,
});

export function ConciergePreview() {
  const cols: { label: string; col: ColumnKey; items: RequestListItem[] }[] = [
    {
      label: "New",
      col: "NEW",
      items: [
        sample("1", "CR-000118", "Private chef dinner, Nigerian menu", "DINING", "NEW", { guestName: "Tunde Bakare", roomNumber: "305", partySize: 4 }),
        sample("2", "CR-000119", "Barber in-room", "GROOMING", "NEW", { roomNumber: "112", partySize: 1 }),
      ],
    },
    { label: "Quoted", col: "QUOTED", items: [sample("3", "CR-000115", "Car with driver, full day", "TRANSPORT", "QUOTED", { totalKobo: 9137500, roomNumber: "208" })] },
    {
      label: "Today",
      col: "TODAY",
      items: [
        sample("4", "CR-000112", "Romantic room set-up", "ROMANCE_AND_CELEBRATION", "CONFIRMED", { vendor: { id: "v", name: "Petals & Pearls" }, roomNumber: "301" }),
        sample("5", "CR-000110", "In-room massage, 90 minutes", "WELLNESS", "IN_PROGRESS", { discreet: true, assignee: { id: "a", fullName: "Amaka Nwosu" } }),
      ],
    },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cols.map((c) => (
        <div key={c.label} className="flex flex-col gap-2 rounded-lg border border-line bg-surface-2/40 p-2">
          <p className="display-sm px-1.5 pt-1 text-[15px] text-ink">{c.label}</p>
          {c.items.map((r) => (
            <RequestCard key={r.id} r={r} column={c.col} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Locked({ children, caps, what }: { children: React.ReactNode; caps: string[]; what: string }) {
  return (
    <FeaturePage
      feature="concierge"
      icon={CallBell}
      name="Concierge"
      title={
        <>
          Arrange anything <em>lawful, quietly</em>.
        </>
      }
      pitch="A concierge desk in the app: your services, your trusted vendors, quotes guests accept from their phone, and requests that stay private."
      bullets={BULLETS}
      preview={<ConciergePreview />}
    >
      <RequireAny caps={caps} what={what}>
        {children}
      </RequireAny>
    </FeaturePage>
  );
}

export function ConciergeRoute() {
  return (
    <Locked caps={["concierge.view"]} what="The concierge board">
      <AupGate>
        <ConciergeBoard />
      </AupGate>
    </Locked>
  );
}

export function RequestRoute({ id }: { id: string }) {
  return (
    <Locked caps={["concierge.view"]} what="Concierge requests">
      <RequestDetailView id={id} />
    </Locked>
  );
}

export function ServicesRoute() {
  return (
    <Locked caps={["concierge.view", "concierge.catalogue"]} what="The concierge catalogue">
      <AupGate>
        <ServicesView />
      </AupGate>
    </Locked>
  );
}

export function VendorsRoute() {
  return (
    <Locked caps={["concierge.view", "concierge.catalogue"]} what="Concierge vendors">
      <VendorsView />
    </Locked>
  );
}

export function ReportsRoute() {
  return (
    <Locked caps={["concierge.reports"]} what="Concierge reports">
      <ReportsView />
    </Locked>
  );
}

export function SettingsRoute() {
  return (
    <Locked caps={["concierge.settings"]} what="Concierge settings">
      <ConciergeSettingsView />
    </Locked>
  );
}
