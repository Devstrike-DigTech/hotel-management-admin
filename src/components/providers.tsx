"use client";

import { MutationCache, QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { useState } from "react";
import { isApiError } from "@/lib/api/client";
import { openUpgrade, readOnlyStore, toast } from "@/lib/store";
import { Toaster } from "@/components/ui/toaster";
import { UpgradeDialog } from "@/components/gating/upgrade-dialog";
import { StatusPatternDefs } from "@/components/keyrack/status-swatch";

export interface MutationMeta extends Record<string, unknown> {
  /** Title for the error toast; message comes from the API. */
  errorTitle?: string;
  /** Suppress the global error toast (the component handles it). */
  silent?: boolean;
}

/** Route entitlement errors to the upgrade dialog; everything else to a toast. */
function handleMutationError(error: unknown, meta?: MutationMeta) {
  if (isApiError(error)) {
    const d = (error.details ?? {}) as Record<string, unknown>;
    if (error.code === "FEATURE_LOCKED") {
      openUpgrade({
        kind: "feature",
        feature: String(d.feature ?? ""),
        requiredPlan: d.requiredPlan ? String(d.requiredPlan) : undefined,
        message: error.message,
      });
      return;
    }
    if (error.code === "LIMIT_REACHED") {
      openUpgrade({
        kind: "limit",
        limit: String(d.limit ?? ""),
        max: typeof d.max === "number" ? d.max : undefined,
        current: typeof d.current === "number" ? d.current : undefined,
        upgradePlan: d.upgradePlan ? String(d.upgradePlan) : undefined,
        message: error.message,
      });
      return;
    }
    if (error.code === "SUBSCRIPTION_READ_ONLY") {
      readOnlyStore.set(true);
      openUpgrade({ kind: "readonly", message: error.message });
      return;
    }
  }
  if (meta?.silent) return;
  toast.error(meta?.errorTitle ?? "That didn't save", isApiError(error) ? error.message : undefined);
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        queryCache: new QueryCache({
          onError: (error) => {
            if (isApiError(error) && error.code === "SUBSCRIPTION_READ_ONLY") readOnlyStore.set(true);
          },
        }),
        mutationCache: new MutationCache({
          onError: (error, _v, _c, mutation) => handleMutationError(error, mutation.meta as MutationMeta | undefined),
        }),
        defaultOptions: {
          queries: {
            staleTime: 15_000,
            refetchOnWindowFocus: true,
            retry: (count, error) => {
              if (isApiError(error) && error.status >= 400 && error.status < 500) return false;
              return count < 2;
            },
          },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <TooltipPrimitive.Provider delayDuration={250}>
        <StatusPatternDefs />
        {children}
        <UpgradeDialog />
        <Toaster />
      </TooltipPrimitive.Provider>
    </QueryClientProvider>
  );
}
