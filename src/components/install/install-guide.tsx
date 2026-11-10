"use client";

/*
 * The step-by-step install instructions, per phone and browser, with each step showing the button
 * to tap as it looks on the phone. Labels are the phones' own Spanish (México) wording, checked
 * 2026-11 against Apple's es-MX iPhone guide and Chrome's es-419 strings: Safari "Compartir",
 * "Agregar a Inicio", "Abrir como app web", "Agregar"; Chrome "Instalar y crear acceso directo" (older
 * Chrome: "Agregar a la pantalla principal"); Firefox "Agregar app a la pantalla de inicio". The share
 * sheet's "Ver más" (iOS 26/27) and the social apps' menus vary, so that copy allows for variants.
 */
import { useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { BrowserIcon, Copy01Icon, Download04Icon } from "@hugeicons/core-free-icons";
import { useConfetti } from "@/components/chamba/motion";
import { cn } from "@/lib/utils";
import { IN_APP_NAME, canEscape, iosSteps, type IosSteps, type Platform } from "@/lib/install/platform";
import { closeInstallSheet, installPageUrl, promptInstall, tryEscape, type InstallState, type Side } from "@/lib/install/client";

// ------------------------------------------------------------------ glyphs (the buttons people tap)

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function IosShareGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...S} d="M12 14V3.5M8.5 7 12 3.5 15.5 7" />
      <path {...S} d="M8.5 10H7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2h-1.5" />
    </svg>
  );
}
function MoreCircleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle {...S} cx="12" cy="12" r="9" />
      <circle cx="8" cy="12" r="1.3" fill="currentColor" />
      <circle cx="12" cy="12" r="1.3" fill="currentColor" />
      <circle cx="16" cy="12" r="1.3" fill="currentColor" />
    </svg>
  );
}
function LinesGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path {...S} d="M5 7h14M5 12h14M5 17h14" />
    </svg>
  );
}
function AddSquareGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect {...S} x="4" y="4" width="16" height="16" rx="4" />
      <path {...S} d="M12 8.5v7M8.5 12h7" />
    </svg>
  );
}
function KebabGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="5.5" r="1.9" fill="currentColor" />
      <circle cx="12" cy="12" r="1.9" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.9" fill="currentColor" />
    </svg>
  );
}
function ToggleGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 24" className={className} aria-hidden>
      <rect x="1" y="1" width="38" height="22" rx="11" fill="#34c759" />
      <circle cx="28" cy="12" r="9" fill="#fff" />
    </svg>
  );
}

/** A phone control, drawn the way it looks: iOS (gray tile, blue glyph) or Android (light gray, dark glyph). */
function Control({ kind = "ios", children, wide }: { kind?: "ios" | "android"; children: React.ReactNode; wide?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-13 shrink-0 place-items-center rounded-2xl border-2 border-ink/15 shadow-[0_2px_0_rgb(0_0_0/0.08)]",
        wide ? "min-w-13 px-3" : "w-13",
        kind === "ios" ? "bg-[#f2f2f7] text-[#0a84ff]" : "bg-[#eef1f4] text-[#3c4043]",
      )}
    >
      {children}
    </span>
  );
}
const G = "size-7";

/** A label as it reads on the phone's screen. */
function UI({ children }: { children: React.ReactNode }) {
  // box-decoration-clone: a long label ("Abrir como app web") wraps and keeps its pill on both lines.
  return <strong className="box-decoration-clone rounded-md bg-ink/[0.07] px-1 py-px font-bold text-ink">{children}</strong>;
}

// ------------------------------------------------------------------ steps

function Steps({ children }: { children: React.ReactNode }) {
  return <ol className="space-y-2.5">{children}</ol>;
}
function Step({ n, control, children }: { n: number; control?: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 rounded-[1.25rem] border-[2.5px] border-ink bg-white p-3 text-ink shadow-[3px_3px_0_0_var(--ink)] dark:border-black/70 dark:shadow-[3px_3px_0_0_rgb(0_0_0/0.55)]">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink font-display text-[1.05rem] font-extrabold text-limon">
        {n}
      </span>
      <p className="min-w-0 flex-1 text-[1rem] leading-snug font-medium">{children}</p>
      {control}
    </li>
  );
}
function Tip({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("text-[0.92rem] leading-snug font-medium text-muted-foreground", className)}>{children}</p>;
}
/** A button shown only as a symbol on the phone: the symbol for the eye, its name for screen readers. */
function Sym({ glyph, name }: { glyph: string; name: string }) {
  return (
    <UI>
      <span aria-hidden>{glyph}</span>
      <span className="sr-only">{name}</span>
    </UI>
  );
}
const PAGE_MENU = <Sym glyph="≡" name="Menú de página" />;
const MORE = <Sym glyph="•••" name="Más" />;
const KEBAB = <Sym glyph="⋮" name="Más opciones" />;
const ADD = (
  <Control wide>
    <span className="text-[0.95rem] font-bold">Agregar</span>
  </Control>
);

