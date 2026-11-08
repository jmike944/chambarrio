"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Logout03Icon } from "@hugeicons/core-free-icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ApplicationPipeline } from "@/lib/data/types";
import { withdrawApplication } from "@/lib/pipeline";
import { cn } from "@/lib/utils";

/** Withdraw shows while it isn't closed; once hired it reads "Ya no voy a tomar el trabajo". */
export const canWithdrawHere = (p: Pick<ApplicationPipeline, "status">) => p.status !== "cerrada";

/**
 * "Retirar mi postulación" with an AlertDialog confirm. The store rolls back and toasts on error;
 * success is announced only once the server agreed.
 */
export function WithdrawButton({
  p,
  jobTitle,
  companyName,
  className,
}: {
  p: ApplicationPipeline;
  jobTitle?: string | null;
  companyName?: string | null;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  if (!canWithdrawHere(p)) return null;
  const company = companyName ?? "La empresa";
  const hired = p.status === "contratada";

  async function confirm() {
    setBusy(true);
    // The status on screen: if it changed meanwhile (another tab, the company just moved it), nothing
    // is withdrawn and the real state shows instead.
    const r = await withdrawApplication(p.jobId, p.status);
    setBusy(false);
    if (r.error) return;
    if (hired) toast("Le avisamos que ya no vas a tomar el trabajo", { description: `${company} ya lo ve en su lista.` });
    else toast("Retiraste tu postulación", { description: jobTitle ? `${jobTitle} ya no está en proceso.` : undefined });
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          disabled={busy || p.pending}
          className={cn(
            "press inline-flex min-h-11 items-center gap-2 rounded-full px-3 text-[0.92rem] font-semibold text-foreground/75 underline decoration-foreground/30 decoration-2 underline-offset-4 outline-none hover:text-foreground hover:decoration-foreground focus-visible:ring-3 focus-visible:ring-ink/30 disabled:opacity-50",
            className,
          )}
        >
          <HugeiconsIcon icon={Logout03Icon} className="size-4.5" strokeWidth={2.2} />
          {hired ? "Ya no voy a tomar el trabajo" : "Retirar mi postulación"}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="border-2 border-ink shadow-[6px_6px_0_0_var(--ink)]">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-display text-[1.4rem] leading-tight font-extrabold tracking-[-0.02em]">
            {hired ? "¿Ya no vas a tomar el trabajo?" : "¿Retirar tu postulación?"}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-[0.98rem] leading-snug">
            {hired
              ? `Le avisamos a ${company} que ya no vas a tomar el trabajo${jobTitle ? ` de ${jobTitle}` : ""}, así puede buscar a alguien más. No se puede deshacer.`
              : `${company} verá que ya no sigues en el proceso${jobTitle ? ` de ${jobTitle}` : ""}${p.status === "entrevista" ? " y se cancela tu entrevista" : ""}. No se puede deshacer ni volver a postularte a esta vacante.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel size="lg" className="border-2 border-ink">
            Mejor no
          </AlertDialogCancel>
          <AlertDialogAction size="lg" variant="destructive" onClick={confirm} className="border-2 border-ink">
            {hired ? "Sí, avisarles" : "Sí, retirarme"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
