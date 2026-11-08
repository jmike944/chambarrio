"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useRef, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "motion/react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
  ArrowRight02Icon,
  Briefcase01Icon,
  DashboardSquare01Icon,
  Invoice01Icon,
  Location06Icon,
  MapsIcon,
  Search01Icon,
  Store01Icon,
  UserGroupIcon,
  UserIcon,
  UserCheck01Icon,
  UserMultiple02Icon,
  Building06Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { ChambarrioLogo } from "@/components/brand/chambarrio-logo";
import { springs } from "./motion";
import { ThemeToggle } from "@/components/theme";
import { isLiveAvailable, useApp, useEmployerLocations } from "@/lib/store";
import { useSessionLoaded, useSessionReady } from "@/lib/live/session";
import { DEMO_RECRUITER_ID, ROLE_META, setDemoViewAs, useMyMembership, useTeam, type TeamPermissions } from "@/lib/team";
import { INVITE_PATH } from "@/lib/team/types";
import { Skeleton } from "@/components/ui/skeleton";

export type NavItem = {
  href: string;
  label: string;
  icon: IconSvgElement;
  badge?: "applications" | number;
  exact?: boolean;
  /** Employer nav: shown only to members whose role allows it (team accounts). */
  need?: keyof TeamPermissions;
  /** Left out of the phone's bottom bar when it would hold more than 5 (still on the desktop rail). */
  mobileOptional?: boolean;
};

export const CANDIDATE_NAV: NavItem[] = [
  { href: "/inicio", label: "Cerca", icon: Location06Icon, exact: true },
  { href: "/mapa", label: "Mapa", icon: MapsIcon },
  { href: "/vacantes", label: "Buscar", icon: Search01Icon },
  { href: "/postulaciones", label: "Postulaciones", icon: UserCheck01Icon, badge: "applications" },
  { href: "/perfil", label: "Perfil", icon: UserIcon },
];

/**
 * Every employer destination; AppShell keeps the ones the member's role allows (useEmployerNav):
 * dueño: all · admin: no Plan · reclutador: no Sucursales, no Plan. On a phone the dueño's six don't
 * fit the bottom bar: Sucursales stays on the desktop rail (the Panel and the vacancy pages link it).
 */
export const EMPLOYER_NAV: NavItem[] = [
  { href: "/empresa", label: "Panel", icon: DashboardSquare01Icon, exact: true },
  { href: "/empresa/vacantes", label: "Vacantes", icon: Briefcase01Icon },
  { href: "/empresa/sucursales", label: "Sucursales", icon: Store01Icon, need: "manageBranches", mobileOptional: true },
  { href: "/empresa/candidatos", label: "Candidatos", icon: UserGroupIcon, badge: 7 },
  { href: "/empresa/equipo", label: "Equipo", icon: UserMultiple02Icon, need: "viewTeam" },
  { href: "/empresa/plan", label: "Plan", icon: Invoice01Icon, need: "managePlan" },
];

/** /unirse (accepting a team invite) is public: signed out, mid-onboarding or onboarded, no redirects. */
export const isPublicAppRoute = (pathname: string) => pathname === INVITE_PATH || pathname.startsWith(`${INVITE_PATH}/`);

/**
 * The employer nav for my role. Until the membership is known (server render, first load on a device)
 * the dueño's, the usual case, so the bar doesn't change under them; a returning member's role is
 * saved on the device and applies right after hydration. No team yet (registering a business): as
 * before, minus Equipo.
 */
function useEmployerNav(nav: NavItem[], employer: boolean): { rail: NavItem[]; bottom: NavItem[] } {
  const my = useMyMembership();
  return useMemo(() => {
    const allowed = !employer
      ? nav
      : my.status !== "ready"
        ? nav
        : !my.membership
          ? nav.filter((i) => i.need !== "viewTeam")
          : nav.filter((i) => !i.need || my.can[i.need]);
    const bottom = allowed.length > 5 ? allowed.filter((i) => !i.mobileOptional).slice(0, 5) : allowed;
    return { rail: allowed, bottom };
  }, [nav, employer, my.status, my.membership, my.can]);
}

const MotionLink = motion.create(Link);

function useBadge(badge: NavItem["badge"]) {
  const apps = useApp((s) => s.applications.filter((a) => a.status !== "cerrada").length);
  const demo = useApp((s) => s.mode === "demo");
  if (badge === "applications") return apps;
  // Fixed numbers are demo decoration (e.g. "7 nuevas" candidates); live never shows made-up counts.
  return demo ? badge : undefined;
}

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
}

function a11yLabel(item: NavItem, n: number | undefined) {
  return n ? `${item.label} (${n} ${n === 1 ? "nueva" : "nuevas"})` : item.label;
}

