"use client";

import Link from "next/link";
import { useMemo } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  ArrowRight01Icon,
  Award01Icon,
  Calendar03Icon,
  Cancel01Icon,
  Notification01Icon,
  Settings02Icon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { PageHeader } from "@/components/chamba/page-header";
import { BLOCK_CLASS, HeroCard, type BlockTone } from "@/components/chamba/primitives";
import { Sticker } from "@/components/chamba/motion";
import { CategoryArt, CategoryIcon } from "@/components/chamba/job-icons";
import { Scene } from "@/components/chamba/art/scenes";
import { Doodle } from "@/components/chamba/art/doodles";
import { Mascot } from "@/components/chamba/art/mascot";
import { Button } from "@/components/ui/button";
import { useCatalog, useCatalogSource, useJobsByDistance } from "@/lib/data/catalog";
import { useApp } from "@/lib/store";
import { formatKm } from "@/lib/geo";
import { formatPay } from "@/lib/format";
import { useMyPipelines, useNow } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import { HARD, HARD_SM, HazardTape, Stamp, STENCIL } from "../postulaciones/rugged";
import { InkSkeleton, LoadingNote } from "../vacantes/_seeker/states";
import { pipelineNotices, type Notice, type NoticeKind } from "../postulaciones/_pipeline/notices";
import { ago } from "../postulaciones/_pipeline/model";

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

const MIN = 60_000;
const NEW_MS = 6 * 60 * MIN;
const NEW_JOB_WINDOW_MIN = 48 * 60;
/** Demo: the curated "fresh vacancy" notices, if the rules above don't find enough. */
const DEMO_FRESH = ["barista-alameda", "repartidor-desierto"];

const KIND_ICON: Record<Exclude<NoticeKind, "vacante">, typeof Calendar03Icon> = {
  entrevista: Calendar03Icon,
  reagendada: Alert02Icon,
  vista: ViewIcon,
  contratada: Award01Icon,
  cerrada: Cancel01Icon,
};
/** Preferred block per kind (no pink); neighbours get nudged so they never repeat. */
const KIND_TONE: Record<NoticeKind, BlockTone> = {
  vacante: "sol",
  entrevista: "limon",
  reagendada: "durazno",
  vista: "cielo",
  contratada: "menta",
  cerrada: "lila",
};
const ROTATE: BlockTone[] = ["sol", "cielo", "limon", "durazno", "menta", "lila"];

/** Tones for a 2-column grid: never the same as the card to the left or above. */
function gridTones(items: Notice[]): BlockTone[] {
  const out: BlockTone[] = [];
  items.forEach((n, i) => {
    const taken = new Set([out[i - 1], out[i - 2]]);
    let tone = KIND_TONE[n.kind];
    let k = ROTATE.indexOf(tone);
    while (taken.has(tone)) tone = ROTATE[++k % ROTATE.length];
    out.push(tone);
  });
  return out;
}

/** Fresh vacancies inside the radius that match the person's interests (both modes). */
function useFreshVacancies(now: number, live: boolean): Notice[] {
  const applications = useApp((s) => s.applications);
  const interests = useApp((s) => s.interests);
  const radiusKm = useApp((s) => s.radiusKm);
  const { companyById } = useCatalog();
  const jobs = useJobsByDistance();
  return useMemo(() => {
    if (!now) return [];
    const applied = new Set(applications.map((a) => a.jobId));
    let fresh = jobs
      .filter((j) => j.km <= radiusKm && j.postedMinutesAgo < NEW_JOB_WINDOW_MIN && !applied.has(j.id))
      .filter((j) => interests.length === 0 || interests.includes(j.category))
      .toSorted((a, b) => a.postedMinutesAgo - b.postedMinutesAgo)
      .slice(0, 4);
    if (!live && fresh.length < 2) {
      const extra = DEMO_FRESH.map((id) => jobs.find((j) => j.id === id)).filter((j) => j && !applied.has(j.id) && !fresh.includes(j));
      fresh = [...fresh, ...(extra as typeof fresh)].slice(0, 4);
    }
    return fresh.map(
      (j): Notice => ({
        id: `vacante-${j.id}`,
        href: `/vacantes/${j.id}`,
        kind: "vacante",
        category: j.category,
        tag: j.urgent ? "Urge" : "Vacante nueva",
        title: `Nueva vacante a ${formatKm(j.km)}`,
        body: `${j.title} en ${companyById[j.companyId]?.name ?? "Saltillo"} · ${formatPay(j)}`,
        at: now - j.postedMinutesAgo * MIN,
      }),
    );
  }, [now, live, applications, interests, radiusKm, companyById, jobs]);
}

