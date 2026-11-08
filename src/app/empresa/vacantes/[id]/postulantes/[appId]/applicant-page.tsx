"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ArrowLeft01Icon,
  ArrowRight01Icon,
  Briefcase01Icon,
  Clock01Icon,
  ComingSoon01Icon,
  Location01Icon,
  LockIcon,
  RefreshIcon,
  SquareUnlock02Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DistanceRing, Eyebrow } from "@/components/chamba/primitives";
import { CategoryArt, CategoryIcon } from "@/components/chamba/job-icons";
import { Scene } from "@/components/chamba/art/scenes";
import { EmployerError, EmployerGate } from "@/components/empresa/employer-gate";
import { ApplicantAvatar } from "@/components/empresa/applicant-avatar";
import { StrengthMeter, StrengthStamp } from "@/components/empresa/applicant-strength";
import { ChipList, ContactActions, Facts, History, LockedReveal, historySummary } from "@/components/empresa/applicant-card";
import { defaultSort, sortApplicants, useControlsStore } from "@/components/empresa/applicant-toolbar";
import { UnlockDialog } from "@/components/empresa/unlock-dialog";
import { HARD, HARD_SM, INK_BUTTON, OUTLINE } from "@/components/empresa/workwear";
import { StepChip, ago, applicantHref, personFirst, personLabel, useJobPlace } from "@/components/empresa/pipeline/pipeline-kit";
import type { MyJob } from "@/lib/data/catalog";
import type { ApplicationPipeline, RecruiterNote } from "@/lib/data/types";
import { useApplicantProfiles, type ApplicantProfile } from "@/lib/live/applicant-profiles";
import { stepOf, useApplicationPipeline, useNow, usePipelineSummary } from "@/lib/pipeline";
import { formatKm } from "@/lib/geo";
import { useApp, useIsUnlocked, usePaymentsEnabled } from "@/lib/store";
import { cn } from "@/lib/utils";
import { PipelineCard } from "./pipeline-card";
import { NotesPanel, TimelinePanel } from "./notes-timeline";

/*
 * /empresa/vacantes/[id]/postulantes/[appId] — one applicant, end to end (demo + live):
 *   header (who, distance, strength, step, contact or what unlocking reveals) · full profile ·
 *   the pipeline block (status + every action) · timeline · private notes · prev / next.
 * Mobile order: header → pipeline → profile → timeline → notes. Desktop: two columns that end on
 * the same line (the profile and the notes stretch).
 */

export function ApplicantPage({ jobId, applicationId }: { jobId: string; applicationId: string }) {
  return (
    <div className="pt-6 lg:pt-10">
      <EmployerGate shape="detail">{(my) => <ApplicantBody jobId={jobId} applicationId={applicationId} jobs={my.jobs} />}</EmployerGate>
    </div>
  );
}

function ApplicantBody({ jobId, applicationId, jobs }: { jobId: string; applicationId: string; jobs: MyJob[] }) {
  const pipeline = useApplicationPipeline(applicationId);
  const { data } = pipeline;
  // The application decides which vacancy it belongs to (a hand-edited URL can't mix them up).
  const realJobId = data?.jobId ?? jobId;
  const job = pipeline.job ?? jobs.find((j) => j.id === realJobId) ?? null;
  const profiles = useApplicantProfiles(realJobId);
  const summary = usePipelineSummary(realJobId);
  const profile = profiles.applicants.find((a) => a.id === applicationId) ?? null;
  const now = useNow(30_000);

  if (pipeline.loading || (!data && !pipeline.notFound && !pipeline.error) || (profiles.status === "loading" && !profile)) {
    return <ApplicantSkeleton />;
  }
  if (!data) {
    return pipeline.notFound ? (
      <ApplicantNotFound jobId={job ? realJobId : null} />
    ) : (
      <>
        <BackLink href={job ? `/empresa/vacantes/${realJobId}#postulantes` : "/empresa/candidatos"} label={job?.title ?? "Candidatos"} />
        <EmployerError className="mt-4" message={pipeline.error} onRetry={() => void pipeline.refresh()} />
      </>
    );
  }
  return (
    <ApplicantView
      data={data}
      job={job}
      profile={profile}
      order={profiles.applicants}
      stepById={summary.byId}
      pipeline={pipeline}
      profilesError={profiles.status === "error" ? profiles.error : undefined}
      reloadProfiles={profiles.reload}
      now={now}
    />
  );
}

