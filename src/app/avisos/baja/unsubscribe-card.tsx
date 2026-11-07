"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, ArrowRight01Icon, Mail01Icon, MailRemove01Icon, Tick02Icon } from "@hugeicons/core-free-icons";
import { Mascot } from "@/components/chamba/art/mascot";
import { Doodle } from "@/components/chamba/art/doodles";
import { getSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { loadSession } from "@/lib/live/backend";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";

type Kind = "alerts" | "updates" | "all";
type Phase = "idle" | "sending" | "done" | "unknown" | "error";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What stops, as it reads inside a sentence ("Dejamos de mandarte …"). */
const WHAT: Record<Kind, string> = {
  alerts: "el resumen diario de vacantes",
  updates: "los avisos de tus postulaciones",
  all: "todos los correos de Chambarrio",
};

const DETAIL: Record<Kind, string> = {
  alerts: "El correo de las 8:00 con las vacantes nuevas cerca de tu casa.",
  updates: "Los correos cuando una empresa ve o avanza tu postulación, o cuando alguien se postula a tu vacante.",
  all: "El resumen diario de vacantes y los avisos de postulaciones.",
};

/* Brand card: white, 3px ink outline, hard offset ink shadow (chalk in dark). */
const CARD =
  "relative isolate overflow-hidden rounded-panel border-[3px] border-ink bg-card dark:border-[#2c2464] text-card-foreground shadow-[6px_6px_0_0_var(--ink)] dark:shadow-[6px_6px_0_0_rgb(255_255_255/0.16)]";
const PILL =
  "press inline-flex h-14 w-full items-center justify-center gap-2.5 rounded-full px-6 font-display text-[1.08rem] font-extrabold tracking-[-0.01em] outline-none focus-visible:ring-4 focus-visible:ring-ring/60 disabled:pointer-events-none disabled:opacity-70";
/** Ink pill (lime on the dark card, where ink would vanish). */
const INK = "bg-ink text-white dark:bg-limon dark:text-ink";

function parseKind(raw: string | null): Kind {
  return raw === "alerts" || raw === "updates" || raw === "all" ? raw : "all";
}

/** Violet header band with the "Avisos por correo" eyebrow (mirrors the email header). */
function CardHeader({ icon = Mail01Icon }: { icon?: typeof Mail01Icon }) {
  return (
    <div className="relative flex items-center gap-3 bg-primary px-6 py-4 text-primary-foreground sm:px-8">
      <span className="grid size-10 shrink-0 -rotate-6 place-items-center rounded-xl border-2 border-ink bg-limon text-ink">
        <HugeiconsIcon icon={icon} className="size-5" strokeWidth={2.2} />
      </span>
      <p className="text-[0.75rem] font-semibold tracking-[0.16em] uppercase">Avisos por correo</p>
      <Doodle name="chispa" color="var(--limon)" className="absolute top-3 right-5 size-7 rotate-12" />
    </div>
  );
}

/** Suspense fallback (static shell): the card frame while the query string is read. */
export function UnsubscribeFallback() {
  return (
    <div className={CARD} aria-busy="true">
      <CardHeader />
      <div className="space-y-4 px-6 py-7 sm:px-8">
        <span className="block h-9 w-4/5 animate-pulse rounded-xl bg-muted" />
        <span className="block h-5 w-full animate-pulse rounded-lg bg-muted" />
        <span className="block h-14 w-full animate-pulse rounded-full bg-muted" />
        <span className="sr-only">Cargando…</span>
      </div>
    </div>
  );
}

export function UnsubscribeCard() {
  const params = useSearchParams();
  const token = (params.get("t") ?? "").trim();
  const linkKind = parseKind(params.get("k"));
  const validToken = UUID.test(token);

  const [phase, setPhase] = useState<Phase>("idle");
  const [done, setDone] = useState<Kind>(linkKind);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the new heading when the result arrives (screen readers hear it).
  useEffect(() => {
    if (phase === "done" || phase === "unknown") headingRef.current?.focus();
  }, [phase]);

  async function unsubscribe(kind: Kind) {
    const sb = getSupabase();
    if (!sb || phase === "sending") return;
    setPhase("sending");
    try {
      const { data, error } = await sb.rpc("unsubscribe_email", { p_token: token, p_kind: kind });
      if (error) {
        setPhase("error");
        return;
      }
      if (data !== true) {
        setPhase("unknown");
        return;
      }
      setDone(kind);
      setPhase("done");
      // Signed in on this device? Refresh the profile so its switches show the change.
      if (useApp.getState().mode === "live") void loadSession();
    } catch {
      setPhase("error");
    }
  }

  // Demo-only build (no Supabase): nothing to unsubscribe from here.
  if (!isSupabaseConfigured) {
    return (
      <Shell
        headingRef={headingRef}
        mascot="piensa"
        title="Aquí no hay correos que apagar"
        body="Esta versión de Chambarrio es una demo y no manda correos."
      >
        <Link href="/" className={cn(PILL, INK)}>
          Ir al inicio
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" strokeWidth={2.4} />
        </Link>
      </Shell>
    );
  }

  if (!validToken || phase === "unknown") {
    return (
      <Shell
        headingRef={headingRef}
        icon={Alert02Icon}
        mascot="piensa"
        title="Este enlace no funciona"
        body="Puede que se haya cortado al copiarlo. Ábrelo otra vez desde el correo, o entra a tu cuenta y apaga los avisos desde tu perfil."
      >
        <Link href="/perfil" className={cn(PILL, INK)}>
          Entrar a mi cuenta
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" strokeWidth={2.4} />
        </Link>
      </Shell>
    );
  }

  if (phase === "done") {
    return (
      <Shell
        headingRef={headingRef}
        icon={Tick02Icon}
        mascot="duerme"
        title="Listo, ya no te los mandamos"
        body={`Dejamos de mandarte ${WHAT[done]}. Tu cuenta, tu perfil y tus postulaciones siguen igual.`}
      >
        <div className="rounded-tile border-2 border-ink bg-limon p-4 text-[0.95rem] leading-snug text-ink">
          <strong className="font-bold">¿Cambiaste de opinión?</strong> Vuelve a prenderlos cuando quieras desde tu perfil.
        </div>
        <Link href="/perfil" className={cn(PILL, INK, "mt-4")}>
          Ir a mi perfil
          <HugeiconsIcon icon={ArrowRight01Icon} className="size-5" strokeWidth={2.4} />
        </Link>
        <p className="mt-4 text-center text-[0.92rem] text-muted-foreground">
          ¿Tienes negocio?{" "}
          <Link href="/empresa" className="rounded font-semibold text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Los avisos de tu negocio están en tu panel
          </Link>
          .
        </p>
      </Shell>
    );
  }

  const sending = phase === "sending";
  return (
    <Shell
      headingRef={headingRef}
      icon={MailRemove01Icon}
      mascot="saluda"
      title={`¿Ya no quieres ${WHAT[linkKind]}?`}
      body="Solo dejas de recibir este tipo de correo. Tu cuenta, tu perfil y tus postulaciones siguen igual."
    >
      <div className="rounded-tile border-2 border-ink bg-limon p-4 text-ink">
        <p className="text-[0.72rem] font-semibold tracking-[0.14em] uppercase">Lo que deja de llegarte</p>
        <p className="mt-1 text-[0.98rem] leading-snug font-semibold">{DETAIL[linkKind]}</p>
      </div>

      {phase === "error" ? (
        <p role="alert" className="mt-4 rounded-tile border-2 border-destructive/50 bg-destructive/10 px-4 py-3 text-[0.95rem] leading-snug">
          No pudimos hacer el cambio. Revisa tu conexión e intenta de nuevo.
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void unsubscribe(linkKind)}
        disabled={sending}
        aria-busy={sending}
        className={cn(PILL, INK, "mt-5 shadow-[0_10px_22px_-12px_var(--ink)]")}
      >
        <HugeiconsIcon icon={MailRemove01Icon} className="size-5" strokeWidth={2.2} />
        {sending ? "Un momento…" : "Dejar de recibirlos"}
      </button>
      {linkKind === "all" ? null : (
        <button
          type="button"
          onClick={() => void unsubscribe("all")}
          disabled={sending}
          className="mt-3 flex min-h-11 w-full items-center justify-center rounded-full text-[0.95rem] font-semibold text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
        >
          Darme de baja de todo
        </button>
      )}
      <p className="mt-3 text-center text-sm text-muted-foreground">Si no quieres cambiar nada, solo cierra esta página.</p>
    </Shell>
  );
}

function Shell({
  headingRef,
  icon,
  mascot,
  title,
  body,
  children,
}: {
  headingRef: React.RefObject<HTMLHeadingElement | null>;
  icon?: typeof Mail01Icon;
  mascot: "saluda" | "duerme" | "piensa";
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby="baja-t" className={cn(CARD, "animate-rise")}>
      <CardHeader icon={icon} />
      <div className="px-6 pt-6 pb-7 sm:px-8 sm:pt-7 sm:pb-8">
        <div className="flex items-start gap-3">
          <h1
            id="baja-t"
            ref={headingRef}
            tabIndex={-1}
            className="min-w-0 flex-1 font-display text-[1.9rem] leading-[1.02] font-extrabold tracking-[-0.04em] outline-none text-balance sm:text-[2.3rem]"
          >
            {title}
          </h1>
          <Mascot mood={mascot} prop="ninguno" size={84} className="-mt-1 -mr-2 shrink-0" />
        </div>
        <p className="mt-3 text-[1.02rem] leading-relaxed text-muted-foreground">{body}</p>
        <div className="mt-5">{children}</div>
      </div>
    </section>
  );
}
