"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowRight01Icon, Calendar03Icon, CheckmarkBadge01Icon, Route01Icon, SparklesIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/components/chamba/motion";
import { ApplicantAvatar } from "@/components/empresa/applicant-avatar";
import { setStepFilter } from "@/components/empresa/applicant-toolbar";
import { INK_BUTTON, WHITE_BUTTON } from "@/components/empresa/workwear";
import { WaitRing } from "@/app/empresa/wait-ring";
import { useMyCompany, type MyJob } from "@/lib/data/catalog";
import type { PipelineSummary } from "@/lib/data/types";
import { useApplicantProfiles, type ApplicantProfile } from "@/lib/live/applicant-profiles";
import {
  MAIN_STEPS,
  capitalize,
  fmtDateLong,
  fmtTime,
  relativeDayWord,
  fmtDate,
  mtyWall,
  upcomingInterviews,
  useNow,
  usePipelineSummary,
  type PipelineStep,
} from "@/lib/pipeline";
import { formatKm } from "@/lib/geo";
import { useTeam } from "@/lib/team";
import { cn } from "@/lib/utils";
import { STEP_COLOR, STEP_FILTER_LABEL, ago, applicantHref, personLabel } from "./pipeline-kit";

/*
 * Dashboard blocks derived from the hiring pipeline (demo + live, all my vacancies):
 *  - <TodayPanel/>  "Para hoy": new applicants not seen yet, upcoming interviews, recent hires.
 *  - <PipelineFunnel/> how many are at each step, with the next thing to do.
 * Rows link to the applicant page; lane links open /empresa/candidatos filtered by that step.
 */

const DAY = 24 * 3_600_000;
const HIRE_WINDOW = 14 * DAY;

type Row = { p: PipelineSummary; a: ApplicantProfile | null; job: MyJob | undefined };

/** Pipeline rows + profiles + vacancies for the dashboards. */
export function useDashboardPipeline() {
  const pipe = usePipelineSummary();
  const my = useMyCompany();
  const now = useNow();
  // Who shows on the panels (statuses come from the one summary query).
  const lanes = useMemo(() => {
    const review = pipe.data.filter((p) => p.status === "enviada").toSorted((x, y) => Date.parse(x.appliedAt) - Date.parse(y.appliedAt));
    const interviews = now ? upcomingInterviews(pipe.data, now) : [];
    const hires = pipe.data
      .filter((p) => p.status === "contratada" && p.hiredAt && (!now || now - Date.parse(p.hiredAt) < HIRE_WINDOW))
      .toSorted((x, y) => Date.parse(y.hiredAt!) - Date.parse(x.hiredAt!));
    return { review, interviews, hires };
  }, [pipe.data, now]);
  // Full profiles (photo, avatar, name) only for the vacancies with someone on the panels, not one
  // RPC + signed links per vacancy on every dashboard load.
  const panelJobs = useMemo(
    () => [...new Set([...lanes.review, ...lanes.interviews, ...lanes.hires].map((p) => p.jobId))],
    [lanes],
  );
  const profiles = useApplicantProfiles(undefined, { detailsFor: panelJobs });
  return useMemo(() => {
    const byId = Object.fromEntries(profiles.applicants.map((a) => [a.id, a]));
    const jobById = Object.fromEntries(my.jobs.map((j) => [j.id, j]));
    const row = (p: PipelineSummary): Row => ({ p, a: byId[p.id] ?? null, job: jobById[p.jobId] });
    const review = lanes.review.map(row);
    const interviews = lanes.interviews.map(row);
    const hires = lanes.hires.map(row);
    const week = now ? pipe.data.filter((p) => now - Date.parse(p.appliedAt) < 7 * DAY).length : 0;
    const month = (t: string | number) => {
      const w = mtyWall(t);
      return w.year * 12 + w.month;
    };
    const hiresThisMonth = now ? pipe.data.filter((p) => p.status === "contratada" && p.hiredAt && month(p.hiredAt) === month(now)).length : 0;
    return {
      loading: pipe.loading || (profiles.status === "loading" && profiles.applicants.length === 0),
      error: pipe.error,
      counts: pipe.counts,
      review,
      interviews,
      hires,
      week,
      hiresThisMonth,
      now,
    };
  }, [pipe.data, pipe.loading, pipe.error, pipe.counts, lanes, profiles.applicants, profiles.status, my.jobs, now]);
}

