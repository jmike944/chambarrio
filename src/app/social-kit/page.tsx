import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight02Icon,
  Building06Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
  UserCheck01Icon,
  ViewOffSlashIcon,
} from "@hugeicons/core-free-icons";
import { ChambarrioAppIcon, ChambarrioLogo } from "@/components/brand/chambarrio-logo";
import { CATEGORY_BLOCK, CategoryArt } from "@/components/chamba/job-icons";
import { Padlock } from "@/components/empresa/padlock";
import { Scene, type SceneName } from "@/components/chamba/art/scenes";
import { Mascot } from "@/components/chamba/art/mascot";
import { BLOCK_CLASS, type BlockTone } from "@/components/chamba/primitives";
import { HazardStripe, Scatter, Tape } from "@/components/landing/decor";
import { CATEGORIES } from "@/lib/data/categories";
import { RADIUS_STOPS, bandColor, bandFor, monthlySavings } from "@/lib/geo";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";

/*
 * Social media kit: the Instagram / Facebook launch graphics, drawn with the app's own art and
 * tokens so they match the product. Development only (404 in production).
 *
 * /social-kit shows every post as a fixed-size canvas. `node scripts/social-posts.mjs` screenshots
 * each one into chambarrio-brand/social/posts/. Captions live in chambarrio-brand/social/POSTS.md.
 * Sizes are in px on purpose: these are images, not responsive pages.
 */

export const metadata: Metadata = { title: "Social kit", robots: { index: false, follow: false } };

const SITE = "chambarrio.com";
const savings = monthlySavings(5);

/* ------------------------------------------------------------------ shared pieces */

type Size = { w: number; h: number };
const FEED: Size = { w: 1080, h: 1350 }; // 4:5, the tallest feed format on Instagram and Facebook
const STORY: Size = { w: 1080, h: 1920 }; // 9:16 stories and reels covers
const COVER: Size = { w: 1640, h: 924 }; // Facebook page cover (keep content in the middle band)

const HARD = "border-[5px] border-ink shadow-[9px_9px_0_0_var(--ink)]";
const HARD_SM = "border-[4px] border-ink shadow-[6px_6px_0_0_var(--ink)]";
/** Headline classes. The size goes first: tailwind-merge drops a `leading-*` that comes before a text size. */
const h = (size: string, className?: string) =>
  cn("font-display font-extrabold tracking-[-0.045em] text-balance", size, "leading-[0.94]", className);

function Canvas({ size, tone, className, children }: { size: Size; tone: BlockTone; className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn("relative isolate flex flex-col overflow-hidden", BLOCK_CLASS[tone], className)}
      style={{ width: size.w, height: size.h }}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-60 [background-size:22px_22px]" />
      {children}
    </div>
  );
}

/** Brand strip that closes every post: hazard tape, logo and the address. */
function Footer({ cta = SITE, className }: { cta?: string; className?: string }) {
  return (
    <div className={cn("relative z-20 mt-auto shrink-0", className)}>
      <HazardStripe className="h-[22px] border-y-[4px] border-ink" size={18} />
      <div className="flex h-[108px] items-center justify-between px-[56px] block-tinta">
        <ChambarrioLogo iconClassName="size-[62px] shrink-0" wordmarkClassName="text-[46px]" className="gap-[14px]" />
        <span className="inline-flex h-[62px] items-center gap-[10px] rounded-full bg-limon px-[30px] font-display text-[32px] font-extrabold tracking-[-0.01em] text-ink">
          {cta}
          <HugeiconsIcon icon={ArrowRight02Icon} className="size-[30px]" strokeWidth={2.6} />
        </span>
      </div>
    </div>
  );
}

/** Hand-drawn underline (the landing's squiggle, drawn still). */
function Under({ children, color = "var(--ink)", className }: { children: React.ReactNode; color?: string; className?: string }) {
  return (
    <span className={cn("relative inline-block", className)}>
      {children}
      <svg
        aria-hidden
        viewBox="0 0 200 24"
        preserveAspectRatio="none"
        className="pointer-events-none absolute inset-x-[-3%] -bottom-[0.16em] h-[0.3em] w-[106%] overflow-visible"
      >
        <path
          d="M4 15 C 28 3, 46 22, 74 12 S 120 2, 146 13 S 184 20, 196 7"
          fill="none"
          stroke={color}
          strokeWidth={15}
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </span>
  );
}

