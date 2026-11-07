"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import Map, { Layer, Marker, Source, type MapRef } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import { setWorkerUrl, type Map as MapLibreMap } from "maplibre-gl";

// Turbopack can't resolve MapLibre's bundled worker URL; serve it from /public instead.
setWorkerUrl("/maplibre-gl-worker.mjs");
import { HugeiconsIcon } from "@hugeicons/react";
import { Store01Icon } from "@hugeicons/core-free-icons";
import { useTheme } from "@/components/theme";
import { CATEGORY_BLOCK, CategoryArt } from "@/components/chamba/job-icons";
import type { CategoryId } from "@/lib/data/types";
import { bandColor, bandFor, circlePolygon, formatKm, type LatLng } from "@/lib/geo";
import type { JobWithDistance } from "@/lib/store";
import { cn } from "@/lib/utils";

const STYLE = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/positron",
};

/*
 * Workwear tint for the basemap: sand/concrete land, mint parks, denim water, safety-yellow
 * highways (ink canvas in dark). Applied on top of the stock OpenFreeMap styles (paint only).
 */
type Tint = { bg: string; residential: string; park: string; water: string; building: string; minor: string; major: string; motorway: string };
const TINT: Record<"light" | "dark", Tint> = {
  light: {
    bg: "#f2ead8",
    residential: "#eae0c9",
    park: "#c9ecc9",
    water: "#a9d8fb",
    building: "#dccfb2",
    minor: "#ffffff",
    major: "#ffffff",
    motorway: "#ffd84a",
  },
  dark: {
    bg: "#14121c",
    residential: "#1a1824",
    park: "#14352a",
    water: "#10304f",
    building: "#26232f",
    minor: "#2c2937",
    major: "#3b3748",
    motorway: "#7a5f12",
  },
};

const PAINT: [layer: string, prop: Parameters<MapLibreMap["setPaintProperty"]>[1], key: keyof Tint][] = [
  ["background", "background-color", "bg"],
  ["landuse_residential", "fill-color", "residential"],
  ["park", "fill-color", "park"],
  ["landuse_park", "fill-color", "park"],
  ["landcover_wood", "fill-color", "park"],
  ["water", "fill-color", "water"],
  ["waterway", "line-color", "water"],
  ["building", "fill-color", "building"],
  ["highway_path", "line-color", "minor"],
  ["highway_minor", "line-color", "minor"],
  ["highway_major_inner", "line-color", "major"],
  ["highway_major_subtle", "line-color", "major"],
  ["highway_motorway_inner", "line-color", "motorway"],
  ["highway_motorway_subtle", "line-color", "motorway"],
];

function tintBasemap(map: MapLibreMap, theme: "light" | "dark") {
  const t = TINT[theme];
  try {
    if (!map.getLayer("background") || map.getPaintProperty("background", "background-color") === t.bg) return;
    for (const [layer, prop, key] of PAINT) {
      if (map.getLayer(layer)) map.setPaintProperty(layer, prop, t[key]);
    }
  } catch {
    // Style still swapping — the next styledata event retries.
  }
}

const CONNECTOR_PAINT = {
  light: { color: "#160f33", opacity: 0.7 },
  dark: { color: "#f2efff", opacity: 0.75 },
};

const RADIUS_PAINT = {
  light: { line: "#4318e0", fill: 0.08 },
  dark: { line: "#9d86ff", fill: 0.13 },
};

/** Pin fill per category = its color-block tone (static classes so Tailwind sees them). */
const PIN_BG: Record<(typeof CATEGORY_BLOCK)[keyof typeof CATEGORY_BLOCK], string> = {
  lila: "bg-block-lila",
  chicle: "bg-block-sol",
  limon: "bg-block-limon",
  cielo: "bg-block-cielo",
  sol: "bg-block-sol",
  menta: "bg-block-menta",
  durazno: "bg-block-durazno",
};

const INK = "#160f33";

/** Keep the home/selected pin inside the window left between the floating header and hero card. */
function cameraPadding() {
  if (typeof window === "undefined") return undefined;
  if (window.matchMedia("(min-width: 1024px)").matches) return { top: 70, bottom: 40, left: 0, right: 0 };
  const h = window.innerHeight;
  return { top: 130, bottom: Math.round(Math.min(360, h * 0.42)), left: 0, right: 0 };
}

const ZOOM_FOR_RADIUS: Record<number, number> = { 2: 13.6, 5: 12.3, 10: 11.3, 15: 10.7 };

