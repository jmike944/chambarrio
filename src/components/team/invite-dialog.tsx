"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Copy01Icon,
  Invoice01Icon,
  Mail01Icon,
  MailSend01Icon,
  Message01Icon,
  Share08Icon,
  UserAdd01Icon,
  UserGroupIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { FIELD, HARD_SM, OUTLINE, WHITE_BUTTON } from "@/components/empresa/workwear";
import { fmtDate } from "@/lib/pipeline";
import { useAllEmployerLocations, useIsLive } from "@/lib/store";
import {
  inviteMember,
  limitMessage,
  upgradeHint,
  useCan,
  useMyMembership,
  validateInvite,
  type InviteCreated,
  type TeamRole,
  type TeamView,
} from "@/lib/team";
import { cn } from "@/lib/utils";
import { DialogBody, FieldError, SUBMIT, TeamDialog } from "./dialog-shell";
import { BranchPicker, RolePicker } from "./role-fields";

/*
 * "Invitar a alguien" (dueño): email + role (+ branches for a reclutador) → the one-time link to share.
 * When the plan's places are taken it says so, with the next plan's limit, instead of a form that
 * can't go through. The link exists only now (and after "Reenviar"): it's never retrievable later.
 */

type Issue = { field: "email" | "branches" | "form"; message: string };

/** Half-width footer button with an icon: on phones the label alone fits (with the icon it ran into the border). */
const HALF_ON_PHONE = "max-sm:px-3 max-sm:[&_svg]:hidden";

export function InviteDialog({
  open,
  onOpenChange,
  team,
  companyName,
  onCreated,
  returnFocus,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: TeamView;
  companyName: string;
  /** The new invite and its link (kept by the page so "Copiar enlace" works on its row). */
  onCreated: (created: InviteCreated) => void;
  returnFocus?: React.RefObject<HTMLElement | null>;
}) {
  const my = useMyMembership();
  const branches = useAllEmployerLocations();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<TeamRole>("reclutador");
  const [branchIds, setBranchIds] = useState<string[] | null>(null);
  const [issue, setIssue] = useState<Issue | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<InviteCreated | null>(null);
  const emailId = useId();
  const emailErr = useId();
  const branchErr = useId();
  const pickBranches = role === "reclutador" && branches.length > 1;
  const view = result ? "done" : team.usage.full ? "limit" : "form";

  function reset() {
    setEmail("");
    setRole("reclutador");
    setBranchIds(null);
    setIssue(null);
    setResult(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const input = { email: email.trim(), role, branchIds: pickBranches ? branchIds : null };
    const problem = !input.email ? { code: "bad_email" as const, error: "Escribe su correo." } : validateInvite(input, {
      me: my.membership,
      members: team.members,
      invites: team.invites,
      plan: team.plan,
      companyBranchIds: branches.map((b) => b.id),
    });
    if (problem) {
      const field = problem.code === "bad_email" || problem.code === "already_member" ? "email" : problem.code === "bad_branches" ? "branches" : "form";
      setIssue({ field, message: problem.error });
      // The fields scroll inside the dialog: bring the problem into view (the email field gets focus).
      requestAnimationFrame(() => {
        if (field === "email") document.getElementById(emailId)?.focus();
        else if (field === "branches") document.getElementById(branchErr)?.scrollIntoView({ block: "center", behavior: "smooth" });
      });
      return;
    }
    setIssue(null);
    setBusy(true);
    const r = await inviteMember(input);
    setBusy(false);
    // Errors were toasted by the action; the plan limit switches this dialog to its own view.
    if (r.error !== undefined) {
      if (r.code === "bad_email" || r.code === "already_member") setIssue({ field: "email", message: r.error });
      // Someone else filled the last place meanwhile: refetch so this dialog shows the limit view.
      if (r.code === "limit") team.reload();
      return;
    }
    setResult(r.data);
    onCreated(r.data);
  }

  return (
    <TeamDialog
      open={open}
      onOpenChange={onOpenChange}
      busy={busy}
      returnFocus={returnFocus}
      tone={view === "done" ? "limon" : view === "limit" ? "sol" : "lila"}
      icon={view === "done" ? MailSend01Icon : view === "limit" ? UserGroupIcon : UserAdd01Icon}
      title={view === "done" ? "¡Invitación lista!" : view === "limit" ? "Tu equipo está completo" : "Invitar a tu equipo"}
      description={
        view === "done"
          ? "Con este enlace entra a tu negocio. Usa el correo al que lo invitaste."
          : view === "limit"
            ? "Ya no hay lugares libres en tu plan."
            : "Le llega un enlace por correo. Entra con ese correo y queda en tu equipo."
      }
    >
      {view === "done" && result ? (
        <DialogBody
          footer={
            <div className="grid grid-cols-2 gap-2.5">
              <Button size="lg" className={cn("h-12 font-bold", WHITE_BUTTON, HALF_ON_PHONE)} onClick={reset}>
                <HugeiconsIcon icon={UserAdd01Icon} strokeWidth={2.2} />
                Invitar a otra
              </Button>
              <Button size="lg" className={cn(SUBMIT, "h-12")} onClick={() => onOpenChange(false)}>
                Listo
              </Button>
            </div>
          }
        >
          <InviteResult result={result} companyName={companyName} />
        </DialogBody>
      ) : view === "limit" ? (
        <LimitBody team={team} onClose={() => onOpenChange(false)} />
      ) : (
        <DialogBody
          onSubmit={submit}
          footer={
            <>
              {issue?.field === "form" ? <FieldError>{issue.message}</FieldError> : null}
              <Button type="submit" size="xl" aria-disabled={busy || undefined} className={cn(SUBMIT, issue?.field === "form" && "mt-3")}>
                <HugeiconsIcon icon={MailSend01Icon} className="size-5" strokeWidth={2.2} />
                {busy ? "Mandando…" : "Mandar invitación"}
              </Button>
            </>
          }
        >
          <div className="space-y-5">
            <div>
              <label htmlFor={emailId} className="mb-2 block text-[0.95rem] font-bold">
                Su correo
              </label>
              <input
                id={emailId}
                type="email"
                inputMode="email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (issue?.field === "email") setIssue(null);
                }}
                placeholder="nombre@correo.com"
                aria-invalid={issue?.field === "email" || undefined}
                aria-describedby={issue?.field === "email" ? emailErr : undefined}
                className={cn(FIELD, "w-full")}
              />
              {issue?.field === "email" ? <FieldError id={emailErr}>{issue.message}</FieldError> : null}
            </div>
            <RolePicker
              value={role}
              onChange={(r) => {
                setRole(r);
                if (issue?.field === "branches") setIssue(null);
              }}
            />
            {pickBranches ? (
              <div>
                <BranchPicker
                  value={branchIds}
                  branches={branches}
                  invalid={issue?.field === "branches"}
                  errorId={branchErr}
                  onChange={(ids) => {
                    setBranchIds(ids);
                    if (issue?.field === "branches") setIssue(null);
                  }}
                />
                {issue?.field === "branches" ? <FieldError id={branchErr}>{issue.message}</FieldError> : null}
              </div>
            ) : null}
          </div>
        </DialogBody>
      )}
    </TeamDialog>
  );
}