function ApplicantView({
  data,
  job,
  profile,
  order,
  stepById,
  pipeline,
  profilesError,
  reloadProfiles,
  now,
}: {
  data: ApplicationPipeline;
  job: MyJob | null;
  profile: ApplicantProfile | null;
  order: ApplicantProfile[];
  stepById: ReturnType<typeof usePipelineSummary>["byId"];
  pipeline: ReturnType<typeof useApplicationPipeline>;
  profilesError?: string;
  reloadProfiles: () => void;
  now: number;
}) {
  const jobId = data.jobId;
  const { branch, companyName, defaultPlace } = useJobPlace(job);
  const first = personFirst(profile);
  const label = personLabel(profile);
  const payments = usePaymentsEnabled();
  const isUnlocked = useIsUnlocked();
  const [unlockOpen, setUnlockOpen] = useState(false);
  // Locked = unlocking exists (payments on) and this vacancy isn't unlocked yet. Without payments
  // (live today) nothing is gated: the header says "Desbloquear llega muy pronto".
  const locked = payments && !!job && !(profile ? profile.unlocked : isUnlocked(job.id));
  /** What the person wanted to do when the unlock dialog opened (interview / hire); runs once unlocked. */
  const afterUnlock = useRef<(() => void) | null>(null);
  const openUnlock = (then?: () => void) => {
    afterUnlock.current = then ?? null;
    setUnlockOpen(true);
  };
  useEffect(() => {
    if (locked || !afterUnlock.current) return;
    const then = afterUnlock.current;
    afterUnlock.current = null;
    then();
  }, [locked]);

  // Pages stay mounted after navigating away; don't come back to an open dialog.
  useLayoutEffect(() => () => setUnlockOpen(false), []);

  // Opening a new application is seeing it: no extra "Marcar como vista" tap (once per application;
  // a failed write leaves the button on the card).
  const { markSeen } = pipeline.actions;
  const seenFor = useRef<string | null>(null);
  useEffect(() => {
    if (data.status !== "enviada" || data.pending || seenFor.current === data.id) return;
    seenFor.current = data.id;
    void markSeen();
  }, [data.id, data.status, data.pending, markSeen]);
  const businessPhone = useApp((s) => s.business?.phone ?? null);
  const noPhone = !!job && !job.phone?.trim() && !businessPhone?.trim();

  // Prev / next: the order the vacancy list showed when this card was opened, else the list's order.
  const snapshot = useControlsStore((s) => s.orders[jobId]);
  const scopeSort = useControlsStore((s) => s.scopes[jobId]?.sort ?? null);
  const ids = useMemo(() => {
    if (snapshot?.includes(data.id)) return snapshot;
    const stepOfA = (a: ApplicantProfile) => (stepById[a.id] ? stepOf(stepById[a.id]) : null);
    const sort = scopeSort === "completos" && !order.some((a) => a.strength !== null) ? defaultSort(order) : (scopeSort ?? defaultSort(order));
    return sortApplicants(order, sort, stepOfA).map((a) => a.id);
  }, [snapshot, data.id, order, stepById, scopeSort]);
  const pos = ids.indexOf(data.id);
  const prev = pos > 0 ? ids[pos - 1] : null;
  const nextId = pos >= 0 && pos < ids.length - 1 ? ids[pos + 1] : null;
  const timelineLeft = timelineGoesLeft(profile, data, pipeline.notes);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <BackLink href={`/empresa/vacantes/${jobId}#postulantes`} label={job?.title ?? "Postulantes"} />
        {ids.length > 1 && pos >= 0 ? <Pager jobId={jobId} prev={prev} next={nextId} pos={pos} total={ids.length} /> : null}
      </div>

      {profilesError && !profile ? (
        <div role="status" className={cn("block-durazno mt-4 flex flex-wrap items-center gap-3 rounded-tile p-3 pl-4", OUTLINE, HARD_SM)}>
          <p className="min-w-0 flex-1 text-[0.92rem] font-semibold">No pudimos cargar su perfil. Su proceso sí está aquí.</p>
          <Button size="sm" className={cn("h-10 px-3.5", INK_BUTTON)} onClick={reloadProfiles}>
            <HugeiconsIcon icon={RefreshIcon} strokeWidth={2.2} />
            Reintentar
          </Button>
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        {/* Left column (desktop). On phones the panels interleave via `order`. The timeline goes to
            whichever desktop column is lighter, so both end on the same line with little stretch. */}
        <div className="contents lg:col-span-7 lg:flex lg:flex-col lg:gap-6">
          <HeaderCard
            className="order-1"
            data={data}
            job={job}
            profile={profile}
            label={label}
            first={first}
            now={now}
            onUnlock={payments ? () => openUnlock() : null}
          />
          <ProfilePanel className="order-3 lg:flex-1" profile={profile} first={first} job={job} />
          {timelineLeft ? <TimelinePanel className="order-4" data={data} first={first} now={now} /> : null}
        </div>
        <div className="contents lg:col-span-5 lg:flex lg:flex-col lg:gap-6">
          <PipelineCard
            className="order-2"
            data={data}
            first={first}
            defaultPlace={defaultPlace}
            branch={branch}
            companyName={companyName}
            actions={pipeline.actions}
            now={now}
            onLocked={locked ? openUnlock : null}
            noPhone={noPhone}
          />
          {timelineLeft ? null : <TimelinePanel className="order-4" data={data} first={first} now={now} />}
          <NotesPanel
            className="order-5 lg:flex-1"
            notes={pipeline.notes}
            error={pipeline.notesError}
            onRetry={() => void pipeline.refresh()}
            actions={pipeline.actions}
            now={now}
          />
        </div>
      </div>

      {payments && job ? <UnlockDialog job={job} count={order.length} open={unlockOpen} onOpenChange={setUnlockOpen} /> : null}
    </>
  );
}

/**
 * Rough desktop heights (px) of both columns without the timeline: it joins the shorter one.
 * Deterministic (no measuring, no flicker); being off by a little only means a little stretch.
 */
function timelineGoesLeft(a: ApplicantProfile | null, data: ApplicationPipeline, notes: RecruiterNote[]): boolean {
  const d = a?.details;
  let profile = 200;
  if (d) {
    if (d.about) profile += 60 + d.about.length * 0.43;
    const chips = d.certifications.length + d.skills.length;
    if (chips) profile += 60 + Math.ceil(chips / 3) * 40;
    const facts = [d.availableFrom || d.shifts.length, d.transport.length, a.experiences.length === 0, d.education, d.expectedPay, d.languages.length].filter(Boolean).length;
    profile += 70 + Math.ceil(facts / 2) * 58;
    if (a.experiences.length) profile += 70 + a.experiences.length * 92;
  }
  const header = 420 + (d?.headline ? 40 : 0);
  const step = stepOf(data);
  let pipeline = 380;
  if (data.interview) pipeline += step === "entrevista" ? 330 : 250;
  if (data.companyMessage && step !== "retirada") pipeline += 90 + data.companyMessage.length * 0.3;
  pipeline += step === "enviada" ? 190 : step === "vista" ? 130 : step === "entrevista" ? 130 : step === "descartada" ? 70 : step === "contratada" ? 60 : 110;
  const noteList = notes.length ? notes.reduce((n, x) => n + 80 + x.body.length * 0.3, 0) : 230;
  const right = pipeline + 300 + noteList;
  return header + profile < right;
}

// ------------------------------------------------------------------ top bar

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "press inline-flex h-11 max-w-full min-w-0 items-center gap-1.5 rounded-full bg-card pr-4 pl-2.5 text-[0.95rem] font-semibold outline-none hover:-translate-x-0.5 focus-visible:ring-3 focus-visible:ring-ring/50",
        OUTLINE,
        "dark:border-white/30",
      )}
    >
      <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5 shrink-0" strokeWidth={2.2} />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function Pager({ jobId, prev, next, pos, total }: { jobId: string; prev: string | null; next: string | null; pos: number; total: number }) {
  const router = useRouter();
  // ← / → between applicants (not while typing or with a dialog open).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.metaKey || e.ctrlKey || e.shiftKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true], [role=dialog], [role=radiogroup], [role=group]")) return;
      if (document.querySelector("[role=dialog]")) return;
      const to = e.key === "ArrowLeft" ? prev : e.key === "ArrowRight" ? next : null;
      if (to) router.push(applicantHref(jobId, to));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, jobId, prev, next]);

  const btn = cn(
    "press grid size-11 place-items-center rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
    "aria-disabled:pointer-events-none aria-disabled:opacity-35",
  );
  return (
    <nav aria-label="Otros postulantes" className={cn("inline-flex items-center gap-1 rounded-full bg-card p-1", OUTLINE, HARD_SM, "dark:border-black/70")}>
      {prev ? (
        <Link href={applicantHref(jobId, prev)} aria-label="Postulante anterior" className={cn(btn, "hover:bg-tile")}>
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" strokeWidth={2.4} />
        </Link>
      ) : (
        <span aria-disabled className={btn}>
          <HugeiconsIcon icon={ArrowLeft01Icon} className="size-5" strokeWidth={2.4} />
        </span>
      )}
      <span className="min-w-14 px-1 text-center text-[0.9rem] font-bold tabular-nums">
        {pos + 1} de {total}
      </span>
      {next ? (
        <Link href={applicantHref(jobId, next)} aria-label="Siguiente postulante" className={cn(btn, "bg-ink text-white hover:bg-ink/90 dark:bg-white dark:text-ink")}>
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" strokeWidth={2.4} />
        </Link>
      ) : (
        <span aria-disabled className={btn}>
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" strokeWidth={2.4} />
        </span>
      )}
    </nav>
  );
}

