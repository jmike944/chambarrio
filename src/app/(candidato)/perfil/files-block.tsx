"use client";

import { useRef, useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Camera01Icon, Delete02Icon, LockIcon, Pdf01Icon, Upload04Icon, ViewIcon } from "@hugeicons/core-free-icons";
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
import type { BlockTone } from "@/components/chamba/primitives";
import {
  AVATAR_ACCEPT,
  CV_ACCEPT,
  openOwnCv,
  removeProfileFile,
  uploadAvatar,
  uploadCv,
  useOwnFileUrl,
  type FileKind,
  type UploadStage,
} from "@/lib/live/profile-files";
import { useApp } from "@/lib/store";
import { STRENGTH_WEIGHTS } from "@/lib/profile-strength";
import { cn } from "@/lib/utils";
import { HARD_SM } from "../postulaciones/rugged";
import { Block, INK_BTN, markEdited, PointsBadge, WHITE_BTN } from "./ui";

type Progress = { stage: UploadStage; pct: number } | null;

const STAGE_LABEL: Record<UploadStage, string> = {
  preparando: "Preparando…",
  subiendo: "Subiendo",
  guardando: "Guardando…",
};

/** "Foto y CV": upload with progress, preview, replace, remove. Private until a company unlocks you. */
export function FilesBlock({ tone, index }: { tone: BlockTone; index: number }) {
  const avatarPath = useApp((s) => s.avatarPath);
  const cvPath = useApp((s) => s.cvPath);
  return (
    <Block
      id="archivos"
      tone={tone}
      index={index}
      icon={Camera01Icon}
      title="Foto y CV"
      why="Una foto clara de frente da confianza. El CV ayuda en puestos de oficina o supervisión."
      badge={<PointsBadge parts={[[STRENGTH_WEIGHTS.photo, !!avatarPath], [STRENGTH_WEIGHTS.cv, !!cvPath]]} />}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <PhotoTile />
        <CvTile />
      </div>
      <p className="mt-4 flex items-start gap-2.5 rounded-tile border-2 border-dashed border-ink/35 bg-white/45 p-3 text-[0.9rem] leading-snug font-semibold">
        <HugeiconsIcon icon={LockIcon} className="mt-0.5 size-5 shrink-0" strokeWidth={2.2} />
        <span>
          Solo la ven las empresas cuando desbloquean tu postulación.
          <span className="block text-[0.85rem] font-normal text-muted-foreground">Antes de eso ven tu perfil sin nombre, teléfono, foto ni CV.</span>
        </span>
      </p>
    </Block>
  );
}

function ProgressBar({ progress, label }: { progress: NonNullable<Progress>; label: string }) {
  const pct = Math.round(progress.pct * 100);
  const determinate = progress.stage === "subiendo";
  return (
    <div className="mt-3" aria-live="polite">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={determinate ? pct : undefined}
        aria-valuetext={determinate ? `${pct}%` : STAGE_LABEL[progress.stage]}
        className="relative h-3 overflow-hidden rounded-full border-2 border-ink bg-white"
      >
        <span
          className={cn("absolute inset-0 origin-left bg-ink transition-transform duration-200", !determinate && "animate-pulse")}
          style={{ scale: `${determinate ? Math.max(0.04, progress.pct) : progress.stage === "guardando" ? 1 : 0.15} 1` }}
        />
      </div>
      <p className="mt-1 text-[0.8rem] font-semibold tabular-nums">
        {STAGE_LABEL[progress.stage]}
        {determinate ? ` ${pct}%` : ""}
      </p>
    </div>
  );
}

function useUpload(kind: FileKind) {
  const [progress, setProgress] = useState<Progress>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  async function onFile(file: File | undefined) {
    if (!file) return;
    markEdited();
    setProgress({ stage: "preparando", pct: 0 });
    await (kind === "avatar" ? uploadAvatar : uploadCv)(file, setProgress);
    setProgress(null);
    if (inputRef.current) inputRef.current.value = "";
  }
  return { progress, inputRef, onFile, pick: () => inputRef.current?.click() };
}

