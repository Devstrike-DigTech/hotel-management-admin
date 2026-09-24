"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Drag to reorder a vertical list with pointer events, so it works with a
 * mouse, a pen and a finger alike, plus the keyboard (arrow keys on the handle).
 * Items keep their DOM order while dragging; the dragged row follows the pointer
 * and its neighbours slide out of the way. `onMove(from, to)` fires on drop.
 */
export function useSortable({
  count,
  onMove,
  canDrop,
}: {
  count: number;
  onMove: (from: number, to: number) => void;
  /** refuse some targets (e.g. above the first section header) */
  canDrop?: (from: number, to: number) => boolean;
}) {
  const listRef = useRef<HTMLElement | null>(null);
  const [drag, setDrag] = useState<{ from: number; to: number; dy: number; h: number } | null>(null);
  const geo = useRef<{ tops: number[]; heights: number[]; startY: number; gap: number } | null>(null);
  const target = useRef<number | null>(null);

  const rows = () => Array.from(listRef.current?.querySelectorAll<HTMLElement>(":scope > [data-sort-row]") ?? []);

  const onPointerDown = useCallback(
    (index: number) => (e: React.PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      const els = rows();
      if (!els.length) return;
      e.preventDefault();
      const rects = els.map((el) => el.getBoundingClientRect());
      const gap = rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0;
      geo.current = { tops: rects.map((r) => r.top), heights: rects.map((r) => r.height), startY: e.clientY, gap };
      const h = rects[index].height + gap;
      setDrag({ from: index, to: index, dy: 0, h });
      target.current = index;
      const handleEl = e.currentTarget;
      try {
        handleEl.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }

      const move = (ev: PointerEvent) => {
        const g = geo.current;
        if (!g) return;
        const dy = ev.clientY - g.startY;
        const center = g.tops[index] + g.heights[index] / 2 + dy;
        let to = index;
        for (let i = 0; i < g.tops.length; i++) {
          const mid = g.tops[i] + g.heights[i] / 2;
          if (i < index && center < mid) {
            to = i;
            break;
          }
          if (i > index && center > mid) to = i;
        }
        if (canDrop && !canDrop(index, to)) to = index;
        target.current = to;
        setDrag((d) => (d ? { ...d, dy, to } : d));
      };
      const up = () => {
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        const to = target.current;
        target.current = null;
        geo.current = null;
        setDrag(null);
        if (to !== null && to !== index) onMove(index, to);
      };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    },
    [onMove, canDrop],
  );

  const onKeyDown = useCallback(
    (index: number) => (e: React.KeyboardEvent<HTMLElement>) => {
      let to = index;
      if (e.key === "ArrowUp") to = index - 1;
      else if (e.key === "ArrowDown") to = index + 1;
      else if (e.key === "Home") to = 0;
      else if (e.key === "End") to = count - 1;
      else return;
      e.preventDefault();
      if (to < 0 || to >= count || to === index) return;
      if (canDrop && !canDrop(index, to)) return;
      onMove(index, to);
    },
    [count, onMove, canDrop],
  );

  /** transform for row `i` while a drag is in progress */
  const rowStyle = (i: number): React.CSSProperties | undefined => {
    if (!drag) return undefined;
    if (i === drag.from) return { transform: `translateY(${drag.dy}px)`, zIndex: 5, position: "relative", transition: "none" };
    let shift = 0;
    if (drag.from < drag.to && i > drag.from && i <= drag.to) shift = -drag.h;
    if (drag.from > drag.to && i >= drag.to && i < drag.from) shift = drag.h;
    return { transform: `translateY(${shift}px)`, transition: "transform 160ms cubic-bezier(0.22,1,0.36,1)" };
  };

  return {
    bindList: (el: HTMLElement | null) => {
      listRef.current = el;
    },
    handle: (i: number) => ({ onPointerDown: onPointerDown(i), onKeyDown: onKeyDown(i), style: { touchAction: "none" as const } }),
    rowStyle,
    dragging: drag ? drag.from : null,
  };
}

/** Move one element of an array. */
export function arrayMove<T>(arr: T[], from: number, to: number): T[] {
  const next = arr.slice();
  const [x] = next.splice(from, 1);
  next.splice(to, 0, x);
  return next;
}
