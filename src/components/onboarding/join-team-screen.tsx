"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Alert02Icon,
  ArrowRight02Icon,
  Briefcase01Icon,
  Mail01Icon,
  MailOpen01Icon,
  SecurityCheckIcon,
  Store01Icon,
  Tick02Icon,
  UserSwitchIcon,
} from "@hugeicons/core-free-icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { ROLE_META, type InvitePreview, type TeamRole } from "@/lib/team";
import { cn } from "@/lib/utils";
import { FlowShell, HAZARD, PrimaryButton, SecondaryButton, Slab, StickyFooter, type HeroArt, type HeroTone } from "./flow";
import { AuthNote, BIG_INPUT } from "./live-auth";
import { CodeField, ResendButton, linkBtn } from "./phone-verify";

/*
 * /unirse, the screens (no data access): every state of accepting a team invite, driven by `stage`.
 * The flow itself (Supabase or the demo walk) lives in ./join-team.tsx; a lab can render any stage
 * with fixtures. Never put the invite token in here: these screens don't need it.
 */

export type GoneReason = "not_found" | "vencida" | "cancelada" | "usada";

export type JoinStage =
  /** Reading the invite (and, signed in, the account). */
  | { kind: "loading" }
  /** /unirse without ?t= */
  | { kind: "missing" }
  /** The invite couldn't be read (network, teams not enabled yet…). */
  | { kind: "error"; message: string }
  | { kind: "gone"; reason: GoneReason }
  /** Signed out: the invite + "Entra con tu correo". */
  | { kind: "email" }
  /** A code went to `email`. */
  | { kind: "code"; email: string }
  /** Signed in: re-checking the invite against this account. */
  | { kind: "checking" }
  /** Signed in with the invited email: one tap (plus the name if the account has none). */
  | { kind: "join"; askName: boolean }
  /** An onboarded candidate account: explicit "Usar mi cuenta como empresa" or "Usar otro correo". */
  | { kind: "candidate" }
  /** The candidate picked "Usar otro correo". */
  | { kind: "candidate-other" }
  | { kind: "wrong_email" }
  | { kind: "other_company" }
  | { kind: "limit"; message: string }
  /** Signed in, but the email isn't confirmed yet: confirm it with a code. */
  | { kind: "unconfirmed" }
  | { kind: "done" };

export type JoinActions = {
  /** Resolves an error message (shown on the email step) or null when the code went out. */
  sendCode: (email: string) => Promise<string | null>;
  /** Resolves an error message or null once signed in. */
  verifyCode: (code: string) => Promise<string | null>;
  /** Back from the code to the email field. */
  changeEmail: () => void;
  join: (name?: string) => void;
  /** Candidate: accept and turn this account into a company account. */
  useCompanyAccount: () => void;
  candidateOther: () => void;
  backToChoice: () => void;
  /** Sign out and open this invite again (signed out). */
  switchAccount: () => void;
  retry: () => void;
};

export type JoinScreenProps = {
  stage: JoinStage;
  /** null until loaded, or for missing / not_found / error. */
  invite: InvitePreview | null;
  actions: JoinActions;
  /** The demo walk: nothing is sent; any 6-digit code works. */
  demo?: boolean;
  signedIn?: boolean;
  /** The signed-in account's email (wrong email, candidate, unconfirmed, join). */
  accountEmail?: string | null;
  /** other_company: the team I'm already in. */
  otherCompany?: string | null;
  /** usada: I'm in that company already. */
  alreadyMember?: boolean;
  /** An action is running (join, switching account). */
  busy?: boolean;
  /** Problem with the main action, shown above it (network, rate limits…). */
  problem?: string | null;
  /** Prefills the email field (demo). */
  defaultEmail?: string;
  /** "/entrar?next=/unirse?t=…" for people with a password (null: hide). */
  passwordHref?: string | null;
  /** Where "Ir al inicio" goes for this person. */
  homeHref?: string;
};

/* ------------------------------------------------------------------ copy */

/** What each role does, in the invitee's words (keep in line with ROLE_META and the invite email). */
const ROLE_CAN: Record<TeamRole, { can: string[]; note: string }> = {
  dueno: {
    can: [
      "Publicar vacantes y atender a quienes se postulan",
      "Editar los datos del negocio y sus sucursales",
      "Invitar personas al equipo y manejar el plan",
    ],
    note: "Tendrás los mismos permisos que quien te invitó.",
  },
  admin: {
    can: [
      "Publicar, editar y pausar vacantes",
      "Atender postulantes: entrevistas, contrataciones y notas",
      "Editar los datos del negocio y sus sucursales",
    ],
    note: "El plan, los pagos y el equipo los maneja el dueño.",
  },
  reclutador: {
    can: [
      "Ver a quienes se postulan y sus perfiles",
      "Agendar entrevistas y marcar contrataciones",
      "Dejar notas que solo ve tu equipo",
    ],
    note: "Las vacantes, las sucursales y el plan los manejan el dueño o un administrador.",
  },
};

