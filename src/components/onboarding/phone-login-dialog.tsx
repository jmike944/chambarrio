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
import { Spinner } from "@/components/ui/spinner";
import { useApp } from "@/lib/store";
import { sendPhoneChangeCode, verifyPhoneChange } from "@/lib/supabase/auth";
import { cn } from "@/lib/utils";
import { AuthNote } from "./live-auth";
import { CodeField, PhoneField, ResendButton, formatPhone, linkBtn, useCountdown } from "./phone-verify";

const RESEND = 60;

/** "+528115270143" / "528115270143" / "811 527 0143" → "8115270143" (or "" if it isn't a 10-digit MX number). */
function tenDigits(raw: string | null | undefined): string {
  const d = (raw ?? "").replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "");
  return d.length === 10 ? d : "";
}

/**
 * Live accounts: verify a celular and link it to this account, so "Entrar → Código por SMS" finds it.
 * The phone saved in the profile is only contact info; this is what makes it a way to sign in.
 * Controlled; mount it once next to whatever opens it.
 */
export function PhoneLoginDialog({
  open,
  onOpenChange,
  current,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The account's sign-in phone (Supabase user.phone), if it already has one. */
  current: string | null;
}) {
  const contact = useApp((s) => s.phone);
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useCountdown();

  const linked = tenDigits(current);
  const valid = phone.length === 10 && phone !== linked;

  // Fresh form every time it opens (the parent opens it; Radix only reports closes).
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      // No sign-in phone yet: start from the profile's contact number, usually the same one.
      setPhone(linked ? "" : tenDigits(contact));
      setStage("phone");
      setCode("");
      setError(null);
    }
  }

  function close(next: boolean) {
    if (busy) return;
    onOpenChange(next);
  }

  async function send() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    const err = await sendPhoneChangeCode(phone);
    setBusy(false);
    if (err) {
      setError(err);
      return;
    }
    setStage("code");
    setCode("");
    setSeconds(RESEND);
    toast.success(`Te enviamos un SMS al ${formatPhone(phone)}.`);
  }

  async function verify(value = code) {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    const err = await verifyPhoneChange(phone, value);
    setBusy(false);
    if (err) {
      setError(err);
      setCode("");
      return;
    }
    // Keep the contact number employers see in step with the verified one.
    if (tenDigits(contact) !== phone) void useApp.getState().setPhone(phone);
    toast.success(`Listo. Ya puedes entrar con un código por SMS al ${formatPhone(phone)}.`);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="rounded-[1.6rem] border-[3px] border-ink sm:max-w-md">
        <form
          className="min-w-0"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void (stage === "phone" ? send() : verify());
          }}
        >
          <DialogHeader>
            <DialogTitle className="font-display text-[1.5rem] font-extrabold tracking-[-0.03em]">
              {linked ? "Cambiar tu celular" : "Verifica tu celular"}
            </DialogTitle>
            <DialogDescription className="text-[0.98rem]">
              {stage === "phone"
                ? "Te mandamos un código por SMS. Al confirmarlo, también puedes entrar a esta cuenta con tu celular."
                : (
                    <>
                      Escribe el código de 6 números que te llegó al{" "}
                      <span className="font-display font-extrabold whitespace-nowrap text-foreground tabular-nums">
                        +52 {formatPhone(phone)}
                      </span>
                      .
                    </>
                  )}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-5">
            {stage === "phone" ? (
              <>
                <PhoneField
                  id="login-phone"
                  value={phone}
                  onChange={(v) => {
                    setPhone(v);
                    if (error) setError(null);
                  }}
                  label={linked ? "Tu nuevo celular" : "Tu celular (10 dígitos)"}
                  autoFocus
                />
                {linked ? (
                  <p className="mt-2 text-[0.9rem] text-muted-foreground">
                    Ahora entras con el <span className="tabular-nums">{formatPhone(linked)}</span>.
                  </p>
                ) : null}
              </>
            ) : (
              <>
                <CodeField
                  value={code}
                  onChange={(v) => {
                    setCode(v);
                    if (error) setError(null);
                  }}
                  onComplete={(v) => void verify(v)}
                  disabled={busy}
                  compact
                />
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1">
                  <ResendButton seconds={seconds} onClick={() => void send()} disabled={busy} />
                  <button
                    type="button"
                    onClick={() => {
                      setStage("phone");
                      setError(null);
                    }}
                    className={cn(linkBtn, "text-muted-foreground hover:text-foreground")}
                  >
                    Cambiar número
                  </button>
                </div>
              </>
            )}
            {error ? <AuthNote>{error}</AuthNote> : null}
          </div>

          <DialogFooter className="mt-6 gap-2.5">
            <Button type="button" variant="outline" size="lg" className="h-12" onClick={() => close(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button
              type="submit"
              size="lg"
              className="h-12"
              disabled={busy || (stage === "phone" ? !valid : code.length !== 6)}
              aria-busy={busy}
            >
              {busy ? <Spinner className="size-5" /> : null}
              {stage === "phone" ? (busy ? "Enviando…" : "Enviarme un código") : busy ? "Revisando…" : "Confirmar código"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
