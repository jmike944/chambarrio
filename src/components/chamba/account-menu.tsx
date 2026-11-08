"use client";

import { useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Building06Icon,
  LockPasswordIcon,
  Logout01Icon,
  UserAdd01Icon,
  UserEdit01Icon,
  Moon02Icon,
  Sun03Icon,
  UserIcon,
  UserSearch01Icon,
} from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { setTheme, useTheme } from "@/components/theme";
import { AvatarCircle } from "@/components/avatar";
import { isLiveAvailable, useApp, useHydrated, useMyAvatar } from "@/lib/store";
import { signOutEverywhere, useLiveUser } from "@/lib/live/session";
import { PasswordDialog } from "@/components/onboarding/password-dialog";

function maskPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  return d.length >= 4 ? `Cel. ···· ${d.slice(-4)}` : null;
}

/** Full reload so no signed-in (or demo) page stays mounted in the background. */
function reloadTo(href: string) {
  window.location.href = href;
}

/**
 * The user's illustrated avatar ("Crea tu avatar", else their deterministic look). Until the store has
 * hydrated it's a plain lime disc, so a random look never flashes before the saved one.
 */
function MyAvatar({ size }: { size: number }) {
  const config = useMyAvatar();
  const hydrated = useHydrated();
  if (!hydrated) {
    return (
      <span aria-hidden className="grid shrink-0 place-items-center rounded-full bg-limon text-ink" style={{ width: size, height: size }}>
        <HugeiconsIcon icon={UserIcon} className="size-5" strokeWidth={1.8} />
      </span>
    );
  }
  return <AvatarCircle config={config} size={size} />;
}

