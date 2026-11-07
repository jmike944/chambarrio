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
import { isLiveAvailable, useApp, usePaymentsEnabled, type PlanId } from "@/lib/store";
import { Spinner } from "@/components/ui/spinner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { CategoryArt } from "@/components/chamba/job-icons";
import { useConfetti } from "@/components/chamba/motion";
import { Scene } from "@/components/chamba/art/scenes";
import { cn } from "@/lib/utils";
import { ArtTile, ChoiceCard, FlowLabel, FlowShell, HAZARD, PrimaryButton, Slab, WORK_CONFETTI, focusRing, gridTone, pastel } from "./flow";
import { PhoneField, PhoneVerify } from "./phone-verify";
import { AccountStep, DemoVerifyNote, useExistingAccountExit } from "./account-step";
import { LocationPicker, type Place } from "./location-picker";

const TOTAL = 6;

/** A location being set up during onboarding. The first one is the main site ("Principal"). */
type DraftBranch = { key: string; name: string; place: Place | null };

const firstBranch = (): DraftBranch => ({ key: "principal", name: "Principal", place: null });

/** Name to save: what they typed, or "Sucursal 2" etc. */
function branchName(b: DraftBranch, i: number) {
  return b.name.trim() || (i === 0 ? "Principal" : `Sucursal ${i + 1}`);
}

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
  const [branches, setBranches] = useState<DraftBranch[]>(() => [firstBranch()]);
  const [active, setActive] = useState(0);
  const [phone, setPhoneLocal] = useState("");
  const [plan, setPlan] = useState<PlanId | null>(null);
  const [accepted, setAccepted] = useState(false);

  const setBusiness = useApp((s) => s.setBusiness);
  const setPhone = useApp((s) => s.setPhone);
  const completeOnboarding = useApp((s) => s.completeOnboarding);
  const storePhone = useApp((s) => s.phone);
  const appMode = useApp((s) => s.mode);
  const signedIn = useApp((s) => s.signedIn);
  const paymentsOn = usePaymentsEnabled();
  // Real accounts whenever Supabase is configured and we're not inside the demo.
  const real = isLiveAvailable && appMode !== "demo";
  // Paid plans only exist in the demo for now (live: "Próximamente", the server keeps por-vacante).
  const payments = paymentsOn && !real;
  const chosenPlan: PlanId | null = payments ? plan : "por-vacante";
  const liveIn = appMode === "live" && signedIn;
  const [busy, setBusy] = useState(false);
  // Signed up with an address whose account already has a business: off to the panel.
  const armExit = useExistingAccountExit("empresa", (s) => !!s.business?.id);

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

  const place = branches[0]?.place ?? null;
  const current = branches[active] ?? branches[0];
  const unplaced = branches.findIndex((b) => !b.place);

  function patchBranch(i: number, patch: Partial<DraftBranch>) {
    setBranches((bs) => bs.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  }

  function addBranch() {
    const n = branches.length;
    // After removing one, "Sucursal N" may already be taken: use the next free number.
    let k = n + 1;
    while (branches.some((b, i) => branchName(b, i) === `Sucursal ${k}`)) k++;
    setBranches((bs) => [...bs, { key: `b${Date.now().toString(36)}`, name: `Sucursal ${k}`, place: null }]);
    setActive(n);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  }

  function removeBranch(i: number) {
    if (i === 0) return;
    setBranches((bs) => bs.filter((_, j) => j !== i));
    setActive((a) => (a === i ? i - 1 : a > i ? a - 1 : a));
    // The focused "Quitar" button is gone: land on the previous chip (or the name field if the chips hide).
    requestAnimationFrame(() => {
      const chip = document.querySelectorAll<HTMLElement>("[data-branch-chip]")[i - 1];
      (chip ?? document.getElementById("branch-name"))?.focus();
    });
  }

  function continueFromPlaces() {
    if (unplaced !== -1) {
      setActive(unplaced);
      toast(`Falta elegir dónde está ${branchName(branches[unplaced], unplaced)}.`);
      return;
    }
    next();
  }

  const next = () => setStep((s) => s + 1);
  const back = () => (step === 0 ? router.push("/bienvenida") : setStep((s) => s - 1));

  async function finish(e: React.MouseEvent<HTMLButtonElement>) {
    if (!kind || !size || !place || !chosenPlan || !accepted || busy) return;
    const origin = e.currentTarget;
    const business = {
      name: name.trim(),
      kind,
      size,
      locations: branches.flatMap((b, i) =>
        b.place
          ? [{ id: i === 0 ? "suc-principal" : `suc-${i + 1}`, name: branchName(b, i), colonia: b.place.colonia, location: b.place.location }]
          : [],
      ),
      phone,
      // Live: the server keeps "por-vacante" until payments exist.
      plan: chosenPlan,
    };
    if (liveIn) {
      // Real account: create the company + every branch, then mark the profile onboarded.
      // Errors are already toasted by the store; the draft stays so "Crear" can be tapped again.
      setBusy(true);
      if (phone !== storePhone) void setPhone(phone);
      const r = await setBusiness(business);
      const c = r.error ? r : await completeOnboarding("empresa");
      setBusy(false);
      if (c.error) return;
    } else {
      void setBusiness(business);
      void setPhone(phone);
      void completeOnboarding("empresa");
    }
    fire({ origin, colors: WORK_CONFETTI, count: 44 });
    finished.current = true;
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
                    setPlan(
                      !payments || s.value === "Micro" ? "por-vacante" : s.value === "Grande" ? "industrial" : "pyme",
                    );
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
          title={branches.length > 1 ? "¿Dónde están tus sucursales?" : "¿Dónde está tu negocio?"}
          hint="Así te mostramos candidatos que viven cerca."
          aside="Personal que vive cerca llega a tiempo y se queda más."
          onBack={back}
          footer={
            <PrimaryButton disabled={!current?.place} onClick={continueFromPlaces}>
              Continuar
            </PrimaryButton>
          }
        >
          {branches.length > 1 ? (
            <div role="group" aria-label="Tus sucursales" className="mb-6 flex flex-wrap gap-2.5">
              {branches.map((b, i) => {
                const on = i === active;
                return (
                  <span key={b.key} className="relative inline-flex">
                    <button
                      type="button"
                      data-branch-chip
                      aria-pressed={on}
                      onClick={() => setActive(i)}
                      className={cn(
                        "press inline-flex min-h-12 items-center gap-2 rounded-full border-[2.5px] border-ink py-1.5 pl-1.5 text-left font-bold transition-[scale,background-color,color]",
                        i === 0 ? "pr-4" : "pr-11",
                        on ? "bg-primary text-primary-foreground" : "bg-white text-ink hover:bg-block-sol",
                        focusRing,
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-8 shrink-0 place-items-center rounded-full font-display text-[0.95rem] font-extrabold tabular-nums",
                          on ? "bg-limon text-ink" : "bg-ink text-white",
                        )}
                      >
                        {i + 1}
                      </span>
                      <span className="leading-tight">
                        <span className="block max-w-[11rem] truncate text-[0.98rem]">{branchName(b, i)}</span>
                        <span className={cn("block text-[0.78rem] font-semibold", on ? "text-primary-foreground/80" : "text-ink/60")}>
                          {b.place ? (b.place.source === "gps" ? "Ubicación detectada" : b.place.colonia) : "Falta ubicación"}
                        </span>
                      </span>
                    </button>
                    {i > 0 ? (
                      <button
                        type="button"
                        aria-label={`Quitar ${branchName(b, i)}`}
                        onClick={() => removeBranch(i)}
                        className={cn(
                          "absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-full",
                          on ? "text-primary-foreground hover:bg-white/15" : "text-ink hover:bg-ink/10",
                          focusRing,
                        )}
                      >
                        <HugeiconsIcon icon={Cancel01Icon} className="size-4.5" strokeWidth={2.6} />
                      </button>
                    ) : null}
                  </span>
                );
              })}
            </div>
          ) : null}

          <Slab tone="limon" index={0} className="mb-8 pt-4">
            <Label
              htmlFor="branch-name"
              className="mb-3 font-display text-[1.1rem] font-extrabold tracking-[-0.01em]"
            >
              {active === 0 ? "Nombre de tu sucursal principal" : "Nombre de esta sucursal"}
            </Label>
            <Input
              id="branch-name"
              autoComplete="off"
              maxLength={40}
              placeholder={active === 0 ? "Principal" : `Sucursal ${active + 1}`}
              value={current?.name ?? ""}
              onChange={(e) => patchBranch(active, { name: e.target.value })}
              className="h-14 rounded-[1.1rem] border-[3px] border-ink bg-white px-5 font-display text-[1.15rem] font-bold text-ink placeholder:text-ink/35 focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-ink/25 md:text-[1.15rem] dark:bg-white"
            />
            <p className="mt-2 text-[0.9rem] font-medium text-muted-foreground">Por ejemplo: Matriz, Planta Derramadero, Bodega Centro.</p>
          </Slab>

          <LocationPicker
            key={current?.key}
            value={current?.place ?? null}
            onPick={(p) => patchBranch(active, { place: p })}
            privacyNote="Los candidatos ven la colonia de cada sucursal y la distancia. Tú decides cuándo compartir la dirección exacta."
          />

          <button
            type="button"
            onClick={addBranch}
            disabled={!current?.place}
            className={cn(
              "press group mt-6 flex min-h-18 w-full items-center gap-4 rounded-[1.6rem] border-[3px] border-dashed border-ink bg-white/60 px-4 py-3 text-left text-ink transition-[scale,background-color,opacity] hover:bg-white disabled:opacity-50 dark:border-white/50 dark:bg-white/10 dark:text-foreground",
              focusRing,
            )}
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full border-[2.5px] border-ink bg-limon text-ink transition-[rotate] duration-300 group-hover:rotate-90">
              <HugeiconsIcon icon={PlusSignIcon} className="size-5.5" strokeWidth={2.6} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[1.15rem] leading-tight font-extrabold">Agregar otra sucursal</span>
              <span className="block text-[0.9rem] font-medium opacity-75">
                Opcional. También puedes hacerlo después en Sucursales.
              </span>
            </span>
          </button>
        </FlowShell>
      );

    case 3:
      if (real && !liveIn) {
        return (
          <AccountStep
            step={3}
            total={TOTAL}
            role="empresa"
            onBack={back}
            onVerified={({ channel, to }) => {
              armExit();
              if (channel === "sms" && !phone) setPhoneLocal(to);
            }}
          />
        );
      }
      if (real) {
        // Signed in: just the contact number (no code needed).
        const contact = (phone || storePhone.replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "")).slice(0, 10);
        return (
          <FlowShell
            step={3}
            total={TOTAL}
            tone="mandarina"
            art={{ scene: "codigo" }}
            title="Teléfono de contacto"
            hint="Aquí te avisamos por SMS cuando alguien cerca se postule."
            aside="Tu cuenta ya está lista. Solo falta cómo contactarte."
            onBack={back}
            footer={
              <PrimaryButton type="submit" form="contact-form" disabled={contact.length !== 10}>
                Continuar
              </PrimaryButton>
            }
          >
            <form
              id="contact-form"
              onSubmit={(e) => {
                e.preventDefault();
                if (contact.length !== 10) return;
                setPhoneLocal(contact);
                next();
              }}
            >
              <Slab tone="cielo" index={1} className="pt-4">
                <PhoneField
                  id="business-phone"
                  value={contact}
                  onChange={setPhoneLocal}
                  label="Celular o teléfono (10 dígitos)"
                />
              </Slab>
            </form>
          </FlowShell>
        );
      }
      return (
        <FlowShell
          step={3}
          total={TOTAL}
          tone="mandarina"
          art={{ scene: "codigo" }}
          title="Teléfono de contacto"
          hint="Aquí te avisamos por SMS cuando alguien cerca se postule."
          aside="Sin contraseñas que recordar. Solo tu número."
          onBack={back}
        >
          <DemoVerifyNote />
          <PhoneVerify
            inputId="business-phone"
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
          hint={
            payments
              ? "Puedes cambiar de plan cuando quieras. Los candidatos nunca pagan."
              : "Por ahora empiezas con Por vacante: publicar es gratis. Los planes de pago llegan pronto."
          }
          aside="Pagas por contratar, no por publicar."
          onBack={back}
          footer={
            <PrimaryButton disabled={!chosenPlan} onClick={next}>
              Continuar
            </PrimaryButton>
          }
        >
          <div className="space-y-4">
            {PLANS.map((p, i) => {
              const soon = !payments && p.id !== "por-vacante";
              return (
              <ChoiceCard
                key={p.id}
                index={i}
                tone={(["cielo", "sol", "menta"] as const)[i % 3]}
                title={p.title}
                badge={soon ? "Próximamente" : p.badge}
                selected={soon ? undefined : chosenPlan === p.id}
                className={soon ? "opacity-70" : undefined}
                onClick={() => (soon ? toast("Los planes de pago llegan pronto. Por ahora publicar es gratis.") : setPlan(p.id))}
                description={
                  <>
                    <span className="block font-display text-[1.15rem] font-extrabold text-foreground tabular-nums">
                      {p.price}
                    </span>
                    <span className="mt-1 block">{p.description}</span>
                  </>
                }
              />
              );
            })}
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
            <PrimaryButton disabled={!accepted || busy} onClick={finish} aria-busy={busy}>
              {busy ? <Spinner className="size-5" /> : null}
              {busy ? "Guardando tu negocio…" : liveIn ? "Registrar mi negocio" : "Crear cuenta de empresa"}
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
                  branches.length > 1
                    ? ["Sucursales", `${branches.length} · ${branches.map((b, i) => (b.place?.source === "gps" ? branchName(b, i) : b.place?.colonia)).join(", ")}`]
                    : ["Ubicación", place?.source === "gps" ? "Ubicación detectada" : (place?.colonia ?? "")],
                  ["Plan", PLANS.find((p) => p.id === chosenPlan)?.title ?? ""],
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
