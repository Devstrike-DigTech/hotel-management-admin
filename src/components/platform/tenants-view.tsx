"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Buildings, CaretLeft, CaretRight, MagnifyingGlass } from "@phosphor-icons/react";
import { usePlatformTenants } from "@/lib/api/hooks";
import { PLAN_NAMES, PLAN_ORDER, SUB_STATUS, SUB_STATUS_ORDER } from "@/lib/catalog";
import { daysUntil, formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/form";
import { Badge, EmptyState, ErrorState, PageHeader, Panel, PlanPlate, Skeleton } from "@/components/ui/primitives";
import { Th } from "@/components/ui/table";

export function TenantsView() {
  const params = useSearchParams();
  const router = useRouter();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [debounced, setDebounced] = useState(q);
  const [plan, setPlan] = useState(params.get("plan") ?? "");
  const [status, setStatus] = useState(params.get("status") ?? "");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const id = setTimeout(() => {
      setDebounced(q);
      setPage(1);
    }, 250);
    return () => clearTimeout(id);
  }, [q]);

  const tenants = usePlatformTenants({ q: debounced || undefined, plan: plan || undefined, status: status || undefined, page });
  const items = tenants.data?.items ?? [];
  const total = tenants.data?.total ?? 0;
  const pageSize = tenants.data?.pageSize ?? Math.max(items.length, 20);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            <Buildings size={14} weight="duotone" /> Tenants
          </>
        }
        title={
          <>
            Every hotel, <em>every plan</em>.
          </>
        }
        description="Search by name or slug. Open a tenant to change its plan, status, trial or add-ons."
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <MagnifyingGlass size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search hotels" className="pl-9" aria-label="Search tenants" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:w-[340px]">
          <Select aria-label="Plan" value={plan} onChange={(e) => (setPlan(e.target.value), setPage(1))}>
            <option value="">All plans</option>
            {PLAN_ORDER.map((p) => (
              <option key={p} value={p}>
                {PLAN_NAMES[p]}
              </option>
            ))}
          </Select>
          <Select aria-label="Status" value={status} onChange={(e) => (setStatus(e.target.value), setPage(1))}>
            <option value="">All statuses</option>
            {SUB_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {SUB_STATUS[s].label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <Panel className="overflow-hidden">
        {tenants.isLoading ? (
          <div className="flex flex-col gap-3 p-5">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-9" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
        ) : tenants.isError ? (
          <ErrorState error={tenants.error} onRetry={() => tenants.refetch()} />
        ) : !items.length ? (
          <EmptyState glyph="dots" title="No hotels match" body="Try a different name, plan or status." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left text-[13.5px]">
              <thead>
                <tr className="border-b border-line">
                  <Th className="pl-5">Hotel</Th>
                  <Th>City</Th>
                  <Th>Plan</Th>
                  <Th>Status</Th>
                  <Th className="text-right">Rooms</Th>
                  <Th className="text-right">Staff</Th>
                  <Th className="pl-6">Joined</Th>
                  <Th className="pr-5">Trial</Th>
                </tr>
              </thead>
              <tbody className={tenants.isFetching ? "opacity-70 transition-opacity" : ""}>
                {items.map((t) => {
                  const left = t.status === "TRIALING" ? daysUntil(t.trialEndsAt) : null;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => router.push(`/platform/tenants/${t.id}`)}
                      className="cursor-pointer border-b border-line last:border-b-0 hover:bg-surface-2/50"
                    >
                      <td className="py-3 pl-5">
                        <a
                          href={`/platform/tenants/${t.id}`}
                          onClick={(e) => {
                            e.preventDefault();
                            router.push(`/platform/tenants/${t.id}`);
                          }}
                          className="font-medium text-ink hover:underline"
                        >
                          {t.name}
                        </a>
                        <span className="block font-mono text-[11.5px] text-ink-faint">{t.slug}</span>
                      </td>
                      <td className="py-3 text-ink-muted">{t.city ?? "-"}</td>
                      <td className="py-3">
                        <PlanPlate name={PLAN_NAMES[t.planCode] ?? t.planCode} code={t.planCode} />
                      </td>
                      <td className="py-3">
                        <Badge tone={SUB_STATUS[t.status]?.tone ?? "neutral"} dot>
                          {SUB_STATUS[t.status]?.label ?? t.status}
                        </Badge>
                      </td>
                      <td className="py-3 text-right font-mono text-ink">{t.rooms}</td>
                      <td className="py-3 text-right font-mono text-ink">{t.staff}</td>
                      <td className="py-3 pl-6 text-ink-muted">{formatDate(t.createdAt)}</td>
                      <td className="py-3 pr-5 font-mono text-[12.5px]">
                        {left !== null ? (
                          <span className={left <= 3 ? "text-laterite" : "text-ink"}>{left}d left</span>
                        ) : (
                          <span className="text-ink-faint">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {total > 0 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3">
            <span className="font-mono text-[12px] text-ink-muted">
              {total} {total === 1 ? "hotel" : "hotels"}
            </span>
            {pages > 1 && (
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="icon-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                  <CaretLeft size={14} />
                </Button>
                <span className="font-mono text-[12px] text-ink-muted">
                  {page} / {pages}
                </span>
                <Button variant="secondary" size="icon-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                  <CaretRight size={14} />
                </Button>
              </div>
            )}
          </div>
        )}
      </Panel>
    </>
  );
}
