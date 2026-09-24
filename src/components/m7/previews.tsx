"use client";

import type { Extra, PickupPoint, Transfer } from "@/lib/api/types-m7";
import { ExtraCard } from "@/components/extras/extras-view";
import { PointRow } from "@/components/pickups/pickups-view";
import { TransferCard } from "@/components/transfers/transfers-view";

const AV = { validFrom: null, validTo: null, daysOfWeek: null, minNights: null, earlyFrom: null, lateUntil: null };
const CH = ["MARKETPLACE", "BOOKING_SITE", "FRONT_DESK"] as Extra["channels"];
const ex = (id: string, name: string, pricing: Extra["pricing"], naira: number, more: Partial<Extra> = {}): Extra => ({
  id,
  propertyId: "p",
  name,
  description: "",
  imageUrl: null,
  category: "FOOD",
  kind: "STANDARD",
  pricing,
  priceKobo: naira * 100,
  maxUnits: null,
  taxable: true,
  channels: CH,
  availability: AV,
  dailyCap: null,
  leadTimeHours: 0,
  active: true,
  sortOrder: 0,
  createdAt: "",
  updatedAt: "",
  soldLast30Days: 0,
  ...more,
});

export function ExtrasPreview() {
  const list = [
    ex("1", "Breakfast for two", "PER_NIGHT", 12000, { description: "Akara, yam and egg sauce or a full English, with fresh juice.", soldLast30Days: 41 }),
    ex("2", "Late check-out (until 16:00)", "PER_STAY", 15000, { kind: "LATE_CHECK_OUT", availability: { ...AV, lateUntil: "16:00" }, dailyCap: 3, soldLast30Days: 17 }),
    ex("3", "Birthday cake and decoration", "PER_STAY", 35000, { description: "A red velvet cake, balloons and a card on the bed.", leadTimeHours: 48, soldLast30Days: 6 }),
    ex("4", "Swedish massage, 60 minutes", "PER_PERSON", 28000, { leadTimeHours: 12, soldLast30Days: 9 }),
  ];
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {list.map((e) => (
        <li key={e.id}>
          <ExtraCard e={e} stay={{ nights: 2, guests: 2 }} manage={false} onOpen={() => {}} onToggle={() => {}} />
        </li>
      ))}
    </ul>
  );
}

const pt = (id: string, name: string, kind: PickupPoint["kind"], naira: number, more: Partial<PickupPoint> = {}): PickupPoint => ({
  id,
  propertyId: "p",
  name,
  shortName: null,
  kind,
  city: "Lagos",
  address: null,
  priceKobo: naira * 100,
  dropOffPriceKobo: null,
  vehicleOptions: [{ name: "Saloon car", maxPassengers: 3, priceKobo: null }, { name: "SUV", maxPassengers: 4, priceKobo: (naira + 10000) * 100 }],
  leadTimeHours: 6,
  operatingHours: { open: "06:00", close: "22:00" },
  notesForGuest: null,
  taxable: true,
  active: true,
  sortOrder: 0,
  createdAt: "",
  updatedAt: "",
  ...more,
});

export function PickupsPreview() {
  return (
    <ul className="flex flex-col gap-2">
      {[
        pt("1", "Murtala Muhammed International Airport", "AIRPORT", 35000, { shortName: "MMIA", operatingHours: { open: "05:00", close: "23:00" } }),
        pt("2", "Jibowu Motor Park", "MOTOR_PARK", 20000, { address: "Ikorodu Road, Yaba" }),
        pt("3", "Mobolaji Johnson Station, Ebute Metta", "TRAIN_STATION", 20000, { operatingHours: null }),
      ].map((p) => (
        <li key={p.id}>
          <PointRow p={p} manage={false} onOpen={() => {}} onToggle={() => {}} />
        </li>
      ))}
    </ul>
  );
}

const tr = (id: string, guest: string, code: string, name: string, kind: Transfer["pickupPoint"]["kind"], at: string, status: Transfer["status"], summary: string, more: Partial<Transfer> = {}): Transfer => ({
  id,
  propertyId: "p",
  reservationId: id,
  reservation: { code, status: "CONFIRMED", guestName: guest, guestPhone: null, roomNumber: null, arrivalDate: "", departureDate: "" },
  direction: "ARRIVAL",
  status,
  pickupPoint: { id, name, shortName: null, kind, city: "Lagos" },
  details: {},
  detailsSummary: summary,
  scheduledAt: at,
  passengers: 2,
  luggage: 2,
  vehicleOption: { id: "v", name: "Saloon car", maxPassengers: 3 },
  amountKobo: 2000000,
  taxKobo: 0,
  totalKobo: 2000000,
  contactPhone: null,
  driver: null,
  delayNote: null,
  notes: null,
  events: [],
  posted: false,
  source: "ONLINE",
  lastNotifiedAt: null,
  createdAt: "",
  updatedAt: "",
  ...more,
});

export function TransfersPreview() {
  return (
    <ol className="flex flex-col gap-2.5">
      {[
        tr("1", "Babatunde Ade", "PWH-2M8D", "Jibowu Motor Park", "MOTOR_PARK", "2026-09-24T12:30:00Z", "EN_ROUTE", "GIGM from Abuja, ticket GIG-554120", { driver: { name: "Musa Bello", phone: "", vehiclePlate: "KJA 219 XH", vehicleDescription: null, assignedAt: "" }, delayNote: "Bus delayed at Ore, now about 14:15" }),
        tr("2", "Folake Adeyemi", "PWH-9QWA", "Mobolaji Johnson Station", "TRAIN_STATION", "2026-09-24T15:10:00Z", "CONFIRMED", "Lagos – Ibadan, 16:00 service"),
        tr("3", "Ngozi Eze", "PWH-4TRC", "MMIA", "AIRPORT", "2026-09-24T18:25:00Z", "REQUESTED", "British Airways BA 75, Terminal 2"),
      ].map((t) => (
        <li key={t.id} className="flex">
          <TransferCard t={t} active={false} onOpen={() => {}} />
        </li>
      ))}
    </ol>
  );
}
