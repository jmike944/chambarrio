"use client";

import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import type { ApplicationPipeline } from "@/lib/data/types";
import { cn } from "@/lib/utils";
import { timelineOf, whenLabel, type CSSVars } from "./model";

/**
 * The application's real timeline on a pastel block: done steps (ink disc + lime check) with their
 * day, the current one as a white ink-outlined ticket, the steps still ahead dashed and quiet.
 */
export function PipelineTimeline({ p, now, className }: { p: ApplicationPipeline; now: number; className?: string }) {
  const rows = timelineOf(p, now);
  const closed = p.status === "cerrada";
  return (
    <ol className={cn("relative", className)} aria-label="Historial de tu postulación">
      {rows.map((r, i) => {
        const next = rows[i + 1];
        const isCurrent = r.state === "current";
        return (
          <li
            key={r.key}
            aria-current={isCurrent ? "step" : undefined}
            className="relative flex animate-rise gap-3 pb-3.5 last:pb-0"
            style={{ "--i": Math.min(i, 8) } as CSSVars}
          >
            {next ? (
              <span
                aria-hidden
                className={cn(
                  "absolute top-10 bottom-0 left-[17px]",
                  next.state === "todo" ? "border-l-2 border-dashed border-ink/30" : "w-[3px] rounded-full bg-ink",
                )}
              />
            ) : null}
            <span
              aria-hidden
              className={cn(
                "relative z-10 mt-0.5 grid size-9 shrink-0 place-items-center rounded-full font-display text-[0.95rem] font-extrabold tabular-nums",
                r.state === "done" && "bg-ink text-limon",
                isCurrent && "border-2 border-ink bg-limon text-ink ring-4 ring-ink/10",
                isCurrent && closed && "bg-white",
                r.state === "todo" && "border-2 border-dashed border-ink/35 bg-hatch text-ink/55",
              )}
            >
              {r.state === "done" ? (
                <HugeiconsIcon icon={Tick02Icon} className="size-[1.1rem]" strokeWidth={3} />
              ) : isCurrent ? (
                closed ? (
                  <HugeiconsIcon icon={Cancel01Icon} className="size-4" strokeWidth={3} />
                ) : (
                  <span className="size-2.5 rounded-full bg-ink" />
                )
              ) : (
                r.n
              )}
            </span>
            <div
              className={cn(
                "min-w-0 flex-1",
                isCurrent
                  ? "rounded-tile border-2 border-ink bg-white px-3 py-2 text-ink shadow-[3px_3px_0_0_var(--ink)]"
                  : "pt-1.5",
              )}
            >
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="sr-only">{r.state === "done" ? "Hecho: " : isCurrent ? "Vas aquí: " : "Falta: "}</span>
                <span className={cn("leading-snug font-semibold", r.state === "todo" && "text-ink/60")}>{r.title}</span>
                {isCurrent ? (
                  <span className="inline-flex h-5 items-center rounded-md bg-ink px-1.5 text-[0.62rem] font-extrabold tracking-[0.12em] text-limon uppercase">
                    {closed ? "Final" : "Vas aquí"}
                  </span>
                ) : null}
              </p>
              {r.at ? (
                <p className={cn("text-[0.85rem] tabular-nums", isCurrent ? "text-ink/70" : "text-muted-foreground")}>
                  <time dateTime={r.at}>{whenLabel(r.at, now)}</time>
                </p>
              ) : null}
              {r.detail ? (
                <p className={cn("mt-0.5 text-[0.88rem] leading-snug", isCurrent ? "font-medium" : "text-muted-foreground")}>{r.detail}</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
