import type { RoomStatus } from "@/lib/api/types";
import { ROOM_STATUS } from "@/lib/catalog";
import { FOB_PATH } from "@/components/brand";

/**
 * Status textures so room state never depends on colour alone:
 *  clean = plain, occupied = adire diagonal, dirty = specks,
 *  reserved = inset ribbon, out of order = cross-hatch.
 * Mounted once at the app root; referenced by id.
 */
export function StatusPatternDefs() {
  return (
    <svg width="0" height="0" aria-hidden style={{ position: "absolute" }} focusable="false">
      <defs>
        <pattern id="kr-adire" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" style={{ stroke: "var(--adire)", strokeWidth: 1.2, strokeOpacity: 0.32 }} />
        </pattern>
        <pattern id="kr-dots" width="5" height="5" patternUnits="userSpaceOnUse">
          <circle cx="2.5" cy="2.5" r="0.9" style={{ fill: "var(--ochre)", fillOpacity: 0.7 }} />
        </pattern>
        <pattern id="kr-cross" width="6" height="6" patternUnits="userSpaceOnUse">
          <path d="M0 0 L6 6 M6 0 L0 6" style={{ stroke: "var(--danger)", strokeWidth: 0.8, strokeOpacity: 0.42 }} />
        </pattern>
      </defs>
    </svg>
  );
}

export function patternFill(status: RoomStatus): string | null {
  switch (ROOM_STATUS[status].pattern) {
    case "adire":
      return "url(#kr-adire)";
    case "dots":
      return "url(#kr-dots)";
    case "cross":
      return "url(#kr-cross)";
    default:
      return null;
  }
}

/** A miniature key fob in a status' colour + texture. */
export function StatusSwatch({ status, size = 18 }: { status: RoomStatus; size?: number }) {
  const m = ROOM_STATUS[status];
  const pat = patternFill(status);
  return (
    <svg width={size * 0.69} height={size} viewBox="0 0 44 64" aria-hidden className="shrink-0">
      <path d={FOB_PATH} style={{ fill: m.wash, stroke: m.color, strokeWidth: 3.5 }} />
      {pat && <path d={FOB_PATH} style={{ fill: pat }} />}
      {m.pattern === "ring" && (
        <path d={FOB_PATH} transform="translate(22 32) scale(0.72) translate(-22 -32)" style={{ fill: "none", stroke: m.color, strokeWidth: 3 }} />
      )}
      <circle cx="22" cy="13" r="5" style={{ fill: "var(--surface)", stroke: m.color, strokeWidth: 3 }} />
    </svg>
  );
}
