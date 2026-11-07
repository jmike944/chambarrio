"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompanySize } from "@/lib/data/types";
import type { CategoryId } from "@/lib/data/types";
import { useApp, type PlanId } from "@/lib/store";
import { CategoryArt } from "@/components/chamba/job-icons";
import { useConfetti } from "@/components/chamba/motion";
import { Scene } from "@/components/chamba/art/scenes";
import { cn } from "@/lib/utils";
import { ArtTile, ChoiceCard, FlowLabel, FlowShell, HAZARD, PrimaryButton, Slab, WORK_CONFETTI, gridTone, pastel } from "./flow";
import { PhoneVerify } from "./phone-verify";
import { LocationPicker, type Place } from "./location-picker";

const TOTAL = 6;

const KINDS = [
  "Cafetería",
  "Restaurante",
  "Tienda",
  "Supermercado",
  "Farmacia",
  "Hotel",
  "Taller",
  "Planta industrial",
  "Logística",
  "Construcción",
  "Otro",
] as const;

/** Cartoon for each business type (closest job category). */
const KIND_ART: Record<(typeof KINDS)[number], CategoryId> = {
  Cafetería: "caja",
  Restaurante: "restaurante",
  Tienda: "ventas",
  Supermercado: "almacen",
  Farmacia: "chofer",
  Hotel: "limpieza",
  Taller: "mantenimiento",
  "Planta industrial": "produccion",
  Logística: "montacargas",
  Construcción: "construccion",
  Otro: "oficina",
};

const SIZES: {
  value: CompanySize;
  label: string;
  hint: string;
  range: string;
}[] = [
  { value: "Micro", label: "Micro", hint: "1 a 10 personas", range: "1–10" },
  {
    value: "Pequeña",
    label: "Pequeña",
    hint: "11 a 50 personas",
    range: "11+",
  },
  {
    value: "Mediana",
    label: "Mediana",
    hint: "51 a 250 personas",
    range: "51+",
  },
  {
    value: "Grande",
    label: "Grande",
    hint: "Más de 250 personas",
    range: "250+",
  },
];

const PLANS: {
  id: PlanId;
  title: string;
  price: string;
  description: string;
  badge?: string;
}[] = [
  {
    id: "por-vacante",
    title: "Por vacante",
    price: "Publicar es gratis",
    description: "Pagas $500 MXN al mes solo por las vacantes cuyas postulaciones quieras ver y contactar.",
  },
  {
    id: "pyme",
    title: "Pyme",
    price: "$1,500 MXN al mes",
    description: "Hasta 5 vacantes con postulaciones desbloqueadas. Para quien contrata seguido.",
    badge: "Recomendado",
  },
  {
    id: "industrial",
    title: "Industrial",
    price: "Desde $6,500 MXN al mes",
    description: "Vacantes sin límite, varias plantas o sucursales y reportes de contratación.",
  },
];

