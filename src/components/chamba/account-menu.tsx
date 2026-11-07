"use client";

import { useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Building06Icon,
  Logout01Icon,
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
import { useApp } from "@/lib/store";

function initials(text: string) {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function maskPhone(phone: string) {
  const d = phone.replace(/\D/g, "");
  return d.length >= 4 ? `WhatsApp ···· ${d.slice(-4)}` : null;
}

/** Avatar button with the account actions: switch mode, theme, sign out. */
export function AccountMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const isEmpresa = pathname === "/empresa" || pathname.startsWith("/empresa/");
  const name = useApp((s) => s.name);
  const business = useApp((s) => s.business);
  const phone = useApp((s) => s.phone);
  const setRole = useApp((s) => s.setRole);
  const signOut = useApp((s) => s.signOut);
  const { resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  // Pages stay mounted when you navigate away; don't come back to an open menu.
  useLayoutEffect(() => {
    return () => {
      setOpen(false);
      setConfirmOpen(false);
    };
  }, []);

  const displayName = isEmpresa ? (business?.name ?? "Logística Zapalinamé") : name;
  const masked = maskPhone(phone);

  function switchMode() {
    const next = isEmpresa ? "candidato" : "empresa";
    setRole(next);
    router.push(next === "empresa" ? "/empresa" : "/inicio");
  }

  function confirmSignOut() {
    signOut();
    // Full reload (per Next's "Preserving UI state" guide for logout) so no
    // signed-in page stays mounted in the background.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- intentional full reload on logout
    window.location.href = "/entrar";
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          aria-label={`Tu cuenta: ${displayName}`}
          className="press grid size-12 place-items-center rounded-full border-2 border-card bg-limon font-display text-[1.05rem] font-extrabold tracking-[-0.02em] text-ink shadow-card outline-none hover:-translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50 data-[state=open]:ring-3 data-[state=open]:ring-primary/40"
        >
          <span aria-hidden>{initials(displayName) || <HugeiconsIcon icon={UserIcon} className="size-5" />}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8} className="w-72 rounded-3xl border border-border p-2 shadow-pop">
          <DropdownMenuLabel className="flex items-center gap-3 px-3 py-2.5">
            <span
              aria-hidden
              className="grid size-10 shrink-0 place-items-center rounded-full bg-limon font-display text-[0.95rem] font-extrabold text-ink"
            >
              {initials(displayName)}
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-[1.05rem] font-bold text-foreground">{displayName}</span>
              <span className="mt-0.5 block text-sm font-normal text-muted-foreground">
                {isEmpresa ? "Modo empresa" : "Modo candidato"}
                {masked ? ` · ${masked}` : ""}
              </span>
            </span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="h-12 text-[0.95rem]" onSelect={switchMode}>
            <HugeiconsIcon icon={isEmpresa ? UserSearch01Icon : Building06Icon} className="size-5" strokeWidth={1.6} />
            {isEmpresa ? "Cambiar a modo candidato" : "Cambiar a modo empresa"}
          </DropdownMenuItem>
          {isEmpresa ? null : (
            <DropdownMenuItem className="h-12 text-[0.95rem]" onSelect={() => router.push("/perfil")}>
              <HugeiconsIcon icon={UserIcon} className="size-5" strokeWidth={1.6} />
              Mi perfil
            </DropdownMenuItem>
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
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" className="h-12 text-[0.95rem]" onSelect={() => setConfirmOpen(true)}>
            <HugeiconsIcon icon={Logout01Icon} className="size-5" strokeWidth={1.6} />
            Cerrar sesión
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cerrar sesión?</AlertDialogTitle>
            <AlertDialogDescription>
              Para volver a entrar te mandaremos un código a tu WhatsApp. Tu perfil y tus postulaciones se quedan
              guardados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmSignOut}>
              Cerrar sesión
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
