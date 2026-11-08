"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Clock01Icon, Money03Icon, Notification01Icon, Notification03Icon } from "@hugeicons/core-free-icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadiusBar } from "@/components/chamba/radius-bar";
import { CountUp, StepList, useConfetti } from "@/components/chamba/motion";
import { CategoryArt, CategoryIcon } from "@/components/chamba/job-icons";
import { Scene } from "@/components/chamba/art/scenes";
import { CATEGORIES } from "@/lib/data/categories";
import type { CategoryId, Experience } from "@/lib/data/types";
import { monthlySavings } from "@/lib/geo";
import { formatMXN } from "@/lib/format";
import { isLiveAvailable, useApp, useJobsByDistance } from "@/lib/store";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import {
  ArtTile,
  FlowLabel,
  FlowShell,
  HAZARD,
  PrimaryButton,
  Segmented,
  SecondaryButton,
  Slab,
  WORK_CONFETTI,
  gridTone,
  type CSSVars,
} from "./flow";
import { PhoneField, PhoneVerify } from "./phone-verify";
import { AccountStep, DemoVerifyNote, useExistingAccountExit } from "./account-step";
import { LocationPicker, type Place } from "./location-picker";

const TOTAL = 5;

const EXPERIENCE: { value: Experience; label: string }[] = [
  { value: "Sin experiencia", label: "Sin experiencia" },
  { value: "6 meses", label: "6 meses" },
  { value: "1 año", label: "1 año" },
  { value: "2 años o más", label: "2 años o más" },
];