/** Mobile: inactive = icon only; active = violet pill (slides between items) with icon + label. */
function BottomItem({ item, active }: { item: NavItem; active: boolean }) {
  const n = useBadge(item.badge);
  return (
    <li className={cn("flex min-w-0", active ? "flex-none" : "flex-1 justify-center")}>
      <MotionLink
        href={item.href}
        aria-current={active ? "page" : undefined}
        aria-label={a11yLabel(item, n)}
        whileTap={{ scale: 0.9 }}
        transition={springs.snappy}
        className={cn(
          "relative flex h-12 min-w-12 items-center justify-center gap-2 rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
          active ? "pr-4 pl-3.5" : "px-2 text-muted-foreground hover:text-foreground",
        )}
      >
        {active ? (
          <motion.span
            layoutId="nav-pill-bottom"
            transition={springs.snappy}
            className="absolute inset-0 bg-primary shadow-pop"
            style={{ borderRadius: 9999 }}
          />
        ) : null}
        <motion.span
          key={active ? "on" : "off"}
          initial={active ? { scale: 0.5, rotate: -20 } : false}
          animate={{ scale: 1, rotate: 0 }}
          transition={springs.bouncy}
          className={cn("relative z-10 grid place-items-center", active && "text-primary-foreground")}
        >
          <HugeiconsIcon icon={item.icon} className="size-6" strokeWidth={active ? 2 : 1.7} />
          {!active && n ? (
            <span aria-hidden className="absolute -top-0.5 -right-1 size-2.5 rounded-full bg-chile ring-2 ring-card" />
          ) : null}
        </motion.span>
        {active ? (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ ...springs.soft, delay: 0.06 }}
            aria-hidden
            className="relative z-10 truncate text-[0.84rem] font-semibold text-primary-foreground"
          >
            {item.label}
          </motion.span>
        ) : null}
      </MotionLink>
    </li>
  );
}

/** Desktop rail item: icon + label always; active = violet pill that slides. */
function SideItem({ item, active }: { item: NavItem; active: boolean }) {
  const n = useBadge(item.badge);
  return (
    <MotionLink
      href={item.href}
      aria-current={active ? "page" : undefined}
      whileTap={{ scale: 0.97 }}
      transition={springs.snappy}
      className={cn(
        "group relative flex h-12 items-center gap-3 rounded-full px-4 text-[0.98rem] outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        active ? "font-semibold text-primary-foreground" : "text-muted-foreground hover:bg-card hover:text-foreground",
      )}
    >
      {active ? (
        <motion.span
          layoutId="nav-pill-rail"
          transition={springs.snappy}
          className="absolute inset-0 bg-primary shadow-pop"
          style={{ borderRadius: 9999 }}
        />
      ) : null}
      <HugeiconsIcon
        icon={item.icon}
        className="relative z-10 size-5.5 transition-[rotate] duration-300 group-hover:-rotate-8"
        strokeWidth={active ? 2 : 1.7}
      />
      <span className="relative z-10 flex-1">{item.label}</span>
      {n ? (
        <span
          className={cn(
            "relative z-10 grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-bold tabular-nums",
            active ? "bg-limon text-ink" : "bg-chile text-ink",
          )}
        >
          {n}
        </span>
      ) : null}
    </MotionLink>
  );
}

/**
 * Quick fade-rise of the page on route change. Runs WAAPI on the wrapper (no remount, so page
 * state survives). Falls back to a plain fade when the page has fixed-position UI, because a
 * transform would re-anchor it for the duration of the animation.
 */
function RouteTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const el = ref.current;
    if (!el || typeof el.animate !== "function") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const hasFixed = Array.from(el.querySelectorAll<HTMLElement>(".fixed")).some((n) => n.getClientRects().length > 0);
    const anim = el.animate(
      hasFixed
        ? [{ opacity: 0 }, { opacity: 1 }]
        : [
            { opacity: 0, transform: "translateY(10px)" },
            { opacity: 1, transform: "none" },
          ],
      { duration: 260, easing: "cubic-bezier(.2,.8,.2,1)" },
    );
    return () => anim.cancel();
  }, [pathname]);
  return <div ref={ref}>{children}</div>;
}

/**
 * Dev-only living style guide: open any app route with #kit (e.g. /inicio#kit) to see every
 * primitive. Stripped from production builds (constant-folded NODE_ENV branch).
 */
const KitShowcase =
  process.env.NODE_ENV === "production"
    ? null
    : dynamic(() => import("./kit-showcase").then((m) => m.KitShowcase), { ssr: false });

function subscribeHash(cb: () => void) {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
}
function useDevKit() {
  return useSyncExternalStore(
    subscribeHash,
    () => process.env.NODE_ENV !== "production" && window.location.hash === "#kit",
    () => false,
  );
}

const HAZARD_TAPE = "bg-[repeating-linear-gradient(-45deg,var(--ink)_0_8px,var(--block-sol)_8px_16px)]";