function Badge({ big, small, size = 236, rotate = 12, className }: { big: string; small: string; size?: number; rotate?: number; className?: string }) {
  return (
    <span
      className={cn("grid shrink-0 place-items-center rounded-full border-[5px] border-ink bg-limon text-center text-ink shadow-[7px_7px_0_0_var(--ink)]", className)}
      style={{ width: size, height: size, rotate: `${rotate}deg` }}
    >
      <span>
        <strong className="block font-display leading-[0.95] font-extrabold tracking-[-0.03em]" style={{ fontSize: size * 0.25 }}>
          {big}
        </strong>
        <span className="mt-[4px] block leading-[1.05] font-semibold" style={{ fontSize: size * 0.125 }}>
          {small}
        </span>
      </span>
    </span>
  );
}

function BigTape({ children, className }: { children: React.ReactNode; className?: string }) {
  return <Tape className={cn("h-[58px] w-fit px-[24px] text-[27px] shadow-[4px_4px_0_0_rgb(22_15_51/0.25)]", className)}>{children}</Tape>;
}

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("inline-flex items-center gap-[14px] font-display text-[28px] font-extrabold tracking-[0.16em] text-uva-ink uppercase", className)}>
      <HazardStripe className="h-[18px] w-[52px] rounded-[4px]" size={8} />
      {children}
    </p>
  );
}

function Stencil({ n, className }: { n: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("block font-display font-extrabold tracking-[-0.04em] tabular-nums", className, "leading-none")}
      style={{ color: "transparent", WebkitTextStroke: "5px var(--foreground)" }}
    >
      {String(n).padStart(2, "0")}
    </span>
  );
}

function Check({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-[18px]">
      <span className="grid size-[50px] shrink-0 place-items-center rounded-full bg-ink text-limon">
        <HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-[32px]" strokeWidth={2.4} />
      </span>
      {children}
    </li>
  );
}

function ArtCard({ scene, className, tone = "bg-white/60" }: { scene: SceneName; className?: string; tone?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-[40px]", tone, HARD, className)}>
      <Scene name={scene} animated={false} className="w-full" />
    </div>
  );
}

/* ------------------------------------------------------------------ feed posts (1080 x 1350) */

function Lanzamiento() {
  return (
    <Canvas size={FEED} tone="mandarina">
      <Scatter count={5} seed={2} palette={["var(--block-sol)", "var(--limon)"]} size="size-[56px]" className="-inset-x-[34px] inset-y-0 -z-10" />
      <div className="relative px-[64px] pt-[64px]">
        <BigTape className="-rotate-2">Saltillo · Ramos Arizpe</BigTape>
        <Badge big="¡Gratis!" small="sin currículum" className="absolute top-[44px] right-[52px]" />
        <h1 className={h("text-[146px]", "mt-[40px]")}>
          El trabajo
          <br />
          que buscas,
          <br />
          <Under>cerca</Under> de ti.
        </h1>
        <p className="mt-[40px] max-w-[760px] text-[43px] leading-[1.28] font-medium">
          Vacantes a 2, 5, 10 o 15 km de tu casa. Desde tu celular.
        </p>
      </div>
      <div className="relative mt-auto">
        <Mascot mood="saluda" prop="casco" size={250} animated={false} className="absolute right-[56px] bottom-[346px] z-10" />
        <div className="border-t-[5px] border-ink bg-block-cielo">
          <Scene name="barrio" animated={false} className="w-full" />
        </div>
      </div>
      <Footer className="mt-0" />
    </Canvas>
  );
}

