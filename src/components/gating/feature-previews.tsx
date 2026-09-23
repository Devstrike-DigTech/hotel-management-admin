/* Illustrative, non-interactive previews for locked features. Sample data only. */

import { ArrowsClockwise, Broom, CheckCircle, Circle, Globe, Storefront, UserCircle, Plugs } from "@phosphor-icons/react";
import { FOB_PATH } from "@/components/brand";
import { cn } from "@/lib/cn";

export function PosPreview() {
  const lines = [
    ["Chapman", 1, 3500],
    ["Peppered snail", 1, 7500],
    ["Lager, bottle", 2, 4000],
    ["Jollof rice, chicken", 1, 6500],
  ] as const;
  const total = lines.reduce((s, l) => s + l[2], 0);
  return (
    <div className="flex flex-col gap-4 sm:flex-row">
      <div className="grid flex-1 grid-cols-3 content-start gap-2">
        {["Bar", "Kitchen", "Laundry", "Pool bar", "Minibar", "Spa"].map((c, i) => (
          <div
            key={c}
            className={cn(
              "flex h-16 flex-col justify-between rounded-md border p-2.5 text-[12px]",
              i === 0 ? "border-laterite bg-laterite-wash/60 text-ink" : "border-line bg-surface text-ink-muted",
            )}
          >
            <span className="font-medium">{c}</span>
            <span className="font-mono text-[10.5px]">{[18, 24, 6, 9, 12, 4][i]} items</span>
          </div>
        ))}
      </div>
      <div className="relative w-full max-w-[240px] self-center bg-surface px-4 pb-6 pt-4 shadow-float sm:self-start">
        <p className="text-center font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">Bar &middot; Room 204</p>
        <div className="my-3 border-t border-dashed border-line-strong" />
        {lines.map(([n, q, p]) => (
          <div key={n} className="flex justify-between py-0.5 font-mono text-[11.5px] text-ink">
            <span>
              {q} x {n}
            </span>
            <span>{p.toLocaleString("en-NG")}</span>
          </div>
        ))}
        <div className="my-3 border-t border-dashed border-line-strong" />
        <div className="flex justify-between font-mono text-[13px] font-semibold text-ink">
          <span>TOTAL</span>
          <span>&#8358;{total.toLocaleString("en-NG")}</span>
        </div>
        <div className="mt-3 rounded-sm bg-laterite py-1.5 text-center text-[12px] font-medium text-laterite-ink">Post to room 204</div>
        <svg className="absolute inset-x-0 -bottom-2 h-2 w-full text-surface" preserveAspectRatio="none" viewBox="0 0 100 4" aria-hidden>
          <path d="M0 0 L5 4 L10 0 L15 4 L20 0 L25 4 L30 0 L35 4 L40 0 L45 4 L50 0 L55 4 L60 0 L65 4 L70 0 L75 4 L80 0 L85 4 L90 0 L95 4 L100 0 Z" fill="currentColor" />
        </svg>
      </div>
    </div>
  );
}

