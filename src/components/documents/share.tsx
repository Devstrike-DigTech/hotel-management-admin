"use client";

import { useMutation } from "@tanstack/react-query";
import { LinkSimple, Printer, WhatsappLogo } from "@phosphor-icons/react";
import { documentsApi } from "@/lib/api/endpoints-m2";
import { toast } from "@/lib/store";
import { Button } from "@/components/ui/button";

/** Print, WhatsApp and copy-link actions for an invoice or receipt. */
export function DocumentActions({
  kind,
  id,
  size = "md",
  className,
}: {
  kind: "invoice" | "receipt";
  id: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const share = useMutation({
    mutationFn: (mode: "whatsapp" | "copy") =>
      (kind === "invoice" ? documentsApi.shareInvoice(id) : documentsApi.shareReceipt(id)).then((l) => ({ l, mode })),
    onSuccess: ({ l, mode }) => {
      if (mode === "whatsapp" && l.whatsappUrl) {
        window.open(l.whatsappUrl, "_blank", "noopener");
        return;
      }
      void navigator.clipboard?.writeText(l.url);
      toast.info(
        "Link copied",
        mode === "whatsapp" ? "No phone on file for this guest, so the link is on your clipboard." : `Valid until ${new Date(l.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}.`,
      );
    },
    meta: { errorTitle: "Couldn't create a share link" },
  });
  return (
    <div className={className ?? "flex flex-wrap gap-2"}>
      <Button size={size} variant="secondary" onClick={() => window.open(`/print/${kind}/${id}`, "_blank", "noopener")}>
        <Printer size={15} weight="duotone" /> Print
      </Button>
      <Button size={size} variant="secondary" onClick={() => share.mutate("whatsapp")} loading={share.isPending && share.variables === "whatsapp"}>
        <WhatsappLogo size={15} weight="duotone" /> WhatsApp
      </Button>
      <Button size={size} variant="ghost" onClick={() => share.mutate("copy")} loading={share.isPending && share.variables === "copy"}>
        <LinkSimple size={15} /> Copy link
      </Button>
    </div>
  );
}
