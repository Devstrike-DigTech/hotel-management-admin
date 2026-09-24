"use client";

import { parseHex } from "@/lib/m6-catalog";
import type { TemplateId } from "@/lib/m7-catalog";

/** Mix two hex colours: t = 0 is `a`, 1 is `b`. */
export function mixHex(a: string, b: string, t: number) {
  const x = parseHex(a) ?? [0, 0, 0];
  const y = parseHex(b) ?? [255, 255, 255];
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, "0")).join("")}`;
}

/**
 * A live schematic of a template, drawn in the hotel's own colours: the layout
 * of the first screen and a little below it, as a printer's thumbnail sketch.
 * Cheap to render, so every card in the gallery can follow the colour pickers.
 */
export function TemplateThumb({
  id,
  primary,
  secondary,
  dark = false,
  className,
  title,
}: {
  id: TemplateId | string;
  primary: string;
  secondary: string;
  dark?: boolean;
  className?: string;
  title?: string;
}) {
  const bg = dark ? "#1C1915" : "#FBF8F2";
  const ink = dark ? "#EFE8DC" : "#1B1A17";
  const faint = mixHex(ink, bg, 0.82);
  const soft = mixHex(ink, bg, 0.65);
  const img = mixHex(primary, bg, dark ? 0.55 : 0.62);
  const img2 = mixHex(secondary, bg, dark ? 0.5 : 0.6);
  const p = parseHex(primary) ? primary : "#B4452A";
  const s = parseHex(secondary) ? secondary : "#B98A2E";
  const lines = (x: number, y: number, w: number, n: number, gap = 5, c = faint) =>
    Array.from({ length: n }, (_, i) => <rect key={`${x}-${y}-${i}`} x={x} y={y + i * gap} width={i === n - 1 ? w * 0.6 : w} height={1.6} rx={0.8} fill={c} />);
  const nav = (logo: "dot" | "crest" | "word" = "dot", align: "left" | "center" = "left") => (
    <g>
      {align === "left" ? (
        <>
          {logo === "dot" && <circle cx={13} cy={11} r={4} fill={p} />}
          <rect x={20} y={9.5} width={26} height={3} rx={1} fill={soft} />
          <rect x={132} y={10} width={12} height={2} rx={1} fill={faint} />
          <rect x={148} y={10} width={12} height={2} rx={1} fill={faint} />
          <rect x={164} y={7} width={26} height={8} rx={1.5} fill={p} />
        </>
      ) : null}
    </g>
  );

  let body: React.ReactNode;
  switch (id) {
    case "boutique":
      body = (
        <>
          <rect x={0} y={0} width={200} height={94} fill={img} />
          <rect x={0} y={60} width={200} height={34} fill={mixHex(img, "#000000", 0.35)} opacity={0.55} />
          <circle cx={13} cy={11} r={3.5} fill="none" stroke="#fff" strokeWidth={1} />
          <rect x={178} y={9} width={12} height={1.4} fill="#fff" opacity={0.85} />
          <rect x={178} y={12.5} width={12} height={1.4} fill="#fff" opacity={0.85} />
          <rect x={60} y={68} width={80} height={5} rx={1} fill="#fff" />
          <rect x={78} y={78} width={44} height={2} rx={1} fill="#fff" opacity={0.75} />
          <rect x={88} y={85} width={24} height={3} rx={1.5} fill={s} />
          <rect x={24} y={108} width={70} height={30} fill={img2} />
          <rect x={106} y={108} width={70} height={30} fill={img} opacity={0.8} />
          <rect x={24} y={142} width={40} height={1.6} rx={0.8} fill={faint} />
          <rect x={106} y={142} width={40} height={1.6} rx={0.8} fill={faint} />
        </>
      );
      break;
    case "business":
      body = (
        <>
          {nav()}
          <rect x={10} y={24} width={180} height={20} rx={2} fill={mixHex(p, bg, 0.9)} stroke={mixHex(p, bg, 0.6)} strokeWidth={0.8} />
          {[16, 56, 96].map((x) => (
            <rect key={x} x={x} y={29} width={34} height={10} rx={1.5} fill={bg} stroke={faint} strokeWidth={0.8} />
          ))}
          <rect x={138} y={29} width={46} height={10} rx={1.5} fill={p} />
          <rect x={10} y={52} width={60} height={3.5} rx={1} fill={ink} />
          {Array.from({ length: 4 }, (_, r) =>
            Array.from({ length: 7 }, (_, c) => (
              <g key={`${r}-${c}`}>
                <rect x={10 + c * 19} y={62 + r * 12} width={17} height={10} rx={1} fill={r === 1 && c === 4 ? mixHex(s, bg, 0.7) : mixHex(ink, bg, 0.94)} />
                <rect x={13 + c * 19} y={66 + r * 12} width={9} height={1.6} rx={0.8} fill={r === 1 && c === 4 ? s : soft} />
              </g>
            )),
          )}
          <rect x={146} y={52} width={44} height={58} rx={2} fill="none" stroke={s} strokeWidth={1} />
          <rect x={152} y={58} width={26} height={2.5} rx={1} fill={ink} />
          {lines(152, 66, 30, 4, 5)}
          <rect x={152} y={96} width={32} height={8} rx={1.5} fill={s} />
          {lines(10, 118, 180, 4, 7)}
        </>
      );
      break;
    case "resort":
      body = (
        <>
          <circle cx={100} cy={10} r={3.5} fill={p} />
          <rect x={8} y={20} width={184} height={70} rx={10} fill={img} />
          <path d="M8 76 Q 40 66 70 76 T 132 76 T 192 74 V 80 Q 192 90 182 90 H 18 Q 8 90 8 80 Z" fill={mixHex(s, bg, 0.35)} opacity={0.6} />
          <rect x={60} y={40} width={80} height={6} rx={3} fill="#fff" />
          <rect x={80} y={52} width={40} height={8} rx={4} fill={p} />
          {[8, 70, 132].map((x, i) => (
            <g key={x}>
              <rect x={x} y={98} width={60} height={32} rx={7} fill={i === 1 ? img2 : mixHex(img, bg, 0.25)} />
              <rect x={x + 4} y={134} width={30} height={2} rx={1} fill={soft} />
              <rect x={x + 4} y={139} width={44} height={1.6} rx={0.8} fill={faint} />
            </g>
          ))}
        </>
      );
      break;
    case "heritage":
      body = (
        <>
          <circle cx={100} cy={16} r={8} fill="none" stroke={p} strokeWidth={1.2} />
          <circle cx={100} cy={16} r={5} fill="none" stroke={p} strokeWidth={0.7} />
          <rect x={96} y={14} width={8} height={4} fill={p} />
          <line x1={20} y1={33} x2={92} y2={33} stroke={s} strokeWidth={0.8} />
          <line x1={20} y1={35.5} x2={92} y2={35.5} stroke={s} strokeWidth={0.4} />
          <line x1={108} y1={33} x2={180} y2={33} stroke={s} strokeWidth={0.8} />
          <line x1={108} y1={35.5} x2={180} y2={35.5} stroke={s} strokeWidth={0.4} />
          <rect x={97.5} y={31.5} width={5} height={5} transform="rotate(45 100 34)" fill={s} />
          <rect x={52} y={44} width={96} height={6} rx={1} fill={ink} />
          <rect x={70} y={54} width={60} height={2} rx={1} fill={soft} />
          <rect x={84} y={62} width={32} height={8} fill="none" stroke={p} strokeWidth={1} />
          <rect x={20} y={80} width={76} height={44} fill={img} />
          <rect x={20} y={80} width={76} height={44} fill="none" stroke={s} strokeWidth={0.6} transform="translate(3 3)" />
          <rect x={108} y={82} width={60} height={3} rx={1} fill={ink} />
          {lines(108, 92, 72, 5, 6)}
          <line x1={20} y1={138} x2={180} y2={138} stroke={s} strokeWidth={0.8} />
          <line x1={20} y1={140.5} x2={180} y2={140.5} stroke={s} strokeWidth={0.4} />
        </>
      );
      break;
    case "essentials":
      body = (
        <>
          <rect x={10} y={9} width={40} height={3.5} rx={1} fill={ink} />
          <rect x={160} y={8} width={30} height={6} rx={1} fill="none" stroke={p} strokeWidth={0.9} />
          <line x1={10} y1={20} x2={190} y2={20} stroke={faint} strokeWidth={0.6} />
          <rect x={10} y={28} width={120} height={5} rx={1} fill={ink} />
          <rect x={10} y={37} width={90} height={5} rx={1} fill={ink} />
          {lines(10, 48, 150, 3, 5)}
          <rect x={10} y={66} width={46} height={9} rx={1.5} fill={p} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <line x1={10} y1={86 + i * 16} x2={190} y2={86 + i * 16} stroke={faint} strokeWidth={0.6} />
              <rect x={10} y={91 + i * 16} width={60 - i * 8} height={2.6} rx={1} fill={soft} />
              <rect x={10} y={96 + i * 16} width={90} height={1.5} rx={0.7} fill={faint} />
              <rect x={160} y={91 + i * 16} width={30} height={2.6} rx={1} fill={i === 0 ? s : soft} />
            </g>
          ))}
          <line x1={10} y1={134} x2={190} y2={134} stroke={faint} strokeWidth={0.6} />
          {lines(10, 140, 110, 2, 5)}
        </>
      );
      break;
    default:
      // editorial
      body = (
        <>
          {nav()}
          <rect x={10} y={28} width={112} height={9} rx={1} fill={ink} />
          <rect x={10} y={41} width={70} height={9} rx={1} fill={p} />
          <rect x={84} y={41} width={30} height={9} rx={1} fill={ink} />
          {lines(10, 58, 106, 3, 5)}
          <rect x={10} y={76} width={38} height={9} rx={1.5} fill={p} />
          <rect x={52} y={76} width={34} height={9} rx={1.5} fill="none" stroke={soft} strokeWidth={0.8} />
          <rect x={132} y={26} width={58} height={72} fill={img} />
          <rect x={132} y={100} width={30} height={1.6} rx={0.8} fill={faint} />
          <line x1={10} y1={110} x2={190} y2={110} stroke={soft} strokeWidth={0.6} />
          {[10, 72, 134].map((x) => (
            <g key={x}>
              <rect x={x} y={116} width={36} height={3} rx={1} fill={soft} />
              {lines(x, 124, 54, 4, 5)}
            </g>
          ))}
        </>
      );
  }

  return (
    <svg viewBox="0 0 200 150" className={className} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} preserveAspectRatio="xMidYMid slice">
      <rect width={200} height={150} fill={bg} />
      {body}
    </svg>
  );
}
