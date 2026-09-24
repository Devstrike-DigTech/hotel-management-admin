"use client";

import { Code, FileZip, Fingerprint, Palette } from "@phosphor-icons/react";
import { FeaturePage } from "@/components/gating/feature-page";
import { RequireCap } from "@/components/gating/require-cap";
import { ApiKeysView } from "@/components/developers/api-keys-view";
import { WebhooksView } from "@/components/developers/webhooks-view";
import { QuickStartView } from "@/components/developers/quick-start";
import { WhiteLabelView } from "@/components/whitelabel/whitelabel-view";
import { SsoView } from "@/components/sso/sso-view";
import { ExportView } from "@/components/export/export-view";
import { SupportThread, SupportView } from "@/components/support/support-view";
import { ApiPreview, ExportPreview, SsoPreview, WhiteLabelPreview } from "./previews";

function ApiGate({ children }: { children: React.ReactNode }) {
  return (
    <FeaturePage
      feature="api_access"
      icon={Code}
      name="API & webhooks"
      title={
        <>
          Your systems, <em>plugged straight in</em>.
        </>
      }
      pitch="A partner API and signed webhooks so your booking engine, BI dashboards and door locks see the same rooms, rates and reservations as the desk."
      bullets={["Keys with scopes, property limits, IP allowlists and expiry", "Test keys that never charge or message anyone", "Signed webhooks, retried for 24 hours, replayable", "Documented reference with examples in Node, PHP and Python"]}
      preview={<ApiPreview />}
    >
      <RequireCap cap="integrations.view" what="API keys and webhooks">
        {children}
      </RequireCap>
    </FeaturePage>
  );
}

export function DevelopersRoute({ page }: { page: "start" | "keys" | "webhooks" }) {
  return <ApiGate>{page === "keys" ? <ApiKeysView /> : page === "webhooks" ? <WebhooksView /> : <QuickStartView />}</ApiGate>;
}

export function WhiteLabelRoute() {
  return (
    <FeaturePage
      feature="white_label"
      icon={Palette}
      name="White label"
      title={
        <>
          Only <em>your</em> name on it.
        </>
      }
      pitch="Your logo, colours and type on the booking site and the staff sign-in, guest email from your own domain, texts from your own sender name, and staff signing in at your own address."
      bullets={["Brand kit with contrast checks and a live preview", "Email from your domain, with the DNS records to copy", "SMS sender ID requested for you", "Staff portal at staff.yourhotel.com"]}
      preview={<WhiteLabelPreview />}
    >
      <RequireCap cap="whitelabel.manage" what="White label">
        <WhiteLabelView />
      </RequireCap>
    </FeaturePage>
  );
}

export function SsoRoute() {
  return (
    <FeaturePage
      feature="sso"
      icon={Fingerprint}
      name="Single sign-on"
      title={
        <>
          One company login, <em>one off-switch</em>.
        </>
      }
      pitch="Staff sign in with Google Workspace or Microsoft; when someone leaves and IT closes their account, they are out of the hotel too."
      bullets={["Google Workspace, Microsoft Entra ID or any OIDC provider", "New staff created on first sign-in, with a role you choose", "Require SSO, with a break-glass owner", "Test before you switch it on"]}
      preview={<SsoPreview />}
    >
      <RequireCap cap="sso.manage" what="Single sign-on">
        <SsoView />
      </RequireCap>
    </FeaturePage>
  );
}

export function ExportRoute() {
  return (
    <FeaturePage
      feature="data_export"
      icon={FileZip}
      name="Data export"
      title={
        <>
          Everything, <em>in one file</em>.
        </>
      }
      pitch="Every record the hotel keeps here in one zip, as JSON and spreadsheets with a README, whenever you want it."
      bullets={["Guests, bookings, folios, payments, stock and the audit log", "JSON for developers, CSV for spreadsheets", "A signed link, valid for 24 hours", "Every request and download audited"]}
      preview={<ExportPreview />}
    >
      <RequireCap cap="data.export" what="The data export">
        <ExportView />
      </RequireCap>
    </FeaturePage>
  );
}

export function SupportRoute({ id }: { id?: string }) {
  return <RequireCap cap="support.request" what="Support">{id ? <SupportThread id={id} /> : <SupportView />}</RequireCap>;
}
