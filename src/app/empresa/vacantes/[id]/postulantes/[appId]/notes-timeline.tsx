"use client";

import { useId, useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, LockIcon, RefreshIcon, Route01Icon, StickyNote01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { FIELD, HARD, OUTLINE } from "@/components/empresa/workwear";
import { STEP_COLOR, ago } from "@/components/empresa/pipeline/pipeline-kit";
import type { ApplicationPipeline, PipelineEvent, RecruiterNote } from "@/lib/data/types";
import { PIPELINE_LIMITS, capitalize, eventChange, fmtDayTime, stepOf, validateNote, type PipelineActions } from "@/lib/pipeline";
import { cn } from "@/lib/utils";
import { MyMascot } from "@/components/chamba/art/my-mascot";

/*
 * The applicant page's private notes (tinta, "Solo tu equipo las ve") and the event timeline.
 */

// ------------------------------------------------------------------ notes

export function NotesPanel({
  notes,
  error,
  onRetry,
  actions,
  now,
  className,
}: {
  notes: RecruiterNote[];
  error?: string;
  onRetry: () => void;
  actions: PipelineActions;
  now: number;
  className?: string;
}) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState<string | null>(null);
  const id = useId();
  const errId = useId();
  const len = body.trim().length;

  async function save() {
    if (busy) return;
    const err = validateNote(body);
    if (err) {
      setInvalid(err);
      return;
    }
    setInvalid(null);
    setBusy(true);
    const r = await actions.addNote(body);
    setBusy(false);
    if (r.error) return;
    setBody("");
    toast.success("Nota guardada.");
  }

  async function remove(noteId: string) {
    const note = notes.find((n) => n.id === noteId);
    const r = await actions.deleteNote(noteId);
    if (r.error) return;
    toast.success("Nota borrada.", {
      duration: 8_000,
      action: note
        ? {
            label: "Deshacer",
            onClick: () =>
              void actions.restoreNote(note).then((u) => {
                if (!u.error) toast.success("Nota recuperada.");
              }),
          }
        : undefined,
    });
  }

  return (
    <section
      aria-labelledby="notas-title"
      className={cn("block-tinta relative flex flex-col overflow-hidden rounded-panel p-5 sm:p-6", OUTLINE, HARD, className)}
    >
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="grid size-10 shrink-0 -rotate-6 place-items-center rounded-xl border-2 border-white/20 bg-block-sol text-ink">
          <HugeiconsIcon icon={StickyNote01Icon} className="size-5" strokeWidth={2} />
        </span>
        <h2 id="notas-title" className="font-display text-[1.3rem] leading-tight font-extrabold tracking-[-0.025em]">
          Notas del equipo
          {notes.length ? <span className="ml-2 align-middle text-[0.9rem] font-bold text-white/60 tabular-nums">{notes.length}</span> : null}
        </h2>
        <span className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-full border-2 border-limon/70 px-2.5 text-[0.8rem] font-bold text-limon">
          <HugeiconsIcon icon={LockIcon} className="size-3.5" strokeWidth={2.4} />
          Solo tu equipo las ve
        </span>
      </header>

      <form
        className="mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <label htmlFor={id} className="sr-only">
          Nueva nota
        </label>
        <textarea
          id={id}
          value={body}
          rows={2}
          onChange={(e) => {
            setBody(e.target.value);
            if (invalid) setInvalid(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void save();
            }
          }}
          placeholder="Lo que hablaron, sus papeles, cuándo llamarle…"
          aria-invalid={invalid ? true : undefined}
          aria-describedby={invalid ? errId : undefined}
          className={cn(FIELD, "block h-auto min-h-20 w-full resize-none py-3 leading-snug field-sizing-content")}
        />
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <span className={cn("text-[0.8rem] font-semibold tabular-nums", len > PIPELINE_LIMITS.noteBody ? "text-[#ff8a6b]" : "text-white/55")}>
            {len > 0 ? `${len}/${PIPELINE_LIMITS.noteBody}` : "La persona no ve tus notas."}
          </span>
          <Button
            type="submit"
            size="lg"
            variant="lime"
            aria-disabled={busy || undefined}
            className={cn("h-11 border-2 border-ink px-5 font-bold", busy && "opacity-80")}
          >
            {busy ? "Guardando…" : "Guardar nota"}
          </Button>
        </div>
        {invalid ? (
          <p id={errId} role="alert" className="mt-2 text-[0.9rem] font-semibold text-[#ff8a6b]">
            {invalid}
          </p>
        ) : null}
      </form>

      {error ? (
        <div role="status" className="mt-4 flex flex-wrap items-center gap-2 rounded-tile border-2 border-dashed border-white/30 p-3">
          <p className="min-w-0 flex-1 text-[0.9rem] leading-snug">No pudimos cargar las notas.</p>
          <Button size="sm" variant="lime" className="h-10 border-2 border-ink px-3" onClick={onRetry}>
            <HugeiconsIcon icon={RefreshIcon} strokeWidth={2.2} />
            Reintentar
          </Button>
        </div>
      ) : null}

      {notes.length ? (
        <ul className="mt-4 space-y-2.5" aria-label="Notas">
          {notes.map((n, i) => (
            <li
              key={n.id}
              className={cn("animate-rise rounded-tile border-2 border-white/12 bg-white/[0.07] p-3.5", n.pending && "opacity-70")}
              style={{ "--i": Math.min(i, 6) } as React.CSSProperties}
            >
              <p className="text-[0.98rem] leading-snug break-words whitespace-pre-line">{n.body}</p>
              <div className="mt-2 flex items-center justify-between gap-2 text-[0.82rem] text-white/60">
                <span>
                  {n.mine ? "Tú" : "Tu equipo"} · {n.pending ? "Guardando…" : now ? ago(n.at, now) : ""}
                </span>
                {n.mine && !n.pending ? (
                  <button
                    type="button"
                    onClick={() => void remove(n.id)}
                    aria-label="Borrar nota"
                    className="press -my-1.5 -mr-1.5 grid size-10 place-items-center rounded-full text-white/70 outline-none hover:bg-white/10 hover:text-white focus-visible:ring-3 focus-visible:ring-white/60"
                  >
                    <HugeiconsIcon icon={Delete02Icon} className="size-4.5" strokeWidth={2} />
                  </button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      ) : error ? null : (
        // Empty: centered in whatever room the column leaves (the panel stretches on desktop).
        <div className="mt-4 flex min-h-40 flex-1 flex-col items-center justify-center rounded-tile border-2 border-dashed border-white/25 px-4 py-5 text-center">
          <MyMascot mood="piensa" prop="lupa" size={84} />
          <p className="mt-2 font-display text-[1.05rem] font-extrabold">Aún no hay notas</p>
          <p className="mt-1 max-w-[17rem] text-[0.9rem] leading-snug text-white/70">
            Apunta lo que te llamó la atención, sus papeles o cuándo llamarle, para decidir con tu equipo.
          </p>
        </div>
      )}

      {/* Bottom line keeps a stretched panel looking finished. */}
      <p className="mt-auto flex items-center gap-2 pt-5 text-[0.82rem] leading-snug text-white/55">
        <HugeiconsIcon icon={LockIcon} className="size-3.5 shrink-0" strokeWidth={2.4} />
        Las notas no salen en su postulación ni en ningún correo.
      </p>
    </section>
  );
}

// ------------------------------------------------------------------ timeline

function eventLabel(e: PipelineEvent, i: number, events: PipelineEvent[], first: string, now: number): string {
  const change = eventChange(events, i);
  if (change === "reabierta") return "Reabriste la postulación";
  switch (e.status) {
    case "enviada":
      return "Se postuló";
    case "vista":
      return "Viste su postulación";
    case "entrevista": {
      const when = e.interviewAt && now ? fmtDayTime(e.interviewAt, { now }) : null;
      if (change === "hora") return `Cambiaste la entrevista${when ? ` a ${when}` : ""}`;
      if (change === "lugar") return "Cambiaste el lugar de la entrevista";
      if (change === "indicaciones") return "Cambiaste las indicaciones de la entrevista";
      return `Agendaste entrevista${when ? ` para ${when}` : ""}`;
    }
    case "contratada":
      if (change === "mensaje") return "Le dejaste un mensaje";
      return first === "esta persona" ? "La contrataste" : `Contrataste a ${first}`;
    case "cerrada": {
      const hiredBefore = events.slice(0, i).findLast((x) => x.status !== "cerrada")?.status === "contratada";
      if (e.actor === "candidato") return hiredBefore ? "Ya no va a tomar el trabajo" : "Retiró su postulación";
      return hiredBefore ? "Cancelaste la contratación" : "La descartaste";
    }
  }
}

export function TimelinePanel({
  data,
  first,
  now,
  className,
}: {
  data: ApplicationPipeline;
  first: string;
  now: number;
  className?: string;
}) {
  const events = data.events;
  return (
    <section aria-labelledby="historial-title" className={cn("block-menta relative overflow-hidden rounded-panel p-5 sm:p-6", OUTLINE, HARD, className)}>
      <header className="mb-4 flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full border-2 border-ink bg-white text-ink">
          <HugeiconsIcon icon={Route01Icon} className="size-5" strokeWidth={2} />
        </span>
        <h2 id="historial-title" className="font-display text-[1.3rem] leading-tight font-extrabold tracking-[-0.025em]">
          Historial
        </h2>
      </header>
      <ol className="relative ml-2 space-y-3.5 border-l-2 border-ink/30 pl-5">
        {events.map((e, i) => {
          const last = i === events.length - 1;
          const step = stepOf({ status: e.status, closedBy: e.status === "cerrada" ? e.actor : null });
          return (
            <li key={`${e.status}-${e.at}-${i}`} className="relative">
              <span
                aria-hidden
                className={cn("absolute top-0.5 -left-[1.95rem] size-4 rounded-full border-2 border-ink", last && "ring-3 ring-ink/20")}
                style={{ background: STEP_COLOR[step] }}
              />
              <p className={cn("text-[0.98rem] leading-snug", last ? "font-bold" : "font-semibold")}>
                {eventLabel(e, i, events, first, now)}
              </p>
              <p className="text-[0.85rem] text-muted-foreground">{now ? capitalize(fmtDayTime(e.at, { now })) : ""}</p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
