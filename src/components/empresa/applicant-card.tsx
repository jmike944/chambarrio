"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  ArrowDown01Icon,
  ArrowRight01Icon,
  Bicycle01Icon,
  Briefcase01Icon,
  Bus01Icon,
  CallIcon,
  Camera01Icon,
  Car01Icon,
  CheckmarkBadge01Icon,
  Clock01Icon,
  DocumentAttachmentIcon,
  FlashIcon,
  LanguageSkillIcon,
  Location01Icon,
  LockIcon,
  Message01Icon,
  Money01Icon,
  Mortarboard01Icon,
  Motorbike01Icon,
  Route01Icon,
  SmartPhone01Icon,
  UserIcon,
  WalkingIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BLOCK_CLASS, DistanceRing, type BlockTone } from "@/components/chamba/primitives";
import { CategoryIcon } from "@/components/chamba/job-icons";
import { ApplicantAvatar } from "@/components/empresa/applicant-avatar";
import { StrengthMeter, StrengthStamp } from "@/components/empresa/applicant-strength";
import { HARD_SM, INK_BUTTON, OUTLINE, WHITE_BUTTON } from "@/components/empresa/workwear";
import { STEP_ICON, StepChip, stepFor, stepLine } from "@/components/empresa/pipeline/pipeline-kit";
import type { ApplicationStatus, CategoryId, PipelineSummary } from "@/lib/data/types";
import { STEP_META, useNow } from "@/lib/pipeline";
import { openApplicantCv, type ApplicantProfile } from "@/lib/live/applicant-profiles";
import {
  AVAILABILITY_SENTENCE,
  EDUCATION_LABEL,
  TRANSPORT_LABEL,
  experienceRange,
  formatDuration,
  totalExperienceMonths,
  type Transport,
} from "@/lib/profile-strength";
import { formatMinutesAgo, formatMXN, PERIOD_SHORT } from "@/lib/format";
import { formatKm } from "@/lib/geo";
import { cn } from "@/lib/utils";

/*
 * The employer's applicant card (vacancy page + /empresa/candidatos, demo + live).
 * Pastel block, ink outline, hard shadow. Contact (name, phone, photo, CV) only while unlocked;
 * everything else (strength, headline, licenses, skills, availability, history) always.
 * With `pipeline` it shows the hiring step (chip + what's next + one quick action) and links to
 * the full applicant page. The building blocks (ChipList, Facts, History, ContactActions,
 * LockedReveal) are exported for that page.
 */

/** Company-side labels for an application's status ("cerrada" = Descartada; use the pipeline step for "Se retiró"). */
export const STATUS_LABEL: Record<ApplicationStatus, string> = {
  enviada: STEP_META.enviada.recruiterLabel,
  vista: STEP_META.vista.recruiterLabel,
  entrevista: STEP_META.entrevista.recruiterLabel,
  contratada: STEP_META.contratada.recruiterLabel,
  cerrada: STEP_META.descartada.recruiterLabel,
};

const TRANSPORT_ICON: Record<Transport, IconSvgElement> = {
  auto: Car01Icon,
  moto: Motorbike01Icon,
  bici: Bicycle01Icon,
  camion: Bus01Icon,
  caminando: WalkingIcon,
};

/** How many skill / license chips show before "+N". */
const CHIP_LIMIT = 6;

/** sms: / tel: from a stored phone (E.164 digits with or without "+", or 10 local digits). */
function dialable(phone: string | null): string | null {
  const d = phone?.replace(/\D/g, "") ?? "";
  if (d.length === 10) return `+52${d}`;
  return d.length > 10 ? `+${d}` : null;
}