export type DashboardPipeline = ReturnType<typeof useDashboardPipeline>;

/** Opens /empresa/candidatos filtered by a step. */
function useOpenStep() {
  const router = useRouter();
  return (step: PipelineStep) => {
    setStepFilter("all", step);
    router.push("/empresa/candidatos");
  };
}

// ------------------------------------------------------------------ Para hoy

const MAX_ROWS = { review: 3, interviews: 3, hires: 2 } as const;

export function TodayPanel({ data, className }: { data: DashboardPipeline; className?: string }) {
  const { loading, review, interviews, hires, now } = data;
  const open = useOpenStep();
  const solo = useTeam().members.length <= 1;
  const total = review.length + interviews.filter((r) => r.p.interviewAt && now && relativeDayWord(r.p.interviewAt, now) === "hoy").length;
  return (
    <section
      aria-labelledby="para-hoy"
      className={cn(
        "block-tinta relative flex min-w-0 flex-col overflow-hidden rounded-panel p-5 sm:p-6",
        "border-2 border-ink shadow-[4px_5px_0_0_var(--ink)] dark:border-black/70 dark:shadow-[4px_5px_0_0_rgb(0_0_0/0.55)]",
        className,
      )}
    >
      <header className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 -rotate-6 place-items-center rounded-xl bg-limon text-ink">
          <HugeiconsIcon icon={SparklesIcon} className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="para-hoy" className="flex items-center gap-2 font-display text-[1.4rem] leading-tight font-extrabold tracking-[-0.025em]">
            Para hoy
            {!loading && total > 0 ? (
              <span className="grid h-6 min-w-6 place-items-center rounded-full bg-limon px-1.5 font-sans text-[0.8rem] font-extrabold tracking-normal text-ink tabular-nums">
                {total}
              </span>
            ) : null}
          </h2>
          <p className="text-[0.88rem] text-white/65">{now ? fmtDateLong(now, { now, capitalize: true }) : " "}</p>
        </div>
      </header>

      {loading ? (
        <div role="status" aria-busy="true" className="mt-4 space-y-2">
          <span className="sr-only">Cargando tu día…</span>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 rounded-tile bg-white/10" />
          ))}
        </div>
      ) : (
        // The lanes spread out evenly when the row is taller than the panel's content.
        <div className="mt-4 flex flex-1 flex-col justify-between gap-5">
          <Lane
            step="enviada"
            title="Por revisar"
            count={review.length}
            onAll={() => open("enviada")}
            empty={data.counts.total > 0 ? "¡Al día! Ya revisaste a todos." : "Aún nadie se postula. Aquí verás a cada persona nueva."}
          >
            {review.slice(0, MAX_ROWS.review).map((r, i) => (
              <PersonRow key={r.p.id} row={r} index={i} aside={<WaitRing minutes={Math.max(1, Math.round((now - Date.parse(r.p.appliedAt)) / 60_000))} size={46} index={i + 1} />} />
            ))}
          </Lane>
          <Lane
            step="entrevista"
            // Not only today's: the next ones too (each row says its day).
            title={interviews.length > 0 && interviews.every((r) => now && relativeDayWord(r.p.interviewAt!, now) === "hoy") ? "Entrevistas de hoy" : "Próximas entrevistas"}
            count={interviews.length}
            onAll={() => open("entrevista")}
            empty="Sin entrevistas próximas. Agéndalas desde el perfil de cada postulante."
          >
            {interviews.slice(0, MAX_ROWS.interviews).map((r, i) => (
              <PersonRow
                key={r.p.id}
                row={r}
                index={i}
                // Phones: the day goes in the second line so the name isn't cut; wider: a date block.
                when={`${shortDay(r.p.interviewAt!, now)}, ${fmtTime(r.p.interviewAt!)}`}
                aside={<DayBlock at={r.p.interviewAt!} now={now} className="hidden sm:grid" />}
              />
            ))}
          </Lane>
          <Lane
            step="contratada"
            // A team hires together: "Contrataste" only when it's just me.
            title={solo ? "Contrataste" : "Contrataciones"}
            count={hires.length}
            onAll={() => open("contratada")}
            empty="Cuando contrates a alguien lo verás aquí."
          >
            {hires.slice(0, MAX_ROWS.hires).map((r, i) => (
              <PersonRow
                key={r.p.id}
                row={r}
                index={i}
                aside={
                  <span className="inline-flex h-8 items-center gap-1 rounded-full bg-block-menta px-2.5 text-[0.8rem] font-bold whitespace-nowrap text-ink">
                    <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-4" strokeWidth={2.4} />
                    {now && r.p.hiredAt ? ago(r.p.hiredAt, now) : "Contratada"}
                  </span>
                }
              />
            ))}
          </Lane>
        </div>
      )}
    </section>
  );
}

