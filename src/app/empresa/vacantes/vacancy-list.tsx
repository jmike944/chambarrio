"use client";

import { useState } from "react";
import Link from "next/link";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  ArrowRight01Icon,
  Briefcase01Icon,
  Location01Icon,
  PlusSignIcon,
  SquareUnlock02Icon,
  Store01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { Chip, SectionLabel, BLOCK_CLASS, type BlockTone } from "@/components/chamba/primitives";
import { CountUp } from "@/components/chamba/motion";
import { CategoryArt } from "@/components/chamba/job-icons";
import { AccessTag, HARD, HARD_SM, OUTLINE, TAPPABLE, blockSequence } from "@/components/empresa/workwear";
import { CATEGORY_BY_ID } from "@/lib/data/categories";
import { applicantsFor } from "@/lib/data/applicants";
import { formatMinutesAgo, formatPay } from "@/lib/format";
import { useMyCompany } from "@/lib/data/catalog";
import { EmployerGate } from "@/components/empresa/employer-gate";
import { useEmployerLocations, useIsLive, useIsUnlocked } from "@/lib/store";
import { branchIdOf, coloniaText, useEmployerJobs } from "@/app/empresa/sucursales/branch-kit";
import { cn } from "@/lib/utils";

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

function StatBlock({
  icon,
  value,
  label,
  tone,
  index,
}: {
  icon: IconSvgElement;
  value: number;
  label: string;
  tone: BlockTone;
  index: number;
}) {
  return (
    <div
      className={cn("animate-pop-in min-w-0 rounded-tile px-2.5 py-3 sm:p-4", BLOCK_CLASS[tone], OUTLINE, HARD_SM)}
      style={{ "--i": index + 1, rotate: `${[-1.5, 1, -1][index]}deg` } as CSSVars}
    >
      <span className="grid size-8 place-items-center rounded-full border-2 border-ink bg-white text-ink">
        <HugeiconsIcon icon={icon} className="size-4" strokeWidth={2} />
      </span>
      <p className="mt-2 font-display text-[2.1rem] leading-none font-extrabold tracking-[-0.04em] tabular-nums sm:text-[2.5rem]">
        <CountUp value={value} from={0} />
      </p>
      <p className="mt-1 text-[0.76rem] leading-tight font-semibold tracking-[-0.01em] text-muted-foreground hyphens-auto sm:text-sm">{label}</p>
    </div>
  );
}

export function VacancyList() {
  return <EmployerGate shape="list">{() => <VacancyListBody />}</EmployerGate>;
}