function Radio() {
  return (
    <Canvas size={FEED} tone="cielo">
      <Scatter count={4} seed={4} palette={["var(--block-uva)", "var(--block-mandarina)"]} size="size-[52px]" className="-inset-x-[34px] inset-y-0 -z-10" />
      <div className="px-[64px] pt-[68px]">
        <Eyebrow>Tú decides la distancia</Eyebrow>
        <h1 className={h("text-[132px]", "mt-[22px]")}>
          ¿Qué tan lejos <Under color="var(--block-uva)">le entras?</Under>
        </h1>
      </div>
      <div className="relative mx-auto mt-[44px] w-[470px]">
        <div className={cn("overflow-hidden rounded-full bg-white", HARD)}>
          <Scene name="radar" animated={false} className="w-full" />
        </div>
        <Badge big="2 km" small="a pie o en bici" size={200} rotate={-10} className="absolute -top-[10px] -left-[170px]" />
      </div>
      <ul className="mt-[44px] flex justify-center gap-[18px] px-[64px]">
        {RADIUS_STOPS.map((km) => (
          <li
            key={km}
            className={cn("inline-flex h-[84px] items-center gap-[14px] rounded-full bg-white px-[30px] font-display text-[40px] font-extrabold tracking-[-0.02em]", HARD_SM)}
          >
            <span className="size-[24px] rounded-full border-[3px] border-ink" style={{ background: bandColor(bandFor(km)) }} />
            {km} km
          </li>
        ))}
      </ul>
      <p className="mt-[34px] px-[64px] text-center text-[37px] leading-[1.3] font-medium">
        Elige tu radio y ve solo las vacantes que te quedan cerca.
      </p>
      <Footer />
    </Canvas>
  );
}

function Ahorro() {
  return (
    <Canvas size={FEED} tone="sol">
      <Scatter count={4} seed={7} palette={["var(--ink)", "var(--block-mandarina)"]} size="size-[52px]" className="-inset-x-[34px] inset-y-0 -z-10" />
      <div className="px-[64px] pt-[68px]">
        <Eyebrow>Cerca de casa, la vida rinde más</Eyebrow>
        <h1 className={h("text-[142px]", "mt-[22px]")}>
          Menos camión,
          <br />
          <Under color="var(--block-mandarina)">más vida.</Under>
        </h1>
      </div>
      <div className="mt-[52px] grid grid-cols-2 gap-[26px] px-[64px]">
        <div className={cn("rounded-[40px] bg-white p-[34px]", HARD)}>
          <p className="font-display text-[26px] font-extrabold tracking-[0.14em] text-ink/70 uppercase">Hasta</p>
          <p className="mt-[4px] font-display text-[112px] leading-none font-extrabold tracking-[-0.05em] tabular-nums">
            ${formatNumber(savings.pesos)}
          </p>
          <p className="mt-[12px] text-[32px] leading-[1.22] font-semibold text-balance">menos en gasolina al mes</p>
        </div>
        <div className={cn("rotate-[1.5deg] rounded-[40px] p-[34px] block-cielo", HARD)}>
          <p className="font-display text-[26px] font-extrabold tracking-[0.14em] text-ink/70 uppercase">Hasta</p>
          <p className="mt-[4px] font-display text-[112px] leading-none font-extrabold tracking-[-0.05em] tabular-nums">
            {savings.hours} h
          </p>
          <p className="mt-[12px] text-[32px] leading-[1.22] font-semibold text-balance">menos en el tráfico al mes</p>
        </div>
      </div>
      <div className="mt-[44px] grid grid-cols-[1fr_500px] items-center gap-[34px] px-[64px]">
        <div>
          <p className="text-[38px] leading-[1.25] font-semibold">Si trabajas a 5 km o menos de tu casa.</p>
          <p className="mt-[18px] text-[23px] leading-[1.35] font-medium text-ink/70">
            Estimado con gasolina a unos 25 pesos por litro, un auto de 12 km por litro y 22 días de trabajo al mes.
          </p>
        </div>
        <ArtCard scene="ahorro" className="-rotate-[1.5deg]" />
      </div>
      <Footer />
    </Canvas>
  );
}

const STEPS: { title: string; body: string; tone: BlockTone; scene: SceneName }[] = [
  { title: "Entra con tu celular o correo", body: "Sin currículum. Te mandamos un código por SMS o correo y listo.", tone: "durazno", scene: "codigo" },
  { title: "Elige qué tan lejos", body: "2, 5, 10 o 15 km de tu casa. Ves sueldo, horario y prestaciones antes de moverte.", tone: "cielo", scene: "mapa" },
  { title: "Habla directo con la empresa", body: "Postúlate con un toque o llámales directo. Sin intermediarios.", tone: "limon", scene: "contratado" },
];