/**
 * `anyVersion`: for an iPhone we can't see (someone else's, or a computer): the iOS 27 steps, with
 * notes for iOS 26 and 18.
 */
export function IosGuide({ steps, anyVersion, side = "candidato" }: { steps: IosSteps; anyVersion?: boolean; side?: Side }) {
  if (steps === "other") {
    return (
      <div className="space-y-3">
        <Steps>
          <Step n={1} control={<Control><IosShareGlyph className={G} /></Control>}>
            Toca <UI>Compartir</UI>. En Chrome está junto a la dirección; en Edge y Firefox, búscalo en el menú.
          </Step>
          <Step n={2} control={<Control><AddSquareGlyph className={G} /></Control>}>
            Busca <UI>Agregar a Inicio</UI> (puede decir «Agregar a la pantalla principal») y tócala. Si no la ves, toca{" "}
            <UI>Ver más</UI>.
          </Step>
          <Step n={3} control={ADD}>
            Toca <UI>Agregar</UI>.
          </Step>
        </Steps>
        <Tip>¿No te aparece? Abre chambarrio.com en Safari y sigue los pasos ahí.</Tip>
        <CopyLink side={side} />
      </div>
    );
  }

  const addStep = (n: number) => (
    <Step n={n} control={<Control><AddSquareGlyph className={G} /></Control>}>
      {steps === "safari18" ? (
        <>
          Desliza hacia arriba y toca <UI>Agregar a Inicio</UI>.
        </>
      ) : (
        <>
          Busca <UI>Agregar a Inicio</UI> y tócala. Si no la ves, toca <UI>Ver más</UI> o desliza hacia arriba.
        </>
      )}
    </Step>
  );
  const confirmStep = (n: number) =>
    steps === "safari18" ? (
      <Step n={n} control={ADD}>
        Toca <UI>Agregar</UI>, arriba a la derecha.
      </Step>
    ) : (
      <Step n={n} control={<Control><ToggleGlyph className="h-6 w-10" /></Control>}>
        Deja activado <UI>Abrir como app web</UI> y toca <UI>Agregar</UI>.
      </Step>
    );

  return (
    <div className="space-y-3">
      <Steps>
        {steps === "safari18" ? (
          <>
            <Step n={1} control={<Control><IosShareGlyph className={G} /></Control>}>
              Toca <UI>Compartir</UI> en la barra de abajo.
            </Step>
            {addStep(2)}
            {confirmStep(3)}
          </>
        ) : (
          <>
            {steps === "safari27" ? (
              <Step n={1} control={<Control><LinesGlyph className={G} /></Control>}>
                Toca el botón {PAGE_MENU} que está a la izquierda de la dirección.
                {anyVersion ? <> En iOS 26 es el botón {MORE}, abajo a la derecha.</> : null}
              </Step>
            ) : (
              <Step n={1} control={<Control><MoreCircleGlyph className={G} /></Control>}>
                Toca el botón {MORE}, abajo a la derecha.
              </Step>
            )}
            <Step n={2} control={<Control><IosShareGlyph className={G} /></Control>}>
              Toca <UI>Compartir</UI>.
            </Step>
            {addStep(3)}
            {confirmStep(4)}
          </>
        )}
      </Steps>
      {steps === "safari18" ? null : (
        <Tip>
          ¿Ves el botón Compartir en la barra de abajo? Tócalo directo y sigue en el paso 3.
          {anyVersion ? " En iOS 18 o anterior: Compartir → Agregar a Inicio → Agregar." : null}
        </Tip>
      )}
      <Tip>¿No aparece «Agregar a Inicio»? Baja hasta el final de la lista, toca «Editar acciones» y agrégala.</Tip>
    </div>
  );
}