/** Every place is taken: what the plan allows, what the next one allows, and the way out. */
function LimitBody({ team, onClose }: { team: TeamView; onClose: () => void }) {
  const can = useCan();
  const hint = upgradeHint(team.plan);
  return (
    <DialogBody
      footer={
        <div className={cn("grid gap-2.5", can.managePlan && hint ? "grid-cols-2" : "grid-cols-1")}>
          {can.managePlan && hint ? (
            <Button asChild size="lg" className={cn(SUBMIT, "h-12", HALF_ON_PHONE)}>
              <Link href="/empresa/plan" onClick={onClose}>
                <HugeiconsIcon icon={Invoice01Icon} strokeWidth={2.2} />
                Mejorar plan
              </Link>
            </Button>
          ) : null}
          <Button size="lg" className={cn("h-12 font-bold", WHITE_BUTTON)} onClick={onClose}>
            Entendido
          </Button>
        </div>
      }
    >
      <p className="font-display text-[2.4rem] leading-none font-extrabold tracking-[-0.04em] tabular-nums">
        {team.usage.used} de {team.usage.limit}
        <span className="ml-2 font-sans text-[1rem] font-semibold tracking-normal text-muted-foreground">personas</span>
      </p>
      <p className="mt-3 text-[1rem] leading-snug">{limitMessage(team.plan)}</p>
      {hint ? (
        <p className={cn("block-limon mt-4 rounded-tile p-3.5 text-[1rem] leading-snug font-bold", OUTLINE, HARD_SM)}>{hint}</p>
      ) : null}
      <p className="mt-4 text-[0.92rem] leading-snug text-muted-foreground">
        También puedes quitar a alguien del equipo o cancelar una invitación pendiente para liberar un lugar.
      </p>
    </DialogBody>
  );
}