export function NotificationsFeed() {
  const source = useCatalogSource();
  const catalog = useCatalog();
  const mine = useMyPipelines();
  const now = useNow();
  const live = source === "live";
  const loading = source === null || !now || mine.loading || (live && catalog.status === "loading");
  const vacancies = useFreshVacancies(now, live);
  const items = useMemo(() => {
    if (loading) return [];
    const apps = pipelineNotices(mine.data, catalog, now);
    return [...apps, ...vacancies].toSorted((a, b) => b.at - a.at);
  }, [loading, mine.data, catalog, now, vacancies]);
  return <Feed items={items} loading={loading} live={live} now={now} />;
}

/** Live: whether any email avisos are on (the copy mentions email only when it's true). */
function useEmailOn() {
  return useApp((s) => s.mode === "live" && (s.emailAlerts || s.emailUpdates));
}

function Feed({ items, loading, live, now }: { items: Notice[]; loading: boolean; live: boolean; now: number }) {
  const fresh = items.filter((n) => now - n.at < NEW_MS).length;
  const emailOn = useEmailOn();
  const appItems = items.filter((n) => n.kind !== "vacante");
  const vacancyItems = items.filter((n) => n.kind === "vacante");
  const appCount = appItems.length;
  return (
    <>
      <PageHeader title="Avisos" />
      <div className="grid grid-cols-1 gap-6 lg:gap-7">
        {/* Hero — the one saturated block on this screen (full width on desktop: nothing beside it to leave short). */}
        <HeroCard
          tone="mandarina"
          eyebrow="Tu radar de chamba"
          title={<>¡Chamba a la vista!</>}
          className={cn("animate-rise overflow-visible", HARD, "shadow-[6px_6px_0_0_var(--ink)]!")}
          sticker={
            loading || fresh === 0 ? null : (
              <Sticker variant="ink" rotate={10} dot>
                <strong>{fresh}</strong>
                {fresh === 1 ? "nuevo" : "nuevos"}
              </Sticker>
            )
          }
        >
          <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
            <span className="absolute inset-0 bg-dots text-ink opacity-[0.12]" />
            <HazardTape className="absolute inset-x-0 bottom-0 h-3 border-b-0" />
          </span>
          <div className="mt-3 flex items-end gap-3 lg:pr-48">
            <div className="min-w-0 flex-1">
              <p className="max-w-xl text-[1rem] leading-snug text-muted-foreground">
                Quién vio tu postulación, tus entrevistas, la respuesta de las empresas y vacantes nuevas cerca. Todo aquí
                {!live ? "." : emailOn ? ", y lo importante también te llega por correo." : ". Si quieres, también te lo mandamos por correo."}
              </p>
              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
                <div className="flex items-center gap-2">
                  <span className="grid size-12 shrink-0 origin-top animate-ring place-items-center rounded-full border-2 border-ink bg-white text-ink">
                    <HugeiconsIcon icon={Notification01Icon} className="size-6" strokeWidth={2.2} />
                  </span>
                  <p className="text-[0.9rem] leading-tight font-semibold">
                    <span className={cn("block text-[1.6rem] leading-none", STENCIL)}>{loading ? "…" : items.length}</span>
                    {items.length === 1 ? "aviso" : "avisos"} · {loading ? "…" : appCount} de tus postulaciones
                  </p>
                </div>
                <Link
                  href="/perfil"
                  className="press lift flex h-12 w-full items-center justify-center gap-2 rounded-full border-2 border-ink bg-ink px-5 text-[1rem] font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-white sm:w-auto"
                >
                  <HugeiconsIcon icon={Settings02Icon} className="size-5" strokeWidth={2} />
                  Elegir qué avisos recibo
                </Link>
              </div>
            </div>
            <Scene name="codigo" className="-mr-3 -mb-3 hidden w-36 shrink-0 sm:block lg:absolute lg:right-8 lg:bottom-6 lg:m-0 lg:w-44" />
          </div>
        </HeroCard>

        {/* Feed: what happened with your applications first, then fresh vacancies nearby. */}
        {loading ? (
          <section aria-label="Cargando avisos" className="min-w-0">
            <LoadingNote>Cargando tus avisos…</LoadingNote>
            <ul aria-hidden className="grid gap-4 lg:grid-cols-2">
              {(["sol", "limon", "cielo", "durazno"] as const).map((t) => (
                <li key={t} className={cn("flex h-[9.5rem] items-start gap-3.5 rounded-panel p-4 sm:p-5", BLOCK_CLASS[t], HARD)}>
                  <InkSkeleton className="size-12 shrink-0 rounded-tile" />
                  <span className="min-w-0 flex-1 space-y-2.5">
                    <InkSkeleton className="h-3 w-20" />
                    <InkSkeleton className="h-5 w-3/4" />
                    <InkSkeleton className="h-4 w-1/2" />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ) : items.length === 0 ? (
          <div className={cn("animate-pop-in rounded-panel p-6 text-center", BLOCK_CLASS.menta, HARD)}>
            <Mascot mood="duerme" prop="casco" size={120} className="mx-auto w-28" />
            <p className="mt-2 font-display text-[1.45rem] leading-tight font-extrabold tracking-[-0.03em]">Pronto verás tus avisos aquí</p>
            <p className="mx-auto mt-1.5 max-w-sm text-muted-foreground">
              Cuando una empresa vea tu postulación o salga una vacante cerca de tu casa, te avisamos aquí
              {emailOn ? " y por correo" : ""}.
            </p>
            <Button asChild size="lg" className="mt-5">
              <Link href="/vacantes">Ver vacantes cerca</Link>
            </Button>
          </div>
        ) : (
          <>
            {appItems.length ? (
              <NoticeSection id="de-tus-postulaciones" title="De tus postulaciones" items={appItems} now={now} offset={0} />
            ) : null}
            <NoticeSection
              id="vacantes-nuevas"
              title={vacancyItems.length ? "Vacantes nuevas cerca" : "Vacantes nuevas"}
              items={vacancyItems}
              now={now}
              offset={appItems.length}
              end={
                <div className={cn("relative isolate flex w-full flex-col justify-center overflow-hidden rounded-panel p-5", BLOCK_CLASS.lila, HARD)}>
                  <Doodle name="rayo" color="#FFD23F" className="absolute top-3 right-4 -z-10 size-8 rotate-12" />
                  <Doodle name="zigzag" color="#FF6B2C" className="absolute right-14 bottom-3 -z-10 size-6 -rotate-6" />
                  <p className="text-[0.72rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">Eso es todo por ahora</p>
                  <p className="mt-1 pr-10 font-display text-[1.3rem] leading-tight font-extrabold tracking-[-0.03em]">
                    {vacancyItems.length ? "¡Al día! Te avisamos cuando salga algo cerca." : "Te avisamos aquí cuando salga una vacante cerca de tu casa."}
                  </p>
                </div>
              }
            />
          </>
        )}
      </div>
    </>
  );
}

/**
 * A titled 2-column grid of notices (1 column on phones). An odd last card spans both columns on
 * desktop, so the grid never ends with a hole.
 */
function NoticeSection({
  id,
  title,
  items,
  now,
  offset,
  end,
}: {
  id: string;
  title: string;
  items: Notice[];
  now: number;
  offset: number;
  end?: React.ReactNode;
}) {
  const tones = gridTones(items);
  const cells = items.length + (end ? 1 : 0);
  const wideLast = cells % 2 === 1;
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h2 id={id} className="mb-4 flex items-center gap-2.5 px-1 font-display text-[1.45rem] font-extrabold tracking-[-0.03em]">
        {title}
        <span className="grid h-7 min-w-7 -rotate-6 place-items-center rounded-md border-2 border-ink bg-block-sol px-2 font-sans text-[0.85rem] font-bold text-ink tabular-nums">
          {items.length}
        </span>
      </h2>
      <ul className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {items.map((n, i) => (
          <li
            key={n.id}
            className={cn("flex animate-rise", wideLast && !end && i === items.length - 1 && "lg:col-span-2")}
            style={{ "--i": Math.min(offset + i + 1, 8), "--rise": "22px" } as CSSVars}
          >
            <NoticeCard n={n} tone={tones[i]} now={now} />
          </li>
        ))}
        {end ? (
          <li className={cn("flex animate-rise", wideLast && "lg:col-span-2")} style={{ "--i": Math.min(offset + items.length + 1, 8) } as CSSVars}>
            {end}
          </li>
        ) : null}
      </ul>
    </section>
  );
}

function NoticeCard({ n, tone, now }: { n: Notice; tone: BlockTone; now: number }) {
  const isNew = now - n.at < NEW_MS;
  const app = n.kind !== "vacante";
  return (
    <Link
      href={n.href}
      className={cn(
        "group lift press relative isolate flex w-full items-start gap-3.5 overflow-hidden rounded-panel p-4 pr-5 outline-none focus-visible:ring-3 focus-visible:ring-ring/60 sm:p-5",
        BLOCK_CLASS[tone],
        HARD,
      )}
    >
      {n.category ? (
        <CategoryArt
          category={n.category}
          className="pointer-events-none absolute -right-4 -bottom-5 -z-10 size-24 rotate-[-14deg] opacity-30 transition-transform duration-300 group-hover:rotate-0"
        />
      ) : null}
      <span className="relative shrink-0">
        {n.kind === "vacante" && n.category ? (
          <CategoryIcon category={n.category} size="md" className={HARD_SM} />
        ) : (
          <span className={cn("grid size-12 place-items-center rounded-tile bg-ink text-white group-hover:animate-wiggle", HARD_SM)}>
            <HugeiconsIcon icon={KIND_ICON[n.kind as Exclude<NoticeKind, "vacante">] ?? Notification01Icon} className="size-6" strokeWidth={2} />
          </span>
        )}
        {isNew ? <span aria-hidden className="absolute -top-1 -right-1 size-3.5 rounded-full border-2 border-ink bg-chile" /> : null}
      </span>
      <span className="flex min-w-0 flex-1 flex-col self-stretch">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[0.72rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{n.tag}</span>
          {isNew ? <Stamp className="-rotate-3">Nuevo</Stamp> : null}
        </span>
        <span className="mt-1 block font-display text-[1.2rem] leading-tight font-bold tracking-[-0.02em]">{n.title}</span>
        {n.highlight ? (
          <span
            className={cn(
              "mt-2 inline-flex w-fit items-center gap-1.5 rounded-full border-2 border-ink bg-white px-3 py-1 text-[0.95rem] font-bold text-ink",
              n.replaced && "border-ink/30 font-semibold text-ink/55 line-through decoration-2",
              n.stale && !n.replaced && "border-ink/30",
            )}
          >
            <HugeiconsIcon icon={Calendar03Icon} className="size-4 shrink-0" strokeWidth={2.4} />
            {n.highlight}
          </span>
        ) : null}
        <span className="mt-1.5 block text-[0.95rem] leading-snug text-muted-foreground">{n.body}</span>
        <span className="mt-auto flex items-center justify-between gap-2 pt-3 text-[0.85rem] font-medium">
          <span className="text-muted-foreground">{ago(n.at, now, true)}</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-ink px-3 py-1.5 text-white transition-transform group-hover:translate-x-1">
            {app ? "Ver mi postulación" : "Ver vacante"}
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" strokeWidth={2.2} />
          </span>
        </span>
      </span>
    </Link>
  );
}