/**
 * Leaves the demo with a full reload, so no demo page stays mounted in the background and the
 * signed-out guard can't race the navigation.
 */
function leaveDemoTo(href: string) {
  useApp.getState().exitDemo();
  window.location.href = href;
}

/**
 * Dev builds: /empresa/…?ver=reclutador shows the demo company as its branch-limited reclutador
 * (?ver=dueno goes back), so role-aware screens can be checked by URL. The choice lives in memory
 * (client navigation keeps it; a reload without the parameter is the dueño again).
 */
function useDevDemoViewAs(enabled: boolean) {
  const pathname = usePathname();
  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !enabled) return;
    const ver = new URLSearchParams(window.location.search).get("ver");
    if (ver === "reclutador") setDemoViewAs(DEMO_RECRUITER_ID);
    else if (ver === "dueno") setDemoViewAs(null);
  }, [enabled, pathname]);
}

/** Demo "Ver como": whose view this is, and the way back. */
function DemoViewAsBand() {
  const my = useMyMembership();
  const { me } = useTeam();
  const branches = useEmployerLocations();
  if (!my.viewingAs || !my.role) return null;
  const scope = my.branchIds === null ? "Todas las sucursales" : `Solo ${branches.map((b) => b.name).join(", ") || "ninguna sucursal"}`;
  return (
    <div role="status" className="relative z-40 border-b-[3px] border-ink bg-ink text-white">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-1.5 sm:px-6">
        <span className="min-w-0 truncate text-[0.82rem] leading-tight font-semibold sm:text-[0.9rem]">
          Viendo como <span className="font-extrabold text-limon">{me?.name || ROLE_META[my.role].long}</span>
          <span className="hidden sm:inline">
            {" "}
            · {ROLE_META[my.role].long} · {scope}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setDemoViewAs(null)}
          className="press ml-auto inline-flex h-9 shrink-0 items-center rounded-full bg-limon px-3.5 font-display text-[0.85rem] font-extrabold text-ink outline-none focus-visible:ring-3 focus-visible:ring-white/60"
        >
          Volver a mi vista
        </button>
      </div>
    </div>
  );
}

/** Slim caution-tape band: you're looking at example data. */
function DemoRibbon() {
  const role = useApp((s) => s.role);
  const btn =
    "press inline-flex h-11 shrink-0 items-center rounded-full px-3.5 font-display text-[0.9rem] font-extrabold outline-none transition-[scale,background-color] focus-visible:ring-3 focus-visible:ring-ink/60 sm:px-4";
  return (
    <div role="region" aria-label="Modo demo" className="relative z-50 border-b-[3px] border-ink bg-block-sol text-ink">
      <div className={cn("h-1.5", HAZARD_TAPE)} aria-hidden />
      <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 py-1 pt-[max(0.25rem,env(safe-area-inset-top))] sm:gap-3 sm:px-6">
        <span className="flex min-w-0 flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:gap-3">
          <span className="shrink-0 rounded-md bg-ink px-2 py-1 font-display text-[0.78rem] leading-none font-extrabold tracking-[0.12em] text-limon uppercase">
            Modo demo
          </span>
          <span className="truncate text-[0.74rem] leading-tight font-bold sm:text-[0.9rem] sm:font-semibold">
            <span className="sm:hidden">Datos de ejemplo</span>
            <span className="hidden sm:inline">Datos de ejemplo de Saltillo · nada se guarda</span>
          </span>
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {isLiveAvailable ? (
            <button
              type="button"
              onClick={() => leaveDemoTo(role === "empresa" ? "/bienvenida/empresa" : "/bienvenida")}
              className={cn(btn, "bg-ink text-white hover:bg-ink/85")}
            >
              Crear mi cuenta
            </button>
          ) : null}
          <button type="button" onClick={() => leaveDemoTo(role === "empresa" ? "/empresas" : "/")} className={cn(btn, "hover:bg-ink/10")}>
            Salir
          </button>
        </span>
      </div>
    </div>
  );
}

/** Neutral placeholder while we find out who's here (no seeded or mock content). */
function ShellSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando" className="space-y-5 pt-6">
      <Skeleton className="h-10 w-2/3 rounded-full" />
      <Skeleton className="h-44 w-full rounded-panel" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-28 rounded-panel" />
        <Skeleton className="h-28 rounded-panel" />
      </div>
      <Skeleton className="h-24 w-full rounded-panel" />
    </div>
  );
}