function Swipe({ label = "Desliza" }: { label?: string }) {
  return (
    <span className={cn("inline-flex h-[76px] w-fit items-center gap-[14px] rounded-full bg-ink px-[34px] font-display text-[34px] font-extrabold text-white")}>
      {label}
      <HugeiconsIcon icon={ArrowRight02Icon} className="size-[36px] text-limon" strokeWidth={2.6} />
    </span>
  );
}

function PasosPortada() {
  return (
    <Canvas size={FEED} tone="uva">
      <Scatter count={5} seed={15} palette={["var(--limon)", "var(--block-sol)"]} size="size-[56px]" className="-inset-x-[34px] inset-y-0 -z-10" />
      <div className="px-[64px] pt-[68px]">
        <BigTape className="-rotate-2">Así de fácil</BigTape>
        <h1 className={h("text-[160px]", "mt-[40px]")}>
          Tres pasos,
          <br />y no pagas <Under color="var(--limon)" className="text-limon">nada.</Under>
        </h1>
        <p className="mt-[44px] max-w-[820px] text-[44px] leading-[1.28] font-medium">
          Así encuentras chamba cerca de tu casa en Chambarrio.
        </p>
      </div>
      <div className="mt-auto flex items-end justify-between px-[64px] pb-[44px]">
        <span className="inline-flex h-[84px] items-center gap-[14px] rounded-full border-[5px] border-ink bg-limon px-[36px] font-display text-[38px] font-extrabold text-ink shadow-[7px_7px_0_0_var(--ink)]">
          Desliza
          <HugeiconsIcon icon={ArrowRight02Icon} className="size-[40px]" strokeWidth={2.6} />
        </span>
        <Mascot mood="feliz" prop="telefono" size={350} animated={false} className="-mb-[34px]" />
      </div>
      <Footer className="mt-0" />
    </Canvas>
  );
}

function Paso({ i }: { i: number }) {
  const s = STEPS[i];
  return (
    <Canvas size={FEED} tone={s.tone}>
      <div className="flex items-start justify-between px-[64px] pt-[64px]">
        <Stencil n={i + 1} className="text-[250px]" />
        <span className="mt-[18px] inline-flex h-[58px] items-center rounded-full border-[4px] border-ink bg-white px-[26px] font-display text-[26px] font-extrabold tracking-[0.12em] uppercase">
          Paso {i + 1} de 3
        </span>
      </div>
      <div className="px-[64px]">
        <h1 className={h("text-[108px]", "mt-[18px]")}>{s.title}</h1>
        <p className="mt-[30px] max-w-[900px] text-[42px] leading-[1.3] font-medium">{s.body}</p>
      </div>
      <div className="mt-auto flex items-end justify-between px-[64px] pb-[44px]">
        {i < STEPS.length - 1 ? <Swipe /> : <Swipe label="Y listo" />}
        <div className={cn("w-[440px] rotate-[3deg] overflow-hidden rounded-[40px] bg-white/60", HARD)}>
          <Scene name={s.scene} animated={false} className="w-full" />
        </div>
      </div>
      <Footer className="mt-0" />
    </Canvas>
  );
}

function PasosCierre() {
  return (
    <Canvas size={FEED} tone="sol">
      <HazardStripe className="h-[30px] border-b-[4px] border-ink" colors={["var(--ink)", "var(--block-sol)"]} size={20} />
      <Scatter count={5} seed={9} palette={["var(--ink)", "var(--block-mandarina)", "var(--block-uva)"]} size="size-[52px]" className="-inset-x-[34px] inset-y-0 -z-10" />
      <div className="px-[64px] pt-[56px]">
        <h1 className={h("text-[112px]")}>Tu próxima chamba puede estar a la vuelta de la esquina.</h1>
        <ul className="mt-[40px] grid gap-[20px] text-[38px] leading-tight font-semibold">
          <Check>Gratis para siempre si buscas trabajo</Check>
          <Check>Funciona en cualquier teléfono</Check>
          <Check>Avisos de vacantes nuevas cerca de ti</Check>
        </ul>
      </div>
      <div className="mt-auto flex items-end justify-between px-[64px] pb-[40px]">
        <span className="mb-[10px] inline-flex h-[92px] items-center gap-[14px] rounded-full bg-ink px-[40px] font-display text-[40px] font-extrabold text-white shadow-[7px_7px_0_0_rgb(22_15_51/0.3)]">
          Entra a {SITE}
        </span>
        <Mascot mood="festeja" prop="paquete" size={330} animated={false} className="-mb-[30px]" />
      </div>
      <Footer className="mt-0" cta="Busco chamba" />
    </Canvas>
  );
}

