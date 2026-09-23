import Link from "next/link";
import { AdireField } from "@/components/motifs/adire";
import { LogoMark } from "@/components/brand";
import { config } from "@/lib/config";
import { cn } from "@/lib/cn";

/**
 * Split layout for sign-in and onboarding: an indigo adire "cloth" panel with a
 * slow line-drawn pattern on one side, the form on paper on the other.
 */
export function AuthSplit({
  children,
  aside,
  className,
  tone = "indigo",
  home = "/login",
}: {
  children: React.ReactNode;
  aside?: React.ReactNode;
  className?: string;
  tone?: "indigo" | "ink";
  home?: string;
}) {
  const ink = tone === "ink";
  return (
    <div className={cn("grid min-h-dvh lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]", className)}>
      <aside
        className={cn(
          "relative hidden overflow-hidden text-[#ece3d2] lg:block",
          ink ? "bg-[#1b1a17] dark:bg-[#0c0b09]" : "bg-[#1f2d48] dark:bg-[#141d30]",
        )}
      >
        <AdireField
          cols={9}
          rows={12}
          className={cn(
            "absolute inset-0 h-full w-full opacity-[0.26] [mask-image:linear-gradient(170deg,black_0%,black_35%,transparent_78%)]",
            ink ? "text-[#d6a94a] opacity-[0.2]" : "text-[#ece3d2]",
          )}
        />
        {/* vignette so text sits on calm cloth */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background: ink
              ? "radial-gradient(120% 80% at 20% 100%, rgba(18,17,15,0.95) 0%, rgba(18,17,15,0.55) 45%, rgba(18,17,15,0) 75%)"
              : "radial-gradient(120% 80% at 20% 100%, rgba(20,29,48,0.95) 0%, rgba(20,29,48,0.55) 45%, rgba(20,29,48,0) 75%)",
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-40"
          style={{
            background: ink
              ? "linear-gradient(180deg, rgba(18,17,15,0.92), rgba(18,17,15,0))"
              : "linear-gradient(180deg, rgba(20,29,48,0.9), rgba(20,29,48,0))",
          }}
        />
        <div className="relative flex h-full flex-col justify-between p-10 xl:p-14">
          <Link href={home} className="inline-flex items-center gap-3 self-start">
            <LogoMark size={30} />
            <span
              className="display-sm text-[22px] leading-none text-[#ece3d2]"
              style={{ fontVariationSettings: '"opsz" 72, "SOFT" 100, "WONK" 1' }}
            >
              {config.appName}
            </span>
          </Link>
          {aside}
        </div>
      </aside>
      <main className="relative flex min-h-dvh flex-col px-5 py-8 sm:px-10 lg:px-16">
        {/* a strip of the cloth on small screens */}
        <div
          aria-hidden
          className={cn(
            "relative -mx-5 -mt-8 mb-8 h-20 overflow-hidden sm:-mx-10 lg:hidden",
            ink ? "bg-[#1b1a17]" : "bg-[#1f2d48] dark:bg-[#141d30]",
          )}
        >
          <AdireField
            cols={12}
            rows={3}
            animated={false}
            className={cn("absolute inset-0 h-full w-full opacity-30", ink ? "text-[#d6a94a]" : "text-[#ece3d2]")}
          />
        </div>
        {children}
      </main>
    </div>
  );
}

export function AsideQuote() {
  return (
    <div className="max-w-[34rem]">
      <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#ece3d2]/60">On the front desk</p>
      <blockquote
        className="display mt-5 text-[40px] leading-[1.08] text-[#f4ecdd] xl:text-[48px]"
        style={{ fontVariationSettings: '"opsz" 144, "SOFT" 100, "WONK" 0' }}
      >
        Hospitality is knowing the room number <em className="serif-accent text-[#e7a27f]">before</em> the guest says
        it.
      </blockquote>
      <div className="mt-10 flex items-center gap-4 font-mono text-[11px] tracking-[0.14em] text-[#ece3d2]/55">
        <span>06&deg;27&prime;N 03&deg;23&prime;E</span>
        <span className="h-px w-10 bg-[#ece3d2]/30" />
        <span>LAGOS &middot; ABUJA &middot; PORT HARCOURT</span>
      </div>
    </div>
  );
}
