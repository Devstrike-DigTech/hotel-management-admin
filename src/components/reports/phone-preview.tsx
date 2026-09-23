"use client";

import { Checks, DotsThreeVertical, Phone, VideoCamera } from "@phosphor-icons/react";
import type { Digest } from "@/lib/api/types-m2";
import { config } from "@/lib/config";
import { lagosHHMM } from "@/lib/dates";
import { LogoMark } from "@/components/brand";
import { AdireField } from "@/components/motifs/adire";

/** Render *bold* and _italic_ the way WhatsApp does, keep line breaks. */
export function renderWhatsApp(text: string) {
  return text.split("\n").map((line, i) => (
    <span key={i} className="block min-h-[1.2em]">
      {line.split(/(\*[^*]+\*|_[^_]+_)/g).map((part, j) =>
        part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
          <strong key={j} className="font-semibold">
            {part.slice(1, -1)}
          </strong>
        ) : part.startsWith("_") && part.endsWith("_") && part.length > 2 ? (
          <em key={j}>{part.slice(1, -1)}</em>
        ) : (
          <span key={j}>{part}</span>
        ),
      )}
    </span>
  ));
}

/** The owner's phone, showing the nightly digest as it arrives in their chat. */
export function PhonePreview({ digest }: { digest: Digest }) {
  return (
    <figure className="mx-auto w-full max-w-[360px]" aria-label="Digest as it appears on the owner's phone">
      <div className="relative rounded-[44px] border border-line-strong bg-[#141210] p-[10px] shadow-[0_30px_60px_-30px_rgb(40_25_10/0.6)]">
        <div className="absolute left-1/2 top-[18px] z-20 h-[22px] w-[92px] -translate-x-1/2 rounded-full bg-black" aria-hidden />
        <div className="relative flex h-[640px] flex-col overflow-hidden rounded-[34px] bg-[#ece5dd] dark:bg-[#0f1512]" style={{ colorScheme: "light" }}>
          {/* status bar */}
          <div className="flex h-11 items-end justify-between bg-[#1f4d3b] px-7 pb-1 font-mono text-[11px] text-white/90">
            <span>23:00</span>
            <span className="tracking-widest">4G &middot; 82%</span>
          </div>
          {/* chat header */}
          <div className="flex items-center gap-2.5 bg-[#1f4d3b] px-3 pb-2.5 pt-1.5 text-white">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#f4efe6]">
              <LogoMark size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14.5px] font-medium">{config.appName} Owner Alerts</p>
              <p className="text-[11px] text-white/70">business account</p>
            </div>
            <VideoCamera size={18} className="opacity-80" />
            <Phone size={17} className="opacity-80" />
            <DotsThreeVertical size={18} weight="bold" className="opacity-80" />
          </div>
          {/* wallpaper */}
          <div className="relative flex-1 overflow-y-auto px-3 py-4">
            <AdireField cols={8} rows={14} animated={false} className="pointer-events-none absolute inset-0 h-full w-full text-[#1f4d3b] opacity-[0.07]" />
            <p className="relative mx-auto mb-3 w-fit rounded-md bg-[#e1f2fb] px-2.5 py-1 text-[11px] text-[#54656f] shadow-sm dark:bg-[#1d2a30] dark:text-[#8696a0]">
              {new Date(digest.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" })}
            </p>
            <div className="relative ml-1 max-w-[92%] rounded-lg rounded-tl-none bg-white px-3 pb-1.5 pt-2 text-[13.5px] leading-[1.4] text-[#111b21] shadow-[0_1px_0.5px_rgb(0_0_0/0.13)] dark:bg-[#1f2c34] dark:text-[#e9edef]">
              <span aria-hidden className="absolute -left-2 top-0 h-0 w-0 border-r-[8px] border-t-[8px] border-r-white border-t-transparent dark:border-r-[#1f2c34]" />
              <div className="whitespace-pre-wrap break-words">{renderWhatsApp(digest.body)}</div>
              <span className="mt-1 flex items-center justify-end gap-1 text-[10.5px] text-[#667781] dark:text-[#8696a0]">
                {lagosHHMM(digest.createdAt)}
                {digest.status === "SENT" && <Checks size={14} weight="bold" className="text-[#53bdeb]" />}
              </span>
            </div>
          </div>
          {/* composer */}
          <div className="flex items-center gap-2 bg-[#f0f2f5] px-2.5 py-2 dark:bg-[#1f2c34]">
            <span className="h-9 flex-1 rounded-full bg-white px-4 text-[13px] leading-9 text-[#8696a0] dark:bg-[#2a3942]">Message</span>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-[12px] text-ink-muted">
        {digest.status === "LOGGED" ? "Logged here: WhatsApp isn't connected for this hotel yet." : digest.status === "FAILED" ? `Failed: ${digest.error}` : `Delivered to ${digest.recipients.join(", ")}`}
      </figcaption>
    </figure>
  );
}
