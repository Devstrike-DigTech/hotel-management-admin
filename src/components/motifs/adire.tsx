/**
 * Adire-inspired thin-line motifs. Adire eleko cloth is built from repeating
 * hand-drawn squares: concentric rings, dotted grids, zigzag "river" lines,
 * crossed squares and palm fronds. These are reduced to 1px strokes on a
 * 48-unit grid so they read as quiet texture, never clip-art.
 */

import { cn } from "@/lib/cn";

type MotifKind = "rings" | "dots" | "river" | "cross" | "frond" | "arcs" | "ladder" | "eye";

const S = 48; // cell size

function Motif({ kind, x, y }: { kind: MotifKind; x: number; y: number }) {
  const c = S / 2;
  const t = `translate(${x} ${y})`;
  switch (kind) {
    case "rings":
      return (
        <g transform={t}>
          <circle cx={c} cy={c} r={17} />
          <circle cx={c} cy={c} r={11} />
          <circle cx={c} cy={c} r={5} />
        </g>
      );
    case "dots":
      return (
        <g transform={t}>
          <rect x={6} y={6} width={36} height={36} />
          {[14, 24, 34].flatMap((px) =>
            [14, 24, 34].map((py) => <circle key={`${px}-${py}`} cx={px} cy={py} r={1.4} className="adire-fill" />),
          )}
        </g>
      );
    case "river":
      return (
        <g transform={t}>
          <path d="M4 14 L12 8 L20 14 L28 8 L36 14 L44 8" />
          <path d="M4 26 L12 20 L20 26 L28 20 L36 26 L44 20" />
          <path d="M4 38 L12 32 L20 38 L28 32 L36 38 L44 32" />
        </g>
      );
    case "cross":
      return (
        <g transform={t}>
          <rect x={8} y={8} width={32} height={32} />
          <path d="M8 8 L40 40 M40 8 L8 40" />
          <circle cx={c} cy={c} r={4} />
        </g>
      );
    case "frond":
      return (
        <g transform={t}>
          <path d="M24 44 L24 4" />
          {[10, 17, 24, 31].map((py) => (
            <path key={py} d={`M24 ${py + 6} L14 ${py} M24 ${py + 6} L34 ${py}`} />
          ))}
        </g>
      );
    case "arcs":
      return (
        <g transform={t}>
          <path d="M4 44 A20 20 0 0 1 44 44" />
          <path d="M10 44 A14 14 0 0 1 38 44" />
          <path d="M16 44 A8 8 0 0 1 32 44" />
          <path d="M4 4 A20 20 0 0 0 44 4" />
        </g>
      );
    case "ladder":
      return (
        <g transform={t}>
          <path d="M14 4 L14 44 M34 4 L34 44" />
          {[10, 18, 26, 34, 42].map((py) => (
            <path key={py} d={`M14 ${py} L34 ${py}`} />
          ))}
        </g>
      );
    case "eye":
      return (
        <g transform={t}>
          <path d="M4 24 Q24 6 44 24 Q24 42 4 24 Z" />
          <circle cx={c} cy={c} r={5} />
        </g>
      );
  }
}

const KINDS: MotifKind[] = ["rings", "dots", "river", "cross", "frond", "arcs", "ladder", "eye"];

/** Deterministic pseudo-random so SSR and client agree. */
function pick(i: number, j: number) {
  const h = Math.abs(Math.sin(i * 12.9898 + j * 78.233) * 43758.5453) % 1;
  return KINDS[Math.floor(h * KINDS.length)];
}

/**
 * A field of adire squares. `animated` draws each line in slowly (staggered),
 * then lets the whole cloth drift a few cells over a long loop.
 */
export function AdireField({
  cols = 12,
  rows = 16,
  className,
  animated = true,
  strokeWidth = 1,
}: {
  cols?: number;
  rows?: number;
  className?: string;
  animated?: boolean;
  strokeWidth?: number;
}) {
  const cells = [];
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      cells.push({ i, j, kind: pick(i, j) });
    }
  }
  return (
    <svg
      aria-hidden
      className={cn("adire-field", className)}
      viewBox={`0 0 ${cols * S} ${rows * S}`}
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      vectorEffect="non-scaling-stroke"
    >
      <g className={animated ? "adire-drift" : undefined}>
        {/* stitched grid between squares, like the resist lines between cloth panels */}
        <g strokeOpacity={0.35} strokeDasharray="2 4">
          {Array.from({ length: cols + 3 }, (_, i) => (
            <path key={`v${i}`} d={`M${i * S} 0 V${(rows + 3) * S}`} />
          ))}
          {Array.from({ length: rows + 3 }, (_, j) => (
            <path key={`h${j}`} d={`M0 ${j * S} H${(cols + 3) * S}`} />
          ))}
        </g>
        {cells.map(({ i, j, kind }) => (
          <g
            key={`${i}-${j}`}
            className={animated ? "adire-draw" : undefined}
            style={animated ? ({ animationDelay: `${((i + j) % 14) * 180}ms` } as React.CSSProperties) : undefined}
          >
            <Motif kind={kind} x={i * S} y={j * S} />
          </g>
        ))}
      </g>
      <style>{`
        .adire-field .adire-fill { fill: currentColor; stroke: none; }
        .adire-field .adire-draw path, .adire-field .adire-draw circle:not(.adire-fill), .adire-field .adire-draw rect {
          stroke-dasharray: 160; stroke-dashoffset: 160;
          animation: draw 3.2s cubic-bezier(0.22,1,0.36,1) forwards;
          animation-delay: inherit;
        }
        .adire-field .adire-drift { animation: drift 90s linear infinite alternate; }
        @media (prefers-reduced-motion: reduce) {
          .adire-field .adire-draw path, .adire-field .adire-draw circle, .adire-field .adire-draw rect { stroke-dashoffset: 0; animation: none; }
          .adire-field .adire-drift { animation: none; }
        }
      `}</style>
    </svg>
  );
}

/** A single motif glyph, for small decorative use (empty states, dividers). */
export function AdireGlyph({
  kind = "rings",
  size = 48,
  className,
}: {
  kind?: MotifKind;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      className={cn("adire-field", className)}
    >
      <Motif kind={kind} x={0} y={0} />
      <style>{`.adire-field .adire-fill { fill: currentColor; stroke: none; }`}</style>
    </svg>
  );
}

/** Thin repeating border strip: a row of alternating motifs. */
export function AdireRule({ className, count = 24 }: { className?: string; count?: number }) {
  return (
    <svg
      aria-hidden
      className={cn("adire-field block h-3 w-full", className)}
      viewBox={`0 0 ${count * 24} 12`}
      preserveAspectRatio="xMinYMid slice"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
    >
      {Array.from({ length: count }, (_, i) =>
        i % 2 === 0 ? (
          <circle key={i} cx={i * 24 + 12} cy={6} r={3.5} />
        ) : (
          <path key={i} d={`M${i * 24 + 4} 9 L${i * 24 + 12} 3 L${i * 24 + 20} 9`} />
        ),
      )}
    </svg>
  );
}
