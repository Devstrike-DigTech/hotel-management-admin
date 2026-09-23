"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass, SlidersHorizontal, X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";
import type { PosItem, PosMenu } from "./model";

const CAT_VARS = ["var(--season-1)", "var(--season-2)", "var(--season-3)", "var(--season-4)", "var(--season-5)"];
export const catColor = (i: number) => CAT_VARS[i % CAT_VARS.length];

function thousands(kobo: number) {
  return new Intl.NumberFormat("en-NG").format(Math.round(kobo / 100));
}

/**
 * The menu as large tiles, by category. Tapping a tile adds it to the ticket
 * (or opens its options when it has required ones); the count of that item
 * already on the ticket sits in the corner so a double tap is visible.
 */
export function MenuBoard({
  menu,
  counts,
  onPick,
  onOptions,
  compact,
  disabled,
}: {
  menu: PosMenu;
  /** item id -> quantity on the current ticket */
  counts: Record<string, number>;
  onPick: (item: PosItem) => void;
  /** long-press or the options corner: always opens the options sheet */
  onOptions: (item: PosItem) => void;
  compact?: boolean;
  disabled?: boolean;
}) {
  const cats = useMemo(() => [...menu.categories].sort((a, b) => a.sortOrder - b.sortOrder), [menu.categories]);
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const [bump, setBump] = useState<{ id: string; n: number } | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable) return;
      if (e.key === "/") {
        e.preventDefault();
        search.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const catIndex = useMemo(() => new Map(cats.map((c, i) => [c.id, i])), [cats]);
  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    const list = menu.items.filter((i) => (term ? i.name.toLowerCase().includes(term) || (i.code ?? "").toLowerCase() === term : cat === "all" || i.categoryId === cat));
    return list.sort((a, b) => (catIndex.get(a.categoryId) ?? 0) - (catIndex.get(b.categoryId) ?? 0) || Number(b.available) - Number(a.available));
  }, [menu.items, q, cat, catIndex]);

  const pick = (it: PosItem) => {
    if (!it.available || disabled) return;
    setBump({ id: it.id, n: Date.now() });
    const required = it.modifierGroups.some((g) => g.min > 0);
    if (required) onOptions(it);
    else onPick(it);
  };

  return (
    <div className={cn("flex min-h-0 flex-1", compact ? "flex-col" : "flex-row")}>
      {/* categories */}
      <nav
        aria-label="Menu categories"
        className={cn(
          "scrollbar-thin shrink-0 border-line",
          compact ? "flex gap-1.5 overflow-x-auto border-b px-3 py-2" : "flex w-[148px] flex-col gap-0.5 overflow-y-auto border-r py-2 pl-2 pr-2 xl:w-[168px]",
        )}
      >
        {[{ id: "all", name: "Everything" }, ...cats].map((c) => {
          const on = !q && cat === c.id;
          const i = c.id === "all" ? -1 : (catIndex.get(c.id) ?? 0);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setCat(c.id);
                setQ("");
              }}
              className={cn(
                "relative flex shrink-0 items-center gap-2.5 rounded-md text-left font-medium transition-colors",
                compact ? "h-10 border px-3.5 text-[14px]" : "min-h-[52px] px-3 py-2 text-[15px] leading-tight",
                on
                  ? compact
                    ? "border-ink bg-ink text-paper"
                    : "bg-surface text-ink shadow-[0_0_0_1px_var(--line-strong)]"
                  : compact
                    ? "border-line-strong bg-surface text-ink-muted"
                    : "text-ink-muted hover:bg-surface/70 hover:text-ink",
              )}
            >
              {!compact && (
                <span
                  aria-hidden
                  className="h-7 w-[3px] shrink-0 rounded-full"
                  style={{ background: i < 0 ? "var(--line-strong)" : catColor(i), opacity: on ? 1 : 0.55 }}
                />
              )}
              {c.name}
            </button>
          );
        })}
      </nav>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 px-3 pt-3 sm:px-4">
          <label className="relative flex h-11 flex-1 items-center">
            <MagnifyingGlass size={17} className="pointer-events-none absolute left-3 text-ink-muted" />
            <span className="sr-only">Find an item</span>
            <input
              ref={search}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && shown[0]) {
                  pick(shown[0]);
                  setQ("");
                }
                if (e.key === "Escape") {
                  setQ("");
                  search.current?.blur();
                }
              }}
              placeholder="Find an item, or type a code like STAR"
              className="h-11 w-full rounded-md border border-line-strong bg-surface pl-10 pr-10 text-[16px] text-ink outline-none placeholder:text-ink-faint focus:border-laterite"
            />
            {q ? (
              <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 grid h-7 w-7 place-items-center rounded-sm text-ink-muted hover:bg-surface-2">
                <X size={14} />
              </button>
            ) : (
              <span className="kbd pointer-events-none absolute right-3 hidden sm:inline">/</span>
            )}
          </label>
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-3 pb-4 pt-3 sm:px-4">
          {shown.length === 0 ? (
            <p className="px-2 py-16 text-center text-[14px] text-ink-muted">Nothing on this menu matches &ldquo;{q}&rdquo;.</p>
          ) : (
            <ul className={cn("grid gap-2.5", compact ? "grid-cols-2 min-[480px]:grid-cols-3" : "grid-cols-[repeat(auto-fill,minmax(128px,1fr))] xl:grid-cols-[repeat(auto-fill,minmax(150px,1fr))]")}>
              {shown.map((it) => (
                <li key={it.id}>
                  <Tile
                    item={it}
                    color={catColor(catIndex.get(it.categoryId) ?? 0)}
                    count={counts[it.id] ?? 0}
                    bumped={bump?.id === it.id ? bump.n : 0}
                    onPick={() => pick(it)}
                    onOptions={() => it.available && !disabled && onOptions(it)}
                    disabled={disabled}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({
  item,
  color,
  count,
  bumped,
  onPick,
  onOptions,
  disabled,
}: {
  item: PosItem;
  color: string;
  count: number;
  bumped: number;
  onPick: () => void;
  onOptions: () => void;
  disabled?: boolean;
}) {
  const press = useRef<number | null>(null);
  const long = useRef(false);
  const off = !item.available || item.stockLeft === 0;
  const hh = item.activePriceKobo != null && item.activePriceKobo !== item.priceKobo;
  const low = item.stockLeft != null && item.stockLeft > 0 && item.stockLeft <= 6;
  const hasOptions = item.modifierGroups.length > 0;
  return (
    <div className="relative">
      <button
        type="button"
        data-testid={`tile-${item.name}`}
        disabled={off || disabled}
        aria-label={`${item.name}, ${off ? "not available" : `₦${thousands(item.activePriceKobo ?? item.priceKobo)}`}${count ? `, ${count} on ticket` : ""}`}
        onPointerDown={() => {
          long.current = false;
          press.current = window.setTimeout(() => {
            long.current = true;
            if (hasOptions) onOptions();
          }, 480);
        }}
        onPointerUp={() => press.current && window.clearTimeout(press.current)}
        onPointerLeave={() => press.current && window.clearTimeout(press.current)}
        onClick={() => {
          if (long.current) return;
          onPick();
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          if (hasOptions) onOptions();
        }}
        className={cn(
          "group relative flex h-[92px] w-full select-none flex-col justify-between overflow-hidden rounded-md border bg-surface px-3 pb-2.5 pt-2.5 text-left transition-[transform,border-color,box-shadow] duration-100 ease-out",
          "active:scale-[0.97] enabled:hover:border-ink-faint",
          count > 0 ? "border-[color-mix(in_oklab,var(--laterite)_55%,var(--line))] shadow-[0_0_0_1px_color-mix(in_oklab,var(--laterite)_30%,transparent)]" : "border-line",
          off && "cursor-not-allowed text-ink-faint",
        )}
      >
        <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: color, opacity: off ? 0.3 : 0.9 }} />
        {off && <span aria-hidden className="hatch pointer-events-none absolute inset-0 text-ink-faint opacity-60" />}
        <span className={cn("relative line-clamp-2 pr-5 text-[14.5px] font-medium leading-[1.2]", off ? "text-ink-faint" : "text-ink")}>{item.name}</span>
        <span className={cn("relative flex items-end justify-between gap-2", hasOptions && !off && "pr-7")}>
          <span className="flex flex-col leading-none">
            {hh && <span className="mb-0.5 font-mono text-[10.5px] text-ink-faint line-through">{thousands(item.priceKobo)}</span>}
            <span className={cn("font-mono text-[15px] tracking-tight", off ? "text-ink-faint" : hh ? "text-brass" : "text-ink")}>
              <span className="text-[11px] text-ink-muted">₦</span>
              {thousands(item.activePriceKobo ?? item.priceKobo)}
            </span>
          </span>
          {off ? (
            <span className="rounded-xs border border-current px-1 font-mono text-[10px] font-medium uppercase tracking-wider text-danger">86</span>
          ) : hh ? (
            <span className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-brass">{item.activePriceLabel ?? "Offer"}</span>
          ) : low ? (
            <span className="font-mono text-[10.5px] text-ochre">{item.stockLeft} left</span>
          ) : null}
        </span>
        {count > 0 && (
          <span
            key={bumped}
            aria-hidden
            className="absolute right-1.5 top-1.5 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-laterite px-1.5 font-mono text-[12px] font-medium text-laterite-ink animate-[pos-pop_220ms_cubic-bezier(0.22,1,0.36,1)]"
          >
            {count}
          </span>
        )}
      </button>
      {hasOptions && !off && (
        <button
          type="button"
          onClick={onOptions}
          aria-label={`Options for ${item.name}`}
          className={cn(
            "absolute bottom-1.5 right-1.5 grid h-8 w-8 place-items-center rounded-sm text-ink-faint hover:bg-surface-2 hover:text-ink",
            count > 0 && "text-laterite",
          )}
          disabled={disabled}
        >
          <SlidersHorizontal size={15} weight="bold" />
        </button>
      )}
    </div>
  );
}
