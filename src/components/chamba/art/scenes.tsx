/*
 * Chamb-a lado · hero scenes ("bold workwear sticker" style).
 * Thick ink outlines, flat fills, hard offset ink shadows, one white shine per main object,
 * hazard stripes / rivets / halftone accents. No faces on objects; people get simple confident faces.
 * Server-component safe (no hooks, deterministic). All motion is CSS (scenes.css), transform/opacity only,
 * gated by `data-animated` and switched off under prefers-reduced-motion.
 * Each scene has a FIXED aspect ratio (SCENE_RATIO = width / height); viewBox height is 300.
 */
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Mascot } from "./mascot";
import "./scenes.css";

export type SceneName =
  | "barrio" // Saltillo street strip: houses, a plant, cathedral towers, Sierra de Zapalinamé, bus + cars driving, sun — wide hero/banner
  | "radar" // a house with pulsing rings and job pins popping up around it
  | "reparto" // delivery van zooming with parcels, speed lines
  | "exito" // Chambita celebrating with a trophy + confetti (application sent / hired)
  | "busqueda" // Chambita with a magnifying glass over a mini map
  | "vacio" // empty state: Chambita napping on a bench / tumbleweed, zZz
  | "contratado" // high-five / handshake + party hat: you got the job
  | "negocio" // storefront with striped awning + "open" sign, customers — employer side
  | "whatsapp" // phone with chat bubbles + a code bubble, Chambita waving — sign-in / OTP
  | "mapa" // folded map with bouncing pins and a dashed route
  | "ahorro" // steel savings box + coins + clock: saved time & money from working close
  | "equipo"; // a small crew of workers (hard hat, apron, cap) waving — employer hiring

export const SCENE_RATIO: Record<SceneName, number> = {
  barrio: 3,
  radar: 1,
  reparto: 2,
  exito: 1,
  busqueda: 1,
  vacio: 1.25,
  contratado: 1,
  negocio: 1,
  whatsapp: 1,
  mapa: 1,
  ahorro: 1.5,
  equipo: 2,
};

export type SceneProps = {
  name: SceneName;
  /** Size it with width classes (w-full, w-40…); height follows the fixed ratio. */
  className?: string;
  /** Moving parts (vehicles drive, pins pop, steam rises, confetti falls). Default true. */
  animated?: boolean;
  title?: string;
};

/* ------------------------------------------------------------------ */
/* Palette + drawing kit                                               */
/* ------------------------------------------------------------------ */

const INK = "#160F33";
const SUN = "#FFC93C";
const ORA = "#FF6B2C";
const CHILE = "#FF5A36";
const VIO = "#4318E0";
const LIME = "#DDF78A";
const DENIM = "#2F6FD6";
const SKY = "#5CC3FF";
const MINT = "#5EE0A0";
const CONC = "#C9C6D6";
const CREAM = "#FFF6E0";
const WHITE = "#FFFFFF";
const KRAFT = "#F2B36B";
const ROAD = "#2A2352";
const SKIN = ["#8A5A3B", "#C68642", "#F1C27D", "#5C3A24"] as const;

const SW = 5; // outline at viewBox height 300
const SH = 5; // hard offset shadow

type Anim =
  | "spin"
  | "drive"
  | "bob"
  | "rumble"
  | "puff"
  | "pulse"
  | "slam"
  | "flash"
  | "drift"
  | "swing"
  | "wave"
  | "fall"
  | "pop"
  | "zz"
  | "speed"
  | "scroll"
  | "coin"
  | "hi5"
  | "burst"
  | "shake"
  | "blink"
  | "flutter"
  | "hop";

/** Animation hook-up: class + timing vars. `o` = transform-origin within the element's own box. */
function a(kind: Anim, t: number, opts: { dl?: number; o?: string; v?: Record<string, string> } = {}) {
  const style: Record<string, string> = { "--t": `${t}s`, "--dl": `${opts.dl ?? 0}s`, ...opts.v };
  if (opts.o) style["--o"] = opts.o;
  return { className: `scP sc-${kind}`, style: style as CSSProperties };
}

type Paint = { fill?: string; sh?: boolean | number; sw?: number; className?: string; style?: CSSProperties };
const off = (sh: boolean | number | undefined) => (sh === true || sh === undefined ? SH : sh || 0);

function R({ x, y, w, h, r = 0, fill = WHITE, sh, sw = SW }: Paint & { x: number; y: number; w: number; h: number; r?: number }) {
  const o = off(sh);
  return (
    <>
      {o ? <rect x={x + o} y={y + o} width={w} height={h} rx={r} fill={INK} stroke={INK} strokeWidth={sw} /> : null}
      <rect x={x} y={y} width={w} height={h} rx={r} fill={fill} stroke={INK} strokeWidth={sw} strokeLinejoin="round" />
    </>
  );
}

function P({ d, fill = WHITE, sh, sw = SW }: Paint & { d: string }) {
  const o = off(sh);
  return (
    <>
      {o ? <path d={d} transform={`translate(${o} ${o})`} fill={INK} stroke={INK} strokeWidth={sw} strokeLinejoin="round" /> : null}
      <path d={d} fill={fill} stroke={INK} strokeWidth={sw} strokeLinejoin="round" strokeLinecap="round" />
    </>
  );
}

function C({ cx, cy, r, fill = WHITE, sh, sw = SW }: Paint & { cx: number; cy: number; r: number }) {
  const o = off(sh);
  return (
    <>
      {o ? <circle cx={cx + o} cy={cy + o} r={r} fill={INK} stroke={INK} strokeWidth={sw} /> : null}
      <circle cx={cx} cy={cy} r={r} fill={fill} stroke={INK} strokeWidth={sw} />
    </>
  );
}

/** Open ink stroke (no shadow). */
function L({ d, w = SW, c = INK }: { d: string; w?: number; c?: string }) {
  return <path d={d} fill="none" stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" />;
}

/** The one crisp white highlight per object. */
const Shine = ({ d, w = 5 }: { d: string; w?: number }) => <L d={d} w={w} c={WHITE} />;

/** Positioned group (static transform lives here, never on an animated node). */
const G = ({ x = 0, y = 0, r, s, children }: { x?: number; y?: number; r?: number; s?: number; children: ReactNode }) => (
  <g transform={`translate(${x} ${y})${r ? ` rotate(${r})` : ""}${s ? ` scale(${s})` : ""}`}>{children}</g>
);

/** Hazard band: safety yellow with ink diagonals, only whole stripes inside. */
function Hazard({ x, y, w, h, s = 18, sh }: { x: number; y: number; w: number; h: number; s?: number; sh?: boolean | number }) {
  const d: string[] = [];
  for (let i = x + 3; i + h + s / 2 <= x + w - 2; i += s) d.push(`M${i} ${y + h}L${i + h} ${y}L${i + h + s / 2} ${y}L${i + s / 2} ${y + h}Z`);
  const o = off(sh);
  return (
    <>
      {o ? <rect x={x + o} y={y + o} width={w} height={h} rx={3} fill={INK} stroke={INK} strokeWidth={SW} /> : null}
      <rect x={x} y={y} width={w} height={h} rx={3} fill={SUN} />
      <path d={d.join("")} fill={INK} />
      <rect x={x} y={y} width={w} height={h} rx={3} fill="none" stroke={INK} strokeWidth={SW} />
    </>
  );
}

/** Wheel: ink tire, concrete hub, spinning spokes. */
function Wheel({ cx, cy, r, t = 0.5 }: { cx: number; cy: number; r: number; t?: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={INK} />
      <circle cx={cx} cy={cy} r={r * 0.5} fill={CONC} stroke={INK} strokeWidth={SW * 0.7} />
      <g {...a("spin", t)}>
        <circle cx={cx} cy={cy} r={r * 0.5} fill="none" />
        <path d={`M${cx - r * 0.42} ${cy}H${cx + r * 0.42}M${cx} ${cy - r * 0.42}V${cy + r * 0.42}`} stroke={INK} strokeWidth={SW * 0.8} strokeLinecap="round" />
      </g>
    </>
  );
}

