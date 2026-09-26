/** Marks the words the content screen matched (API-M8 3), so staff see exactly what caught it. */
export function Highlight({ text, terms }: { text: string; terms: string[] }) {
  const clean = terms.map((t) => t.trim()).filter(Boolean);
  if (!clean.length) return <>{text}</>;
  const esc = clean.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*$/, "\\w*").replace(/\s+/g, "\\s+"));
  const re = new RegExp(`(${esc.join("|")})`, "gi");
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <mark key={i} className="rounded-xs bg-ochre-wash px-0.5 text-ink underline decoration-ochre decoration-wavy decoration-1 underline-offset-[3px]" data-testid="matched-term">
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}