function RemoveButton({ kind, disabled }: { kind: FileKind; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  const what = kind === "avatar" ? "tu foto" : "tu CV";
  return (
    <>
      <button type="button" disabled={disabled} onClick={() => setOpen(true)} className={cn(WHITE_BTN, "w-12 shrink-0 px-0")}>
        <HugeiconsIcon icon={Delete02Icon} className="size-5" strokeWidth={2.2} />
        <span className="sr-only">Quitar {what}</span>
      </button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar {what}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borra de tu perfil y las empresas ya no {kind === "avatar" ? "la" : "lo"} verán. Puedes subir {kind === "avatar" ? "otra" : "otro"} cuando quieras.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={() => {
                markEdited();
                void removeProfileFile(kind);
              }}
            >
              Sí, quitar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PhotoTile() {
  const name = useApp((s) => s.name);
  const { url, path, failed } = useOwnFileUrl("avatar");
  const { progress, inputRef, onFile, pick } = useUpload("avatar");
  const busy = !!progress;
  const initials =
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? "")
      .join("") || "?";
  return (
    <div className="rounded-tile border-2 border-ink bg-white p-3 text-ink">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            "relative grid size-20 shrink-0 -rotate-2 place-items-center overflow-hidden rounded-2xl bg-block-lila font-display text-[1.8rem] font-extrabold text-ink",
            HARD_SM,
          )}
        >
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- local blob / short-lived signed URL
            <img src={url} alt="Tu foto de perfil" className="size-full object-cover" />
          ) : path && !failed ? (
            <span role="img" className="size-full animate-pulse bg-ink/10" aria-label="Cargando tu foto" />
          ) : (
            <span aria-hidden>{initials}</span>
          )}
        </span>
        <div className="min-w-0">
          <p className="font-display text-[1.1rem] leading-tight font-extrabold">Foto</p>
          <p className="text-[0.82rem] leading-snug text-ink/65">{path ? "De frente y con buena luz." : "JPG, PNG o WebP. La hacemos ligera por ti."}</p>
        </div>
      </div>
      {progress ? <ProgressBar progress={progress} label="Subiendo tu foto" /> : null}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={pick} disabled={busy} className={cn(INK_BTN, "min-w-0 flex-1 px-3")}>
          <HugeiconsIcon icon={path ? Camera01Icon : Upload04Icon} className="size-5 text-limon" strokeWidth={2.2} />
          {path ? "Cambiar" : "Subir foto"}
        </button>
        {path ? <RemoveButton kind="avatar" disabled={busy} /> : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={AVATAR_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </div>
  );
}

function CvTile() {
  const cvFileName = useApp((s) => s.cvFileName);
  const { path } = useOwnFileUrl("cv");
  const { progress, inputRef, onFile, pick } = useUpload("cv");
  const busy = !!progress;
  const uploadedAt = path ? Number(/cv-(\d{10,})\.pdf$/.exec(path)?.[1]) : NaN;
  const when = Number.isFinite(uploadedAt)
    ? new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(new Date(uploadedAt))
    : null;
  return (
    <div className="rounded-tile border-2 border-ink bg-white p-3 text-ink">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className={cn("grid size-20 shrink-0 rotate-2 place-items-center rounded-2xl", path ? "bg-ink text-limon" : "bg-block-sol text-ink", HARD_SM)}
        >
          <HugeiconsIcon icon={Pdf01Icon} className="size-9" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="font-display text-[1.1rem] leading-tight font-extrabold">CV</p>
          {path ? (
            <p className="text-[0.82rem] leading-snug text-ink/65">
              <span className="block truncate font-semibold text-ink">{cvFileName ?? "Tu CV en PDF"}</span>
              {when ? `Subido el ${when}` : "Listo"}
            </p>
          ) : (
            <p className="text-[0.82rem] leading-snug text-ink/65">Solo PDF, hasta 5 MB. Opcional.</p>
          )}
        </div>
      </div>
      {progress ? <ProgressBar progress={progress} label="Subiendo tu CV" /> : null}
      <div className="mt-3 flex gap-2">
        {path ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => void openOwnCv()}
            className={cn(WHITE_BTN, "min-w-0 flex-1 px-3")}
          >
            <HugeiconsIcon icon={ViewIcon} className="size-5" strokeWidth={2.2} />
            Ver
          </button>
        ) : null}
        <button type="button" onClick={pick} disabled={busy} className={cn(INK_BTN, "min-w-0 flex-1 px-3")}>
          <HugeiconsIcon icon={Upload04Icon} className="size-5 text-limon" strokeWidth={2.2} />
          {path ? "Cambiar" : "Subir CV"}
        </button>
        {path ? <RemoveButton kind="cv" disabled={busy} /> : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={CV_ACCEPT}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
    </div>
  );
}
