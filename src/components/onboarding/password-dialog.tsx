"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { setPassword } from "@/lib/supabase/auth";
import { cn } from "@/lib/utils";
import { AuthNote, PasswordInput } from "./live-auth";

const MIN = 8;

/**
 * Live accounts: create or change an optional password, so next time they can skip the code.
 * Controlled; mount it once next to whatever opens it.
 */
export function PasswordDialog({
  open,
  onOpenChange,
  hasPassword,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hasPassword?: boolean;
}) {
  const [value, setValue] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const short = value.length > 0 && value.length < MIN;

  function close(next: boolean) {
    if (busy) return;
    if (!next) {
      setValue("");
      setShow(false);
      setError(null);
    }
    onOpenChange(next);
  }

  async function save() {
    if (value.length < MIN || busy) return;
    setBusy(true);
    setError(null);
    const err = await setPassword(value);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    toast.success("Listo. La próxima vez entra con tu correo o celular y tu contraseña.");
    close(false);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="rounded-[1.6rem] border-[3px] border-ink sm:max-w-md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-display text-[1.5rem] font-extrabold tracking-[-0.03em]">
              {hasPassword ? "Cambiar contraseña" : "Crea una contraseña"}
            </DialogTitle>
            <DialogDescription className="text-[0.98rem]">
              Entra más rápido la próxima vez: con tu correo o celular y tu contraseña, sin esperar un código. Es
              opcional; los códigos siguen funcionando.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5">
            <Label htmlFor="new-password" className="mb-2.5 font-display text-[1.05rem] font-extrabold">
              {hasPassword ? "Nueva contraseña" : "Contraseña"}
            </Label>
            <PasswordInput
              id="new-password"
              value={value}
              onChange={(v) => {
                setValue(v);
                if (error) setError(null);
              }}
              show={show}
              onToggle={() => setShow((v) => !v)}
              autoComplete="new-password"
              invalid={short || !!error}
              describedBy="new-password-hint"
            />
            <p
              id="new-password-hint"
              className={cn("mt-2 text-[0.9rem] font-medium", short ? "text-destructive" : "text-muted-foreground")}
            >
              Mínimo {MIN} caracteres. {value.length >= MIN ? "¡Bien!" : short ? `Te faltan ${MIN - value.length}.` : ""}
            </p>
            {error ? <AuthNote>{error}</AuthNote> : null}
          </div>
          <DialogFooter className="mt-6 gap-2.5">
            <Button type="button" variant="outline" size="lg" className="h-12" onClick={() => close(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button type="submit" size="lg" className="h-12" disabled={value.length < MIN || busy} aria-busy={busy}>
              {busy ? <Spinner className="size-5" /> : null}
              {busy ? "Guardando…" : "Guardar contraseña"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
