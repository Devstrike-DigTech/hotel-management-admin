"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** "⌘K" on Apple platforms, "Ctrl K" elsewhere. */
export function ModKeyHint({ letter = "K" }: { letter?: string }) {
  const mac = useSyncExternalStore(
    noop,
    () => /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent),
    () => false,
  );
  return <span className="kbd">{mac ? `⌘${letter}` : `Ctrl ${letter}`}</span>;
}
