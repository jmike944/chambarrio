import type { Metadata } from "next";
import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight02Icon,
  Building06Icon,
  Calendar03Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  LockIcon,
  Mail01Icon,
  NoteEditIcon,
  Radar01Icon,
  Store01Icon,
  Task01Icon,
  UserAccountIcon,
  UserCheck01Icon,
} from "@hugeicons/core-free-icons";
import { ChambarrioLogo } from "@/components/brand/chambarrio-logo";
import { CountUp, Reveal, Stagger, StaggerItem, Sticker } from "@/components/chamba/motion";
import { Scene, type SceneName } from "@/components/chamba/art/scenes";
import { Mascot } from "@/components/chamba/art/mascot";
import { Doodle, Marquee } from "@/components/chamba/art/doodles";
import { BLOCK_CLASS, type BlockTone } from "@/components/chamba/primitives";
import { ThemeToggle } from "@/components/theme";
import { Squiggle } from "@/components/landing/fx";
import { HARD, HARD_SM, HazardStripe, Rivets, Scatter, StencilNumber, Tape, chunky } from "@/components/landing/decor";
import { SectionHead, focusLink } from "@/components/landing/section-head";
import { LandingFooter } from "@/components/landing/landing-footer";
import { DemoLiveNote } from "@/components/landing/demo-entry";
import { ApplicantsPreview } from "@/components/empresas-landing/applicants-preview";
import { CompanyDemoButton } from "@/components/empresas-landing/company-demo-button";
import { CATEGORIES } from "@/lib/data/categories";
import { cn } from "@/lib/utils";
import { AudienceSwitch } from "@/components/landing/audience-switch";

/*
 * The page for companies: pitch, how it works, what the panel does, plans and FAQ. The landing ("/")
 * is for job seekers only and links here; plans and "desbloquear" live on this page, never on "/".
 */

export const metadata: Metadata = {
  title: "Para empresas",
  description:
    "Publica vacantes gratis en Saltillo y Ramos Arizpe y ve quién vive cerca de tu negocio. Personal que vive cerca llega a tiempo y se queda: varias sucursales, radar de cercanía y contacto por llamada o SMS.",
};

const PUBLISH = "/bienvenida/empresa";

const HERO_STATS: { value: number; suffix: string; label: string; tone: BlockTone }[] = [
  { value: 0, suffix: "", label: "pesos por publicar", tone: "sol" },
  { value: 2, suffix: " km", label: "radio más cercano", tone: "limon" },
  { value: CATEGORIES.length, suffix: "", label: "tipos de puesto", tone: "chicle" },
];

const BENEFITS: { icon: typeof Clock01Icon; title: string; body: string; tone: BlockTone }[] = [
  { icon: Clock01Icon, title: "Más puntualidad", body: "Un traslado corto deja menos espacio para el tráfico y el camión que no pasó.", tone: "sol" },
  { icon: UserCheck01Icon, title: "Menos ausentismo", body: "Cuando llegar cuesta poco, faltar por el transporte deja de ser excusa.", tone: "cielo" },
  { icon: Building06Icon, title: "Más permanencia", body: "La gente cambia menos de trabajo cuando el suyo le queda cerca de casa.", tone: "limon" },
];

const STEPS: { title: string; body: string; tone: BlockTone; scene: SceneName; tilt: string }[] = [
  {
    title: "Publica tu vacante con su sucursal",
    body: "Puesto, sueldo, horario y prestaciones, ligado a la sucursal o planta donde se trabaja. Publicar es gratis.",
    tone: "sol",
    scene: "negocio",
    tilt: "-rotate-[1.2deg]",
  },
  {
    title: "Ve quién vive cerca",
    body: "Cada postulación llega con su colonia y a cuántos kilómetros vive de tu sucursal: 2, 5, 10 o 15 km.",
    tone: "menta",
    scene: "busqueda",
    tilt: "rotate-[1deg]",
  },
  {
    title: "Entrevista y contrata",
    body: "Revisa perfiles completos, agenda la entrevista y llama o manda SMS directo. Sin intermediarios.",
    tone: "chicle",
    scene: "contratado",
    tilt: "-rotate-[0.8deg]",
  },
];

