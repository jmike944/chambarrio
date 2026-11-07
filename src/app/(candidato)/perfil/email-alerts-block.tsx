"use client";

import { useId } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { ComingSoon01Icon, Mail01Icon, SmartPhone01Icon } from "@hugeicons/core-free-icons";
import { Switch } from "@/components/ui/switch";
import { useLiveUser } from "@/lib/live/session";
import { useApp } from "@/lib/store";
import { cn } from "@/lib/utils";
import { HARD_SM } from "../postulaciones/rugged";

/**
 * Perfil → "Avisos por correo": the two email preferences (write-through in live, local in the
 * demo), where the emails go, and SMS as "Próximamente". Lives inside the profile's menta Block.
 */
export function EmailAlertsBlock({ onChange }: { onChange?: () => void }) {
  const mode = useApp((s) => s.mode);
  const storeEmail = useApp((s) => s.email);
  const emailAlerts = useApp((s) => s.emailAlerts);
  const emailUpdates = useApp((s) => s.emailUpdates);
  const setEmailAlerts = useApp((s) => s.setEmailAlerts);
  const setEmailUpdates = useApp((s) => s.setEmailUpdates);
  const { user } = useLiveUser();
  const live = mode === "live";
  // Emails go to the address on the account (auth), which is what the sender uses.
  const email = live ? user?.email || storeEmail || null : null;

  return (
    <div className="space-y-3">
      {live && email ? (
        <p className={cn("flex min-h-12 items-center gap-3 rounded-tile bg-white/70 px-4 py-2 text-ink", HARD_SM)}>
          <HugeiconsIcon icon={Mail01Icon} className="size-5 shrink-0" strokeWidth={2} />
          <span className="min-w-0">
            <span className="block text-[0.72rem] font-semibold tracking-[0.14em] text-ink/65 uppercase">Te llegan a</span>
            <span className="block truncate text-[0.95rem] font-semibold">{email}</span>
          </span>
        </p>
      ) : (
        <p className="rounded-tile border-2 border-dashed border-ink/30 bg-white/45 px-4 py-3 text-[0.92rem] leading-snug">
          {live
            ? "Entraste con tu celular y tu cuenta no tiene correo, así que por ahora estos avisos no te llegan. Tu elección queda guardada."
            : "En la demo no se mandan correos. Mueve los interruptores para ver cómo funciona."}
        </p>
      )}

      <div className="space-y-2">
        <PrefRow
          title="Vacantes nuevas cerca de ti"
          hint="Un resumen al día, a las 8:00, solo si hay vacantes nuevas en tu radio."
          checked={emailAlerts}
          onCheckedChange={(on) => {
            onChange?.();
            void setEmailAlerts(on);
          }}
        />
        <PrefRow
          title="Cuando una empresa vea o avance tu postulación"
          hint="Si te ven, te invitan a entrevista o te contratan."
          checked={emailUpdates}
          onCheckedChange={(on) => {
            onChange?.();
            void setEmailUpdates(on);
          }}
        />
        <PrefRow
          icon={SmartPhone01Icon}
          title="Avisos por SMS"
          hint="Muy pronto también por mensaje al celular."
          badge="Próximamente"
          checked={false}
          disabled
        />
      </div>
    </div>
  );
}

function PrefRow({
  title,
  hint,
  checked,
  onCheckedChange,
  disabled,
  badge,
  icon,
}: {
  title: string;
  hint: string;
  checked: boolean;
  onCheckedChange?: (on: boolean) => void;
  disabled?: boolean;
  badge?: string;
  icon?: typeof Mail01Icon;
}) {
  const id = useId();
  return (
    <div
      className={cn(
        "flex min-h-16 items-center gap-3 rounded-tile px-4 py-3",
        disabled ? "border-2 border-dashed border-ink/25 bg-white/30" : "bg-white/60",
      )}
    >
      <label htmlFor={id} className={cn("min-w-0 flex-1", disabled ? "cursor-not-allowed" : "cursor-pointer")}>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.95rem] leading-snug font-semibold">
          {icon ? <HugeiconsIcon icon={icon} className="size-4.5 shrink-0" strokeWidth={2} /> : null}
          {title}
          {badge ? (
            <span className="inline-flex -rotate-2 items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[0.7rem] font-bold tracking-[0.06em] text-limon uppercase">
              <HugeiconsIcon icon={ComingSoon01Icon} className="size-3.5" strokeWidth={2.2} />
              {badge}
            </span>
          ) : null}
        </span>
        <span id={`${id}-hint`} className="mt-0.5 block text-sm leading-snug font-normal text-muted-foreground">
          {hint}
        </span>
      </label>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
      />
    </div>
  );
}
