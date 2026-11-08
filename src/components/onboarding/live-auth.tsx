"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  Alert02Icon,
  LockPasswordIcon,
  Mail01Icon,
  MailOpen01Icon,
  SmartPhone01Icon,
  ViewIcon,
  ViewOffIcon,
} from "@hugeicons/core-free-icons";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { useApp, type Role } from "@/lib/store";
import { useSessionLoaded } from "@/lib/live/session";
import { sendCode, signInWithPassword, verifyCode, type Channel } from "@/lib/supabase/auth";
import { cn } from "@/lib/utils";
import { HAZARD, PrimaryButton, SlabShadow, Slab, StickyFooter, focusRing, slabFace } from "./flow";
import { isInvitePath } from "./next-path";
import { CodeField, PhoneField, ResendButton, formatPhone, linkBtn, useCountdown } from "./phone-verify";

/*
 * Live sign-in / sign-up building blocks (Supabase Auth). Every helper in lib/supabase/auth.ts
 * returns a Spanish message or null, so errors are shown as-is.
 */

export type Method = Channel | "password";

/** Supabase lets you ask for a new email code about once a minute. */
const RESEND_LIVE = 60;

export const BIG_INPUT =
  "h-17 rounded-[1.1rem] border-[3px] border-ink bg-white px-5 font-display text-[1.3rem] font-bold text-ink placeholder:text-ink/35 focus-visible:border-ink focus-visible:ring-4 focus-visible:ring-ink/25 md:text-[1.3rem] dark:bg-white";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Leaves the demo before any real sign-in: auth events are ignored while mode === "demo". */
function leaveDemo() {
  const s = useApp.getState();
  if (s.mode === "demo") s.exitDemo();
}

const METHOD_META: Record<Method, { label: string; short: string; icon: IconSvgElement }> = {
  email: { label: "Código por correo", short: "Correo", icon: Mail01Icon },
  sms: { label: "Código por SMS", short: "SMS", icon: SmartPhone01Icon },
  password: { label: "Contraseña", short: "Contraseña", icon: LockPasswordIcon },
};

