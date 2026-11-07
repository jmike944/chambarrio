"use client";

import { useRef } from "react";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Briefcase01Icon,
  FlashIcon,
  Location06Icon,
  MapsLocation01Icon,
} from "@hugeicons/core-free-icons";
import {
  BLOCK_CLASS,
  Eyebrow,
  HeroCard,
  Panel,
  SectionLabel,
  StatTile,
  StatusDot,
  rotateTone,
  type BlockTone,
} from "@/components/chamba/primitives";
import { CountUp, Sticker, confetti } from "@/components/chamba/motion";
import { CategoryArt, CategoryIcon, CATEGORY_BLOCK } from "@/components/chamba/job-icons";
import { Mascot } from "@/components/chamba/art/mascot";
import { Scene } from "@/components/chamba/art/scenes";
import { Doodle, Marquee } from "@/components/chamba/art/doodles";
import { RadiusBar } from "@/components/chamba/radius-bar";
import { Radar } from "@/components/chamba/radar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useApp, useJobsByDistance, type JobWithDistance } from "@/lib/store";
import { bandColor, bandFor, formatKm, monthlySavings, type RadiusKm } from "@/lib/geo";
import { formatMinutesAgo, formatMXN, formatPay } from "@/lib/format";
import { COMPANY_BY_ID } from "@/lib/data/jobs";
import { CATEGORIES, CATEGORY_BY_ID } from "@/lib/data/categories";
import { cn } from "@/lib/utils";

type Vars = React.CSSProperties & Record<`--${string}`, string | number>;

/** Workwear hazard tape (ink + safety yellow). Local helper — no shared utility exists. */
const HAZARD: React.CSSProperties = {
  backgroundImage: "repeating-linear-gradient(-45deg, var(--ink) 0 11px, var(--block-sol) 11px 22px)",
};

/**
 * Hard offset "stencil plate" edge used on the cards of this screen. Also pins --card to white inside
 * (block-* utilities don't re-scope it, so white chips/buttons/radar plate would go dark in dark mode).
 */
const EDGE =
  "border-[2.5px] border-[color:var(--ink)] shadow-[0_5px_0_var(--ink)] dark:border-black/70 dark:shadow-[0_5px_0_rgb(0_0_0/0.6)]";
const PLATE = `[--card:#ffffff] [--card-foreground:var(--ink)] ${EDGE}`;

/** Category tone per card, never repeating the previous card's tone. */
function stackTones(jobs: JobWithDistance[], avoidFirst?: BlockTone): BlockTone[] {
  const out: BlockTone[] = [];
  jobs.forEach((j, i) => {
    let t: BlockTone = CATEGORY_BLOCK[j.category];
    const prev = i === 0 ? avoidFirst : out[i - 1];
    for (let k = 0; t === prev || t === "lila"; k++) t = rotateTone(i + k);
    out.push(t);
  });
  return out;
}

