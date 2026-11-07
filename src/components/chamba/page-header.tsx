"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { HugeiconsIcon } from "@hugeicons/react";
import { Notification01Icon } from "@hugeicons/core-free-icons";
import { useApp } from "@/lib/store";
import { ChambarrioMark } from "@/components/brand/chambarrio-logo";
import { AccountMenu } from "./account-menu";

const dateFmt = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long" });

function subscribeMinute(cb: () => void) {
  const id = setInterval(cb, 30_000);
  return () => clearInterval(id);
}

let cache = { key: -1, greeting: "", date: "" };
function snapshot() {
  const now = Date.now();
  const key = Math.floor(now / 60_000);
  if (cache.key !== key) {
    const d = new Date(now);
    const h = d.getHours();
    const greeting = h >= 5 && h < 12 ? "Buenos días" : h >= 12 && h < 19 ? "Buenas tardes" : "Buenas noches";
    cache = { key, greeting, date: dateFmt.format(d) };
  }
  return cache;
}
const serverSnapshot = { key: -1, greeting: "", date: "" };

/** "Buenos días" / "Buenas tardes" / "Buenas noches" + date, computed on the client (hour-dependent). */
export function useGreeting() {
  return useSyncExternalStore(subscribeMinute, snapshot, () => serverSnapshot);
}

/**
 * Reference-style greeting header. Mobile: logo + round actions on top, then a muted greeting
 * line and a big display title. Desktop: title left, actions right.
 * `eyebrow` replaces the greeting line (use it for context like "Logística Zapalinamé").
 */
export function PageHeader({
  title,
  eyebrow,
  actions,
}: {
  title: string;
  eyebrow?: string;
  actions?: React.ReactNode;
}) {
  const { greeting } = useGreeting();
  const pathname = usePathname();
  const isEmpresa = pathname === "/empresa" || pathname.startsWith("/empresa/");
  const name = useApp((s) => s.name);
  const first = name.trim().split(/\s+/)[0];
  const line = eyebrow ?? (greeting ? `${greeting}${!isEmpresa && first ? `, ${first}` : ""}` : "");

  return (
    <header className="flex flex-wrap items-center gap-x-3 gap-y-4 pt-4 pb-5 lg:flex-nowrap lg:items-end lg:pt-10 lg:pb-7">
      <Link
        href={isEmpresa ? "/empresa" : "/inicio"}
        aria-label="Chambarrio, inicio"
        className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:hidden"
      >
        <ChambarrioMark className="size-10 shrink-0 group-hover:animate-wiggle" />
      </Link>

      <div className="order-3 w-full min-w-0 lg:order-1 lg:w-auto lg:flex-1">
        <p
          className="min-h-6 animate-rise truncate text-[1rem] text-muted-foreground first-letter:uppercase"
          suppressHydrationWarning
        >
          {line}
        </p>
        <h1
          className="mt-0.5 animate-rise font-display text-[2.5rem] leading-[1.02] font-extrabold tracking-[-0.04em] [--i:1] lg:text-[3.1rem]"
        >
          {title}
        </h1>
      </div>

      <div className="order-2 ml-auto flex shrink-0 items-center gap-2.5">
        {actions}
        <Link
          href="/notificaciones"
          aria-label="Avisos, 2 nuevos"
          className="group press relative grid size-12 place-items-center rounded-full border border-border bg-card text-foreground shadow-card outline-none hover:-translate-y-px focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span className="grid origin-top animate-ring place-items-center group-hover:animate-wiggle">
            <HugeiconsIcon icon={Notification01Icon} className="size-[1.4rem]" strokeWidth={1.8} />
          </span>
          <span aria-hidden className="absolute top-2.5 right-3 size-2.5 rounded-full bg-chile ring-2 ring-card" />
        </Link>
        <AccountMenu />
      </div>
    </header>
  );
}
