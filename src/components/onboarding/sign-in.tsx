"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlayIcon } from "@hugeicons/core-free-icons";
import { isLiveAvailable, useApp, type Role } from "@/lib/store";
import { useSessionReady } from "@/lib/live/session";
import { useConfetti } from "@/components/chamba/motion";
import { CategoryArt } from "@/components/chamba/job-icons";
import { Scene } from "@/components/chamba/art/scenes";
import { cn } from "@/lib/utils";
import { ChoiceCard, FlowShell, Slab, WORK_CONFETTI, focusRing } from "./flow";
import { AuthNote, CodeAuth, MethodPicker, PasswordAuth, useRouteAfterSignIn, type Method } from "./live-auth";

const MODE_COPY: Record<Role, { aside: string; hint: string }> = {
  candidato: {
    aside: "Qué gusto verte de nuevo.",
    hint: "Ve tus vacantes cerca y sigue tus postulaciones.",
  },
  empresa: {
    aside: "Tu próxima contratación vive cerca.",
    hint: "Entra al panel de tu negocio.",
  },
};

const METHODS = ["email", "sms", "password"] as const satisfies readonly Method[];
const METHOD_KEY = "chamba-entrar-metodo";

function rememberedMethod(): Method {
  try {
    const v = window.localStorage.getItem(METHOD_KEY);
    return v === "sms" || v === "password" ? v : "email";
  } catch {
    return "email";
  }
}
function rememberMethod(m: Method) {
  try {
    window.localStorage.setItem(METHOD_KEY, m);
  } catch {
    /* private mode: just don't remember */
  }
}

/** `?error=enlace` from /auth/confirm (expired or reused email link). No Suspense needed. */
function subscribeNothing() {
  return () => {};
}
function useLinkError() {
  return useSyncExternalStore(
    subscribeNothing,
    () => new URLSearchParams(window.location.search).get("error") === "enlace",
    () => false,
  );
}

const linkCls =
  "rounded font-bold text-foreground underline decoration-2 underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** "¿Solo quieres ver cómo funciona?" → straight into the demo. */
function DemoOffer({ onPick, role, index = 3 }: { onPick: (r: Role) => void; role?: Role; index?: number }) {
  const btn = cn(
    "press inline-flex h-12 items-center gap-2 rounded-full border-[2.5px] border-ink bg-white px-4 font-display text-[0.98rem] font-extrabold text-ink transition-[scale,background-color] hover:bg-block-sol",
    focusRing,
  );
  return (
    <Slab tone="limon" index={index} className="mt-6 p-4">
      <p className="flex items-center gap-3 text-[0.98rem] font-medium">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-lg border-[2.5px] border-ink bg-white text-ink"
        >
          <HugeiconsIcon icon={PlayIcon} className="size-5" strokeWidth={2.4} />
        </span>
        <span>
          <strong className="font-display font-extrabold">¿Solo quieres ver cómo funciona?</strong>
          <span className="block text-[0.9rem] text-muted-foreground">Prueba la demo con datos de ejemplo de Saltillo.</span>
        </span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2.5">
        {role ? (
          <button type="button" className={btn} onClick={() => onPick(role)}>
            Probar la demo
          </button>
        ) : (
          <>
            <button type="button" className={btn} onClick={() => onPick("candidato")}>
              Demo: busco chamba
            </button>
            <button type="button" className={btn} onClick={() => onPick("empresa")}>
              Demo: tengo un negocio
            </button>
          </>
        )}
      </div>
    </Slab>
  );
}

/**
 * /entrar. Live: pick your side, then email code (default), SMS code or password.
 * Demo-only build: just the demo entry.
 */