/** Map pin with its tip at (0,0). */
function Pin({ fill, s = 1, dot = WHITE }: { fill: string; s?: number; dot?: string }) {
  return (
    <g transform={s !== 1 ? `scale(${s})` : undefined}>
      <P d="M0 0C-7-14-24-26-24-44A24 24 0 1 1 24-44C24-26 7-14 0 0Z" fill={fill} />
      <circle cx="0" cy="-44" r="9" fill={dot} stroke={INK} strokeWidth={4} />
      <Shine d="M-14-50Q-12-60-4-63" w={4} />
    </g>
  );
}

/** Pin that slams down and bounces (with a landing ring). */
function SlamPin({ x, y, fill, s = 1, dl = 0, t = 3 }: { x: number; y: number; fill: string; s?: number; dl?: number; t?: number }) {
  return (
    <G x={x} y={y}>
      <g {...a("pulse", t, { dl })}>
        <ellipse cx="0" cy="0" rx={22 * s} ry={7 * s} fill="none" stroke={INK} strokeWidth={4} />
      </g>
      <ellipse cx="0" cy="1" rx={12 * s} ry={4 * s} fill={INK} />
      <g {...a("slam", t, { dl, o: "50% 100%" })}>
        <Pin fill={fill} s={s} />
      </g>
    </G>
  );
}

function Cloud({ x, y, s = 1, dl = 0, t = 9, dx = "26px" }: { x: number; y: number; s?: number; dl?: number; t?: number; dx?: string }) {
  return (
    <G x={x} y={y} s={s}>
      <g {...a("drift", t, { dl, v: { "--a": dx } })}>
        <P d="M10 42Q-6 42 0 28Q6 16 20 18Q26 0 48 2Q64 2 68 18Q88 14 90 30Q92 42 78 42Z" fill={WHITE} sh={4} sw={4.5} />
      </g>
    </G>
  );
}

/** Smoke / dust puff that drifts and fades. */
function Puff({ x, y, r, dl = 0, t = 2.4, px = "0px", py = "-60px", fill = WHITE }: { x: number; y: number; r: number; dl?: number; t?: number; px?: string; py?: string; fill?: string }) {
  return (
    <g {...a("puff", t, { dl, v: { "--px": px, "--py": py } })}>
      <circle cx={x} cy={y} r={r} fill={fill} stroke={INK} strokeWidth={4} />
    </g>
  );
}

const CONFETTI = [SUN, ORA, SKY, MINT, LIME, VIO, CHILE, WHITE];
/** Falling confetti — deterministic spots. */
function Confetti({ spots, t = 2.8, fy = "250px" }: { spots: [number, number][]; t?: number; fy?: string }) {
  return (
    <>
      {spots.map(([x, y], i) => (
        <g key={i} {...a("fall", t + (i % 3) * 0.4, { dl: -(i * 0.37) % t, v: { "--fy": fy, "--rz": `${i % 2 ? 300 : -320}deg` } })}>
          {i % 3 === 0 ? (
            <circle cx={x} cy={y} r={5.5} fill={CONFETTI[i % CONFETTI.length]} stroke={INK} strokeWidth={3} />
          ) : (
            <rect x={x - 4} y={y - 9} width={8} height={18} rx={2} fill={CONFETTI[i % CONFETTI.length]} stroke={INK} strokeWidth={3} transform={`rotate(${(i * 47) % 180} ${x} ${y})`} />
          )}
        </g>
      ))}
    </>
  );
}

/** Rotating burst of translucent rays (vintage sticker backdrop). */
function Rays({ cx, cy, r, n = 12, t = 24, fill = WHITE, op = 0.38 }: { cx: number; cy: number; r: number; n?: number; t?: number; fill?: string; op?: number }) {
  const d: string[] = [];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = a0 + Math.PI / n;
    d.push(`M${cx} ${cy}L${(cx + r * Math.cos(a0)).toFixed(1)} ${(cy + r * Math.sin(a0)).toFixed(1)}L${(cx + r * Math.cos(a1)).toFixed(1)} ${(cy + r * Math.sin(a1)).toFixed(1)}Z`);
  }
  return (
    <g {...a("spin", t)}>
      <circle cx={cx} cy={cy} r={r} fill="none" />
      <path d={d.join("")} fill={fill} opacity={op} />
    </g>
  );
}

/** Halftone dot patch (static accent). */
function Halftone({ x, y, cols, rows, gap = 14, r = 3.2, c = INK, op = 0.22 }: { x: number; y: number; cols: number; rows: number; gap?: number; r?: number; c?: string; op?: number }) {
  const dots: ReactNode[] = [];
  for (let j = 0; j < rows; j++)
    for (let i = 0; i < cols; i++) {
      const rr = r * (1 - (i + j) / (cols + rows));
      if (rr > 0.6) dots.push(<circle key={`${i}-${j}`} cx={x + i * gap + (j % 2) * (gap / 2)} cy={y + j * gap} r={rr} />);
    }
  return (
    <g fill={c} opacity={op}>
      {dots}
    </g>
  );
}

/** Work glove / hand, wrist at (0,0), fingers up, thumb on the -x side. */
function Hand({ fill, cuff }: { fill: string; cuff?: string }) {
  return (
    <>
      <P d="M-30-58Q-50-62-56-84Q-59-96-50-98Q-42-99-38-88Q-34-78-24-76Z" fill={fill} sh={false} />
      <R x={-30} y={-124} w={15} h={70} r={7.5} fill={fill} sh={false} />
      <R x={-15} y={-134} w={15} h={80} r={7.5} fill={fill} sh={false} />
      <R x={0} y={-130} w={15} h={76} r={7.5} fill={fill} sh={false} />
      <R x={15} y={-116} w={14} h={62} r={7} fill={fill} sh={false} />
      <R x={-32} y={-78} w={64} h={80} r={18} fill={fill} sh={false} />
      <Shine d="M-20-60Q-20-68-12-70" w={4.5} />
      {cuff ? <R x={-36} y={-6} w={72} h={24} r={6} fill={cuff} sh={false} /> : null}
    </>
  );
}

