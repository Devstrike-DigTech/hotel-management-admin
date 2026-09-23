"use client";

import { createStore } from "./store";
import type { StayType } from "./api/types-m2";

export interface NewReservationPrefill {
  roomId?: string;
  roomTypeId?: string;
  arrival?: string;
  departure?: string;
  stayType?: StayType;
  guestId?: string;
  guestName?: string;
  phone?: string;
}

/** Opens the new-reservation drawer from anywhere (ledger, palette, Today, guests). */
export const newReservationStore = createStore<NewReservationPrefill | null>(null);
export const openNewReservation = (p: NewReservationPrefill = {}) => newReservationStore.set(p);

export interface PaymentTarget {
  folioId: string;
  label: string;
  balanceKobo: number;
  reservationCode?: string | null;
  onDone?: () => void;
}
/** Opens the take-payment sheet for a folio. */
export const paymentStore = createStore<PaymentTarget | null>(null);
export const openPayment = (t: PaymentTarget) => paymentStore.set(t);
