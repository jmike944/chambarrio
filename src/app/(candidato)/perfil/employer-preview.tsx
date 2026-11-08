"use client";

import { useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Building06Icon, Call02Icon, UserIcon } from "@hugeicons/core-free-icons";
import { ApplicantCard } from "@/components/empresa/applicant-card";
import type { ApplicantProfile } from "@/lib/live/applicant-profiles";
import { useOwnFileUrl } from "@/lib/live/profile-files";
import { useApp, useJobsByDistance, useMyAvatar } from "@/lib/store";
import { sortExperiencesByRecency, strengthOf, type WorkExperience } from "@/lib/profile-strength";
import { cn } from "@/lib/utils";
import { HARD } from "../postulaciones/rugged";
import { useStrengthInput, type CSSVars } from "./ui";

/**
 * "Así te ven las empresas": the real employer card (ApplicantCard, candidate view: no padlocks) fed
 * with the candidate's own draft, when they apply and once the company contacts them. Read-only:
 * contact buttons only explain. Candidates never learn that contact depends on the company paying.
 */
export function EmployerPreview({ index }: { index: number }) {
  const [unlocked, setUnlocked] = useState(false);
  const s = useApp(
    useShallow((st) => ({
      mode: st.mode,
      name: st.name,
      phone: st.phone,
      colonia: st.colonia,
      hasHome: st.hasHome,
      experience: st.experience,
      interests: st.interests,
      headline: st.headline,
      about: st.about,
      education: st.education,
      skills: st.skills,
      certifications: st.certifications,
      languages: st.languages,
      shifts: st.shifts,
      availableFrom: st.availableFrom,
      transport: st.transport,
      expectedPay: st.expectedPay,
      expectedPeriod: st.expectedPeriod,
      avatarPath: st.avatarPath,
      cvPath: st.cvPath,
      workExperiences: st.workExperiences,
    })),
  );
  const input = useStrengthInput();
  // What companies see from the start ("Crea tu avatar"); the photo only once unlocked.
  const avatar = useMyAvatar();
  const { url: photoUrl } = useOwnFileUrl("avatar");
  const nearest = useJobsByDistance()[0];
  const demo = s.mode !== "live";

  const applicant = useMemo((): ApplicantProfile => {
    const experiences = sortExperiencesByRecency(s.workExperiences).map(
      (e): WorkExperience => ({
        title: e.title,
        company: e.company,
        category: e.category,
        startMonth: e.startMonth,
        endMonth: e.endMonth,
        isCurrent: e.isCurrent,
        description: e.description,
      }),
    );
    return {
      id: "vista-previa",
      jobId: null,
      status: "enviada",
      colonia: s.hasHome ? s.colonia : "",
      km: nearest ? Math.round(nearest.km * 10) / 10 : null,
      minutesAgo: 0,
      unlocked,
      experience: s.experience,
      interests: s.interests,
      strength: strengthOf(input),
      details: {
        headline: s.headline?.trim() || null,
        about: s.about?.trim() || null,
        education: s.education,
        skills: s.skills,
        certifications: s.certifications,
        languages: s.languages,
        shifts: s.shifts,
        availableFrom: s.availableFrom,
        transport: s.transport,
        expectedPay: s.expectedPay,
        expectedPeriod: s.expectedPeriod,
      },
      experiences,
      hasPhoto: !!s.avatarPath,
      hasCv: !!s.cvPath,
      name: unlocked ? s.name.trim() || "Tu nombre" : null,
      phone: unlocked ? s.phone || null : null,
      photoUrl: unlocked ? photoUrl : null,
      photoArt: avatar,
      cvPath: unlocked ? s.cvPath : null,
      cvUrl: null,
      signedAt: null,
      demo,
    };
  }, [s, input, unlocked, photoUrl, avatar, nearest, demo]);

  /** Read-only: explain the contact buttons instead of dialing yourself. */
  function intercept(e: React.MouseEvent) {
    const el = (e.target as HTMLElement).closest("a, button");
    if (!el || el.closest("summary") || el.closest('[aria-label="Licencias y habilidades"]')) return;
    e.preventDefault();
    e.stopPropagation();
    const text = el.textContent ?? "";
    toast(
      /CV/.test(text) ? "Aquí la empresa abre tu CV" : /SMS/.test(text) ? "Aquí la empresa te manda un SMS" : "Aquí la empresa te llama",
      { description: "Es una vista previa: nadie recibe nada." },
    );
  }

  return (
    <section
      aria-labelledby="vista-t"
      className={cn("relative isolate min-w-0 animate-rise rounded-panel bg-card p-4 text-card-foreground sm:p-6", HARD)}
      style={{ "--i": Math.min(index, 8) } as CSSVars}
    >
      <header className="mb-4 flex items-start gap-3">
        <span aria-hidden className="grid size-10 shrink-0 -rotate-6 place-items-center rounded-xl bg-ink text-white">
          <HugeiconsIcon icon={Building06Icon} className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1 pt-1">
          <h2 id="vista-t" className="font-display text-[1.35rem] leading-tight font-extrabold tracking-[-0.03em]">
            Así te ven las empresas
          </h2>
          <p className="mt-1 text-[0.92rem] leading-snug text-muted-foreground">
            Cuando te postulas, la empresa ve tu avatar y tu perfil. Para cuidar tu privacidad, tu nombre, teléfono, foto y CV se comparten cuando la empresa avanza con tu postulación.
          </p>
        </div>
      </header>

      <div role="radiogroup" aria-label="Estado de la postulación en la vista previa" className="mb-5 grid grid-cols-2 gap-1.5 rounded-full bg-tile p-1.5">
        {[
          { on: false, label: "Al postularte", icon: UserIcon },
          { on: true, label: "Cuando te contactan", icon: Call02Icon },
        ].map((o) => {
          const active = unlocked === o.on;
          return (
            <button
              key={o.label}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setUnlocked(o.on)}
              className={cn(
                "press flex h-11 items-center justify-center gap-1.5 rounded-full text-[0.92rem] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active ? "bg-ink text-white" : "text-foreground hover:bg-card/60",
              )}
            >
              <HugeiconsIcon icon={o.icon} className={cn("size-4", active && "text-limon")} strokeWidth={2.2} />
              {o.label}
            </button>
          );
        })}
      </div>

      {/* The real employer card, framed as "their screen". */}
      <div onClickCapture={intercept} className="relative -mx-1.5 rounded-[1.6rem] border-2 border-dashed border-border p-1 pt-6 sm:mx-0 sm:p-2.5 sm:pt-6">
        <span className="absolute -top-3 left-4 rounded-full bg-ink px-2.5 py-0.5 text-[0.68rem] font-bold tracking-[0.12em] text-white uppercase">
          Tu ficha para la empresa
        </span>
        <ApplicantCard
          key={unlocked ? "abierta" : "cerrada"}
          applicant={applicant}
          tone="sol"
          index={0}
          context={nearest ? `Ej. ${nearest.title}` : undefined}
          category={nearest?.category}
          candidateView
          className="animate-pop-in"
        />
      </div>
      <p className="mt-3 text-center text-[0.82rem] text-muted-foreground">
        {unlocked ? "Con esto la empresa te contacta por SMS o te llama." : "La distancia es a la vacante más cercana a tu casa, como ejemplo."}
      </p>
    </section>
  );
}
