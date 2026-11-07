import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Agreement01Icon,
  ArrowRight02Icon,
  Building06Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  LockIcon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";
import { ChambarrioLogo } from "@/components/brand/chambarrio-logo";
import { Reveal, Sticker, Stagger, StaggerItem, CountUp } from "@/components/chamba/motion";
import { CategoryArt, CategoryIcon } from "@/components/chamba/job-icons";
import { Scene, type SceneName } from "@/components/chamba/art/scenes";
import { Doodle, Marquee } from "@/components/chamba/art/doodles";
import { BLOCK_CLASS, type BlockTone } from "@/components/chamba/primitives";
import { ThemeToggle } from "@/components/theme";
import { HeroDemo } from "@/components/landing/hero-demo";
import { InstallButton } from "@/components/landing/install-button";
import { DemoShowcase } from "@/components/landing/demo-entry";
import { CategoryCount } from "@/components/landing/category-count";
import { ChambitaHello, Squiggle } from "@/components/landing/fx";
import { HARD, HARD_SM, HazardStripe, PRESSABLE, Rivets, Scatter, StencilNumber, Tape, chunky } from "@/components/landing/decor";
import { CATEGORIES, CATEGORY_BY_ID } from "@/lib/data/categories";
import type { CategoryId } from "@/lib/data/types";
import { CITY_AVG_KM, monthlySavings } from "@/lib/geo";
import { formatMXN } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: { absolute: "Chambarrio · El trabajo que buscas, cerca de ti" },
  description:
    "Vacantes a 2, 5, 10 o 15 km de tu casa en Saltillo. Gratis para quien busca trabajo. Para empresas: personal que vive cerca, llega a tiempo y se queda.",
};

const savings = monthlySavings(5);

const PHILOSOPHY: { line: string; fact: string; tone: BlockTone }[] = [
  { line: "Menos distancia.", fact: `El traslado promedio en Saltillo y Ramos Arizpe ronda los ${CITY_AVG_KM} km. Aquí puedes empezar a buscar a 2.`, tone: "limon" },
  { line: "Menos gastos.", fact: `Hasta ${formatMXN(savings.pesos)} al mes menos en gasolina si trabajas a 5 km o menos de tu casa.`, tone: "sol" },
  { line: "Más tiempo.", fact: `Hasta ${savings.hours} horas al mes que no pasas en el camión ni en el tráfico.`, tone: "cielo" },
  { line: "Mejor calidad de vida.", fact: "Menos estrés, más tiempo con tu familia y llegas descansado a trabajar.", tone: "menta" },
];

/** Bento: distancia | gastos (wide, with scene) / tiempo | calidad. */
const PHILO_SPAN = ["md:col-span-2", "md:col-span-4", "md:col-span-3", "md:col-span-3"];

const STEPS: { title: string; body: string; tone: BlockTone; scene: SceneName; tilt: string }[] = [
  { title: "Entra con tu celular o correo", body: "Sin currículum. Te mandamos un código por SMS o correo y listo.", tone: "durazno", scene: "codigo", tilt: "-rotate-[1.6deg]" },
  { title: "Elige qué tan lejos", body: "2, 5, 10 o 15 km de tu casa. Ves sueldo, horario y prestaciones antes de moverte.", tone: "cielo", scene: "mapa", tilt: "rotate-[1.2deg]" },
  { title: "Habla directo con la empresa", body: "Postúlate con un toque o llámales directo. Sin intermediarios.", tone: "limon", scene: "contratado", tilt: "-rotate-[0.8deg]" },
];

const BENEFITS: { icon: typeof Clock01Icon; title: string; body: string; tone: BlockTone }[] = [
  { icon: Clock01Icon, title: "Más puntualidad", body: "Un traslado corto deja menos espacio para el tráfico y el camión que no pasó.", tone: "sol" },
  { icon: UserCheck01Icon, title: "Menos ausentismo", body: "Cuando llegar cuesta poco, faltar por el transporte deja de ser excusa.", tone: "cielo" },
  { icon: Building06Icon, title: "Más permanencia", body: "La gente cambia menos de trabajo cuando el suyo le queda cerca de casa.", tone: "limon" },
];

