import Link from "next/link";
import { AdireGlyph } from "@/components/motifs/adire";
import { Wordmark } from "@/components/brand";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <Wordmark size="sm" />
      <AdireGlyph kind="eye" size={72} className="mt-12 text-laterite" />
      <p className="eyebrow mt-6">Error 404</p>
      <h1 className="display mt-3 text-[40px] leading-tight text-ink">
        This key isn&rsquo;t <em>on the rack</em>.
      </h1>
      <p className="mt-3 max-w-sm text-[14.5px] text-ink-muted">The page may have moved, or the link was mistyped.</p>
      <Link
        href="/today"
        className="mt-8 inline-flex h-10 items-center rounded-md bg-laterite px-5 text-[14px] font-medium text-laterite-ink hover:bg-laterite-hover"
      >
        Back to today
      </Link>
    </main>
  );
}
