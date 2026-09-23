import clsx, { type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      color: [
        "paper", "surface", "surface-2", "ink", "ink-muted", "ink-faint", "line", "line-strong",
        "laterite", "laterite-hover", "laterite-ink", "laterite-wash", "brass", "brass-wash",
        "palm", "palm-wash", "adire", "adire-wash", "ochre", "ochre-wash", "danger", "danger-wash", "rack",
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