type Hat = "casco" | "gorra" | "chongo";
/** Bust of a worker: head centre at (0,0), torso to y=+180. */
function Worker({ skin, hat, shirt, outfit, waveSide, dl = 0 }: { skin: string; hat: Hat; shirt: string; outfit: "chaleco" | "mandil" | "overol"; waveSide: 1 | -1; dl?: number }) {
  const arm = (
    <G x={waveSide * 52} y={70} r={waveSide * 28}>
      <g {...a("wave", 2.2, { dl, o: "50% 100%", v: { "--a": `${waveSide * 16}deg` } })}>
        <R x={-17} y={-80} w={34} h={96} r={17} fill={shirt} />
        <G y={-74} s={0.62}>
          <Hand fill={outfit === "chaleco" ? SUN : skin} cuff={outfit === "chaleco" ? ORA : undefined} />
        </G>
      </g>
    </G>
  );
  return (
    <g {...a("bob", 2.2, { dl: dl - 0.4, v: { "--a": "-5px" } })}>
      {arm}
      {/* torso */}
      <P d="M-66 180V104Q-66 56-24 52H24Q66 56 66 104V180Z" fill={shirt} />
      {outfit === "chaleco" ? (
        <>
          <P d="M-60 180V100Q-58 62-26 56L-12 120V180Z" fill={ORA} sh={false} sw={4} />
          <P d="M60 180V100Q58 62 26 56L12 120V180Z" fill={ORA} sh={false} sw={4} />
          <rect x={-60} y={132} width={48} height={11} fill={CONC} stroke={INK} strokeWidth={3.5} />
          <rect x={12} y={132} width={48} height={11} fill={CONC} stroke={INK} strokeWidth={3.5} />
        </>
      ) : null}
      {outfit === "mandil" ? (
        <>
          <L d="M-22 54L-28 96M22 54L28 96" w={6} />
          <P d="M-34 96H34V180H-34Z" fill={LIME} sh={false} sw={4.5} />
          <R x={-18} y={124} w={36} h={26} r={6} fill={WHITE} sh={false} sw={4} />
        </>
      ) : null}
      {outfit === "overol" ? (
        <>
          <L d="M-34 58L-30 112M34 58L30 112" w={10} c={INK} />
          <L d="M-34 58L-30 112M34 58L30 112" w={4} c={DENIM} />
          <P d="M-40 110H40V180H-40Z" fill={DENIM} sh={false} sw={4.5} />
          <circle cx={-30} cy={114} r={5} fill={SUN} stroke={INK} strokeWidth={3} />
          <circle cx={30} cy={114} r={5} fill={SUN} stroke={INK} strokeWidth={3} />
          <R x={-18} y={128} w={36} h={22} r={4} fill={SKY} sh={false} sw={4} />
        </>
      ) : null}
      {/* neck + head */}
      <rect x={-15} y={30} width={30} height={28} fill={skin} stroke={INK} strokeWidth={SW} />
      <circle cx={-38} cy={6} r={11} fill={skin} stroke={INK} strokeWidth={SW} />
      <circle cx={38} cy={6} r={11} fill={skin} stroke={INK} strokeWidth={SW} />
      <R x={-38} y={-44} w={76} h={88} r={34} fill={skin} sh={4} />
      {hat === "chongo" ? (
        <>
          <C cx={0} cy={-56} r={17} fill={INK} sh={false} />
          <P d="M-39 2Q-44-50 0-50Q44-50 39 2Q36-26 12-30Q-14-34-39 2Z" fill="#2B1B10" sh={false} />
          <path d="M-36-20Q0-46 36-20" fill="none" stroke={CHILE} strokeWidth={7} strokeLinecap="round" />
        </>
      ) : null}
      {/* face: confident, simple */}
      <ellipse cx={-14} cy={0} rx={4.5} ry={6.5} fill={INK} />
      <ellipse cx={14} cy={0} rx={4.5} ry={6.5} fill={INK} />
      <L d="M-25-13L-6-11M6-11L25-13" w={6} />
      <L d="M-2 6Q6 12 0 16" w={4} />
      <P d="M-17 22Q0 40 17 22Z" fill={WHITE} sh={false} sw={4} />
      {hat === "casco" ? (
        <>
          <P d="M-44-26Q-44-76 0-76Q44-76 44-26Z" fill={SUN} sh={4} />
          <L d="M0-75V-30" w={4} />
          <R x={-56} y={-32} w={112} h={13} r={6.5} fill={SUN} sh={false} />
          <Shine d="M-30-44Q-28-62-14-68" w={5} />
        </>
      ) : null}
      {hat === "gorra" ? (
        <>
          <P d="M-41-20Q-41-68 0-68Q41-68 41-20Z" fill={CHILE} sh={4} />
          <P d="M-46-20Q0-34 46-20Q0-4-46-20Z" fill={CHILE} sh={false} sw={4.5} />
          <circle cx={0} cy={-68} r={5} fill={INK} />
          <Shine d="M-26-38Q-24-54-12-60" w={5} />
        </>
      ) : null}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Scenes                                                              */
/* ------------------------------------------------------------------ */

function House({ x, w, h, fill, tank, win = 1 }: { x: number; w: number; h: number; fill: string; tank?: boolean; win?: number }) {
  const y = 232 - h;
  return (
    <>
      {tank ? (
        <>
          <R x={x + w - 34} y={y - 22} w={22} h={24} r={4} fill={INK} sh={false} sw={4} />
          <rect x={x + w - 36} y={y - 26} width={26} height={7} rx={3} fill={INK} />
        </>
      ) : null}
      <R x={x} y={y} w={w} h={h} r={3} fill={fill} />
      <rect x={x - 3} y={y - 4} width={w + 6} height={10} rx={3} fill={fill} stroke={INK} strokeWidth={4} />
      <R x={x + 12} y={232 - 44} w={20} h={44} r={3} fill={INK} sh={false} sw={4} />
      {Array.from({ length: win }, (_, i) => (
        <R key={i} x={x + w - 34} y={y + 16 + i * 34} w={22} h={22} r={3} fill={SKY} sh={false} sw={4} />
      ))}
    </>
  );
}

function Bus() {
  return (
    <>
      <R x={0} y={-66} w={156} h={56} r={14} fill={ORA} />
      <rect x={4} y={-28} width={148} height={8} fill={WHITE} stroke={INK} strokeWidth={3.5} />
      {[10, 40, 70, 100].map((x) => (
        <R key={x} x={x} y={-56} w={24} h={20} r={4} fill={SKY} sh={false} sw={4} />
      ))}
      <P d="M130-56H140Q148-56 148-46V-36H130Z" fill={SKY} sh={false} sw={4} />
      <circle cx={150} cy={-18} r={4} fill={SUN} stroke={INK} strokeWidth={3} />
      <Shine d="M14-61H60" w={4} />
      <Wheel cx={34} cy={-10} r={13} />
      <Wheel cx={122} cy={-10} r={13} />
    </>
  );
}

function Pickup({ color }: { color: string }) {
  return (
    <>
      <P d="M0-34H60V-58Q60-62 64-62H92Q100-62 104-54L114-38Q118-34 118-30V-14Q118-10 114-10H0Z" fill={color} />
      <P d="M68-54H90L100-38H68Z" fill={SKY} sh={false} sw={4} />
      <g {...a("flash", 0.6)}>
        <rect x={72} y={-72} width={14} height={10} rx={3} fill={ORA} stroke={INK} strokeWidth={3.5} />
      </g>
      <Shine d="M8-28H40" w={4} />
      <Wheel cx={26} cy={-10} r={12} />
      <Wheel cx={94} cy={-10} r={12} />
    </>
  );
}

function Car({ color }: { color: string }) {
  // faces left
  return (
    <>
      <P d="M4-12Q0-12 0-18V-30Q0-36 8-38L26-42L40-60Q44-64 52-64H86Q94-64 98-58L108-42Q114-40 114-32V-18Q114-12 108-12Z" fill={color} />
      <P d="M44-56H62V-42H34Z" fill={SKY} sh={false} sw={4} />
      <P d="M70-56H86Q90-56 92-52L98-42H70Z" fill={SKY} sh={false} sw={4} />
      <circle cx={6} cy={-26} r={4} fill={SUN} stroke={INK} strokeWidth={3} />
      <Wheel cx={26} cy={-12} r={12} />
      <Wheel cx={88} cy={-12} r={12} />
    </>
  );
}

function Barrio() {
  const W = 900;
  const dashes = [];
  for (let x = -60; x < W + 120; x += 70) dashes.push(<rect key={x} x={x} y={268} width={34} height={7} rx={3} fill={SUN} />);
  return (
    <>
      {/* sun */}
      <G x={120} y={74}>
        <g {...a("spin", 16)}>
          <circle r={64} fill="none" />
          {Array.from({ length: 10 }, (_, i) => (
            <rect key={i} x={-5} y={-62} width={10} height={18} rx={5} fill={SUN} stroke={INK} strokeWidth={4} transform={`rotate(${i * 36})`} />
          ))}
        </g>
        <C cx={0} cy={0} r={36} fill={SUN} />
        <Shine d="M-20-12Q-16-24-4-26" />
      </G>
      <Cloud x={250} y={40} s={0.9} />
      <Cloud x={640} y={22} s={1.05} dl={-4} dx="-30px" />
      <Cloud x={790} y={70} s={0.7} dl={-2} t={7} />
      {/* Sierra de Zapalinamé */}
      <P d="M-10 196L60 150L118 172L196 104L252 142L330 92L412 152L472 124L556 160L640 98L724 142L792 112L862 150L910 132V232H-10Z" fill={DENIM} sh={false} />
      <path d="M196 104L214 136L226 126L236 138M330 92L348 124L362 114L374 132M640 98L656 128L670 118L682 134M792 112L806 134L818 128" fill="none" stroke={SKY} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      {/* houses + plant + cathedral */}
      <House x={14} w={92} h={72} fill={SUN} tank />
      <House x={112} w={70} h={98} fill={ORA} win={2} />
      {/* factory */}
      <G>
        <R x={330} y={66} w={26} h={110} r={3} fill={CONC} />
        <Hazard x={330} y={78} w={26} h={14} s={12} sh={false} />
        <Puff x={343} y={52} r={13} />
        <Puff x={346} y={52} r={16} dl={-0.8} px="10px" py="-56px" />
        <Puff x={340} y={52} r={11} dl={-1.6} px="-6px" />
        <P d="M190 232V152L232 128V152L274 128V152L316 128V152L362 128V232Z" fill={CONC} />
        <path d="M232 132V152M274 132V152M316 132V152" stroke={INK} strokeWidth={4} />
        {[202, 244, 286, 328].map((x) => (
          <rect key={x} x={x} y={164} width={22} height={16} rx={2} fill={SKY} stroke={INK} strokeWidth={4} />
        ))}
        <R x={236} y={192} w={70} h={40} r={2} fill={WHITE} sh={false} sw={4} />
        <path d="M240 202H302M240 212H302M240 222H302" stroke={INK} strokeWidth={3} />
        <Hazard x={232} y={186} w={78} h={10} s={14} sh={false} />
      </G>
      <House x={368} w={70} h={80} fill={MINT} />
      {/* cathedral */}
      <G>
        <P d="M478 232V150L515 118L552 150V232Z" fill={CREAM} />
        <circle cx={515} cy={158} r={12} fill={SKY} stroke={INK} strokeWidth={4} />
        <P d="M498 232V196Q498 178 515 178Q532 178 532 196V232Z" fill={VIO} sh={false} sw={4} />
        {[446, 550].map((x) => (
          <g key={x}>
            <R x={x} y={92} w={34} h={140} r={2} fill={CREAM} />
            <P d={`M${x - 2} 94Q${x - 2} 70 ${x + 17} 70Q${x + 36} 70 ${x + 36} 94Z`} fill={ORA} sh={false} sw={4} />
            <L d={`M${x + 17} 70V54`} w={4} />
            <circle cx={x + 17} cy={52} r={4} fill={SUN} stroke={INK} strokeWidth={3} />
            <P d={`M${x + 10} 132V118Q${x + 10} 108 ${x + 17} 108Q${x + 24} 108 ${x + 24} 118V132Z`} fill={INK} sh={false} sw={3} />
            <P d={`M${x + 10} 180V166Q${x + 10} 156 ${x + 17} 156Q${x + 24} 156 ${x + 24} 166V180Z`} fill={INK} sh={false} sw={3} />
          </g>
        ))}
        <Shine d="M452 110V140" w={4} />
      </G>
      <House x={594} w={82} h={92} fill={SKY} tank win={2} />
      <House x={682} w={70} h={70} fill={CHILE} />
      <House x={758} w={86} h={104} fill={LIME} tank win={2} />
      <House x={850} w={70} h={76} fill={ORA} />
      {/* street */}
      <rect x={-10} y={232} width={W + 20} height={14} fill={CONC} stroke={INK} strokeWidth={4} />
      <rect x={-10} y={246} width={W + 20} height={60} fill={ROAD} />
      <g {...a("scroll", 1.4, { v: { "--to": "70px" } })}>{dashes}</g>
      {/* traffic */}
      <G y={262}>
        <G x={300}>
          <g {...a("drive", 10, { v: { "--from": "-520px", "--to": "800px" } })}>
            <g {...a("rumble", 0.4)}>
              <Bus />
            </g>
          </g>
        </G>
        <G x={700}>
          <g {...a("drive", 10, { dl: -6, v: { "--from": "-860px", "--to": "380px" } })}>
            <g {...a("rumble", 0.35, { dl: -0.1 })}>
              <Pickup color={MINT} />
            </g>
          </g>
        </G>
      </G>
      <G y={300}>
        <G x={560}>
          <g {...a("drive", 6.5, { dl: -2, v: { "--from": "520px", "--to": "-760px" } })}>
            <g {...a("rumble", 0.3)}>
              <Car color={DENIM} />
            </g>
          </g>
        </G>
      </G>
    </>
  );
}

function House3D() {
  return (
    <>
      <R x={108} y={150} w={84} h={70} r={4} fill={SUN} />
      <R x={164} y={112} w={16} h={34} r={2} fill={CONC} />
      <P d="M94 156L150 106L206 156Z" fill={ORA} />
      <Shine d="M118 140L144 116" w={5} />
      <R x={138} y={180} w={24} h={40} r={4} fill={VIO} sh={false} sw={4} />
      <R x={116} y={166} w={16} h={16} r={2} fill={SKY} sh={false} sw={4} />
      <R x={168} y={166} w={16} h={16} r={2} fill={SKY} sh={false} sw={4} />
    </>
  );
}

function Radar() {
  return (
    <>
      <g {...a("pulse", 2.6, { v: { "--s0": "0.3" } })}>
        <circle cx={150} cy={175} r={138} fill="none" stroke={ORA} strokeWidth={9} />
      </g>
      <g {...a("pulse", 2.6, { dl: -1.3, v: { "--s0": "0.3" } })}>
        <circle cx={150} cy={175} r={138} fill="none" stroke={WHITE} strokeWidth={7} />
      </g>
      <circle cx={150} cy={175} r={70} fill="none" stroke={INK} strokeWidth={4} strokeDasharray="2 14" strokeLinecap="round" />
      <circle cx={150} cy={175} r={112} fill="none" stroke={INK} strokeWidth={4} strokeDasharray="2 14" strokeLinecap="round" />
      {/* sweeping beam */}
      <g {...a("spin", 4.5)}>
        <circle cx={150} cy={175} r={112} fill="none" />
        <path d="M150 175L262 175A112 112 0 0 0 229 96Z" fill={WHITE} opacity={0.35} />
        <L d="M150 175H262" w={4} />
      </g>
      <ellipse cx={150} cy={226} rx={84} ry={14} fill={INK} />
      <ellipse cx={150} cy={221} rx={84} ry={14} fill={MINT} stroke={INK} strokeWidth={4} />
      <House3D />
      <SlamPin x={56} y={108} fill={CHILE} s={0.8} dl={0} />
      <SlamPin x={248} y={96} fill={SUN} s={0.9} dl={-0.75} />
      <SlamPin x={262} y={252} fill={SKY} s={0.75} dl={-1.5} />
      <SlamPin x={44} y={250} fill={LIME} s={0.85} dl={-2.25} />
    </>
  );
}

function Parcel({ x, y, w, h }: { x: number; y: number; w: number; h: number }) {
  return (
    <>
      <R x={x} y={y} w={w} h={h} r={4} fill={KRAFT} />
      <rect x={x + w / 2 - 6} y={y} width={12} height={h} fill={CREAM} stroke={INK} strokeWidth={3} />
      <L d={`M${x + 8} ${y + 10}H${x + w / 2 - 12}`} w={4} c={WHITE} />
    </>
  );
}

function Reparto() {
  const dashes = [];
  for (let x = -80; x < 700; x += 80) dashes.push(<rect key={x} x={x} y={272} width={44} height={9} rx={4} fill={SUN} />);
  return (
    <>
      <Halftone x={420} y={40} cols={10} rows={6} gap={16} r={4} />
      <Cloud x={430} y={34} s={0.8} t={1.6} dx="-40px" />
      <rect x={-10} y={254} width={620} height={60} fill={ROAD} />
      <g {...a("scroll", 0.45, { v: { "--to": "-80px" } })}>{dashes}</g>
      {/* speed lines */}
      {[
        [26, 112, 90],
        [6, 150, 120],
        [40, 186, 80],
        [10, 220, 110],
      ].map(([x, y, w], i) => (
        <g key={i} {...a("speed", 0.7, { dl: -i * 0.18 })}>
          <rect x={x} y={y} width={w} height={11} rx={5.5} fill={WHITE} stroke={INK} strokeWidth={4} />
        </g>
      ))}
      <Puff x={150} y={244} r={14} t={0.9} px="-70px" py="-14px" />
      <Puff x={150} y={248} r={10} t={0.9} dl={-0.45} px="-60px" py="-6px" />
      <G x={160}>
        <g {...a("drift", 2.4, { v: { "--a": "14px" } })}>
          <g {...a("rumble", 0.32)}>
            {/* parcels on the roof rack */}
            <g {...a("hop", 0.64, { v: { "--a": "-9px" } })}>
              <Parcel x={18} y={36} w={74} h={52} />
            </g>
            <g {...a("hop", 0.64, { dl: -0.2, v: { "--a": "-14px" } })}>
              <Parcel x={34} y={-4} w={46} h={38} />
            </g>
            <g {...a("hop", 0.64, { dl: -0.4, v: { "--a": "-7px" } })}>
              <Parcel x={104} y={46} w={62} h={42} />
            </g>
            <rect x={12} y={86} width={180} height={8} rx={4} fill={INK} />
            {/* body */}
            <R x={0} y={92} w={258} h={152} r={18} fill={SUN} />
            <P d="M250 128H318Q334 128 344 146L368 190Q372 198 372 206V236Q372 244 364 244H250Z" fill={SUN} />
            <rect x={0} y={174} width={372} height={22} fill={ORA} stroke={INK} strokeWidth={SW} />
            <P d="M264 140H316Q326 140 332 152L350 184H264Z" fill={SKY} sh={false} sw={4.5} />
            <Shine d="M274 172L296 150" />
            <Shine d="M18 114V150" w={6} />
            <L d="M200 100V170M250 132V242" w={4} />
            <rect x={210} y={124} width={30} height={8} rx={4} fill={INK} />
            <Hazard x={8} y={212} w={60} h={22} s={18} sh={false} />
            <circle cx={364} cy={214} r={9} fill={WHITE} stroke={INK} strokeWidth={4} />
            <R x={340} y={232} w={40} h={14} r={6} fill={CONC} sh={false} sw={4} />
            <path d="M40 244A34 34 0 0 1 108 244M262 244A34 34 0 0 1 330 244" fill={INK} />
            <Wheel cx={74} cy={246} r={28} t={0.3} />
            <Wheel cx={296} cy={246} r={28} t={0.3} />
          </g>
        </g>
      </G>
    </>
  );
}

function Exito({ animated }: { animated: boolean }) {
  return (
    <>
      <Rays cx={150} cy={130} r={170} />
      <Puff x={30} y={274} r={10} t={1.8} px="-22px" py="-26px" fill={CREAM} />
      <Puff x={270} y={274} r={10} t={1.8} dl={-0.9} px="22px" py="-26px" fill={CREAM} />
      <Puff x={50} y={280} r={7} t={1.8} dl={-0.5} px="-28px" py="-14px" fill={CREAM} />
      <Puff x={250} y={280} r={7} t={1.8} dl={-1.3} px="28px" py="-14px" fill={CREAM} />
      {/* podium */}
      <R x={34} y={214} w={80} h={70} r={6} fill={SKY} />
      <R x={186} y={230} w={80} h={54} r={6} fill={ORA} />
      <R x={110} y={190} w={80} h={94} r={6} fill={SUN} />
      <P d="M150 214L157 230L174 231L161 242L166 259L150 249L134 259L139 242L126 231L143 230Z" fill={WHITE} sh={false} sw={4} />
      {[
        [42, 222],
        [106, 222],
        [194, 238],
        [258, 238],
        [118, 198],
        [182, 198],
      ].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r={3.5} fill={INK} />
      ))}
      <Shine d="M120 210V230" />
      <rect x={18} y={282} width={264} height={12} rx={6} fill={INK} />
      {/* champion */}
      <G x={92} y={58}>
        <g {...a("hop", 1.1, { v: { "--a": "-10px" } })}>
          <Mascot mood="festeja" prop="trofeo" size={116} animated={animated} />
        </g>
      </G>
      <Confetti
        spots={[
          [30, 20],
          [70, 6],
          [110, 30],
          [190, 10],
          [230, 34],
          [270, 14],
          [50, 60],
          [250, 70],
          [150, 0],
          [20, 110],
          [282, 120],
          [130, 54],
        ]}
        fy="220px"
      />
    </>
  );
}

