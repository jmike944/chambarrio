"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { SecurityCheckIcon } from "@hugeicons/core-free-icons";
import { isLiveAvailable, useApp, type Role } from "@/lib/store";
import { useSessionLoaded } from "@/lib/live/session";
import type { Channel } from "@/lib/supabase/auth";
import { cn } from "@/lib/utils";
import { FlowShell, HAZARD } from "./flow";
import { CodeAuth, MethodPicker } from "./live-auth";
import { linkBtn } from "./phone-verify";

type UserState = ReturnType<typeof useApp.getState>;

const CODE_METHODS = ["email", "sms"] as const;

/**
 * Live onboarding: the real "create your account" step (email code by default, SMS when Twilio is
 * on). The chosen role travels in the user metadata, so the profile is created with it.
 */
export function AccountStep({
  step,
  total,
  role,
  onBack,
  onVerified,
}: {
  step: number;
  total: number;
  role: Role;
  onBack?: () => void;
  onVerified: (info: { channel: Channel; to: string }) => void;
}) {
  const [channel, setChannel] = useState<Channel>("email");
  return (
    <FlowShell
      step={step}
      total={total}
      tone="mandarina"
      art={{ scene: "whatsapp" }}
      title="Crea tu cuenta"
      hint={
        role === "empresa"
          ? "Te mandamos un código para confirmar que eres tú. Así nadie más publica a nombre de tu negocio."
          : "Te mandamos un código para confirmar que eres tú. Gratis, sin currículum."
      }
      aside="Sin contraseñas que recordar. Si quieres, crea una después."
      onBack={onBack}
    >
      <MethodPicker methods={CODE_METHODS} value={channel} onChange={(m) => m !== "password" && setChannel(m)} />
      <div className="mt-6 flex flex-1 flex-col" key={channel}>
        <CodeAuth
          channel={channel}
          role={role}
          idPrefix={`alta-${role}`}
          submitLabel="Enviarme un código"
          onVerified={onVerified}
          onUseEmail={() => setChannel("email")}
        />
      </div>
      <p className="mt-6 text-[0.95rem] font-medium text-muted-foreground">
        ¿Ya tienes cuenta?{" "}
        <Link href="/entrar" className={cn(linkBtn, "text-foreground")}>
          Entra aquí
        </Link>
      </p>
    </FlowShell>
  );
}

/** Demo onboarding: says out loud that nothing is real, and offers the real thing when it exists. */
export function DemoVerifyNote() {
  const exitDemo = useApp((s) => s.exitDemo);
  return (
    <div className="relative mb-5 animate-rise overflow-hidden rounded-[1.2rem] border-[3px] border-ink bg-block-sol text-ink">
      <span aria-hidden className={cn("absolute inset-y-0 left-0 w-3", HAZARD)} />
      <div className="flex items-start gap-2.5 py-3 pr-4 pl-6 text-[0.95rem] leading-snug font-semibold">
        <HugeiconsIcon icon={SecurityCheckIcon} className="mt-0.5 size-5 shrink-0" strokeWidth={2.2} />
        <div>
          <span className="mr-1.5 rounded bg-ink px-1.5 py-0.5 font-display text-[0.75rem] font-extrabold tracking-[0.1em] text-limon uppercase">
            Demo
          </span>
          No enviamos nada: cualquier código funciona.
          {isLiveAvailable ? (
            <button type="button" onClick={exitDemo} className={cn(linkBtn, "block h-10 text-ink")}>
              Mejor crea tu cuenta real
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Someone "signed up" with an address that already has an account: once their profile loads,
 * send them to the app instead of making them redo onboarding. Returns `arm()`; call it right
 * after verification. `done(state)` decides whether the existing account is already set up.
 */
export function useExistingAccountExit(role: Role, done: (s: UserState) => boolean) {
  const router = useRouter();
  const loaded = useSessionLoaded();
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed || !loaded) return;
    const s = useApp.getState();
    if (s.mode !== "live") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot check after the profile loads
    setArmed(false);
    if (!done(s)) return;
    toast.success("Ya tenías cuenta. ¡Qué gusto verte de nuevo!");
    if (s.role !== role) void s.setRole(role);
    router.replace(role === "empresa" ? "/empresa" : "/inicio");
  }, [armed, loaded, done, role, router]);

  return () => setArmed(true);
}
