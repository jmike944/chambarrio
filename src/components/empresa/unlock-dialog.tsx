"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useReducedMotion } from "motion/react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { confetti } from "@/components/chamba/motion";
import { Padlock } from "@/components/empresa/padlock";
import { HARD, HARD_SM, INK_BUTTON, OUTLINE, WHITE_BUTTON, WORK_CONFETTI } from "@/components/empresa/workwear";
import { applicantsFor } from "@/lib/data/applicants";
import type { Job } from "@/lib/data/types";
import { formatMXN } from "@/lib/format";
import { UNLOCK_PRICE, useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

/** Confirms paying to see a vacancy's applicants. Demo mode: no charge is made. */
export function UnlockDialog({
  job,
  open,
  onOpenChange,
}: {
  job: Job;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const unlockJob = useApp((s) => s.unlockJob);
  const count = applicantsFor(job.id).length;
  const reduced = useReducedMotion();
  const [unlocking, setUnlocking] = useState(false);
  const lockRef = useRef<HTMLDivElement>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function confirm(e: React.MouseEvent) {
    // Keep the dialog open for the lock → unlock beat, then commit and close.
    e.preventDefault();
    if (unlocking) return;
    setUnlocking(true);
    confetti({ origin: lockRef.current, colors: WORK_CONFETTI, count: 44 });
    timer.current = window.setTimeout(
      () => {
        unlockJob(job.id);
        toast.success(`Postulaciones desbloqueadas. Ya puedes contactar a quienes se postularon a ${job.title}.`);
        onOpenChange(false);
        setUnlocking(false);
      },
      reduced ? 0 : 750,
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className={cn("gap-0 overflow-hidden rounded-panel p-0 ring-0 sm:max-w-md", OUTLINE, HARD, "dark:border-white/25")}
      >
        {/* Saturated header strip with the padlock */}
        <div className="block-mandarina relative isolate flex items-center gap-4 overflow-hidden border-b-2 border-ink px-6 pt-6 pb-5">
          <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-70" />
          <div ref={lockRef} className="shrink-0">
            <Padlock open={unlocking} className="size-16" />
          </div>
          <AlertDialogHeader className="min-w-0 place-items-start text-left">
            <AlertDialogTitle className="font-display text-[1.25rem] leading-[1.08] font-extrabold tracking-[-0.03em] text-ink">
              Desbloquea las postulaciones de {job.title}
            </AlertDialogTitle>
          </AlertDialogHeader>
        </div>

        <div className="grid gap-4 p-6">
          <AlertDialogDescription className="text-left text-[0.98rem] leading-relaxed text-pretty text-muted-foreground">
            {count === 1 ? "1 persona se postuló" : `${count} personas se postularon`}. Al desbloquear ves sus nombres, su
            experiencia y su WhatsApp para contactarlas, incluidas las que se postulen durante el mes.
          </AlertDialogDescription>
          <div className={cn("block-sol rounded-tile p-4", OUTLINE, HARD_SM)}>
            <p className="flex items-baseline gap-2">
              <span className="font-display text-[2.2rem] leading-none font-extrabold tracking-[-0.04em] tabular-nums">
                {formatMXN(UNLOCK_PRICE)}
              </span>
              <span className="font-medium text-muted-foreground">MXN por un mes, más IVA</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Se renueva cada mes mientras la vacante siga publicada. Puedes cancelar cuando quieras.
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-md border-2 border-ink bg-white px-2 py-0.5 text-[0.78rem] font-bold text-ink">
              Modo demo: no se hace ningún cargo.
            </p>
          </div>
          <p className="text-sm text-muted-foreground">
            ¿Contratas seguido?{" "}
            <Link
              href="/empresa/plan"
              className="font-semibold text-foreground underline underline-offset-4"
              onClick={() => onOpenChange(false)}
            >
              Con Pyme desbloqueas hasta 5 vacantes por $1,500 al mes
            </Link>
            .
          </p>
          <AlertDialogFooter className="mt-1 gap-2.5">
            <AlertDialogCancel size="lg" className={cn("h-12", WHITE_BUTTON, "bg-white! text-ink!")} disabled={unlocking}>
              Ahora no
            </AlertDialogCancel>
            <AlertDialogAction
              size="lg"
              className={cn("h-12 font-bold", INK_BUTTON, "bg-ink! text-white!", HARD_SM)}
              aria-disabled={unlocking || undefined}
              onClick={confirm}
            >
              {unlocking ? "¡Abriendo!" : `Pagar ${formatMXN(UNLOCK_PRICE)} y desbloquear`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