function VacancyListBody() {
  const isUnlocked = useIsUnlocked();
  const live = useIsLive();
  const all = useEmployerJobs();
  const closed = useMyCompany().jobs.filter((j) => j.status === "cerrada");
  // Demo: the mock applicant list; live: the real count per vacancy.
  const countFor = (j: (typeof all)[number]) => (live ? j.applicants : applicantsFor(j.id).length);
  const locations = useEmployerLocations();
  const [filter, setFilter] = useState<string>("all");
  const multi = locations.length > 1;
  // A removed branch (or a single-location business) falls back to "Todas".
  const current = multi ? locations.find((l) => l.id === filter) : undefined;
  const branchOfJob = (j: (typeof all)[number]) => locations.find((l) => l.id === branchIdOf(j, locations));
  const jobs = current ? all.filter((j) => branchIdOf(j, locations) === current.id) : all;
  const tones = blockSequence(jobs.map((j) => j.category));
  const totalApplicants = jobs.reduce((n, j) => n + countFor(j), 0);
  const unlockedCount = jobs.filter((j) => isUnlocked(j.id)).length;

  return (
    // Desktop: fills the column (the page balances it against the left one); the last box grows.
    <div className="space-y-6 lg:flex lg:flex-1 lg:flex-col">
      <div className="grid grid-cols-3 gap-3">
        <StatBlock icon={Briefcase01Icon} value={jobs.length} label="Activas" tone="cielo" index={0} />
        <StatBlock icon={UserGroupIcon} value={totalApplicants} label="Postulantes" tone="limon" index={1} />
        <StatBlock icon={SquareUnlock02Icon} value={unlockedCount} label="Desbloqueadas" tone="durazno" index={2} />
      </div>

      {multi ? (
        <div role="group" aria-label="Filtrar por sucursal" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pt-1 pb-2 lg:mx-0 lg:flex-wrap lg:px-0">
          <Chip active={!current} count={all.length} onClick={() => setFilter("all")}>
            Todas
          </Chip>
          {locations.map((l) => (
            <Chip
              key={l.id}
              active={current?.id === l.id}
              icon={Store01Icon}
              count={all.filter((j) => branchIdOf(j, locations) === l.id).length}
              onClick={() => setFilter(l.id)}
            >
              {l.name}
            </Chip>
          ))}
        </div>
      ) : null}

      <section aria-labelledby="vacantes-activas" className="lg:flex lg:flex-1 lg:flex-col">
        <SectionLabel
          title={<span id="vacantes-activas">{current ? `Activas en ${current.name}` : "Activas"}</span>}
          count={jobs.length}
          className="mb-4"
        />
        {jobs.length === 0 && !current ? (
          <p className="mb-2 rounded-panel border-2 border-dashed border-ink/40 bg-card px-5 py-4 text-[0.95rem] text-muted-foreground dark:border-white/30">
            <strong className="block font-display text-[1.2rem] font-extrabold text-foreground">Publica tu primera vacante</strong>
            Es gratis y le avisamos a la gente que vive cerca de tu sucursal.
          </p>
        ) : jobs.length === 0 ? (
          <p className="mb-2 rounded-panel border-2 border-dashed border-ink/40 bg-card px-5 py-4 text-[0.95rem] text-muted-foreground dark:border-white/30">
            Todavía no hay vacantes en <strong className="font-semibold text-foreground">{current?.name}</strong>. Publica la
            primera y le avisamos a quien vive cerca.
          </p>
        ) : null}
        <ul className="grid lg:flex lg:flex-1 lg:flex-col">
          {jobs.map((j, i) => {
            const unlocked = isUnlocked(j.id);
            const count = countFor(j);
            const tone = tones[i];
            const branch = branchOfJob(j);
            return (
              <li
                key={j.id}
                className={cn("animate-rise relative", i > 0 && "-mt-3")}
                style={{ "--i": Math.min(i + 2, 8), zIndex: i + 1, "--rise": "24px" } as CSSVars}
              >
                <Link
                  href={`/empresa/vacantes/${j.id}`}
                  className={cn(
                    "group relative isolate block overflow-hidden rounded-panel p-5 pr-32 outline-none focus-visible:ring-4 focus-visible:ring-ring/60 sm:p-6 sm:pr-72",
                    BLOCK_CLASS[tone],
                    OUTLINE,
                    HARD,
                    TAPPABLE,
                  )}
                >
                  {/* cartoon art bleeding off the right edge */}
                  <CategoryArt
                    category={j.category}
                    className="pointer-events-none absolute -right-7 -bottom-8 -z-10 size-40 -rotate-6 sm:-right-4 sm:-bottom-12 sm:size-44 transition-transform duration-300 group-hover:-rotate-2 group-hover:scale-105 sm:size-48"
                  />
                  <span aria-hidden className="pointer-events-none absolute inset-0 -z-20 bg-dots opacity-60" />

                  <span className="inline-flex items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 py-0.5 text-[0.72rem] font-extrabold tracking-[0.1em] text-ink uppercase">
                    {CATEGORY_BY_ID[j.category].label}
                  </span>
                  <span className="mt-2.5 block font-display text-[1.55rem] leading-[1.05] font-extrabold tracking-[-0.03em] sm:text-[1.8rem]">
                    {j.title}
                  </span>
                  <span className="mt-1.5 block text-[0.95rem] text-muted-foreground">
                    <span className="font-semibold text-foreground tabular-nums">{formatPay(j)}</span> ·{" "}
                    {formatMinutesAgo(j.postedMinutesAgo)}
                  </span>
                  {branch ? (
                    <span className="mt-1 flex items-center gap-1 text-[0.9rem] font-semibold">
                      <HugeiconsIcon icon={multi ? Store01Icon : Location01Icon} className="size-4 shrink-0" strokeWidth={2.2} />
                      <span className="truncate">{multi ? branch.name : coloniaText(branch)}</span>
                    </span>
                  ) : null}
                  <span className="mt-4 flex flex-wrap items-center gap-2">
                    {j.status === "pausada" ? (
                      <span className="inline-flex h-8 items-center rounded-md border-2 border-ink bg-ink px-2.5 text-[0.72rem] font-extrabold tracking-[0.1em] text-white uppercase">
                        En pausa
                      </span>
                    ) : null}
                    <AccessTag unlocked={unlocked} />
                    <span className="inline-flex h-8 items-center gap-1 rounded-md px-1 text-[0.9rem] font-bold">
                      Ver postulantes
                      <HugeiconsIcon
                        icon={ArrowRight01Icon}
                        className="size-4.5 transition-transform group-hover:translate-x-1"
                        strokeWidth={2.4}
                      />
                    </span>
                  </span>

                  {/* applicant count sticker */}
                  <span
                    className="absolute top-4 right-4 grid size-[4.9rem] sm:top-1/2 sm:right-44 sm:-translate-y-1/2 rotate-[8deg] place-items-center rounded-full border-2 border-ink bg-ink text-center text-white transition-transform duration-300 group-hover:rotate-[-4deg] sm:size-20"
                  >
                    <span className="leading-none">
                      <span className="block font-display text-[1.75rem] font-extrabold tracking-[-0.03em] text-limon tabular-nums">
                        {count}
                      </span>
                      <span className="text-[0.64rem] font-bold">postulantes</span>
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
          <li
            className="animate-rise relative mt-5 lg:flex lg:flex-1 lg:flex-col"
            style={{ "--i": Math.min(jobs.length + 2, 8) } as CSSVars}
          >
            <Link
              href="/empresa/vacantes/nueva"
              className={cn(
                "group flex min-h-20 items-center gap-4 rounded-panel border-2 border-dashed border-ink/60 bg-card px-5 py-4 outline-none focus-visible:ring-4 focus-visible:ring-ring/60 lg:flex-1 dark:border-white/40",
                "press lift",
              )}
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-full border-2 border-ink bg-limon text-ink transition-transform duration-300 group-hover:rotate-90">
                <HugeiconsIcon icon={PlusSignIcon} className="size-6" strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-[1.2rem] leading-tight font-extrabold tracking-[-0.02em]">
                  Publicar otra vacante
                </span>
                <span className="block text-[0.92rem] text-muted-foreground">Gratis, en menos de 2 minutos</span>
              </span>
              <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 shrink-0" strokeWidth={2} />
            </Link>
          </li>
        </ul>
      </section>

      {closed.length ? (
        <section aria-labelledby="vacantes-cerradas">
          <SectionLabel title={<span id="vacantes-cerradas">Cerradas</span>} count={closed.length} className="mb-3" />
          <ul className="grid gap-2">
            {closed.map((j) => (
              <li key={j.id}>
                <Link
                  href={`/empresa/vacantes/${j.id}`}
                  className="press flex min-h-14 items-center gap-3 rounded-tile border-2 border-dashed border-ink/50 bg-card px-4 py-2.5 outline-none hover:bg-tile focus-visible:ring-4 focus-visible:ring-ring/60 dark:border-white/30"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-display text-[1.05rem] font-extrabold">{j.title}</span>
                    <span className="block text-[0.85rem] text-muted-foreground tabular-nums">
                      {j.applicants} postulante{j.applicants === 1 ? "" : "s"} · {formatPay(j)}
                    </span>
                  </span>
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-5 shrink-0" strokeWidth={2} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
