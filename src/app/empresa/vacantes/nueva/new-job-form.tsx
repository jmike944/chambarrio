"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Add01Icon, Location01Icon, MinusSignIcon, SentIcon, Store01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BLOCK_CLASS, DistanceRing, Eyebrow, type BlockTone } from "@/components/chamba/primitives";
import { confetti, springs } from "@/components/chamba/motion";
import { CategoryArt, CategoryIcon, CATEGORY_BLOCK } from "@/components/chamba/job-icons";
import { Scene } from "@/components/chamba/art/scenes";
import { MyScene } from "@/components/chamba/art/my-mascot";
import {
  FIELD,
  HARD,
  HARD_SM,
  INK_BUTTON,
  OUTLINE,
  StencilNum,
  WHITE_BUTTON,
  WORK_CONFETTI,
} from "@/components/empresa/workwear";
import { CATEGORIES, CATEGORY_BY_ID } from "@/lib/data/categories";
import { EmployerGate } from "@/components/empresa/employer-gate";
import { publishJob } from "@/lib/live/backend";
import { useEmployerLocations, useIsLive } from "@/lib/store";
import { useCan } from "@/lib/team";
import { NotForRole } from "@/components/team/not-for-role";
import { BranchMapArt, coloniaText, nearbyEstimate, typicalKm } from "@/app/empresa/sucursales/branch-kit";
import type { CategoryId, EmploymentType, Experience, PayPeriod, Shift } from "@/lib/data/types";
import { formatPay } from "@/lib/format";
import { cn } from "@/lib/utils";

const PERIODS: { id: PayPeriod; label: string }[] = [
  { id: "semana", label: "Por semana" },
  { id: "quincena", label: "Por quincena" },
  { id: "mes", label: "Al mes" },
  { id: "dia", label: "Por día" },
];
const SHIFTS: Shift[] = ["Matutino", "Vespertino", "Nocturno", "Mixto", "Rotativo"];
const TYPES: EmploymentType[] = ["Tiempo completo", "Medio tiempo", "Temporal", "Fines de semana"];
const EXPERIENCE: Experience[] = ["Sin experiencia", "6 meses", "1 año", "2 años o más"];
const BENEFITS = [
  "IMSS desde el primer día",
  "Aguinaldo",
  "Vales de despensa",
  "Transporte de personal",
  "Comedor subsidiado",
  "Bono de puntualidad",
  "Fondo de ahorro",
  "Uniformes",
];

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

const selectCls = cn(
  FIELD,
  "w-full data-[size=default]:h-14 dark:hover:bg-white [&_[data-slot=select-value]]:text-ink",
);

function Field({ id, label, children, className }: { id?: string; label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("grid gap-2", className)}>
      <Label htmlFor={id} className="text-[0.95rem] font-bold">
        {label}
      </Label>
      {children}
    </div>
  );
}

/** A form section painted as a color block with a stencil step number. */
function Block({
  n,
  tone,
  title,
  hint,
  index,
  children,
  className,
}: {
  n: number;
  tone: BlockTone | "white";
  title: string;
  hint?: string;
  index: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "animate-rise relative rounded-panel p-5 sm:p-6",
        tone === "white" ? "bg-card text-card-foreground dark:border-white/25" : BLOCK_CLASS[tone],
        OUTLINE,
        HARD,
        className,
      )}
      style={{ "--i": index } as CSSVars}
      aria-labelledby={`paso-${n}`}
    >
      <header className="mb-5 flex items-center gap-3">
        <StencilNum n={n} className={tone === "white" ? "dark:bg-limon dark:text-ink" : undefined} />
        <div className="min-w-0">
          <h2 id={`paso-${n}`} className="font-display text-[1.45rem] leading-tight font-extrabold tracking-[-0.03em]">
            {title}
          </h2>
          {hint ? <p className="text-[0.9rem] text-muted-foreground">{hint}</p> : null}
        </div>
      </header>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/** Arrow-key navigation for a radiogroup of buttons (roving focus). */