export function AppShell({
  nav,
  mode,
  children,
}: {
  nav: NavItem[];
  mode: "candidato" | "empresa";
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  // Wait for the store AND (live-capable builds) Supabase's initial session before deciding,
  // so someone arriving from the email link isn't bounced to /entrar for a frame.
  const ready = useSessionReady();
  const sessionLoaded = useSessionLoaded();
  const signedIn = useApp((s) => s.signedIn);
  const appMode = useApp((s) => s.mode);
  const onboarded = useApp((s) => s.onboarded);
  const role = useApp((s) => s.role);
  const setRole = useApp((s) => s.setRole);
  // /unirse is public: never bounced to /entrar or to onboarding (an invitee signs in and joins there).
  const open = isPublicAppRoute(pathname);
  const signedOut = ready && !signedIn && !open;
  // A real account that never finished onboarding (signed up from /entrar or the email link).
  const unfinished = ready && signedIn && appMode === "live" && sessionLoaded && !onboarded && !open;
  const kit = useDevKit();
  const employer = mode === "empresa";
  const items = useEmployerNav(nav, employer);
  useDevDemoViewAs(employer && ready && appMode === "demo");

  useEffect(() => {
    if (signedOut) router.replace("/entrar");
    else if (unfinished) router.replace(role === "empresa" ? "/bienvenida/empresa" : "/bienvenida");
  }, [signedOut, unfinished, role, router]);

  // Signed out: render nothing while redirecting so account data never flashes.
  if (signedOut || unfinished) return <div className="min-h-dvh" aria-busy="true" />;
  // A focused, public flow: no app chrome (and no account data) around it.
  if (open) return <>{children}</>;

  const candidate = mode === "candidato";
  const demo = ready && appMode === "demo";

  return (
    <>
      {demo ? <DemoRibbon /> : null}
      {demo && employer ? <DemoViewAsBand /> : null}
      <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
        {/* Desktop rail */}
        <aside className="sticky top-0 hidden h-dvh flex-col gap-8 px-5 py-7 lg:flex">
          <Link
            href="/"
            aria-label="Chambarrio, inicio"
            className="group self-start rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <ChambarrioLogo iconClassName="size-9 shrink-0 group-hover:animate-wiggle" />
          </Link>
          <nav aria-label="Principal" className="flex flex-col gap-1">
            {items.rail.map((item) => (
              <SideItem key={item.href} item={item} active={isActive(pathname, item)} />
            ))}
          </nav>
          <div className="mt-auto space-y-3">
            <Link
              href={candidate ? "/empresa" : "/inicio"}
              onClick={() => setRole(candidate ? "empresa" : "candidato")}
              className={cn(
                "group press lift relative block overflow-hidden rounded-[1.5rem] p-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                candidate ? "bg-limon text-ink" : "bg-primary text-primary-foreground shadow-pop",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute -top-6 -right-6 size-20 rounded-full transition-[scale] duration-500 group-hover:scale-125",
                  candidate ? "bg-ink/[0.06]" : "bg-white/10",
                )}
              />
              <span
                className={cn(
                  "relative grid size-10 place-items-center rounded-full transition-[rotate] duration-300 group-hover:-rotate-12",
                  candidate ? "bg-ink text-limon" : "bg-limon text-ink",
                )}
              >
                <HugeiconsIcon icon={candidate ? Building06Icon : UserIcon} className="size-5" strokeWidth={1.8} />
              </span>
              <span className="relative mt-3 block font-display text-[1.15rem] leading-tight font-extrabold tracking-[-0.02em]">
                {candidate ? "¿Tienes un negocio?" : "¿Buscas trabajo?"}
              </span>
              <span
                className={cn(
                  "relative mt-1 flex items-center gap-1 text-sm",
                  candidate ? "text-ink/75" : "text-primary-foreground/80",
                )}
              >
                {candidate ? "Cambia a modo empresa" : "Cambia a modo candidato"}
                <HugeiconsIcon
                  icon={ArrowRight02Icon}
                  className="size-4 transition-[translate] duration-300 group-hover:translate-x-1"
                  strokeWidth={2}
                />
              </span>
            </Link>
            <div className="flex items-center justify-between rounded-full border border-border bg-card py-1 pr-1 pl-4 shadow-card">
              <span className="text-sm text-muted-foreground">Tema</span>
              <ThemeToggle className="size-10 border-0 bg-tile shadow-none" />
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <main className="mx-auto w-full max-w-xl px-4 pt-safe pb-36 sm:px-6 lg:max-w-6xl lg:px-10 lg:pb-16">
            {ready ? (
              <RouteTransition>{kit && KitShowcase ? <KitShowcase /> : children}</RouteTransition>
            ) : (
              <ShellSkeleton />
            )}
          </main>
        </div>

        {/* Mobile floating pill nav */}
        <nav
          aria-label="Principal"
          className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
        >
          <ul className="mx-auto flex max-w-md items-center gap-0.5 rounded-full border border-border bg-card p-1.5 shadow-nav">
            {items.bottom.map((item) => (
              <BottomItem key={item.href} item={item} active={isActive(pathname, item)} />
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}