const PLANS: { name: string; price: string; unit: string; body: string; featured: boolean; tone: BlockTone }[] = [
  { name: "Por vacante", price: "Gratis", unit: "para publicar", body: "Publica las vacantes que quieras. Para ver y contactar a quienes se postulan, desbloquea cada vacante por $500 MXN al mes.", featured: false, tone: "menta" },
  { name: "Pyme", price: "$1,500", unit: "MXN al mes", body: "Hasta 5 vacantes con postulaciones desbloqueadas. Para quien contrata seguido.", featured: true, tone: "uva" },
  { name: "Industrial", price: "Desde $6,500", unit: "MXN al mes", body: "Vacantes ilimitadas, varias plantas y reportes de rotación.", featured: false, tone: "durazno" },
];

/** "¿Qué chamba buscas?" stack — order chosen so neighbours never share a tone. */
const PICKS: { id: CategoryId; tone: BlockTone }[] = [
  { id: "construccion", tone: "cielo" },
  { id: "restaurante", tone: "durazno" },
  { id: "chofer", tone: "menta" },
  { id: "caja", tone: "sol" },
  { id: "almacen", tone: "lila" },
  { id: "mantenimiento", tone: "limon" },
];

const HERO_STATS: { value: number; suffix: string; label: string; tone: BlockTone }[] = [
  { value: 0, suffix: "", label: "pesos te cuesta buscar", tone: "sol" },
  { value: 2, suffix: " km", label: "radio más corto", tone: "limon" },
  { value: CATEGORIES.length, suffix: "", label: "tipos de chamba", tone: "durazno" },
];

const CLOSING = [
  "Gratis para siempre si buscas trabajo",
  "Funciona en cualquier teléfono",
  "No ocupa espacio como una app normal",
  "Avisos de vacantes nuevas cerca de ti",
];

const focusLink = "rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/60";