function onRadioKeys<T>(e: React.KeyboardEvent, items: T[], current: T, set: (v: T) => void) {
  const keys: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
  const d = keys[e.key];
  if (!d) return;
  e.preventDefault();
  const i = items.indexOf(current);
  const next = (i + d + items.length) % items.length;
  set(items[next]);
  const group = e.currentTarget as HTMLElement;
  group.querySelectorAll<HTMLElement>("[role=radio]")[next]?.focus();
}

export function NewJobForm() {
  return <EmployerGate shape="form">{(my) => <NewJobGate companyName={my.company.name} />}</EmployerGate>;
}

/** Publishing is for the dueño and admins; a reclutador gets who does it and where their work is. */
function NewJobGate({ companyName }: { companyName: string }) {
  const can = useCan();
  if (can.role && !can.createVacancy) {
    return (
      <NotForRole
        title="Las vacantes las publica el dueño"
        body="O alguien de tu equipo con rol de administrador. Tú revisas a quien se postula, agendas entrevistas y contratas."
        back={{ href: "/empresa/candidatos", label: "Ver candidatos" }}
      />
    );
  }
  return <NewJobFormBody companyName={companyName} />;
}

/** "Licencia vigente, secundaria\nTurnos rotativos" → ["Licencia vigente", "secundaria", "Turnos rotativos"]. */
function splitRequirements(text: string): string[] {
  return text
    .split(/[\n;,]+/)
    .map((r) => r.trim())
    .filter(Boolean);
}

