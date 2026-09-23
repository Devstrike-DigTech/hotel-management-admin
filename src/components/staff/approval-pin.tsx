"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Key } from "@phosphor-icons/react";
import { pinApi } from "@/lib/api/endpoints-m2";
import { qk } from "@/lib/api/hooks";
import { qk2 } from "@/lib/api/hooks-m2";
import { toast } from "@/lib/store";
import { Dialog } from "@/components/ui/overlay";
import { Button } from "@/components/ui/button";
import { Field, PasswordInput } from "@/components/ui/form";
import { PinInput } from "@/components/folio/folio-dialogs";

/** Owners and managers set the PIN they use as the second key on large discounts. */
export function ApprovalPinDialog({ open, onOpenChange, hasPin }: { open: boolean; onOpenChange: (o: boolean) => void; hasPin?: boolean }) {
  const qc = useQueryClient();
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [password, setPassword] = useState("");
  const done = async (msg: string) => {
    await Promise.all([qc.invalidateQueries({ queryKey: qk.me }), qc.invalidateQueries({ queryKey: qk2.approvers })]);
    toast.success(msg);
    setPin("");
    setConfirm("");
    setPassword("");
    onOpenChange(false);
  };
  const save = useMutation({
    mutationFn: () => {
      if (pin.length < 4) throw new Error("A PIN is 4 to 6 digits");
      if (pin !== confirm) throw new Error("The two PINs don't match");
      return pinApi.set(pin, password);
    },
    onSuccess: () => done("Approval PIN saved"),
    meta: { errorTitle: "PIN not saved" },
  });
  const remove = useMutation({ mutationFn: pinApi.remove, onSuccess: () => done("Approval PIN removed"), meta: { errorTitle: "PIN not removed" } });
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      eyebrow="Second key"
      title={hasPin ? "Change your approval PIN" : "Set your approval PIN"}
      description="You enter it on the front desk screen to approve discounts above the threshold. Never share it; it is stamped on every approval."
      footer={
        <>
          {hasPin && (
            <Button variant="ghost" className="mr-auto text-danger" onClick={() => remove.mutate()} loading={remove.isPending}>
              Remove PIN
            </Button>
          )}
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={!password}>
            <Key size={15} weight="bold" /> Save PIN
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink">New PIN</p>
          <PinInput value={pin} onChange={setPin} />
        </div>
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink">Type it again</p>
          <PinInput value={confirm} onChange={setConfirm} />
        </div>
        <Field label="Your password" htmlFor="pin-pass" hint="To confirm it's you.">
          <PasswordInput id="pin-pass" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>
      </div>
    </Dialog>
  );
}