function Lane({
  step,
  title,
  count,
  onAll,
  empty,
  children,
}: {
  step: PipelineStep;
  title: string;
  count: number;
  onAll: () => void;
  empty: string;
  children: React.ReactNode;
}) {
  const max = step === "contratada" ? MAX_ROWS.hires : step === "entrevista" ? MAX_ROWS.interviews : MAX_ROWS.review;
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-[0.78rem] font-extrabold tracking-[0.12em] text-white/80 uppercase">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: STEP_COLOR[step] }} />
          {title}
          <span className="text-white/55 tabular-nums">{count}</span>
        </h3>
        {count > max ? (
          <button
            type="button"
            onClick={onAll}
            className="inline-flex min-h-9 items-center gap-1 rounded-full px-2 text-[0.85rem] font-bold text-limon underline-offset-4 outline-none hover:underline focus-visible:ring-3 focus-visible:ring-white/60"
          >
            Ver {count}
            <HugeiconsIcon icon={ArrowRight01Icon} className="size-4" strokeWidth={2.4} />
          </button>
        ) : null}
      </div>
      {count === 0 ? (
        <p className="rounded-tile border-2 border-dashed border-white/20 px-3.5 py-3 text-[0.9rem] leading-snug text-white/70">{empty}</p>
      ) : (
        <ul className="space-y-2">{children}</ul>
      )}
    </div>
  );
}

function PersonRow({
  row: { p, a, job },
  index,
  aside,
  when,
}: {
  row: Row;
  index: number;
  aside: React.ReactNode;
  /** Shown before the vacancy on phones (interview day + time). */
  when?: string;
}) {
  const open = !!a?.unlocked;
  return (
    <li className="animate-rise" style={{ "--i": Math.min(index, 6) } as React.CSSProperties}>
      <Link
        href={applicantHref(p.jobId, p.id)}
        className="group press flex items-center gap-3 rounded-tile border-2 border-white/10 bg-white/[0.07] p-2 pr-2.5 outline-none hover:bg-white/[0.12] focus-visible:ring-3 focus-visible:ring-white/70"
      >
        <ApplicantAvatar
          name={open ? (a?.name ?? null) : null}
          locked={!open}
          photoUrl={a?.photoUrl}
          art={a?.photoArt}
          className="size-10 rounded-[0.7rem] shadow-none sm:size-11"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[1rem] leading-snug font-semibold">{a ? personLabel(a) : "Postulante"}</span>
          <span className="block truncate text-[0.85rem] text-white/65">
            {when ? <strong className="font-bold text-limon sm:hidden">{when} · </strong> : null}
            {job?.title ?? "Vacante"}
            {a?.km != null ? ` · ${formatKm(a.km)}` : ""}
          </span>
        </span>
        {aside}
      </Link>
    </li>
  );
}

