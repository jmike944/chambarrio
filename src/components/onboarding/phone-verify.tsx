"use client";

import { useEffect, useState } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { SecurityCheckIcon, SmartPhone01Icon } from "@hugeicons/core-free-icons";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { HAZARD, PrimaryButton, Slab, StickyFooter } from "./flow";

export const RESEND_SECONDS = 30;

/** "8441234567" → "844 123 4567" */
export function formatPhone(digits: string) {
  const d = digits.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
}

export const linkBtn =
  "h-11 rounded-full text-[0.95rem] font-semibold underline decoration-2 underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

/** Big +52 phone input with 10 gauge ticks that fill as you type. `value` is digits only. */
export function PhoneField({
  id,
  value,
  onChange,
  label,
  autoFocus,
}: {
  id: string;
  value: string;
  onChange: (digits: string) => void;
  label: string;
  autoFocus?: boolean;
}) {
  return (
    <>
      <Label htmlFor={id} className="mb-3 font-display text-[1.1rem] font-extrabold tracking-[-0.01em]">
        {label}
      </Label>
      <div className="flex h-17 items-center gap-3 rounded-[1.1rem] border-[3px] border-ink bg-white px-4 text-ink transition-[translate] focus-within:-translate-y-0.5 focus-within:ring-4 focus-within:ring-ink/25">
        <span className="rounded-md bg-ink px-2 py-1 font-display text-[1.05rem] font-extrabold text-limon tabular-nums">
          +52
        </span>
        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          placeholder="844 123 4567"
          autoFocus={autoFocus}
          value={formatPhone(value)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").replace(/^52(?=\d{10}$)/, "").slice(0, 10))}
          className="h-full min-w-0 flex-1 bg-transparent font-display text-[1.45rem] font-bold tracking-[0.04em] text-ink outline-none tabular-nums placeholder:text-ink/35"
        />
      </div>
      {/* 10 little gauge ticks fill as you type */}
      <div aria-hidden className="mt-3 flex gap-1">
        {Array.from({ length: 10 }, (_, i) => (
          <span
            key={i}
            className={cn(
              "h-2 flex-1 origin-bottom rounded-full border-2 border-ink transition-[background-color,scale] duration-200",
              i < value.length ? "scale-y-125 bg-ink" : "bg-white/60",
            )}
          />
        ))}
      </div>
    </>
  );
}

/** Six chunky stamped slots for a one-time code. */
export function CodeField({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onComplete?: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <InputOTP
      maxLength={6}
      value={value}
      onChange={onChange}
      onComplete={onComplete}
      disabled={disabled}
      pattern={REGEXP_ONLY_DIGITS}
      inputMode="numeric"
      autoComplete="one-time-code"
      autoFocus
      aria-label="Código de 6 números"
      containerClassName="justify-start"
    >
      <InputOTPGroup className="gap-1.5 rounded-none sm:gap-2">
        {Array.from({ length: 6 }, (_, i) => (
          <InputOTPSlot
            key={i}
            index={i}
            className={cn(
              "size-12 rounded-[0.9rem] border-[3px] border-ink bg-white font-display text-[1.5rem] font-extrabold text-ink shadow-[3px_3px_0_0_var(--ink)] first:rounded-[0.9rem] first:border-l-[3px] last:rounded-[0.9rem] data-[active=true]:-translate-y-1 data-[active=true]:border-ink data-[active=true]:ring-4 data-[active=true]:ring-primary/40 sm:size-14",
              i < value.length && "bg-block-sol",
            )}
          />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

/** "Reenviar código" with a visible countdown. */
export function ResendButton({ seconds, onClick, disabled }: { seconds: number; onClick: () => void; disabled?: boolean }) {
  const counting = seconds > 0;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={counting || disabled}
      className={cn(linkBtn, "text-foreground disabled:text-muted-foreground disabled:no-underline tabular-nums")}
    >
      {counting ? `Reenviar código en ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}` : "Reenviar código"}
    </button>
  );
}

/** Ticks a resend cooldown down to 0. */
export function useCountdown() {
  const [seconds, setSeconds] = useState(0);
  const counting = seconds > 0;
  useEffect(() => {
    if (!counting) return;
    const id = setInterval(() => setSeconds((s) => (s <= 1 ? 0 : s - 1)), 1000);
    return () => clearInterval(id);
  }, [counting]);
  return [seconds, setSeconds] as const;
}

/**
 * DEMO ONLY: WhatsApp number → 6-digit code. Demo mode accepts any 6 digits.
 * Renders its own pinned action, so the parent step passes no footer.
 */
export function PhoneVerify({
  initialPhone = "",
  onVerified,
  inputId = "whatsapp",
}: {
  initialPhone?: string;
  onVerified: (phone: string) => void;
  inputId?: string;
}) {
  const [phone, setPhone] = useState(initialPhone.replace(/\D/g, "").slice(0, 10));
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [code, setCode] = useState("");
  const [seconds, setSeconds] = useCountdown();

  const phoneValid = phone.length === 10;

  function sendCode() {
    if (!phoneValid) return;
    setStage("code");
    setCode("");
    setSeconds(RESEND_SECONDS);
    toast.success(`Demo: haz como que te llegó un código al ${formatPhone(phone)}.`);
  }

  function verify(value = code) {
    if (value.length !== 6) return;
    onVerified(phone);
  }

  if (stage === "phone") {
    return (
      <form
        className="flex flex-1 flex-col"
        onSubmit={(e) => {
          e.preventDefault();
          sendCode();
        }}
      >
        <Slab tone="cielo" index={1} className="pt-4">
          <PhoneField id={inputId} value={phone} onChange={setPhone} label="Número de WhatsApp (10 dígitos)" />
        </Slab>
        <Slab
          tone="limon"
          index={2}
          className="mt-4 flex items-start gap-3 p-4 text-[0.95rem] leading-snug font-medium"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg border-2 border-ink bg-white text-ink">
            <HugeiconsIcon icon={SmartPhone01Icon} className="size-5" strokeWidth={2.2} />
          </span>
          <span className="pt-1">Usamos tu número solo para que las empresas te contacten.</span>
        </Slab>
        <StickyFooter>
          <PrimaryButton type="submit" disabled={!phoneValid}>
            Enviar código
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
        verify();
      }}
    >
      <Slab tone="limon" index={1} className="pt-4">
        <p className="mb-4 text-[1.05rem] font-medium">
          Escribe el código que te llegó al{" "}
          <span className="font-display font-extrabold whitespace-nowrap tabular-nums">+52 {formatPhone(phone)}</span>.
        </p>
        <CodeField value={code} onChange={setCode} onComplete={(v) => verify(v)} />
      </Slab>
      <div
        className="relative mt-5 animate-rise overflow-hidden rounded-[1.2rem] border-[3px] border-ink bg-block-sol text-ink"
        style={{ "--i": 2 } as React.CSSProperties}
      >
        <span aria-hidden className={cn("absolute inset-y-0 left-0 w-3", HAZARD)} />
        <p className="flex items-center gap-2.5 py-3 pr-4 pl-6 text-[0.95rem] font-semibold">
          <HugeiconsIcon icon={SecurityCheckIcon} className="size-5 shrink-0" strokeWidth={2.2} />
          Demo: cualquier código de 6 números funciona.
        </p>
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1">
        <ResendButton seconds={seconds} onClick={sendCode} />
        <button
          type="button"
          onClick={() => setStage("phone")}
          className={cn(linkBtn, "text-muted-foreground hover:text-foreground")}
        >
          Cambiar número
        </button>
      </div>
      <StickyFooter>
        <PrimaryButton type="submit" disabled={code.length !== 6}>
          Confirmar código
        </PrimaryButton>
      </StickyFooter>
    </form>
  );
}