function MiniMap() {
  return (
    <>
      <R x={20} y={148} w={262} h={136} r={20} fill={MINT} />
      <path d="M20 214H282M128 148V284M190 284L282 196" stroke={INK} strokeWidth={18} />
      <path d="M20 214H282M128 148V284M190 284L282 196" stroke={WHITE} strokeWidth={9} />
      <R x={36} y={162} w={74} h={36} r={6} fill={LIME} sh={false} sw={4} />
      <R x={146} y={162} w={56} h={36} r={6} fill={SUN} sh={false} sw={4} />
      <R x={40} y={230} w={70} h={40} r={6} fill={CONC} sh={false} sw={4} />
      <path d="M216 148Q232 170 220 190Q208 210 226 232" fill="none" stroke={INK} strokeWidth={16} />
      <path d="M216 148Q232 170 220 190Q208 210 226 232" fill="none" stroke={SKY} strokeWidth={8} />
      <Shine d="M34 170Q34 160 44 160" />
    </>
  );
}

function Busqueda({ animated }: { animated: boolean }) {
  return (
    <>
      <Halftone x={180} y={20} cols={8} rows={6} gap={15} r={4} />
      <G y={4}>
        <g transform="rotate(-5 150 216)">
          <MiniMap />
        </g>
      </G>
      <SlamPin x={164} y={206} fill={CHILE} dl={0} s={0.85} />
      <SlamPin x={250} y={180} fill={SUN} dl={-1} s={0.8} />
      <SlamPin x={232} y={268} fill={VIO} dl={-2} s={0.8} />
      <G x={6} y={40}>
        <g {...a("bob", 2.4, { v: { "--a": "-7px" } })}>
          <Mascot mood="piensa" prop="lupa" size={124} animated={animated} />
        </g>
      </G>
    </>
  );
}