function NewJobFormBody({ companyName }: { companyName: string }) {
  const router = useRouter();
  const live = useIsLive();
  const reduced = useReducedMotion();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CategoryId>("almacen");
  const [pay, setPay] = useState("2500");
  const [period, setPeriod] = useState<PayPeriod>("semana");
  const [shift, setShift] = useState<Shift>("Matutino");
  const [schedule, setSchedule] = useState("Lun a Vie · 7:00 a 15:00");
  const [type, setType] = useState<EmploymentType>("Tiempo completo");
  const [experience, setExperience] = useState<Experience>("Sin experiencia");
  const [benefits, setBenefits] = useState<string[]>(["IMSS desde el primer día", "Aguinaldo"]);
  const [requirements, setRequirements] = useState("");
  const [openings, setOpenings] = useState("1");
  const [branchId, setBranchId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [published, setPublished] = useState(false);
  const [titleMissing, setTitleMissing] = useState(false);
  const [shakeScope, shake] = useAnimate();
  const titleRef = useRef<HTMLInputElement>(null);
  const submitRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const locations = useEmployerLocations();
  // Default to the main location; fall back to it if the chosen one was removed.
  const branch = locations.find((l) => l.id === branchId) ?? locations[0];
  const multi = locations.length > 1;
  const nearby = branch ? nearbyEstimate(branch.location) : 0;

  const payNum = Number(pay) || 0;
  const previewTitle = title.trim() || "Nombre del puesto";
  const tone = CATEGORY_BLOCK[category];
  const openingsNum = Math.max(1, Number(openings) || 1);

  function toggleBenefit(b: string) {
    setBenefits((prev) => (prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!title.trim()) {
      setTitleMissing(true);
      toast.error("Escribe el nombre del puesto para publicar la vacante.");
      titleRef.current?.focus();
      if (shakeScope.current) shake(shakeScope.current, { x: [0, -10, 10, -6, 6, 0] }, { duration: 0.42 });
      return;
    }
    if (live) {
      void publishLive();
      return;
    }
    setSubmitting(true);
    setPublished(true);
    confetti({ origin: submitRef.current, colors: WORK_CONFETTI, count: 56, spread: 140 });
    toast.success(
      `Vacante publicada gratis${branch && multi ? ` en ${branch.name}` : ""}. Te avisaremos cuando alguien cerca se postule.`,
    );
    timer.current = window.setTimeout(
      () => {
        setTitle("");
        setRequirements("");
        setSubmitting(false);
        router.push("/empresa");
        // Pages stay mounted; don't come back to the celebration overlay.
        setPublished(false);
      },
      reduced ? 900 : 1800,
    );
  }

  async function publishLive() {
    if (!branch) {
      toast.error("Agrega una sucursal para publicar la vacante.");
      return;
    }
    if (branch.id.startsWith("tmp-")) {
      toast.error("Estamos guardando esa sucursal. Inténtalo en unos segundos.");
      return;
    }
    if (payNum <= 0) {
      toast.error("Escribe cuánto pagas para publicar la vacante.");
      document.getElementById("sueldo")?.focus();
      return;
    }
    setSubmitting(true);
    const r = await publishJob({
      branchId: branch.id,
      title: title.trim(),
      category,
      pay: payNum,
      period,
      shift,
      schedule: schedule.trim(),
      type,
      experience,
      benefits,
      requirements: splitRequirements(requirements),
      openings: openingsNum,
    });
    if (r.error !== undefined) {
      setSubmitting(false);
      toast.error(r.error);
      return;
    }
    setPublished(true);
    confetti({ origin: submitRef.current, colors: WORK_CONFETTI, count: 56, spread: 140 });
    toast.success(`Vacante publicada gratis${multi ? ` en ${branch.name}` : ""}. Te avisaremos cuando alguien cerca se postule.`);
    const id = r.data;
    timer.current = window.setTimeout(
      () => {
        setTitle("");
        setRequirements("");
        setSubmitting(false);
        router.push(`/empresa/vacantes/${id}`);
        setPublished(false);
      },
      reduced ? 700 : 1400,
    );
  }

  return (
    <>
      <form onSubmit={onSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:items-start lg:gap-7">
        <div className="min-w-0 space-y-6 lg:col-span-7">
          {/* 01 · Puesto y categoría */}
          <Block n={1} tone="sol" title="¿Qué chamba es?" hint="El nombre y el tipo de trabajo" index={0}>
            <Field id="puesto" label="Puesto">
              <div ref={shakeScope}>
                <Input
                  ref={titleRef}
                  id="puesto"
                  name="puesto"
                  autoComplete="off"
                  placeholder="Ej. Montacarguista"
                  value={title}
                  aria-invalid={titleMissing && !title.trim() ? true : undefined}
                  aria-describedby={titleMissing && !title.trim() ? "puesto-error" : undefined}
                  onChange={(e) => setTitle(e.target.value)}
                  className={cn(FIELD, "font-semibold")}
                />
              </div>
              {titleMissing && !title.trim() ? (
                <p id="puesto-error" className="text-sm font-bold">
                  Falta el nombre del puesto.
                </p>
              ) : null}
            </Field>

            <div className="grid gap-2">
              <p id="categoria-label" className="text-[0.95rem] font-bold">
                Categoría
              </p>
              <div
                role="radiogroup"
                aria-labelledby="categoria-label"
                className="grid grid-cols-3 gap-2.5 sm:grid-cols-4"
                onKeyDown={(e) =>
                  onRadioKeys(
                    e,
                    CATEGORIES.map((c) => c.id),
                    category,
                    setCategory,
                  )
                }
              >
                {CATEGORIES.map((c, i) => {
                  const on = c.id === category;
                  return (
                    <motion.button
                      key={c.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      tabIndex={on ? 0 : -1}
                      onClick={() => setCategory(c.id)}
                      animate={{ scale: on ? 1.04 : 1, rotate: on ? (i % 2 ? 2 : -2) : 0 }}
                      whileTap={{ scale: 0.92 }}
                      transition={springs.bouncy}
                      className={cn(
                        "group relative flex min-h-[6.5rem] flex-col items-center justify-center gap-1.5 rounded-tile border-2 border-ink px-1 py-2.5 text-center text-[0.74rem] leading-tight font-bold text-ink outline-none focus-visible:ring-4 focus-visible:ring-ring/60 sm:text-[0.82rem]",
                        on ? cn(BLOCK_CLASS[CATEGORY_BLOCK[c.id]], HARD_SM) : "bg-white/70 hover:bg-white dark:bg-white/80",
                      )}
                    >
                      <CategoryIcon category={c.id} size="md" animated={on} />
                      <span className="text-balance">{c.label}</span>
                      {on ? (
                        <motion.span
                          layoutId="categoria-check"
                          transition={springs.snappy}
                          className="absolute -top-2.5 -right-2.5 grid size-7 place-items-center rounded-full border-2 border-ink bg-limon text-ink"
                          aria-hidden
                        >
                          <HugeiconsIcon icon={Tick02Icon} className="size-4" strokeWidth={3} />
                        </motion.span>
                      ) : null}
                    </motion.button>
                  );
                })}
              </div>
            </div>
          </Block>

          {/* 02 · Sucursal */}
          <Block
            n={2}
            tone="lila"
            title="¿En qué sucursal es?"
            hint="Avisamos a quien vive cerca de ahí"
            index={1}
          >
            {multi && branch ? (
              <div
                role="radiogroup"
                aria-label="Sucursal"
                className="grid gap-3 sm:grid-cols-2"
                onKeyDown={(e) =>
                  onRadioKeys(
                    e,
                    locations.map((l) => l.id),
                    branch.id,
                    setBranchId,
                  )
                }
              >
                {locations.map((l, i) => {
                  const on = l.id === branch.id;
                  return (
                    <motion.button
                      key={l.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      tabIndex={on ? 0 : -1}
                      onClick={() => setBranchId(l.id)}
                      whileTap={{ scale: 0.95 }}
                      transition={springs.bouncy}
                      className={cn(
                        "group relative flex min-h-[5.5rem] items-center gap-3 rounded-tile border-2 border-ink p-2.5 pr-3 text-left text-ink outline-none focus-visible:ring-4 focus-visible:ring-ring/60",
                        on ? cn("bg-white", HARD_SM) : "bg-white/55 hover:bg-white/85 dark:bg-white/70",
                      )}
                    >
                      <BranchMapArt seed={l.id} principal={i === 0} className="w-18 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block font-display text-[1.08rem] leading-tight font-extrabold tracking-[-0.02em] break-words">
                          {l.name}
                        </span>
                        <span className="mt-0.5 block text-[0.85rem] leading-snug font-medium text-ink/65">
                          {coloniaText(l)}
                        </span>
                      </span>
                      {on ? (
                        <motion.span
                          layoutId="sucursal-check"
                          transition={springs.snappy}
                          aria-hidden
                          className="absolute -top-2.5 -right-2.5 grid size-7 place-items-center rounded-full border-2 border-ink bg-limon text-ink"
                        >
                          <HugeiconsIcon icon={Tick02Icon} className="size-4" strokeWidth={3} />
                        </motion.span>
                      ) : null}
                    </motion.button>
                  );
                })}
              </div>
            ) : branch ? (
              <div className="flex flex-wrap items-center gap-3">
                <span
                  className={cn(
                    "inline-flex min-h-12 max-w-full items-center gap-2.5 rounded-full border-2 border-ink bg-white py-1.5 pr-4 pl-1.5 text-ink",
                    HARD_SM,
                  )}
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-limon">
                    <HugeiconsIcon icon={Tick02Icon} className="size-4.5" strokeWidth={3} />
                  </span>
                  <span className="min-w-0 leading-tight">
                    <span className="block truncate font-display font-extrabold">{branch.name}</span>
                    <span className="block truncate text-[0.82rem] font-medium text-ink/65">{coloniaText(branch)}</span>
                  </span>
                </span>
                <Link
                  href="/empresa/sucursales"
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-[0.95rem] font-bold underline decoration-2 underline-offset-4 outline-none focus-visible:ring-4 focus-visible:ring-ring/60"
                >
                  <HugeiconsIcon icon={Add01Icon} className="size-4.5" strokeWidth={2.4} />
                  Agregar sucursal
                </Link>
              </div>
            ) : (
              <Link
                href="/empresa/sucursales"
                className="inline-flex min-h-11 items-center gap-1.5 font-bold underline decoration-2 underline-offset-4"
              >
                Agrega tu primera sucursal
              </Link>
            )}
          </Block>

          {/* 03 · Sueldo y horario */}
          <Block n={3} tone="cielo" title="Sueldo y horario" hint="Lo primero que ve la gente" index={2}>
            <Field id="sueldo" label="Sueldo (MXN)">
              <div className="relative">
                <span className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 font-display text-xl font-extrabold text-ink">
                  $
                </span>
                <Input
                  id="sueldo"
                  name="sueldo"
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={pay}
                  onChange={(e) => setPay(e.target.value)}
                  className={cn(FIELD, "pl-9 font-display text-xl font-extrabold tabular-nums md:text-xl")}
                />
              </div>
            </Field>

            <div className="grid gap-2">
              <p id="periodo-label" className="text-[0.95rem] font-bold">
                Periodo de pago
              </p>
              <div
                role="radiogroup"
                aria-labelledby="periodo-label"
                className="grid grid-cols-2 gap-2 sm:grid-cols-4"
                onKeyDown={(e) =>
                  onRadioKeys(
                    e,
                    PERIODS.map((p) => p.id),
                    period,
                    setPeriod,
                  )
                }
              >
                {PERIODS.map((p) => {
                  const on = p.id === period;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={on}
                      tabIndex={on ? 0 : -1}
                      onClick={() => setPeriod(p.id)}
                      className={cn(
                        "press h-12 rounded-full border-2 border-ink px-3 text-[0.92rem] font-bold outline-none focus-visible:ring-4 focus-visible:ring-ring/60",
                        on ? cn("bg-ink text-white", HARD_SM) : "bg-white/70 text-ink hover:bg-white dark:bg-white/80",
                      )}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Turno">
                <Select value={shift} onValueChange={(v) => setShift(v as Shift)}>
                  <SelectTrigger className={selectCls} aria-label="Turno">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SHIFTS.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field id="horario" label="Horario">
                <Input
                  id="horario"
                  name="horario"
                  value={schedule}
                  onChange={(e) => setSchedule(e.target.value)}
                  className={FIELD}
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Tipo de empleo">
                <Select value={type} onValueChange={(v) => setType(v as EmploymentType)}>
                  <SelectTrigger className={selectCls} aria-label="Tipo de empleo">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Experiencia">
                <Select value={experience} onValueChange={(v) => setExperience(v as Experience)}>
                  <SelectTrigger className={selectCls} aria-label="Experiencia">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPERIENCE.map((x) => (
                      <SelectItem key={x} value={x}>
                        {x}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <Field id="vacantes" label="Lugares disponibles">
              <div className="flex items-center gap-2.5">
                <Button
                  type="button"
                  size="icon-xl"
                  aria-label="Un lugar menos"
                  className={cn("rounded-tile", WHITE_BUTTON, HARD_SM)}
                  onClick={() => setOpenings(String(Math.max(1, openingsNum - 1)))}
                >
                  <HugeiconsIcon icon={MinusSignIcon} strokeWidth={2.6} />
                </Button>
                <Input
                  id="vacantes"
                  name="vacantes"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  value={openings}
                  onChange={(e) => setOpenings(e.target.value)}
                  className={cn(FIELD, "w-24 text-center font-display text-xl font-extrabold tabular-nums md:text-xl")}
                />
                <Button
                  type="button"
                  size="icon-xl"
                  aria-label="Un lugar más"
                  className={cn("rounded-tile", INK_BUTTON, HARD_SM)}
                  onClick={() => setOpenings(String(openingsNum + 1))}
                >
                  <HugeiconsIcon icon={Add01Icon} strokeWidth={2.6} />
                </Button>
              </div>
            </Field>
          </Block>

          {/* 04 · Prestaciones */}
          <Block n={4} tone="menta" title="Prestaciones" hint="Lo que hace que te elijan a ti" index={3}>
            <fieldset>
              <legend className="sr-only">Prestaciones</legend>
              <div className="flex flex-wrap gap-2">
                {BENEFITS.map((b) => {
                  const on = benefits.includes(b);
                  return (
                    <motion.button
                      key={b}
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggleBenefit(b)}
                      whileTap={{ scale: 0.92 }}
                      animate={{ scale: on ? [1, 1.08, 1] : 1 }}
                      transition={{ duration: 0.28 }}
                      className={cn(
                        "inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-ink px-4 text-[0.92rem] font-semibold outline-none focus-visible:ring-4 focus-visible:ring-ring/60",
                        on ? "bg-ink text-white" : "bg-white/70 text-ink hover:bg-white dark:bg-white/80",
                      )}
                    >
                      {on ? <HugeiconsIcon icon={Tick02Icon} className="-ml-1 size-4 text-limon" strokeWidth={3} /> : null}
                      {b}
                    </motion.button>
                  );
                })}
              </div>
            </fieldset>
          </Block>

          {/* 05 · Requisitos (dense text → white card) */}
          <Block n={5} tone="white" title="Requisitos" hint="Opcional, pero ayuda" index={4}>
            <Field id="requisitos" label="Requisitos" className="[&>label]:sr-only">
              <Textarea
                id="requisitos"
                name="requisitos"
                rows={4}
                placeholder="Ej. Licencia de montacargas vigente, secundaria terminada…"
                aria-describedby={live ? "requisitos-hint" : undefined}
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                className="min-h-28 rounded-tile border-2 border-ink bg-tile/60 px-4 py-3 text-base md:text-base dark:border-white/30"
              />
              {live ? (
                <p id="requisitos-hint" className="text-[0.85rem] text-muted-foreground">
                  Separa cada requisito con una coma o en otra línea.
                </p>
              ) : null}
            </Field>
          </Block>
        </div>

        {/* Live preview + publish */}
        <div className="min-w-0 space-y-6 lg:sticky lg:top-8 lg:col-span-5">
          <section
            aria-label="Vista previa"
            aria-live="polite"
            className={cn(
              "animate-rise relative isolate overflow-hidden rounded-panel p-5 sm:p-6",
              BLOCK_CLASS[tone],
              OUTLINE,
              HARD,
            )}
            style={{ "--i": 2 } as CSSVars}
          >
            <span aria-hidden className="pointer-events-none absolute inset-0 -z-20 bg-dots opacity-60" />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={category}
                aria-hidden
                initial={{ scale: 0.3, rotate: -40, opacity: 0 }}
                animate={{ scale: 1, rotate: -8, opacity: 1 }}
                exit={{ scale: 0.4, rotate: 30, opacity: 0 }}
                transition={springs.bouncy}
                className="pointer-events-none absolute -top-5 -right-7 -z-10 size-36 sm:size-40"
              >
                <CategoryArt category={category} animated className="size-full" />
              </motion.div>
            </AnimatePresence>

            <Eyebrow tone="inverse">Así la verán cerca de ti</Eyebrow>
            <span className="mt-3 inline-flex items-center rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-[0.72rem] font-extrabold tracking-[0.1em] text-ink uppercase">
              {CATEGORY_BY_ID[category].label}
            </span>
            <p
              className={cn(
                "mt-2 max-w-[12ch] font-display text-[2rem] leading-[1] font-extrabold tracking-[-0.04em] break-words",
                !title.trim() && "opacity-55",
              )}
            >
              {previewTitle}
            </p>
            <p className="mt-2 font-display text-[1.35rem] font-extrabold tracking-[-0.02em] tabular-nums">
              {formatPay({ pay: payNum, period })}
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <p className="min-w-0 text-[0.95rem] leading-snug text-muted-foreground">
                <span className="block">
                  {companyName} · {shift}
                </span>
                {branch ? (
                  <span className="mt-0.5 flex items-start gap-1 font-semibold text-foreground">
                    <HugeiconsIcon icon={multi ? Store01Icon : Location01Icon} className="size-4 shrink-0" strokeWidth={2.2} />
                    <span>{multi ? `${branch.name} · ${coloniaText(branch, false)}` : coloniaText(branch)}</span>
                  </span>
                ) : null}
              </p>
              {branch ? (
                <span className="shrink-0 rounded-full border-2 border-ink bg-white py-1 pr-2.5 pl-1 text-ink">
                  <DistanceRing km={Math.round(typicalKm(branch.location) * 10) / 10} radiusKm={5} size={26} />
                </span>
              ) : null}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2.5 text-[0.95rem]">
              {[
                { k: "Horario", v: schedule || "—" },
                { k: "Tipo", v: type },
                { k: "Experiencia", v: experience },
                { k: "Lugares", v: openings || "1" },
              ].map((d) => (
                <div key={d.k} className="rounded-tile border-2 border-ink bg-white p-3 text-ink">
                  <dt className="text-[0.8rem] font-semibold text-ink/65">{d.k}</dt>
                  <dd className="mt-0.5 leading-snug font-semibold tabular-nums">{d.v}</dd>
                </div>
              ))}
            </dl>
            {benefits.length ? (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {benefits.map((b) => (
                  <li
                    key={b}
                    className="animate-pop-in inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[0.8rem] font-semibold text-white"
                  >
                    <HugeiconsIcon icon={Tick02Icon} className="size-3.5 text-limon" strokeWidth={3} />
                    {b}
                  </li>
                ))}
              </ul>
            ) : null}
            {live ? (
              <p className="mt-4 text-sm text-muted-foreground">
                La verá la gente que vive cerca de {multi && branch ? branch.name : "tu centro"} y busca trabajo de{" "}
                {CATEGORY_BY_ID[category].label.toLowerCase()}.
              </p>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                La avisaremos a unas <strong className="font-bold text-foreground tabular-nums">{nearby} personas</strong> que viven a
                menos de 5 km de {multi && branch ? branch.name : "tu centro"} y buscan trabajo de{" "}
                {CATEGORY_BY_ID[category].label.toLowerCase()}.
              </p>
            )}
          </section>

          {/* The ONE saturated block: publish */}
          <section
            className={cn("animate-rise block-mandarina relative isolate overflow-hidden rounded-panel p-6", OUTLINE, HARD)}
            style={{ "--i": 3 } as CSSVars}
          >
            <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-50" />
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Eyebrow tone="inverse">Publicar es gratis</Eyebrow>
                <h2 className="mt-2 font-display text-[1.9rem] leading-[1] font-extrabold tracking-[-0.04em]">
                  ¡Ándale, publícala!
                </h2>
                <p className="mt-2 text-[0.98rem] leading-snug text-muted-foreground">
                  Te avisamos cuando alguien cerca se postule.
                </p>
              </div>
              <Scene name="negocio" className="-mr-3 -mb-2 w-28 shrink-0 sm:w-32" />
            </div>
            <Button
              ref={submitRef}
              type="submit"
              size="xl"
              disabled={submitting}
              className={cn("mt-5 w-full text-[1.08rem] font-bold disabled:opacity-100", INK_BUTTON, HARD_SM)}
            >
              <HugeiconsIcon icon={SentIcon} className="size-5" strokeWidth={2.2} />
              {submitting ? "Publicando…" : "Publicar gratis"}
            </Button>
          </section>
        </div>
      </form>

      {/* Celebration */}
      <AnimatePresence>
        {published ? (
          <motion.div
            key="exito"
            role="status"
            aria-live="polite"
            className="fixed inset-0 z-[60] grid place-items-center bg-ink/75 p-6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              initial={{ scale: 0.6, rotate: -8, y: 40 }}
              animate={{ scale: 1, rotate: -2, y: 0 }}
              transition={springs.bouncy}
              className={cn("block-limon w-full max-w-sm rounded-panel p-6 text-center", OUTLINE, HARD)}
            >
              <MyScene name="exito" className="mx-auto w-52" />
              <p className="mt-3 font-display text-[2rem] leading-none font-extrabold tracking-[-0.04em]">¡Ya quedó!</p>
              <p className="mt-2 text-[1.02rem] text-muted-foreground">
                Tu vacante ya está publicada. ¡Chamba a la vista para tu colonia!
              </p>
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