/** Work ID badge ("gafete") that fills in live while you type your name. */
function Gafete({ name }: { name: string }) {
  const clean = name.trim();
  const initial = clean ? clean[0].toUpperCase() : "?";
  return (
    <div className="relative mx-auto mt-9 w-[min(19rem,88%)] animate-rise [--i:2]">
      {/* lanyard clip */}
      <span
        aria-hidden
        className="absolute -top-6 left-1/2 h-8 w-5 -translate-x-1/2 rounded-md border-[3px] border-ink bg-white"
      />
      <div className="relative -rotate-2 overflow-hidden rounded-[1.4rem] border-[3px] border-ink bg-white text-ink shadow-[6px_6px_0_0_var(--ink)] transition-[rotate] duration-300 hover:rotate-0 dark:shadow-[6px_6px_0_0_#000]">
        <div className={cn("h-3", HAZARD)} />
        <div className="block-uva flex items-center justify-between px-4 py-2">
          <span className="font-display text-[0.8rem] font-extrabold tracking-[0.14em] uppercase">Gafete · Chamba</span>
          <span className="font-display text-[0.8rem] font-extrabold text-limon tabular-nums">Nº 0844</span>
        </div>
        <div className="flex items-center gap-4 p-4">
          <span
            key={initial}
            className="grid size-16 shrink-0 animate-pop-in place-items-center rounded-xl border-[3px] border-ink bg-block-sol font-display text-[2rem] font-extrabold"
          >
            {initial}
          </span>
          <span className="min-w-0">
            <span className="block text-[0.72rem] font-bold tracking-[0.12em] text-ink/60 uppercase">Nombre</span>
            <span
              className={cn(
                "block truncate font-display text-[1.6rem] leading-tight font-extrabold tracking-[-0.03em]",
                !clean && "text-ink/30",
              )}
            >
              {clean || "Tu nombre"}
            </span>
            <span className="mt-1 inline-block rounded-md bg-ink px-2 py-0.5 text-[0.72rem] font-bold tracking-[0.08em] text-limon uppercase">
              Saltillo, Coah.
            </span>
          </span>
        </div>
        <div aria-hidden className="flex h-7 items-end gap-[3px] px-4 pb-2">
          {Array.from({ length: 34 }, (_, i) => (
            <span
              key={i}
              className="bg-ink"
              style={{
                width: (i * 7) % 3 === 0 ? 3 : 1.5,
                height: (i * 5) % 4 === 0 ? 18 : 14,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function CandidateFlow() {
  const router = useRouter();
  const fire = useConfetti();
  const [step, setStep] = useState(0);
  const [name, setNameLocal] = useState("");
  const [place, setPlace] = useState<Place | null>(null);
  const [interests, setInterestsLocal] = useState<CategoryId[]>([]);
  const [experience, setExperienceLocal] = useState<Experience | null>(null);
  const [notifyState, setNotifyState] = useState<"idle" | "granted" | "denied" | "unsupported">("idle");

  const radiusKm = useApp((s) => s.radiusKm);
  const setRadius = useApp((s) => s.setRadius);
  const setHome = useApp((s) => s.setHome);
  const setName = useApp((s) => s.setName);
  const setPhone = useApp((s) => s.setPhone);
  const setInterests = useApp((s) => s.setInterests);
  const setExperience = useApp((s) => s.setExperience);
  const completeOnboarding = useApp((s) => s.completeOnboarding);
  const storePhone = useApp((s) => s.phone);
  const appMode = useApp((s) => s.mode);
  const signedIn = useApp((s) => s.signedIn);
  // Real accounts whenever Supabase is configured and we're not inside the demo.
  const real = isLiveAvailable && appMode !== "demo";
  const liveIn = appMode === "live" && signedIn;
  const [contactPhone, setContactPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const jobs = useJobsByDistance();
  const inRadius = jobs.filter((j) => j.km <= radiusKm).length;
  const savings = monthlySavings(radiusKm);

  // Routes stay mounted (Activity): once finished, start fresh next time this page is shown.
  const finished = useRef(false);
  useLayoutEffect(() => {
    return () => {
      if (finished.current) {
        finished.current = false;
        setStep(0);
        setNotifyState("idle");
      }
    };
  }, []);

  // No "¿Qué buscas?" step: the landing's "Busco chamba" (or the account's own type) already said so.
  // Already signed in (came from /entrar or the email link): the account step is done.
  const first = liveIn ? 1 : 0;
  const at = Math.max(step, first);
  const next = () => setStep(at + 1);
  // Back from the first step: to the landing.
  const back = () => (at === first ? router.push("/") : setStep(at - 1));
  // Signed up with an email that already has a finished profile: off to the app.
  const armExit = useExistingAccountExit("candidato", (s) => s.onboarded);

  const phoneDigits = (contactPhone || storePhone.replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "")).slice(0, 10);
  // Live sign-ups may add a celular (optional). Empty is fine; a half-typed number is likely a typo.
  const askPhone = real;
  const phoneIncomplete = askPhone && phoneDigits.length > 0 && phoneDigits.length !== 10;

  async function askNotifications() {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotifyState("unsupported");
      toast.error("Tu navegador no permite avisos. Instala la app para recibirlos.");
      return;
    }
    const result = await Notification.requestPermission();
    setNotifyState(result === "granted" ? "granted" : "denied");
    if (result === "granted") toast.success("Listo. Te avisaremos cuando salga algo cerca.");
  }

  async function finish(e: React.MouseEvent<HTMLButtonElement>) {
    if (busy) return;
    const origin = e.currentTarget;
    if (liveIn) {
      setBusy(true);
      const r = await completeOnboarding("candidato");
      setBusy(false);
      if (r.error) return; // already toasted
    } else void completeOnboarding("candidato");
    fire({ origin, colors: WORK_CONFETTI, count: 44 });
    finished.current = true;
    router.push("/inicio");
  }

  switch (at) {
    case 0:
      if (real && !liveIn) {
        return (
          <AccountStep
            step={0}
            total={TOTAL}
            role="candidato"
            onBack={back}
            onVerified={({ channel, to }) => {
              armExit();
              if (channel === "sms") {
                setContactPhone(to);
                void setPhone(to);
              }
              setStep(1);
            }}
          />
        );
      }
      return (
        <FlowShell
          step={0}
          total={TOTAL}
          tone="mandarina"
          art={{ scene: "codigo" }}
          title="Tu celular"
          hint="Te mandamos un código por SMS para confirmar que eres tú. Las empresas te llaman o te escriben por aquí."
          aside="Sin contraseñas que recordar. Solo tu número."
          onBack={back}
        >
          {real ? null : <DemoVerifyNote />}
          <PhoneVerify
            onVerified={(phone) => {
              setPhone(phone);
              next();
            }}
          />
        </FlowShell>
      );

    case 1:
      return (
        <FlowShell
          step={1}
          total={TOTAL}
          tone="uva"
          art={{ scene: "equipo" }}
          title="¿Cómo te llamas?"
          hint="Así te verán las empresas cuando te postules."
          aside="Las empresas te contactan directo, sin intermediarios."
          onBack={back}
          footer={
            <PrimaryButton
              type="submit"
              form="name-form"
              disabled={name.trim().length < 2 || phoneIncomplete}
            >
              Continuar
            </PrimaryButton>
          }
        >
          <form
            id="name-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim().length < 2) return;
              if (askPhone) {
                if (phoneIncomplete) return;
                if (phoneDigits.length === 10 && phoneDigits !== storePhone) void setPhone(phoneDigits);
              }
              setName(name.trim());
              next();
            }}
          >
            <Slab tone="cielo" index={1} className="pt-4">
              <Label htmlFor="given-name" className="mb-3 font-display text-[1.1rem] font-extrabold tracking-[-0.01em]">
                Tu nombre
              </Label>
              <Input
                id="given-name"
                autoComplete="given-name"
                autoCapitalize="words"
                enterKeyHint="next"
                placeholder="Por ejemplo, Mariana"
                value={name}
                onChange={(e) => setNameLocal(e.target.value)}
                className="h-17 rounded-[1.1rem] border-[3px] border-ink bg-white px-5 font-display text-[1.4rem] font-bold text-ink placeholder:text-ink/35 focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-ink/25 md:text-[1.4rem] dark:bg-white"
              />
            </Slab>
            {askPhone ? (
              <Slab tone="menta" index={2} className="mt-5 pt-4">
                <PhoneField id="contact-phone" value={phoneDigits} onChange={setContactPhone} label="Tu celular (opcional)" />
                <p className="mt-3 text-[0.9rem] font-medium text-muted-foreground">
                  Solo lo ve la empresa cuando te postulas y decide contactarte, por llamada o SMS. Si no lo pones, no podrán llamarte; puedes agregarlo después en tu perfil.
                </p>
              </Slab>
            ) : null}
          </form>
          <Gafete name={name} />
        </FlowShell>
      );

    case 2:
      return (
        <FlowShell
          step={2}
          total={TOTAL}
          tone="mandarina"
          art={{ scene: "mapa" }}
          title="¿Dónde vives?"
          hint="Con esto calculamos qué tan cerca te queda cada trabajo."
          aside="Tu dirección exacta nunca se comparte."
          onBack={back}
          footer={
            <PrimaryButton disabled={!place} onClick={next}>
              Continuar
            </PrimaryButton>
          }
        >
          <LocationPicker
            value={place}
            onPick={(p) => {
              setPlace(p);
              setHome(p.location, p.colonia, p.source);
            }}
          />
        </FlowShell>
      );

    case 3:
      return (
        <FlowShell
          step={3}
          total={TOTAL}
          tone="uva"
          art={{ scene: "radar" }}
          title="¿Qué tan lejos quieres trabajar?"
          hint="Puedes cambiarlo cuando quieras."
          aside="Menos distancia. Menos gastos. Más tiempo."
          onBack={back}
          footer={<PrimaryButton onClick={next}>Continuar</PrimaryButton>}
        >
          <Slab tone="sol" index={1}>
            <p className="flex flex-wrap items-end gap-x-3">
              <CountUp
                value={inRadius}
                className="font-display text-[4.25rem] leading-[0.85] font-extrabold tracking-[-0.05em] tabular-nums"
              />
              <span className="pb-1 text-[1.1rem] leading-tight font-semibold">
                {inRadius === 1 ? "vacante" : "vacantes"} a menos de{" "}
                <span className="rounded-md bg-ink px-1.5 font-display font-extrabold text-limon tabular-nums">
                  {radiusKm} km
                </span>
              </span>
            </p>
            {inRadius === 0 ? (
              <p className="mt-3 text-[0.98rem] font-medium">
                Todavía no hay vacantes tan cerca. Te avisamos en cuanto una empresa publique en tu zona.
              </p>
            ) : null}
            <RadiusBar value={radiusKm} onChange={setRadius} label="Distancia máxima al trabajo" className="mt-6" />
          </Slab>
          <Slab tone="menta" index={2} className="mt-5 pr-32">
            <p className="font-display text-[1.15rem] leading-tight font-extrabold tracking-[-0.015em]">
              Trabajar a {radiusKm} km o menos te ahorra al mes:
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-ink bg-white px-2.5 py-1 font-display font-extrabold tabular-nums">
                <HugeiconsIcon icon={Clock01Icon} className="size-4.5" strokeWidth={2.4} />
                {savings.hours} horas
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-ink bg-white px-2.5 py-1 font-display font-extrabold tabular-nums">
                <HugeiconsIcon icon={Money03Icon} className="size-4.5" strokeWidth={2.4} />
                {formatMXN(savings.pesos)}
              </span>
            </div>
            <p className="mt-2 text-[0.88rem] font-medium text-muted-foreground">en traslados</p>
            <Scene name="ahorro" className="pointer-events-none absolute -right-6 -bottom-3 w-40 -rotate-6" />
          </Slab>
        </FlowShell>
      );

    case 4:
      return (
        <FlowShell
          step={4}
          total={TOTAL}
          tone="mandarina"
          art={{ scene: "busqueda" }}
          title="¿En qué te gustaría trabajar?"
          hint="Elige todas las que quieras."
          aside="Te avisamos cuando aparezca algo así cerca de ti."
          onBack={back}
          footer={
            <PrimaryButton
              disabled={interests.length === 0 || !experience}
              onClick={(e) => {
                setInterests(interests);
                if (experience) setExperience(experience);
                fire({ origin: e.currentTarget, colors: WORK_CONFETTI });
                next();
              }}
            >
              Continuar
            </PrimaryButton>
          }
        >
          <FlowLabel>
            Tipos de trabajo
            {interests.length ? (
              <span
                key={interests.length}
                className="ml-auto animate-pop-in rounded-md bg-ink px-2 py-0.5 text-[0.85rem] text-limon tabular-nums"
              >
                {interests.length} {interests.length === 1 ? "elegido" : "elegidos"}
              </span>
            ) : null}
          </FlowLabel>
          <div
            role="group"
            aria-label="Tipos de trabajo"
            className="grid grid-cols-3 gap-x-3 gap-y-4 sm:grid-cols-4 lg:grid-cols-3"
          >
            {CATEGORIES.map((c, i) => {
              const on = interests.includes(c.id);
              return (
                <ArtTile
                  key={c.id}
                  index={i}
                  tone={gridTone(i)}
                  pressed={on}
                  art={<CategoryArt category={c.id} className="size-16" animated={on} />}
                  onClick={() => setInterestsLocal((xs) => (on ? xs.filter((x) => x !== c.id) : [...xs, c.id]))}
                >
                  {c.label}
                </ArtTile>
              );
            })}
          </div>
          <FlowLabel className="mt-9">¿Cuánta experiencia tienes?</FlowLabel>
          <Segmented options={EXPERIENCE} value={experience} onChange={setExperienceLocal} label="Tu experiencia" />
        </FlowShell>
      );

    default:
      return (
        <FlowShell
          tone="mandarina"
          art={{ mascot: { mood: "festeja", prop: "trofeo" } }}
          band
          title={name.trim() ? `¡Ya quedó, ${name.trim()}!` : "¡Ya quedó!"}
          hint={
            inRadius === 0 ? (
              <>
                Llegaste antes que las vacantes: todavía no hay ninguna a menos de {radiusKm} km de{" "}
                {place?.source === "gps" ? "donde estás" : (place?.colonia ?? "tu casa")}. Te avisamos en cuanto publiquen una.
              </>
            ) : (
              <>
                Hay <span className="font-bold text-foreground tabular-nums">{inRadius}</span>{" "}
                {inRadius === 1 ? "vacante" : "vacantes"} a menos de {radiusKm} km de{" "}
                {place?.source === "gps" ? "donde estás" : (place?.colonia ?? "tu casa")}.
              </>
            )
          }
          aside="Mejor calidad de vida empieza más cerca de casa."
          onBack={back}
          footer={
            <>
              <PrimaryButton onClick={finish} disabled={busy} aria-busy={busy}>
                {busy ? <Spinner className="size-5" /> : null}
                {busy ? "Guardando…" : "Ver vacantes cerca"}
              </PrimaryButton>
              {notifyState === "idle" ? (
                <SecondaryButton onClick={askNotifications}>
                  <HugeiconsIcon icon={Notification01Icon} className="size-5" strokeWidth={2.2} />
                  Avísame de vacantes nuevas cerca
                </SecondaryButton>
              ) : null}
            </>
          }
        >
          <Slab tone="limon" index={1} className="pt-4">
            <p className="text-[0.78rem] font-bold tracking-[0.14em] uppercase">{inRadius === 0 ? "¡Llegaste primero!" : "¡Chamba a la vista!"}</p>
            <p className="mt-1 flex flex-wrap items-end gap-x-3">
              <CountUp
                value={inRadius}
                from={0}
                duration={1.2}
                className="font-display text-[4.5rem] leading-[0.85] font-extrabold tracking-[-0.05em] tabular-nums"
              />
              <span className="pb-1.5 text-[1.05rem] leading-tight font-semibold">
                {inRadius === 1 ? "vacante" : "vacantes"}
                <br />a {radiusKm} km o menos
              </span>
            </p>
            {interests.length ? (
              <ul aria-label="Lo que te interesa" className="mt-4 flex flex-wrap gap-2">
                {interests.map((id, i) => (
                  <li key={id} className="animate-pop-in" style={{ "--i": Math.min(i + 2, 10) } as CSSVars}>
                    <CategoryIcon category={id} size="sm" title={CATEGORIES.find((c) => c.id === id)?.label} />
                  </li>
                ))}
              </ul>
            ) : null}
          </Slab>
          <Slab tone="cielo" index={2} className="mt-5 flex items-start gap-3.5 p-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl border-[2.5px] border-ink bg-white text-ink">
              <HugeiconsIcon icon={Notification03Icon} className="size-6 origin-top animate-ring" strokeWidth={2.2} />
            </span>
            <p className="pt-0.5 text-[1rem] leading-snug font-medium">
              {notifyState === "granted"
                ? "Te avisaremos en cuanto se publique una vacante dentro de tu radio."
                : notifyState === "denied"
                  ? "No activaste los avisos. Puedes hacerlo después desde tu perfil."
                  : "Tu perfil está listo. Las empresas cercanas ya pueden encontrarte."}
            </p>
          </Slab>
          <Slab tone="sol" index={3} className="mt-5">
            <p className="mb-3 font-display text-[1.15rem] font-extrabold tracking-[-0.015em]">¿Qué sigue?</p>
            <StepList
              current={1}
              steps={[
                { title: "Crea tu cuenta", meta: "¡Hecho!" },
                { title: "Elige una vacante cerca", body: "Ordenadas por distancia a tu casa." },
                { title: "Postúlate en un toque", body: "Sin currículum. Te contactan por llamada o SMS." },
              ]}
            />
          </Slab>
        </FlowShell>
      );
  }
}
