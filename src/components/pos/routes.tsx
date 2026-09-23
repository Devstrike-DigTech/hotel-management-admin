"use client";

import { PosRoute } from "@/components/gating/feature-routes";
import { RequireCap } from "@/components/gating/require-cap";
import { TerminalShell } from "./terminal-shell";
import { PosTerminal } from "./terminal";
import { KdsView } from "./kds-view";

export function PosTerminalRoute() {
  return (
    <TerminalShell feature="pos" locked={<PosRoute />}>
      <RequireCap cap="pos.view" what="The till">
        <PosTerminal />
      </RequireCap>
    </TerminalShell>
  );
}

export function KdsRoute() {
  return (
    <TerminalShell feature="pos" locked={<PosRoute />} dark>
      <RequireCap cap="kds.view" what="The kitchen display">
        <KdsView />
      </RequireCap>
    </TerminalShell>
  );
}