export function BusinessFlow() {
  const router = useRouter();
  const fire = useConfetti();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<string | null>(null);
  const [size, setSize] = useState<CompanySize | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [phone, setPhoneLocal] = useState("");
  const [plan, setPlan] = useState<PlanId | null>(null);
  const [accepted, setAccepted] = useState(false);

  const setBusiness = useApp((s) => s.setBusiness);
  const setPhone = useApp((s) => s.setPhone);
  const completeOnboarding = useApp((s) => s.completeOnboarding);

  const finished = useRef(false);
  useLayoutEffect(() => {
    return () => {
      if (finished.current) {
        finished.current = false;
        setStep(0);
        setAccepted(false);
      }
    };
  }, []);

  const next = () => setStep((s) => s + 1);
  const back = () => (step === 0 ? router.push("/bienvenida") : setStep((s) => s - 1));

  function finish(e: React.MouseEvent<HTMLButtonElement>) {
    if (!kind || !size || !place || !plan || !accepted) return;
    fire({ origin: e.currentTarget, colors: WORK_CONFETTI, count: 44 });
    finished.current = true;
    setBusiness({
      name: name.trim(),
      kind,
      size,
      colonia: place.colonia,
      location: place.location,
      phone,
      plan,
    });
    setPhone(phone);
    completeOnboarding("empresa");
    toast.success(`${name.trim()} ya puede publicar vacantes.`);
    router.push("/empresa");
  }

  switch (step) {
    case 0:
      return (
        <FlowShell
          step={0}
          total={TOTAL}
          tone="uva"
          art={{ scene: "negocio" }}
          title="Cuéntanos de tu negocio"
          hint="Desde una cafetería hasta una planta industrial."
          aside="Encuentra personal que vive cerca de tu negocio."
          onBack={back}
          footer={
            <PrimaryButton type="submit" form="business-form" disabled={name.trim().length < 2 || !kind}>
              Continuar
            </PrimaryButton>
          }
        >
          <form
            id="business-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim().length >= 2 && kind) next();
            }}
          >
            <Slab tone="sol" index={1} className="pt-4">
              <Label
                htmlFor="business-name"
                className="mb-3 font-display text-[1.1rem] font-extrabold tracking-[-0.01em]"
              >
                Nombre del negocio
              </Label>
              <Input
                id="business-name"
                autoComplete="organization"
                placeholder="Por ejemplo, Café La Alameda"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-17 rounded-[1.1rem] border-[3px] border-ink bg-white px-5 font-display text-[1.3rem] font-bold text-ink placeholder:text-ink/35 focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-ink/25 md:text-[1.3rem] dark:bg-white"
              />
            </Slab>
          </form>
          <FlowLabel className="mt-8">¿Qué tipo de negocio es?</FlowLabel>
          <div
            role="group"
            aria-label="Tipo de negocio"
            className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-3"
          >
            {KINDS.map((k, i) => (
              <ArtTile
                key={k}
                index={i + 2}
                tone={gridTone(i + 1)}
                pressed={kind === k}
                onClick={() => setKind(k)}
                art={<CategoryArt category={KIND_ART[k]} className="size-15" animated={kind === k} />}
              >
                {k}
              </ArtTile>
            ))}
          </div>
        </FlowShell>
      );

    case 1:
      return (
        <FlowShell
          step={1}
          total={TOTAL}
          tone="mandarina"
          art={{ scene: "equipo" }}
          title="¿Cuántas personas trabajan ahí?"
          hint="Nos ayuda a sugerirte el plan correcto."
          aside="Negocios de todos los tamaños contratan cerca."
          onBack={back}
          footer={
            <PrimaryButton disabled={!size} onClick={next}>
              Continuar
            </PrimaryButton>
          }
        >
          <div className="space-y-4">
            {SIZES.map((s, i) => (
              <ChoiceCard
                key={s.value}
                index={i}
                tone={pastel(i)}
                leading={
                  <span className="font-display text-[1.15rem] leading-none font-extrabold tracking-[-0.04em] tabular-nums">
                    {s.range}
                  </span>
                }
                title={s.label}
                description={s.hint}
                selected={size === s.value}
                onClick={() => {
                  setSize(s.value);
                  if (!plan)
                    setPlan(s.value === "Grande" ? "industrial" : s.value === "Micro" ? "por-vacante" : "pyme");
                }}
              />
            ))}
          </div>
        </FlowShell>
      );

    case 2:
      return (
        <FlowShell
          step={2}
          total={TOTAL}
          tone="uva"
          art={{ scene: "mapa" }}
          title="¿Dónde está tu negocio?"
          hint="Así te mostramos candidatos que viven cerca."
          aside="Personal que vive cerca llega a tiempo y se queda más."
          onBack={back}
          footer={
            <PrimaryButton disabled={!place} onClick={next}>
              Continuar
            </PrimaryButton>
          }
        >
          <LocationPicker
            value={place}
            onPick={setPlace}
            privacyNote="Los candidatos ven tu colonia y la distancia. Tú decides cuándo compartir la dirección exacta."
          />
        </FlowShell>
      );

    case 3:
      return (
        <FlowShell
          step={3}
          total={TOTAL}
          tone="mandarina"
          art={{ scene: "whatsapp" }}
          title="WhatsApp de contacto"
          hint="Aquí te llegan los avisos cuando alguien cerca se postule."
          aside="Sin contraseñas que recordar. Solo tu número."
          onBack={back}
        >
          <PhoneVerify
            inputId="business-whatsapp"
            initialPhone={phone}
            onVerified={(p) => {
              setPhoneLocal(p);
              next();
            }}
          />
        </FlowShell>
      );

    case 4:
      return (
        <FlowShell
          step={4}
          total={TOTAL}
          tone="uva"
          art={{ scene: "ahorro" }}
          title="Elige cómo pagar"
          hint="Puedes cambiar de plan cuando quieras. Los candidatos nunca pagan."
          aside="Pagas por contratar, no por publicar."
          onBack={back}
          footer={
            <PrimaryButton disabled={!plan} onClick={next}>
              Continuar
            </PrimaryButton>
          }
        >
          <div className="space-y-4">
            {PLANS.map((p, i) => (
              <ChoiceCard
                key={p.id}
                index={i}
                tone={(["cielo", "sol", "menta"] as const)[i % 3]}
                title={p.title}
                badge={p.badge}
                selected={plan === p.id}
                onClick={() => setPlan(p.id)}
                description={
                  <>
                    <span className="block font-display text-[1.15rem] font-extrabold text-foreground tabular-nums">
                      {p.price}
                    </span>
                    <span className="mt-1 block">{p.description}</span>
                  </>
                }
              />
            ))}
          </div>
        </FlowShell>
      );

    default:
      return (
        <FlowShell
          step={5}
          total={TOTAL}
          tone="mandarina"
          art={{ scene: "contratado" }}
          title="Un último detalle"
          hint="Chambarrio no es agencia de reclutamiento: conectamos a tu negocio con personas que viven cerca."
          aside="Menos distancia. Menos ausentismo. Más permanencia."
          onBack={back}
          footer={
            <PrimaryButton disabled={!accepted} onClick={finish}>
              Crear cuenta de empresa
            </PrimaryButton>
          }
        >
          {/* "Orden de trabajo": the summary as a stamped work order */}
          <div className="relative animate-rise [--i:1]">
            <div className="relative overflow-hidden rounded-[1.4rem] border-[3px] border-ink bg-white text-ink shadow-[6px_6px_0_0_var(--ink)] dark:shadow-[6px_6px_0_0_#000]">
              <div className={cn("h-3", HAZARD)} />
              <div className="flex items-center justify-between gap-3 border-b-[3px] border-dashed border-ink/25 px-5 py-3">
                <span className="font-display text-[0.85rem] font-extrabold tracking-[0.14em] uppercase">
                  Orden de alta
                </span>
                <span className="rounded-md bg-ink px-2 py-0.5 font-display text-[0.8rem] font-extrabold text-limon tabular-nums">
                  Nº 0001
                </span>
              </div>
              <dl className="space-y-3 px-5 py-4 text-[1rem]">
                {[
                  ["Negocio", `${name.trim()} · ${kind ?? ""}`],
                  ["Tamaño", SIZES.find((s) => s.value === size)?.hint ?? ""],
                  ["Ubicación", place?.source === "gps" ? "Ubicación detectada" : (place?.colonia ?? "")],
                  ["Plan", PLANS.find((p) => p.id === plan)?.title ?? ""],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4">
                    <dt className="shrink-0 text-[0.8rem] font-bold tracking-[0.1em] text-ink/60 uppercase">{k}</dt>
                    <span aria-hidden className="mb-1 flex-1 border-b-2 border-dotted border-ink/20" />
                    <dd className="text-right font-display font-extrabold">{v}</dd>
                  </div>
                ))}
              </dl>
              {kind ? (
                <CategoryArt
                  category={KIND_ART[kind as (typeof KINDS)[number]] ?? "oficina"}
                  className="pointer-events-none absolute -right-3 -bottom-4 size-20 rotate-12 opacity-15"
                />
              ) : null}
            </div>
            {accepted ? (
              <span
                aria-hidden
                className="absolute -top-3 right-4 animate-pop-in rounded-lg border-[3px] border-nopal bg-white/90 px-2.5 py-0.5 font-display text-[1rem] font-extrabold tracking-[0.12em] text-nopal uppercase -rotate-12"
              >
                Aprobado
              </span>
            ) : null}
          </div>
          <Slab tone="cielo" index={2} className="mt-6 p-0">
            <label
              htmlFor="responsibility"
              className="flex cursor-pointer items-start gap-4 p-4 text-[1rem] leading-relaxed font-medium"
            >
              <Checkbox
                id="responsibility"
                checked={accepted}
                onCheckedChange={(v) => setAccepted(v === true)}
                className="mt-1 size-7 rounded-md border-[2.5px] border-ink bg-white data-[state=checked]:border-ink data-[state=checked]:bg-ink data-[state=checked]:text-limon"
              />
              <span>
                Entiendo que Chambarrio solo conecta candidatos y empresas. Mi empresa entrevista, contrata y cumple
                sus obligaciones laborales.{" "}
                <Link
                  href="/terminos"
                  className="rounded font-bold text-foreground underline decoration-2 underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  Leer términos
                </Link>
              </span>
            </label>
          </Slab>
          <Slab tone="limon" index={3} className="mt-5 flex items-center gap-4 p-4 pr-28">
            <p className="font-display text-[1.05rem] leading-tight font-extrabold">
              Los candidatos nunca pagan. Cambia de plan cuando quieras.
            </p>
            <Scene name="equipo" className="pointer-events-none absolute -right-4 -bottom-2 w-32" />
          </Slab>
        </FlowShell>
      );
  }
}