function Chambas() {
  return (
    <Canvas size={FEED} tone="tinta">
      <Scatter count={4} seed={5} palette={["var(--block-sol)", "var(--limon)", "var(--block-cielo)"]} size="size-[48px]" className="-inset-x-[34px] inset-y-0 -z-10 opacity-70" />
      <div className="px-[64px] pt-[64px]">
        <Eyebrow className="text-limon">Escoge tu rama</Eyebrow>
        <h1 className={h("text-[128px]", "mt-[20px]")}>
          ¿Qué chamba <Under color="var(--block-mandarina)">buscas?</Under>
        </h1>
      </div>
      <ul className="mt-[44px] grid grid-cols-3 gap-[18px] px-[64px]">
        {CATEGORIES.map((c, i) => (
          <li
            key={c.id}
            className={cn(
              "relative flex h-[160px] flex-col justify-end overflow-hidden rounded-[30px] border-[4px] border-white/85 p-[18px]",
              BLOCK_CLASS[CATEGORY_BLOCK[c.id]],
              i % 2 ? "rotate-[0.8deg]" : "-rotate-[0.8deg]",
            )}
          >
            <span aria-hidden className="absolute top-[2px] right-[4px] size-[108px]">
              <CategoryArt category={c.id} className="size-full" />
            </span>
            <span className="max-w-[62%] font-display text-[30px] leading-[1.02] font-extrabold tracking-[-0.02em]">{c.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-[34px] px-[64px] text-[37px] leading-[1.3] font-medium text-white/85">
        De todo, y a unas cuadras de tu casa.
      </p>
      <Footer />
    </Canvas>
  );
}

function Privacidad() {
  return (
    <Canvas size={FEED} tone="menta">
      <Scatter count={4} seed={11} palette={["var(--ink)", "var(--block-uva)"]} size="size-[52px]" className="-inset-x-[34px] inset-y-0 -z-10" />
      <div className="px-[64px] pt-[64px]">
        <Padlock open={false} className="size-[150px] -rotate-6" />
        <h1 className={h("text-[134px]", "mt-[36px]")}>
          Tu dirección exacta <Under color="var(--block-uva)">nunca</Under> se muestra.
        </h1>
      </div>
      <div className={cn("mx-[64px] mt-[52px] rotate-[-1deg] rounded-[40px] bg-white p-[36px]", HARD)}>
        <p className="font-display text-[26px] font-extrabold tracking-[0.14em] text-ink/65 uppercase">Lo que ve la empresa</p>
        <div className="mt-[20px] flex items-center justify-between gap-[20px]">
          <p className="font-display text-[54px] leading-none font-extrabold tracking-[-0.03em]">Vive en Lourdes</p>
          <span className="inline-flex h-[70px] shrink-0 items-center gap-[12px] rounded-full border-[4px] border-ink px-[26px] font-display text-[36px] font-extrabold">
            <span className="size-[22px] rounded-full" style={{ background: "var(--nopal)" }} />
            1.2 km
          </span>
        </div>
        <div className="mt-[26px] flex items-center gap-[16px] border-t-[4px] border-dashed border-ink/25 pt-[26px] text-[34px] font-semibold text-ink/60">
          <HugeiconsIcon icon={ViewOffSlashIcon} className="size-[42px] shrink-0" strokeWidth={2.2} />
          <span className="line-through decoration-[4px]">Calle y número</span>
          <span className="ml-auto rounded-full bg-ink px-[22px] py-[6px] font-display text-[26px] font-extrabold tracking-[0.08em] text-limon uppercase">Oculto</span>
        </div>
      </div>
      <p className="mt-[44px] px-[64px] text-[40px] leading-[1.3] font-medium">
        Las empresas solo ven tu colonia y la distancia.
      </p>
      <Footer />
    </Canvas>
  );
}

function Empresas() {
  return (
    <Canvas size={FEED} tone="uva">
      <Scatter count={5} seed={15} palette={["var(--limon)", "var(--block-sol)"]} size="size-[56px]" className="-inset-x-[34px] inset-y-0 -z-10" />
      <div className="relative px-[64px] pt-[64px]">
        <BigTape className="-rotate-2">Para tu negocio</BigTape>
        <Badge big="¡Gratis!" small="publicar" className="absolute top-[44px] right-[52px]" />
        <h1 className={h("text-[146px]", "mt-[40px]")}>
          Contrata
          <br />
          gente que
          <br />
          vive <Under color="var(--limon)" className="text-limon">cerca.</Under>
        </h1>
        <p className="mt-[40px] max-w-[880px] text-[43px] leading-[1.28] font-medium">
          Personal que vive cerca llega a tiempo y se queda.
        </p>
      </div>
      <div className="relative mt-auto overflow-hidden border-t-[5px] border-ink bg-block-sol">
        <Scene name="equipo" animated={false} bleed className="mx-auto w-[880px]" />
      </div>
      <Footer className="mt-0" cta="chambarrio.com/empresas" />
    </Canvas>
  );
}

const BENEFITS: { icon: typeof Clock01Icon; title: string; body: string; tone: BlockTone; tilt: string }[] = [
  { icon: Clock01Icon, title: "Más puntualidad", body: "Un traslado corto deja menos espacio para el tráfico y el camión que no pasó.", tone: "sol", tilt: "-rotate-[0.8deg]" },
  { icon: UserCheck01Icon, title: "Menos ausentismo", body: "Cuando llegar cuesta poco, faltar por el transporte deja de ser excusa.", tone: "cielo", tilt: "rotate-[0.7deg]" },
  { icon: Building06Icon, title: "Más permanencia", body: "La gente cambia menos de trabajo cuando el suyo le queda cerca de casa.", tone: "limon", tilt: "-rotate-[0.5deg]" },
];

function EmpresasVentajas() {
  return (
    <Canvas size={FEED} tone="tinta">
      <Scatter count={4} seed={5} palette={["var(--block-sol)", "var(--limon)", "var(--block-cielo)"]} size="size-[48px]" className="-inset-x-[34px] inset-y-0 -z-10 opacity-70" />
      <div className="px-[64px] pt-[64px]">
        <Eyebrow className="text-limon">Para negocios y plantas</Eyebrow>
        <h1 className={h("text-[104px]", "mt-[20px]")}>
          Un traslado corto se nota en tu <span className="text-limon">operación.</span>
        </h1>
      </div>
      <ul className="mt-[48px] grid gap-[26px] px-[64px]">
        {BENEFITS.map((b) => (
          <li key={b.title} className={cn("flex items-center gap-[28px] rounded-[36px] border-[4px] border-white/85 p-[32px]", BLOCK_CLASS[b.tone], b.tilt)}>
            <span className="grid size-[104px] shrink-0 place-items-center rounded-[26px] bg-ink text-white">
              <HugeiconsIcon icon={b.icon} className="size-[56px]" strokeWidth={2} />
            </span>
            <span>
              <span className="block font-display text-[48px] leading-none font-extrabold tracking-[-0.03em]">{b.title}</span>
              <span className="mt-[10px] block text-[31px] leading-[1.25] font-medium text-ink/75">{b.body}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-[40px] px-[64px] text-[38px] leading-[1.3] font-medium text-white/85">
        Publica tu vacante gratis y ve quién vive cerca de tu negocio.
      </p>
      <Footer cta="Publica gratis" />
    </Canvas>
  );
}

function Instalar() {
  return (
    <Canvas size={FEED} tone="lila">
      <Scatter count={4} seed={3} palette={["var(--block-uva)", "var(--block-mandarina)"]} size="size-[52px]" className="-inset-x-[34px] inset-y-0 -z-10" />
      <div className="px-[64px] pt-[68px]">
        <Eyebrow>Instala la app</Eyebrow>
        <h1 className={h("text-[138px]", "mt-[22px]")}>
          Llévala en tu <Under color="var(--block-mandarina)">celular.</Under>
        </h1>
        <ul className="mt-[50px] grid gap-[22px] text-[40px] leading-tight font-semibold">
          <Check>Gratis</Check>
          <Check>Sin tienda de apps</Check>
          <Check>Casi no ocupa espacio</Check>
        </ul>
      </div>
      <div className="mt-auto flex items-end justify-between px-[64px] pb-[40px]">
        <div>
          <p className="font-display text-[26px] font-extrabold tracking-[0.14em] text-ink/70 uppercase">Entra desde tu celular a</p>
          <span className={cn("mt-[14px] inline-flex h-[92px] items-center rounded-full bg-white px-[34px] font-display text-[36px] font-extrabold tracking-[-0.02em]", HARD)}>
            {SITE}/instalar
          </span>
        </div>
        <div className="relative flex items-end">
          <Mascot mood="feliz" prop="telefono" size={270} animated={false} className="relative z-10 -mb-[26px]" />
          <ChambarrioAppIcon className="mb-[170px] -ml-[36px] size-[190px] rotate-[8deg] drop-shadow-[8px_8px_0_var(--ink)]" />
        </div>
      </div>
      <Footer className="mt-0" />
    </Canvas>
  );
}

/* ------------------------------------------------------------------ stories (1080 x 1920) */
/* Keep the top ~250 px and the bottom ~330 px free of text: Instagram covers them with its own UI. */

function HistoriaBusco() {
  return (
    <Canvas size={STORY} tone="mandarina">
      <Scatter count={6} seed={2} palette={["var(--block-sol)", "var(--limon)"]} size="size-[60px]" className="-inset-x-[34px] inset-y-0 -z-10" />
      <div className="relative px-[72px] pt-[270px]">
        <BigTape className="-rotate-2">Saltillo · Ramos Arizpe</BigTape>
        <h1 className={h("text-[164px]", "mt-[44px]")}>
          El trabajo
          <br />
          que buscas,
          <br />
          <Under>cerca</Under> de ti.
        </h1>
        <p className="mt-[48px] max-w-[820px] text-[48px] leading-[1.28] font-medium">
          Vacantes a 2, 5, 10 o 15 km de tu casa. Gratis y sin currículum.
        </p>
        <span className="mt-[52px] inline-flex h-[100px] items-center rounded-full bg-ink px-[44px] font-display text-[44px] font-extrabold text-white shadow-[7px_7px_0_0_rgb(22_15_51/0.3)]">
          {SITE}
        </span>
      </div>
      <div className="relative mt-auto">
        <Mascot mood="saluda" prop="casco" size={300} animated={false} className="absolute right-[64px] bottom-[476px] z-10" />
        <div className="border-t-[5px] border-ink bg-block-cielo">
          <Scene name="barrio" animated={false} className="w-full" />
        </div>
        <HazardStripe className="h-[130px] border-t-[4px] border-ink" size={26} />
      </div>
    </Canvas>
  );
}

function HistoriaAhorro() {
  return (
    <Canvas size={STORY} tone="sol">
      <Scatter count={6} seed={7} palette={["var(--ink)", "var(--block-mandarina)"]} size="size-[60px]" className="-inset-x-[34px] inset-y-0 -z-10" />
      <div className="px-[72px] pt-[270px]">
        <Eyebrow>Pregunta del día</Eyebrow>
        <h1 className={h("text-[148px]", "mt-[26px]")}>
          ¿Cuánto haces de tu casa a la <Under color="var(--block-mandarina)">chamba?</Under>
        </h1>
      </div>
      {/* The gap below the question is on purpose: Instagram's poll or question sticker goes there. */}
      <div className="mt-[430px] px-[72px]">
        <div className={cn("flex items-center gap-[30px] rounded-[44px] bg-white p-[36px]", HARD)}>
          <p className="shrink-0 font-display text-[124px] leading-none font-extrabold tracking-[-0.05em] whitespace-nowrap tabular-nums">{savings.hours} h</p>
          <p className="text-[36px] leading-[1.22] font-semibold">
            al mes puedes ahorrarte si trabajas a 5 km o menos de tu casa.
          </p>
        </div>
        <div className="mt-[44px] flex items-center justify-between">
          <ChambarrioLogo iconClassName="size-[76px] shrink-0" wordmarkClassName="text-[56px]" className="gap-[16px]" />
          <span className="inline-flex h-[84px] items-center rounded-full bg-ink px-[36px] font-display text-[38px] font-extrabold text-white">{SITE}</span>
        </div>
      </div>
      <HazardStripe className="mt-auto h-[130px] border-t-[4px] border-ink" colors={["var(--ink)", "var(--block-sol)"]} size={26} />
    </Canvas>
  );
}

function HistoriaEmpresas() {
  return (
    <Canvas size={STORY} tone="uva">
      <Scatter count={6} seed={15} palette={["var(--limon)", "var(--block-sol)"]} size="size-[60px]" className="-inset-x-[34px] inset-y-0 -z-10" />
      <div className="relative px-[72px] pt-[270px]">
        <BigTape className="-rotate-2">Para tu negocio</BigTape>
        <h1 className={h("text-[168px]", "mt-[44px]")}>
          ¿Buscas
          <br />
          personal que
          <br />
          viva <Under color="var(--limon)" className="text-limon">cerca?</Under>
        </h1>
        <p className="mt-[48px] max-w-[860px] text-[48px] leading-[1.28] font-medium">
          Publica tu vacante gratis y ve a cuántos kilómetros vive cada postulante.
        </p>
        <span className="mt-[52px] inline-flex h-[100px] items-center rounded-full border-[5px] border-ink bg-limon px-[44px] font-display text-[42px] font-extrabold text-ink shadow-[7px_7px_0_0_var(--ink)]">
          {SITE}/empresas
        </span>
      </div>
      <div className="relative mt-auto overflow-hidden border-t-[5px] border-ink bg-block-sol">
        <Scene name="equipo" animated={false} className="w-full" />
      </div>
      <HazardStripe className="h-[130px] border-t-[4px] border-ink" size={26} />
    </Canvas>
  );
}

/* ------------------------------------------------------------------ Facebook page cover (1640 x 924) */
/* Facebook crops the top and bottom on desktop and the sides on phones: text stays in the middle. */

function PortadaFacebook() {
  return (
    <Canvas size={COVER} tone="mandarina">
      <Scatter count={6} seed={2} palette={["var(--block-sol)", "var(--limon)"]} size="size-[56px]" className="-inset-x-[34px] inset-y-0 -z-10" />
      <div className="flex flex-col items-center px-[160px] pt-[168px] text-center [--uva-ink:var(--ink)]">
        <ChambarrioLogo variant="mono" iconClassName="size-[76px] shrink-0" wordmarkClassName="text-[58px]" className="gap-[16px]" />
        <h1 className={h("text-[104px]", "mt-[26px]")}>
          El trabajo que buscas, <Under>cerca</Under> de ti.
        </h1>
        <p className="mt-[28px] text-[35px] leading-[1.25] font-medium">Vacantes a 2, 5, 10 o 15 km de tu casa · Saltillo y Ramos Arizpe</p>
      </div>
      <div className="relative mt-auto h-[350px] overflow-hidden border-t-[5px] border-ink bg-block-cielo">
        <Scene name="barrio" animated={false} className="absolute bottom-0 left-0 w-full" />
      </div>
    </Canvas>
  );
}

/* ------------------------------------------------------------------ registry */

const POSTS: Record<string, () => React.ReactElement> = {
  "01-lanzamiento": Lanzamiento,
  "02-radio": Radio,
  "03-ahorro": Ahorro,
  "04-pasos-1": PasosPortada,
  "04-pasos-2": () => <Paso i={0} />,
  "04-pasos-3": () => <Paso i={1} />,
  "04-pasos-4": () => <Paso i={2} />,
  "04-pasos-5": PasosCierre,
  "05-chambas": Chambas,
  "06-privacidad": Privacidad,
  "07-empresas": Empresas,
  "08-empresas-ventajas": EmpresasVentajas,
  "09-instalar": Instalar,
  "historia-1-busco-chamba": HistoriaBusco,
  "historia-2-pregunta": HistoriaAhorro,
  "historia-3-empresas": HistoriaEmpresas,
  "portada-facebook": PortadaFacebook,
};

export default function SocialKitPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="flex flex-wrap items-start gap-10 bg-white p-10">
      {Object.entries(POSTS).map(([id, Post]) => (
        <section key={id} data-post={id} className="shrink-0">
          <Post />
        </section>
      ))}
    </main>
  );
}