/** "Hoy" / "Mañana" / "lun 9 nov": short day for chips. */
export function shortDay(at: string, now: number): string {
  const word = now ? relativeDayWord(at, now) : null;
  return word === "hoy" || word === "mañana" ? capitalize(word) : fmtDate(at, { now: now || undefined });
}

/** "Hoy / 10:00 a.m." date block for an interview row. */
function DayBlock({ at, now, className }: { at: string; now: number; className?: string }) {
  const today = !!now && relativeDayWord(at, now) === "hoy";
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-xl border-2 border-ink px-1.5 py-1 text-center leading-tight",
        today ? "bg-limon text-ink" : "bg-white text-ink",
        className,
      )}
    >
      <span className="text-[0.68rem] font-extrabold tracking-[0.05em] whitespace-nowrap uppercase">{shortDay(at, now)}</span>
      <span className="text-[0.85rem] font-bold whitespace-nowrap tabular-nums">{fmtTime(at)}</span>
    </span>
  );
}

// ------------------------------------------------------------------ funnel

const FUNNEL_LABEL: Record<(typeof MAIN_STEPS)[number], string> = {
  enviada: "Nuevos",
  vista: "Vistos",
  entrevista: "Entrevista",
  contratada: "Contratados",
};

/**
 * How many applicants are at each step (all vacancies) + the next thing to do. The bars take the
 * panel's spare height, so it ends level with its neighbour column.
 */
