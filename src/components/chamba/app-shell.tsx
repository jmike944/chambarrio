"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
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
  UserGroupIcon,
  UserIcon,
  UserCheck01Icon,
  Building06Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";
import { springs } from "./motion";
import { ThemeToggle } from "@/components/theme";
import { useApp, useHydrated } from "@/lib/store";

export type NavItem = { href: string; label: string; icon: IconSvgElement; badge?: "applications" | number; exact?: boolean };

export const CANDIDATE_NAV: NavItem[] = [
  { href: "/inicio", label: "Cerca", icon: Location06Icon, exact: true },
  { href: "/mapa", label: "Mapa", icon: MapsIcon },
  { href: "/vacantes", label: "Buscar", icon: Search01Icon },
  { href: "/postulaciones", label: "Postulaciones", icon: UserCheck01Icon, badge: "applications" },
  { href: "/perfil", label: "Perfil", icon: UserIcon },
];

export const EMPLOYER_NAV: NavItem[] = [
  { href: "/empresa", label: "Panel", icon: DashboardSquare01Icon, exact: true },
  { href: "/empresa/vacantes", label: "Vacantes", icon: Briefcase01Icon },
  { href: "/empresa/candidatos", label: "Candidatos", icon: UserGroupIcon, badge: 7 },
  { href: "/empresa/plan", label: "Plan", icon: Invoice01Icon },
];

const MotionLink = motion.create(Link);

function useBadge(badge: NavItem["badge"]) {
  const apps = useApp((s) => s.applications.filter((a) => a.status !== "cerrada").length);
  if (badge === "applications") return apps;
  return badge;
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
  const hydrated = useHydrated();
  const signedIn = useApp((s) => s.signedIn);
  const setRole = useApp((s) => s.setRole);
  const signedOut = hydrated && !signedIn;
  const kit = useDevKit();

  useEffect(() => {
    if (signedOut) router.replace("/entrar");
  }, [signedOut, router]);

  // Signed out: render nothing while redirecting so account data never flashes.
  if (signedOut) return <div className="min-h-dvh" aria-busy="true" />;

  const candidate = mode === "candidato";

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[17rem_1fr]">
      {/* Desktop rail */}
      <aside className="sticky top-0 hidden h-dvh flex-col gap-8 px-5 py-7 lg:flex">
        <Link href="/" className="self-start rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="flex flex-col gap-1">
          {nav.map((item) => (
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
            <span className={cn("relative mt-1 flex items-center gap-1 text-sm", candidate ? "text-ink/75" : "text-primary-foreground/80")}>
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
          <RouteTransition>{kit && KitShowcase ? <KitShowcase /> : children}</RouteTransition>
        </main>
      </div>

      {/* Mobile floating pill nav */}
      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <ul className="mx-auto flex max-w-md items-center gap-0.5 rounded-full border border-border bg-card p-1.5 shadow-nav">
          {nav.map((item) => (
            <BottomItem key={item.href} item={item} active={isActive(pathname, item)} />
          ))}
        </ul>
      </nav>
    </div>
  );
}
