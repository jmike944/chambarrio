import Link from "next/link";
import { ChambarrioLogo } from "@/components/brand/chambarrio-logo";
import { cn } from "@/lib/utils";
import { HazardStripe } from "./decor";
import { focusLink } from "./section-head";

/** Footer of the public pages: logo + "Hecho en Saltillo" and a row of links. */
export function LandingFooter({ links }: { links: { href: string; label: string }[] }) {
  return (
    <footer>
      <HazardStripe className="h-2.5 opacity-90" />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:flex-row sm:items-center sm:px-6 lg:px-10">
        <div>
          <ChambarrioLogo iconClassName="size-9 shrink-0" />
          <p className="mt-3 text-sm text-muted-foreground">Hecho en Saltillo, Coahuila.</p>
        </div>
        <nav aria-label="Más de Chambarrio" className="flex flex-wrap gap-x-6 gap-y-1 text-[0.95rem] font-medium text-muted-foreground sm:ml-auto sm:justify-end">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={cn(focusLink, "inline-flex min-h-11 items-center hover:text-foreground")}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
