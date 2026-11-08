"use client";

import { useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { CalendarAdd01Icon, CheckmarkBadge01Icon, ViewIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { INK_BUTTON } from "@/components/empresa/workwear";
import type { PipelineSummary } from "@/lib/data/types";
import { capitalize, markSeen, stepOf, useNow } from "@/lib/pipeline";
import { useIsUnlocked, usePaymentsEnabled } from "@/lib/store";
import { cn } from "@/lib/utils";
import { HireDialog, InterviewDialog } from "./pipeline-dialogs";
import { interviewDone } from "./pipeline-kit";

/*
 * The one next step on an applicant card: Nueva → "Marcar como vista" (one tap), Vista →
 * "Agendar entrevista", after the interview → "Contratar". Everything else (reschedule, descartar,
 * notes) lives on the applicant page. Null when there's nothing quick to do, and for interview /
 * hire on a vacancy that still has to be unlocked (the applicant page walks through unlocking).
 */

export function hasQuickAction(p: PipelineSummary | null | undefined, now: number): boolean {
  if (!p) return false;
  const step = stepOf(p);
  return step === "enviada" || step === "vista" || (step === "entrevista" && (!p.interviewAt || interviewDone(p, now)));
}

export function PipelineQuickAction({
  summary: p,
  first,
  defaultPlace,
  className,
}: {
  summary: PipelineSummary;
  /** "Jorge" or "esta persona". */
  first: string;
  defaultPlace: string;
  className?: string;
}) {
  const now = useNow();
  const payments = usePaymentsEnabled();
  const isUnlocked = useIsUnlocked();
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<"interview" | "hire" | null>(null);
  if (!hasQuickAction(p, now)) return null;
  const step = stepOf(p);
  if (step !== "enviada" && payments && !isUnlocked(p.jobId)) return null;
  const btn = cn("h-11 w-full px-4 text-[0.95rem] font-bold", INK_BUTTON, className);

  if (step === "enviada") {
    return (
      <Button
        size="lg"
        className={cn(btn, busy && "opacity-80")}
        aria-disabled={busy || p.pending || undefined}
        onClick={async () => {
          if (busy || p.pending) return;
          setBusy(true);
          const r = await markSeen(p.id);
          setBusy(false);
          if (!r.error) toast.success("Marcada como vista.", { description: `${capitalize(first)} ve que ya revisaste su postulación.` });
        }}
      >
        <HugeiconsIcon icon={ViewIcon} className="size-5 text-limon" strokeWidth={2.2} />
        {busy ? "Guardando…" : "Marcar como vista"}
      </Button>
    );
  }

  const hireNow = step === "entrevista" && !!p.interviewAt;
  return (
    <>
      <Button size="lg" className={btn} onClick={() => setDialog(hireNow ? "hire" : "interview")}>
        <HugeiconsIcon icon={hireNow ? CheckmarkBadge01Icon : CalendarAdd01Icon} className="size-5 text-limon" strokeWidth={2.2} />
        {hireNow ? "Contratar" : "Agendar entrevista"}
      </Button>
      <InterviewDialog
        open={dialog === "interview"}
        onOpenChange={(o) => setDialog(o ? "interview" : null)}
        applicationId={p.id}
        first={first}
        defaultPlace={defaultPlace}
      />
      <HireDialog open={dialog === "hire"} onOpenChange={(o) => setDialog(o ? "hire" : null)} applicationId={p.id} first={first} />
    </>
  );
}