export function SignIn() {
  const router = useRouter();
  const fire = useConfetti();
  const ready = useSessionReady();
  const lastRole = useApp((s) => s.role);
  const appMode = useApp((s) => s.mode);
  const signedIn = useApp((s) => s.signedIn);
  const enterDemo = useApp((s) => s.enterDemo);
  const resumeDemo = useApp((s) => s.signIn);
  const exitDemo = useApp((s) => s.exitDemo);
  const linkError = useLinkError();
  const [mode, setMode] = useState<Role | null>(null);
  const [method, setMethodState] = useState<Method>("email");
  const { start, pending } = useRouteAfterSignIn();
  const finished = useRef(false);

  // Routes stay mounted after navigation; start fresh next time once sign-in completes.
  useLayoutEffect(() => {
    return () => {
      if (finished.current) {
        finished.current = false;
        setMode(null);
      }
    };
  }, []);

  // Already signed in to a real account (back button, bookmark): straight to the app.
  const liveIn = appMode === "live" && signedIn;
  useEffect(() => {
    if (ready && liveIn && !pending && !finished.current) {
      finished.current = true;
      start(useApp.getState().role);
    }
  }, [ready, liveIn, pending, start]);

  function pickRole(r: Role) {
    setMode(r);
    setMethodState(rememberedMethod());
  }
  function setMethod(m: Method) {
    setMethodState(m);
    rememberMethod(m);
  }

  function goDemo(r: Role, resume = false) {
    finished.current = true;
    if (resume) resumeDemo(r);
    else enterDemo(r);
    router.push(r === "empresa" ? "/empresa" : "/inicio");
  }

  function signedInLive(r: Role) {
    fire({ colors: WORK_CONFETTI });
    finished.current = true;
    start(r);
  }

  const pausedDemo = appMode === "demo" && !signedIn;
  const pausedNote = pausedDemo ? (
    <AuthNote
      tone="info"
      className="mt-0 mb-5"
      action={
        <span className="flex flex-wrap gap-x-5">
          <button type="button" className={cn(linkCls, "h-11")} onClick={() => goDemo(lastRole, true)}>
            Volver a la demo
          </button>
          <button type="button" className={cn(linkCls, "h-11 text-muted-foreground")} onClick={exitDemo}>
            Cerrar la demo
          </button>
        </span>
      }
    >
      Tienes una demo abierta en este teléfono.
    </AuthNote>
  ) : null;

  /* ---------------------------------------------------------- demo-only build */
  if (!isLiveAvailable) {
    return (
      <FlowShell
        tone="uva"
        art={{ scene: "barrio" }}
        band
        title="Prueba Chambarrio"
        hint="Entra a la demo con datos de ejemplo de Saltillo. No necesitas registrarte."
        aside="El trabajo que buscas, cerca de ti."
      >
        {pausedNote}
        <div className="space-y-4">
          <ChoiceCard
            tone="sol"
            index={0}
            art={<CategoryArt category="construccion" className="size-full" />}
            title="Busco chamba"
            description="Vacantes cerca de casa, postulaciones y avisos."
            badge="Demo"
            onClick={() => goDemo("candidato")}
          />
          <ChoiceCard
            tone="cielo"
            index={1}
            art={<Scene name="negocio" className="w-full" />}
            title="Tengo un negocio"
            description="Publica vacantes y ve quién vive cerca."
            badge="Demo"
            onClick={() => goDemo("empresa")}
          />
        </div>
      </FlowShell>
    );
  }

  /* ---------------------------------------------------------- 1. which side */
  if (!mode) {
    return (
      <FlowShell
        tone="uva"
        art={{ scene: "barrio" }}
        band
        title="¿Cómo quieres entrar?"
        hint="Puedes cambiar de modo después desde tu cuenta."
        aside="Qué gusto verte de nuevo."
      >
        {linkError ? (
          <AuthNote className="mt-0 mb-5">El enlace venció o ya se usó. Pide un código nuevo para entrar.</AuthNote>
        ) : null}
        {pausedNote}
        <div className="space-y-4">
          <ChoiceCard
            tone="sol"
            index={0}
            art={<CategoryArt category="construccion" className="size-full" />}
            title="Busco trabajo"
            description="Ve vacantes cerca de tu casa y sigue tus postulaciones."
            badge={appMode === "live" && lastRole === "candidato" ? "Última vez" : undefined}
            onClick={() => pickRole("candidato")}
          />
          <ChoiceCard
            tone="cielo"
            index={1}
            art={<Scene name="negocio" className="w-full" />}
            title="Soy empresa"
            description="Publica vacantes y encuentra personal que vive cerca."
            badge={appMode === "live" && lastRole === "empresa" ? "Última vez" : undefined}
            onClick={() => pickRole("empresa")}
          />
        </div>
        <p className="mt-7 text-[0.98rem] font-medium">
          ¿Primera vez?{" "}
          <Link href="/bienvenida" className={linkCls}>
            Crea tu cuenta gratis
          </Link>
        </p>
        <DemoOffer onPick={(r) => goDemo(r)} />
      </FlowShell>
    );
  }

  /* ---------------------------------------------------------- 2. how */
  const copy = MODE_COPY[mode];
  return (
    <FlowShell
      tone="mandarina"
      art={{ scene: "whatsapp" }}
      title="Entra a tu cuenta"
      stepKey={`entrar-${mode}`}
      hint={copy.hint}
      aside={copy.aside}
      onBack={() => setMode(null)}
    >
      {linkError ? (
        <AuthNote className="mt-0 mb-5">El enlace venció o ya se usó. Pide un código nuevo para entrar.</AuthNote>
      ) : null}
      <MethodPicker methods={METHODS} value={method} onChange={setMethod} />
      <div className="mt-6 flex flex-1 flex-col" key={method}>
        {method === "password" ? (
          <PasswordAuth onSignedIn={() => signedInLive(mode)} onForgot={() => setMethod("email")} />
        ) : (
          <CodeAuth
            channel={method}
            role={mode}
            idPrefix="entrar"
            onVerified={() => signedInLive(mode)}
            onUseEmail={() => setMethod("email")}
          />
        )}
        {pending ? (
          <p role="status" className="mt-4 text-[0.95rem] font-semibold text-muted-foreground">
            Cargando tu cuenta…
          </p>
        ) : null}
      </div>
      <DemoOffer role={mode} onPick={(r) => goDemo(r)} index={4} />
    </FlowShell>
  );
}
