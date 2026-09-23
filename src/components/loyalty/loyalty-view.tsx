"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Crown, MagnifyingGlass, Plus, Trash, UserPlus } from "@phosphor-icons/react";
import { useCan } from "@/lib/permissions";
import { loyaltyApi } from "@/lib/api/endpoints-m5";
import { qk5, useLoyaltyMembers, useLoyaltyProgramme, useLoyaltySummary } from "@/lib/api/hooks-m5";
import { useGuests } from "@/lib/api/hooks-m2";
import type { LoyaltyProgramme, LoyaltyTier, TierColor } from "@/lib/api/types-m5";
import { formatDate, naira, number } from "@/lib/format";
import { toast } from "@/lib/store";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Dialog, Sheet, ConfirmDialog } from "@/components/ui/overlay";
import { Field, Input, Switch } from "@/components/ui/form";
import { TagInput } from "@/components/ui/tag-input";
import { EmptyState, ErrorState, PageHeader, Panel, PanelHeader, Segmented, Skeleton, Stat } from "@/components/ui/primitives";
import { TierBadge, TierLadder, tierLook } from "./parts";

type Tab = "overview" | "members" | "programme";

export function LoyaltyView() {
  const sp = useSearchParams();
  const router = useRouter();
  const tab = (sp.get("tab") as Tab) ?? "overview";
  const setTab = (t: Tab) => router.replace(t === "overview" ? "/loyalty" : `/loyalty?tab=${t}`, { scroll: false });
  const prog = useLoyaltyProgramme();
  const { can } = useCan();
  const [enrol, setEnrol] = useState(false);
  const name = prog.data?.name ?? "Loyalty";
  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Crown size={14} weight="duotone" /> Loyalty &middot; the whole group
          </>
        }
        title={
          <>
            {name.split(" ").slice(0, -1).join(" ")} <em>{name.split(" ").slice(-1)[0]}</em>.
          </>
        }
        description={
          prog.data
            ? `${prog.data.earnPointsPer1000} points for every ₦1,000 spent on rooms and at the outlets, taxes left out. A point is worth ${naira(prog.data.pointValueKobo)} off a bill at any of the group's hotels.`
            : "Points on every stay, tiers by nights, redeemed on the bill at any of the group's hotels."
        }
        actions={
          can("loyalty.redeem") || can("loyalty.manage") ? (
            <Button onClick={() => setEnrol(true)}>
              <UserPlus size={15} weight="bold" /> Enrol a guest
            </Button>
          ) : undefined
        }
      />
      <Segmented
        label="Loyalty sections"
        value={tab}
        onChange={setTab}
        className="mb-6"
        options={[
          { value: "overview", label: "Overview" },
          { value: "members", label: "Members" },
          ...(can("loyalty.manage") ? [{ value: "programme" as Tab, label: "Programme and tiers" }] : []),
        ]}
      />
      {prog.isError ? <ErrorState error={prog.error} onRetry={() => prog.refetch()} /> : tab === "members" ? <Members /> : tab === "programme" && prog.data ? <Programme p={prog.data} /> : <Overview p={prog.data} />}
      <EnrolDialog open={enrol} onOpenChange={setEnrol} />
    </>
  );
}

