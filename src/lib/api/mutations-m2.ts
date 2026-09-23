"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

/** Refresh everything a desk action can touch. Awaitable so drags don't flicker. */
export function useDeskRefresh() {
  const qc = useQueryClient();
  return useCallback(
    (extra: readonly unknown[][] = []) =>
      Promise.all(
        [
          ["front-desk"],
          ["reservations"],
          ["tape-chart"],
          ["availability"],
          ["folio"],
          ["shifts"],
          ["rooms"],
          ["dashboard"],
          ["guard"],
          ["guests"],
          ...extra,
        ].map((queryKey) => qc.invalidateQueries({ queryKey })),
      ),
    [qc],
  );
}

/** Normalise a Nigerian phone the way the API does (for lookups and display). */
export function normalisePhone(input: string): string | null {
  const raw = input.replace(/[\s()-]/g, "");
  if (!raw) return null;
  if (raw.startsWith("+")) return /^\+\d{8,15}$/.test(raw) ? raw : null;
  const d = raw.replace(/\D/g, "");
  if (/^0\d{10}$/.test(d)) return `+234${d.slice(1)}`;
  if (/^[789]\d{9}$/.test(d)) return `+234${d}`;
  if (/^234\d{10}$/.test(d)) return `+${d}`;
  return null;
}
