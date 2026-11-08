"use client";

/*
 * Inside the app the mascot's part is played by the user: their own avatar ("Crea tu avatar", else
 * their stable look; useMyAvatar) in the mascot's moods and with its held props. Candidates and
 * companies alike (each team member sees their own look, as in the account menu; the demo's "Ver como"
 * shows the previewed member's: useActingAvatar). The public pages with no user yet (landing,
 * onboarding, emails) keep el Chambas: they use <Mascot> / <Scene> directly.
 *
 * Until the store has hydrated the user's look isn't known, so the spot is held empty at the exact
 * same size (and with the same responsive classes); the figure then fades in. A random face never
 * flashes before the saved one. Mounted after hydration (client navigation) it just appears.
 */
import { useState } from "react";
import { useHydrated } from "@/lib/store";
import { useActingAvatar } from "@/lib/team";
import { cn } from "@/lib/utils";
import { Mascot, MascotPlaceholder, type MascotProps } from "./mascot";
import { Scene, type MascotSceneName, type SceneProps } from "./scenes";

/** Faded in when the look arrives after the first paint (mascot.css · mscArrive). */
const ARRIVE = "mscArrive";

/** True only for a component that mounted before the store hydrated (its figure arrives late). */
function useArrivesLate(hydrated: boolean) {
  const [late] = useState(() => !hydrated);
  return late;
}

/** The mascot, played by the signed-in (or demo) user. Same props as <Mascot> except `config`. */
export function MyMascot(props: Omit<MascotProps, "config">) {
  const config = useActingAvatar();
  const hydrated = useHydrated();
  const late = useArrivesLate(hydrated);
  if (!hydrated) return <MascotPlaceholder size={props.size} className={props.className} />;
  return <Mascot {...props} config={config} className={cn(props.className, late && ARRIVE)} />;
}

export type MySceneProps = Omit<SceneProps, "name" | "mascot" | "mascotClassName"> & { name: MascotSceneName };

/** A scene the mascot plays in (exito / busqueda / vacio), with the user in its part. */
export function MyScene(props: MySceneProps) {
  const config = useActingAvatar();
  const hydrated = useHydrated();
  const late = useArrivesLate(hydrated);
  return <Scene {...props} mascot={hydrated ? config : null} mascotClassName={late ? ARRIVE : undefined} />;
}
