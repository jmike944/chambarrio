"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockPasswordIcon, Logout01Icon, Mail01Icon, SmartPhone01Icon, UserAdd01Icon } from "@hugeicons/core-free-icons";
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
import { BLOCK_CLASS } from "@/components/chamba/primitives";
import { PasswordDialog } from "@/components/onboarding/password-dialog";
import { isLiveAvailable, useApp } from "@/lib/store";
import { signOutEverywhere, useLiveUser } from "@/lib/live/session";
import { cn } from "@/lib/utils";
import { HARD, HARD_SM, HazardTape } from "../postulaciones/rugged";

type CSSVars = React.CSSProperties & Record<`--${string}`, string | number>;

const BTN =
  "press flex h-12 w-full items-center justify-center gap-2 rounded-full px-4 text-[0.95rem] font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ink/60";

function reloadTo(href: string) {
  window.location.href = href;
}

function formatE164(phone: string) {
  const d = phone.replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "");
  return d.length === 10 ? `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}` : phone;
}

/** Perfil → "Tu cuenta": how you sign in, optional password, sign out (live) / leave the demo. */
export function AccountBlock({ index }: { index: number }) {
  const mode = useApp((s) => s.mode);
  const exitDemo = useApp((s) => s.exitDemo);
  const { user, hasPassword } = useLiveUser();
  const [pwOpen, setPwOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  if (mode !== "live" && mode !== "demo") return null;
  const live = mode === "live";

  return (
    <section
      aria-labelledby="cuenta-t"
      className={cn("relative isolate min-w-0 animate-rise overflow-hidden rounded-panel p-5 sm:p-6", BLOCK_CLASS.limon, HARD)}
      style={{ "--i": index } as CSSVars}
    >
      <HazardTape className="absolute inset-x-0 top-0 h-2.5 border-t-0" />
      <header className="mt-1 mb-4 flex items-center gap-3">
        <span className="grid size-10 shrink-0 -rotate-6 place-items-center rounded-xl bg-ink text-white">
          <HugeiconsIcon icon={live ? LockPasswordIcon : UserAdd01Icon} className="size-5" strokeWidth={2} />
        </span>
        <h2 id="cuenta-t" className="font-display text-[1.35rem] leading-tight font-extrabold tracking-[-0.03em]">
          {live ? "Tu cuenta" : "Estás en la demo"}
        </h2>
      </header>

      {live ? (
        <>
          <div className="space-y-2">
            {user?.email ? (
              <p className={cn("flex min-h-12 items-center gap-3 rounded-tile bg-white/70 px-4 text-[0.95rem] text-ink", HARD_SM)}>
                <HugeiconsIcon icon={Mail01Icon} className="size-5 shrink-0" strokeWidth={2} />
                <span className="min-w-0 truncate font-semibold">{user.email}</span>
              </p>
            ) : null}
            {user?.phone ? (
              <p className={cn("flex min-h-12 items-center gap-3 rounded-tile bg-white/70 px-4 text-[0.95rem] text-ink", HARD_SM)}>
                <HugeiconsIcon icon={SmartPhone01Icon} className="size-5 shrink-0" strokeWidth={2} />
                <span className="font-semibold tabular-nums">+52 {formatE164(user.phone)}</span>
              </p>
            ) : null}
          </div>
          <p className="mt-4 text-[0.95rem] text-muted-foreground">
            {hasPassword
              ? "Ya tienes contraseña: entra con ella o con un código."
              : "Entra más rápido la próxima vez: crea una contraseña y olvídate de esperar el código."}
          </p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            <button type="button" onClick={() => setPwOpen(true)} className={cn(BTN, "bg-ink text-white")}>
              <HugeiconsIcon icon={LockPasswordIcon} className="size-5" strokeWidth={2} />
              {hasPassword ? "Cambiar contraseña" : "Crear contraseña"}
            </button>
            <button
              type="button"
              onClick={() => setConfirmOpen(true)}
              className={cn(BTN, "border-2 border-ink bg-white/60 text-ink hover:bg-white")}
            >
              <HugeiconsIcon icon={Logout01Icon} className="size-5" strokeWidth={2} />
              Cerrar sesión
            </button>
          </div>
          <PasswordDialog open={pwOpen} onOpenChange={setPwOpen} hasPassword={hasPassword} />
          <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
                <AlertDialogDescription>
                  Para volver a entrar te mandamos un código{hasPassword ? " o usas tu contraseña" : ""}. Tu perfil y
                  tus postulaciones se quedan guardados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={leaving}>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  variant="destructive"
                  disabled={leaving}
                  onClick={async (e) => {
                    e.preventDefault();
                    setLeaving(true);
                    await signOutEverywhere();
                    reloadTo("/");
                  }}
                >
                  {leaving ? "Cerrando…" : "Cerrar sesión"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      ) : (
        <>
          <p className="text-[0.95rem] text-muted-foreground">
            Todo lo que ves son datos de ejemplo de Saltillo y nada se guarda.
            {isLiveAvailable ? " Cuando quieras, crea tu cuenta real: es gratis." : ""}
          </p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {isLiveAvailable ? (
              <button
                type="button"
                onClick={() => {
                  exitDemo();
                  reloadTo("/bienvenida");
                }}
                className={cn(BTN, "bg-ink text-white")}
              >
                <HugeiconsIcon icon={UserAdd01Icon} className="size-5" strokeWidth={2} />
                Crear mi cuenta real
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                exitDemo();
                reloadTo("/");
              }}
              className={cn(BTN, "border-2 border-ink bg-white/60 text-ink hover:bg-white")}
            >
              <HugeiconsIcon icon={Logout01Icon} className="size-5" strokeWidth={2} />
              Salir de la demo
            </button>
          </div>
        </>
      )}
    </section>
  );
}