function Tumbleweed() {
  return (
    <>
      <C cx={0} cy={0} r={22} fill={KRAFT} sw={4.5} sh={false} />
      <path d="M-14-10Q4-20 14 4Q4 18-12 8Q-18-4-2-8Q10-4 4 6M-20 2Q-6 14 8 16M-4-21Q-10-6 6 0" fill="none" stroke={INK} strokeWidth={3.5} strokeLinecap="round" />
    </>
  );
}

function Zee({ x, y, s, dl }: { x: number; y: number; s: number; dl: number }) {
  return (
    <G x={x} y={y} s={s}>
      <g {...a("zz", 2.7, { dl })}>
        <path d="M0 0H18L0 22H18" fill="none" stroke={WHITE} strokeWidth={11} strokeLinecap="round" strokeLinejoin="round" />
        <path d="M0 0H18L0 22H18" fill="none" stroke={INK} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </G>
  );
}

function Vacio({ animated }: { animated: boolean }) {
  return (
    <>
      <Cloud x={40} y={30} s={0.8} t={12} dx="40px" />
      {/* barrier */}
      <L d="M44 248L58 196M96 248L82 196M270 248L284 202M318 248L304 202" w={7} />
      <Hazard x={36} y={188} w={70} h={18} s={16} />
      {/* lot */}
      <P d="M6 246Q187 230 369 246V292Q187 300 6 292Z" fill={CONC} />
      <L d="M60 262L84 270L96 264M250 270L266 262L286 268" w={4} />
      <circle cx={140} cy={278} r={4} fill={INK} />
      <circle cx={330} cy={264} r={3} fill={INK} />
      {/* traffic cone */}
      <G x={296} y={190}>
        <P d="M-24 54L-6 0H6L24 54Z" fill={ORA} />
        <path d="M-15 26H15L18 36H-18Z" fill={WHITE} stroke={INK} strokeWidth={3.5} strokeLinejoin="round" />
        <R x={-32} y={52} w={64} h={10} r={4} fill={ORA} sh={false} sw={4} />
        <Shine d="M-6 10L-12 30" w={4} />
      </G>
      {/* shovel stuck in the ground */}
      <G x={150} y={0}>
        <R x={-6} y={92} w={12} h={150} r={6} fill={KRAFT} sw={4.5} />
        <R x={-18} y={82} w={36} h={12} r={6} fill={KRAFT} sh={false} sw={4.5} />
        <P d="M-20 226H20V250Q20 266 0 272Q-20 266-20 250Z" fill={CONC} sw={4.5} />
      </G>
      {/* napping worker */}
      <G x={160} y={110} r={-6}>
        <g {...a("bob", 3.2, { v: { "--a": "-3px" } })}>
          <Mascot mood="duerme" prop="casco" size={112} animated={animated} />
        </g>
      </G>
      <Zee x={262} y={98} s={1} dl={0} />
      <Zee x={262} y={98} s={0.75} dl={-0.9} />
      <Zee x={262} y={98} s={0.55} dl={-1.8} />
      {/* tumbleweed */}
      <G x={60} y={262}>
        <g {...a("drive", 6, { v: { "--from": "-110px", "--to": "380px" } })}>
          <g {...a("hop", 0.6, { v: { "--a": "-12px" } })}>
            <g {...a("spin", 0.9)}>
              <Tumbleweed />
            </g>
          </g>
        </g>
      </G>
    </>
  );
}

