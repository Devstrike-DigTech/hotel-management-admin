"use client";

import * as Popover from "@radix-ui/react-popover";
import { Fragment, useId, useMemo, useRef, useState } from "react";
import { Bank, CaretUpDown, Check, MagnifyingGlass } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

export interface BankOption {
  code: string;
  name: string;
}

/** The banks people pick most, shown first before any search. */
const POPULAR = ["access", "gtbank", "guaranty", "zenith", "first bank", "uba", "united bank", "opay", "moniepoint", "kuda", "palmpay", "stanbic", "fidelity", "wema"];

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Searchable bank list (a combobox): type any part of the name, arrow keys to
 * move, Enter to choose. Popular banks sit on top until you search.
 */
export function BankPicker({
  banks,
  value,
  onChange,
  loading,
  disabled,
  id,
}: {
  banks: BankOption[];
  value: string | null;
  onChange: (code: string) => void;
  loading?: boolean;
  disabled?: boolean;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const listId = useId();
  const listRef = useRef<HTMLUListElement>(null);
  const selected = banks.find((b) => b.code === value) ?? null;

  const list = useMemo(() => {
    const t = norm(q);
    if (!t) {
      const pop = banks.filter((b) => POPULAR.some((p) => norm(b.name).startsWith(p)));
      const rest = banks.filter((b) => !pop.includes(b)).sort((a, b) => a.name.localeCompare(b.name));
      return { pop, rest };
    }
    const words = t.split(" ");
    const hits = banks
      .filter((b) => {
        const n = norm(b.name);
        return words.every((w) => n.includes(w));
      })
      .sort((a, b) => Number(!norm(a.name).startsWith(t)) - Number(!norm(b.name).startsWith(t)) || a.name.localeCompare(b.name));
    return { pop: [] as BankOption[], rest: hits };
  }, [banks, q]);
  const flat = [...list.pop, ...list.rest];

  const choose = (b: BankOption) => {
    onChange(b.code);
    setOpen(false);
    setQ("");
  };

  const move = (d: number) => {
    const next = Math.max(0, Math.min(flat.length - 1, active + d));
    setActive(next);
    listRef.current?.querySelector(`[data-idx="${next}"]`)?.scrollIntoView({ block: "nearest" });
  };

  return (
    <Popover.Root open={open} onOpenChange={(o) => { setOpen(o); if (o) setActive(0); }}>
      <Popover.Trigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-haspopup="listbox"
          className={cn(
            "flex h-11 w-full items-center gap-3 rounded-md border border-line-strong bg-surface px-3 text-left transition-[border-color,box-shadow] hover:border-ink-faint focus-visible:border-laterite focus-visible:shadow-[0_0_0_3px_color-mix(in_oklab,var(--laterite)_18%,transparent)] focus-visible:outline-none disabled:opacity-60",
          )}
        >
          <Bank size={18} weight="duotone" className="shrink-0 text-ink-muted" />
          <span className={cn("min-w-0 flex-1 truncate text-[15px] sm:text-[14px]", selected ? "text-ink" : "text-ink-faint")}>
            {selected ? selected.name : loading ? "Loading banks" : "Choose your bank"}
          </span>
          <CaretUpDown size={14} className="shrink-0 text-ink-muted" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="z-[60] w-[var(--radix-popover-trigger-width)] min-w-[280px] overflow-hidden rounded-md border border-line bg-surface shadow-float animate-[rise_160ms_ease-out]"
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            (e.currentTarget as HTMLElement).querySelector("input")?.focus();
          }}
        >
          <div className="flex items-center gap-2 border-b border-line px-3">
            <MagnifyingGlass size={15} className="text-ink-muted" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setActive(0);
              }}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  move(1);
                } else if (e.key === "ArrowUp") {
                  e.preventDefault();
                  move(-1);
                } else if (e.key === "Enter" && flat[active]) {
                  e.preventDefault();
                  choose(flat[active]);
                }
              }}
              placeholder={`Search ${banks.length || ""} banks`}
              aria-label="Search banks"
              aria-controls={listId}
              aria-activedescendant={flat[active] ? `${listId}-${active}` : undefined}
              className="h-11 flex-1 bg-transparent text-[16px] text-ink outline-none placeholder:text-ink-faint sm:text-[14px]"
            />
          </div>
          <ul ref={listRef} id={listId} role="listbox" aria-label="Banks" className="scrollbar-thin max-h-[300px] overflow-y-auto p-1">
            {flat.length === 0 && <li className="px-3 py-6 text-center text-[13px] text-ink-muted">No bank matches &ldquo;{q}&rdquo;.</li>}
            {list.pop.length > 0 && <li className="eyebrow px-2.5 pb-1 pt-2 text-[10px] text-ink-faint" role="presentation">Most used</li>}
            {flat.map((b, i) => (
              <Fragment key={b.code}>
                {i === list.pop.length && list.pop.length > 0 && (
                  <li key={`sep-${b.code}`} className="eyebrow px-2.5 pb-1 pt-3 text-[10px] text-ink-faint" role="presentation">
                    All banks
                  </li>
                )}
                <li
                  id={`${listId}-${i}`}
                  data-idx={i}
                  role="option"
                  aria-selected={b.code === value}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(b)}
                  className={cn(
                    "flex h-9 cursor-pointer items-center gap-2 rounded-sm px-2.5 text-[13.5px] text-ink",
                    i === active && "bg-surface-2",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{b.name}</span>
                  {b.code === value && <Check size={14} weight="bold" className="text-laterite" />}
                </li>
              </Fragment>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
