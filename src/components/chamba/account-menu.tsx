"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Building06Icon,
  Download04Icon,
  LockPasswordIcon,
  Logout01Icon,
  SmartPhone01Icon,
  UserAdd01Icon,
  UserEdit01Icon,
  UserIcon,
  UserSearch01Icon,
} from "@hugeicons/core-free-icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
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
import { THEME_OPTIONS, setTheme, useTheme, type ThemePref } from "@/components/theme";
import { AvatarCircle } from "@/components/avatar";
import { isLiveAvailable, useApp, useHydrated } from "@/lib/store";
import { useActingAvatar, useCandidateSwitch } from "@/lib/team";
import { signOutEverywhere, useLiveUser } from "@/lib/live/session";
import { PasswordDialog } from "@/components/onboarding/password-dialog";
import { PhoneLoginDialog } from "@/components/onboarding/phone-login-dialog";
import { useInstallAction } from "@/components/install/install-sheet";
import { useInstallState } from "@/lib/install/client";

function maskPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  return d.length >= 4 ? `Cel. ···· ${d.slice(-4)}` : null;
}

/** Full reload so no signed-in (or demo) page stays mounted in the background. */
function reloadTo(href: string) {
  window.location.href = href;
}

/**
 * The user's illustrated avatar ("Crea tu avatar", else their deterministic look; the demo's "Ver como":
 * the previewed member's). Until the store has hydrated it's a plain lime disc, so a random look never
 * flashes before the saved one.
 */
function MyAvatar({ size }: { size: number }) {
  const config = useActingAvatar();
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
  // A company team member's account stays a company account: no "Cambiar a modo candidato".
  const canBeCandidate = useCandidateSwitch();
  const showSwitch = !isEmpresa || canBeCandidate;
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);
  /** The menu item that opened the confirm is gone when it closes: send focus back to the avatar. */
  const triggerRef = useRef<HTMLButtonElement>(null);
  const live = appMode === "live";
  const demo = appMode === "demo";
  // Always reachable from here (the cards can be put away): hidden only once it's installed.
  const install = useInstallState();
  const startInstall = useInstallAction(isEmpresa ? "empresa" : "candidato");
  const canInstall = install.kind !== "installed" && install.kind !== "unknown";

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
          ref={triggerRef}
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
          {showSwitch ? (
            <DropdownMenuItem className="h-12 text-[0.95rem]" onSelect={switchMode}>
              <HugeiconsIcon icon={isEmpresa ? UserSearch01Icon : Building06Icon} className="size-5" strokeWidth={1.6} />
              {isEmpresa ? "Cambiar a modo candidato" : "Cambiar a modo empresa"}
            </DropdownMenuItem>
          ) : null}
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
          {canInstall ? (
            <DropdownMenuItem className="h-12 text-[0.95rem]" onSelect={() => startInstall(null, triggerRef.current)}>
              <HugeiconsIcon icon={Download04Icon} className="size-5" strokeWidth={1.6} />
              {install.kind === "desktop" ? "Llévala en tu teléfono" : "Instalar la app"}
            </DropdownMenuItem>
          ) : null}
          {/* Tema: Sistema (default) / Claro / Oscuro, as one row; the menu stays open to show the change. */}
          <DropdownMenuLabel className="px-3 pt-2 pb-1">Tema</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as ThemePref)} className="flex gap-1 px-1 pb-1">
            {THEME_OPTIONS.map((o) => (
              <DropdownMenuRadioItem
                key={o.value}
                value={o.value}
                onSelect={(e) => e.preventDefault()}
                className="h-auto flex-1 flex-col justify-center gap-1 px-1 py-2 text-[0.8rem] font-semibold data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground data-[state=checked]:focus:bg-primary data-[state=checked]:focus:text-primary-foreground [&_[data-slot=dropdown-menu-radio-item-indicator]]:hidden"
              >
                <HugeiconsIcon icon={o.icon} className="size-5" strokeWidth={1.8} />
                {o.label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          {live ? (
            <DropdownMenuItem className="h-auto min-h-12 py-2 text-[0.95rem]" onSelect={() => setPwOpen(true)}>
              <HugeiconsIcon icon={LockPasswordIcon} className="size-5" strokeWidth={1.6} />
              <span className="min-w-0">
                <span className="block">{hasPassword ? "Cambiar contraseña" : "Crear contraseña"}</span>
                <span className="block text-[0.8rem] text-muted-foreground">Entra más rápido la próxima vez</span>
              </span>
            </DropdownMenuItem>
          ) : null}
          {live ? (
            <DropdownMenuItem className="h-auto min-h-12 py-2 text-[0.95rem]" onSelect={() => setPhoneOpen(true)}>
              <HugeiconsIcon icon={SmartPhone01Icon} className="size-5" strokeWidth={1.6} />
              <span className="min-w-0">
                <span className="block">{user?.phone ? "Cambiar mi celular" : "Verificar mi celular"}</span>
                <span className="block text-[0.8rem] text-muted-foreground">Entra con un código por SMS</span>
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
        <AlertDialogContent
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            triggerRef.current?.focus();
          }}
        >
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
      {live ? <PhoneLoginDialog open={phoneOpen} onOpenChange={setPhoneOpen} current={user?.phone ?? null} /> : null}
    </>
  );
}