export type ApplicantCardProps = {
  applicant: ApplicantProfile;
  tone: BlockTone;
  /** Position in the list (animation stagger + the anonymous label fallback). */
  index: number;
  /** Line under the name: the vacancy on /empresa/candidatos, the puesto on the demo radar. */
  context?: string;
  /** Category icon next to `context`. */
  category?: CategoryId;
  /** Ring scale for the distance pill (default 15 km). */
  radiusKm?: number;
  /** Extra chips in the meta row (e.g. "Se postuló"). */
  tags?: React.ReactNode;
  /** The pipeline row (step chip with "Se retiró" vs "Descartada", interview time…). */
  pipeline?: PipelineSummary | null;
  /** The full applicant page ("Ver perfil completo"; the name links there too). */
  profileHref?: string;
  /** Called before following `profileHref` (e.g. to remember the list order). */
  onOpenProfile?: () => void;
  /** The next step's quick action (e.g. "Marcar como vista"), above "Ver perfil completo". */
  action?: React.ReactNode;
  /** Extra action after the contact buttons (e.g. "Ver en la vacante"). */
  extraAction?: React.ReactNode;
  className?: string;
};

export function ApplicantCard({
  applicant: a,
  tone,
  index,
  context,
  category,
  radiusKm = 15,
  tags,
  pipeline,
  profileHref,
  onOpenProfile,
  action,
  extraAction,
  className,
}: ApplicantCardProps) {
  const now = useNow();
  // Contact is visible while unlocked (the name may still be missing if they never typed one).
  const open = a.unlocked;
  const name = open ? a.name : null;
  const first = name?.split(" ")[0] ?? "";
  // "Postulante ·" stays together so a wrapped title never starts a line with the dot.
  const title = name ?? (a.colonia ? `Postulante\u00a0· ${a.colonia}` : `Postulante ${index + 1}`);
  const d = a.details;
  const when = a.status
    ? `Se postuló ${formatMinutesAgo(a.minutesAgo).toLowerCase()}`
    : `Activo ${formatMinutesAgo(a.minutesAgo).toLowerCase()}`;
  const titleId = `postulante-${a.id}`;
  const step = stepFor(pipeline ?? (a.status ? { status: a.status } : null));
  const line = pipeline ? stepLine(pipeline, now) : null;

  return (
    <article
      aria-labelledby={titleId}
      className={cn(
        "relative flex h-full flex-col rounded-panel p-4 pt-5 sm:p-5 sm:pt-6",
        BLOCK_CLASS[tone],
        OUTLINE,
        HARD_SM,
        className,
      )}
    >
      {a.strength !== null ? <StrengthStamp value={a.strength} className="absolute -top-4 right-4 z-10" /> : null}

      {/* ------------------------------------------------ header */}
      <div className="flex items-start gap-3">
        <ApplicantAvatar name={name} locked={!open} photoUrl={a.photoUrl} art={a.photoArt} />
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 id={titleId} className="font-display text-[1.22rem] leading-[1.1] font-extrabold tracking-[-0.02em] break-words">
            {profileHref ? (
              <Link
                href={profileHref}
                onClick={onOpenProfile}
                className="rounded-md outline-none decoration-2 underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ink/40"
              >
                {title}
              </Link>
            ) : (
              title
            )}
          </h3>
          {context ? (
            <p className="mt-1 flex items-center gap-1.5 text-[0.92rem] leading-tight font-semibold">
              {category ? <CategoryIcon category={category} size="xs" className="-my-1 shrink-0" /> : null}
              <span className="min-w-0 truncate">{context}</span>
            </p>
          ) : null}
          <p className="mt-1 inline-flex items-center gap-1 text-[0.85rem] text-muted-foreground">
            <HugeiconsIcon icon={Clock01Icon} className="size-3.5" strokeWidth={2.2} />
            {when}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {a.km !== null ? (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full border-2 border-ink bg-white pr-2.5 pl-1 font-display text-[0.9rem] font-bold text-ink [--tile:rgb(22_15_51/0.12)]">
            <DistanceRing km={a.km} radiusKm={radiusKm} size={22} showLabel={false} />
            <span className="sr-only">A </span>
            {formatKm(a.km)}
          </span>
        ) : (
          <span className="inline-flex h-8 items-center rounded-full border-2 border-ink/30 bg-white/50 px-2.5 text-[0.85rem] font-semibold">
            Distancia sin dato
          </span>
        )}
        {step ? <StepChip step={step} pending={pipeline?.pending} /> : null}
        {open && a.colonia ? (
          <span className="inline-flex h-8 items-center gap-1 rounded-full border-2 border-ink/25 bg-white/50 px-2.5 text-[0.85rem] font-semibold">
            <HugeiconsIcon icon={Location01Icon} className="size-3.5" strokeWidth={2.2} />
            Col. {a.colonia}
          </span>
        ) : null}
        {tags}
      </div>

      {/* ------------------------------------------------ strength + headline */}
      {a.strength !== null ? <StrengthMeter value={a.strength} index={index} className="mt-4" /> : null}
      {d.headline ? (
        <p className="mt-3 font-display text-[1.12rem] leading-[1.2] font-bold tracking-[-0.015em] text-balance">{d.headline}</p>
      ) : null}

      <ChipList certifications={d.certifications} skills={d.skills} />
      <Facts applicant={a} />
      <History applicant={a} />

      {d.about ? (
        <Collapsible title="Sobre mí" summary={name ? `Lo que cuenta ${first}` : undefined}>
          <p className="text-[0.95rem] leading-relaxed whitespace-pre-line">{d.about}</p>
        </Collapsible>
      ) : null}

      {/* ------------------------------------------------ contact / locked */}
      <div className="mt-auto pt-4">
        {open ? (
          <ContactActions applicant={a} first={first} />
        ) : (
          <LockedReveal applicant={a} />
        )}

        {!line && action ? <div className="mt-2.5">{action}</div> : null}
        {line ? (
          <div className="mt-2.5 rounded-tile border-2 border-ink bg-white/70 p-2 text-ink dark:bg-white/85">
            {line && step ? (
              <p className="flex items-start gap-2 px-1 py-0.5 text-[0.9rem] leading-snug font-semibold">
                <HugeiconsIcon icon={STEP_ICON[step]} className="mt-0.5 size-4 shrink-0" strokeWidth={2.4} />
                <span className="min-w-0">{line}</span>
              </p>
            ) : null}
            {action ? <div className={cn(line && "mt-2")}>{action}</div> : null}
          </div>
        ) : null}

        {profileHref || extraAction ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {profileHref ? (
              <Button asChild size="lg" className={cn("h-12 flex-1 px-4 text-[0.95rem]", WHITE_BUTTON)}>
                <Link href={profileHref} onClick={onOpenProfile} aria-describedby={titleId}>
                  Ver perfil completo
                  <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" strokeWidth={2.4} />
                </Link>
              </Button>
            ) : null}
            {extraAction}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/** "Al desbloquear verás: Nombre · Teléfono · Foto · CV". */
export function LockedReveal({ applicant: a, children, className }: { applicant: ApplicantProfile; children?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-tile border-2 border-dashed border-ink/40 bg-white/45 p-3", className)}>
      <p className="flex items-center gap-1.5 text-[0.72rem] font-extrabold tracking-[0.12em] uppercase">
        <HugeiconsIcon icon={LockIcon} className="size-3.5" strokeWidth={2.4} />
        Al desbloquear verás
      </p>
      <ul className="mt-2 flex flex-wrap gap-1.5 text-[0.85rem] font-semibold">
        <Reveal icon={UserIcon}>Nombre</Reveal>
        <Reveal icon={SmartPhone01Icon}>Teléfono</Reveal>
        {a.hasPhoto ? <Reveal icon={Camera01Icon}>Foto</Reveal> : null}
        {a.hasCv ? <Reveal icon={DocumentAttachmentIcon}>CV</Reveal> : null}
      </ul>
      {children}
    </div>
  );
}

function Reveal({ icon, children }: { icon: IconSvgElement; children: React.ReactNode }) {
  return (
    <li className="inline-flex h-7 items-center gap-1 rounded-full bg-white/70 px-2.5 text-ink">
      <HugeiconsIcon icon={icon} className="size-3.5" strokeWidth={2.2} />
      {children}
    </li>
  );
}

/* ------------------------------------------------------------------ chips */

export function ChipList({
  certifications,
  skills,
  limit = CHIP_LIMIT,
  className = "mt-3",
}: {
  certifications: string[];
  skills: string[];
  /** Chips before "+N más" (Infinity = all). */
  limit?: number;
  className?: string;
}) {
  const [all, setAll] = useState(false);
  const items = [...certifications.map((label) => ({ label, cert: true })), ...skills.map((label) => ({ label, cert: false }))];
  if (items.length === 0) return null;
  const shown = all ? items : items.slice(0, limit);
  const hidden = items.length - shown.length;
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Licencias y habilidades">
      {shown.map((c) =>
        c.cert ? (
          <li
            key={`c-${c.label}`}
            className="inline-flex min-h-8 items-center gap-1 rounded-lg border-2 border-ink bg-ink py-0.5 pr-2.5 pl-1.5 text-[0.85rem] leading-tight font-bold text-white"
          >
            <HugeiconsIcon icon={CheckmarkBadge01Icon} className="size-4 shrink-0 text-limon" strokeWidth={2.2} />
            <span className="sr-only">Licencia o certificado: </span>
            {c.label}
          </li>
        ) : (
          <li
            key={`s-${c.label}`}
            className="inline-flex min-h-8 items-center rounded-lg border-2 border-ink/25 bg-white/60 px-2.5 py-0.5 text-[0.85rem] leading-tight font-semibold"
          >
            {c.label}
          </li>
        ),
      )}
      {hidden > 0 || all ? (
        <li>
          <button
            type="button"
            onClick={() => setAll((v) => !v)}
            className="press inline-flex min-h-8 items-center rounded-lg border-2 border-dashed border-ink/45 px-2.5 text-[0.85rem] font-bold outline-none hover:bg-white/50 focus-visible:ring-3 focus-visible:ring-ink/40"
          >
            {all ? "Ver menos" : `+${hidden} más`}
          </button>
        </li>
      ) : null}
    </ul>
  );
}

/* ------------------------------------------------------------------ facts */

function Fact({ icon, label, children }: { icon: IconSvgElement; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <dt className="mt-px grid size-7 shrink-0 place-items-center rounded-full border-2 border-ink/80 bg-white text-ink">
        <HugeiconsIcon icon={icon} className="size-3.5" strokeWidth={2.4} />
        <span className="sr-only">{label}</span>
      </dt>
      <dd className="min-w-0 self-center text-[0.93rem] leading-snug">{children}</dd>
    </div>
  );
}

export function Facts({ applicant: a, className }: { applicant: ApplicantProfile; className?: string }) {
  const d = a.details;
  const rows: React.ReactNode[] = [];
  if (d.availableFrom || d.shifts.length) {
    rows.push(
      <Fact key="disp" icon={d.availableFrom === "inmediata" ? FlashIcon : Clock01Icon} label="Disponibilidad">
        {d.availableFrom ? <strong className="font-bold">{AVAILABILITY_SENTENCE[d.availableFrom]}</strong> : null}
        {d.availableFrom && d.shifts.length ? <br /> : null}
        {d.shifts.length ? <span>Turno {d.shifts.join(" · ").toLowerCase()}</span> : null}
      </Fact>,
    );
  }
  if (d.transport.length) {
    rows.push(
      <Fact key="trans" icon={Route01Icon} label="Cómo llega">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          {d.transport.map((t) => (
            <span key={t} className="inline-flex items-center gap-1">
              <HugeiconsIcon icon={TRANSPORT_ICON[t]} className="size-4 shrink-0" strokeWidth={2} aria-hidden />
              {TRANSPORT_LABEL[t]}
            </span>
          ))}
        </span>
      </Fact>,
    );
  }
  if (a.experiences.length === 0) {
    rows.push(
      <Fact key="exp" icon={Briefcase01Icon} label="Experiencia">
        {a.experience === "Sin experiencia" ? "Sin experiencia" : `${a.experience} de experiencia`}
      </Fact>,
    );
  }
  if (d.education) {
    rows.push(
      <Fact key="edu" icon={Mortarboard01Icon} label="Escolaridad">
        {EDUCATION_LABEL[d.education]}
      </Fact>,
    );
  }
  if (d.expectedPay) {
    rows.push(
      <Fact key="pay" icon={Money01Icon} label="Sueldo que busca">
        Busca{" "}
        <strong className="font-bold tabular-nums">
          {formatMXN(d.expectedPay)}
          {d.expectedPeriod ? `/${PERIOD_SHORT[d.expectedPeriod]}` : ""}
        </strong>
      </Fact>,
    );
  }
  if (d.languages.length) {
    rows.push(
      <Fact key="lang" icon={LanguageSkillIcon} label="Idiomas">
        {d.languages.join(" · ")}
      </Fact>,
    );
  }
  const sparse =
    a.strength !== null && rows.length <= 1 && !d.headline && a.details.skills.length + a.details.certifications.length === 0;
  return (
    <>
      <dl className={cn("mt-3 space-y-2 rounded-tile border-2 border-ink/15 bg-white/45 p-3", className)}>{rows}</dl>
      {sparse ? (
        <p className="mt-2 text-[0.85rem] leading-snug text-muted-foreground">Aún no completa su perfil: solo dejó lo básico.</p>
      ) : null}
    </>
  );
}

/* ------------------------------------------------------------------ history */

function Collapsible({ title, summary, children }: { title: string; summary?: string; children: React.ReactNode }) {
  return (
    <details className="group mt-2 rounded-tile border-2 border-ink/15 bg-white/30 open:bg-white/45">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-tile px-3 py-2 outline-none select-none focus-visible:ring-3 focus-visible:ring-ink/40 [&::-webkit-details-marker]:hidden">
        {/* The summary drops under the title on narrow cards instead of being cut off. */}
        <span className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
          <span className="font-display text-[1rem] font-extrabold">{title}</span>
          {summary ? <span className="text-[0.85rem] leading-snug text-muted-foreground">{summary}</span> : null}
        </span>
        <HugeiconsIcon
          icon={ArrowDown01Icon}
          className="size-5 shrink-0 transition-transform duration-200 group-open:rotate-180"
          strokeWidth={2.2}
        />
      </summary>
      <div className="px-3 pt-1 pb-3">{children}</div>
    </details>
  );
}

/** "2 trabajos · 8 años". */
export function historySummary(a: ApplicantProfile): string {
  const months = totalExperienceMonths(a.experiences);
  const jobs = a.experiences.length === 1 ? "1 trabajo" : `${a.experiences.length} trabajos`;
  return months ? `${jobs} · ${formatDuration(months)}` : jobs;
}

/** Work history: collapsible on the card, `bare` (always open, no frame) on the applicant page. */
export function History({ applicant: a, bare }: { applicant: ApplicantProfile; bare?: boolean }) {
  if (a.experiences.length === 0) return null;
  const list = <HistoryList applicant={a} />;
  if (bare) return list;
  return (
    <Collapsible title="Experiencia" summary={historySummary(a)}>
      {list}
    </Collapsible>
  );
}

function HistoryList({ applicant: a }: { applicant: ApplicantProfile }) {
  return (
      <ol className="relative ml-1.5 space-y-3 border-l-2 border-ink/30 pl-4">
        {a.experiences.map((e, i) => (
          <li key={`${e.title}-${e.startMonth ?? i}`} className="relative">
            <span
              aria-hidden
              className={cn(
                "absolute top-1 -left-[1.42rem] size-3 rounded-full border-2 border-ink",
                e.isCurrent ? "bg-ink" : "bg-white",
              )}
            />
            <p className="text-[0.95rem] leading-tight font-bold">{e.title}</p>
            {e.company ? <p className="text-[0.88rem] leading-snug">{e.company}</p> : null}
            {experienceRange(e) ? (
              <p className="text-[0.82rem] font-semibold text-muted-foreground tabular-nums">{experienceRange(e)}</p>
            ) : null}
            {e.description ? <p className="mt-0.5 text-[0.85rem] leading-snug text-muted-foreground">{e.description}</p> : null}
          </li>
        ))}
      </ol>
  );
}

/* ------------------------------------------------------------------ contact */

export function ContactActions({ applicant: a, first, className }: { applicant: ApplicantProfile; first: string; className?: string }) {
  const phone = a.demo ? null : dialable(a.phone);
  const cv = a.hasCv && (a.demo || a.cvPath);
  // Narrow cards (3 per row): the icons step aside so "Llamar" / "Ver CV" never clip.
  const btn = "h-12 gap-1.5 px-2 text-[0.95rem] @min-[17.5rem]:px-3 [&_svg]:@max-[17.5rem]:hidden";
  const sms = a.demo ? (
    <Button size="lg" className={cn(btn, INK_BUTTON)} onClick={() => toast.success(`Abriendo SMS para ${first}…`)}>
      <HugeiconsIcon icon={Message01Icon} className="size-5 text-limon" strokeWidth={2} />
      SMS
    </Button>
  ) : phone ? (
    <Button asChild size="lg" className={cn(btn, INK_BUTTON)}>
      <a href={`sms:${phone}`}>
        <HugeiconsIcon icon={Message01Icon} className="size-5 text-limon" strokeWidth={2} />
        SMS
      </a>
    </Button>
  ) : null;
  const call = a.demo ? (
    <Button size="lg" className={cn(btn, WHITE_BUTTON)} onClick={() => toast.success(`Llamando a ${first}…`)}>
      <HugeiconsIcon icon={CallIcon} className="size-5" strokeWidth={2} />
      Llamar
    </Button>
  ) : phone ? (
    <Button asChild size="lg" className={cn(btn, WHITE_BUTTON)}>
      <a href={`tel:${phone}`}>
        <HugeiconsIcon icon={CallIcon} className="size-5" strokeWidth={2} />
        Llamar
      </a>
    </Button>
  ) : null;
  const cvButton = cv ? (
    <Button
      size="lg"
      className={cn(btn, WHITE_BUTTON)}
      onClick={() => {
        if (a.demo) {
          toast(`CV de ${first}`, {
            description: "En el demo no hay archivos reales. En tu cuenta se abre el PDF que subió.",
          });
          return;
        }
        void openApplicantCv(a).then((r) => {
          if (r.error) toast.error(r.error);
        });
      }}
    >
      <HugeiconsIcon icon={DocumentAttachmentIcon} className="size-5" strokeWidth={2} />
      Ver CV
    </Button>
  ) : null;
  const count = [sms, call, cvButton].filter(Boolean).length;
  if (count === 0) {
    return <p className="text-[0.9rem] text-muted-foreground">No dejó teléfono. Revisa más tarde.</p>;
  }
  return (
    <div className={cn("@container", className)}>
      <div className={cn("grid gap-2", count === 3 ? "grid-cols-3" : count === 2 ? "grid-cols-2" : "grid-cols-1")}>
        {sms}
        {call}
        {cvButton}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ skeleton */

/** Loading placeholder shaped like an ApplicantCard. */
export function ApplicantCardSkeleton({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("rounded-panel border-2 border-ink/10 bg-card p-4 sm:p-5 dark:border-white/10", className)}>
      <div className="flex items-start gap-3">
        <Skeleton className="size-14 rounded-[0.9rem]" />
        <div className="flex-1 space-y-2 pt-1">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3.5 w-1/3" />
        </div>
      </div>
      <div className="mt-3 flex gap-1.5">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-16 rounded-full" />
      </div>
      <Skeleton className="mt-4 h-[1.1rem] w-full rounded-[0.45rem]" />
      <Skeleton className="mt-3 h-5 w-5/6" />
      <div className="mt-3 flex flex-wrap gap-1.5">
        {[24, 16, 20, 14].map((w) => (
          <Skeleton key={w} className="h-8 rounded-lg" style={{ width: `${w * 0.25}rem` }} />
        ))}
      </div>
      <Skeleton className="mt-3 h-24 w-full rounded-tile" />
      <Skeleton className="mt-4 h-12 w-full rounded-full" />
    </div>
  );
}
