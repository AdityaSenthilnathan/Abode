import type { ReactNode } from "react";

/* Deterministic hash → [0,1). Integer-only (Math.imul), so the server and the
   client generate the byte-identical skyline — no hydration mismatch. */
function rand(n: number): number {
  let h = (n ^ 0x9e3779b9) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}

/**
 * A row of stylized apartment buildings with lit (some twinkling) windows —
 * a warm dusk / golden-hour skyline that anchors the page to "homes." Built
 * procedurally but deterministically, so it's rich without being hand-placed.
 */
function Skyline() {
  const W = 1440;
  const H = 360;

  // back row — hazier, shorter, windowless, for atmospheric depth
  const far: ReactNode[] = [];
  let fx = -30;
  for (let i = 0; fx < W + 30 && i < 44; i++) {
    const fw = 78 + Math.floor(rand(i * 71 + 13) * 92);
    const fh = 64 + Math.floor(rand(i * 97 + 5) * 118);
    far.push(<rect key={i} x={fx} y={H - fh} width={fw} height={fh} rx={2} className="sky-far" />);
    fx += fw + 2 + Math.floor(rand(i * 41 + 3) * 10);
  }

  const buildings: ReactNode[] = [];

  let x = -16;
  for (let i = 0; x < W + 16 && i < 64; i++) {
    const bw = 56 + Math.floor(rand(i * 101 + 1) * 76); // 56–131
    const bh = 104 + Math.floor(rand(i * 211 + 7) * 230); // 104–333
    const by = H - bh;
    const parts: ReactNode[] = [
      <rect key="m" x={x} y={by} width={bw} height={bh} rx={3} className="sky-bldg" />,
    ];

    // window grid
    const padX = 11;
    const padY = 13;
    const cw = 11;
    const ch = 13;
    const gx = 11;
    const gy = 14;
    const cols = Math.max(1, Math.floor((bw - 2 * padX + gx) / (cw + gx)));
    const rows = Math.min(16, Math.max(1, Math.floor((bh - 2 * padY + gy) / (ch + gy))));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const seed = i * 1009 + c * 31 + r * 7;
        const v = rand(seed);
        const lit = v > 0.5;
        const twinkle = lit && rand(seed * 2 + 1) > 0.9;
        parts.push(
          <rect
            key={`w${c}-${r}`}
            x={x + padX + c * (cw + gx)}
            y={by + padY + r * (ch + gy)}
            width={cw}
            height={ch}
            rx={1.5}
            className={lit ? (twinkle ? "sky-on sky-twinkle" : "sky-on") : "sky-off"}
            style={twinkle ? { animationDelay: `${(rand(seed * 3 + 2) * 5).toFixed(2)}s` } : undefined}
          />,
        );
      }
    }

    // occasional rooftop antenna for character
    if (rand(i * 307 + 3) > 0.72) {
      parts.push(<rect key="ant" x={x + bw / 2 - 2} y={by - 13} width={4} height={13} className="sky-bldg" />);
    }

    buildings.push(<g key={i}>{parts}</g>);
    x += bw + 5 + Math.floor(rand(i * 53 + 9) * 8);
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMax slice"
      className="skyline absolute inset-x-0 bottom-0 h-[13rem] w-full sm:h-[17rem]"
    >
      <g>{far}</g>
      <g>{buildings}</g>
    </svg>
  );
}

/* Hand-placed star positions (upper sky, biased to the edges so they stay clear
   of the headline). Only surface in dark mode (the `.stars` container). */
const STARS = [
  { top: "7%", left: "9%", tw: true },
  { top: "13%", left: "19%", tw: false },
  { top: "17%", left: "6%", tw: true },
  { top: "9%", left: "30%", tw: false },
  { top: "6%", left: "68%", tw: false },
  { top: "12%", left: "79%", tw: true },
  { top: "8%", left: "90%", tw: false },
  { top: "19%", left: "85%", tw: false },
  { top: "23%", left: "73%", tw: true },
  { top: "11%", left: "95%", tw: false },
];

/**
 * Shared decorative layer behind the landing + auth pages: warm aurora light,
 * a couple of drifting clouds, an apartment skyline at the bottom, and a
 * whisper of film grain. Pure markup (no client JS); all motion lives in
 * globals.css and respects prefers-reduced-motion.
 */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-background" />
      <div className="aurora-blob aurora-1" />
      <div className="aurora-blob aurora-2" />
      <div className="aurora-blob aurora-3" />
      {/* sun at golden hour / moon at dusk */}
      <div className="celestial" />
      {/* stars (dusk only) */}
      <div className="stars">
        {STARS.map((s, i) => (
          <span
            key={i}
            className={`star ${s.tw ? "sky-twinkle" : ""}`}
            style={{ top: s.top, left: s.left, animationDelay: `${(i * 0.7) % 4}s` }}
          />
        ))}
      </div>
      <div className="cloud cloud-1" />
      <div className="cloud cloud-2" />
      {/* a distant flock drifting across the sky */}
      <svg className="birds" viewBox="0 0 120 40" fill="none" aria-hidden>
        <path className="bird" d="M2 14 Q9 6 16 14 Q23 6 30 14" />
        <path className="bird" d="M40 8 Q46 2 52 8 Q58 2 64 8" />
        <path className="bird" d="M74 18 Q81 11 88 18 Q95 11 102 18" />
      </svg>
      {/* warm city glow rising off the rooftops */}
      <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-brand/15 via-accent/5 to-transparent" />
      <Skyline />
      <div className="absolute inset-0 bg-grain opacity-[0.16]" />
    </div>
  );
}

/** Abode wordmark: rounded brand tile + name. Size scales the whole lockup. */
export function Wordmark({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const tile =
    size === "lg" ? "h-11 w-11 rounded-2xl" : size === "sm" ? "h-7 w-7 rounded-lg" : "h-9 w-9 rounded-xl";
  const glyph = size === "lg" ? "h-6 w-6" : size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const text = size === "lg" ? "text-2xl" : size === "sm" ? "text-base" : "text-lg";
  return (
    <span className="inline-flex items-center gap-2.5">
      <span
        className={`relative flex items-center justify-center ${tile} bg-gradient-to-br from-brand to-accent text-brand-foreground shadow-lg shadow-brand/30`}
      >
        <svg viewBox="0 0 24 24" fill="none" className={glyph} aria-hidden>
          <path
            d="M3 11.2 12 4l9 7.2"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5.2 9.6V19a1 1 0 0 0 1 1H10v-5a2 2 0 0 1 4 0v5h3.8a1 1 0 0 0 1-1V9.6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
      <span className={`font-semibold tracking-tight ${text}`}>Abode</span>
    </span>
  );
}
