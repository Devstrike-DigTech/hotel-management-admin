"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { conciergeApi } from "@/lib/api/endpoints-m8";
import { qk8 } from "@/lib/api/hooks-m8";
import type { PaymentMethod, RequestDetail, RequestListItem, RequestStatus } from "@/lib/api/types-m8";
import { deskAction } from "@/lib/offline/desk-action";
import { useEntitlements } from "@/lib/auth";
import { toast } from "@/lib/store";
import { STATUS } from "./catalog";

/** A label for toasts and the outbox that never names a private request's service. */
export const safeTitle = (r: Pick<RequestListItem, "number" | "discreet" | "masked" | "title">) => (r.discreet || r.masked ? `${r.number}, private` : `${r.number} ${r.title}`);

export function useRequestActions() {
  const qc = useQueryClient();
  const { has } = useEntitlements();
  const refresh = (r?: RequestDetail | null) => {
    void qc.invalidateQueries({ queryKey: qk8.board });
    void qc.invalidateQueries({ queryKey: qk8.requestsAll });
    void qc.invalidateQueries({ queryKey: qk8.today });
    if (r) qc.setQueryData(qk8.request(r.id), r);
    return r;
  };

  /**
   * Progress (schedule, start, complete) goes through the offline outbox: the Idempotency-Key and
   * clientCreatedAt are fixed when the button is pressed, and the change replays when the line is back.
   */
  const progress = useMutation({
    mutationFn: async (v: { r: RequestListItem; status: RequestStatus; note?: string; vendorRating?: number }) => {
      const res = await deskAction<RequestDetail>({
        kind: "concierge",
        title: v.status === "COMPLETED" ? "Complete request" : `Mark ${STATUS[v.status].label.toLowerCase()}`,
        subtitle: safeTitle(v.r),
        method: "POST",
        path: conciergeApi.statusPath(v.r.id),
        body: { status: v.status, ...(v.note ? { note: v.note } : {}), ...(v.vendorRating ? { vendorRating: v.vendorRating } : {}) },
        offlineAllowed: has("offline_mode"),
        invalidate: [["concierge"]],
      });
      return { res, v };
    },
    onSuccess: ({ res, v }) => {
      if (res.queued) {
        toast.warning("Saved on this device", `${safeTitle(v.r)} will update when the connection is back.`);
        qc.setQueryData(qk8.request(v.r.id), (old: RequestDetail | undefined) => (old ? { ...old, status: v.status } : old));
        return;
      }
      refresh(res.result);
      toast.success(STATUS[res.result.status].label, safeTitle(res.result));
    },
    meta: { errorTitle: "Not updated" },
  });

  const confirm = useMutation({
    mutationFn: (v: { id: string; paymentMethod: PaymentMethod; note?: string }) => conciergeApi.confirm(v.id, { paymentMethod: v.paymentMethod, note: v.note }),
    onSuccess: (r) => {
      refresh(r);
      toast.success(r.status === "AWAITING_GUEST" ? "Payment link sent" : "Confirmed", `${safeTitle(r)}. The guest has been told.`);
    },
    meta: { errorTitle: "Not confirmed" },
  });

  const quote = useMutation({
    mutationFn: (v: { id: string; amountKobo: number; taxable: boolean; validHours: number; note: string | null }) =>
      conciergeApi.quote(v.id, { amountKobo: v.amountKobo, taxable: v.taxable, validHours: v.validHours, note: v.note ?? undefined }),
    onSuccess: (r) => {
      refresh(r);
      toast.success("Quote sent", `${safeTitle(r)}. The guest can accept from the link or reply YES.`);
    },
    meta: { errorTitle: "Quote not sent" },
  });

  const assign = useMutation({
    mutationFn: (v: { id: string; assigneeId?: string | null; vendorId?: string | null }) => conciergeApi.assign(v.id, { assigneeId: v.assigneeId, vendorId: v.vendorId }),
    onSuccess: (r) => {
      refresh(r);
      toast.success("Assigned", r.vendor ? `${r.vendor.name} has ${r.number}.` : r.assignee ? `${r.assignee.fullName} has ${r.number}.` : `${r.number} is unassigned.`);
    },
    meta: { errorTitle: "Not assigned" },
  });

  const decline = useMutation({
    mutationFn: (v: { id: string; reason: string; cancel?: boolean }) => conciergeApi.setStatus(v.id, { status: v.cancel ? "CANCELLED" : "DECLINED", note: v.reason }),
    onSuccess: (r) => {
      refresh(r);
      toast.success(r.status === "CANCELLED" ? "Cancelled" : "Declined", `${r.number}. The guest has been told, kindly.`);
    },
    meta: { errorTitle: "Not declined" },
  });

  const flagReview = useMutation({
    mutationFn: (v: { id: string; decision: "CLEAR" | "DECLINE"; note: string }) => conciergeApi.flagReview(v.id, v.decision, v.note),
    onSuccess: (r) => {
      refresh(r);
      toast.success(r.status === "DECLINED" ? "Declined" : "Cleared", r.status === "DECLINED" ? "The guest was told, in neutral words." : "It carries on like any other request.");
    },
    meta: { errorTitle: "Not reviewed" },
  });

  const note = useMutation({
    mutationFn: (v: { id: string; text: string }) => conciergeApi.note(v.id, v.text),
    onSuccess: (r) => refresh(r),
    meta: { errorTitle: "Note not saved" },
  });

  return { progress, confirm, quote, assign, decline, flagReview, note, refresh };
}
