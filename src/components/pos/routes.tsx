"use client";

import { PosRoute } from "@/components/gating/feature-routes";
import { RequireCap } from "@/components/gating/require-cap";
import { useCan } from "@/lib/permissions";
import { TerminalShell } from "./terminal-shell";
import { PosTerminal } from "./terminal";
import { KdsView } from "./kds-view";
import { FeaturePage } from "@/components/gating/feature-page";
import { PosTerminalPreview } from "@/components/m5/previews";
import { CashRegister } from "@phosphor-icons/react";
import { MenuAdmin } from "./menu-admin";
import { StockAdmin } from "./stock-admin";
import { PosReports } from "./pos-reports";

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

function PosBackOffice({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <FeaturePage
      feature="pos"
      icon={CashRegister}
      name={name}
      title={
        <>
          Every chapman, <em>on the right folio</em>.
        </>
      }
      pitch="Menus with options and happy hours, stock that counts itself down as the tills sell, minibars charged to the room, and sales by outlet, item and hour."
      bullets={["Menus, modifiers and happy hours per outlet", "Deliveries, counts and variance flagged in Revenue Guard", "Minibar par levels per room type", "Sales, voids and cashiers in one report"]}
      preview={<PosTerminalPreview />}
    >
      {children}
    </FeaturePage>
  );
}

export function MenuRoute() {
  return (
    <PosBackOffice name="Menu & outlets">
      <RequireCap cap="pos.view" what="The menu">
        <MenuAdmin />
      </RequireCap>
    </PosBackOffice>
  );
}

export function StockRoute() {
  return (
    <PosBackOffice name="Stock & minibar">
      <StockGate />
    </PosBackOffice>
  );
}

function StockGate() {
  const { can } = useCan();
  // housekeepers who only record minibar use get the minibar tab on its own
  return can("minibar.record") && !can("stock.view") ? (
    <StockAdmin />
  ) : (
    <RequireCap cap="stock.view" what="Stock">
      <StockAdmin />
    </RequireCap>
  );
}

export function PosReportsRoute() {
  return (
    <PosBackOffice name="Outlet sales">
      <RequireCap cap="pos.view" what="Outlet sales">
        <PosReports />
      </RequireCap>
    </PosBackOffice>
  );
}