function Contratado() {
  const arm = (fill: string, sleeve: string, cuff: string) => (
    <g {...a("hi5", 2.4, { o: "50% 100%" })}>
      <R x={-31} y={-150} w={62} h={160} r={14} fill={sleeve} />
      <G y={-150}>
        <Hand fill={fill} cuff={cuff} />
      </G>
    </g>
  );
  return (
    <>
      <Halftone x={20} y={170} cols={7} rows={6} gap={15} r={4} />
      <Rays cx={150} cy={96} r={160} n={14} t={30} />
      {/* impact burst */}
      <G x={150} y={70}>
        <g {...a("burst", 2.4)}>
          <P d="M0-62L14-30L50-44L32-12L66 0L32 12L50 44L14 30L0 62L-14 30L-50 44L-32 12L-66 0L-32-12L-50-44L-14-30Z" fill={SUN} />
          <L d="M-86-30L-106-44M86-30L106-44M-90 20L-112 26M90 20L112 26M0-84V-106" w={7} />
        </g>
      </G>
      {/* worker glove (left) + boss hand (right, mirrored) */}
      <G x={74} y={296} r={13}>
        {arm(SUN, DENIM, ORA)}
      </G>
      <g transform="translate(226 296) scale(-1 1) rotate(13)">{arm(SKIN[1], VIO, WHITE)}</g>
      <Confetti
        spots={[
          [24, 10],
          [70, 30],
          [120, 0],
          [190, 24],
          [240, 6],
          [280, 40],
          [40, 80],
          [262, 96],
          [150, 20],
          [12, 140],
        ]}
        fy="230px"
      />
    </>
  );
}

function Customer() {
  return (
    <>
      {/* legs swing from the hip */}
      <G x={-10} y={70}>
        <g {...a("swing", 0.8, { o: "50% 0%", v: { "--a": "14deg" } })}>
          <R x={-9} y={0} w={18} h={52} r={6} fill={DENIM} sh={false} sw={4.5} />
          <rect x={-12} y={46} width={26} height={12} rx={6} fill={INK} />
        </g>
      </G>
      <G x={10} y={70}>
        <g {...a("swing", 0.8, { dl: -0.4, o: "50% 0%", v: { "--a": "14deg" } })}>
          <R x={-9} y={0} w={18} h={52} r={6} fill={DENIM} sh={false} sw={4.5} />
          <rect x={-12} y={46} width={26} height={12} rx={6} fill={INK} />
        </g>
      </G>
      <P d="M-26 76V30Q-26 10-6 10H6Q26 10 26 30V76Z" fill={CHILE} />
      {/* arm + bag */}
      <G x={20} y={24}>
        <g {...a("swing", 0.8, { dl: -0.4, o: "50% 0%", v: { "--a": "10deg" } })}>
          <R x={-7} y={0} w={14} h={44} r={7} fill={CHILE} sh={false} sw={4.5} />
          <L d="M-6 44Q0 34 6 44" w={4} />
          <R x={-14} y={44} w={30} h={30} r={5} fill={SUN} sh={false} sw={4.5} />
        </g>
      </G>
      <rect x={-7} y={-6} width={14} height={18} fill={SKIN[2]} stroke={INK} strokeWidth={4.5} />
      <P d="M-4-50Q-30-50-30-26Q-30-4-8-2Q-24 4-30 22Q-34-4-34-24Q-34-54-4-54Z" fill="#2B1B10" sh={false} sw={4} />
      <R x={-24} y={-48} w={46} h={50} r={20} fill={SKIN[2]} sh={3} sw={4.5} />
      <P d="M-24-22Q-26-52 0-52Q24-52 22-26Q10-38-24-22Z" fill="#2B1B10" sh={false} sw={4} />
      <ellipse cx={6} cy={-20} rx={3} ry={4.5} fill={INK} />
      <ellipse cx={16} cy={-20} rx={3} ry={4.5} fill={INK} />
      <L d="M4-10Q11-5 17-10" w={4} />
    </>
  );
}