const PIPELINE: { icon: typeof Clock01Icon; title: string; body: string }[] = [
  { icon: Task01Icon, title: "Para hoy", body: "Postulaciones nuevas, entrevistas que vienen y quién ya entró." },
  { icon: Calendar03Icon, title: "Entrevistas", body: "Eliges día, hora y lugar, y le avisamos al candidato." },
  { icon: NoteEditIcon, title: "Notas privadas", body: "Tu equipo anota lo que vio. El candidato no las ve." },
];

const TODAY: { status: string; dot: string; title: string; meta: string }[] = [
  { status: "Nueva", dot: "var(--nopal)", title: "Ayudante general", meta: "Vive en Lourdes · 1.2 km" },
  { status: "Entrevista", dot: "var(--cielo)", title: "Jueves, 10:00", meta: "Sucursal Centro" },
  { status: "Contratada", dot: "var(--maiz)", title: "Cajera", meta: "Vive en Mirasierra" },
];

const PROFILE_FACTS = ["Experiencia", "Disponibilidad", "Cómo llega", "Escolaridad", "Sueldo que busca", "Licencias y habilidades"];

const PLANS: { name: string; price: string; unit: string; body: string; cta: string; featured: boolean; tone: BlockTone }[] = [
  { name: "Por vacante", price: "Gratis", unit: "para publicar", body: "Publica las vacantes que quieras. Para ver y contactar a quienes se postulan, desbloquea cada vacante por $500 MXN al mes.", cta: "Publicar gratis", featured: false, tone: "menta" },
  { name: "Pyme", price: "$1,500", unit: "MXN al mes", body: "Hasta 5 vacantes con postulaciones desbloqueadas. Para quien contrata seguido.", cta: "Empezar con Pyme", featured: true, tone: "uva" },
  { name: "Industrial", price: "Desde $6,500", unit: "MXN al mes", body: "Vacantes ilimitadas, varias plantas y reportes de rotación.", cta: "Empezar con Industrial", featured: false, tone: "durazno" },
];

const FAQ: { q: string; a: React.ReactNode; tone: BlockTone; span: string }[] = [
  {
    q: "¿Cuánto cuesta?",
    a: "Publicar vacantes es gratis. Para ver el nombre y el teléfono de quienes se postulan, desbloqueas la vacante por $500 MXN al mes, o eliges el plan Pyme o Industrial. Quien busca trabajo nunca paga.",
    tone: "sol",
    span: "md:col-span-2 lg:col-span-3",
  },
  {
    q: "¿Cómo contacto a los candidatos?",
    a: "Con la vacante desbloqueada, desde su perfil: llamada o SMS a su celular. Si agendas la entrevista en Chambarrio, le avisamos con el día, la hora y el lugar.",
    tone: "cielo",
    span: "lg:col-span-3",
  },
  {
    q: "¿Puedo publicar para varias sucursales?",
    a: "Sí. Da de alta cada sucursal o planta con su dirección. Cada vacante se liga a una y la distancia se mide desde ahí.",
    tone: "menta",
    span: "lg:col-span-2",
  },
  {
    q: "¿Qué ve el candidato?",
    a: "Tu vacante: puesto, sueldo, horario, prestaciones, la sucursal y a qué distancia le queda. Luego, en qué va su postulación: si ya la viste, la entrevista y tu respuesta. Tus notas y tu plan no los ve.",
    tone: "lila",
    span: "lg:col-span-2",
  },
  {
    q: "¿Chambarrio contrata por mí?",
    a: (
      <>
        No. No somos agencia de reclutamiento: conectamos personas y empresas. Tú entrevistas, contratas y cumples tus
        obligaciones laborales.{" "}
        <Link href="/terminos" className={cn(focusLink, "font-semibold text-foreground underline decoration-2 underline-offset-4")}>
          Lee los términos
        </Link>
        .
      </>
    ),
    tone: "durazno",
    span: "lg:col-span-2",
  },
];

const CLOSING = ["Publicar es gratis", "Todas tus sucursales en un panel", "Contacto por llamada o SMS", "Avisos por correo"];

const NAV: [href: string, label: string][] = [
  ["#como-funciona", "Cómo funciona"],
  ["#precios", "Precios"],
];

/** Icon in an ink tile, for the feature cards. */
function FeatureIcon({ icon }: { icon: typeof Clock01Icon }) {
  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-tile bg-ink text-white">
      <HugeiconsIcon icon={icon} className="size-6" strokeWidth={2} />
    </span>
  );
}