/** Avatar button with the account actions: switch mode, theme, password, sign out / leave the demo. */
export function AccountMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const isEmpresa = pathname === "/empresa" || pathname.startsWith("/empresa/");
  const name = useApp((s) => s.name);
  const business = useApp((s) => s.business);
  const phone = useApp((s) => s.phone);
  const setRole = useApp((s) => s.setRole);
  const appMode = useApp((s) => s.mode);
  const role = useApp((s) => s.role);
  const exitDemo = useApp((s) => s.exitDemo);
  const { user, hasPassword } = useLiveUser();
  const { resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const live = appMode === "live";
  const demo = appMode === "demo";

  // Pages stay mounted when you navigate away; don't come back to an open menu.
  useLayoutEffect(() => {
    return () => {
      setOpen(false);
      setConfirmOpen(false);
      setPwOpen(false);
    };
  }, []);

  // The demo employer runs as the demo company; a live account without a business has none.
  const displayName = isEmpresa
    ? (business?.name ?? (live ? "Tu negocio" : "Logística Zapalinamé"))
    : name || (live ? "Tu cuenta" : "");
  // Live: how they sign in (email or phone). Demo: the phone on the fake profile.
  const account = live ? (user?.email ?? (user?.phone ? maskPhone(user.phone) : null)) : maskPhone(phone);

  function switchMode() {
    const next = isEmpresa ? "candidato" : "empresa";
    setRole(next);
    router.push(next === "empresa" ? "/empresa" : "/inicio");
  }

  async function confirmSignOut() {
    setLeaving(true);
    // Flushes pending edits, wipes the store and signs out of Supabase on this device.
    await signOutEverywhere();
    // Full reload (per Next's "Preserving UI state" guide for logout).
    reloadTo(role === "empresa" || isEmpresa ? "/empresas" : "/");
  }

  function leaveDemo(href: string) {
    exitDemo();
    reloadTo(href);
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          aria-label={`Tu cuenta: ${displayName}`}
          className="press grid size-12 place-items-center rounded-full border-2 border-card bg-limon shadow-card outline-none hover:-translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:ring-3 data-[state=open]:ring-primary/40"
        >
          <MyAvatar size={44} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-72 rounded-3xl border border-border p-2 shadow-pop">
          <DropdownMenuLabel className="flex items-center gap-3 px-3 py-2.5">
            <MyAvatar size={44} />
            <span className="min-w-0">
              <span className="block truncate font-display text-[1.05rem] font-bold text-foreground">{displayName}</span>
              <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
                {demo ? "Demo · " : ""}
                {isEmpresa ? "Modo empresa" : "Modo candidato"}
              </span>
              {account ? <span className="mt-0.5 block truncate text-sm font-normal text-muted-foreground">{account}</span> : null}
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="h-12 text-[0.95rem]" onSelect={switchMode}>
            <HugeiconsIcon icon={isEmpresa ? UserSearch01Icon : Building06Icon} className="size-5" strokeWidth={1.6} />
            {isEmpresa ? "Cambiar a modo candidato" : "Cambiar a modo empresa"}
          </DropdownMenuItem>
          {isEmpresa ? null : (
            <>
              <DropdownMenuItem className="h-12 text-[0.95rem]" onSelect={() => router.push("/perfil")}>
                <HugeiconsIcon icon={UserIcon} className="size-5" strokeWidth={1.6} />
                Mi perfil
              </DropdownMenuItem>
              <DropdownMenuItem className="h-12 text-[0.95rem]" onSelect={() => router.push("/perfil#avatar")}>
                <HugeiconsIcon icon={UserEdit01Icon} className="size-5" strokeWidth={1.6} />
                Editar mi avatar
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem
            className="h-12 text-[0.95rem]"
            onSelect={(e) => {
              e.preventDefault();
              setTheme(resolvedTheme === "dark" ? "light" : "dark");
            }}
          >
            <HugeiconsIcon icon={resolvedTheme === "dark" ? Sun03Icon : Moon02Icon} className="size-5" strokeWidth={1.6} />
            {resolvedTheme === "dark" ? "Usar tema claro" : "Usar tema oscuro"}
          </DropdownMenuItem>
          {live ? (
            <DropdownMenuItem className="h-auto min-h-12 py-2 text-[0.95rem]" onSelect={() => setPwOpen(true)}>
              <HugeiconsIcon icon={LockPasswordIcon} className="size-5" strokeWidth={1.6} />
              <span className="min-w-0">
                <span className="block">{hasPassword ? "Cambiar contraseña" : "Crear contraseña"}</span>
                <span className="block text-[0.8rem] text-muted-foreground">Entra más rápido la próxima vez</span>
              </span>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          {demo ? (
            <>
              {isLiveAvailable ? (
                <DropdownMenuItem
                  className="h-12 text-[0.95rem]"
                  onSelect={() => leaveDemo(role === "empresa" || isEmpresa ? "/bienvenida/empresa" : "/bienvenida")}
                >
                  <HugeiconsIcon icon={UserAdd01Icon} className="size-5" strokeWidth={1.6} />
                  Crear mi cuenta real
                </DropdownMenuItem>
              ) : null}
              <DropdownMenuItem variant="destructive" className="h-12 text-[0.95rem]" onSelect={() => leaveDemo(role === "empresa" || isEmpresa ? "/empresas" : "/")}>
                <HugeiconsIcon icon={Logout01Icon} className="size-5" strokeWidth={1.6} />
                Salir de la demo
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuItem variant="destructive" className="h-12 text-[0.95rem]" onSelect={() => setConfirmOpen(true)}>
              <HugeiconsIcon icon={Logout01Icon} className="size-5" strokeWidth={1.6} />
              Cerrar sesión
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              Para volver a entrar te mandamos un código{hasPassword ? " o usas tu contraseña" : ""}. Tu perfil y tus
              postulaciones se quedan guardados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={leaving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={leaving}
              onClick={(e) => {
                e.preventDefault();
                void confirmSignOut();
              }}
            >
              {leaving ? "Cerrando…" : "Cerrar sesión"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {live ? <PasswordDialog open={pwOpen} onOpenChange={setPwOpen} hasPassword={hasPassword} /> : null}
    </>
  );
}
