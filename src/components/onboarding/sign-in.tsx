"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useApp, type Role } from "@/lib/store";
import { useConfetti } from "@/components/chamba/motion";
import { CategoryArt } from "@/components/chamba/job-icons";
import { Scene } from "@/components/chamba/art/scenes";
import { ChoiceCard, FlowShell, Slab, WORK_CONFETTI } from "./flow";
import { PhoneVerify } from "./phone-verify";

const MODE_COPY: Record<Role, { aside: string; hint: string }> = {
  candidato: {
    aside: "Qué gusto verte de nuevo.",
    hint: "Te mandamos un código para ver tus vacantes y postulaciones.",
  },
  empresa: {
    aside: "Tu próxima contratación vive cerca.",
    hint: "Te mandamos un código para entrar al panel de tu negocio.",
  },
};

/** Sign-in: pick how you're entering (job seeker or business), then verify by WhatsApp. */
export function SignIn() {
  const router = useRouter();
  const fire = useConfetti();
  const lastRole = useApp((s) => s.role);
  const name = useApp((s) => s.name);
  const business = useApp((s) => s.business);
  const setPhone = useApp((s) => s.setPhone);
  const signIn = useApp((s) => s.signIn);
  const [mode, setMode] = useState<Role | null>(null);
  const finished = useRef(false);

  // Routes stay mounted after navigation; start fresh next time once sign-in completes.
  useLayoutEffect(() => {
    return () => {
      if (finished.current) {
        finished.current = false;
        setMode(null);
      }
    };
  }, []);

  if (!mode) {
    return (
      <FlowShell
        tone="uva"
        art={{ scene: "barrio" }}
        band
        title="¿Cómo quieres entrar?"
        hint="Puedes cambiar de modo después desde tu cuenta."
        aside="Qué gusto verte de nuevo."
      >
        <div className="space-y-4">
          <ChoiceCard
            tone="sol"
            index={0}
            art={<CategoryArt category="construccion" className="size-full" />}
            title="Busco trabajo"
            description="Ve vacantes cerca de tu casa y sigue tus postulaciones."
            badge={lastRole === "candidato" ? "Última vez" : undefined}
            onClick={() => setMode("candidato")}
          />
          <ChoiceCard
            tone="cielo"
            index={1}
            art={<Scene name="negocio" className="w-full" />}
            title="Soy empresa"
            description="Publica vacantes y encuentra personal que vive cerca."
            badge={lastRole === "empresa" ? "Última vez" : undefined}
            onClick={() => setMode("empresa")}
          />
        </div>
        <Slab tone="limon" index={3} className="mt-6 flex items-center gap-3 p-4 text-[0.98rem] font-medium">
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-lg border-[2.5px] border-ink bg-white font-display text-[1.1rem] font-extrabold"
          >
            ?
          </span>
          <span>
            ¿Primera vez?{" "}
            <Link
              href="/bienvenida"
              className="rounded font-bold text-foreground underline decoration-2 underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Crea tu cuenta gratis
            </Link>
          </span>
        </Slab>
      </FlowShell>
    );
  }

  const copy = MODE_COPY[mode];
  return (
    <FlowShell
      tone="mandarina"
      art={{ scene: "whatsapp" }}
      title="Entra con tu WhatsApp"
      hint={copy.hint}
      aside={copy.aside}
      onBack={() => setMode(null)}
    >
      <PhoneVerify
        inputId="signin-whatsapp"
        onVerified={(phone) => {
          fire({ colors: WORK_CONFETTI });
          setPhone(phone);
          signIn(mode);
          finished.current = true;
          toast.success(
            mode === "empresa" && business ? `Hola de nuevo, ${business.name}.` : `Hola de nuevo, ${name}.`,
          );
          router.push(mode === "empresa" ? "/empresa" : "/inicio");
        }}
      />
    </FlowShell>
  );
}
