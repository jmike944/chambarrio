"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  ComingSoon01Icon,
  Copy01Icon,
  Delete02Icon,
  Logout03Icon,
  Mail01Icon,
  MailSend01Icon,
  RefreshIcon,
  UserAdd01Icon,
  UserEdit01Icon,
  UserRemove01Icon,
  UserSwitchIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
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
import { PageHeader } from "@/components/chamba/page-header";
import { Eyebrow, HeroCard, SectionLabel, type BlockTone, BLOCK_CLASS } from "@/components/chamba/primitives";
import { Scene } from "@/components/chamba/art/scenes";
import { MyMascot } from "@/components/chamba/art/my-mascot";
import { EmployerError, EmployerGate, EmployerSkeleton } from "@/components/empresa/employer-gate";
import { HARD, HARD_SM, OUTLINE, WHITE_BUTTON } from "@/components/empresa/workwear";
import { InviteDialog, InviteResultDialog } from "@/components/team/invite-dialog";
import { MemberDialog } from "@/components/team/member-dialog";
import { MeChip, MemberAvatar, ROLE_LIMITS, ROLE_SELF, RoleChip, ScopeChip, StretchArt } from "@/components/team/team-kit";
import { useMyCompany } from "@/lib/data/catalog";
import { fmtDate, useNow } from "@/lib/pipeline";
import { useIsLive } from "@/lib/store";
import {
  ROLE_META,
  TEAM_ROLES,
  inviteMember,
  leaveTeam,
  removeMember,
  revokeInvite,
  setDemoViewAs,
  useCan,
  useMyMembership,
  useTeam,
  validateRemoval,
  type InviteCreated,
  type TeamInvite,
  type TeamMember,
  type TeamPlan,
  type TeamView,
} from "@/lib/team";
import { cn } from "@/lib/utils";

/*
 * /empresa/equipo, "Tu equipo" (both modes). Everyone in the business sees who's in it; the dueño
 * invites, re-sends or cancels invitations, changes permissions and removes people. Anyone but the
 * last dueño can leave. Demo: the demo team (the demo user + Lupita, reclutador of CEDIS Santa Mónica)
 * on Por vacante, so it starts full; "Ver como" previews the app as her.
 *
 * Desktop: two columns that end on the same line (the last card of each stretches). Phones: hero →
 * people → invitations → roles → "Ver como" → leave.
 */

const PLAN_NAME: Record<TeamPlan, string> = { "por-vacante": "Por vacante", pyme: "Pyme", industrial: "Industrial" };
const MEMBER_TONES: BlockTone[] = ["sol", "cielo", "limon", "durazno", "lila"];

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

const firstName = (m: Pick<TeamMember, "name" | "email">) => m.name.trim().split(/\s+/)[0] || m.email || "esta persona";
const displayName = (m: Pick<TeamMember, "name" | "email">) => m.name.trim() || m.email || "Sin nombre";

/** The page title, with the business underneath (the employer's own company, never the mock in live). */
export function TeamHeader() {
  const { company } = useMyCompany();
  return <PageHeader title="Tu equipo" eyebrow={company?.name} />;
}

export function TeamPage() {
  // A reclutador whose branches were all deleted still gets this page: they can see the team and leave.
  return (
    <EmployerGate shape="cards" allowEmptyScope>
      {(my) => <TeamBody companyName={my.company.name} />}
    </EmployerGate>
  );
}

