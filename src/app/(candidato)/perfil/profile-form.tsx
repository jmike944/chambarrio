"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Building06Icon,
  Gps01Icon,
  Location06Icon,
  LockIcon,
  Notification01Icon,
  Route01Icon,
  Tick02Icon,
  ToolsIcon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { BLOCK_CLASS, HeroCard, type BlockTone } from "@/components/chamba/primitives";
import { springs, StageBars, Sticker, useConfetti } from "@/components/chamba/motion";
import { CATEGORY_BLOCK, CategoryIcon } from "@/components/chamba/job-icons";
import { Mascot, type MascotProp } from "@/components/chamba/art/mascot";
import { Doodle } from "@/components/chamba/art/doodles";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES } from "@/lib/data/categories";
import { COLONIAS } from "@/lib/data/jobs";
import type { CategoryId, Experience } from "@/lib/data/types";
import { bandColor, bandFor, RADIUS_STOPS } from "@/lib/geo";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { HARD, HARD_SM, HazardTape, Rivets, STENCIL } from "../postulaciones/rugged";
import { AccountBlock } from "./account-block";

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

const EXPERIENCE: Experience[] = ["Sin experiencia", "6 meses", "1 año", "2 años o más"];

/** Mascot gear by the kind of work the person is after (rugged trades first). */
function propFor(interests: CategoryId[]): MascotProp {
  if (interests.some((c) => c === "construccion" || c === "mantenimiento" || c === "produccion" || c === "montacargas")) return "casco";
  if (interests.some((c) => c === "chofer" || c === "almacen")) return "paquete";
  if (interests.includes("restaurante")) return "chef";
  return interests.length ? "gorra" : "lupa";
}

