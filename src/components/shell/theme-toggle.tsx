"use client";

import { Desktop, Moon, Sun } from "@phosphor-icons/react";
import { useEffect, useSyncExternalStore } from "react";
import { applyTheme, readThemePref, type ThemePref } from "@/lib/theme";
import { createStore } from "@/lib/store";
import { cn } from "@/lib/cn";

const prefStore = createStore<ThemePref>("system");
let initialised = false;

export function setThemePref(p: ThemePref) {
  applyTheme(p);
  prefStore.set(p);
}

export function useThemePref(): ThemePref {
  useEffect(() => {
    if (!initialised) {
      initialised = true;
      prefStore.set(readThemePref());
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      if (prefStore.get() === "system") applyTheme("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return useSyncExternalStore(prefStore.subscribe, prefStore.get, () => "system" as ThemePref);
}

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Desktop },
];

export function ThemeToggle({ className, compact }: { className?: string; compact?: boolean }) {
  const pref = useThemePref();
  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className={cn("inline-flex items-center rounded-md border border-line bg-surface-2/60 p-0.5", className)}
    >
      {OPTIONS.map(({ value, label, icon: I }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => setThemePref(value)}
            className={cn(
              "inline-flex h-7 items-center justify-center gap-1.5 rounded-sm px-2 text-[12px] transition-colors",
              active ? "bg-surface text-ink shadow-[0_0_0_1px_var(--line)]" : "text-ink-muted hover:text-ink",
            )}
          >
            <I size={14} weight={active ? "duotone" : "regular"} />
            {!compact && <span>{label}</span>}
          </button>
        );
      })}
    </div>
  );
}
