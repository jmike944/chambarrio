"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Call02Icon, Store01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Spinner } from "@/components/ui/spinner";
import { useConfetti } from "@/components/chamba/motion";
import { claimCompany, fetchClaimPreview, loadSession, type ClaimPreview } from "@/lib/live/backend";
import { useLiveAuth } from "@/lib/live/auth-state";
import { signOutEverywhere, useLiveUser, useSessionLoaded, useSessionReady } from "@/lib/live/session";
import { isLiveAvailable, useApp, useHydrated } from "@/lib/store";
import { sendCode, verifyCode } from "@/lib/supabase/auth";
import { cn } from "@/lib/utils";
import { FlowShell, HAZARD, PrimaryButton, SecondaryButton, WORK_CONFETTI, type HeroArt, type HeroTone } from "./flow";
import { AuthNote } from "./live-auth";
import { PhoneLoginDialog } from "./phone-login-dialog";
import { CodeField, PhoneField, ResendButton, formatPhone, linkBtn, useCountdown } from "./phone-verify";

/*
 * /reclamar?empresa=<id>: a company Chambarrio published from public information ("vacantes curadas")
 * becomes the claimer's. Proof: being signed in with the SMS-verified celular printed in its vacancies
 * (claim_company checks it in the database). Signed out, the page signs you in by SMS right here and
 * claims as soon as the account is ready; signed in with another number, it links the vacancy's
 * number to the account first (PhoneLoginDialog). Then: dueño of the company → /empresa.
 */

const RESEND = 60;

type Stage =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "demo" }
  | { kind: "error"; message: string }
  | { kind: "not_found" }
  /** Someone already manages it. `mine`: it's the signed-in user's own company. */
  | { kind: "taken"; mine: boolean }
  /** Signed out: type the vacancy's celular. */
  | { kind: "phone" }
  | { kind: "code"; phone: string }
  /** Signed in, profile still loading. */
  | { kind: "checking" }
  /** Signed in. match: the account's sign-in celular is one that can claim (yes), another one (no), none (none). */
  | { kind: "ready"; match: "yes" | "no" | "none" }
  | { kind: "other_company"; name: string | null }
  | { kind: "done" };

function subscribeNothing() {
  return () => {};
}
/** ?empresa= on the client; undefined while rendering on the server. */
function useCompanyParam(): string | null | undefined {
  return useSyncExternalStore(
    subscribeNothing,
    () => new URLSearchParams(window.location.search).get("empresa")?.trim() || null,
    () => undefined,
  );
}

