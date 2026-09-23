"use client";

import * as D from "@radix-ui/react-dialog";
import { X } from "@phosphor-icons/react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./button";

const overlayCls =
  "fixed inset-0 z-50 bg-[color-mix(in_oklab,var(--ink)_28%,transparent)] data-[state=open]:animate-[fade_180ms_ease-out] dark:bg-[rgb(0_0_0/0.6)]";

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  eyebrow,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  eyebrow?: React.ReactNode;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className={overlayCls} />
        <D.Content
          className={cn(
            "fixed left-1/2 top-1/2 z-50 flex max-h-[88dvh] w-[calc(100vw-24px)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-float outline-none",
            "data-[state=open]:animate-[dialog-in_220ms_cubic-bezier(0.22,1,0.36,1)]",
            className,
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-5">
            <div>
              {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
              <D.Title className="display-sm text-[22px] leading-tight text-ink">{title}</D.Title>
              {description ? (
                <D.Description className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">
                  {description}
                </D.Description>
              ) : (
                <D.Description className="sr-only">{typeof title === "string" ? title : "Dialog"}</D.Description>
              )}
            </div>
            <D.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X size={16} />
              </Button>
            </D.Close>
          </div>
          {children && <div className="scrollbar-thin overflow-y-auto px-6 py-5">{children}</div>}
          {footer && (
            <div className="flex flex-col-reverse gap-2 border-t border-line bg-surface-2/40 px-6 py-3.5 sm:flex-row sm:justify-end">
              {footer}
            </div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** Right-side sheet on desktop; bottom sheet on phones. */
export function Sheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  eyebrow,
  className,
  width = "max-w-md",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  eyebrow?: React.ReactNode;
  className?: string;
  width?: string;
}) {
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className={overlayCls} />
        <D.Content
          className={cn(
            "fixed z-50 flex flex-col border-line bg-surface shadow-float outline-none",
            "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-lg border-t data-[state=open]:animate-[sheet-up_240ms_cubic-bezier(0.22,1,0.36,1)]",
            "sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-full sm:rounded-none sm:border-l sm:border-t-0 sm:data-[state=open]:animate-[sheet-in_240ms_cubic-bezier(0.22,1,0.36,1)]",
            width,
            className,
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong sm:hidden" aria-hidden />
          <div className="flex items-start justify-between gap-4 border-b border-line px-6 pb-4 pt-4 sm:pt-6">
            <div className="min-w-0">
              {eyebrow && <div className="eyebrow mb-1.5">{eyebrow}</div>}
              <D.Title className="display-sm text-[22px] leading-tight text-ink">{title}</D.Title>
              {description ? (
                <D.Description className="mt-1 text-[13.5px] text-ink-muted">{description}</D.Description>
              ) : (
                <D.Description className="sr-only">{typeof title === "string" ? title : "Panel"}</D.Description>
              )}
            </div>
            <D.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close">
                <X size={16} />
              </Button>
            </D.Close>
          </div>
          <div className="scrollbar-thin flex-1 overflow-y-auto px-6 py-5">{children}</div>
          {footer && (
            <div className="flex gap-2 border-t border-line bg-surface-2/40 px-6 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          )}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirmLabel = "Confirm",
  danger,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => Promise<unknown> | void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={body}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
                onOpenChange(false);
              } catch {
                /* surfaced by the global mutation handler */
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