function TeamBody({ companyName }: { companyName: string }) {
  const team = useTeam();
  const can = useCan();
  const my = useMyMembership();
  const live = useIsLive();
  const router = useRouter();
  const now = useNow();
  /** Links made this visit (invite / re-send), by invite id: the only time "Copiar enlace" can work. */
  const [links, setLinks] = useState<Record<string, InviteCreated>>({});
  const [inviteKey, setInviteKey] = useState(0);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [resent, setResent] = useState<InviteCreated | null>(null);
  const [editing, setEditing] = useState<TeamMember | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [removing, setRemoving] = useState<TeamMember | null>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  /** The row (invite or member id) an action is running on. */
  const [busy, setBusy] = useState<string | null>(null);
  const inviteBtn = useRef<HTMLButtonElement>(null);

  // Pages stay mounted after navigating away; don't come back to an open dialog.
  useLayoutEffect(
    () => () => {
      setInviteOpen(false);
      setResent(null);
      setEditOpen(false);
      setRemoveOpen(false);
      setLeaveOpen(false);
    },
    [],
  );

  if (team.status === "loading") return <EmployerSkeleton shape="cards" />;
  if (team.status === "error") return <EmployerError message={team.error} onRetry={team.reload} />;

  const me = team.me;
  const canLeave = !!me && !validateRemoval(me, team.members);
  const otherDueno = team.members.some((m) => m.role === "dueno" && !m.isMe);
  const invitesSoon = live && !my.teamsEnabled;

  function openInvite() {
    setInviteKey((k) => k + 1);
    setInviteOpen(true);
  }

  async function resend(i: TeamInvite) {
    if (busy) return;
    setBusy(i.id);
    const r = await inviteMember({ email: i.email, role: i.role, branchIds: i.branchIds });
    setBusy(null);
    if (r.error !== undefined) return; // toasted
    setLinks((l) => ({ ...l, [r.data.id]: r.data }));
    setResent(r.data);
  }

  async function cancel(i: TeamInvite) {
    if (busy) return;
    setBusy(i.id);
    const r = await revokeInvite(i.id);
    setBusy(null);
    if (r.error) return;
    toast(`Cancelamos la invitación a ${i.email}. Su enlace ya no funciona.`);
  }

  async function copyLink(created: InviteCreated) {
    try {
      await navigator.clipboard.writeText(created.link);
      toast.success("Copiamos el enlace.");
    } catch {
      setResent(created);
    }
  }

  async function confirmRemove(e: React.MouseEvent) {
    e.preventDefault();
    if (!removing || busy) return;
    setBusy(removing.userId);
    const r = await removeMember(removing.userId);
    setBusy(null);
    if (r.error) return;
    toast.success(`${firstName(removing)} ya no está en tu equipo.`);
    setRemoveOpen(false);
  }

  async function confirmLeave(e: React.MouseEvent) {
    e.preventDefault();
    if (busy) return;
    const wasViewing = my.viewingAs !== null;
    setBusy("leave");
    const r = await leaveTeam();
    setBusy(null);
    if (r.error) return;
    setLeaveOpen(false);
    if (!live) {
      toast.success(wasViewing ? `${me ? firstName(me) : "Esa persona"} salió del equipo. Vuelves a tu vista de dueño.` : "Saliste del equipo.");
      return;
    }
    toast.success(`Saliste de ${companyName}.`);
    router.replace("/empresa");
  }

  const viewAsOthers = !live ? team.members.filter((m) => !m.isMe) : [];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:gap-7">
      {/* ------------------------------------------------ left column (desktop) */}
      <div className="contents lg:col-span-5 lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
        <TeamHero
          className="order-1"
          team={team}
          invitesSoon={invitesSoon}
          inviteRef={inviteBtn}
          onInvite={openInvite}
        />
        {!live && (viewAsOthers.length > 0 || my.viewingAs) ? (
          <ViewAsCard className="order-5" others={viewAsOthers} viewing={my.viewingAs ? me : null} />
        ) : null}
        <LeaveCard
          className="order-6 lg:flex-1"
          companyName={companyName}
          canLeave={canLeave}
          isDueno={me?.role === "dueno"}
          onLeave={() => setLeaveOpen(true)}
        />
      </div>

      {/* ------------------------------------------------ right column (desktop) */}
      <div className="contents lg:col-span-7 lg:flex lg:min-w-0 lg:flex-col lg:gap-6">
        <section aria-labelledby="personas" className="order-2 min-w-0">
          <SectionLabel title={<span id="personas">Personas</span>} count={team.members.length} className="mb-4" />
          <ul className="grid gap-4">
            {team.members.map((m, i) => (
              <li key={m.userId} className="animate-rise min-w-0" style={{ "--i": Math.min(i + 1, 8) } as CSSVars}>
                <MemberCard
                  member={m}
                  tone={MEMBER_TONES[i % MEMBER_TONES.length]}
                  now={now}
                  busy={busy === m.userId}
                  onEdit={
                    can.manageTeam && (!m.isMe || otherDueno)
                      ? () => {
                          setEditing(m);
                          setEditOpen(true);
                        }
                      : null
                  }
                  onRemove={
                    can.manageTeam && !m.isMe
                      ? () => {
                          setRemoving(m);
                          setRemoveOpen(true);
                        }
                      : null
                  }
                />
              </li>
            ))}
          </ul>
        </section>

        {can.manageTeam ? (
          <section aria-labelledby="invitaciones" className="order-3 min-w-0">
            <SectionLabel title={<span id="invitaciones">Invitaciones</span>} count={team.invites.length} className="mb-4" />
            {team.invites.length === 0 ? (
              <p className="flex items-start gap-3 rounded-panel border-2 border-dashed border-ink/50 bg-card px-5 py-4 text-[0.95rem] leading-snug text-muted-foreground dark:border-white/30">
                <HugeiconsIcon icon={MailSend01Icon} className="mt-0.5 size-5 shrink-0 text-foreground" strokeWidth={2} />
                <span>
                  <strong className="block font-display text-[1.1rem] font-extrabold text-foreground">Nadie pendiente</strong>
                  Cuando invites a alguien, aquí ves si ya entró y puedes reenviarle el enlace.
                </span>
              </p>
            ) : (
              <ul className="grid gap-3">
                {team.invites.map((inv) => (
                  <li key={inv.id} className="min-w-0">
                    <InviteRow
                      invite={inv}
                      link={links[inv.id] ?? null}
                      busy={busy === inv.id}
                      onCopy={copyLink}
                      onResend={() => void resend(inv)}
                      onCancel={() => void cancel(inv)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        ) : null}

        <RolesCard className="order-4 lg:flex-1" myRole={me?.role ?? null} />
      </div>

      {/* ------------------------------------------------ dialogs */}
      {can.manageTeam ? (
        <InviteDialog
          key={inviteKey}
          open={inviteOpen}
          onOpenChange={setInviteOpen}
          team={team}
          companyName={companyName}
          returnFocus={inviteBtn}
          onCreated={(c) => setLinks((l) => ({ ...l, [c.id]: c }))}
        />
      ) : null}
      <InviteResultDialog result={resent} onOpenChange={(o) => (o ? undefined : setResent(null))} companyName={companyName} />
      {editing ? (
        <MemberDialog key={editing.userId} member={editing} members={team.members} open={editOpen} onOpenChange={setEditOpen} />
      ) : null}

      <AlertDialog open={removeOpen} onOpenChange={(o) => (busy ? undefined : setRemoveOpen(o))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Quitar a {removing ? displayName(removing) : ""} del equipo?</AlertDialogTitle>
            <AlertDialogDescription>
              Dejará de ver vacantes y postulantes de inmediato. Sus notas y los pasos que hizo se quedan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmRemove} aria-disabled={!!busy || undefined}>
              {busy ? "Quitando…" : "Quitar del equipo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={leaveOpen} onOpenChange={(o) => (busy ? undefined : setLeaveOpen(o))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Salir de {companyName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Dejarás de ver sus vacantes y postulantes de inmediato. Tus notas se quedan. Para volver, el dueño tiene que
              invitarte otra vez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={!!busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmLeave} aria-disabled={!!busy || undefined}>
              {busy === "leave" ? "Saliendo…" : "Salir de la empresa"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ------------------------------------------------------------------ hero

function TeamHero({
  team,
  invitesSoon,
  inviteRef,
  onInvite,
  className,
}: {
  team: TeamView;
  invitesSoon: boolean;
  inviteRef: React.RefObject<HTMLButtonElement | null>;
  onInvite: () => void;
  className?: string;
}) {
  const can = useCan();
  const { used, limit, full } = team.usage;
  const role = team.me?.role ?? can.role;
  const n = team.members.length;
  return (
    <HeroCard
      tone="uva"
      decor={false}
      eyebrow={can.manageTeam ? "Quién te ayuda a contratar" : "Tu lugar en el equipo"}
      title={can.manageTeam ? `${n} ${n === 1 ? "persona" : "personas"} en tu equipo` : role ? `Tu rol: ${ROLE_META[role].long}` : "Tu equipo"}
      className={cn("animate-rise overflow-hidden pb-0 sm:pb-0", OUTLINE, HARD, className)}
    >
      {can.manageTeam ? (
        <p className="mt-3 max-w-[34ch] text-[1.02rem] leading-snug text-primary-foreground/85">
          Cada quien entra con su propio correo y ve solo lo que le toca. Tú decides qué puede hacer cada persona.
        </p>
      ) : role ? (
        <>
          <p className="mt-3 max-w-[36ch] text-[1.02rem] leading-snug text-primary-foreground/85">{ROLE_SELF[role]}</p>
          {team.me ? <ScopeChip role={team.me.role} branchIds={team.me.branchIds} className="mt-3 border-ink bg-white text-ink" /> : null}
        </>
      ) : null}

      {/* Places used on the plan (members + pending invitations). */}
      <div className="mt-5 rounded-tile border-2 border-white/25 bg-white/10 p-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <p className="font-display text-[1.5rem] leading-none font-extrabold tracking-[-0.03em] tabular-nums">
            {limit === null ? `${used} ${used === 1 ? "persona" : "personas"}` : `${used} de ${limit} personas`}
          </p>
          <p className="text-[0.88rem] font-semibold text-primary-foreground/80">
            Plan {PLAN_NAME[team.plan]}
            {limit === null ? " · sin límite" : full ? " · completo" : ""}
          </p>
        </div>
        {limit !== null ? (
          <div
            role="progressbar"
            aria-label="Lugares de tu equipo"
            aria-valuemin={0}
            aria-valuemax={limit}
            aria-valuenow={Math.min(used, limit)}
            className="mt-3 flex h-4 gap-1"
          >
            {Array.from({ length: limit }, (_, i) => (
              <span
                key={i}
                className={cn("flex-1 origin-left animate-grow rounded-full border-2 border-ink", i < used ? "bg-limon" : "bg-white/20")}
                style={{ "--i": i } as CSSVars}
              />
            ))}
          </div>
        ) : null}
        {!can.manageTeam ? (
          <p className="mt-3 text-[0.88rem] leading-snug text-primary-foreground/80">Solo el dueño invita gente y cambia permisos.</p>
        ) : null}
      </div>

      {can.manageTeam ? (
        invitesSoon ? (
          <p className="mt-5 inline-flex items-start gap-2 rounded-tile border-2 border-ink bg-white px-3.5 py-2.5 text-[0.92rem] leading-snug font-semibold text-ink">
            <HugeiconsIcon icon={ComingSoon01Icon} className="mt-0.5 size-4.5 shrink-0" strokeWidth={2.2} />
            Muy pronto podrás invitar a tu equipo desde aquí.
          </p>
        ) : (
          <Button
            ref={inviteRef}
            variant="lime"
            size="xl"
            onClick={onInvite}
            className={cn("mt-5 w-full border-2 border-ink sm:w-auto", HARD_SM)}
          >
            <HugeiconsIcon icon={UserAdd01Icon} className="size-5" strokeWidth={2.4} />
            Invitar a alguien
          </Button>
        )
      ) : null}
      <div aria-hidden className="-mx-6 mt-4 sm:-mx-7">
        <Scene name="equipo" className="mx-auto w-full max-w-[30rem] translate-y-2" />
      </div>
    </HeroCard>
  );
}

// ------------------------------------------------------------------ people

function MemberCard({
  member: m,
  tone,
  now,
  busy,
  onEdit,
  onRemove,
}: {
  member: TeamMember;
  tone: BlockTone;
  now: number;
  busy: boolean;
  onEdit: (() => void) | null;
  onRemove: (() => void) | null;
}) {
  const since = m.joinedAt && now ? fmtDate(m.joinedAt, { now, weekday: false }) : null;
  return (
    <article
      aria-label={displayName(m)}
      className={cn(
        "relative isolate flex flex-col gap-3.5 rounded-panel p-4 sm:flex-row sm:items-center sm:p-5",
        BLOCK_CLASS[tone],
        OUTLINE,
        HARD_SM,
        busy && "opacity-70",
      )}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 rounded-[inherit] bg-dots opacity-40" />
      <div className="flex min-w-0 flex-1 items-start gap-3.5">
        <MemberAvatar userId={m.userId} isMe={m.isMe} name={m.name} size={56} />
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-x-2 gap-y-1 font-display text-[1.25rem] leading-tight font-extrabold tracking-[-0.02em]">
            <span className="min-w-0 break-words">{displayName(m)}</span>
            {m.isMe ? <MeChip /> : null}
          </h3>
          {m.email && m.name.trim() ? <p className="mt-0.5 text-[0.88rem] break-all text-muted-foreground">{m.email}</p> : null}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <RoleChip role={m.role} long />
            <ScopeChip role={m.role} branchIds={m.branchIds} />
          </div>
          {since ? <p className="mt-1.5 text-[0.82rem] text-muted-foreground">En el equipo desde el {since}</p> : null}
        </div>
      </div>
      {onEdit || onRemove ? (
        <div className="flex flex-wrap gap-2 sm:w-[12.75rem] sm:shrink-0 sm:flex-col sm:flex-nowrap">
          {onEdit ? (
            <Button size="lg" onClick={onEdit} disabled={busy} className={cn("h-11 flex-1 px-3.5 sm:flex-none", WHITE_BUTTON)}>
              <HugeiconsIcon icon={UserEdit01Icon} strokeWidth={2} />
              Cambiar permisos
            </Button>
          ) : null}
          {onRemove ? (
            <Button size="lg" onClick={onRemove} disabled={busy} className={cn("h-11 flex-1 px-3.5 sm:flex-none", WHITE_BUTTON)}>
              <HugeiconsIcon icon={UserRemove01Icon} className="text-destructive" strokeWidth={2} />
              Quitar
            </Button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function InviteRow({
  invite: i,
  link,
  busy,
  onCopy,
  onResend,
  onCancel,
}: {
  invite: TeamInvite;
  /** Set only right after creating or re-sending it (the token is never retrievable later). */
  link: InviteCreated | null;
  busy: boolean;
  onCopy: (c: InviteCreated) => void;
  onResend: () => void;
  onCancel: () => void;
}) {
  const btn = cn("h-11 px-3.5", WHITE_BUTTON);
  return (
    <article
      aria-label={`Invitación a ${i.email}`}
      className={cn(
        "rounded-panel border-2 border-dashed border-ink/60 bg-card p-4 sm:p-5 dark:border-white/40",
        busy && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 -rotate-6 place-items-center rounded-xl border-2 border-ink bg-block-sol text-ink">
          <HugeiconsIcon icon={Mail01Icon} className="size-5" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-[1.1rem] leading-tight font-extrabold break-all">{i.email}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <RoleChip role={i.role} long />
            <ScopeChip role={i.role} branchIds={i.branchIds} />
            <span
              className={cn(
                "inline-flex h-7 items-center rounded-full border-2 px-2.5 text-[0.8rem] font-bold",
                i.expired ? "border-ink bg-block-mandarina text-ink" : "border-border text-muted-foreground",
              )}
            >
              {i.expired ? "Venció" : `Vence el ${fmtDate(i.expiresAt, { weekday: false })}`}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3.5 flex flex-wrap gap-2">
        {link ? (
          <Button size="lg" onClick={() => onCopy(link)} className={cn(btn, HARD_SM)}>
            <HugeiconsIcon icon={Copy01Icon} strokeWidth={2.2} />
            Copiar enlace
          </Button>
        ) : null}
        <Button size="lg" onClick={onResend} disabled={busy} className={btn}>
          <HugeiconsIcon icon={RefreshIcon} strokeWidth={2.2} />
          {i.expired ? "Reenviar" : "Reenviar enlace"}
        </Button>
        <Button size="lg" onClick={onCancel} disabled={busy} className={btn}>
          <HugeiconsIcon icon={Delete02Icon} className="text-destructive" strokeWidth={2} />
          Cancelar
        </Button>
      </div>
    </article>
  );
}

// ------------------------------------------------------------------ roles, "ver como", leave

function RolesCard({ myRole, className }: { myRole: TeamMember["role"] | null; className?: string }) {
  return (
    <section
      aria-labelledby="roles"
      className={cn("block-menta relative isolate flex min-w-0 flex-col overflow-hidden rounded-panel p-5 sm:p-6", OUTLINE, HARD, className)}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-40" />
      <h2 id="roles" className="font-display text-[1.35rem] leading-tight font-extrabold tracking-[-0.025em]">
        Qué puede hacer cada quien
      </h2>
      <ul className="mt-4 space-y-2.5">
        {TEAM_ROLES.map((r) => (
          <li key={r} className="rounded-tile border-2 border-ink bg-white/75 p-3.5 text-ink dark:bg-white/85">
            <p className="flex flex-wrap items-center gap-2">
              <RoleChip role={r} long />
              {myRole === r ? <MeChip /> : null}
            </p>
            <p className="mt-2 text-[0.95rem] leading-snug font-medium">{ROLE_META[r].description}</p>
            <p className="mt-0.5 text-[0.88rem] leading-snug text-ink/65">{ROLE_LIMITS[r]}</p>
          </li>
        ))}
      </ul>
      {/* A stretched card (desktop) gets a scene in the extra room; the note stays at the bottom. */}
      <StretchArt name="contratado" className="mt-4" />
      <p className="flex items-start gap-2 pt-4 text-[0.9rem] leading-snug">
        <HugeiconsIcon icon={ViewIcon} className="mt-0.5 size-4.5 shrink-0" strokeWidth={2.2} />
        Quien se postula nunca ve quién de tu equipo hizo cada paso: para la persona, es «la empresa».
      </p>
    </section>
  );
}

/** Demo only: preview the app as another member of the demo team. */
function ViewAsCard({ others, viewing, className }: { others: TeamMember[]; viewing: TeamMember | null; className?: string }) {
  return (
    <section
      aria-labelledby="ver-como"
      className={cn("block-sol relative isolate overflow-hidden rounded-panel p-5 sm:p-6", OUTLINE, HARD, className)}
    >
      <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-40" />
      <Eyebrow>Solo en la demo</Eyebrow>
      <h2 id="ver-como" className="mt-1 font-display text-[1.35rem] leading-tight font-extrabold tracking-[-0.025em]">
        {viewing ? `Estás viendo como ${firstName(viewing)}` : "Prueba cómo lo ve tu equipo"}
      </h2>
      <p className="mt-1.5 text-[0.95rem] leading-snug text-muted-foreground">
        {viewing
          ? "Recorre el panel, las vacantes y los candidatos: solo ves lo que le toca."
          : "Recorre el panel como otra persona de tu equipo: ve solo sus sucursales y lo que su rol permite."}
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        {viewing ? (
          <Button size="lg" onClick={() => setDemoViewAs(null)} className={cn("h-11", WHITE_BUTTON, HARD_SM)}>
            <HugeiconsIcon icon={UserSwitchIcon} strokeWidth={2.2} />
            Volver a mi vista
          </Button>
        ) : (
          others.map((m) => (
            <Button key={m.userId} size="lg" onClick={() => setDemoViewAs(m.userId)} className={cn("h-11", WHITE_BUTTON, HARD_SM)}>
              <HugeiconsIcon icon={UserSwitchIcon} strokeWidth={2.2} />
              Ver como {firstName(m)}
            </Button>
          ))
        )}
      </div>
    </section>
  );
}

function LeaveCard({
  companyName,
  canLeave,
  isDueno,
  onLeave,
  className,
}: {
  companyName: string;
  canLeave: boolean;
  isDueno: boolean;
  onLeave: () => void;
  className?: string;
}) {
  return (
    <section
      aria-labelledby="salir"
      className={cn("block-durazno relative isolate flex min-w-0 flex-col overflow-hidden rounded-panel p-5 sm:p-6", OUTLINE, HARD, className)}
    >
      <h2 id="salir" className="font-display text-[1.35rem] leading-tight font-extrabold tracking-[-0.025em]">
        {canLeave ? `Salir de ${companyName}` : "Eres el único dueño"}
      </h2>
      <p className="mt-1.5 text-[0.95rem] leading-snug text-muted-foreground">
        {canLeave
          ? isDueno
            ? "Hay otro dueño, así que puedes salir. Dejas de ver sus vacantes y postulantes al momento; tus notas se quedan."
            : "Dejas de ver sus vacantes y postulantes al momento. Tus notas y los pasos que hiciste se quedan."
          : "Tu negocio siempre necesita un dueño. Si algún día lo dejas, primero nombra a otra persona como dueña con «Cambiar permisos»."}
      </p>
      {canLeave ? (
        <div className="mt-auto flex items-end justify-between gap-3 pt-4">
          <Button size="lg" onClick={onLeave} className={cn("h-11", WHITE_BUTTON, HARD_SM)}>
            <HugeiconsIcon icon={Logout03Icon} className="text-destructive" strokeWidth={2.2} />
            Salir de la empresa
          </Button>
          <MyMascot mood="saluda" prop="casco" size={96} className="-mr-1 -mb-6 shrink-0" />
        </div>
      ) : (
        // Nothing to do here: when the column stretches (desktop), the extra room gets the storefront.
        <StretchArt name="negocio" className="mt-3 -mb-2 max-lg:hidden" />
      )}
    </section>
  );
}