/** "+528441234501" / "8441234501" → "8441234501", or "". */
const ten = (raw: string | null | undefined) => {
  const d = (raw ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : "";
};
const hintText = (hints: string[]) => (hints.length ? hints.map((h) => `•• ${h}`).join(" o ") : "el de la vacante");

export function ClaimCompany() {
  const companyId = useCompanyParam();
  if (companyId === undefined) return <ClaimScreen stage={{ kind: "loading" }} preview={null} />;
  if (!isLiveAvailable) return <ClaimScreen stage={{ kind: "demo" }} preview={null} />;
  if (!companyId) return <ClaimScreen stage={{ kind: "missing" }} preview={null} />;
  return <LiveClaim companyId={companyId} />;
}

function LiveClaim({ companyId }: { companyId: string }) {
  const router = useRouter();
  const fire = useConfetti();
  const hydrated = useHydrated();
  const ready = useSessionReady();
  const loaded = useSessionLoaded();
  const sessionError = useLiveAuth((s) => s.sessionError);
  const mode = useApp((s) => s.mode);
  const signedIn = useApp((s) => s.signedIn);
  const onboarded = useApp((s) => s.onboarded);
  const myCompanyId = useApp((s) => (s.mode === "live" ? (s.business?.id ?? null) : null));
  const myCompanyName = useApp((s) => s.business?.name ?? null);
  const { user } = useLiveUser();
  const live = mode === "live" && signedIn;

  // The company (public), read again after each claim attempt (someone may have claimed it meanwhile).
  const [nonce, setNonce] = useState(0);
  const [read, setRead] = useState<{ key: string; r: Awaited<ReturnType<typeof fetchClaimPreview>> } | null>(null);
  const key = `${companyId}#${nonce}`;
  useEffect(() => {
    if (!hydrated) return;
    let alive = true;
    void fetchClaimPreview(companyId).then((r) => {
      if (alive) setRead({ key, r });
    });
    return () => {
      alive = false;
    };
  }, [companyId, key, hydrated]);
  const shown = read?.r ?? null;
  const preview = shown && shown.error === undefined ? shown.data : null;

  // For a real company, leave the demo (or a local onboarding draft) first: signing in would otherwise
  // save that draft as a brand-new business, and claiming would then fail with "other_company".
  const leaving = hydrated && !!preview && (mode === "demo" || (mode === null && onboarded));
  useEffect(() => {
    if (leaving) useApp.getState().exitDemo();
  }, [leaving]);

  const [codeTo, setCodeTo] = useState<string | null>(null);
  const [override, setOverride] = useState<Stage | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [done, setDone] = useState(false);
  /** Signed in from this page: claim as soon as the account is ready (no extra tap). */
  const autoClaim = useRef(false);
  const doneRef = useRef(false);

  // Routes stay mounted after navigating away: coming back starts fresh.
  useLayoutEffect(() => {
    return () => {
      if (!doneRef.current) return;
      doneRef.current = false;
      setDone(false);
      setBusy(false);
      setOverride(null);
      setNonce((n) => n + 1);
    };
  }, []);

  const myPhone = ten(user?.phone);
  const match: "yes" | "no" | "none" = !myPhone ? "none" : !preview?.phoneHints.length || preview.phoneHints.includes(myPhone.slice(-2)) ? "yes" : "no";

  let stage: Stage;
  if (done) stage = { kind: "done" };
  else if (!shown || !ready) stage = { kind: "loading" };
  else if (shown.error !== undefined) stage = { kind: "error", message: shown.error };
  else if (!preview) stage = { kind: "not_found" };
  else if (leaving) stage = { kind: "loading" };
  else if (override) stage = override;
  else if (!preview.claimable) stage = { kind: "taken", mine: live && myCompanyId === preview.companyId };
  else if (!live) stage = codeTo ? { kind: "code", phone: codeTo } : { kind: "phone" };
  else if (!loaded) stage = sessionError ? { kind: "error", message: sessionError } : { kind: "checking" };
  else if (myCompanyId && myCompanyId !== preview.companyId) stage = { kind: "other_company", name: myCompanyName };
  else stage = { kind: "ready", match };

  async function claim() {
    if (busy || !preview) return;
    setBusy(true);
    setProblem(null);
    const r = await claimCompany(preview.companyId);
    if (r.error !== undefined) {
      setBusy(false);
      switch (r.reason) {
        case "not_signed_in":
          await signOutEverywhere();
          window.location.reload();
          return;
        case "not_found":
          return setOverride({ kind: "not_found" });
        case "taken":
          setNonce((n) => n + 1);
          return setOverride({ kind: "taken", mine: false });
        case "other_company":
          return setOverride({ kind: "other_company", name: myCompanyName });
        case "no_phone":
        case "wrong_phone":
          // Show the "link the vacancy's celular" step (the hints may say it matched: the server knows better).
          return setProblem(r.error);
        default:
          return setProblem(r.error);
      }
    }
    doneRef.current = true;
    setDone(true);
    fire({ colors: WORK_CONFETTI });
    toast.success(`¡${r.data.companyName || preview.companyName} ya es tuya en Chambarrio!`);
    await loadSession();
    router.replace("/empresa");
  }

  // Signed in from this page with the right celular: claim right away.
  const canAuto = stage.kind === "ready" && stage.match === "yes";
  useEffect(() => {
    if (!canAuto || !autoClaim.current) return;
    autoClaim.current = false;
    void claim();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the account is ready
  }, [canAuto]);

  return (
    <>
      <ClaimScreen
        stage={stage}
        preview={preview}
        busy={busy}
        problem={problem}
        myPhone={myPhone}
        actions={{
          sendCode: async (phone) => {
            const err = await sendCode("sms", phone, undefined, undefined, "empresa");
            if (!err) setCodeTo(phone);
            return err;
          },
          verifyCode: async (code) => {
            if (!codeTo) return "Vuelve a pedir el código.";
            autoClaim.current = true;
            const err = await verifyCode("sms", codeTo, code);
            if (err) autoClaim.current = false;
            return err;
          },
          changePhone: () => setCodeTo(null),
          claim: () => void claim(),
          linkPhone: () => setLinkOpen(true),
          switchAccount: async () => {
            await signOutEverywhere();
            window.location.reload();
          },
          retry: () => {
            setOverride(null);
            setProblem(null);
            setNonce((n) => n + 1);
          },
        }}
      />
      <PhoneLoginDialog
        open={linkOpen}
        onOpenChange={(open) => {
          setLinkOpen(open);
          if (!open) setProblem(null);
        }}
        current={user?.phone ?? null}
      />
    </>
  );
}

/* ================================================================== screens */

type ClaimActions = {
  /** Resolves an error message, or null once the code went out. */
  sendCode: (phone: string) => Promise<string | null>;
  /** Resolves an error message, or null once signed in. */
  verifyCode: (code: string) => Promise<string | null>;
  changePhone: () => void;
  claim: () => void;
  /** Link the vacancy's celular to the signed-in account (SMS code). */
  linkPhone: () => void;
  switchAccount: () => void;
  retry: () => void;
};

const NOOP: ClaimActions = {
  sendCode: async () => null,
  verifyCode: async () => null,
  changePhone: () => {},
  claim: () => {},
  linkPhone: () => {},
  switchAccount: () => {},
  retry: () => {},
};

type Hero = { tone: HeroTone; art: HeroArt; title: string; hint: string; aside: string };

function heroFor(stage: Stage, preview: ClaimPreview | null): Hero {
  const name = preview?.companyName || "tu empresa";
  const welcome: Hero = {
    tone: "uva",
    art: { scene: "negocio" },
    title: `Reclama ${name}`,
    hint: "Publicamos sus vacantes con información pública. Hazla tuya gratis y recibe las postulaciones aquí.",
    aside: "Te toma un minuto: solo confirmamos que el celular de la vacante es tuyo.",
  };
  const trouble = (title: string, hint: string, art: HeroArt = { scene: "vacio" }): Hero => ({
    tone: "mandarina",
    art,
    title,
    hint,
    aside: "Escríbenos a hola@chambarrio.com si algo no cuadra.",
  });
  switch (stage.kind) {
    case "loading":
    case "checking":
      return { ...welcome, title: preview ? welcome.title : "Abriendo…", hint: "Un momento." };
    case "missing":
      return trouble("A este enlace le falta una parte", "Puede que se haya cortado al copiarlo. Ábrelo desde la vacante.");
    case "demo":
      return trouble("Esto funciona en la versión en vivo", "En la demostración no hay empresas por reclamar.", { scene: "negocio" });
    case "error":
      return trouble("No pudimos abrir la empresa", stage.message);
    case "not_found":
      return trouble("No encontramos esa empresa", "Puede que el enlace esté incompleto o que la hayamos quitado.");
    case "taken":
      return stage.mine
        ? { ...welcome, art: { scene: "exito" }, title: `${name} ya es tuya`, hint: "Ya la administras en Chambarrio." }
        : trouble("Esta empresa ya tiene quien la administre", "Pide a esa persona que te invite a su equipo desde su panel.", { scene: "equipo" });
    case "phone":
    case "ready":
      return welcome;
    case "code":
      return {
        tone: "mandarina",
        art: { scene: "codigo" },
        title: "Revisa tus mensajes",
        hint: `Escribe el código que mandamos por SMS al ${formatPhone(stage.phone)}.`,
        aside: "Así sabemos que el celular de la vacante es tuyo.",
      };
    case "other_company":
      return trouble(
        "Ya administras otro negocio",
        `Tu cuenta es de ${stage.name || "otro negocio"}. Cada cuenta puede tener un solo negocio: entra con otra cuenta para reclamar este.`,
        { scene: "negocio" },
      );
    case "done":
      return { ...welcome, art: { scene: "exito" }, title: `¡${name} ya es tuya!`, hint: "Te llevamos a tu panel…" };
  }
}

/** The company as a stamped card: name, its vacancies on Chambarrio, and the celular that claims it. */
function CompanyCard({ preview, stamp }: { preview: ClaimPreview; stamp?: "done" }) {
  const rows: [string, string][] = [
    ["Negocio", preview.companyName],
    ["Vacantes publicadas", preview.openJobs === 1 ? "1 vacante" : `${preview.openJobs} vacantes`],
    ["Se reclama con", preview.phoneHints.length ? `el celular ${hintText(preview.phoneHints)}` : "el celular de la vacante"],
  ];
  return (
    <div className="relative animate-rise" style={{ "--i": 1 } as React.CSSProperties}>
      <div className="relative overflow-hidden rounded-[1.4rem] border-[3px] border-ink bg-white text-ink shadow-[6px_6px_0_0_var(--ink)] dark:shadow-[6px_6px_0_0_#000]">
        <div className={cn("h-3", HAZARD)} />
        <div className="flex items-center gap-2 border-b-[3px] border-dashed border-ink/25 px-5 py-3">
          <HugeiconsIcon icon={Store01Icon} className="size-5" strokeWidth={2.2} />
          <span className="font-display text-[0.85rem] font-extrabold tracking-[0.14em] uppercase">Ficha de la empresa</span>
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
      {stamp ? (
        <span
          aria-hidden
          className="absolute -top-3 -right-2 rotate-12 rounded-lg border-[3px] border-nopal bg-white/90 px-2.5 py-1 font-display text-[1rem] font-extrabold tracking-[0.12em] text-nopal uppercase"
        >
          Reclamada
        </span>
      ) : null}
    </div>
  );
}

const WHAT_YOU_GET = [
  "Recibe postulaciones con la colonia y la distancia de cada persona",
  "Edita, pausa o cierra tus vacantes cuando quieras",
  "Publica más vacantes en tus sucursales, gratis",
];

function ClaimScreen({
  stage,
  preview,
  actions = NOOP,
  busy = false,
  problem = null,
  myPhone = "",
}: {
  stage: Stage;
  preview: ClaimPreview | null;
  actions?: ClaimActions;
  busy?: boolean;
  problem?: string | null;
  myPhone?: string;
}) {
  const hero = heroFor(stage, preview);
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useCountdown();
  const hints = useMemo(() => preview?.phoneHints ?? [], [preview]);
  const fits = phone.length === 10 && (hints.length === 0 || hints.includes(phone.slice(-2)));

  async function send(to: string) {
    if (sending) return;
    setSending(true);
    setError(null);
    const err = await actions.sendCode(to);
    setSending(false);
    if (err) return setError(err);
    setCode("");
    setSeconds(RESEND);
  }

  async function verify(value: string) {
    if (sending || value.length !== 6) return;
    setSending(true);
    setError(null);
    const err = await actions.verifyCode(value);
    setSending(false);
    if (err) {
      setError(err);
      setCode("");
    }
  }

  let body: React.ReactNode = null;
  let footer: React.ReactNode = null;

  switch (stage.kind) {
    case "loading":
    case "checking":
      body = (
        <p className="flex items-center gap-2.5 font-semibold text-muted-foreground">
          <Spinner className="size-5" /> Cargando…
        </p>
      );
      break;
    case "missing":
    case "not_found":
    case "error":
    case "demo":
      body = preview ? <CompanyCard preview={preview} /> : null;
      footer = (
        <>
          {stage.kind === "error" ? <PrimaryButton onClick={actions.retry}>Intentar de nuevo</PrimaryButton> : null}
          <SecondaryButton asChild>
            <Link href="/empresas">Conoce Chambarrio para empresas</Link>
          </SecondaryButton>
        </>
      );
      break;
    case "taken":
      body = preview ? <CompanyCard preview={preview} /> : null;
      footer = stage.mine ? (
        <PrimaryButton asChild arrow={false}>
          <Link href="/empresa">Ir a mi panel</Link>
        </PrimaryButton>
      ) : (
        <SecondaryButton asChild>
          <Link href="/empresas">Conoce Chambarrio para empresas</Link>
        </SecondaryButton>
      );
      break;
    case "other_company":
      body = preview ? <CompanyCard preview={preview} /> : null;
      footer = (
        <>
          <PrimaryButton asChild arrow={false}>
            <Link href="/empresa">Ir a mi panel</Link>
          </PrimaryButton>
          <SecondaryButton onClick={actions.switchAccount}>Usar otra cuenta</SecondaryButton>
        </>
      );
      break;
    case "phone":
      body = (
        <>
          {preview ? <CompanyCard preview={preview} /> : null}
          <form
            className="mt-7"
            onSubmit={(e) => {
              e.preventDefault();
              if (fits) void send(phone);
            }}
            id="claim-phone"
          >
            <PhoneField id="claim-phone-input" value={phone} onChange={setPhone} label="El celular que aparece en la vacante" />
            {phone.length === 10 && !fits ? (
              <AuthNote tone="info">
                Ese número no es el de la vacante (termina en {hints.join(" o ")}). Usa el que aparece publicado.
              </AuthNote>
            ) : null}
            {error ? <AuthNote>{error}</AuthNote> : null}
          </form>
        </>
      );
      footer = (
        <>
          <PrimaryButton type="submit" form="claim-phone" disabled={!fits || sending}>
            {sending ? <Spinner className="size-5" /> : null}
            Mandarme el código
          </PrimaryButton>
          <p className="text-center text-[0.9rem] text-muted-foreground">
            Te mandamos un SMS. Si ya tienes cuenta con ese número, entras a ella.
          </p>
        </>
      );
      break;
    case "code":
      body = (
        <>
          <CodeField value={code} onChange={setCode} onComplete={(v) => void verify(v)} disabled={sending} />
          {error ? <AuthNote>{error}</AuthNote> : null}
          <div className="mt-5 flex flex-wrap items-center gap-x-5">
            <ResendButton seconds={seconds} onClick={() => void send(stage.phone)} disabled={sending} />
            <button type="button" className={cn(linkBtn, "text-foreground")} onClick={actions.changePhone}>
              Cambiar número
            </button>
          </div>
        </>
      );
      footer = (
        <PrimaryButton onClick={() => void verify(code)} disabled={code.length !== 6 || sending}>
          {sending ? <Spinner className="size-5" /> : null}
          Confirmar
        </PrimaryButton>
      );
      break;
    case "ready": {
      const wrong = stage.match !== "yes";
      body = (
        <>
          {preview ? <CompanyCard preview={preview} /> : null}
          <ul className="mt-6 space-y-2 text-[1rem]">
            {WHAT_YOU_GET.map((t) => (
              <li key={t} className="flex items-start gap-2.5">
                <span aria-hidden className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border-2 border-ink bg-block-limon text-ink">
                  <HugeiconsIcon icon={Tick02Icon} className="size-3.5" strokeWidth={3} />
                </span>
                {t}
              </li>
            ))}
          </ul>
          {wrong || problem ? (
            <AuthNote
              tone={problem ? "error" : "info"}
              action={
                <button type="button" className={cn(linkBtn, "text-ink")} onClick={actions.linkPhone}>
                  Verificar el celular de la vacante
                </button>
              }
            >
              {problem ??
                (stage.match === "none"
                  ? `Tu cuenta no tiene un celular verificado. Verifica el de la vacante (${hintText(hints)}) para reclamarla.`
                  : `Entraste con el ${formatPhone(myPhone)}, y la vacante tiene ${hintText(hints)}. Verifica ese número para reclamarla.`)}
            </AuthNote>
          ) : null}
        </>
      );
      footer = (
        <>
          <PrimaryButton onClick={actions.claim} disabled={busy}>
            {busy ? <Spinner className="size-5" /> : null}
            {preview && preview.companyName.length <= 20 ? `Reclamar ${preview.companyName}` : "Reclamar mi empresa"}
          </PrimaryButton>
          <p className="flex items-center justify-center gap-1.5 text-center text-[0.9rem] text-muted-foreground">
            <HugeiconsIcon icon={Call02Icon} className="size-4" strokeWidth={2} />
            {myPhone ? `Tu celular: ${formatPhone(myPhone)}` : "Sin celular verificado"}
          </p>
        </>
      );
      break;
    }
    case "done":
      body = preview ? <CompanyCard preview={preview} stamp="done" /> : null;
      break;
  }

  return (
    <FlowShell
      title={hero.title}
      hint={hero.hint}
      aside={hero.aside}
      tone={hero.tone}
      art={hero.art}
      stepKey={stage.kind}
      footer={footer ?? undefined}
    >
      {body}
    </FlowShell>
  );
}
