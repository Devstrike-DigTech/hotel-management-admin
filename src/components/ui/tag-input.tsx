"use client";

import { useState } from "react";
import { X } from "@phosphor-icons/react";
import { cn } from "@/lib/cn";

/** Free-text chips: Enter or comma adds, Backspace on empty removes the last. */
export function TagInput({
  value,
  onChange,
  placeholder,
  id,
  className,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const commit = (raw: string) => {
    const parts = raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .filter((s) => !value.some((v) => v.toLowerCase() === s.toLowerCase()));
    if (parts.length) onChange([...value, ...parts]);
    setDraft("");
  };
  return (
    <div
      className={cn(
        "flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-line-strong bg-surface px-2 py-1.5 transition-[border-color,box-shadow] focus-within:border-laterite focus-within:shadow-[0_0_0_3px_color-mix(in_oklab,var(--laterite)_18%,transparent)]",
        className,
      )}
    >
      {value.map((t) => (
        <span key={t} className="inline-flex h-6 items-center gap-1 rounded-xs border border-line bg-surface-2 pl-2 pr-1 text-[12.5px] text-ink">
          {t}
          <button
            type="button"
            aria-label={`Remove ${t}`}
            onClick={() => onChange(value.filter((v) => v !== t))}
            className="grid h-4 w-4 place-items-center rounded-xs text-ink-muted hover:bg-line hover:text-ink"
          >
            <X size={10} weight="bold" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => {
          if (e.target.value.includes(",")) commit(e.target.value);
          else setDraft(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit(draft);
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={() => draft && commit(draft)}
        placeholder={value.length ? "" : placeholder}
        className="min-w-[120px] flex-1 bg-transparent px-1 text-[14px] outline-none"
      />
    </div>
  );
}