const who = (invite: InvitePreview | null) => invite?.inviterName?.trim() || "quien te invitó";

function branchesLabel(invite: InvitePreview): string {
  if (invite.branchNames === null) return "Todas";
  if (invite.branchNames.length === 0) return "Te las asignan al entrar";
  return invite.branchNames.join(", ");
}

function shortDate(iso: string): string | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short" }).format(d).replace(".", "");
}

/** "Unirme a Logística Zapalinamé"; long names fall back to "Unirme al equipo" so the button never wraps. */
const joinLabel = (company: string) => (company && company.length <= 22 ? `Unirme a ${company}` : "Unirme al equipo");

/** Does a typed email fit the masked hint ("lu•••@ejemplo.com": first 2 letters + domain)? */
export function fitsHint(email: string, hint: string): boolean {
  const at = hint.indexOf("@");
  if (at < 0) return true; // "•••": nothing to compare
  const [local, domain] = email.trim().toLowerCase().split("@");
  if (!local || !domain) return true; // still typing
  const head = hint.slice(0, at).replace(/•+$/, "").toLowerCase();
  return local.startsWith(head) && domain === hint.slice(at + 1).toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** The database's limit message, minus what the title already says: "Su plan permite 2 personas…". */
function limitHint(message: string): string {
  const n = message.match(/permite (\d+) personas/)?.[1];
  return n ? `Su plan permite ${n} personas y ya no queda lugar.` : message;
}

/* ------------------------------------------------------------------ hero per stage */

type Hero = { tone: HeroTone; art: HeroArt; title: string; hint: string; aside: string };

function heroFor(props: JoinScreenProps): Hero {
  const { stage, invite } = props;
  const company = invite?.companyName || "tu equipo";
  const invitedBy = invite?.inviterName?.trim();
  const invited = `${invitedBy || "Alguien"} te invitó a ayudar con las contrataciones.`;
  const welcome: Hero = {
    tone: "uva",
    art: { scene: "equipo" },
    title: `Únete a ${company}`,
    hint: invited,
    aside: "Sin registrar ningún negocio: entras directo al panel del equipo.",
  };
  const trouble = (title: string, hint: string, art: HeroArt = { scene: "vacio" }): Hero => ({
    tone: "mandarina",
    art,
    title,
    hint,
    aside: "Te decimos qué hacer para entrar.",
  });

  switch (stage.kind) {
    case "loading":
      return { ...welcome, title: "Abriendo tu invitación…", hint: "Un momento." };
    case "missing":
      return trouble("A este enlace le falta una parte", "Puede que se haya cortado al copiarlo.");
    case "error":
      return trouble("No pudimos abrir la invitación", stage.message);
    case "gone":
      switch (stage.reason) {
        case "not_found":
          return trouble("Este enlace ya no es válido", "Usa el correo más reciente o pide que te la reenvíen.");
        case "vencida":
          return trouble("La invitación venció", `Pide a ${who(invite)} que te la reenvíe.`);
        case "cancelada":
          return trouble("Esta invitación fue cancelada", `Si crees que es un error, pide a ${who(invite)} una nueva.`);
        case "usada":
          return props.alreadyMember
            ? { ...welcome, art: { scene: "exito" }, title: "Ya eres parte del equipo", hint: `Esta invitación ya se usó: ya estás en ${company}.` }
            : trouble(
                "Esta invitación ya se usó",
                props.signedIn ? `Si no fuiste tú, pide a ${who(invite)} una nueva.` : "Si fuiste tú, entra con tu correo para ver el panel.",
              );
      }
      break;
    case "email":
    case "checking":
    case "join":
      return welcome;
    case "code":
      return {
        tone: "mandarina",
        art: { scene: "codigo" },
        title: "Revisa tu correo",
        hint: "Escribe el código que te mandamos y entras directo al equipo.",
        aside: "Así sabemos que el correo es tuyo.",
      };
    case "candidate":
      return {
        ...welcome,
        title: "¿Usar tu cuenta como empresa?",
        hint: `${invitedBy || "Alguien"} te invitó a ${company}. Hoy tu cuenta es para buscar chamba.`,
        aside: "Una cuenta es de un solo tipo: para buscar chamba o para contratar.",
      };
    case "candidate-other":
      return trouble("Usa otro correo para el equipo", `Esta invitación es para ${invite?.emailHint ?? "tu correo"}, el de tu cuenta para buscar chamba.`, {
        scene: "busqueda",
      });
    case "wrong_email":
      return trouble("Entraste con otro correo", `Esta invitación es para ${invite?.emailHint ?? "otro correo"}.`, { scene: "codigo" });
    case "other_company":
      return trouble(
        "Ya estás en otro equipo",
        `Ya perteneces al equipo de ${props.otherCompany || "otro negocio"}. Cada persona puede estar en un solo negocio.`,
        { scene: "negocio" },
      );
    case "limit":
      return trouble("El equipo ya está completo", limitHint(stage.message), { scene: "equipo" });
    case "unconfirmed":
      return {
        tone: "uva",
        art: { scene: "codigo" },
        title: "Confirma tu correo",
        hint: `Te mandamos un código a ${props.accountEmail ?? "tu correo"} para confirmar que es tuyo.`,
        aside: "Es un paso, y luego entras al equipo.",
      };
    case "done":
      return { ...welcome, art: { scene: "exito" }, title: `¡Ya eres parte de ${company}!`, hint: "Te llevamos al panel del equipo…" };
  }
  return welcome;
}

/* ------------------------------------------------------------------ pieces */

const STAMP: Record<GoneReason | "done", { label: string; cls: string } | null> = {
  vencida: { label: "Vencida", cls: "border-chile text-chile" },
  cancelada: { label: "Cancelada", cls: "border-chile text-chile" },
  usada: { label: "Usada", cls: "border-ink text-ink" },
  done: { label: "Aceptada", cls: "border-nopal text-nopal" },
  not_found: null,
};

/** The invite as a stamped "pase": company, role, branches, and the email to enter with. */
function InvitePass({
  invite,
  stamp,
  company = false,
  signedIn = false,
  index = 1,
}: {
  invite: InvitePreview;
  stamp?: GoneReason | "done";
  /** Show the company row (when the hero doesn't name it). */
  company?: boolean;
  signedIn?: boolean;
  index?: number;
}) {
  const role = ROLE_META[invite.role];
  const s = stamp ? STAMP[stamp] : null;
  const date = shortDate(invite.expiresAt);
  // A stamped pass says it all (the stamp covers that corner).
  const chip = stamp ? null : date ? `Vence el ${date}` : null;
  const rows: [string, string][] = [];
  if (company) rows.push(["Negocio", invite.companyName || "—"]);
  rows.push(["Tu rol", role.long]);
  if (invite.role === "reclutador") rows.push(["Sucursales", branchesLabel(invite)]);
  rows.push([signedIn ? "Para" : "Entra con", invite.emailHint || "tu correo"]);

  return (
    <div className="relative animate-rise" style={{ "--i": index } as React.CSSProperties}>
      <div
        className={cn(
          "relative overflow-hidden rounded-[1.4rem] border-[3px] border-ink bg-white text-ink shadow-[6px_6px_0_0_var(--ink)] dark:shadow-[6px_6px_0_0_#000]",
          stamp && stamp !== "done" && "opacity-90",
        )}
      >
        <div className={cn("h-3", HAZARD)} />
        <div className="flex items-center justify-between gap-3 border-b-[3px] border-dashed border-ink/25 px-5 py-3">
          <span className="font-display text-[0.85rem] font-extrabold tracking-[0.14em] uppercase">Invitación</span>
          {chip ? (
            <span className="shrink-0 rounded-md bg-ink px-2 py-0.5 font-display text-[0.8rem] font-extrabold whitespace-nowrap text-limon">
              {chip}
            </span>
          ) : null}
        </div>
        <dl className="space-y-3 px-5 py-4 text-[1rem]">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4">
              <dt className="shrink-0 text-[0.8rem] font-bold tracking-[0.1em] text-ink/60 uppercase">{k}</dt>
              <span aria-hidden className="mb-1 min-w-4 flex-1 border-b-2 border-dotted border-ink/20" />
              <dd className="min-w-0 text-right font-display font-extrabold [overflow-wrap:anywhere]">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      {s ? (
        <span
          aria-hidden
          className={cn(
            "absolute -top-3 right-4 animate-pop-in rounded-lg border-[3px] bg-white/90 px-2.5 py-0.5 font-display text-[1.1rem] font-extrabold tracking-[0.12em] uppercase -rotate-12",
            s.cls,
          )}
        >
          {s.label}
        </span>
      ) : null}
    </div>
  );
}

function PassSkeleton() {
  return (
    <div aria-hidden className="overflow-hidden rounded-[1.4rem] border-[3px] border-ink/25 bg-white/70 dark:bg-white/10">
      <div className={cn("h-3 opacity-40", HAZARD)} />
      <div className="space-y-4 px-5 py-5">
        {[60, 85, 70, 78].map((w, i) => (
          <div key={i} className="flex items-center justify-between gap-4">
            <span className="h-3 w-20 animate-pulse rounded-full bg-ink/10 dark:bg-white/15" />
            <span className="h-4 animate-pulse rounded-full bg-ink/15 dark:bg-white/20" style={{ width: `${w / 2}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Ink circle with a lime tick (list bullet on pastel slabs). */
function Tick() {
  return (
    <span aria-hidden className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-ink text-limon">
      <HugeiconsIcon icon={Tick02Icon} className="size-3.5" strokeWidth={3.2} />
    </span>
  );
}

/** "Como reclutador podrás:" + three things, and what stays with the dueño. */
function RoleCan({ role, index = 2, last = false }: { role: TeamRole; index?: number; last?: boolean }) {
  const copy = ROLE_CAN[role];
  return (
    <Slab tone="menta" index={index} className={cn("mt-6 p-5", last && "mb-8 lg:mb-0")}>
      <p className="font-display text-[1.15rem] leading-tight font-extrabold tracking-[-0.015em]">
        Como {ROLE_META[role].long.toLowerCase()} podrás:
      </p>
      <ul className="mt-3 space-y-2.5 text-[0.98rem] leading-snug font-medium">
        {copy.can.map((c) => (
          <li key={c} className="flex items-start gap-2.5">
            <Tick />
            <span>{c}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3.5 border-t-2 border-dashed border-ink/20 pt-3 text-[0.9rem] leading-snug font-medium text-muted-foreground">
        {copy.note}
      </p>
    </Slab>
  );
}

/** Pastel slab with an icon tile, a bold line and supporting text (next steps, explanations). */
function InfoSlab({
  tone,
  icon,
  title,
  children,
  index = 2,
  className,
}: {
  tone: "sol" | "cielo" | "lila" | "limon" | "durazno" | "menta";
  icon: IconSvgElement;
  title: React.ReactNode;
  children?: React.ReactNode;
  index?: number;
  className?: string;
}) {
  return (
    <Slab tone={tone} index={index} className={cn("mt-6 flex items-start gap-3.5 p-4.5", className)}>
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-lg border-[2.5px] border-ink bg-white text-ink">
        <HugeiconsIcon icon={icon} className="size-5.5" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="font-display text-[1.08rem] leading-tight font-extrabold tracking-[-0.01em] break-words">{title}</p>
        {children ? <div className="mt-1.5 text-[0.95rem] leading-snug font-medium text-muted-foreground">{children}</div> : null}
      </div>
    </Slab>
  );
}

/** Numbered steps on a slab ("Qué hacer"). */
function Steps({ steps }: { steps: React.ReactNode[] }) {
  return (
    <ol className="mt-3 space-y-2.5 text-[0.98rem] leading-snug font-medium text-foreground">
      {steps.map((s, i) => (
        <li key={i} className="flex items-start gap-2.5">
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center rounded-md bg-ink font-display text-[0.8rem] font-extrabold text-limon tabular-nums"
          >
            {i + 1}
          </span>
          <span className="pt-0.5">{s}</span>
        </li>
      ))}
    </ol>
  );
}

/** PrimaryButton / SecondaryButton as a link (Slot needs one child, so the arrow goes inside the link). */
function LinkButton({ href, children, secondary }: { href: string; children: React.ReactNode; secondary?: boolean }) {
  return secondary ? (
    <SecondaryButton asChild>
      <Link href={href}>{children}</Link>
    </SecondaryButton>
  ) : (
    <PrimaryButton asChild arrow={false}>
      <Link href={href}>
        {children}
        <HugeiconsIcon
          icon={ArrowRight02Icon}
          className="size-6 transition-[translate] duration-200 group-hover/cta:translate-x-1"
          strokeWidth={2.6}
        />
      </Link>
    </PrimaryButton>
  );
}

const inlineLink =
  "rounded font-bold text-foreground underline decoration-2 underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/* ------------------------------------------------------------------ sign-in steps */

/**
 * What the screen shows around a form (the pass, the role card), rendered inside it: a sticky footer
 * can't rise above the top of its parent, so with the form starting low (under the pass) the button
 * started below the fold on small phones. Desktop is unchanged (the footer is static there).
 */
type FormSlots = { lead?: React.ReactNode; trail?: React.ReactNode };

function EmailStep({
  invite,
  demo,
  defaultEmail = "",
  passwordHref,
  onSend,
  lead,
  trail,
}: {
  invite: InvitePreview;
  demo?: boolean;
  defaultEmail?: string;
  passwordHref?: string | null;
  onSend: (email: string) => Promise<string | null>;
} & FormSlots) {
  const [email, setEmail] = useState(defaultEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const typed = email.trim();
  const mismatch = EMAIL_RE.test(typed) && !fitsHint(typed, invite.emailHint);
  const valid = EMAIL_RE.test(typed) && !mismatch;

  async function send() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const err = await onSend(typed);
    setBusy(false);
    if (err) setError(err);
  }

  return (
    <form
      className="flex flex-col"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
    >
      {lead}
      <Slab tone="cielo" index={3} className="mt-6 pt-4">
        <Label htmlFor="unirse-email" className="mb-3 font-display text-[1.1rem] font-extrabold tracking-[-0.01em]">
          Entra con tu correo
        </Label>
        <Input
          id="unirse-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="tucorreo@gmail.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={mismatch || !!error || undefined}
          aria-describedby="unirse-email-hint"
          className={BIG_INPUT}
        />
        <p id="unirse-email-hint" className="mt-3 text-[0.92rem] leading-snug font-medium text-muted-foreground">
          {demo ? "Demo: no mandamos nada. " : null}Usa el correo de la invitación: te mandamos un código para entrar.
        </p>
      </Slab>
      {mismatch ? (
        <AuthNote tone="info">
          Ese correo no es el de la invitación ({invite.emailHint}). Usa el correo donde te llegó.
        </AuthNote>
      ) : null}
      {error ? <AuthNote>{error}</AuthNote> : null}
      <StickyFooter>
        <PrimaryButton type="submit" disabled={!valid || busy} aria-busy={busy}>
          {busy ? <Spinner className="size-5" /> : null}
          {busy ? "Enviando…" : "Enviarme un código"}
        </PrimaryButton>
        {passwordHref ? (
          <p className="text-center text-[0.95rem] font-medium text-muted-foreground lg:text-left">
            ¿Tienes contraseña?{" "}
            <Link href={passwordHref} className={inlineLink}>
              Entra con ella
            </Link>
          </p>
        ) : null}
      </StickyFooter>
      {trail}
    </form>
  );
}

function CodeStep({
  email,
  demo,
  invite,
  onVerify,
  onResend,
  onChangeEmail,
  canChangeEmail = true,
}: {
  email: string;
  demo?: boolean;
  invite: InvitePreview | null;
  onVerify: (code: string) => Promise<string | null>;
  onResend: () => Promise<string | null>;
  onChangeEmail: () => void;
  canChangeEmail?: boolean;
}) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The resend timer starts with the code that was just sent (Supabase allows about one a minute).
  const wait = demo ? 30 : 60;
  const [seconds, setSeconds] = useState(wait);
  const counting = seconds > 0;
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setSeconds((v) => (v <= 1 ? 0 : v - 1)), 1000);
    return () => clearInterval(id);
  }, [counting]);

  async function verify(value = code) {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    const err = await onVerify(value);
    setBusy(false);
    if (err) {
      setError(err);
      setCode("");
    }
  }

  async function resend() {
    setError(null);
    const err = await onResend();
    if (err) setError(err);
    else setSeconds(wait);
  }

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void verify();
      }}
    >
      {invite ? (
        <p className="mb-4 flex animate-rise items-start gap-2 text-[0.95rem] leading-snug font-semibold text-muted-foreground">
          <HugeiconsIcon icon={Briefcase01Icon} className="mt-0.5 size-4.5 shrink-0" strokeWidth={2.2} />
          <span className="min-w-0">
            Invitación a <span className="font-bold text-foreground">{invite.companyName}</span> · {ROLE_META[invite.role].long}
          </span>
        </p>
      ) : null}
      <Slab tone="limon" index={1} className="pt-4">
        <p className="mb-4 text-[1.05rem] font-medium">
          Escribe el código de 6 números que te llegó a
          <span className="block font-display font-extrabold [overflow-wrap:anywhere]">{email}</span>
        </p>
        <CodeField
          value={code}
          onChange={(v) => {
            setCode(v);
            if (error) setError(null);
          }}
          onComplete={(v) => void verify(v)}
          disabled={busy}
        />
      </Slab>
      {demo ? (
        <div
          className="relative mt-5 animate-rise overflow-hidden rounded-[1.2rem] border-[3px] border-ink bg-block-sol text-ink"
          style={{ "--i": 2 } as React.CSSProperties}
        >
          <span aria-hidden className={cn("absolute inset-y-0 left-0 w-3", HAZARD)} />
          <p className="flex items-center gap-2.5 py-3 pr-4 pl-6 text-[0.95rem] font-semibold">
            <HugeiconsIcon icon={SecurityCheckIcon} className="size-5 shrink-0" strokeWidth={2.2} />
            Demo: cualquier código de 6 números funciona.
          </p>
        </div>
      ) : (
        <Slab tone="cielo" index={2} className="mt-4 flex items-start gap-3 p-4 text-[0.95rem] leading-snug font-medium">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border-2 border-ink bg-white text-ink">
            <HugeiconsIcon icon={MailOpen01Icon} className="size-5" strokeWidth={2.2} />
          </span>
          <span className="pt-0.5">
            <strong className="font-bold">¿Te llegó un enlace en lugar de un código?</strong> Tócalo desde este teléfono y
            vuelves directo a la invitación. Revisa también la carpeta de spam.
          </span>
        </Slab>
      )}
      {error ? <AuthNote>{error}</AuthNote> : null}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1">
        <ResendButton seconds={seconds} onClick={() => void resend()} disabled={busy} />
        {canChangeEmail ? (
          <button type="button" onClick={onChangeEmail} className={cn(linkBtn, "text-muted-foreground hover:text-foreground")}>
            Cambiar correo
          </button>
        ) : null}
      </div>
      <StickyFooter>
        <PrimaryButton type="submit" disabled={code.length !== 6 || busy} aria-busy={busy}>
          {busy ? <Spinner className="size-5" /> : null}
          {busy ? "Revisando…" : "Confirmar código"}
        </PrimaryButton>
      </StickyFooter>
    </form>
  );
}

function JoinForm({
  invite,
  askName,
  busy,
  problem,
  onJoin,
  lead,
  trail,
}: {
  invite: InvitePreview;
  askName: boolean;
  busy?: boolean;
  problem?: string | null;
  onJoin: (name?: string) => void;
} & FormSlots) {
  const [name, setName] = useState("");
  const valid = !askName || name.trim().length >= 2;
  return (
    <form
      className={cn("flex flex-col", !askName && "flex-1")}
      onSubmit={(e) => {
        e.preventDefault();
        if (valid && !busy) onJoin(askName ? name.trim() : undefined);
      }}
    >
      {lead}
      {askName ? (
        <Slab tone="sol" index={3} className="mt-6 pt-4">
          <Label htmlFor="unirse-nombre" className="mb-3 font-display text-[1.1rem] font-extrabold tracking-[-0.01em]">
            ¿Cómo te llamas?
          </Label>
          <Input
            id="unirse-nombre"
            autoComplete="name"
            autoCapitalize="words"
            placeholder="Tu nombre"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            className={BIG_INPUT}
          />
          <p className="mt-3 text-[0.92rem] font-medium text-muted-foreground">Así te verá tu equipo.</p>
        </Slab>
      ) : null}
      {problem ? <AuthNote>{problem}</AuthNote> : null}
      <StickyFooter>
        <PrimaryButton type="submit" disabled={!valid || busy} aria-busy={busy}>
          {busy ? <Spinner className="size-5" /> : null}
          {busy ? "Uniéndote al equipo…" : joinLabel(invite.companyName)}
        </PrimaryButton>
      </StickyFooter>
      {trail}
    </form>
  );
}

/* ------------------------------------------------------------------ the screen */

export function JoinTeamScreen(props: JoinScreenProps) {
  const { stage, invite, actions, demo, busy, problem } = props;
  const hero = heroFor(props);
  const homeHref = props.homeHref ?? "/";
  const home = (
    <LinkButton href={homeHref} secondary>
      {homeHref === "/" ? "Ir al inicio" : "Ir a mi cuenta"}
    </LinkButton>
  );

  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;

  switch (stage.kind) {
    case "loading":
      body = (
        <div role="status" aria-label="Cargando la invitación">
          <PassSkeleton />
          <div aria-hidden className="mt-6 h-40 animate-pulse rounded-[1.6rem] border-[3px] border-ink/15 bg-block-menta/50" />
        </div>
      );
      break;

    case "missing":
      body = (
        <InfoSlab tone="sol" icon={Mail01Icon} title="Ábrelo desde el correo de invitación" index={1} className="mt-0">
          Toca su botón «Unirme al equipo». Si prefieres copiar el enlace, cópialo completo.
        </InfoSlab>
      );
      footer = home;
      break;

    case "error":
      body = (
        <InfoSlab tone="sol" icon={Alert02Icon} title="Tu invitación no se pierde" index={1} className="mt-0">
          Revisa tu conexión y toca «Intentar de nuevo». Si sigue sin abrir, vuelve en un rato desde el mismo correo.
        </InfoSlab>
      );
      footer = (
        <PrimaryButton onClick={actions.retry} disabled={busy}>
          Intentar de nuevo
        </PrimaryButton>
      );
      break;

    case "gone": {
      const r = stage.reason;
      body = (
        <>
          {invite && r !== "not_found" ? (
            <InvitePass invite={invite} stamp={r === "usada" && props.alreadyMember ? "done" : r} company signedIn={props.signedIn} />
          ) : null}
          {r === "not_found" ? (
            <InfoSlab tone="sol" icon={Mail01Icon} title="¿Te llegaron varias invitaciones?" index={1} className="mt-0">
              Solo funciona la más reciente: cada reenvío cancela el enlace anterior. Ábrela desde el correo más nuevo.
            </InfoSlab>
          ) : r === "vencida" ? (
            <InfoSlab tone="sol" icon={Mail01Icon} title={invite && shortDate(invite.expiresAt) ? `Venció el ${shortDate(invite.expiresAt)}` : "Ya venció"}>
              Las invitaciones duran 7 días. Cuando te la reenvíen, entra desde el correo nuevo.
            </InfoSlab>
          ) : r === "cancelada" ? (
            <InfoSlab tone="sol" icon={Mail01Icon} title="Ya no se puede usar">
              Si te mandan una invitación nueva, entra desde ese correo.
            </InfoSlab>
          ) : props.alreadyMember ? null : (
            <InfoSlab tone="sol" icon={UserSwitchIcon} title={props.signedIn ? "Cada invitación sirve una vez" : "¿La aceptaste tú?"}>
              {props.signedIn
                ? `Si necesitas entrar al equipo, pide a ${who(invite)} una nueva para tu correo.`
                : "Entra con el correo de la invitación y verás el panel del equipo."}
            </InfoSlab>
          )}
        </>
      );
      footer =
        r === "usada" && props.alreadyMember ? (
          <LinkButton href="/empresa">Ir al panel</LinkButton>
        ) : r === "usada" && !props.signedIn ? (
          <LinkButton href="/entrar">Entrar</LinkButton>
        ) : (
          home
        );
      break;
    }

    case "email":
      if (!invite) break;
      body = (
        <EmailStep
          invite={invite}
          demo={demo}
          defaultEmail={props.defaultEmail}
          passwordHref={props.passwordHref}
          onSend={actions.sendCode}
          lead={<InvitePass invite={invite} />}
          trail={<RoleCan role={invite.role} index={4} last />}
        />
      );
      break;

    case "code":
    case "unconfirmed":
      if (stage.kind === "unconfirmed") {
        body = (
          <>
            {invite ? <InvitePass invite={invite} company signedIn /> : null}
            <InfoSlab tone="cielo" icon={MailOpen01Icon} title="Un código y listo">
              Tu cuenta todavía no confirma este correo. Te mandamos un código a{" "}
              <span className="font-bold break-all text-foreground">{props.accountEmail}</span> y al escribirlo entras al
              equipo.
            </InfoSlab>
            {problem ? <AuthNote>{problem}</AuthNote> : null}
          </>
        );
        footer = (
          <PrimaryButton
            disabled={busy || !props.accountEmail}
            aria-busy={busy}
            onClick={() => props.accountEmail && void actions.sendCode(props.accountEmail)}
          >
            {busy ? <Spinner className="size-5" /> : null}
            {busy ? "Enviando…" : "Enviarme un código"}
          </PrimaryButton>
        );
        break;
      }
      body = (
        <CodeStep
          key={stage.email}
          email={stage.email}
          demo={demo}
          invite={invite}
          onVerify={actions.verifyCode}
          onResend={() => actions.sendCode(stage.email)}
          onChangeEmail={actions.changeEmail}
          canChangeEmail={!props.signedIn}
        />
      );
      break;

    case "checking":
    case "join":
    case "done": {
      if (!invite) break;
      const pass = <InvitePass invite={invite} signedIn stamp={stage.kind === "done" ? "done" : undefined} />;
      body =
        stage.kind === "join" && stage.askName ? (
          <JoinForm
            invite={invite}
            askName
            busy={busy}
            problem={problem}
            onJoin={actions.join}
            lead={pass}
            trail={<RoleCan role={invite.role} index={4} last />}
          />
        ) : stage.kind === "join" ? (
          <JoinForm
            invite={invite}
            askName={false}
            busy={busy}
            problem={problem}
            onJoin={actions.join}
            lead={
              <>
                {pass}
                <RoleCan role={invite.role} />
              </>
            }
          />
        ) : (
          <>
            {pass}
            <RoleCan role={invite.role} />
          </>
        );
      if (stage.kind !== "join") {
        footer = (
          <PrimaryButton disabled aria-busy arrow={false}>
            <Spinner className="size-5" />
            {stage.kind === "done" ? "Abriendo el panel…" : "Revisando tu cuenta…"}
          </PrimaryButton>
        );
      }
      break;
    }

    case "candidate":
      if (!invite) break;
      body = (
        <>
          <InvitePass invite={invite} signedIn />
          <Slab tone="sol" index={2} className="mt-6 p-5">
            <p className="font-display text-[1.15rem] leading-tight font-extrabold tracking-[-0.015em]">
              Si usas esta cuenta para el equipo:
            </p>
            <ul className="mt-3 space-y-2.5 text-[0.98rem] leading-snug font-medium">
              <li className="flex items-start gap-2.5">
                <Tick />
                <span>Tu perfil y tus postulaciones se quedan guardados.</span>
              </li>
              <li className="flex items-start gap-2.5">
                <Tick />
                <span>
                  Tu cuenta pasa a ser de empresa: entras al panel de <strong className="font-bold">{invite.companyName}</strong>.
                </span>
              </li>
            </ul>
            <p className="mt-3.5 border-t-2 border-dashed border-ink/20 pt-3 text-[0.9rem] leading-snug font-medium text-muted-foreground">
              ¿Quieres seguir buscando chamba con esta cuenta? Usa otro correo para el equipo.
            </p>
          </Slab>
          {problem ? <AuthNote>{problem}</AuthNote> : null}
        </>
      );
      footer = (
        <>
          <PrimaryButton onClick={actions.useCompanyAccount} disabled={busy} aria-busy={busy}>
            {busy ? <Spinner className="size-5" /> : null}
            {busy ? "Uniéndote al equipo…" : "Usar mi cuenta como empresa"}
          </PrimaryButton>
          <SecondaryButton onClick={actions.candidateOther} disabled={busy}>
            Usar otro correo
          </SecondaryButton>
        </>
      );
      break;

    case "candidate-other":
      body = (
        <Slab tone="cielo" index={1} className="p-5">
          <p className="font-display text-[1.15rem] leading-tight font-extrabold tracking-[-0.015em]">Qué hacer</p>
          <Steps
            steps={[
              <>Pide a {who(invite)} que te invite con otro correo.</>,
              <>Abre esa invitación y entra con ese correo: será tu cuenta del equipo.</>,
              <>Esta cuenta se queda como está, para buscar chamba.</>,
            ]}
          />
        </Slab>
      );
      footer = (
        <>
          <LinkButton href="/inicio">Seguir buscando chamba</LinkButton>
          <SecondaryButton onClick={actions.backToChoice}>Volver</SecondaryButton>
        </>
      );
      break;

    case "wrong_email":
      body = (
        <>
          {invite ? <InvitePass invite={invite} company signedIn /> : null}
          <InfoSlab tone="sol" icon={UserSwitchIcon} title={<>Entraste como {props.accountEmail ?? "otra cuenta"}</>}>
            Sal de esta cuenta y entra con <span className="font-bold text-foreground">{invite?.emailHint ?? "el correo de la invitación"}</span>. Te
            mandamos un código.
          </InfoSlab>
          {problem ? <AuthNote>{problem}</AuthNote> : null}
        </>
      );
      footer = (
        <>
          <PrimaryButton onClick={actions.switchAccount} disabled={busy} aria-busy={busy}>
            {busy ? <Spinner className="size-5" /> : null}
            Entrar con otro correo
          </PrimaryButton>
          <p className="text-center text-[0.95rem] font-medium text-muted-foreground lg:text-left">
            <Link href={homeHref} className={inlineLink}>
              Seguir con esta cuenta
            </Link>
          </p>
        </>
      );
      break;

    case "other_company":
      body = (
        <Slab tone="cielo" index={1} className="p-5">
          <p className="font-display text-[1.15rem] leading-tight font-extrabold tracking-[-0.015em]">Para unirte a {invite?.companyName || "este equipo"}</p>
          <Steps
            steps={[
              <>
                Abre <strong className="font-bold">Tu equipo</strong> y toca «Salir de la empresa».
              </>,
              <>Vuelve a abrir este enlace desde el correo de invitación.</>,
            ]}
          />
          <p className="mt-3.5 flex items-start gap-2 border-t-2 border-dashed border-ink/20 pt-3 text-[0.9rem] leading-snug font-medium text-muted-foreground">
            <HugeiconsIcon icon={Store01Icon} className="mt-0.5 size-4.5 shrink-0" strokeWidth={2.2} />
            Si eres el único dueño, primero nombra a otra persona como dueña.
          </p>
        </Slab>
      );
      footer = <LinkButton href="/empresa/equipo">Ir a Tu equipo</LinkButton>;
      break;

    case "limit":
      body = (
        <>
          {invite ? <InvitePass invite={invite} company signedIn /> : null}
          <InfoSlab tone="sol" icon={Alert02Icon} title={`Avísale a ${who(invite)}`}>
            Puede liberar un lugar en su equipo o cambiar de plan. Después, toca «Intentar de nuevo».
          </InfoSlab>
          {problem ? <AuthNote>{problem}</AuthNote> : null}
        </>
      );
      footer = (
        <PrimaryButton onClick={actions.retry} disabled={busy} aria-busy={busy}>
          {busy ? <Spinner className="size-5" /> : null}
          Intentar de nuevo
        </PrimaryButton>
      );
      break;
  }

  return (
    <FlowShell
      tone={hero.tone}
      art={hero.art}
      title={hero.title}
      hint={hero.hint}
      aside={hero.aside}
      stepKey={stage.kind === "gone" ? `gone-${stage.reason}` : stage.kind}
      footer={footer}
    >
      {body}
    </FlowShell>
  );
}
