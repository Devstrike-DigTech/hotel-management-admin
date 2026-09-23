"use client";

import { createStore, useStore } from "./store";

/**
 * The property the admin is working in. Every hotel request carries it as
 * `X-Property-Id` (the API validates it against the user's access), so a
 * group with several hotels sees one house at a time. Kept per browser in
 * localStorage (guarded) and mirrored across tabs.
 */
const KEY = "admin.property";

function read(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export const propertyStore = createStore<string | null>(read());

export function setPropertyId(id: string | null) {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
  } catch {
    /* memory only */
  }
  propertyStore.set(id);
}

export const currentPropertyId = () => propertyStore.get();

export function usePropertyId() {
  return useStore(propertyStore);
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === KEY) propertyStore.set(e.newValue);
  });
}

/* ---- the API refused the property: the shell listens, resets and explains ---- */
type Listener = (info: { propertyId: string | null; message: string }) => void;
const denied = new Set<Listener>();
export function onPropertyDenied(l: Listener) {
  denied.add(l);
  return () => {
    denied.delete(l);
  };
}
export function emitPropertyDenied(info: { propertyId: string | null; message: string }) {
  denied.forEach((l) => l(info));
}

/** API error codes that mean "not this property". */
export const PROPERTY_DENIED_CODES = new Set(["PROPERTY_ACCESS_DENIED", "PROPERTY_FORBIDDEN", "PROPERTY_NOT_FOUND", "NO_PROPERTY_ACCESS"]);