function Overview({ p }: { p?: LoyaltyProgramme }) {
  const s = useLoyaltySummary();
  const top = useLoyaltyMembers({ pageSize: 6 });
  if (!p || !s.data)
    return (
      <div className="grid gap-4 md:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
    );
  const d = s.data;
  const tiers = [...p.tiers].sort((a, b) => a.minNights - b.minNights);
  return (
    <div className="flex flex-col gap-5">
      <Panel className="grid grid-cols-2 gap-6 p-5 sm:p-6 lg:grid-cols-4">
        <Stat label="Members" value={number(d.members)} sub={`across ${tiers.length} tiers`} />
        <Stat label="Points out there" value={<span data-testid="points-outstanding">{number(d.pointsOutstanding)}</span>} sub={`${naira(d.liabilityKobo)} owed in discounts`} />
        <Stat label="Earned, 30 days" value={number(d.earned30d)} sub={`${number(d.redeemed30d)} redeemed`} />
        <Stat label="Expiring soon" value={number(d.expiringNext60d)} sub={`in the next 60 days${p.expiryMonths ? `, after ${p.expiryMonths} months` : ""}`} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Panel>
          <PanelHeader eyebrow="Tiers" title="Nights decide the tier" description="Counted over the last 12 months at every property of the group, recomputed each night." />
          <div className="px-5 pb-5 pt-6">
            <TierLadder tiers={tiers.map((t) => ({ id: t.id, name: t.name, color: t.color, minNights: t.minNights, bonusPct: t.bonusBps / 100, perks: t.perks, members: t.members }))} />
          </div>
          <ul className="grid gap-px border-t border-line bg-line sm:grid-cols-3">
            {tiers.map((t) => {
              const look = tierLook(t.color);
              return (
                <li key={t.id} className="bg-surface p-4">
                  <TierBadge name={t.name} color={t.color} />
                  <p className="mt-2 text-[12px] text-ink-muted">
                    {t.minNights ? `${t.minNights}+ nights` : "On joining"}
                    {t.bonusBps ? ` · ${t.bonusBps / 100}% bonus points` : ""}
                  </p>
                  <ul className="mt-2 flex flex-col gap-1">
                    {t.perks.map((perk) => (
                      <li key={perk} className="flex gap-2 text-[12.5px] leading-snug text-ink">
                        <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full" style={{ background: look.ink }} aria-hidden />
                        {perk}
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        </Panel>
        <Panel>
          <PanelHeader
            eyebrow="Most points"
            title="The regulars"
            actions={
              <Link href="/loyalty?tab=members" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-laterite hover:underline">
                All members <ArrowRight size={12} />
              </Link>
            }
          />
          <ul>
            {(top.data?.items ?? []).map((m) => (
              <li key={m.id} className="border-b border-line last:border-b-0">
                <Link href={`/loyalty/members/${m.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-medium text-ink">{m.guest.fullName}</span>
                    <span className="font-mono text-[11px] text-ink-muted">{m.memberNo}</span>
                  </span>
                  {m.tier && <TierBadge name={m.tier.name} color={m.tier.color} />}
                  <span className="w-20 text-right font-mono text-[13px] text-ink">{number(m.points)}</span>
                </Link>
              </li>
            ))}
            {top.isLoading && <Skeleton className="m-5 h-40" />}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

function Members() {
  const [q, setQ] = useState("");
  const [tierId, setTierId] = useState("");
  const [page, setPage] = useState(1);
  const prog = useLoyaltyProgramme();
  const list = useLoyaltyMembers({ q: q.trim() || undefined, tierId: tierId || undefined, page, pageSize: 25 });
  const items = list.data?.items ?? [];
  const pages = Math.max(1, Math.ceil((list.data?.total ?? 0) / 25));
  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-line p-3 sm:px-5">
        <label className="relative flex min-w-[220px] flex-1 items-center sm:max-w-sm">
          <MagnifyingGlass size={15} className="pointer-events-none absolute left-2.5 text-ink-muted" />
          <span className="sr-only">Search members</span>
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder="Name, phone or member number" className="h-9 w-full rounded-md border border-line-strong bg-surface pl-8 pr-2 text-[16px] outline-none focus:border-laterite sm:text-[13.5px]" />
        </label>
        <div className="flex flex-wrap gap-1.5">
          {[{ id: "", name: "Every tier", color: null as string | null }, ...(prog.data?.tiers ?? []).map((t) => ({ id: t.id, name: t.name, color: t.color as string | null }))].map((t) => (
            <button key={t.id || "all"} type="button" aria-pressed={tierId === t.id} onClick={() => { setTierId(t.id); setPage(1); }} className={cn("h-8 rounded-full border px-3 text-[12.5px] font-medium", tierId === t.id ? "border-ink bg-ink text-paper" : "border-line-strong text-ink-muted hover:text-ink")}>
              {t.name}
            </button>
          ))}
        </div>
      </div>
      {list.isLoading ? (
        <div className="flex flex-col gap-2 p-5">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-10" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState glyph="rings" title="No members match" body="Guests join at check-in, at the desk, or from their account on the booking site." />
      ) : (
        <div className="scrollbar-thin overflow-x-auto">
          <table className="w-full min-w-[720px] text-[13.5px]">
            <thead>
              <tr className="border-b border-line text-left">
                {["Member", "Tier", "Points", "Nights, 12 months", "Joined"].map((h, i) => (
                  <th key={h} className={cn("eyebrow px-5 py-2.5 text-[10px] font-normal", i === 2 && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((m) => (
                <tr key={m.id} className="border-b border-line last:border-b-0 hover:bg-surface-2/40">
                  <td className="px-5 py-2.5">
                    <Link href={`/loyalty/members/${m.id}`} className="font-medium text-ink hover:text-laterite" data-testid={`member-${m.memberNo}`}>
                      {m.guest.fullName}
                    </Link>
                    <span className="block font-mono text-[11px] text-ink-muted">{m.memberNo}</span>
                  </td>
                  <td className="px-5 py-2.5">{m.tier ? <TierBadge name={m.tier.name} color={m.tier.color} /> : <span className="text-ink-faint">none</span>}</td>
                  <td className="px-5 py-2.5 text-right">
                    <span className="font-mono text-ink">{number(m.points)}</span>
                    <span className="block font-mono text-[11px] text-ink-muted">{naira(m.valueKobo)}</span>
                  </td>
                  <td className="px-5 py-2.5">
                    <span className="font-mono text-ink">{m.nights12m}</span>
                    {m.nextTier && <span className="ml-2 text-[12px] text-ink-muted">{m.nextTier.nightsNeeded} to {m.nextTier.name}</span>}
                  </td>
                  <td className="px-5 py-2.5 text-[12.5px] text-ink-muted">
                    {formatDate(m.enrolledAt)}
                    <span className="block text-[11px] text-ink-faint">{m.enrolledVia === "ONLINE" ? "online" : m.enrolledVia === "CHECK_IN" ? "at check-in" : "at the desk"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-line px-5 py-2.5 text-[12.5px] text-ink-muted">
          <span>
            {number(list.data?.total ?? 0)} members &middot; page {page} of {pages}
          </span>
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="ghost" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </Panel>
  );
}

const COLORS: TierColor[] = ["palm", "adire", "brass", "laterite", "ochre"];

function Programme({ p }: { p: LoyaltyProgramme }) {
  const qc = useQueryClient();
  const [d, setD] = useState(p);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- adopt the saved programme
    setD(p);
  }, [p]);
  const [tier, setTier] = useState<Partial<LoyaltyTier> | null>(null);
  const [del, setDel] = useState<LoyaltyTier | null>(null);
  const dirty = JSON.stringify({ ...d, tiers: [] }) !== JSON.stringify({ ...p, tiers: [] });
  const save = useMutation({
    mutationFn: () => {
      const { tiers: _t, ...rest } = d;
      void _t;
      return loyaltyApi.saveProgramme(rest);
    },
    onSuccess: (r) => {
      qc.setQueryData(qk5.programme, r);
      toast.success("Programme saved", "New rules apply from the next check-out.");
    },
    meta: { errorTitle: "Not saved" },
  });
  const saveTier = useMutation({
    mutationFn: (t: Partial<LoyaltyTier>) => {
      const b = { name: t.name ?? "", minNights: t.minNights ?? 0, bonusBps: t.bonusBps ?? 0, perks: t.perks ?? [], color: (t.color ?? "ochre") as TierColor };
      return t.id ? loyaltyApi.updateTier(t.id, b) : loyaltyApi.createTier(b);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: qk5.loyalty });
      setTier(null);
      toast.success("Tier saved", "Members move up or down tonight when tiers are recomputed.");
    },
    meta: { errorTitle: "Tier not saved" },
  });
  const delTier = useMutation({ mutationFn: (t: LoyaltyTier) => loyaltyApi.deleteTier(t.id), onSuccess: () => void qc.invalidateQueries({ queryKey: qk5.loyalty }), meta: { errorTitle: "Tier not removed" } });
  const num = (k: keyof LoyaltyProgramme) => (e: React.ChangeEvent<HTMLInputElement>) => setD((x) => ({ ...x, [k]: Number(e.target.value.replace(/[^\d]/g, "") || 0) }));
  const stay = 8500000; // ₦85,000 a night, two nights
  const earn = Math.floor(((stay * 2) / 100 / 1000) * d.earnPointsPer1000);
  const silver = [...p.tiers].sort((a, b) => a.minNights - b.minNights)[1];
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_1fr]">
      <Panel>
        <PanelHeader eyebrow="Rules" title="Earning and spending" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Programme name" className="sm:col-span-2">
            <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
          </Field>
          <Field label="Points per ₦1,000" hint="On rooms and outlet charges, taxes excluded">
            <Input inputMode="numeric" value={d.earnPointsPer1000} onChange={num("earnPointsPer1000")} />
          </Field>
          <Field label="A point is worth" hint="Off a bill, in kobo: 100 = ₦1">
            <Input inputMode="numeric" value={d.pointValueKobo} onChange={num("pointValueKobo")} />
          </Field>
          <Field label="Smallest redemption" hint="points">
            <Input inputMode="numeric" value={d.minRedeemPoints} onChange={num("minRedeemPoints")} />
          </Field>
          <Field label="Most of a bill" hint="basis points: 5000 = half the bill">
            <Input inputMode="numeric" value={d.maxRedeemBps} onChange={num("maxRedeemBps")} />
          </Field>
          <Field label="Points expire after" hint="months; 0 = never">
            <Input inputMode="numeric" value={d.expiryMonths} onChange={num("expiryMonths")} />
          </Field>
          <Field label="Flag adjustments from" hint="points; Revenue Guard sees larger ones">
            <Input inputMode="numeric" value={d.adjustmentFlagPoints} onChange={num("adjustmentFlagPoints")} />
          </Field>
          <div className="sm:col-span-2">
            <Switch checked={d.enabled} onChange={(v) => setD({ ...d, enabled: v })} label="Programme on" description="Off: no points are earned; balances are kept." />
          </div>
          <div className="sm:col-span-2">
            <Switch checked={d.enrolOnline} onChange={(v) => setD({ ...d, enrolOnline: v })} label="Guests can join online" description="From their account or while booking on the booking site." />
          </div>
        </div>
        <div className="border-t border-line bg-paper/60 px-5 py-4 text-[13px] leading-relaxed text-ink">
          <p className="eyebrow mb-1 text-[10px]">Worked example</p>
          Two nights at ₦85,000 earn <span className="font-mono">{number(earn)}</span> points, worth <span className="font-mono">{naira(earn * d.pointValueKobo)}</span> on the next stay
          {silver ? (
            <>
              ; a {silver.name} member earns <span className="font-mono">{number(Math.floor(earn * (1 + silver.bonusBps / 10_000)))}</span>
            </>
          ) : null}
          .
        </div>
        <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
          <Button variant="ghost" disabled={!dirty} onClick={() => setD(p)}>
            Undo
          </Button>
          <Button disabled={!dirty} loading={save.isPending} onClick={() => save.mutate()}>
            Save rules
          </Button>
        </div>
      </Panel>

      <Panel>
        <PanelHeader
          eyebrow="Tiers"
          title="By nights in 12 months"
          actions={
            <Button size="sm" variant="secondary" onClick={() => setTier({ name: "", minNights: 0, bonusBps: 0, perks: [], color: "ochre" })}>
              <Plus size={14} weight="bold" /> Tier
            </Button>
          }
        />
        <ul className="flex flex-col gap-3 p-5">
          {[...p.tiers]
            .sort((a, b) => a.minNights - b.minNights)
            .map((t) => {
              const look = tierLook(t.color);
              return (
                <li key={t.id} className="rounded-md border p-4" style={{ background: look.plate, borderColor: look.edge }}>
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <TierBadge name={t.name} color={t.color} />
                      <p className="mt-2 text-[12.5px] text-ink-muted">
                        from <span className="font-mono text-ink">{t.minNights}</span> nights &middot; <span className="font-mono text-ink">{t.bonusBps / 100}%</span> bonus &middot; {number(t.members)} members
                      </p>
                      <p className="mt-1 text-[12.5px] text-ink">{t.perks.join(" · ") || <span className="text-ink-faint">No perks yet</span>}</p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => setTier(t)}>
                      Edit
                    </Button>
                    {t.minNights > 0 && (
                      <Button size="icon-sm" variant="ghost" aria-label={`Remove ${t.name}`} onClick={() => setDel(t)}>
                        <Trash size={14} />
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
        </ul>
      </Panel>

      <Sheet
        open={!!tier}
        onOpenChange={(o) => !o && setTier(null)}
        eyebrow="Tier"
        title={tier?.id ? `Edit ${tier.name}` : "New tier"}
        footer={
          <Button className="w-full" loading={saveTier.isPending} disabled={!tier?.name?.trim()} onClick={() => tier && saveTier.mutate(tier)}>
            Save tier
          </Button>
        }
      >
        {tier && (
          <div className="flex flex-col gap-4">
            <Field label="Name">
              <Input value={tier.name ?? ""} onChange={(e) => setTier({ ...tier, name: e.target.value })} placeholder="Gold" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="From nights">
                <Input inputMode="numeric" value={tier.minNights ?? 0} onChange={(e) => setTier({ ...tier, minNights: Number(e.target.value.replace(/\D/g, "") || 0) })} />
              </Field>
              <Field label="Bonus points" hint="percent">
                <Input inputMode="numeric" value={(tier.bonusBps ?? 0) / 100} onChange={(e) => setTier({ ...tier, bonusBps: Number(e.target.value.replace(/\D/g, "") || 0) * 100 })} />
              </Field>
            </div>
            <Field label="Perks" hint="Enter after each: late check-out, welcome drink ...">
              <TagInput value={tier.perks ?? []} onChange={(v) => setTier({ ...tier, perks: v })} placeholder="Late check-out to 2pm" />
            </Field>
            <div>
              <p className="mb-2 text-[13px] font-medium text-ink">Plate</p>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button key={c} type="button" aria-pressed={tier.color === c} aria-label={c} onClick={() => setTier({ ...tier, color: c })} className={cn("h-9 w-12 rounded-sm border", tier.color === c && "ring-2 ring-laterite ring-offset-2 ring-offset-surface")} style={{ background: tierLook(c).plate, borderColor: tierLook(c).edge }} />
                ))}
              </div>
            </div>
          </div>
        )}
      </Sheet>
      <ConfirmDialog open={!!del} onOpenChange={(o) => !o && setDel(null)} title={`Remove ${del?.name ?? "this tier"}?`} body="Its members move to the next tier down. Points are not touched." confirmLabel="Remove tier" danger onConfirm={() => (del ? delTier.mutateAsync(del) : undefined)} />
    </div>
  );
}

function EnrolDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const router = useRouter();
  const [q, setQ] = useState("");
  const guests = useGuests({ q: q.trim() || undefined, pageSize: 8 });
  const enrol = useMutation({
    mutationFn: (id: string) => loyaltyApi.enrol(id, "DESK"),
    onSuccess: (m) => {
      void qc.invalidateQueries({ queryKey: qk5.loyalty });
      toast.success(`${m.guest.fullName} is a member`, `Member number ${m.memberNo}.`);
      onOpenChange(false);
      router.push(`/loyalty/members/${m.id}`);
    },
    meta: { errorTitle: "Not enrolled" },
  });
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Enrol a guest" description="Points start with their next check-out at any of the group's hotels.">
      <label className="relative flex items-center">
        <MagnifyingGlass size={15} className="pointer-events-none absolute left-2.5 text-ink-muted" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Guest name or phone" className="h-10 w-full rounded-md border border-line-strong bg-surface pl-8 pr-2 text-[16px] outline-none focus:border-laterite sm:text-[14px]" aria-label="Find a guest" />
      </label>
      <ul className="mt-3 max-h-[320px] overflow-y-auto rounded-md border border-line">
        {(guests.data?.items ?? []).map((g) => (
          <li key={g.id} className="flex items-center gap-3 border-b border-line px-3 py-2.5 last:border-b-0">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14px] text-ink">{g.fullName}</span>
              <span className="font-mono text-[11.5px] text-ink-muted">{g.phone ?? g.email ?? ""}</span>
            </span>
            <Button size="sm" variant="secondary" onClick={() => enrol.mutate(g.id)} loading={enrol.isPending && enrol.variables === g.id}>
              Enrol
            </Button>
          </li>
        ))}
        {guests.data && !guests.data.items.length && <li className="px-3 py-6 text-center text-[13px] text-ink-muted">No guest matches.</li>}
      </ul>
    </Dialog>
  );
}