export function AndroidGuide({ browser, side = "candidato" }: { browser: Platform["browser"]; side?: Side }) {
  if (browser === "samsung") {
    return (
      <div className="space-y-3">
        <Steps>
          <Step n={1} control={<Control kind="android"><LinesGlyph className={G} /></Control>}>
            Toca el menú <Sym glyph="≡" name="Menú" />, abajo a la derecha.
          </Step>
          <Step n={2} control={<Control kind="android"><AddSquareGlyph className={G} /></Control>}>
            Toca <UI>Agregar página a</UI> y elige <UI>Pantalla de inicio</UI>.
          </Step>
          <Step n={3} control={<Control kind="android" wide><span className="text-[0.95rem] font-bold">Agregar</span></Control>}>
            Confirma con <UI>Agregar</UI>.
          </Step>
        </Steps>
        <Tip>¿No lo encuentras? Abre chambarrio.com en Chrome: ahí se instala más fácil.</Tip>
        <CopyLink side={side} />
      </div>
    );
  }
  if (browser === "firefox") {
    return (
      <div className="space-y-3">
        <Steps>
          <Step n={1} control={<Control kind="android"><KebabGlyph className={G} /></Control>}>
            Toca {KEBAB}, arriba a la derecha.
          </Step>
          <Step n={2} control={<Control kind="android"><AddSquareGlyph className={G} /></Control>}>
            Toca <UI>Agregar app a la pantalla de inicio</UI>.
          </Step>
          <Step n={3} control={<Control kind="android" wide><span className="text-[0.95rem] font-bold">Agregar</span></Control>}>
            Confirma con <UI>Agregar</UI>.
          </Step>
        </Steps>
        <Tip>Si prefieres, en Chrome se instala más fácil.</Tip>
      </div>
    );
  }
  if (browser !== "chrome") {
    return (
      <div className="space-y-3">
        <Steps>
          <Step n={1} control={<Control kind="android"><KebabGlyph className={G} /></Control>}>
            Abre chambarrio.com en <UI>Chrome</UI>: copia el enlace de abajo y pégalo ahí.
          </Step>
          <Step n={2} control={<Control kind="android"><Download04Icon2 /></Control>}>
            En Chrome, toca <UI>Instalar</UI> y confirma.
          </Step>
        </Steps>
        <CopyLink side={side} />
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <Steps>
        <Step n={1} control={<Control kind="android"><KebabGlyph className={G} /></Control>}>
          Toca {KEBAB}, arriba a la derecha.
        </Step>
        <Step n={2} control={<Control kind="android"><Download04Icon2 /></Control>}>
          Toca <UI>Instalar y crear acceso directo</UI>. En Chrome más antiguo dice «Agregar a la pantalla principal».
        </Step>
        <Step n={3} control={<Control kind="android" wide><span className="text-[0.95rem] font-bold">Instalar</span></Control>}>
          Elige <UI>Instalar</UI> y confírmalo.
        </Step>
      </Steps>
      <Tip>Al terminar, busca el ícono de Chambarrio en tu pantalla de inicio o entre tus apps.</Tip>
    </div>
  );
}
function Download04Icon2() {
  return <HugeiconsIcon icon={Download04Icon} className="size-6.5" strokeWidth={2} />;
}

/** Two taps: this button, then "Instalar" in Chrome's own dialog. */
export function PromptGuide() {
  const fire = useConfetti();
  return (
    <div className="space-y-3">
      <button
        type="button"
        onClick={(e) => {
          // Where to burst from, read now: the sheet closes once it's installed.
          const r = e.currentTarget.getBoundingClientRect();
          void promptInstall().then((res) => {
            if (res !== "accepted") return;
            closeInstallSheet();
            fire({ x: r.left + r.width / 2, y: r.top + r.height / 2, count: 48 });
            toast.success("¡Listo! Busca Chambarrio en tu pantalla de inicio.");
          });
        }}
        className="press flex h-16 w-full items-center justify-center gap-2.5 rounded-full border-[2.5px] border-ink bg-ink font-display text-[1.2rem] font-extrabold text-limon shadow-[4px_4px_0_0_var(--block-mandarina)]"
      >
        <HugeiconsIcon icon={Download04Icon} className="size-6" strokeWidth={2.4} />
        Instalar Chambarrio
      </button>
      <Tip className="text-center">Luego toca «Instalar» en la ventanita que aparece. Listo.</Tip>
    </div>
  );
}

/**
 * Inside Facebook, Instagram…: open the page in the real browser first (where it installs).
 * `failed`: a hand-off already landed back here (/instalar?iab=fallo): lead with the manual steps.
 */
export function InAppGuide({ platform, side, failed }: { platform: Platform; side: Side; failed?: boolean }) {
  const name = IN_APP_NAME[platform.inApp ?? "webview"];
  const ios = platform.os === "ios";
  const browser = ios ? "Safari" : "tu navegador";
  const escapable = canEscape(platform) && !failed;
  const kind = ios ? "ios" : "android";
  return (
    <div className="space-y-3">
      <p className="text-[1rem] leading-snug font-medium">
        Estás dentro de {name}, y desde aquí no se puede instalar. Ábrela en {browser} y ahí la instalas.
      </p>
      {escapable ? (
        <>
          <button
            type="button"
            onClick={() => tryEscape(platform, side)}
            className="press flex h-15 w-full items-center justify-center gap-2.5 rounded-full border-[2.5px] border-ink bg-ink font-display text-[1.12rem] font-extrabold text-limon shadow-[4px_4px_0_0_var(--block-mandarina)]"
          >
            {ios ? "Abrir en Safari" : "Abrir en mi navegador"}
          </button>
          <Tip>¿No se abrió? Hazlo así:</Tip>
        </>
      ) : failed ? (
        <Tip>No se pudo abrir solo. Hazlo así:</Tip>
      ) : null}
      <Steps>
        <Step n={1} control={<Control kind={kind}>{ios ? <MoreCircleGlyph className={G} /> : <KebabGlyph className={G} />}</Control>}>
          Toca {MORE} o {KEBAB}, arriba a la derecha.
        </Step>
        <Step
          n={2}
          control={
            <Control kind={kind}>
              <HugeiconsIcon icon={BrowserIcon} className="size-6.5" strokeWidth={2} />
            </Control>
          }
        >
          Elige <UI>Abrir en el navegador</UI> (o «Abrir en {ios ? "Safari" : "Chrome"}»).
        </Step>
        <Step n={3} control={<Control kind={kind}><Download04Icon2 /></Control>}>
          {ios ? (
            <>Ya en Safari, sigue los pasos para agregarla a tu inicio.</>
          ) : (
            <>
              Ya en tu navegador, toca <UI>Instalar</UI>.
            </>
          )}
        </Step>
      </Steps>
      <CopyLink side={side} />
    </div>
  );
}

/** Copy the link, to paste it in Chrome or Safari; the link also shows, to copy by hand if that fails. */
export function CopyLink({ side = "candidato" }: { side?: Side }) {
  const [url, setUrl] = useState<string | null>(null);
  async function copy() {
    const link = installPageUrl(side).toString();
    setUrl(link);
    let ok = false;
    try {
      await navigator.clipboard.writeText(link);
      ok = true;
    } catch {
      // Older WebViews: select-and-copy fallback.
      const t = document.createElement("textarea");
      t.value = link;
      t.setAttribute("readonly", "");
      t.style.position = "fixed";
      t.style.opacity = "0";
      document.body.appendChild(t);
      t.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      } finally {
        t.remove();
      }
    }
    if (ok) toast.success("Enlace copiado. Pégalo en Chrome o Safari.");
    else toast.error("No se pudo copiar. Mantén presionado el enlace para copiarlo.");
  }
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <button
        type="button"
        onClick={copy}
        className="press inline-flex h-12 items-center gap-2 rounded-full border-[2.5px] border-ink bg-white px-4 font-display text-[0.98rem] font-extrabold text-ink"
      >
        <HugeiconsIcon icon={Copy01Icon} className="size-5" strokeWidth={2.2} />
        Copiar enlace
      </button>
      {url ? <span className="min-w-0 text-[0.9rem] font-semibold break-all select-all">{url.replace(/^https?:\/\//, "")}</span> : null}
    </div>
  );
}

/**
 * The right instructions for this device (`state` from useInstallState). `failed`: back from an in-app
 * browser hand-off that didn't work.
 */
export function InstallGuide({ state, side, failed }: { state: InstallState; side: Side; failed?: boolean }) {
  switch (state.kind) {
    case "prompt":
      return <PromptGuide />;
    case "inapp":
      return <InAppGuide platform={state.platform} side={side} failed={failed} />;
    case "ios":
      return <IosGuide steps={iosSteps(state.platform)} side={side} />;
    case "android":
      return <AndroidGuide browser={state.platform.browser} side={side} />;
    case "installed":
      return (
        <p className="text-[1rem] leading-snug font-medium">
          Ya tienes Chambarrio en este teléfono. Ábrela desde su ícono en tu pantalla de inicio.
        </p>
      );
    default:
      return null;
  }
}