/** One marker = one branch (sucursal) with every open vacancy there. */
export type BranchPin = {
  /** Branch id. */
  id: string;
  name: string;
  companyId: string;
  companyName: string;
  /** Company has more than one location. */
  multi: boolean;
  colonia: string;
  pos: LatLng;
  km: number;
  /** Vacancies at this branch; may be empty for a sibling branch that isn't hiring. */
  jobs: JobWithDistance[];
  /** Category shown on the pin (the branch's first vacancy). */
  category: CategoryId | null;
};

const vacantes = (n: number) => `${n} ${n === 1 ? "vacante" : "vacantes"}`;

export function JobMap({
  home,
  radiusKm,
  pins,
  selectedId,
  siblings,
  onSelect,
  focus,
}: {
  home: LatLng;
  radiusKm: number;
  /** Branches with at least one vacancy, nearest first. */
  pins: BranchPin[];
  /** Selected branch id. */
  selectedId: string | null;
  /** The selected company's OTHER branches (secondary markers + dashed connectors). */
  siblings: BranchPin[];
  onSelect: (branchId: string) => void;
  /** Changes to this object fly the camera to it. */
  focus: { lat: number; lng: number; zoom?: number } | null;
}) {
  const { resolvedTheme } = useTheme();
  const theme: "light" | "dark" = resolvedTheme === "dark" ? "dark" : "light";
  const themeRef = useRef(theme);
  const mapRef = useRef<MapRef>(null);
  const circle = useMemo(() => circlePolygon(home, radiusKm), [home, radiusKm]);
  const radiusPaint = RADIUS_PAINT[theme];
  const connectorPaint = CONNECTOR_PAINT[theme];
  const selectedPin = pins.find((p) => p.id === selectedId) ?? null;
  const siblingIds = useMemo(() => new Set(siblings.map((b) => b.id)), [siblings]);
  // Branches of the selected company that have no vacancy marker of their own.
  const ghostSiblings = useMemo(() => {
    const pinned = new Set(pins.map((p) => p.id));
    return siblings.filter((b) => !pinned.has(b.id));
  }, [pins, siblings]);
  const connectors = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: selectedPin
        ? siblings.map((b) => ({
            type: "Feature" as const,
            properties: {},
            geometry: {
              type: "LineString" as const,
              coordinates: [
                [selectedPin.pos.lng, selectedPin.pos.lat],
                [b.pos.lng, b.pos.lat],
              ],
            },
          }))
        : [],
    }),
    [selectedPin, siblings],
  );

  useEffect(() => {
    themeRef.current = theme;
    const m = mapRef.current?.getMap();
    if (m?.isStyleLoaded()) tintBasemap(m, theme);
  }, [theme]);

  const onLoad = useCallback(() => {
    const m = mapRef.current?.getMap();
    if (!m) return;
    tintBasemap(m, themeRef.current);
    // Theme switches swap the whole style; re-tint once the new one lands.
    m.on("styledata", () => tintBasemap(m, themeRef.current));
  }, []);

  // Re-frame when the radius or home changes.
  useEffect(() => {
    mapRef.current?.easeTo({
      center: [home.lng, home.lat],
      zoom: ZOOM_FOR_RADIUS[radiusKm] ?? 12.3,
      padding: cameraPadding(),
      duration: 700,
    });
  }, [home, radiusKm]);

  useEffect(() => {
    if (!focus) return;
    mapRef.current?.flyTo({ center: [focus.lng, focus.lat], zoom: focus.zoom ?? 13.6, padding: cameraPadding(), duration: 800 });
  }, [focus]);

  // Nearest pins pop in first (jobs arrive sorted by distance).
  let insideRank = 0;

  return (
    <Map
      ref={mapRef}
      initialViewState={{ longitude: home.lng, latitude: home.lat, zoom: ZOOM_FOR_RADIUS[radiusKm] ?? 12.3, padding: cameraPadding() }}
      mapStyle={theme === "dark" ? STYLE.dark : STYLE.light}
      style={{ width: "100%", height: "100%" }}
      attributionControl={{ compact: true }}
      dragRotate={false}
      touchPitch={false}
      onLoad={onLoad}
    >
      <Source id="radius" type="geojson" data={circle}>
        <Layer id="radius-fill" type="fill" paint={{ "fill-color": radiusPaint.line, "fill-opacity": radiusPaint.fill }} />
        <Layer
          id="radius-line"
          type="line"
          paint={{ "line-color": radiusPaint.line, "line-width": 3, "line-opacity": 0.9, "line-dasharray": [2, 1.4] }}
          layout={{ "line-cap": "round" }}
        />
      </Source>

      {/* "This company is also here": dashed links from the selected branch to its siblings */}
      <Source id="branch-links" type="geojson" data={connectors}>
        <Layer
          id="branch-links-line"
          type="line"
          paint={{
            "line-color": connectorPaint.color,
            "line-width": 2.5,
            "line-opacity": connectorPaint.opacity,
            "line-dasharray": [1.2, 1.6],
          }}
          layout={{ "line-cap": "round", "line-join": "round" }}
        />
      </Source>

      {pins.map((p) => {
        const inside = p.km <= radiusKm;
        const selected = p.id === selectedId;
        const sibling = siblingIds.has(p.id);
        const where = p.multi ? `${p.companyName} · ${p.name}` : p.companyName;
        const label =
          p.jobs.length === 1
            ? `${p.jobs[0].title} en ${where}, a ${formatKm(p.km)}`
            : `${where}: ${vacantes(p.jobs.length)}, a ${formatKm(p.km)}`;

        if (sibling && !inside) {
          return (
            <Marker key={p.id} longitude={p.pos.lng} latitude={p.pos.lat} anchor="center" style={{ zIndex: 2 }}>
              <SiblingMarker pin={p} label={`Otra sucursal. ${label}`} onSelect={() => onSelect(p.id)} />
            </Marker>
          );
        }

        if (!inside && !selected) {
          return (
            <Marker key={p.id} longitude={p.pos.lng} latitude={p.pos.lat} anchor="center" style={{ zIndex: 1 }}>
              <button
                type="button"
                aria-label={label}
                aria-pressed={false}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(p.id);
                }}
                className="grid size-7 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring"
              >
                <span className="size-3.5 rounded-full border-2 border-[#160f33]/60 bg-muted-foreground/60 opacity-70" />
              </button>
            </Marker>
          );
        }

        const i = Math.min(insideRank++, 14);
        const count = p.jobs.length;
        return (
          <Marker
            key={p.id}
            longitude={p.pos.lng}
            latitude={p.pos.lat}
            anchor="bottom"
            style={{ zIndex: selected ? 3 : 2 }}
          >
            <button
              type="button"
              aria-label={sibling ? `Otra sucursal. ${label}` : label}
              aria-pressed={selected}
              onClick={(e) => {
                e.stopPropagation();
                onSelect(p.id);
              }}
              className="group/pin relative block cursor-pointer p-1 outline-none"
            >
              {/* entrance drop (own element so the hover wiggle never re-triggers it) */}
              <span className="block origin-bottom animate-pop-in" style={{ "--i": i } as React.CSSProperties}>
                <span
                  className={cn(
                    "relative flex origin-bottom flex-col items-center transition-[scale] duration-300 ease-[var(--ease-spring)]",
                    selected ? "scale-[1.32] animate-wiggle" : "group-hover/pin:scale-115 group-hover/pin:animate-wiggle",
                  )}
                >
                  <span
                    className={cn(
                      "relative grid size-11 place-items-center rounded-[0.9rem] border-[2.5px] border-[#160f33] shadow-[2px_3px_0_#160f33]",
                      "group-focus-visible/pin:ring-4 group-focus-visible/pin:ring-ring",
                      selected
                        ? "bg-block-mandarina ring-[3px] ring-white"
                        : p.category
                          ? PIN_BG[CATEGORY_BLOCK[p.category]]
                          : "bg-white",
                      sibling && "outline-[2.5px] outline-offset-[3px] outline-dashed outline-[#160f33] dark:outline-white",
                    )}
                  >
                    {p.category ? <CategoryArt category={p.category} className="size-[2.1rem]" /> : null}
                    {/* proximity rivet */}
                    <span
                      className="absolute -top-1.5 -right-1.5 size-3.5 rounded-full border-2 border-[#160f33]"
                      style={{ background: bandColor(bandFor(p.km)) }}
                    />
                    {/* vacancies at this branch */}
                    {count > 1 ? (
                      <span
                        aria-hidden
                        className="absolute -top-2.5 -left-2.5 grid h-[1.35rem] min-w-[1.35rem] place-items-center rounded-full border-2 border-white bg-[#160f33] px-1 font-display text-[0.72rem] leading-none font-extrabold text-white tabular-nums"
                      >
                        {count}
                      </span>
                    ) : null}
                  </span>
                  {/* pin tail */}
                  <span className="-mt-[6px] size-3 rotate-45 rounded-[2px] bg-[#160f33]" />
                </span>
              </span>
              {sibling ? <BranchTag className="absolute top-full left-1/2 mt-0.5 -translate-x-1/2">{p.name}</BranchTag> : null}
            </button>
          </Marker>
        );
      })}

      {ghostSiblings.map((b) => (
        <Marker key={b.id} longitude={b.pos.lng} latitude={b.pos.lat} anchor="center" style={{ zIndex: 2 }}>
          <SiblingMarker pin={b} label={`Otra sucursal: ${b.companyName} · ${b.name}, sin vacantes por ahora, a ${formatKm(b.km)}`} />
        </Marker>
      ))}

      <Marker longitude={home.lng} latitude={home.lat} anchor="center" style={{ zIndex: 4 }}>
        <span role="img" aria-label="Tu casa" className="relative grid place-items-center">
          <span aria-hidden className="absolute size-14 animate-ping rounded-full bg-primary/30 [animation-duration:2.4s]" />
          <span className="block animate-pop-in" style={{ "--i": 0 } as React.CSSProperties}>
            <HomeHouse />
          </span>
          <span
            aria-hidden
            className="absolute top-full mt-1 -rotate-3 rounded-md border-2 border-[#160f33] bg-block-sol px-2 py-px font-display text-[0.72rem] font-extrabold tracking-wide whitespace-nowrap text-[#160f33] uppercase shadow-[2px_2px_0_#160f33]"
          >
            Tu casa
          </span>
        </span>
      </Marker>
    </Map>
  );
}