/** Chunky segmented control for the way in. */
export function MethodPicker({
  methods,
  value,
  onChange,
}: {
  methods: readonly Method[];
  value: Method;
  onChange: (m: Method) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Cómo quieres entrar"
      className={cn("grid gap-2.5", methods.length === 3 ? "grid-cols-3" : "grid-cols-2")}
    >
      {methods.map((m) => {
        const on = m === value;
        const meta = METHOD_META[m];
        return (
          <div key={m} className="relative rounded-[1rem]">
            <SlabShadow on={on} className="translate-x-[3px] translate-y-[3px]" />
            <button
              type="button"
              role="radio"
              aria-checked={on}
              aria-label={meta.label}
              onClick={() => onChange(m)}
              className={cn(
                "flex min-h-16 w-full flex-col items-center justify-center gap-1 rounded-[1rem] px-1.5 py-2 text-center font-display text-[0.92rem] leading-tight font-extrabold",
                on ? "bg-limon text-ink" : "bg-white text-ink/75",
                slabFace(on),
                focusRing,
              )}
            >
              <HugeiconsIcon icon={meta.icon} className="size-5.5" strokeWidth={2.2} />
              <span aria-hidden>{meta.short}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** Hazard-edged note for errors and warnings. */
export function AuthNote({
  children,
  tone = "error",
  action,
  className,
}: {
  children: React.ReactNode;
  tone?: "error" | "info";
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "relative mt-4 animate-rise overflow-hidden rounded-[1.2rem] border-[3px] border-ink text-ink",
        tone === "error" ? "bg-block-durazno" : "bg-block-sol",
        className,
      )}
    >
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-3", HAZARD)} />
      <div className="flex items-start gap-2.5 py-3 pr-4 pl-6 text-[0.95rem] leading-snug font-semibold">
        <HugeiconsIcon icon={Alert02Icon} className="mt-0.5 size-5 shrink-0" strokeWidth={2.2} />
        <div className="min-w-0 flex-1">
          {children}
          {action ? <div className="mt-1">{action}</div> : null}
        </div>
      </div>
    </div>
  );
}

const smsOff = (msg: string) => msg.includes("SMS");

/**
 * One-time code by email or SMS: address → code → verified. The email may carry a link instead
 * of a code (default Supabase template); tapping it signs in too, and this tab notices when the
 * session lands (Supabase re-reads the cookie when the tab regains focus).
 */
export function CodeAuth({
  channel,
  role,
  newRole,
  idPrefix,
  onVerified,
  onUseEmail,
  submitLabel = "Enviarme un código",
  next,
}: {
  channel: Channel;
  /** Sign-up only: the side picked for a new account. Sign-in leaves it out. */
  role?: Role;
  /** Sign-in: the type a brand-new account gets (the side of /entrar). Existing accounts keep theirs. */
  newRole?: Role;
  /** Same-site path the email's sign-in link returns to (e.g. a team invite "/unirse?t=…"). */
  next?: string;
  idPrefix: string;
  /** Called once the Supabase session exists (store is already mode "live", signedIn). */
  onVerified: (info: { channel: Channel; to: string }) => void;
  /** SMS isn't available: let the parent switch to email. */
  onUseEmail?: () => void;
  submitLabel?: string;
}) {
  const [stage, setStage] = useState<"enter" | "code">("enter");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useCountdown();
  const done = useRef(false);

  const to = channel === "email" ? email.trim() : phone;
  const valid = channel === "email" ? EMAIL_RE.test(email.trim()) : phone.length === 10;

  // Signed in from the email link (this tab or another): carry on without the code.
  const liveIn = useApp((s) => s.mode === "live" && s.signedIn);
  useEffect(() => {
    if (stage === "code" && liveIn && !done.current) {
      done.current = true;
      onVerified({ channel, to });
    }
  }, [stage, liveIn, channel, to, onVerified]);

  async function send() {
    if (!valid || busy) return;
    leaveDemo();
    setBusy(true);
    setError(null);
    const err = await sendCode(channel, to, role, next, newRole);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setStage("code");
    setCode("");
    setSeconds(RESEND_LIVE);
    toast.success(channel === "email" ? `Te enviamos un correo a ${to}.` : `Te enviamos un SMS al ${formatPhone(phone)}.`);
  }

  async function verify(value = code) {
    if (value.length !== 6 || busy || done.current) return;
    setBusy(true);
    setError(null);
    const err = await verifyCode(channel, to, value);
    setBusy(false);
    if (err) {
      setError(err);
      setCode("");
      return;
    }
    if (done.current) return; // the session listener above got there first
    done.current = true;
    onVerified({ channel, to });
  }

  if (stage === "enter") {
    return (
      <form
        className="flex flex-1 flex-col"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <Slab tone={channel === "email" ? "cielo" : "menta"} index={1} className="pt-4">
          {channel === "email" ? (
            <>
              <Label
                htmlFor={`${idPrefix}-email`}
                className="mb-3 font-display text-[1.1rem] font-extrabold tracking-[-0.01em]"
              >
                Tu correo
              </Label>
              <Input
                id={`${idPrefix}-email`}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="tucorreo@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={!!error || undefined}
                className={BIG_INPUT}
              />
            </>
          ) : (
            <PhoneField id={`${idPrefix}-phone`} value={phone} onChange={setPhone} label="Tu celular (10 dígitos)" />
          )}
        </Slab>
        {error ? (
          <AuthNote
            tone={channel === "sms" && smsOff(error) ? "info" : "error"}
            action={
              channel === "sms" && smsOff(error) && onUseEmail ? (
                <button type="button" onClick={onUseEmail} className={cn(linkBtn, "h-9")}>
                  Usar mi correo
                </button>
              ) : null
            }
          >
            {error}
          </AuthNote>
        ) : null}
        <StickyFooter>
          <PrimaryButton type="submit" disabled={!valid || busy} aria-busy={busy}>
            {busy ? <Spinner className="size-5" /> : null}
            {busy ? "Enviando…" : submitLabel}
          </PrimaryButton>
        </StickyFooter>
      </form>
    );
  }

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void verify();
      }}
    >
      <Slab tone="limon" index={1} className="pt-4">
        <p className="mb-4 text-[1.05rem] font-medium">
          Escribe el código de 6 números que te llegó a{" "}
          <span className="font-display font-extrabold break-all tabular-nums">
            {channel === "email" ? to : `+52 ${formatPhone(phone)}`}
          </span>
          .
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
      {channel === "email" ? (
        <Slab tone="cielo" index={2} className="mt-4 flex items-start gap-3 p-4 text-[0.95rem] leading-snug font-medium">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border-2 border-ink bg-white text-ink">
            <HugeiconsIcon icon={MailOpen01Icon} className="size-5" strokeWidth={2.2} />
          </span>
          <span className="pt-0.5">
            <strong className="font-bold">¿Te llegó un enlace en lugar de un código?</strong> Tócalo desde este
            teléfono y entras directo. Revisa también la carpeta de spam.
          </span>
        </Slab>
      ) : null}
      {error ? <AuthNote>{error}</AuthNote> : null}
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1">
        <ResendButton seconds={seconds} onClick={() => void send()} disabled={busy} />
        <button
          type="button"
          onClick={() => {
            setStage("enter");
            setError(null);
          }}
          className={cn(linkBtn, "text-muted-foreground hover:text-foreground")}
        >
          {channel === "email" ? "Cambiar correo" : "Cambiar número"}
        </button>
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

/** Email or phone + password, for people who set one up from their account. */
export function PasswordAuth({ onSignedIn, onForgot }: { onSignedIn: () => void; onForgot: () => void }) {
  const [id, setId] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const valid = id.trim().length >= 5 && password.length >= 1;

  async function submit() {
    if (!valid || busy) return;
    leaveDemo();
    setBusy(true);
    setError(null);
    const err = await signInWithPassword(id, password);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    onSignedIn();
  }

  return (
    <form
      className="flex flex-1 flex-col"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <Slab tone="lila" index={1} className="space-y-4 pt-4">
        <div>
          <Label htmlFor="pw-id" className="mb-2.5 font-display text-[1.1rem] font-extrabold tracking-[-0.01em]">
            Correo o celular
          </Label>
          <Input
            id="pw-id"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            placeholder="tucorreo@gmail.com o 844 123 4567"
            value={id}
            onChange={(e) => setId(e.target.value)}
            className={cn(BIG_INPUT, "h-15 text-[1.1rem] md:text-[1.1rem]")}
          />
        </div>
        <div>
          <Label htmlFor="pw-secret" className="mb-2.5 font-display text-[1.1rem] font-extrabold tracking-[-0.01em]">
            Contraseña
          </Label>
          <PasswordInput id="pw-secret" value={password} onChange={setPassword} show={show} onToggle={() => setShow((v) => !v)} autoComplete="current-password" />
        </div>
      </Slab>
      {error ? <AuthNote>{error}</AuthNote> : null}
      <p className="mt-4 text-[0.95rem] font-medium text-muted-foreground">
        ¿Olvidaste tu contraseña?{" "}
        <button type="button" onClick={onForgot} className={cn(linkBtn, "text-foreground")}>
          Entra con un código
        </button>
      </p>
      <StickyFooter>
        <PrimaryButton type="submit" disabled={!valid || busy} aria-busy={busy}>
          {busy ? <Spinner className="size-5" /> : null}
          {busy ? "Entrando…" : "Entrar"}
        </PrimaryButton>
      </StickyFooter>
    </form>
  );
}

/** Password field with a show/hide toggle (44px target). */
export function PasswordInput({
  id,
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(BIG_INPUT, "h-15 pr-14 text-[1.1rem] md:text-[1.1rem]")}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={show}
        className={cn(
          "absolute top-1/2 right-2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-ink hover:bg-ink/10",
          focusRing,
        )}
      >
        <HugeiconsIcon icon={show ? ViewOffIcon : ViewIcon} className="size-5.5" strokeWidth={2.2} />
      </button>
    </div>
  );
}

/**
 * After a live sign-in: wait for the profile to load, then send the person where their account
 * belongs (each account is one type: candidato or empresa) — onboarding if they never finished
 * it, else their home screen. Returns `start()`; call it right after verifyCode / signInWithPassword.
 * `next` (a safe same-site path): a team invite goes there right away, onboarded or not (the invite
 * page loads the account itself); any other path once the account is onboarded.
 */
export function useRouteAfterSignIn(next?: string | null) {
  const router = useRouter();
  const loaded = useSessionLoaded();
  const live = useApp((s) => s.mode === "live" && s.signedIn);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (!started || !live) return;
    if (isInvitePath(next)) {
      router.replace(next);
      return;
    }
    const go = (sure: boolean) => {
      const s = useApp.getState();
      const empresa = s.role === "empresa";
      if (sure && !s.onboarded) {
        router.replace(empresa ? "/bienvenida/empresa" : "/bienvenida");
        return;
      }
      const first = s.name.trim().split(/\s+/)[0];
      if (sure) toast.success(empresa && s.business ? `Hola de nuevo, ${s.business.name}.` : first ? `Hola de nuevo, ${first}.` : "¡Qué gusto verte!");
      router.replace(next ?? (empresa ? "/empresa" : "/inicio"));
    };
    if (loaded) {
      go(true);
      return;
    }
    // Slow network: go to the app anyway; its guard sends unfinished accounts to onboarding.
    const t = setTimeout(() => go(false), 8000);
    return () => clearTimeout(t);
  }, [started, live, loaded, router, next]);

  const start = useCallback(() => setStarted(true), []);
  const reset = useCallback(() => setStarted(false), []);
  return { start, reset, pending: started };
}