function SectionHead({
  id,
  eyebrow,
  title,
  children,
  className,
  invert,
}: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  invert?: boolean;
}) {
  return (
    <Reveal inView className={cn("max-w-3xl", className)}>
      <p
        className={cn(
          "inline-flex items-center gap-2 font-display text-[0.8rem] font-extrabold tracking-[0.16em] uppercase",
          invert ? "text-limon" : "text-uva-ink",
        )}
      >
        <HazardStripe className="h-3 w-8 rounded-sm" size={5} />
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-3 font-display text-[2.3rem] leading-[1] font-extrabold tracking-[-0.045em] sm:text-[3.2rem] lg:text-[3.6rem]"
      >
        {title}
      </h2>
      {children}
    </Reveal>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-dvh overflow-x-clip [--hard:var(--ink)] dark:[--hard:#2c2464]">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 sm:px-6 lg:px-10">
        <Link href="/" aria-label="Chambarrio, inicio" className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <ChambarrioLogo iconClassName="size-9 shrink-0 group-hover:animate-wiggle" />
        </Link>
        <nav aria-label="Secciones" className="ml-8 hidden items-center gap-1 md:flex">
          {[
            ["#como-funciona", "Cómo funciona"],
            ["#empresas", "Empresas"],
            ["#precios", "Precios"],
          ].map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-full px-4 py-2 text-[0.95rem] font-semibold text-muted-foreground outline-none transition-colors hover:bg-card hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2.5">
          <a
            href="#demo"
            className="hidden h-11 items-center rounded-full px-4 text-[0.95rem] font-bold outline-none transition-colors hover:bg-card focus-visible:ring-3 focus-visible:ring-ring/50 sm:inline-flex"
          >
            Probar la demo
          </a>
          <ThemeToggle className="size-11" />
          <Link href="/entrar" className={chunky("lime", "md")}>
            Entrar
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-start gap-7 px-4 pt-5 pb-10 sm:px-6 lg:grid-cols-[1.12fr_1fr] lg:items-stretch lg:gap-10 lg:px-10 lg:pt-10 lg:pb-16">
          <Reveal y={22} className={cn("relative isolate min-w-0 overflow-hidden rounded-panel block-mandarina", HARD)}>
            <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-60" />
            <Scatter count={4} seed={2} palette={["var(--block-sol)", "var(--limon)"]} className="-z-10" />
            <div className="relative px-5 pt-6 sm:px-8 sm:pt-8">
              <Tape className="-rotate-2">Saltillo · Ramos Arizpe</Tape>
              <div className="absolute top-4 right-3 sm:top-6 sm:right-6">
                <Sticker variant="lime" size="lg" rotate={12} className="border-[3px] border-ink text-[0.78rem]">
                  <strong>¡Gratis!</strong>sin currículum
                </Sticker>
              </div>
              <h1 className="mt-5 pr-14 font-display text-[3.05rem] leading-[0.95] font-extrabold tracking-[-0.055em] text-balance sm:pr-24 sm:text-[4.2rem] lg:text-[4.5rem]">
                El trabajo que buscas,{" "}
                <span className="relative inline-block">
                  cerca
                  <Squiggle />
                </span>{" "}
                de ti.
              </h1>
              <p className="mt-5 max-w-[32rem] text-[1.08rem] leading-relaxed font-medium sm:text-lg">
                Vacantes a 2, 5, 10 o 15 km de tu casa en Saltillo. Gratis para quien busca trabajo, sin currículum y
                desde tu celular.
              </p>
              <div className="mt-7 flex flex-col gap-3.5 sm:flex-row sm:flex-wrap [&>a]:whitespace-nowrap">
                <Link href="/bienvenida" className={cn(chunky("ink"), "group")}>
                  Buscar trabajo cerca
                  <HugeiconsIcon icon={ArrowRight02Icon} className="size-5 transition-transform group-hover:translate-x-1" strokeWidth={2.4} />
                </Link>
                <Link href="/bienvenida/empresa" className={chunky("white")}>
                  Publicar una vacante
                </Link>
              </div>
              <p className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.98rem] font-medium">
                <a
                  href="#demo"
                  className={cn(
                    focusLink,
                    "inline-flex h-11 items-center gap-2 rounded-full border-[2.5px] border-ink bg-block-sol px-4 font-display font-extrabold text-ink",
                  )}
                >
                  <span className="rounded bg-ink px-1.5 py-0.5 text-[0.7rem] tracking-[0.1em] text-limon uppercase">Demo</span>
                  Pruébala sin registrarte
                </a>
                <span>
                  ¿Ya tienes cuenta?{" "}
                  <Link href="/entrar" className={cn(focusLink, "font-bold underline decoration-2 underline-offset-4")}>
                    Entra aquí
                  </Link>
                </span>
              </p>
            </div>
            <div className="relative -mt-6 sm:mt-0">
              <div className="relative z-10 ml-auto -mb-8 w-fit pr-3 sm:pr-6">
                <ChambitaHello size={104} />
              </div>
              <div className="border-t-[3px] border-ink bg-block-cielo/60">
                <Scene name="barrio" className="w-full" title="Una calle de Saltillo con casas, fábricas y camiones" />
              </div>
              <HazardStripe className="h-4" />
            </div>
          </Reveal>
          {/* On desktop this column stretches to the hero's height: the demo card grows, the stat tiles sit on the bottom line. */}
          <div className="flex min-w-0 flex-col gap-6">
            <Reveal index={2} y={22} className="lg:flex lg:flex-1 lg:flex-col">
              <HeroDemo className="lg:flex-1" />
            </Reveal>
            <ul aria-label="Chambarrio en números" className="grid grid-cols-3 gap-3 sm:gap-4">
              {HERO_STATS.map((s, i) => (
                <Reveal
                  as="li"
                  key={s.label}
                  index={4 + i}
                  className={cn(
                    "relative flex min-w-0 flex-col rounded-tile p-3.5 sm:p-5",
                    BLOCK_CLASS[s.tone],
                    HARD_SM,
                    i === 1 ? "rotate-[1.5deg]" : "-rotate-[1deg]",
                  )}
                >
                  <span className="font-display text-[2.1rem] leading-none font-extrabold tracking-[-0.05em] tabular-nums sm:text-[2.8rem]">
                    <CountUp from={0} value={s.value} suffix={s.suffix} />
                  </span>
                  <span className="mt-1.5 text-[0.82rem] leading-tight font-semibold text-muted-foreground sm:text-[0.95rem]">{s.label}</span>
                </Reveal>
              ))}
            </ul>
          </div>
        </section>

        {/* Category tape bands */}
        <section aria-label="Tipos de chamba" className="relative py-8 sm:py-10">
          <div className="relative -mx-[6%] -rotate-[2.2deg]">
            <div className={cn("border-y-[3px] border-ink block-tinta")}>
              <Marquee
                speed={34}
                className="py-3"
                items={CATEGORIES.map((c) => (
                  <span key={c.id} className="inline-flex items-center gap-3 pr-2">
                    <CategoryIcon category={c.id} size="sm" />
                    <span className="font-display text-[1.25rem] font-extrabold tracking-[-0.01em] text-white uppercase">{c.label}</span>
                    <Doodle name="rayo" color="var(--block-sol)" className="ml-3 size-6" />
                  </span>
                ))}
              />
            </div>
          </div>
          <div className="relative -mx-[6%] -mt-2 rotate-[1.6deg]">
            <div className="border-y-[3px] border-ink bg-block-sol text-ink">
              <Marquee
                reverse
                speed={26}
                className="py-1.5"
                items={["Sin currículum", "Gratis", "Cerca de tu casa", "Desde tu celular", "Saltillo", "Ramos Arizpe"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-4 pr-2 font-display text-[1rem] font-extrabold tracking-[0.12em] uppercase">
                    {t}
                    <Doodle name="estrella" color="var(--block-mandarina)" className="size-5" />
                  </span>
                ))}
              />
            </div>
          </div>
        </section>

        {/* Demo entry */}
        <DemoShowcase />

        {/* ¿Qué chamba buscas? */}
        <section aria-labelledby="chambas-t" className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.8fr_1.6fr] lg:gap-12 lg:px-10 lg:py-20">
          <SectionHead id="chambas-t" eyebrow="Escoge tu rama" title="¿Qué chamba buscas?">
            <p className="mt-4 max-w-[28rem] text-[1.05rem] leading-relaxed text-muted-foreground">
              Obra, cocina, reparto, almacén, tienda, mantenimiento… Hay vacantes de todo, y muchas te quedan a unas cuadras.
            </p>
          </SectionHead>
          <Stagger as="ul" inView gap={0.07} className="grid min-w-0 lg:grid-cols-3 lg:gap-5">
            {PICKS.map((p, i) => {
              const last = i === PICKS.length - 1;
              return (
                <StaggerItem as="li" key={p.id} className={cn("relative", i > 0 && "-mt-6 lg:mt-0")} style={{ zIndex: i + 1 }}>
                  <Link
                    href="/bienvenida"
                    className={cn(
                      "group relative isolate flex min-h-[8.5rem] flex-col overflow-hidden rounded-panel px-5 pt-5 pb-10 outline-none focus-visible:ring-4 focus-visible:ring-ring/60 lg:min-h-[12rem] lg:pb-5",
                      BLOCK_CLASS[p.tone],
                      HARD,
                      PRESSABLE,
                      i % 2 ? "lg:rotate-[1.2deg]" : "lg:-rotate-[1deg]",
                    )}
                  >
                    <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-50" />
                    <span className="font-display text-[0.78rem] font-extrabold tracking-[0.14em] text-muted-foreground uppercase">
                      <CategoryCount category={p.id} />
                    </span>
                    <span className="mt-1 max-w-[62%] font-display text-[1.75rem] leading-[1] font-extrabold tracking-[-0.035em] lg:max-w-none lg:text-[1.6rem]">
                      {CATEGORY_BY_ID[p.id].label}
                    </span>
                    {last ? (
                      <span className="mt-3 inline-flex h-10 w-fit items-center gap-1.5 rounded-full border-2 border-ink bg-ink px-4 text-sm font-bold text-white lg:mt-auto">
                        Ver todas
                        <HugeiconsIcon icon={ArrowRight02Icon} className="size-4 transition-transform group-hover:translate-x-1" strokeWidth={2.4} />
                      </span>
                    ) : null}
                    <span
                      aria-hidden
                      className="absolute -right-5 -bottom-5 size-36 rotate-[-8deg] transition-transform duration-300 group-hover:scale-110 group-hover:rotate-[4deg] lg:-right-6 lg:size-32"
                    >
                      <CategoryArt category={p.id} className="size-full" />
                    </span>
                  </Link>
                </StaggerItem>
              );
            })}
          </Stagger>
        </section>

        {/* Philosophy */}
        <section aria-labelledby="filosofia" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-10 lg:py-20">
          <SectionHead id="filosofia" eyebrow="Por qué trabajar cerca" title="Cerca de casa, la vida rinde más." />
          <dl className="mt-9 grid gap-5 md:grid-cols-6">
            {PHILOSOPHY.map((p, i) => (
              <Reveal
                inView
                index={i % 2}
                key={p.line}
                className={cn(
                  "relative isolate min-w-0 overflow-hidden rounded-panel p-6 sm:p-8",
                  BLOCK_CLASS[p.tone],
                  HARD,
                  PHILO_SPAN[i],
                  i === 1 && "md:grid md:grid-cols-[1fr_1.1fr] md:content-start md:gap-x-8",
                )}
              >
                <StencilNumber n={i + 1} className="text-[3.4rem] opacity-60 sm:text-[4rem] md:col-start-1" stroke={2} />
                <dt className="mt-2 font-display text-[2.2rem] leading-[0.98] font-extrabold tracking-[-0.045em] sm:text-[2.7rem] md:col-start-1">
                  {p.line}
                </dt>
                <dd className="mt-3 max-w-[30rem] text-[1.04rem] leading-relaxed text-muted-foreground md:col-start-1">{p.fact}</dd>
                {i === 1 ? (
                  <>
                    <dd className="mt-5 md:col-start-1">
                      <p className="flex items-baseline gap-2">
                        <CountUp
                          from={0}
                          value={savings.pesos}
                          prefix="$"
                          className="font-display text-[3.8rem] leading-none font-extrabold tracking-[-0.05em] tabular-nums sm:text-[4.6rem]"
                        />
                        <span className="font-display text-lg font-extrabold uppercase">al mes</span>
                      </p>
                    </dd>
                    <dd className={cn("mt-5 overflow-hidden rounded-tile bg-white/55 md:col-start-2 md:row-span-4 md:row-start-1 md:mt-0 md:self-center", HARD_SM)}>
                      <Scene name="ahorro" className="w-full" title="Monedas y un reloj: el dinero y el tiempo que ahorras" />
                    </dd>
                  </>
                ) : null}
              </Reveal>
            ))}
          </dl>
          <p className="mt-6 text-sm text-muted-foreground">
            Estimaciones con gasolina a ~$25 por litro, un auto de 12 km por litro y 22 días de trabajo al mes.
          </p>
        </section>

        {/* How it works */}
        <section id="como-funciona" aria-labelledby="como-funciona-t" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-12 sm:px-6 lg:px-10 lg:py-20">
          <SectionHead id="como-funciona-t" eyebrow="Así de fácil" title="Tres pasos, y no pagas nada." />
          <Stagger as="ol" inView gap={0.1} className="mt-10 grid gap-7 md:grid-cols-3 md:gap-5">
            {STEPS.map((s, i) => (
              <StaggerItem as="li" key={s.title} className="min-w-0">
                <div
                  className={cn(
                    "group relative isolate h-full overflow-hidden rounded-panel p-6 pt-5",
                    BLOCK_CLASS[s.tone],
                    HARD,
                    s.tilt,
                    "transition-[rotate,translate] duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:rotate-0",
                  )}
                >
                  <span aria-hidden className="pointer-events-none absolute -top-3 -right-5 w-32 rotate-[8deg] transition-transform duration-300 group-hover:rotate-0 sm:w-36">
                    <Scene name={s.scene} className="w-full" />
                  </span>
                  <StencilNumber n={i + 1} className="text-[5rem] sm:text-[5.6rem]" />
                  <h3 className="mt-3 max-w-[85%] font-display text-[1.5rem] leading-[1.05] font-extrabold tracking-[-0.03em]">
                    {s.title}
                  </h3>
                  <p className="mt-2 text-[1.02rem] leading-relaxed text-muted-foreground">{s.body}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal inView className={cn("mt-9 flex items-start gap-3.5 rounded-panel bg-card p-5 text-[1.02rem] text-card-foreground", HARD_SM)}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-limon">
              <HugeiconsIcon icon={LockIcon} className="size-5" strokeWidth={2} />
            </span>
            <span className="pt-1.5">
              Las empresas solo ven tu colonia y la distancia. <strong className="font-bold">Tu dirección exacta nunca se muestra.</strong>
            </span>
          </Reveal>
        </section>

        {/* Employers */}
        <section id="empresas" aria-labelledby="empresas-t" className="relative scroll-mt-6 block-tinta [--hard:rgb(255_255_255/0.22)]">
          <HazardStripe className="h-4" />
          <div className="relative isolate overflow-hidden">
            <Scatter count={6} seed={5} palette={["var(--block-sol)", "var(--limon)", "var(--block-cielo)"]} className="-z-10 opacity-60" />
            {/* Row 1: pitch + crew art at equal height. Row 2: the three benefits as equal cards — no column ends early. */}
            <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-10 lg:py-24">
              <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-stretch lg:gap-14">
                <div className="min-w-0 lg:flex lg:flex-col lg:justify-center">
                  <SectionHead
                    invert
                    id="empresas-t"
                    eyebrow="Para negocios y plantas"
                    title={
                      <>
                        Personal que vive cerca llega a tiempo y <span className="text-limon">se queda.</span>
                      </>
                    }
                  >
                    <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-muted-foreground">
                      Desde una cafetería hasta una planta industrial: publica tu vacante y ve quién vive a pocos minutos de
                      tu negocio.
                    </p>
                    <Link href="/bienvenida/empresa" className={cn(chunky("lime"), "group mt-7 border-limon")}>
                      Publicar una vacante gratis
                      <HugeiconsIcon icon={ArrowRight02Icon} className="size-5 transition-transform group-hover:translate-x-1" strokeWidth={2.4} />
                    </Link>
                  </SectionHead>
                </div>
                <Reveal
                  inView
                  index={1}
                  className="relative flex min-w-0 items-center overflow-hidden rounded-panel border-[3px] border-white/80 bg-block-sol p-3 text-ink lg:p-5"
                >
                  <Scene name="equipo" className="w-full" title="Un equipo de trabajadores listos para empezar" />
                  <Rivets inset="0.6rem" />
                </Reveal>
              </div>
              <Stagger as="ul" inView gap={0.09} className="mt-10 grid min-w-0 gap-4 md:grid-cols-3 lg:mt-14 lg:gap-5">
                {BENEFITS.map((b, i) => (
                  <StaggerItem
                    as="li"
                    key={b.title}
                    className={cn(
                      "relative flex h-full gap-4 rounded-panel p-5 sm:p-6 md:flex-col",
                      BLOCK_CLASS[b.tone],
                      HARD,
                      i === 1 ? "md:rotate-[0.6deg]" : "md:-rotate-[0.4deg]",
                    )}
                  >
                    <span className="grid size-14 shrink-0 place-items-center rounded-tile bg-ink text-white">
                      <HugeiconsIcon icon={b.icon} className="size-7" strokeWidth={2} />
                    </span>
                    <span>
                      <span className="block font-display text-[1.35rem] leading-tight font-extrabold tracking-[-0.02em]">{b.title}</span>
                      <span className="mt-1 block text-[1rem] leading-relaxed text-muted-foreground">{b.body}</span>
                    </span>
                  </StaggerItem>
                ))}
              </Stagger>
            </div>
          </div>
          <HazardStripe className="h-4" />
        </section>

        {/* Pricing */}
        <section id="precios" aria-labelledby="precios-t" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-14 sm:px-6 lg:px-10 lg:py-24">
          <SectionHead id="precios-t" eyebrow="Precios de lanzamiento" title="Quien busca trabajo nunca paga.">
            <p className="mt-4 max-w-[36rem] text-lg leading-relaxed text-muted-foreground">
              Las empresas publican gratis y pagan solo por ver a quienes se postulan. Precios de lanzamiento en Saltillo.
            </p>
          </SectionHead>
          <Stagger as="div" inView gap={0.09} className="mt-12 grid items-stretch gap-7 md:grid-cols-3 md:gap-5">
            {PLANS.map((p) => (
              <StaggerItem
                key={p.name}
                className={cn(
                  "relative flex min-w-0 flex-col rounded-panel p-6 sm:p-7",
                  BLOCK_CLASS[p.tone],
                  HARD,
                  p.featured && "md:-translate-y-4",
                )}
              >
                {p.featured ? (
                  <div className="absolute -top-7 -right-2 z-10">
                    <Sticker variant="lime" size="md" rotate={10} className="border-[3px] border-ink">
                      <strong>N.º 1</strong>más pedido
                    </Sticker>
                  </div>
                ) : null}
                <h3 className="font-display text-[0.85rem] font-extrabold tracking-[0.16em] uppercase opacity-80">{p.name}</h3>
                <p className="mt-5 font-display text-[2.9rem] leading-none font-extrabold tracking-[-0.05em] tabular-nums">{p.price}</p>
                <p className="mt-2 text-[0.95rem] font-semibold text-muted-foreground">{p.unit}</p>
                <p className="mt-5 flex-1 border-t-2 border-dashed border-current/25 pt-5 text-[1rem] leading-relaxed text-muted-foreground">
                  {p.body}
                </p>
                <Link
                  href="/bienvenida/empresa"
                  className={cn(chunky(p.featured ? "lime" : "ink", "md"), "mt-6 h-12 w-full")}
                >
                  Empezar con {p.name}
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
          <Reveal inView className={cn("mt-9 flex items-start gap-3.5 rounded-panel bg-card p-5 text-[1rem] leading-relaxed text-card-foreground sm:p-6", HARD_SM)}>
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink text-white">
              <HugeiconsIcon icon={Agreement01Icon} className="size-5" strokeWidth={2} />
            </span>
            <p className="text-muted-foreground">
              Chambarrio no es agencia de reclutamiento: conectamos personas y empresas. Cada empresa entrevista,
              contrata y cumple sus obligaciones laborales.{" "}
              <Link href="/terminos" className={cn(focusLink, "font-semibold text-foreground underline decoration-2 underline-offset-4")}>
                Lee los términos
              </Link>
              .
            </p>
          </Reveal>
        </section>

        {/* Closing CTA */}
        <section aria-labelledby="cta-t" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-10 lg:pb-24">
          <Reveal inView y={24} className={cn("relative isolate overflow-hidden rounded-panel block-sol", HARD)}>
            <HazardStripe className="h-5" colors={["var(--ink)", "var(--block-sol)"]} />
            <Scatter count={6} seed={7} palette={["var(--ink)", "var(--block-mandarina)", "var(--block-uva)"]} className="-z-10" />
            <div className="grid gap-6 p-7 sm:p-10 lg:grid-cols-[1.3fr_1fr] lg:items-center lg:p-14">
              <div className="min-w-0">
                <h2 id="cta-t" className="font-display text-[2.5rem] leading-[0.98] font-extrabold tracking-[-0.05em] text-balance sm:text-[3.4rem]">
                  Tu próxima chamba puede estar a la vuelta de la esquina.
                </h2>
                <ul className="mt-6 grid gap-2.5 text-[1.03rem] font-medium sm:grid-cols-2">
                  {CLOSING.map((t) => (
                    <li key={t} className="flex items-center gap-2.5">
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-limon">
                        <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-4" strokeWidth={2.4} />
                      </span>
                      {t}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:flex-wrap">
                  <Link href="/bienvenida" className={cn(chunky("ink"), "group")}>
                    Buscar trabajo cerca
                    <HugeiconsIcon icon={ArrowRight02Icon} className="size-5 transition-transform group-hover:translate-x-1" strokeWidth={2.4} />
                  </Link>
                  <InstallButton />
                </div>
              </div>
              <div className={cn("min-w-0 overflow-hidden rounded-tile bg-white/60 p-2", HARD_SM)}>
                <Scene name="reparto" className="w-full" title="Una camioneta de reparto en camino" />
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <footer>
        <HazardStripe className="h-2.5 opacity-90" />
        <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:px-6 lg:px-10">
          <div>
            <ChambarrioLogo iconClassName="size-9 shrink-0 group-hover:animate-wiggle" />
            <p className="mt-3 text-sm text-muted-foreground">Hecho en Saltillo, Coahuila.</p>
          </div>
          <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-2 text-[0.95rem] font-medium text-muted-foreground sm:ml-auto">
            <Link href="/terminos" className={cn(focusLink, "py-2 hover:text-foreground")}>Términos y condiciones</Link>
            <Link href="/privacidad" className={cn(focusLink, "py-2 hover:text-foreground")}>Aviso de privacidad</Link>
            <Link href="/empresa" className={cn(focusLink, "py-2 hover:text-foreground")}>Panel de empresa</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