// ------------------------------------------------------------------ header

function HeaderCard({
  data,
  job,
  profile: a,
  label,
  first,
  now,
  onUnlock,
  className,
}: {
  data: ApplicationPipeline;
  job: MyJob | null;
  profile: ApplicantProfile | null;
  label: string;
  first: string;
  now: number;
  /** Opens the unlock dialog (demo); null = payments not available yet. */
  onUnlock: (() => void) | null;
  className?: string;
}) {
  const step = stepOf(data);
  const open = !!a?.unlocked;
  return (
    <section
      aria-labelledby="postulante-title"
      className={cn("block-sol relative isolate rounded-panel p-5 pt-6 sm:p-7", OUTLINE, HARD, className)}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-[inherit]">
        <span className="absolute inset-y-0 right-0 w-1/2 bg-dots opacity-50 [mask-image:linear-gradient(to_left,black,transparent)]" />
      </span>
      {a?.strength != null ? <StrengthStamp value={a.strength} className="absolute -top-4 right-5 z-10" /> : null}

      <div className="flex items-start gap-4">
        <ApplicantAvatar
          name={open ? a?.name ?? null : null}
          locked={!open}
          photoUrl={a?.photoUrl}
          art={a?.photoArt}
          className="size-20 rounded-[1.1rem] shadow-[3px_4px_0_0_var(--ink)] sm:size-24"
        />
        <div className="min-w-0 flex-1 pt-1">
          <Eyebrow>{job ? `Postulante · ${job.title}` : "Postulante"}</Eyebrow>
          <h1
            id="postulante-title"
            className="mt-1 font-display text-[1.85rem] leading-[1.02] font-extrabold tracking-[-0.035em] break-words sm:text-[2.3rem]"
          >
            {label}
          </h1>
          <p className="mt-1.5 inline-flex items-center gap-1.5 text-[0.92rem] text-muted-foreground">
            <HugeiconsIcon icon={Clock01Icon} className="size-4 shrink-0" strokeWidth={2.2} />
            Se postuló {now ? ago(data.appliedAt, now) : ""}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-1.5">
        <StepChip step={step} pending={data.pending} />
        {a?.km != null ? (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full border-2 border-ink bg-white pr-2.5 pl-1 font-display text-[0.9rem] font-bold text-ink [--tile:rgb(22_15_51/0.12)]">
            <DistanceRing km={a.km} radiusKm={15} size={22} showLabel={false} />
            <span className="sr-only">Vive a </span>
            {formatKm(a.km)}
            <span className="font-sans text-[0.8rem] font-semibold text-ink/60">de tu sucursal</span>
          </span>
        ) : null}
        {a?.colonia ? (
          <span className="inline-flex h-8 items-center gap-1 rounded-full border-2 border-ink/25 bg-white/50 px-2.5 text-[0.85rem] font-semibold">
            <HugeiconsIcon icon={Location01Icon} className="size-3.5" strokeWidth={2.2} />
            Col. {a.colonia}
          </span>
        ) : null}
        {a ? (
          <span className="inline-flex h-8 items-center gap-1 rounded-full border-2 border-ink/25 bg-white/50 px-2.5 text-[0.85rem] font-semibold">
            <HugeiconsIcon icon={Briefcase01Icon} className="size-3.5" strokeWidth={2.2} />
            {a.experiences.length ? historySummary(a) : a.experience === "Sin experiencia" ? "Sin experiencia" : `${a.experience} de experiencia`}
          </span>
        ) : null}
      </div>

      {a?.strength != null ? <StrengthMeter value={a.strength} index={0} className="mt-4" /> : null}
      {a?.details.headline ? (
        <p className="mt-3 font-display text-[1.2rem] leading-[1.2] font-bold tracking-[-0.015em] text-balance">{a.details.headline}</p>
      ) : null}

      <div className="mt-5">
        {a && open ? (
          <ContactActions applicant={a} first={first === "esta persona" ? "esta persona" : first} />
        ) : a && step === "retirada" ? (
          // Nothing to unlock for someone who left: no paying to contact them.
          <p className="flex items-start gap-2 rounded-tile border-2 border-dashed border-ink/35 bg-white/55 px-3.5 py-3 text-[0.92rem] leading-snug">
            <HugeiconsIcon icon={LockIcon} className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} />
            Se retiró de esta vacante, así que su nombre y su contacto se quedan ocultos.
          </p>
        ) : a ? (
          <LockedReveal applicant={a} className="bg-white/55">
            <p className="mt-2.5 text-[0.88rem] leading-snug">
              Ya ves su experiencia, licencias y disponibilidad. Desbloquea la vacante para ver quién es y llamarle o mandarle SMS.
            </p>
            {onUnlock ? (
              <Button size="lg" className={cn("mt-3 h-12 w-full px-4 font-bold sm:w-auto", INK_BUTTON, HARD_SM)} onClick={onUnlock}>
                <HugeiconsIcon icon={SquareUnlock02Icon} className="size-5" strokeWidth={2.2} />
                Desbloquear contacto
              </Button>
            ) : (
              <p className="mt-2.5 inline-flex items-start gap-2 rounded-lg border-2 border-ink bg-white px-2.5 py-1.5 text-[0.85rem] leading-snug font-semibold text-ink">
                <HugeiconsIcon icon={ComingSoon01Icon} className="mt-0.5 size-4 shrink-0" strokeWidth={2.2} />
                Desbloquear llega muy pronto. Mientras, agenda la entrevista: la persona la ve en su postulación.
              </p>
            )}
          </LockedReveal>
        ) : null}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ profile

function Section({ title, aside, children }: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="border-t-2 border-dashed border-ink/20 pt-4 first:border-t-0 first:pt-0">
      <h3 className="mb-2.5 flex flex-wrap items-baseline gap-x-2 font-display text-[1.12rem] font-extrabold tracking-[-0.015em]">
        {title}
        {aside ? <span className="font-sans text-[0.85rem] font-semibold tracking-normal text-muted-foreground">{aside}</span> : null}
      </h3>
      {children}
    </section>
  );
}