export function ChannelPreview() {
  const rows = [
    { name: "Your booking page", icon: Globe, rooms: 6, rate: "65,000", state: "synced" },
    { name: "Marketplace", icon: Storefront, rooms: 6, rate: "65,000", state: "synced" },
    { name: "Global OTA", icon: Plugs, rooms: 4, rate: "71,500", state: "syncing" },
    { name: "Regional OTA", icon: Plugs, rooms: 4, rate: "69,000", state: "synced" },
    { name: "Travel agent portal", icon: UserCircle, rooms: 2, rate: "58,500", state: "paused" },
  ];
  return (
    <div className="overflow-hidden rounded-md border border-line bg-surface">
      <div className="grid grid-cols-[minmax(0,1fr)_70px_90px_90px] border-b border-line px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-ink-muted">
        <span>Channel</span>
        <span>Rooms</span>
        <span>Rate &#8358;</span>
        <span>Status</span>
      </div>
      {rows.map((r) => {
        const I = r.icon;
        return (
          <div key={r.name} className="grid grid-cols-[minmax(0,1fr)_70px_90px_90px] items-center border-b border-line px-4 py-2.5 text-[12.5px] last:border-b-0">
            <span className="flex items-center gap-2 truncate text-ink">
              <I size={15} weight="duotone" className="text-ink-muted" /> {r.name}
            </span>
            <span className="font-mono text-ink">{r.rooms}</span>
            <span className="font-mono text-ink">{r.rate}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 text-[11.5px]",
                r.state === "synced" ? "text-palm" : r.state === "syncing" ? "text-adire" : "text-ink-faint",
              )}
            >
              {r.state === "syncing" ? <ArrowsClockwise size={12} className="animate-spin [animation-duration:2.4s]" /> : <Circle size={8} weight="fill" />}
              {r.state}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function PricingPreview() {
  const base = 65;
  const days = [62, 60, 64, 70, 88, 94, 72, 63, 61, 66, 74, 97, 104, 78];
  const labels = ["M", "T", "W", "T", "F", "S", "S", "M", "T", "W", "T", "F", "S", "S"];
  const max = 110;
  const w = 560;
  const h = 170;
  const step = w / days.length;
  const y = (v: number) => h - (v / max) * h;
  const path = days.map((d, i) => `${i ? "L" : "M"}${(i + 0.5) * step} ${y(d)}`).join(" ");
  return (
    <div className="rounded-md border border-line bg-surface p-4">
      <div className="mb-3 flex items-center gap-4 text-[11.5px] text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-0.5 w-4 bg-laterite" /> Suggested rate
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-0 w-4 border-t border-dashed border-ink-faint" /> Base rate &#8358;65k
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-brass" /> Event nearby
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h + 22}`} className="w-full" aria-hidden>
        {days.map((d, i) => (
          <rect key={i} x={i * step + step * 0.3} y={y(d)} width={step * 0.4} height={h - y(d)} rx={2} style={{ fill: "var(--surface-2)" }} />
        ))}
        <line x1={0} x2={w} y1={y(base)} y2={y(base)} strokeDasharray="4 4" style={{ stroke: "var(--ink-faint)" }} />
        <path d={path} fill="none" strokeWidth={2} strokeLinejoin="round" style={{ stroke: "var(--laterite)" }} />
        {[5, 12].map((i) => (
          <circle key={i} cx={(i + 0.5) * step} cy={y(days[i]) - 12} r={4} style={{ fill: "var(--brass)" }} />
        ))}
        {labels.map((l, i) => (
          <text key={i} x={(i + 0.5) * step} y={h + 16} textAnchor="middle" style={{ fontFamily: "var(--font-mono)", fontSize: 10, fill: "var(--ink-muted)" }}>
            {l}
          </text>
        ))}
      </svg>
    </div>
  );
}

export function LoyaltyPreview() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="relative w-full max-w-[320px] overflow-hidden rounded-lg bg-[#1f2d48] p-5 text-[#ece3d2] shadow-float">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#ece3d2]/60">Brass member</p>
        <p className="display mt-2 text-[26px] leading-none text-[#f4ecdd]">Chiamaka N.</p>
        <p className="mt-1 font-mono text-[11px] text-[#ece3d2]/60">Since March 2025 &middot; 14 stays</p>
        <div className="mt-5 flex gap-1.5">
          {Array.from({ length: 10 }, (_, i) => (
            <svg key={i} viewBox="0 0 44 64" width="18" height="26" aria-hidden>
              <path d={FOB_PATH} fill={i < 7 ? "#d6a94a" : "none"} stroke="#d6a94a" strokeWidth={3} strokeOpacity={i < 7 ? 1 : 0.5} />
            </svg>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] text-[#ece3d2]/75">3 more nights to a free weekend</p>
      </div>
      <ul className="flex flex-1 flex-col gap-2 text-[13px]">
        {["Late checkout at 2pm", "Welcome drink on arrival", "10% off the bar tab", "Birthday night on the house"].map((p) => (
          <li key={p} className="flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-ink">
            <CheckCircle size={15} weight="duotone" className="text-brass" /> {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HousekeepingPreview() {
  const cols = [
    { title: "To clean", rooms: ["108", "205", "302"], tone: "var(--ochre)" },
    { title: "In progress", rooms: ["203", "307"], tone: "var(--adire)" },
    { title: "Inspected", rooms: ["101", "105", "202", "303"], tone: "var(--palm)" },
  ];
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {cols.map((c) => (
        <div key={c.title} className="rounded-md border border-line bg-surface-2/50 p-2.5">
          <p className="mb-2 flex items-center justify-between px-1 text-[12px] font-medium text-ink">
            {c.title} <span className="font-mono text-ink-muted">{c.rooms.length}</span>
          </p>
          <div className="flex flex-col gap-1.5">
            {c.rooms.map((r, i) => (
              <div key={r} className="flex items-center gap-2 rounded-sm border border-line bg-surface px-2.5 py-2" style={{ boxShadow: `inset 3px 0 0 ${c.tone}` }}>
                <span className="font-mono text-[13px] text-ink">{r}</span>
                <span className="ml-auto flex items-center gap-1 text-[11px] text-ink-muted">
                  <Broom size={12} /> {["Musa", "Ngozi", "Ibrahim", "Efe"][i % 4]}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