function Negocio() {
  const stripes = [];
  for (let i = 0; i < 8; i++) stripes.push(<rect key={i} x={30 + i * 30} y={100} width={30} height={30} fill={i % 2 ? WHITE : ORA} />);
  const scallops = [];
  for (let i = 0; i < 8; i++)
    scallops.push(<path key={i} d={`M${30 + i * 30} 128A15 15 0 0 0 ${60 + i * 30} 128Z`} fill={i % 2 ? WHITE : ORA} stroke={INK} strokeWidth={4.5} strokeLinejoin="round" />);
  return (
    <>
      <Halftone x={196} y={10} cols={7} rows={4} gap={14} r={3.6} />
      {/* building */}
      <R x={40} y={44} w={220} h={238} r={8} fill={CREAM} />
      <R x={56} y={56} w={188} h={34} r={6} fill={VIO} sh={false} sw={4.5} />
      {[70, 230].map((x) => (
        <circle key={x} cx={x} cy={73} r={5} fill={SUN} stroke={INK} strokeWidth={3} />
      ))}
      <rect x={92} y={66} width={116} height={14} rx={7} fill={WHITE} opacity={0.9} />
      {/* awning */}
      <rect x={28} y={98} width={244} height={8} rx={4} fill={INK} />
      <g {...a("flutter", 1.4, { o: "50% 0%" })}>
        {stripes}
        <rect x={30} y={100} width={240} height={30} fill="none" stroke={INK} strokeWidth={SW} />
        {scallops}
      </g>
      {/* window with shelves */}
      <R x={56} y={156} w={116} h={90} r={6} fill={SKY} sh={false} />
      <path d="M58 190H170M58 222H170" stroke={INK} strokeWidth={4} />
      {[
        [66, 172, SUN],
        [86, 168, CHILE],
        [108, 174, MINT],
        [132, 166, ORA],
        [72, 202, LIME],
        [100, 200, WHITE],
        [140, 204, SUN],
      ].map(([x, y, c], i) => (
        <rect key={i} x={x as number} y={y as number} width={16} height={190 - (y as number) < 20 ? 190 - (y as number) : 20} rx={3} fill={c as string} stroke={INK} strokeWidth={3.5} />
      ))}
      <Shine d="M150 164L164 178" />
      {/* door + swinging sign */}
      <R x={188} y={152} w={60} h={130} r={6} fill={DENIM} sh={false} />
      <R x={198} y={164} w={40} h={50} r={5} fill={SKY} sh={false} sw={4} />
      <circle cx={238} cy={228} r={4} fill={SUN} stroke={INK} strokeWidth={3} />
      <G x={218} y={160}>
        <g {...a("swing", 1.6, { o: "50% 0%", v: { "--a": "9deg" } })}>
          <L d="M0 0L-14 18M0 0L14 18" w={3.5} />
          <circle cx={0} cy={0} r={3.5} fill={INK} />
          <R x={-26} y={16} w={52} h={26} r={8} fill={LIME} sw={4} sh={3} />
          <circle cx={-13} cy={29} r={4} fill={INK} />
          <rect x={-4} y={25} width={22} height={8} rx={4} fill={INK} />
        </g>
      </G>
      {/* plant */}
      <G x={26} y={230}>
        <g {...a("swing", 2.4, { o: "50% 100%", v: { "--a": "5deg" } })}>
          <P d="M0 6Q-26-30-6-48Q4-24 0 6Z" fill={MINT} sw={4} sh={false} />
          <P d="M2 6Q30-26 18-52Q-2-30 2 6Z" fill={MINT} sw={4} sh={false} />
          <P d="M0 6Q-4-40 4-62Q14-36 0 6Z" fill={LIME} sw={4} sh={false} />
        </g>
        <P d="M-20 4H22L16 48H-14Z" fill={ORA} sw={4.5} />
      </G>
      {/* sidewalk */}
      <rect x={-6} y={280} width={312} height={16} rx={4} fill={CONC} stroke={INK} strokeWidth={4} />
      {/* customer walking in */}
      <G x={118} y={190} s={0.8}>
        <g {...a("bob", 0.4, { v: { "--a": "-4px" } })}>
          <Customer />
        </g>
      </G>
    </>
  );
}

function ThumbsUp() {
  return (
    <>
      <R x={-36} y={0} w={60} h={90} r={14} fill={DENIM} />
      <R x={-46} y={-14} w={76} h={24} r={6} fill={ORA} sh={false} sw={4.5} />
      <R x={-26} y={-104} w={26} h={60} r={13} fill={SUN} sh={false} sw={4.5} />
      <R x={-44} y={-62} w={74} h={52} r={16} fill={SUN} sw={4.5} />
      <L d="M10-50H30M10-36H30M10-22H28" w={4} />
      <Shine d="M-32-48Q-32-56-24-56" w={4.5} />
    </>
  );
}

function Whatsapp() {
  return (
    <>
      <Halftone x={14} y={18} cols={6} rows={9} gap={15} r={4} />
      {/* ringing marks */}
      <g {...a("flash", 0.8)}>
        <L d="M232 50L252 34M240 76L264 72M216 32L222 10" w={7} />
      </g>
      <G x={140} y={150} r={-7}>
        <g {...a("shake", 2.6, { v: { "--a": "4deg" } })}>
          <R x={-74} y={-128} w={148} h={256} r={28} fill={INK} sh={6} />
          <R x={-62} y={-108} w={124} h={208} r={14} fill={CREAM} sh={false} sw={3} />
          <rect x={-18} y={-120} width={36} height={6} rx={3} fill={CONC} />
          <g {...a("pop", 3.6, { o: "0% 100%" })}>
            <P d="M-54-96H22Q30-96 30-88V-70Q30-62 22-62H-40L-54-54Z" fill={WHITE} sh={3} sw={4} />
            <L d="M-44-84H14M-44-74H0" w={4} c={CONC} />
          </g>
          <g {...a("pop", 3.6, { dl: 0.5, o: "100% 100%" })}>
            <P d="M-18-50H52Q56-50 56-46V-24Q56-18 50-18H50L56-10L36-18H-14Q-18-18-18-22V-46Q-18-50-14-50Z" fill={MINT} sh={3} sw={4} />
            <L d="M-8-38H34" w={4} c={WHITE} />
            <L d="M32-28L36-24L42-31M40-28L44-24L50-31" w={3} />
          </g>
          <g {...a("pop", 3.6, { dl: 1, o: "50% 100%" })}>
            <R x={-54} y={-6} w={108} h={42} r={14} fill={SUN} sh={3} sw={4} />
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <circle key={i} cx={-38 + i * 15.2} cy={15} r={5} fill={INK} />
            ))}
          </g>
          <R x={-54} y={68} w={108} h={22} r={11} fill={WHITE} sh={false} sw={3.5} />
          <circle cx={42} cy={79} r={7} fill={MINT} stroke={INK} strokeWidth={3} />
          <Shine d="M-52 50V60" w={4} />
        </g>
      </G>
      {/* thumbs up */}
      <G x={248} y={222} r={-10} s={0.85}>
        <g {...a("hop", 1.3, { dl: 0.2, v: { "--a": "-16px" } })}>
          <ThumbsUp />
        </g>
      </G>
    </>
  );
}