/** Shared block-section shell: color block + hard ink outline + staggered rise. */
function Block({
  tone,
  index,
  title,
  icon,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"section">, "title"> & { tone: BlockTone; index: number; title: React.ReactNode; icon: typeof UserIcon }) {
  return (
    <section
      className={cn("relative isolate min-w-0 animate-rise rounded-panel p-5 sm:p-6", BLOCK_CLASS[tone], HARD, className)}
      style={{ "--i": index } as CSSVars}
      {...props}
    >
      <header className="mb-4 flex items-center gap-3">
        <span className={cn("grid size-10 shrink-0 -rotate-6 place-items-center rounded-xl bg-ink text-white")}>
          <HugeiconsIcon icon={icon} className="size-5" strokeWidth={2} />
        </span>
        <h2 className="font-display text-[1.35rem] leading-tight font-extrabold tracking-[-0.03em]">{title}</h2>
      </header>
      {children}
    </section>
  );
}

/** "+52 844…" / "8441234567" → the 10 local digits. */
function digits10(raw: string) {
  return raw.replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "").slice(0, 10);
}
function formatPhone10(raw: string) {
  const d = digits10(raw);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

const FIELD = "h-12 border-2 border-ink/25 bg-white/80 text-base text-ink dark:bg-white/80 focus-visible:border-ink";

export function ProfileForm() {
  const name = useApp((s) => s.name);
  const setName = useApp((s) => s.setName);
  const colonia = useApp((s) => s.colonia);
  const setHome = useApp((s) => s.setHome);
  const interests = useApp((s) => s.interests);
  const setInterests = useApp((s) => s.setInterests);
  const experience = useApp((s) => s.experience);
  const setExperience = useApp((s) => s.setExperience);
  const radiusKm = useApp((s) => s.radiusKm);
  const setRadius = useApp((s) => s.setRadius);
  const phone = useApp((s) => s.phone);
  const setPhone = useApp((s) => s.setPhone);
  const [phoneDraft, setPhoneDraft] = useState<string | null>(null);
  const [approx, setApprox] = useState(true);
  const [notify, setNotify] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(true);

  /* ---- profile completion (drives the hero bars + a confetti burst when it hits 100% by hand) */
  const checks = [
    { label: "Tu nombre", ok: name.trim().length > 0 },
    { label: "Tu zona", ok: colonia.trim().length > 0 },
    { label: "Qué chamba buscas", ok: interests.length > 0 },
    { label: "Tu experiencia", ok: !!experience },
    { label: "Tus avisos", ok: notify || smsAlerts },
  ];
  const done = checks.filter((c) => c.ok).length;
  const total = checks.length;
  const pct = Math.round((done / total) * 100);
  const heroRef = useRef<HTMLDivElement>(null);
  const touched = useRef(false);
  const prevDone = useRef(done);
  const fire = useConfetti();
  useEffect(() => {
    if (touched.current && prevDone.current < total && done === total) {
      fire({ origin: heroRef.current ?? undefined });
      toast.success("¡Ya quedó! Tu perfil está al 100%.");
    }
    prevDone.current = done;
  }, [done, total, fire]);
  const touch = () => {
    touched.current = true;
  };

  function useGps() {
    if (!("geolocation" in navigator)) return toast.error("Tu teléfono no permite compartir ubicación. Elige tu colonia.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setHome({ lat: p.coords.latitude, lng: p.coords.longitude }, "Mi ubicación", "gps");
        toast.success("Ubicación actualizada. Las distancias ya se calculan desde aquí.");
      },
      () => toast.error("No pudimos obtener tu ubicación. Elige tu colonia de la lista."),
      { enableHighAccuracy: false, timeout: 10000 },
    );
  }

  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  const firstName = name.trim().split(/\s+/)[0] || "Tú";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 lg:gap-7">
      <div className="grid min-w-0 grid-cols-1 content-start gap-6 lg:col-span-7">
        {/* ---------------------------------------------------------------- hero */}
        <div ref={heroRef}>
          <HeroCard
            eyebrow="Tu ficha de chamba"
            className={cn("animate-rise overflow-visible", HARD, "shadow-[6px_6px_0_0_var(--ink)]!")}
            sticker={
              <Sticker variant="lime" rotate={12} dot>
                <strong>{pct}%</strong>listo
              </Sticker>
            }
          >
            <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
              <span className="absolute inset-0 bg-dots text-white opacity-[0.08]" />
              <HazardTape className="absolute inset-x-0 bottom-0 h-3 border-b-0" />
            </span>
            <Rivets className="text-white" />
            <div className="mt-3 flex items-center gap-4 pr-10">
              <span
                className={cn(
                  "grid size-[4.5rem] shrink-0 -rotate-3 place-items-center rounded-2xl bg-limon font-display text-[1.9rem] font-extrabold text-ink",
                  HARD_SM,
                )}
                aria-hidden
              >
                {initials}
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-[2rem] leading-[1.02] font-extrabold tracking-[-0.035em] sm:text-[2.3rem]">
                  {firstName}
                </p>
                <p className="mt-1 flex items-center gap-1.5 truncate text-[0.95rem] text-primary-foreground/80">
                  <HugeiconsIcon icon={Location06Icon} className="size-4 shrink-0" strokeWidth={2} />
                  {colonia} · hasta {radiusKm} km
                </p>
              </div>
            </div>

            {interests.length > 0 ? (
              <ul className="mt-4 flex flex-wrap gap-1.5" aria-label="Chamba que buscas">
                {interests.map((id, i) => (
                  <li
                    key={id}
                    className="flex h-9 animate-pop-in items-center gap-1.5 rounded-full bg-white/14 py-1 pr-3 pl-1 text-[0.85rem] font-semibold"
                    style={{ "--i": i + 2 } as CSSVars}
                  >
                    <CategoryIcon category={id} size="xs" />
                    {CATEGORIES.find((c) => c.id === id)?.label}
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-5 flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <p className="mb-2 text-[0.72rem] font-semibold tracking-[0.14em] uppercase">
                  <span className="text-limon">
                    {done} de {total}
                  </span>
                  <span className="text-primary-foreground/75">
                    {" "}
                    · {done === total ? "¡Perfil completo!" : `Falta: ${checks.find((c) => !c.ok)?.label}`}
                  </span>
                </p>
                <StageBars
                  className="h-16"
                  total={total}
                  current={Math.max(done, 1)}
                  labels={checks.map((c) => c.label)}
                  tone="inverse"
                  label="Avance de tu perfil"
                />
              </div>
              <Mascot mood={done === total ? "festeja" : "saluda"} prop={propFor(interests)} size={92} className="-mr-2 -mb-2 shrink-0" />
            </div>
          </HeroCard>
        </div>

        {/* ---------------------------------------------------------------- datos */}
        <Block tone="sol" index={1} title="Tus datos" icon={UserIcon}>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-[0.95rem] font-semibold">Nombre</Label>
              <Input
                id="name"
                autoComplete="given-name"
                value={name}
                onChange={(e) => {
                  touch();
                  setName(e.target.value);
                }}
                className={FIELD}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-[0.95rem] font-semibold">Celular</Label>
              <Input
                id="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="844 123 4567"
                value={phoneDraft ?? formatPhone10(phone)}
                onChange={(e) => setPhoneDraft(formatPhone10(e.target.value))}
                onBlur={() => {
                  if (phoneDraft === null) return;
                  const d = digits10(phoneDraft);
                  setPhoneDraft(null);
                  if (d.length === 10 && d !== digits10(phone)) {
                    void setPhone(d);
                    toast.success("Celular actualizado.");
                  } else if (d.length !== 10 && d.length > 0) toast.error("Escribe tu celular de 10 dígitos.");
                }}
                aria-describedby="phone-hint"
                className={FIELD}
              />
              <p id="phone-hint" className="text-sm text-muted-foreground">Solo lo ve la empresa cuando decide contactarte.</p>
            </div>
          </div>
        </Block>

        {/* ---------------------------------------------------------------- intereses */}
        <Block tone="cielo" index={2} title="¿Qué chamba buscas?" icon={ToolsIcon}>
          <fieldset>
            <legend className="mb-3 text-[0.95rem] text-muted-foreground">Toca las que te laten. Puedes elegir varias.</legend>
            <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
              {CATEGORIES.map((c) => {
                const on = interests.includes(c.id);
                return (
                  <motion.button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      touch();
                      setInterests(on ? interests.filter((x) => x !== c.id) : [...interests, c.id]);
                    }}
                    initial={false}
                    animate={{ scale: on ? [1, 1.1, 0.97, 1] : [1, 0.94, 1], rotate: on ? [0, -4, 2, 0] : 0 }}
                    whileTap={{ scale: 0.92, transition: springs.snappy }}
                    transition={{ duration: 0.45, ease: "easeOut" }}
                    className={cn(
                      "group relative flex min-h-[6.5rem] flex-col items-center justify-center gap-1.5 rounded-tile px-1.5 py-2.5 text-center text-[0.8rem] leading-tight font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ink/60",
                      on ? cn(BLOCK_CLASS[CATEGORY_BLOCK[c.id]], HARD_SM) : "border-2 border-dashed border-ink/30 bg-white/45 hover:bg-white/70",
                    )}
                  >
                    <CategoryIcon category={c.id} size="md" animated={on} className={cn(!on && "opacity-80 grayscale-[0.35]")} />
                    <span className="line-clamp-2">{c.label}</span>
                    {on ? (
                      <span
                        aria-hidden
                        className="absolute -top-2 -right-2 grid size-6 animate-pop-in place-items-center rounded-full border-2 border-ink bg-limon text-ink"
                      >
                        <HugeiconsIcon icon={Tick02Icon} className="size-3.5" strokeWidth={3} />
                      </span>
                    ) : null}
                  </motion.button>
                );
              })}
            </div>
          </fieldset>
        </Block>
      </div>

      <div className="grid min-w-0 grid-cols-1 content-start gap-6 lg:col-span-5">
        {/* ---------------------------------------------------------------- experiencia + radio */}
        <Block tone="lila" index={3} title="Experiencia y distancia" icon={Route01Icon}>
          <div role="radiogroup" aria-label="Tu experiencia" className="grid grid-cols-2 gap-2">
            {EXPERIENCE.map((x) => {
              const on = experience === x;
              return (
                <button
                  key={x}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    touch();
                    setExperience(x);
                  }}
                  className={cn(
                    "press flex h-12 items-center justify-center gap-1.5 rounded-full px-3 text-[0.92rem] font-semibold outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ink/60",
                    on ? cn("bg-ink text-white", HARD_SM) : "border-2 border-ink/25 bg-white/55 hover:bg-white/80",
                  )}
                >
                  {on ? <HugeiconsIcon icon={Tick02Icon} className="size-4 text-limon" strokeWidth={3} /> : null}
                  {x}
                </button>
              );
            })}
          </div>

          <p className="mt-5 mb-2 text-[0.72rem] font-semibold tracking-[0.14em] text-muted-foreground uppercase">
            ¿Hasta dónde vas?
          </p>
          <div role="radiogroup" aria-label="Distancia máxima" className="grid grid-cols-4 gap-2">
            {RADIUS_STOPS.map((r) => {
              const on = radiusKm === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`Hasta ${r} km`}
                  onClick={() => setRadius(r)}
                  className={cn(
                    "press relative flex h-16 flex-col items-center justify-center rounded-tile outline-none transition-colors focus-visible:ring-3 focus-visible:ring-ink/60",
                    on ? cn("bg-white", HARD_SM) : "border-2 border-ink/20 bg-white/40 hover:bg-white/70",
                  )}
                >
                  <span className={cn("text-[1.5rem] leading-none", STENCIL)}>{r}</span>
                  <span className="mt-0.5 flex items-center gap-1 text-[0.72rem] font-semibold">
                    <span className="size-2 rounded-full" style={{ background: bandColor(bandFor(r - 0.01)) }} />
                    km
                  </span>
                </button>
              );
            })}
          </div>
        </Block>

        {/* ---------------------------------------------------------------- zona */}
        <Block tone="durazno" index={4} title="Dónde vives" icon={Location06Icon}>
          <div className="space-y-3">
            <Select
              value={COLONIAS.some((c) => c.name === colonia) ? colonia : undefined}
              onValueChange={(v) => {
                const c = COLONIAS.find((x) => x.name === v);
                touch();
                if (c) setHome(c.location, c.name, "colonia");
              }}
            >
              <SelectTrigger className={cn(FIELD, "w-full")} aria-label="Tu colonia">
                <SelectValue placeholder={colonia} />
              </SelectTrigger>
              <SelectContent>
                {COLONIAS.map((c) => (
                  <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button
              type="button"
              onClick={useGps}
              className="press group flex h-12 w-full items-center justify-center gap-2 rounded-full bg-ink text-[0.95rem] font-semibold text-white outline-none focus-visible:ring-3 focus-visible:ring-ink/60"
            >
              <HugeiconsIcon icon={Gps01Icon} className="size-5 group-hover:animate-wiggle" strokeWidth={2} />
              Usar mi ubicación actual
            </button>
            <label className="flex items-start gap-3 rounded-tile border-2 border-dashed border-ink/25 bg-white/50 p-4">
              <HugeiconsIcon icon={LockIcon} className="mt-0.5 size-5 shrink-0" strokeWidth={2} />
              <span className="flex-1 text-[0.95rem] leading-snug font-semibold">
                Mostrar solo mi zona aproximada
                <span className="block text-sm font-normal text-muted-foreground">
                  Las empresas ven tu colonia y la distancia, nunca tu dirección exacta.
                </span>
              </span>
              <Switch checked={approx} onCheckedChange={setApprox} aria-label="Mostrar solo mi zona aproximada" />
            </label>
          </div>
        </Block>

        {/* ---------------------------------------------------------------- avisos */}
        <Block tone="menta" index={5} title="Avisos" icon={Notification01Icon} className="overflow-hidden">
          <Doodle name="chispa" color="#FFD23F" className="absolute top-5 right-5 size-8" />
          <div className="space-y-2">
            {[
              { label: "Vacantes nuevas dentro de mi radio", on: notify, set: setNotify },
              { label: "Avisos por SMS", on: smsAlerts, set: setSmsAlerts },
            ].map((o) => (
              <label
                key={o.label}
                className="flex min-h-14 items-center justify-between gap-3 rounded-tile bg-white/55 px-4 text-[0.95rem] font-semibold"
              >
                {o.label}
                <Switch
                  checked={o.on}
                  onCheckedChange={(v) => {
                    touch();
                    o.set(v);
                  }}
                  aria-label={o.label}
                />
              </label>
            ))}
          </div>
        </Block>

        <AccountBlock index={6} />

        <Link
          href="/empresa"
          className={cn(
            "group lift press relative flex animate-rise items-center gap-3 overflow-hidden rounded-panel bg-card py-5 pr-5 pl-9 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden",
            HARD,
          )}
          style={{ "--i": 6 } as CSSVars}
        >
          <HazardTape className="absolute inset-y-0 left-0 w-4 border-y-0 border-r-2" />
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-ink text-white">
            <HugeiconsIcon icon={Building06Icon} className="size-6" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1 text-[0.95rem] font-semibold">
            ¿Tienes un negocio?
            <span className="block font-normal text-muted-foreground">Cambia a modo empresa</span>
          </span>
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 shrink-0 transition-transform group-hover:translate-x-1" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