function ProfilePanel({
  profile: a,
  first,
  job,
  className,
}: {
  profile: ApplicantProfile | null;
  first: string;
  job: MyJob | null;
  className?: string;
}) {
  const d = a?.details;
  const chips = d ? d.certifications.length + d.skills.length : 0;
  const sparse = !!a && !d?.about && chips === 0 && a.experiences.length === 0 && !d?.headline;
  return (
    <section
      aria-labelledby="perfil-title"
      className={cn("block-cielo relative isolate flex flex-col overflow-hidden rounded-panel p-5 sm:p-7", OUTLINE, HARD, className)}
    >
      {/* Category art in the corner: on-brand, and fills the panel when the column stretches. */}
      {job ? (
        <CategoryArt
          category={job.category}
          className="pointer-events-none absolute -right-6 -bottom-8 -z-10 size-36 rotate-[-8deg] opacity-90 sm:size-44"
        />
      ) : null}
      <header className="mb-4 flex items-center gap-3">
        {job ? (
          <CategoryIcon category={job.category} size="sm" />
        ) : (
          <span className="grid size-10 place-items-center rounded-full border-2 border-ink bg-white text-ink">
            <HugeiconsIcon icon={UserIcon} className="size-5" strokeWidth={2} />
          </span>
        )}
        <h2 id="perfil-title" className="font-display text-[1.4rem] leading-tight font-extrabold tracking-[-0.025em]">
          Perfil completo
        </h2>
      </header>

      {!a || !d ? (
        <p className="text-[0.98rem] text-muted-foreground">Su perfil no está disponible por ahora.</p>
      ) : (
        <div className="space-y-4 pb-16 sm:pb-20">
          {d.about ? (
            <Section title="Sobre mí" aside={first !== "esta persona" ? `Lo que cuenta ${first}` : undefined}>
              <p className="text-[1rem] leading-relaxed whitespace-pre-line">{d.about}</p>
            </Section>
          ) : null}
          {chips ? (
            <Section title="Licencias y habilidades">
              <ChipList certifications={d.certifications} skills={d.skills} limit={Infinity} className="" />
            </Section>
          ) : null}
          <Section title="Disponibilidad y datos">
            <Facts applicant={a} className="mt-0 grid gap-x-4 gap-y-2.5 space-y-0 sm:grid-cols-2" />
          </Section>
          {a.experiences.length ? (
            <Section title="Experiencia" aside={historySummary(a)}>
              <div className="rounded-tile border-2 border-ink/15 bg-white/45 p-3.5">
                <History applicant={a} bare />
              </div>
            </Section>
          ) : null}
          {sparse ? (
            <p className="rounded-tile border-2 border-dashed border-ink/30 p-3.5 text-[0.95rem] leading-snug">
              Aún no completa su perfil: solo dejó lo básico. En la entrevista pregúntale por su experiencia.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ states

function ApplicantNotFound({ jobId }: { jobId: string | null }) {
  return (
    <>
      <BackLink href={jobId ? `/empresa/vacantes/${jobId}#postulantes` : "/empresa/candidatos"} label={jobId ? "Postulantes" : "Candidatos"} />
      <section className={cn("mt-4 flex flex-col items-center rounded-panel bg-card p-8 text-center", OUTLINE, HARD, "dark:border-white/25")}>
        <Scene name="vacio" className="w-52" />
        <h1 className="mt-3 font-display text-[1.6rem] leading-tight font-extrabold tracking-[-0.03em]">No encontramos esta postulación</h1>
        <p className="mt-1.5 max-w-sm text-muted-foreground">
          Puede que el enlace esté mal o que no sea de una de tus vacantes. Revisa tu lista de candidatos.
        </p>
        <Button asChild size="lg" className={cn("mt-5", INK_BUTTON, HARD_SM)}>
          <Link href="/empresa/candidatos">Ver candidatos</Link>
        </Button>
      </section>
    </>
  );
}

function ApplicantSkeleton() {
  const SK = "rounded-panel border-2 border-ink/10 dark:border-white/10";
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <span className="sr-only">Cargando postulante…</span>
      <div className="flex justify-between gap-3">
        <Skeleton className="h-11 w-40 rounded-full" />
        <Skeleton className="h-13 w-36 rounded-full" />
      </div>
      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-6">
        <div className="space-y-5 lg:col-span-7 lg:space-y-6">
          <Skeleton className={cn("h-72", SK)} />
          <Skeleton className={cn("h-96", SK)} />
        </div>
        <div className="space-y-5 lg:col-span-5 lg:space-y-6">
          <Skeleton className={cn("h-96", SK)} />
          <Skeleton className={cn("h-48", SK)} />
          <Skeleton className={cn("h-24", SK)} />
        </div>
      </div>
    </div>
  );
}
