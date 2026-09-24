"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/lib/api/hooks";
import { announcementsApi, impersonationApi } from "@/lib/api/endpoints-m6";
import { qk6, useAnnouncements } from "@/lib/api/hooks-m6";
import type { HotelAnnouncement, MeM6 } from "@/lib/api/types-m6";
import { session } from "@/lib/api/session";
import { useImpersonation } from "@/lib/auth";
import { config } from "@/lib/config";
import { roleLabel } from "@/lib/catalog";
import { supportBlockStore, useStore } from "@/lib/store";
import { rememberPage } from "@/components/support/new-request";
import { AnnouncementBar, ImpersonationBanner, ReadOnlyWriteNotice } from "./m6-banners";

/** The brand the shell shows: the hotel's own when white-label is active, else ours. */
export function useShellBrand() {
  const me = useMe();
  const wl = (me.data as unknown as MeM6 | undefined)?.whiteLabel;
  const active = !!wl?.active;
  return { whiteLabel: active, name: (active && wl?.brandName) || me.data?.tenant.name || "", logoUrl: active ? wl?.logoUrl ?? null : null };
}

/** The persistent support-session bar, shown above the top bar in the tab where the session is open. */
export function SupportSessionBar() {
  const imp = useImpersonation();
  const me = useMe();
  const router = useRouter();
  const qc = useQueryClient();
  const end = useMutation({
    mutationFn: impersonationApi.end,
    onSettled: () => {
      session.setImpersonation(null);
      qc.clear();
      router.replace("/impersonate?ended=1");
    },
    meta: { silent: true },
  });
  if (!imp) return null;
  const b = (me.data as unknown as MeM6 | undefined)?.impersonation ?? imp.banner;
  return (
    <ImpersonationBanner
      v={{
        operatorName: b.platformUserName,
        staffName: me.data?.user.fullName ?? imp.user.fullName,
        staffRole: me.data ? roleLabel(me.data.user) : imp.user.role,
        reason: b.reason,
        mode: b.mode,
        expiresAt: b.expiresAt,
      }}
      onEnd={() => end.mutate()}
      ending={end.isPending}
    />
  );
}

/** Keeps a support session honest: follows mode changes, ends it on expiry, explains refused writes. */
export function M6Runtime() {
  const imp = useImpersonation();
  const me = useMe();
  const router = useRouter();
  const pathname = usePathname();
  const qc = useQueryClient();
  const blocked = useStore(supportBlockStore);
  const [notice, setNotice] = useState(false);
  const brand = useShellBrand();

  // remember where people were, so a support request carries the page they need help with
  useEffect(() => rememberPage(pathname), [pathname]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- show the notice for each refused write
    if (blocked) setNotice(true);
  }, [blocked]);

  const banner = (me.data as unknown as MeM6 | undefined)?.impersonation;
  useEffect(() => {
    if (imp && banner) session.updateImpersonationBanner(banner);
  }, [imp, banner]);

  useEffect(() => {
    if (!imp) return;
    const ms = Date.parse(imp.expiresAt) - Date.now();
    const id = window.setTimeout(
      () => {
        session.setImpersonation(null);
        qc.clear();
        router.replace("/impersonate?ended=1");
      },
      Math.max(0, ms),
    );
    return () => window.clearTimeout(id);
  }, [imp, qc, router]);

  // white label: the hotel's name in the tab title instead of ours
  useEffect(() => {
    if (!brand.whiteLabel || !brand.name) return;
    const fix = () => {
      const t = document.title;
      if (t.includes(config.appName)) document.title = t.replace(`${config.appName} Admin`, brand.name).replace(config.appName, brand.name);
    };
    fix();
    const el = document.querySelector("title");
    if (!el) return;
    const mo = new MutationObserver(fix);
    mo.observe(el, { childList: true });
    return () => mo.disconnect();
  }, [brand.whiteLabel, brand.name, pathname]);

  return <ReadOnlyWriteNotice open={notice} onClose={() => setNotice(false)} operatorName={imp?.banner.platformUserName} />;
}

/** Active platform announcements for this user, newest first; dismissals are recorded. */
export function AnnouncementBars() {
  const q = useAnnouncements();
  const qc = useQueryClient();
  const seen = useRef(new Set<string>());
  const imp = useImpersonation();
  const [all, setAll] = useState(false);
  const dismiss = useMutation({
    mutationFn: (id: string) => announcementsApi.dismiss(id),
    onMutate: (id) => qc.setQueryData(qk6.announcements, (x: HotelAnnouncement[] | undefined) => (x ?? []).filter((a) => a.id !== id)),
    onError: () => void qc.invalidateQueries({ queryKey: qk6.announcements }),
    meta: { silent: true },
  });
  const list = useMemo(() => q.data ?? [], [q.data]);
  useEffect(() => {
    if (imp) return; // support staff viewing the hotel do not count as the hotel having seen it
    for (const a of list) {
      if (seen.current.has(a.id)) continue;
      seen.current.add(a.id);
      void announcementsApi.seen(a.id).catch(() => undefined);
    }
  }, [list, imp]);
  if (!list.length) return null;
  const order = { CRITICAL: 0, WARNING: 1, MAINTENANCE: 2, INFO: 3, SUCCESS: 4 } as const;
  const sorted = [...list].sort((a, b) => order[a.severity] - order[b.severity] || Date.parse(b.startsAt) - Date.parse(a.startsAt));
  // one notice at a time keeps the page above the fold; the rest are a click away
  const shown = all ? sorted : sorted.slice(0, 1);
  return (
    <div data-testid="announcements">
      {shown.map((a) => (
        <AnnouncementBar
          key={a.id}
          a={{ id: a.id, title: a.title, body: a.body, severity: a.severity, linkUrl: a.link?.url, linkLabel: a.link?.label, dismissible: a.dismissible }}
          onDismiss={imp ? undefined : () => dismiss.mutate(a.id)}
        />
      ))}
      {sorted.length > 1 && (
        <div className="border-b border-line bg-surface-2/60">
          <button type="button" onClick={() => setAll((v) => !v)} className="mx-auto block w-full max-w-[1240px] px-4 py-1 text-left text-[12px] font-medium text-ink-muted hover:text-ink sm:px-6 lg:px-10" data-testid="more-announcements">
            {all ? "Show one notice" : `${sorted.length - 1} more ${sorted.length - 1 === 1 ? "notice" : "notices"}`}
          </button>
        </div>
      )}
    </div>
  );
}
