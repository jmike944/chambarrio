"use client";

import { useLayoutEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  CallIcon,
  Clock01Icon,
  LockIcon,
  Location01Icon,
  SquareUnlock02Icon,
  UserGroupIcon,
  WhatsappIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { BLOCK_CLASS, DistanceRing, Eyebrow, SectionLabel, rotateTone } from "@/components/chamba/primitives";
import { CountUp } from "@/components/chamba/motion";
import { CategoryArt, CATEGORY_BLOCK } from "@/components/chamba/job-icons";
import { Mascot } from "@/components/chamba/art/mascot";
import { HazardTape } from "@/components/chamba/art/doodles";
import { UnlockDialog } from "@/components/empresa/unlock-dialog";
import { Padlock } from "@/components/empresa/padlock";
import { HARD, HARD_SM, INK_BUTTON, OUTLINE, WHITE_BUTTON } from "@/components/empresa/workwear";
import { CATEGORY_BY_ID } from "@/lib/data/categories";
import { JOB_BY_ID } from "@/lib/data/jobs";
import { applicantsFor } from "@/lib/data/applicants";
import { formatMinutesAgo, formatMXN, formatPay } from "@/lib/format";
import { formatKm } from "@/lib/geo";
import { UNLOCK_PRICE, useIsUnlocked } from "@/lib/store";
import { cn } from "@/lib/utils";

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

function initialsOf(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function VacancyApplicants({ jobId }: { jobId: string }) {
  const job = JOB_BY_ID[jobId];
  const applicants = applicantsFor(jobId);
  const unlocked = useIsUnlocked()(jobId);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Pages stay mounted after navigating away; don't return to an open dialog.
  useLayoutEffect(() => () => setDialogOpen(false), []);

  const within5 = applicants.filter((a) => a.km <= 5).length;
  const nearest = applicants[0];
  const jobTone = CATEGORY_BLOCK[job.category];
  // Applicant cards rotate pastels, skipping the job's own tone so the grid never echoes the hero.
  let k = 0;
  const cardTones = applicants.map(() => {
    let t = rotateTone(k++);
    if (t === jobTone) t = rotateTone(k++);
    return t;
  });

  return (
    <div className="pt-6 lg:pt-10">
      <Link
        href="/empresa/vacantes"
        className={cn(
          "press inline-flex h-11 items-center gap-1.5 rounded-full bg-card pr-4 pl-2.5 text-[0.95rem] font-semibold outline-none hover:-translate-x-0.5 focus-visible:ring-3 focus-visible:ring-ring/50",
          OUTLINE,
          "dark:border-white/30",
        )}
      >
        <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" strokeWidth={2.2} />
        Vacantes
      </Link>

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        {/* Vacancy summary — painted in its category's color, art bleeding off the corner */}
        <section
          className={cn(
            "animate-rise relative isolate overflow-hidden rounded-panel p-5 pb-6 sm:p-7 lg:col-span-7",
            BLOCK_CLASS[jobTone],
            OUTLINE,
            HARD,
          )}
        >
          <span aria-hidden className="pointer-events-none absolute inset-0 -z-20 bg-dots opacity-60" />
          <CategoryArt
            category={job.category}
            animated
            className="pointer-events-none absolute -top-10 -right-6 -z-10 size-28 rotate-6 sm:-top-8 sm:size-44"
          />
          <span className="inline-flex items-center rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-[0.72rem] font-extrabold tracking-[0.1em] text-ink uppercase">
            {CATEGORY_BY_ID[job.category].label}
          </span>
          <h1 className="mt-6 max-w-[11ch] sm:mt-4 font-display text-[2.3rem] leading-[0.98] font-extrabold tracking-[-0.04em] sm:max-w-[14ch] sm:text-[2.9rem]">
            {job.title}
          </h1>
          <p className="mt-2.5 max-w-[34ch] pr-6 text-[0.98rem] text-muted-foreground sm:pr-24">
            <span className="font-semibold text-foreground tabular-nums">{formatPay(job)}</span> · {job.shift} · Publicada{" "}
            {formatMinutesAgo(job.postedMinutesAgo).toLowerCase()}
          </p>
          <dl className="mt-6 grid grid-cols-3 gap-2.5 sm:gap-3">
            {[
              { label: "Postulantes", value: <CountUp value={applicants.length} from={0} />, rot: "-1.5deg" },
              { label: "A menos de 5 km", value: <CountUp value={within5} from={0} />, rot: "1deg" },
              { label: "El más cercano", value: nearest ? formatKm(nearest.km) : "—", rot: "-1deg" },
            ].map((s, i) => (
              <div
                key={s.label}
                className={cn(
                  "animate-pop-in flex flex-col rounded-tile p-3 sm:p-4",
                  i === 0 ? "bg-ink text-white" : "bg-white text-ink",
                  OUTLINE,
                  HARD_SM,
                )}
                style={{ "--i": i + 2, rotate: s.rot } as CSSVars}
              >
                <dt className={cn("order-2 mt-1 text-[0.8rem] leading-tight font-semibold sm:text-sm", i === 0 ? "text-white/75" : "text-ink/65")}>
                  {s.label}
                </dt>
                <dd
                  className={cn(
                    "order-1 font-display text-[1.5rem] leading-none font-extrabold tracking-[-0.04em] whitespace-nowrap tabular-nums min-[400px]:text-[1.7rem] sm:text-[2.2rem]",
                    i === 0 && "text-limon",
                  )}
                >
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Access — the ONE saturated block: mandarina while locked, violet once unlocked */}
        <section
          className={cn(
            "animate-rise relative isolate flex flex-col overflow-hidden rounded-panel p-6 sm:p-7 lg:col-span-5",
            unlocked ? "block-uva" : "block-mandarina",
            OUTLINE,
            HARD,
          )}
          style={{ "--i": 1 } as CSSVars}
        >
          <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-50" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Eyebrow tone={unlocked ? "lime" : "inverse"}>{unlocked ? "¡Ya quedó!" : "Publicada gratis"}</Eyebrow>
              <h2 className="mt-2 font-display text-[1.75rem] leading-[1.02] font-extrabold tracking-[-0.035em] sm:text-[2rem]">
                {unlocked ? "Postulaciones desbloqueadas" : `${applicants.length} personas quieren esta chamba`}
              </h2>
            </div>
            <div className="relative -mt-2 -mr-2 shrink-0">
              <Mascot mood={unlocked ? "saluda" : "piensa"} prop={unlocked ? "telefono" : "lupa"} size={78} />
              <Padlock open={unlocked} className="absolute -bottom-3 -left-5 size-14" />
            </div>
          </div>

          {unlocked ? (
            <p className="mt-4 text-[1.02rem] leading-relaxed text-muted-foreground">
              Ya puedes ver quién se postuló y escribirle por WhatsApp. Responde en menos de 24 horas para no perder a los
              mejores.
            </p>
          ) : (
            <>
              <p className="mt-4 text-[1.02rem] leading-relaxed">
                {applicants.length} personas quieren este trabajo y {within5} viven a menos de 5 km. Desbloquea la vacante para
                ver quiénes son y contactarlas.
              </p>
              <p className="mt-5 flex items-baseline gap-2">
                <span className="font-display text-[2.6rem] leading-none font-extrabold tracking-[-0.045em] tabular-nums">
                  {formatMXN(UNLOCK_PRICE)}
                </span>
                <span className="text-[0.95rem] font-medium text-muted-foreground">MXN al mes por esta vacante</span>
              </p>
            </>
          )}

          <div className="mt-5 flex items-end gap-3 lg:mt-auto lg:pt-6">
            {unlocked ? (
              <a
                href="#postulantes"
                className={cn(
                  "press inline-flex h-14 flex-1 items-center justify-center gap-2 rounded-full bg-limon px-5 text-[1.02rem] font-bold text-ink outline-none focus-visible:ring-3 focus-visible:ring-white/70",
                  OUTLINE,
                  HARD_SM,
                )}
              >
                <HugeiconsIcon icon={UserGroupIcon} className="size-5" strokeWidth={2.2} />
                Ver postulantes
              </a>
            ) : (
              <Button
                size="xl"
                className={cn("flex-1 px-5 text-[1.02rem] font-bold", INK_BUTTON, HARD_SM)}
                onClick={() => setDialogOpen(true)}
              >
                <HugeiconsIcon icon={SquareUnlock02Icon} className="size-5" strokeWidth={2.2} />
                Desbloquear postulaciones
              </Button>
            )}
          </div>
        </section>

        {/* Applicants */}
        <section id="postulantes" aria-labelledby="postulantes-title" className="scroll-mt-6 lg:col-span-12">
          <SectionLabel
            title={<span id="postulantes-title">Postulantes</span>}
            count={applicants.length}
            className="mt-2 mb-4"
          />
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {applicants.map((a, i) => (
              <li
                key={a.id}
                className={cn(
                  "animate-rise relative flex flex-col overflow-hidden rounded-panel p-4 sm:p-5",
                  BLOCK_CLASS[cardTones[i]],
                  OUTLINE,
                  HARD_SM,
                )}
                style={{ "--i": Math.min(i + 2, 8), rotate: i % 3 === 1 ? "0.6deg" : i % 3 === 2 ? "-0.6deg" : undefined } as CSSVars}
              >
                <div className="flex items-center gap-3">
                  {unlocked ? (
                    <span
                      key="open"
                      className="animate-pop-in grid size-12 shrink-0 place-items-center rounded-full border-2 border-ink bg-white font-display text-[1.05rem] font-extrabold text-ink"
                      style={{ "--i": Math.min(i, 8) } as CSSVars}
                      aria-hidden
                    >
                      {initialsOf(a.name)}
                    </span>
                  ) : (
                    <span
                      key="locked"
                      className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-ink bg-white bg-hatch text-ink"
                      aria-hidden
                    >
                      <HugeiconsIcon icon={LockIcon} className="size-5" strokeWidth={2.2} />
                    </span>
                  )}
                  <span className="min-w-0 flex-1">
                    {unlocked ? (
                      <span
                        key="name"
                        className="animate-pop-in block font-display text-[1.2rem] leading-[1.1] break-words font-extrabold tracking-[-0.02em]"
                        style={{ "--i": Math.min(i, 8) } as CSSVars}
                      >
                        {a.name}
                      </span>
                    ) : (
                      <span key="anon" className="block">
                        <span className="block font-display text-[1.2rem] leading-tight font-extrabold tracking-[-0.02em]">
                          Postulante {i + 1}
                        </span>
                        <span aria-hidden className="mt-1 block h-2.5 w-24 rounded-sm bg-ink/80" />
                      </span>
                    )}
                  </span>
                  <span className="shrink-0 rounded-full border-2 border-ink bg-white py-1 pr-2.5 pl-1 text-ink">
                    <DistanceRing km={a.km} radiusKm={15} size={28} />
                  </span>
                </div>

                <ul className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[0.92rem] text-muted-foreground">
                  <li className="inline-flex items-center gap-1">
                    <HugeiconsIcon icon={Location01Icon} className="size-4" strokeWidth={2} />
                    Col. {a.colonia}
                  </li>
                  <li>{a.experience === "Sin experiencia" ? "Sin experiencia" : `${a.experience} de experiencia`}</li>
                  <li className="inline-flex items-center gap-1">
                    <HugeiconsIcon icon={Clock01Icon} className="size-4" strokeWidth={2} />
                    {formatMinutesAgo(a.minutesAgo).toLowerCase()}
                  </li>
                </ul>

                {unlocked ? (
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      size="lg"
                      className={cn("h-12 px-3", INK_BUTTON)}
                      onClick={() => toast.success(`Abriendo WhatsApp con ${a.name.split(" ")[0]}…`)}
                    >
                      <HugeiconsIcon icon={WhatsappIcon} className="size-5" strokeWidth={2} />
                      WhatsApp
                    </Button>
                    <Button
                      size="lg"
                      className={cn("h-12 px-3", WHITE_BUTTON)}
                      onClick={() => toast.success(`Llamando a ${a.name.split(" ")[0]}…`)}
                    >
                      <HugeiconsIcon icon={CallIcon} className="size-5" strokeWidth={2} />
                      Llamar
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>

          {unlocked ? null : (
            <div className={cn("mt-5 overflow-hidden rounded-panel bg-card", OUTLINE, "dark:border-white/25")}>
              <HazardTape className="block h-4 w-full" />
              <p className="flex items-start gap-3 p-4 text-[0.95rem] leading-relaxed text-muted-foreground sm:p-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-full border-2 border-ink bg-block-sol text-ink">
                  <HugeiconsIcon icon={LockIcon} className="size-4.5" strokeWidth={2.2} />
                </span>
                Nombres y teléfonos se muestran al desbloquear. Las empresas nunca ven la dirección exacta de nadie.
              </p>
            </div>
          )}
        </section>
      </div>

      <UnlockDialog job={job} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
