"use client";

import { ErrorState } from "@/components/ui/primitives";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[70dvh] items-center justify-center px-6">
      <ErrorState title="Something slipped behind the desk" error={error} onRetry={reset} />
    </main>
  );
}