/** Chunky home marker: ink outlines, violet roof, concrete chimney, lime door, sky windows. */
function HomeHouse() {
  return (
    <svg viewBox="0 0 48 48" className="relative size-12 drop-shadow-[2px_3px_0_#160f33]" aria-hidden focusable="false">
      <g stroke={INK} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
        <rect x="31" y="8" width="6" height="11" rx="1" fill="#b9b3a6" />
        <path d="M11 22 L11 41 L37 41 L37 22" fill="#fff6e0" />
        <path d="M5 25 L24 8 L43 25 Z" fill="#4318e0" />
        <rect x="19.5" y="28" width="9" height="13" rx="1.5" fill="#ddf78a" />
        <rect x="13" y="27" width="5" height="5" rx="1" fill="#5cc3ff" />
        <rect x="30" y="27" width="5" height="5" rx="1" fill="#5cc3ff" />
      </g>
      <circle cx="26.3" cy="35" r="1.1" fill={INK} />
      <path d="M17 21.5h14" stroke="#ffd84a" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/** Small dashed name tag under a sibling branch. */
function BranchTag({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none max-w-[11.5rem] truncate rounded-md border-2 border-dashed border-[#160f33] bg-white/90 px-1.5 py-px font-display text-[0.7rem] font-extrabold whitespace-nowrap text-[#160f33] shadow-[2px_2px_0_rgb(22_15_51/0.35)]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/**
 * Secondary marker for another branch of the selected company that sits outside the radius
 * (or isn't hiring): faded, dashed outline, store glyph, name tag. Tappable only when it has vacancies.
 */
function SiblingMarker({ pin, label, onSelect }: { pin: BranchPin; label: string; onSelect?: () => void }) {
  const body = (
    <>
      <span
        className={cn(
          "relative grid size-9 place-items-center rounded-[0.75rem] border-[2.5px] border-dashed border-[#160f33] bg-white/85 text-[#160f33] shadow-[2px_2px_0_rgb(22_15_51/0.35)] transition-[scale] duration-300 ease-[var(--ease-spring)]",
          onSelect && "group-hover/sib:scale-110 group-focus-visible/sib:ring-4 group-focus-visible/sib:ring-ring",
        )}
      >
        <HugeiconsIcon icon={Store01Icon} className="size-[1.1rem]" strokeWidth={2.2} />
        {pin.jobs.length > 0 ? (
          <span className="absolute -top-2 -right-2 grid h-5 min-w-5 place-items-center rounded-full border-2 border-white bg-[#160f33] px-1 font-display text-[0.68rem] leading-none font-extrabold text-white tabular-nums">
            {pin.jobs.length}
          </span>
        ) : null}
      </span>
      <BranchTag className="absolute top-full left-1/2 -translate-x-1/2">
        {pin.name}
        {pin.jobs.length === 0 ? " · sin vacantes" : null}
      </BranchTag>
    </>
  );
  if (!onSelect) {
    return (
      <span role="img" aria-label={label} className="relative grid size-11 animate-pop-in place-items-center opacity-90">
        {body}
      </span>
    );
  }
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={false}
      onClick={(e) => {
        e.stopPropagation();
        onSelect();
      }}
      className="group/sib relative grid size-11 animate-pop-in place-items-center opacity-90 outline-none hover:opacity-100"
    >
      {body}
    </button>
  );
}