function Mapa() {
  const route: [number, number][] = [
    [74, 214],
    [92, 200],
    [110, 186],
    [130, 180],
    [150, 176],
    [168, 166],
    [186, 150],
    [202, 138],
    [218, 128],
  ];
  return (
    <>
      <Halftone x={170} y={8} cols={8} rows={3} gap={15} r={4} />
      {/* folded map */}
      <path d="M36 82L114 60L192 82L270 60V258L192 280L114 258L36 280Z" transform="translate(6 6)" fill={INK} stroke={INK} strokeWidth={SW} strokeLinejoin="round" />
      <P d="M36 82L114 60V258L36 280Z" fill={LIME} sh={false} />
      <P d="M114 60L192 82V280L114 258Z" fill={MINT} sh={false} />
      <P d="M192 82L270 60V258L192 280Z" fill={LIME} sh={false} />
      <path d="M36 194L114 172L192 194L270 172M76 72V270" fill="none" stroke={INK} strokeWidth={15} strokeLinejoin="round" />
      <path d="M36 194L114 172L192 194L270 172M76 72V270" fill="none" stroke={WHITE} strokeWidth={7} strokeLinejoin="round" />
      <path d="M232 70Q216 100 236 124Q252 146 232 170" fill="none" stroke={INK} strokeWidth={15} strokeLinecap="round" />
      <path d="M232 70Q216 100 236 124Q252 146 232 170" fill="none" stroke={SKY} strokeWidth={7} strokeLinecap="round" />
      <R x={128} y={208} w={44} h={30} r={6} fill={SUN} sh={false} sw={4} />
      <R x={204} y={208} w={44} h={40} r={6} fill={CONC} sh={false} sw={4} />
      <Shine d="M46 98L70 92" />
      {/* route drawing itself dot by dot */}
      {route.map(([x, y], i) => (
        <g key={i} {...a("blink", 3, { dl: i * 0.14 })}>
          <circle cx={x} cy={y} r={6} fill={CHILE} stroke={INK} strokeWidth={3} />
        </g>
      ))}
      {/* home */}
      <G x={56} y={230}>
        <R x={-14} y={-6} w={28} h={24} r={3} fill={SUN} sh={3} sw={4} />
        <P d="M-20-4L0-22L20-4Z" fill={ORA} sh={false} sw={4} />
      </G>
      <SlamPin x={232} y={118} fill={CHILE} s={1.05} t={3} dl={1.2} />
      <G x={150} y={120}>
        <g {...a("hop", 1.4, { v: { "--a": "-12px" } })}>
          <Pin fill={SKY} s={0.6} />
        </g>
      </G>
      <G x={256} y={236}>
        <g {...a("hop", 1.4, { dl: -0.7, v: { "--a": "-12px" } })}>
          <Pin fill={SUN} s={0.6} />
        </g>
      </G>
    </>
  );
}

function Ahorro() {
  return (
    <>
      <Halftone x={20} y={20} cols={8} rows={5} gap={15} r={4} />
      {/* coins dropping into the slot (behind the body) */}
      {[0, 1, 2].map((i) => (
        <g key={i} {...a("coin", 1.8, { dl: i * 0.6 })}>
          <R x={168} y={60} w={18} h={46} r={9} fill={SUN} sh={false} sw={4.5} />
          <L d="M177 70V96" w={3.5} />
        </g>
      ))}
      {/* steel savings box: safety-yellow plate, orange lid with the coin slot, combination dial, rivets */}
      <G>
        <R x={80} y={258} w={34} h={20} r={5} fill={INK} sh={false} />
        <R x={236} y={258} w={34} h={20} r={5} fill={INK} sh={false} />
        <R x={60} y={112} w={230} h={152} r={16} fill={SUN} />
        <Hazard x={60} y={226} w={230} h={26} s={20} sh={false} />
        <R x={60} y={112} w={230} h={152} r={16} fill="none" sh={false} />
        <R x={50} y={94} w={250} h={30} r={9} fill={ORA} />
        <rect x={148} y={103} width={58} height={12} rx={6} fill={INK} />
        {[
          [78, 140],
          [272, 140],
          [78, 206],
          [272, 206],
        ].map(([cx, cy]) => (
          <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={5} fill={INK} />
        ))}
        <C cx={158} cy={174} r={36} fill={CREAM} />
        <circle cx={158} cy={174} r={22} fill={WHITE} stroke={INK} strokeWidth={4.5} />
        <path d="M158 142V150M158 198V206M126 174H134M182 174H190" stroke={INK} strokeWidth={4.5} strokeLinecap="round" />
        <g {...a("spin", 5)}>
          <circle cx={158} cy={174} r={22} fill="none" />
          <L d="M158 174V156" w={6} />
        </g>
        <circle cx={158} cy={174} r={6} fill={CHILE} stroke={INK} strokeWidth={3} />
        <R x={222} y={146} w={22} h={58} r={9} fill={CONC} />
        <L d="M233 160V190" w={4} />
        <Shine d="M78 162Q80 134 104 128" w={7} />
      </G>
      {/* coin stacks */}
      {[
        [336, 4],
        [384, 6],
        [414, 3],
      ].map(([x, n]) => (
        <g key={x}>
          {Array.from({ length: n }, (_, j) => (
            <g key={j}>
              <ellipse cx={x} cy={276 - j * 12} rx={22} ry={8} fill={INK} />
              <ellipse cx={x} cy={270 - j * 12} rx={22} ry={8} fill={SUN} stroke={INK} strokeWidth={4} />
            </g>
          ))}
        </g>
      ))}
      {/* alarm clock */}
      <G x={378} y={106}>
        <g {...a("shake", 2.2, { o: "50% 100%", v: { "--a": "8deg" } })}>
          <L d="M-34 46L-44 62M34 46L44 62" w={7} />
          <P d="M-48-36A22 22 0 0 1-14-58Z" fill={SUN} />
          <P d="M48-36A22 22 0 0 0 14-58Z" fill={SUN} />
          <C cx={0} cy={0} r={54} fill={SKY} />
          <circle cx={0} cy={0} r={40} fill={WHITE} stroke={INK} strokeWidth={4.5} />
          <path d="M0-34V-26M0 26V34M-34 0H-26M26 0H34" stroke={INK} strokeWidth={5} strokeLinecap="round" />
          <L d="M0 0L-14-10" w={6} />
          <g {...a("spin", 2.2)}>
            <circle cx={0} cy={0} r={28} fill="none" />
            <L d="M0 0V-26" w={5} />
          </g>
          <circle cx={0} cy={0} r={5} fill={CHILE} stroke={INK} strokeWidth={3} />
          <Shine d="M-40-20Q-36-36-22-44" />
        </g>
      </G>
      <rect x={30} y={282} width={410} height={10} rx={5} fill={INK} />
    </>
  );
}

function Equipo() {
  return (
    <>
      <Rays cx={300} cy={150} r={320} n={18} t={40} />
      <Halftone x={20} y={24} cols={8} rows={5} gap={16} r={4.2} />
      <Halftone x={470} y={24} cols={8} rows={5} gap={16} r={4.2} />
      <G x={130} y={130} s={0.9}>
        <Worker skin={SKIN[0]} hat="casco" shirt={DENIM} outfit="chaleco" waveSide={-1} dl={0} />
      </G>
      <G x={470} y={130} s={0.9}>
        <Worker skin={SKIN[2]} hat="gorra" shirt={WHITE} outfit="overol" waveSide={1} dl={-0.7} />
      </G>
      <G x={300} y={116}>
        <Worker skin={SKIN[1]} hat="chongo" shirt={SKY} outfit="mandil" waveSide={1} dl={-1.4} />
      </G>
    </>
  );
}

export function Scene({ name, className, animated = true, title }: SceneProps) {
  const r = SCENE_RATIO[name];
  const w = 300 * r;
  let art: ReactNode;
  switch (name) {
    case "barrio":
      art = <Barrio />;
      break;
    case "radar":
      art = <Radar />;
      break;
    case "reparto":
      art = <Reparto />;
      break;
    case "exito":
      art = <Exito animated={animated} />;
      break;
    case "busqueda":
      art = <Busqueda animated={animated} />;
      break;
    case "vacio":
      art = <Vacio animated={animated} />;
      break;
    case "contratado":
      art = <Contratado />;
      break;
    case "negocio":
      art = <Negocio />;
      break;
    case "whatsapp":
      art = <Whatsapp />;
      break;
    case "mapa":
      art = <Mapa />;
      break;
    case "ahorro":
      art = <Ahorro />;
      break;
    case "equipo":
      art = <Equipo />;
      break;
  }
  return (
    <svg
      viewBox={`0 0 ${w} 300`}
      className={cn("scScene block h-auto w-full overflow-visible", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      data-scene={name}
      data-animated={animated || undefined}
    >
      {title ? <title>{title}</title> : null}
      {/* nested viewport clips bursts, drives and confetti to the scene box (no ids needed) */}
      <svg x={0} y={0} width={w} height={300} overflow="hidden">
        {art}
      </svg>
    </svg>
  );
}