export function HomeDashboard() {
  const radiusKm = useApp((s) => s.radiusKm);
  const setRadius = useApp((s) => s.setRadius);
  const colonia = useApp((s) => s.colonia);
  const jobs = useJobsByDistance();
  const radiusRef = useRef<HTMLElement>(null);

  const inRadius = jobs.filter((j) => j.km <= radiusKm);
  const openings = inRadius.reduce((n, j) => n + j.openings, 0);
  const newToday = inRadius.filter((j) => j.postedMinutesAgo < 24 * 60).length;
  const savings = monthlySavings(radiusKm);
  const latest = inRadius.toSorted((a, b) => a.postedMinutesAgo - b.postedMinutesAgo).slice(0, 4);
  const nearest = inRadius.slice(0, 4);
  const tones = stackTones(nearest);
  const perCategory = CATEGORIES.map((c) => ({ ...c, n: inRadius.filter((j) => j.category === c.id).length })).toSorted(
    (a, b) => b.n - a.n,
  );

  /** Widening the radius and finding more chamba is a small win: a quick burst from the radius block. */
  function changeRadius(r: RadiusKm) {
    const more = jobs.filter((j) => j.km <= r).length > inRadius.length;
    setRadius(r);
    if (more && radiusRef.current) confetti({ origin: radiusRef.current, count: 22, spread: 90 });
  }

  return (
    <div className="flex flex-col gap-5 lg:grid lg:grid-cols-12 lg:items-start lg:gap-6">
      {/* ───────────── left column (desktop) ───────────── */}
      <div className="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-6">
        {/* HERO — the one saturated block */}
        <HeroCard
          tone="uva"
          decor={false}
          eyebrow="¡Chamba a la vista!"
          className="order-1 animate-rise pb-0 sm:pb-0 lg:order-none"
          sticker={
            newToday > 0 ? (
              <Sticker variant="lime" size="md" rotate={10} dot>
                <strong>+{newToday}</strong>hoy
              </Sticker>
            ) : null
          }
        >
          <HeroDecor />
          <div className="relative pr-[7.5rem] sm:pr-44">
            <p className="mt-3 flex items-end gap-3">
              <span className="font-display text-[5.5rem] leading-[0.8] font-extrabold tracking-[-0.06em] tabular-nums sm:text-[7rem]">
                <CountUp value={inRadius.length} from={0} />
              </span>
              <span className="pb-1 font-display text-[1.35rem] leading-[1.05] font-bold">
                vacantes
                <br />
                cerca
              </span>
            </p>
            <p className="mt-4 text-[1.02rem] leading-snug text-primary-foreground/85">
              <strong className="font-semibold text-primary-foreground tabular-nums">{openings} lugares</strong> a menos de{" "}
              <strong className="font-semibold text-limon tabular-nums">{radiusKm} km</strong> de tu casa en {colonia}.
            </p>
          </div>
          <Mascot
            mood="saluda"
            prop="casco"
            size={132}
            className="pointer-events-none absolute right-1 bottom-[4.6rem] w-[7.5rem] sm:right-6 sm:w-[10rem]"
          />
          <Button variant="lime" size="xl" asChild className={cn("relative mt-6 w-full sm:w-auto sm:px-8", EDGE)}>
            <Link href="/vacantes">
              ¡Ándale, a ver!
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2.4} />
            </Link>
          </Button>
          {/* hazard tape along the bottom edge */}
          <div aria-hidden className="-mx-6 mt-6 h-4 rounded-b-[inherit] sm:-mx-7" style={HAZARD} />
        </HeroCard>

        {/* STAT TILES — three different pastels */}
        <div className="order-2 grid grid-cols-3 gap-2.5 sm:gap-3 lg:order-none">
          <StatTile
            tone="limon"
            icon={Briefcase01Icon}
            label="Lugares"
            value={<CountUp value={openings} />}
            hint="abiertos"
            className={cn("animate-rise p-3.5 sm:p-4", PLATE)}
            style={{ "--i": 1 }}
          />
          <StatTile
            tone="durazno"
            icon={FlashIcon}
            label="Nuevas"
            value={<CountUp value={newToday} />}
            hint="hoy"
            className={cn("animate-rise p-3.5 sm:p-4", PLATE)}
            style={{ "--i": 2 }}
          />
          <StatTile
            tone="menta"
            icon={Location06Icon}
            label="Cerquita"
            value={nearest[0] ? formatKm(nearest[0].km) : "—"}
            hint="de tu casa"
            className={cn("animate-rise p-3.5 sm:p-4 [&>div:nth-child(2)]:text-[1.6rem]", PLATE)}
            style={{ "--i": 3 }}
          />
        </div>

        {/* CATEGORIES */}
        <section aria-labelledby="home-cats" className="order-4 lg:order-none">
          <SectionLabel
            title={<span id="home-cats">¿Qué chamba buscas?</span>}
            action={
              <Button variant="link" size="sm" asChild>
                <Link href="/vacantes">Ver todas</Link>
              </Button>
            }
          />
          <ul className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pt-2 pb-3 lg:mx-0 lg:grid lg:grid-cols-6 lg:gap-y-4 lg:overflow-visible lg:px-0">
            {perCategory.map((c, i) => (
              <li key={c.id} className="shrink-0 animate-pop-in" style={{ "--i": Math.min(i, 8) } as Vars}>
                <Link
                  href={`/vacantes?categoria=${c.id}`}
                  aria-label={`${c.label}: ${c.n} vacantes cerca`}
                  className="group press lift flex w-[5.25rem] flex-col items-center gap-1.5 rounded-tile py-1 text-center outline-none focus-visible:ring-3 focus-visible:ring-ring/60 lg:w-full"
                >
                  <span className="relative">
                    <CategoryIcon category={c.id} size="lg" className="rounded-full!" />
                    {c.n > 0 ? (
                      <span className="absolute -top-1.5 -right-1.5 grid h-6 min-w-6 place-items-center rounded-full border-2 border-background bg-ink px-1.5 text-[0.72rem] font-bold text-white tabular-nums">
                        {c.n}
                      </span>
                    ) : null}
                  </span>
                  <span className="line-clamp-2 text-[0.8rem] leading-tight font-semibold">{c.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* NEAREST — overlapping category-tinted plates */}
        <section aria-labelledby="home-nearest" className="order-5 lg:order-none">
          <SectionLabel
            title={<span id="home-nearest">Más cerca de ti</span>}
            count={inRadius.length}
          />
          {nearest.length === 0 ? (
            <Panel tone="menta" className={cn("mt-3 flex items-center gap-4", PLATE)}>
              <Scene name="vacio" className="w-28 shrink-0" />
              <p className="font-semibold">
                No hay vacantes a {radiusKm} km todavía. Amplía tu radio para ver más.
              </p>
            </Panel>
          ) : (
            <>
              {/* x-clip at the screen edge: the bleeding category art must not cause sideways scroll on phones */}
              <ul className="-mx-4 mt-3 overflow-x-clip px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:overflow-x-visible lg:px-0">
                {nearest.map((j, i) => (
                  <li
                    key={j.id}
                    className={cn("relative animate-rise", i < nearest.length - 1 && "-mb-7")}
                    style={{ "--i": Math.min(i + 2, 8), zIndex: i } as Vars}
                  >
                    <NearCard job={j} radiusKm={radiusKm} tone={tones[i]} last={i === nearest.length - 1} tilt={i % 2 ? 0.6 : -0.6} />
                  </li>
                ))}
              </ul>
              <Button size="lg" asChild className={cn("mt-5 w-full", EDGE)}>
                <Link href="/vacantes">
                  Ver las {inRadius.length} vacantes
                  <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2.4} />
                </Link>
              </Button>
            </>
          )}
        </section>
      </div>

      {/* ───────────── right column (desktop) ───────────── */}
      <div className="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-6">
        {/* RADIUS + RADAR */}
        <Panel
          ref={radiusRef}
          tone="cielo"
          aria-labelledby="home-radius"
          className={cn("order-3 animate-rise overflow-hidden lg:order-none", PLATE)}
          style={{ "--i": 2 } as Vars}
        >
          <span aria-hidden className="pointer-events-none absolute inset-0 bg-dots text-[color:var(--ink)]/[0.07]" />
          <div className="relative flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <Eyebrow>Tu radio</Eyebrow>
              <h2 id="home-radius" className="mt-1 font-display text-[1.6rem] leading-[1.05] font-extrabold">
                ¿Qué tan lejos le entras?
              </h2>
            </div>
            <Button variant="white" size="sm" asChild className="shrink-0">
              <Link href="/mapa">
                <HugeiconsIcon icon={MapsLocation01Icon} strokeWidth={2} />
                Mapa
              </Link>
            </Button>
          </div>
          <Radar jobs={jobs} radiusKm={radiusKm} className="relative mt-4 max-w-[17rem] sm:max-w-[20rem]" />
          <RadiusBar value={radiusKm} onChange={changeRadius} className="relative mt-5" />
        </Panel>

        {/* SAVINGS */}
        <Panel
          tone="sol"
          aria-labelledby="home-savings"
          className={cn("order-6 animate-rise overflow-hidden lg:order-none", PLATE)}
        >
          <div className="relative flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <Eyebrow>Lo que te ahorras</Eyebrow>
              <h2 id="home-savings" className="mt-1 font-display text-[1.55rem] leading-[1.05] font-extrabold">
                Trabajar cerca sí paga
              </h2>
              <p className="mt-3 font-display text-[2.6rem] leading-none font-extrabold tracking-[-0.04em] tabular-nums">
                <CountUp value={savings.pesos} prefix="$" />
              </p>
              <p className="text-sm font-semibold">de gasolina al mes</p>
              <p className="mt-2 font-display text-[1.6rem] leading-none font-extrabold tabular-nums">
                <CountUp value={savings.hours} suffix=" h" />
              </p>
              <p className="text-sm font-semibold">menos de traslado</p>
            </div>
            <Scene name="ahorro" className="-mr-8 w-[46%] max-w-56 shrink-0 sm:-mr-6" />
          </div>
          <p className="relative z-10 mt-4 border-t-2 border-dashed border-[color:var(--ink)]/25 pt-3 text-[0.85rem] leading-snug text-muted-foreground">
            Trabajando a {radiusKm} km o menos te ahorras hasta{" "}
            <strong className="font-semibold text-foreground tabular-nums">{savings.hours} horas</strong> y{" "}
            <strong className="font-semibold text-foreground tabular-nums">{formatMXN(savings.pesos)}</strong> de gasolina al mes,
            comparado con el traslado promedio en Saltillo.
          </p>
        </Panel>

        {/* LIVE */}
        <Panel aria-labelledby="home-live" className={cn("order-7 overflow-hidden p-0 sm:p-0 lg:order-none", EDGE, "shadow-[0_5px_0_var(--ink)]! dark:shadow-[0_5px_0_rgb(0_0_0/0.6)]!")}>
          <header className="block-tinta flex items-center gap-3 px-5 py-3.5">
            <StatusDot color="var(--nopal)" pulse className="size-2.5" />
            <h2 id="home-live" className="font-display text-[1.25rem] font-extrabold">
              Recién publicadas
            </h2>
            <Badge variant="lime" size="md" className="ml-auto uppercase tracking-wider">
              En vivo
            </Badge>
          </header>
          <div aria-hidden className="block-sol border-y-[2.5px] border-[color:var(--ink)] text-[0.82rem] font-extrabold tracking-wide uppercase">
            <Marquee
              speed={24}
              items={latest.map((j) => (
                <span key={j.id} className="inline-flex items-center gap-2">
                  <Doodle name="estrella" color="var(--ink)" animated={false} className="size-3.5" />
                  {j.title} · {formatPay(j)}
                </span>
              ))}
            />
          </div>
          <ul className="p-2.5">
            {latest.map((j, i) => (
              <li key={j.id} className="animate-rise" style={{ "--i": Math.min(i + 3, 8) } as Vars}>
                <Link
                  href={`/vacantes/${j.id}`}
                  className="group press flex items-center gap-3 rounded-tile px-2.5 py-2.5 outline-none transition-colors hover:bg-tile focus-visible:ring-3 focus-visible:ring-ring/60"
                >
                  <CategoryIcon category={j.category} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[1rem] font-semibold">
                      {j.title} · <span className="tabular-nums">{formatPay(j)}</span>
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {COMPANY_BY_ID[j.companyId].name} · {formatMinutesAgo(j.postedMinutesAgo)}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5 text-[0.9rem] font-semibold tabular-nums">
                    <StatusDot color={bandColor(bandFor(j.km))} />
                    {formatKm(j.km)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

/** Rugged hero decor: halftone corner, stencil number, a few bold doodles (no faces, no hearts). */
function HeroDecor() {
  return (
    <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
      <span className="absolute -top-6 -right-6 size-48 rounded-full bg-dots text-white/20" />
      <span className="absolute top-3 right-[7.25rem] -rotate-12">
        <Doodle name="estrella" color="var(--limon)" className="size-5" />
      </span>
      <span className="absolute right-[7rem] bottom-[9.5rem] rotate-12 sm:right-[11rem]">
        <Doodle name="rayo" color="var(--block-sol)" className="size-7" />
      </span>
      <span className="absolute right-[38%] bottom-[5.5rem]">
        <Doodle name="zigzag" color="var(--block-mandarina)" className="size-8" />
      </span>
    </span>
  );
}

function NearCard({
  job,
  radiusKm,
  tone,
  last,
  tilt,
}: {
  job: JobWithDistance;
  radiusKm: number;
  tone: BlockTone;
  last: boolean;
  tilt: number;
}) {
  const inside = job.km <= radiusKm;
  return (
    <Link
      href={`/vacantes/${job.id}`}
      className={cn(
        "group press lift relative block rounded-panel p-5 pr-28 outline-none focus-visible:z-20 focus-visible:ring-4 focus-visible:ring-ring/70 sm:pr-36",
        BLOCK_CLASS[tone],
        PLATE,
        !last && "pb-12",
      )}
      style={{ rotate: `${tilt}deg` }}
    >
      <span className="flex items-center gap-2">
        <Badge
          variant="status"
          size="md"
          style={{ "--dot": bandColor(bandFor(job.km)) } as Vars}
          className="tabular-nums"
        >
          A {formatKm(job.km)}
          {inside ? null : " · fuera de tu radio"}
        </Badge>
        <span className="truncate text-[0.78rem] font-bold tracking-wider text-muted-foreground uppercase">
          {CATEGORY_BY_ID[job.category].label}
        </span>
      </span>
      <span className="mt-2.5 line-clamp-2 block font-display text-[1.35rem] leading-[1.08] font-extrabold tracking-[-0.025em]">
        {job.title}
      </span>
      <span className="mt-1 block truncate text-[0.95rem] text-muted-foreground">
        <strong className="font-bold text-foreground tabular-nums">{formatPay(job)}</strong> · {COMPANY_BY_ID[job.companyId].name}
      </span>
      <span
        aria-hidden
        className="absolute top-3 -right-3 size-28 rotate-6 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110 sm:size-32"
      >
        <CategoryArt category={job.category} className="size-full drop-shadow-[0_3px_0_rgb(22_15_51/0.35)]" />
      </span>
    </Link>
  );
}