export function PipelineFunnel({ data, className }: { data: DashboardPipeline; className?: string }) {
  const { counts, review, interviews, loading, now } = data;
  const open = useOpenStep();
  const max = Math.max(1, ...MAIN_STEPS.map((s) => counts[s]));
  const next = review[0] ?? null;
  const nextInterview = interviews[0] ?? null;
  return (
    <section
      aria-labelledby="tu-proceso"
      className={cn(
        "block-menta relative flex min-w-0 flex-col overflow-hidden rounded-panel p-5 sm:p-6",
        "border-2 border-ink shadow-[4px_5px_0_0_var(--ink)] dark:border-black/70 dark:shadow-[4px_5px_0_0_rgb(0_0_0/0.55)]",
        className,
      )}
    >
      <header className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-ink bg-white text-ink">
          <HugeiconsIcon icon={Route01Icon} className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h2 id="tu-proceso" className="font-display text-[1.3rem] leading-tight font-extrabold tracking-[-0.025em]">
            Tu proceso de contratación
          </h2>
          <p className="text-[0.88rem] text-muted-foreground">
            {loading ? "Cargando…" : `${counts.active} en proceso · todas tus vacantes`}
          </p>
        </div>
      </header>

      <ol aria-label="Postulantes por etapa" className="mt-5 grid min-h-44 flex-1 grid-cols-4 gap-2.5 sm:gap-4">
        {MAIN_STEPS.map((s, i) => {
          const n = counts[s];
          return (
            <li key={s} className="flex min-w-0 flex-col">
              <button
                type="button"
                onClick={() => open(s)}
                disabled={n === 0}
                aria-label={`${STEP_FILTER_LABEL[s]}: ${n}. Ver en candidatos`}
                className="group press flex min-h-0 flex-1 flex-col justify-end rounded-tile outline-none focus-visible:ring-4 focus-visible:ring-ring/60 disabled:cursor-default"
              >
                <span className="font-display text-[1.9rem] leading-none font-extrabold tracking-[-0.04em] tabular-nums sm:text-[2.3rem]">
                  {loading ? "—" : <CountUp value={n} from={0} />}
                </span>
                <span
                  aria-hidden
                  className="mt-2 block w-full origin-bottom animate-grow rounded-t-[0.7rem] border-2 border-b-0 border-ink transition-[filter] group-enabled:group-hover:brightness-105"
                  style={{ height: `${Math.max(10, (n / max) * 100)}%`, minHeight: 14, background: STEP_COLOR[s], "--i": i } as React.CSSProperties}
                />
              </button>
              <span className="border-t-2 border-ink pt-1.5 text-center text-[0.78rem] leading-tight font-bold sm:text-[0.88rem]">
                {FUNNEL_LABEL[s]}
              </span>
            </li>
          );
        })}
      </ol>
      {counts.descartada + counts.retirada > 0 ? (
        <p className="mt-3 text-[0.88rem] text-muted-foreground">
          {[counts.descartada ? `${counts.descartada} descartad${counts.descartada === 1 ? "o" : "os"}` : null, counts.retirada ? `${counts.retirada} se retir${counts.retirada === 1 ? "ó" : "aron"}` : null]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}

      {/* Next thing to do */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-tile border-2 border-ink bg-white/70 p-3 text-ink dark:bg-white/85">
        <p className="min-w-0 flex-1 basis-56 text-[0.95rem] leading-snug">
          {next ? (
            <>
              <strong className="font-bold">Sigue: revisa a {next.a ? personLabel(next.a) : "tu postulante más antiguo"}.</strong>{" "}
              Espera desde {now ? ago(next.p.appliedAt, now) : "hace rato"}.
            </>
          ) : nextInterview ? (
            <>
              <strong className="font-bold">Sigue: entrevista {now ? relativeDayWord(nextInterview.p.interviewAt!, now) ?? fmtDate(nextInterview.p.interviewAt!, { now }) : ""}</strong>{" "}
              con {nextInterview.a ? personLabel(nextInterview.a) : "tu postulante"}, {fmtTime(nextInterview.p.interviewAt!)}.
            </>
          ) : (
            <strong className="font-bold">Todo al día. Te avisamos cuando alguien se postule.</strong>
          )}
        </p>
        {next || nextInterview ? (
          <Button asChild size="lg" className={cn("h-11 px-4", INK_BUTTON)}>
            <Link href={applicantHref((next ?? nextInterview)!.p.jobId, (next ?? nextInterview)!.p.id)}>
              {next ? "Revisar" : "Ver perfil"}
              <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={2.4} />
            </Link>
          </Button>
        ) : (
          <Button asChild size="lg" className={cn("h-11 px-4", WHITE_BUTTON)}>
            <Link href="/empresa/candidatos">Ver candidatos</Link>
          </Button>
        )}
      </div>
    </section>
  );
}

/** "3 por revisar" chip for a vacancy card (null when none). */
export function ReviewChip({ jobId, data, className }: { jobId: string; data: DashboardPipeline; className?: string }) {
  const n = data.review.filter((r) => r.p.jobId === jobId).length;
  const next = data.interviews.find((r) => r.p.jobId === jobId);
  if (!n && !next) return null;
  return (
    <span className={cn("flex flex-wrap gap-1.5", className)}>
      {n ? (
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full border-2 border-ink bg-ink px-2.5 text-[0.8rem] font-bold text-white tabular-nums">
          <span aria-hidden className="size-2 rounded-full" style={{ background: STEP_COLOR.enviada }} />
          {n} por revisar
        </span>
      ) : null}
      {next?.p.interviewAt ? (
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full border-2 border-ink bg-white px-2.5 text-[0.8rem] font-bold whitespace-nowrap text-ink">
          <HugeiconsIcon icon={Calendar03Icon} className="size-3.5" strokeWidth={2.4} />
          <span className="sr-only">Entrevista </span>
          {shortDay(next.p.interviewAt, data.now)}, {fmtTime(next.p.interviewAt)}
        </span>
      ) : null}
    </span>
  );
}