export default function EmpresasPage() {
  return (
    <div className="min-h-dvh overflow-x-clip [--hard:var(--ink)] dark:[--hard:#2c2464]">
      {/* Nav */}
      <AudienceSwitch active="empresa" />
      <header className="mx-auto flex max-w-6xl items-center gap-3 px-4 pt-4 pb-4 sm:px-6 lg:px-10">
        <Link href="/" aria-label="Chambarrio, inicio" className="group inline-flex min-h-11 items-center rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <ChambarrioLogo iconClassName="size-9 shrink-0 group-hover:animate-wiggle" />
        </Link>
        <span className="hidden shrink-0 rounded-full border-2 border-ink bg-block-sol px-2.5 py-0.5 font-display text-[0.72rem] font-extrabold tracking-[0.12em] text-ink uppercase sm:inline-block">
          Empresas
        </span>
        <nav aria-label="Secciones" className="ml-6 hidden items-center gap-1 xl:flex">
          {NAV.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="rounded-full px-4 py-2 text-[0.95rem] font-semibold whitespace-nowrap text-muted-foreground outline-none transition-colors hover:bg-card hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2 whitespace-nowrap">
          <ThemeToggle className="size-11" />
          <Link href="/entrar" className={chunky("white", "md")}>
            Entrar
          </Link>
          <Link href={PUBLISH} className={cn(chunky("lime", "md"), "hidden sm:inline-flex")}>
            Publicar vacante gratis
          </Link>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-start gap-7 px-4 pt-5 pb-10 sm:px-6 lg:grid-cols-[1.12fr_1fr] lg:items-stretch lg:gap-10 lg:px-10 lg:pt-10 lg:pb-16">
          <Reveal y={22} className={cn("relative isolate flex min-w-0 flex-col overflow-hidden rounded-panel block-uva", HARD)}>
            <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-40" />
            <Scatter count={4} seed={15} palette={["var(--limon)", "var(--block-sol)"]} className="-z-10" />
            <div className="relative px-5 pt-6 sm:px-8 sm:pt-8">
              <Tape className="-rotate-2">Para tu negocio</Tape>
              <div className="absolute top-4 right-3 sm:top-6 sm:right-6">
                <Sticker variant="lime" size="lg" rotate={12} className="border-[3px] border-ink text-[0.78rem]">
                  <strong>¡Gratis!</strong>publicar
                </Sticker>
              </div>
              <h1 className="mt-5 pr-14 font-display text-[3.05rem] leading-[0.95] font-extrabold tracking-[-0.055em] text-balance sm:pr-24 sm:text-[4.2rem] lg:text-[4.5rem]">
                Contrata gente que vive{" "}
                <span className="relative inline-block text-limon">
                  cerca.
                  <Squiggle color="var(--limon)" />
                </span>
              </h1>
              <p className="mt-5 max-w-[32rem] text-[1.08rem] leading-relaxed font-medium sm:text-lg">
                Personal que vive cerca llega a tiempo y se queda. Publica tu vacante gratis y ve quién vive a pocos
                minutos de tu negocio.
              </p>
              <div className="mt-7 flex flex-col gap-3.5 sm:flex-row sm:flex-wrap [&>*]:whitespace-nowrap">
                <Link href={PUBLISH} className={cn(chunky("lime"), "group")}>
                  Publicar vacante gratis
                  <HugeiconsIcon icon={ArrowRight02Icon} className="size-5 transition-transform group-hover:translate-x-1" strokeWidth={2.4} />
                </Link>
                <CompanyDemoButton className={cn(chunky("white"), "cursor-pointer")}>Ver el panel de demostración</CompanyDemoButton>
              </div>
              <DemoLiveNote className="mt-3" />
              <p className="mt-4 text-[0.98rem] font-medium">
                ¿Ya tienes cuenta?{" "}
                <Link href="/entrar" className={cn(focusLink, "inline-flex min-h-11 items-center font-bold underline decoration-2 underline-offset-4")}>
                  Entra aquí
                </Link>
              </p>
              <p className="text-[0.92rem] font-medium text-muted-foreground">
                ¿Buscas trabajo?{" "}
                <Link href="/" className={cn(focusLink, "inline-flex min-h-11 items-center font-semibold text-foreground underline decoration-current/40 decoration-2 underline-offset-4 hover:decoration-current")}>
                  Ve vacantes cerca de tu casa
                </Link>
              </p>
            </div>
            {/* mt-auto: the street sits on the card's bottom edge however tall the right column makes the row. */}
            <div className="relative mt-2 lg:mt-auto">
              <div className="relative z-10 ml-auto -mb-7 w-fit pr-3 sm:pr-6">
                <Mascot mood="saluda" prop="gorra" size={104} />
              </div>
              <div className="border-t-[3px] border-ink bg-block-cielo/60">
                <Scene name="barrio" className="w-full" title="Una calle de Saltillo con casas, negocios y una planta" />
              </div>
              <HazardStripe className="h-4" />
            </div>
          </Reveal>
          {/* Desktop: this column stretches to the hero's height; the preview grows, the tiles sit on the bottom line. */}
          <div className="flex min-w-0 flex-col gap-6">
            <Reveal index={2} y={22} className="lg:flex lg:flex-1 lg:flex-col">
              <ApplicantsPreview className="lg:flex-1" />
            </Reveal>
            <ul aria-label="Chambarrio para empresas en números" className="grid grid-cols-3 gap-3 sm:gap-4">
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

        {/* Perks tape */}
        <section aria-label="Lo que incluye" className="relative py-6 sm:py-8">
          <div className="relative -mx-[6%] -rotate-[1.6deg]">
            <div className="border-y-[3px] border-ink bg-block-sol text-ink">
              <Marquee
                speed={30}
                className="py-2"
                items={["Publica gratis", "Varias sucursales", "Llamada o SMS", "Avisos por correo", "Saltillo", "Ramos Arizpe"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-4 pr-2 font-display text-[1.05rem] font-extrabold tracking-[0.12em] uppercase">
                    {t}
                    <Doodle name="estrella" color="var(--block-uva)" className="size-5" />
                  </span>
                ))}
              />
            </div>
          </div>
        </section>

        {/* Why near: crew + benefits */}
        <section id="ventajas" aria-labelledby="ventajas-t" className="relative mt-6 scroll-mt-6 block-tinta [--hard:rgb(255_255_255/0.22)]">
          <HazardStripe className="h-4" />
          <div className="relative isolate overflow-hidden">
            <Scatter count={6} seed={5} palette={["var(--block-sol)", "var(--limon)", "var(--block-cielo)"]} className="-z-10 opacity-60" />
            {/* Row 1: pitch + crew art at equal height. Row 2: the three benefits as equal cards — no column ends early. */}
            <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-10 lg:py-24">
              <div className="grid gap-10 lg:grid-cols-[1fr_1.05fr] lg:items-stretch lg:gap-14">
                <div className="min-w-0 lg:flex lg:flex-col lg:justify-center">
                  <SectionHead
                    invert
                    id="ventajas-t"
                    eyebrow="Para negocios y plantas"
                    title={
                      <>
                        Un traslado corto se nota en tu <span className="text-limon">operación.</span>
                      </>
                    }
                  >
                    <p className="mt-5 max-w-[34rem] text-lg leading-relaxed text-muted-foreground">
                      Desde una cafetería hasta una planta industrial: cuando tu gente vive cerca, llega a tiempo, falta
                      menos y dura más en el puesto.
                    </p>
                    <Link href={PUBLISH} className={cn(chunky("lime"), "group mt-7 border-limon")}>
                      Publicar una vacante gratis
                      <HugeiconsIcon icon={ArrowRight02Icon} className="size-5 transition-transform group-hover:translate-x-1" strokeWidth={2.4} />
                    </Link>
                  </SectionHead>
                </div>
                <Reveal
                  inView
                  index={1}
                  className="relative flex min-w-0 items-end overflow-hidden rounded-panel border-[3px] border-white/80 bg-block-sol p-3 pb-0 text-ink lg:p-5 lg:pb-0"
                >
                  {/* items-end + no bottom padding: the crew is cut at the hips by the card's edge, not mid-card;
                      bleed: the sunburst fills the card above the scene instead of leaving a plain band */}
                  <Scene name="equipo" bleed className="w-full" title="Un equipo de trabajadores listos para empezar" />
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

        {/* How it works */}
        <section id="como-funciona" aria-labelledby="como-funciona-t" className="mx-auto max-w-6xl scroll-mt-6 px-4 py-14 sm:px-6 lg:px-10 lg:py-24">
          <SectionHead id="como-funciona-t" eyebrow="Cómo funciona para empresas" title="De la vacante a la contratación." />
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
                  <h3 className="mt-3 max-w-[85%] font-display text-[1.5rem] leading-[1.05] font-extrabold tracking-[-0.03em]">{s.title}</h3>
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
              Por privacidad, quien se postula comparte su colonia y la distancia. <strong className="font-bold">Su dirección exacta nunca se muestra.</strong>
            </span>
          </Reveal>
        </section>

        {/* Features */}
        <section id="funciones" aria-labelledby="funciones-t" className="mx-auto max-w-6xl scroll-mt-6 px-4 pb-14 sm:px-6 lg:px-10 lg:pb-24">
          <SectionHead id="funciones-t" eyebrow="Tu panel de empresa" title="Todo para contratar cerca, en un solo lugar." />
          {/* Bento: every row is full (md: 2 + 1·1 + 1·1, lg: 4·2 + 2·2·2), cards in a row share one height. */}
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-6">
            {/* Hiring process */}
            <Reveal inView className={cn("relative isolate min-w-0 overflow-hidden rounded-panel p-6 block-lila sm:p-7 md:col-span-2 lg:col-span-4", HARD)}>
              <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-40" />
              <div className="grid gap-6 lg:grid-cols-[1.05fr_1fr] lg:items-stretch">
                <div className="min-w-0">
                  <FeatureIcon icon={UserAccountIcon} />
                  <h3 className="mt-4 font-display text-[1.75rem] leading-[1.02] font-extrabold tracking-[-0.035em]">Tu proceso de contratación, en orden.</h3>
                  <p className="mt-2 text-[1rem] leading-relaxed text-muted-foreground">
                    Cada postulación avanza de Enviada a Vista, Entrevista y Contratada.
                  </p>
                  <ul className="mt-4 grid gap-2.5">
                    {PIPELINE.map((p) => (
                      <li key={p.title} className="flex items-start gap-2.5">
                        <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-ink text-limon">
                          <HugeiconsIcon icon={p.icon} className="size-4" strokeWidth={2.2} />
                        </span>
                        <span className="text-[0.98rem] leading-snug">
                          <strong className="font-bold">{p.title}:</strong> <span className="text-muted-foreground">{p.body}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div aria-hidden className={cn("flex min-w-0 flex-col rounded-tile bg-white p-4 text-ink", HARD_SM)}>
                  <p className="flex items-center gap-2 font-display text-[1.15rem] font-extrabold tracking-[-0.02em]">
                    Para hoy
                    <span className="ml-auto rounded-full bg-ink px-2 py-0.5 font-sans text-[0.72rem] font-bold text-limon">Ejemplo</span>
                  </p>
                  <ul className="mt-3 grid flex-1 content-between gap-2.5">
                    {TODAY.map((t) => (
                      <li key={t.status} className="rounded-[0.9rem] border-2 border-ink/80 bg-block-lila/35 px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-[0.72rem] font-extrabold tracking-[0.1em] uppercase">
                          <span className="size-2.5 rounded-full" style={{ background: t.dot }} />
                          {t.status}
                        </span>
                        <span className="mt-0.5 block font-display text-[1.05rem] leading-tight font-extrabold">{t.title}</span>
                        <span className="block text-[0.85rem] text-ink/70">{t.meta}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </Reveal>

            {/* Branches */}
            <Reveal inView index={1} className={cn("relative isolate flex min-w-0 flex-col overflow-hidden rounded-panel p-6 block-sol sm:p-7 lg:col-span-2", HARD)}>
              <FeatureIcon icon={Store01Icon} />
              <h3 className="mt-4 font-display text-[1.5rem] leading-[1.05] font-extrabold tracking-[-0.03em]">Varias sucursales</h3>
              <p className="mt-2 text-[1rem] leading-relaxed text-muted-foreground">
                Da de alta cada sucursal o planta con su dirección. Cada vacante se liga a una y la distancia se mide desde ahí.
              </p>
              <div className={cn("mt-5 -mb-2 overflow-hidden rounded-tile bg-white/60 lg:mt-auto", HARD_SM)}>
                <Scene name="mapa" className="mx-auto w-44" title="Un mapa con varias sucursales marcadas" />
              </div>
            </Reveal>

            {/* Proximity radar */}
            <Reveal inView className={cn("relative isolate flex min-w-0 flex-col overflow-hidden rounded-panel p-6 block-menta sm:p-7 lg:col-span-2", HARD)}>
              <FeatureIcon icon={Radar01Icon} />
              <h3 className="mt-4 font-display text-[1.5rem] leading-[1.05] font-extrabold tracking-[-0.03em]">Radar de cercanía</h3>
              <p className="mt-2 text-[1rem] leading-relaxed text-muted-foreground">
                Tu vacante aparece en el radar de quien vive cerca, y ves a cuántos kilómetros vive cada postulante.
              </p>
              <div className={cn("mt-5 overflow-hidden rounded-tile bg-white/60 md:mt-auto", HARD_SM)}>
                <Scene name="radar" className="mx-auto w-40" title="Una casa con anillos de distancia y vacantes alrededor" />
              </div>
            </Reveal>

            {/* Full profiles */}
            <Reveal inView index={1} className={cn("relative isolate flex min-w-0 flex-col overflow-hidden rounded-panel p-6 block-durazno sm:p-7 lg:col-span-2", HARD)}>
              <FeatureIcon icon={UserCheck01Icon} />
              <h3 className="mt-4 font-display text-[1.5rem] leading-[1.05] font-extrabold tracking-[-0.03em]">Perfiles completos</h3>
              <p className="mt-2 text-[1rem] leading-relaxed text-muted-foreground">
                Sin pedir currículum: cada postulante llega con lo que necesitas para decidir a quién llamar.
              </p>
              <ul className="mt-5 flex flex-wrap gap-2 md:mt-auto md:pt-5">
                {PROFILE_FACTS.map((f) => (
                  <li key={f} className="rounded-full border-2 border-ink bg-white px-3 py-1 text-[0.85rem] font-bold text-ink">
                    {f}
                  </li>
                ))}
              </ul>
            </Reveal>

            {/* Email alerts */}
            <Reveal inView index={2} className={cn("relative isolate flex min-w-0 flex-col overflow-hidden rounded-panel p-6 block-cielo sm:p-7 lg:col-span-2", HARD)}>
              <FeatureIcon icon={Mail01Icon} />
              <h3 className="mt-4 font-display text-[1.5rem] leading-[1.05] font-extrabold tracking-[-0.03em]">Avisos por correo</h3>
              <p className="mt-2 text-[1rem] leading-relaxed text-muted-foreground">
                Te escribimos cuando alguien se postula, con su colonia y a qué distancia vive de tu sucursal.
              </p>
              <div aria-hidden className={cn("mt-5 overflow-hidden rounded-tile bg-white text-ink md:mt-auto", HARD_SM)}>
                <p className="flex items-center gap-2 border-b-2 border-ink/15 px-3.5 py-2 text-[0.8rem] font-bold">
                  <span className="grid size-6 place-items-center rounded-full bg-ink text-limon">
                    <HugeiconsIcon icon={Mail01Icon} className="size-3.5" strokeWidth={2.4} />
                  </span>
                  Nueva postulación: Ayudante general
                </p>
                <div className="px-3.5 py-3">
                  <p className="text-[0.92rem] leading-snug">
                    Alguien que vive en <strong>Lourdes</strong>, a <strong>1.2&nbsp;km</strong> de <strong>Sucursal Centro</strong>, se postuló.
                  </p>
                  <span className="mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-full bg-ink px-3 text-[0.8rem] font-bold text-white">
                    Ver postulación
                    <HugeiconsIcon icon={ArrowRight02Icon} className="size-3.5" strokeWidth={2.4} />
                  </span>
                </div>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Pricing */}
        <section id="precios" aria-labelledby="precios-t" className="mx-auto max-w-6xl scroll-mt-6 px-4 pb-14 sm:px-6 lg:px-10 lg:pb-24">
          <SectionHead id="precios-t" eyebrow="Precios de lanzamiento" title="Publicar es gratis.">
            <p className="mt-4 max-w-[36rem] text-lg leading-relaxed text-muted-foreground">
              Las empresas publican gratis y pagan solo por ver a quienes se postulan. Precios de lanzamiento en Saltillo.
            </p>
          </SectionHead>
          <Stagger as="div" inView gap={0.09} className="mt-12 grid items-stretch gap-7 md:grid-cols-3 md:gap-5">
            {PLANS.map((p) => (
              <StaggerItem
                key={p.name}
                className={cn("relative flex min-w-0 flex-col rounded-panel p-6 sm:p-7", BLOCK_CLASS[p.tone], HARD, p.featured && "md:-translate-y-4")}
              >
                {p.featured ? (
                  <div className="absolute -top-7 -right-2 z-10">
                    <Sticker variant="lime" size="md" rotate={10} className="border-[3px] border-ink">
                      <strong>Para</strong>crecer
                    </Sticker>
                  </div>
                ) : null}
                <h3 className="font-display text-[0.85rem] font-extrabold tracking-[0.16em] uppercase opacity-80">{p.name}</h3>
                <p className="mt-5 font-display text-[2.9rem] leading-none font-extrabold tracking-[-0.05em] tabular-nums">{p.price}</p>
                <p className="mt-2 text-[0.95rem] font-semibold text-muted-foreground">{p.unit}</p>
                <p className="mt-5 flex-1 border-t-2 border-dashed border-current/25 pt-5 text-[1rem] leading-relaxed text-muted-foreground">{p.body}</p>
                <Link href={PUBLISH} className={cn(chunky(p.featured ? "lime" : "ink", "md"), "mt-6 h-12 w-full")}>
                  {p.cta}
                </Link>
              </StaggerItem>
            ))}
          </Stagger>
        </section>

        {/* FAQ */}
        <section id="preguntas" aria-labelledby="preguntas-t" className="mx-auto max-w-6xl scroll-mt-6 px-4 pb-14 sm:px-6 lg:px-10 lg:pb-24">
          <SectionHead id="preguntas-t" eyebrow="Preguntas frecuentes" title="Lo que nos preguntan." />
          {/* md: 2 + 1·1 + 1·1, lg: 3·3 + 2·2·2 — every row full, cards in a row share one height. */}
          <dl className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-6">
            {FAQ.map((f, i) => (
              <Reveal
                inView
                index={i % 3}
                key={f.q}
                className={cn("relative isolate min-w-0 overflow-hidden rounded-panel p-6 sm:p-7", BLOCK_CLASS[f.tone], HARD, f.span)}
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-3 right-4 font-display text-[5.5rem] leading-none font-extrabold opacity-15"
                >
                  ?
                </span>
                <dt className="pr-10 font-display text-[1.4rem] leading-[1.08] font-extrabold tracking-[-0.03em]">{f.q}</dt>
                <dd className="mt-3 text-[1rem] leading-relaxed text-muted-foreground">{f.a}</dd>
              </Reveal>
            ))}
          </dl>
        </section>

        {/* Closing CTA */}
        <section aria-labelledby="cta-t" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-10 lg:pb-24">
          <Reveal inView y={24} className={cn("relative isolate overflow-hidden rounded-panel block-menta", HARD)}>
            <HazardStripe className="h-5" colors={["var(--ink)", "var(--block-menta)"]} />
            <Scatter count={6} seed={9} palette={["var(--ink)", "var(--block-uva)", "var(--block-mandarina)"]} className="-z-10" />
            {/* items-stretch: the art card runs the full height of the copy, so both columns end together. */}
            <div className="grid gap-6 p-7 sm:p-10 lg:grid-cols-[1.3fr_1fr] lg:items-stretch lg:p-14">
              <div className="min-w-0">
                <h2 id="cta-t" className="font-display text-[2.5rem] leading-[0.98] font-extrabold tracking-[-0.05em] text-balance sm:text-[3.4rem]">
                  Tu próximo empleado puede vivir a la vuelta.
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
                <div className="mt-8 flex flex-col gap-3.5 sm:flex-row sm:flex-wrap [&>*]:whitespace-nowrap">
                  <Link href={PUBLISH} className={cn(chunky("ink"), "group")}>
                    Publicar vacante gratis
                    <HugeiconsIcon icon={ArrowRight02Icon} className="size-5 transition-transform group-hover:translate-x-1" strokeWidth={2.4} />
                  </Link>
                  <CompanyDemoButton className={cn(chunky("white"), "cursor-pointer")}>Ver el panel de demostración</CompanyDemoButton>
                </div>
              </div>
              <div className={cn("relative isolate flex min-w-0 flex-col justify-end overflow-hidden rounded-tile bg-block-sol text-ink", HARD_SM)}>
                <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-50" />
                <Scene name="exito" bleed className="mx-auto w-full max-w-[22rem]" title="Chambita celebra con un trofeo" />
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <LandingFooter
        links={[
          { href: "/", label: "Busco trabajo" },
          { href: "/terminos", label: "Términos y condiciones" },
          { href: "/privacidad", label: "Aviso de privacidad" },
          { href: "/empresa", label: "Panel de empresa" },
        ]}
      />
    </div>
  );
}
