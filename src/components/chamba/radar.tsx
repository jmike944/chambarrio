import { RADIUS_STOPS, MAX_RADIUS, bandColor, bandFor } from "@/lib/geo";
import type { JobWithDistance } from "@/lib/store";
import { cn } from "@/lib/utils";
import { CategoryArt } from "./job-icons";

/**
 * Cartoon radar: concentric 2/5/10/15 km rings around a little house, a sweeping beam, and
 * every vacancy inside your radius as a tiny category pin that pops in at its real bearing.
 * Square-root scale keeps the 2 km ring readable. Motion is transform/opacity only (the
 * radius disc scales, the beam rotates, pins pop) and freezes under prefers-reduced-motion.
 * Hook-free, so it renders from server or client components.
 */
export function Radar({
  jobs,
  radiusKm,
  bearings,
  compact = false,
  className,
}: {
  jobs: JobWithDistance[];
  radiusKm: number;
  bearings?: Record<string, number>;
  compact?: boolean;
  className?: string;
}) {
  const size = 320;
  const c = size / 2;
  const outer = c - 10;
  const scale = (km: number) => Math.sqrt(Math.min(km, MAX_RADIUS) / MAX_RADIUS) * (outer - 6);
  const visible = jobs.filter((j) => j.km <= MAX_RADIUS);
  const inside = visible.filter((j) => j.km <= radiusKm).toSorted((a, b) => b.km - a.km).slice(-28);
  const outside = visible.filter((j) => j.km > radiusKm);
  const color = bandColor(bandFor(radiusKm));
  const pos = (j: JobWithDistance) => {
    const b = ((bearings?.[j.id] ?? j.bearing) * Math.PI) / 180;
    const r = scale(j.km);
    return { x: c + r * Math.sin(b), y: c - r * Math.cos(b) };
  };
  const beamR = scale(MAX_RADIUS);
  const wedge = (deg: number) => {
    const a = (deg * Math.PI) / 180;
    return `M${c} ${c} L${c} ${c - beamR} A${beamR} ${beamR} 0 0 1 ${c + beamR * Math.sin(a)} ${c - beamR * Math.cos(a)} Z`;
  };

  return (
    <figure className={cn(compact ? "mx-auto w-full max-w-[15rem]" : "mx-auto w-full max-w-[22rem]", className)}>
      <div className="relative">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="block w-full overflow-visible"
          role="img"
          aria-label={`${inside.length} vacantes dentro de ${radiusKm} km, ${visible.length} en un radio de 15 km`}
        >
          {/* plate */}
          <circle cx={c} cy={c + 5} r={outer} fill="var(--foreground)" opacity={0.9} />
          <circle cx={c} cy={c} r={outer} fill="var(--card)" stroke="var(--foreground)" strokeWidth={3} />
          {/* your radius (scales, never re-lays out) */}
          <circle
            cx={c}
            cy={c}
            r={beamR}
            fill={color}
            fillOpacity={0.28}
            stroke={color}
            strokeWidth={3 * (beamR / Math.max(scale(radiusKm), 1))}
            style={{
              transformOrigin: `${c}px ${c}px`,
              scale: `${scale(radiusKm) / beamR}`,
              transition: "scale 600ms var(--ease-spring), fill 400ms, stroke 400ms",
            }}
          />
          {/* sweeping beam */}
          <g className="motion-safe:animate-[spin_5s_linear_infinite]" style={{ transformOrigin: `${c}px ${c}px` }}>
            <path d={wedge(38)} fill={color} opacity={0.22} />
            <path d={wedge(14)} fill={color} opacity={0.28} />
            <line x1={c} y1={c} x2={c} y2={c - beamR} stroke="var(--foreground)" strokeOpacity={0.55} strokeWidth={2.5} strokeLinecap="round" />
          </g>
          {RADIUS_STOPS.map((s) => {
            const on = s <= radiusKm;
            return (
              <g key={s}>
                <circle
                  cx={c}
                  cy={c}
                  r={scale(s)}
                  fill="none"
                  stroke="var(--foreground)"
                  strokeOpacity={on ? 0.5 : 0.25}
                  strokeWidth={s === radiusKm ? 2.5 : 1.5}
                  strokeDasharray={on ? undefined : "4 6"}
                />
              </g>
            );
          })}
          {outside.map((j) => {
            const p = pos(j);
            return <circle key={j.id} cx={p.x} cy={p.y} r={4} fill="var(--foreground)" opacity={0.28} />;
          })}
        </svg>

        {/* category pins */}
        {inside.map((j, i) => {
          const p = pos(j);
          return (
            <span
              key={j.id}
              aria-hidden
              className="absolute size-[10%] -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${(p.x / size) * 100}%`, top: `${(p.y / size) * 100}%` }}
            >
              <span
                className="block size-full animate-pop-in rounded-full border-2 border-[color:var(--ink)] bg-white p-[8%] shadow-[0_2px_0_var(--ink)]"
                style={{ "--i": Math.min(i, 12) } as React.CSSProperties}
              >
                <CategoryArt category={j.category} className="size-full" />
              </span>
            </span>
          );
        })}

        {/* ring labels, drawn above the pins so they always read */}
        {compact ? null : (
          <svg viewBox={`0 0 ${size} ${size}`} aria-hidden className="pointer-events-none absolute inset-0 block size-full overflow-visible">
            {RADIUS_STOPS.map((s) => {
              const on = s <= radiusKm;
              return (
                <g key={s} transform={`translate(${c} ${c - scale(s)})`}>
                  <rect x={-18} y={-10} width={36} height={20} rx={10} fill={on ? "var(--foreground)" : "var(--card)"} stroke="var(--foreground)" strokeOpacity={on ? 1 : 0.35} strokeWidth={1.5} />
                  <text y={4} textAnchor="middle" fontSize="11" fontWeight={800} fill={on ? "var(--card)" : "var(--foreground)"} className="tabular-nums">
                    {s} km
                  </text>
                </g>
              );
            })}
          </svg>
        )}

        {/* home */}
        <span aria-hidden className="absolute top-1/2 left-1/2 size-[17%] -translate-x-1/2 -translate-y-1/2">
          <span className="absolute inset-[-10%] rounded-full bg-[color:var(--limon)] opacity-60 motion-safe:animate-[ping_2.4s_cubic-bezier(0,0,0.2,1)_infinite]" />
          <svg viewBox="0 0 48 48" className="relative block size-full overflow-visible">
            <circle cx="24" cy="24" r="22" fill="#DDF78A" stroke="#160F33" strokeWidth="3" />
            <path d="M13 23 24 13l11 10v12H13Z" fill="#fff" stroke="#160F33" strokeWidth="3" strokeLinejoin="round" />
            <path d="M10 24 24 11l14 13" fill="none" stroke="#4318E0" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="21" y="27" width="6" height="8" rx="1.5" fill="#4318E0" />
          </svg>
        </span>
      </div>
      {compact ? null : (
        <figcaption className="mt-3 text-center text-sm text-muted-foreground">
          Cada pin es una vacante, en la dirección real desde tu casa.
        </figcaption>
      )}
    </figure>
  );
}