/**
 * The link to share after inviting or re-sending: copy, the phone's share sheet, SMS or correo (no
 * WhatsApp). Says plainly whether an email went out.
 */
export function InviteResult({ result, companyName }: { result: InviteCreated; companyName: string }) {
  const live = useIsLive();
  const linkId = useId();
  const message = `Te invito al equipo de ${companyName} en Chambarrio. Entra con tu correo ${result.email} desde este enlace: ${result.link}`;
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const subject = `Únete al equipo de ${companyName} en Chambarrio`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(result.link);
      toast.success("Copiamos el enlace.");
    } catch {
      const input = document.getElementById(linkId) as HTMLInputElement | null;
      input?.focus();
      input?.select();
      toast("Selecciona el enlace y cópialo.");
    }
  }

  const status = !result.emailed
    ? "Ya le llegaron varias invitaciones hoy. Comparte este enlace o cópialo."
    : live
      ? `Le mandamos la invitación a ${result.email}.`
      : `En la demo no se manda ningún correo. Con tu cuenta, a ${result.email} le llegaría la invitación.`;

  const shareBtn = cn("h-12 min-w-0 px-3 font-bold", WHITE_BUTTON);
  return (
    <div>
      <p className={cn("flex items-start gap-2.5 text-[1rem] leading-snug", !result.emailed && "font-bold")}>
        <HugeiconsIcon icon={result.emailed ? MailSend01Icon : Share08Icon} className="mt-0.5 size-5 shrink-0" strokeWidth={2.2} />
        {status}
      </p>

      <label htmlFor={linkId} className="mt-5 mb-2 block text-[0.95rem] font-bold">
        Enlace de invitación
      </label>
      <div className="flex gap-2">
        {/* 16 px on phones (iOS zooms into a smaller field when it gets focus); compact on bigger screens. */}
        <input
          id={linkId}
          readOnly
          value={result.link}
          onFocus={(e) => e.currentTarget.select()}
          className={cn(FIELD, "min-w-0 flex-1 truncate px-3 font-mono text-base sm:text-[0.85rem] md:text-[0.85rem]")}
        />
        <Button size="lg" onClick={() => void copy()} className={cn("h-14 shrink-0 px-4 font-bold", WHITE_BUTTON, HARD_SM)}>
          <HugeiconsIcon icon={Copy01Icon} className="size-5" strokeWidth={2.2} />
          Copiar
        </Button>
      </div>

      {/* The phone's share sheet (when there is one) leads; SMS and correo always work. */}
      <div className="mt-3 grid grid-cols-2 gap-2">
        {canShare ? (
          <Button
            size="lg"
            className={cn(shareBtn, "col-span-2")}
            onClick={() => void navigator.share({ title: subject, text: message }).catch(() => undefined)}
          >
            <HugeiconsIcon icon={Share08Icon} strokeWidth={2.2} />
            Compartir
          </Button>
        ) : null}
        <Button asChild size="lg" className={shareBtn}>
          <a href={`sms:?&body=${encodeURIComponent(message)}`}>
            <HugeiconsIcon icon={Message01Icon} strokeWidth={2.2} />
            SMS
          </a>
        </Button>
        <Button asChild size="lg" className={shareBtn}>
          <a href={`mailto:${encodeURIComponent(result.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}>
            <HugeiconsIcon icon={Mail01Icon} strokeWidth={2.2} />
            Correo
          </a>
        </Button>
      </div>

      <p className="mt-4 text-[0.88rem] leading-snug text-muted-foreground">
        Vence el {fmtDate(result.expiresAt, { weekday: false })}. Si se vence, la reenvías desde Tu equipo. Este enlace solo lo ves ahora.
      </p>
    </div>
  );
}

/** "Reenviar" result: the new link (the old one stopped working). */
export function InviteResultDialog({
  result,
  onOpenChange,
  companyName,
}: {
  result: InviteCreated | null;
  onOpenChange: (open: boolean) => void;
  companyName: string;
}) {
  return (
    <TeamDialog
      open={!!result}
      onOpenChange={onOpenChange}
      tone="limon"
      icon={MailSend01Icon}
      title="Invitación reenviada"
      description="Este es el enlace nuevo: el anterior ya no funciona."
    >
      <DialogBody
        footer={
          <Button size="lg" className={cn(SUBMIT, "h-12")} onClick={() => onOpenChange(false)}>
            Listo
          </Button>
        }
      >
        {result ? <InviteResult result={result} companyName={companyName} /> : null}
      </DialogBody>
    </TeamDialog>
  );
}
