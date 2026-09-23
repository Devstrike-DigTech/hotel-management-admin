"use client";

import { CheckCircle, Info, WarningCircle, WarningOctagon, X } from "@phosphor-icons/react";
import { dismissToast, toastStore, useStore, type ToastTone } from "@/lib/store";
import { cn } from "@/lib/cn";

const toneMeta: Record<ToastTone, { icon: React.ReactNode; bar: string }> = {
  success: { icon: <CheckCircle size={18} weight="duotone" className="text-palm" />, bar: "var(--palm)" },
  error: { icon: <WarningOctagon size={18} weight="duotone" className="text-danger" />, bar: "var(--danger)" },
  warning: { icon: <WarningCircle size={18} weight="duotone" className="text-ochre" />, bar: "var(--ochre)" },
  neutral: { icon: <Info size={18} weight="duotone" className="text-adire" />, bar: "var(--adire)" },
};

/** In-system toasts: printed-receipt slips with a coloured tear-edge. */
export function Toaster() {
  const toasts = useStore(toastStore);
  return (
    <div
      aria-live="polite"
      aria-relevant="additions"
      className="pointer-events-none fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-3 right-3 z-[70] flex flex-col items-center gap-2 sm:bottom-5 sm:left-auto sm:right-5 sm:items-end"
    >
      {toasts.map((t) => {
        const m = toneMeta[t.tone];
        return (
          <div
            key={t.id}
            role={t.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-md border border-line bg-surface py-3 pl-4 pr-2.5 shadow-float",
              "animate-[rise_220ms_cubic-bezier(0.22,1,0.36,1)]",
            )}
          >
            <span aria-hidden className="absolute inset-y-0 left-0 w-[3px]" style={{ background: m.bar }} />
            <span className="mt-px shrink-0">{m.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13.5px] font-medium leading-snug text-ink">{t.title}</p>
              {t.body && <p className="mt-0.5 text-[12.5px] leading-snug text-ink-muted">{t.body}</p>}
              {t.action && (
                <button
                  className="mt-1.5 text-[12.5px] font-medium text-laterite underline-offset-4 hover:underline"
                  onClick={() => {
                    t.action?.onClick();
                    dismissToast(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              aria-label="Dismiss"
              onClick={() => dismissToast(t.id)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-sm text-ink-faint hover:bg-surface-2 hover:text-ink"
            >
              <X size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
