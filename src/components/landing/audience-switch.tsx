import Link from "next/link";
import { HugeiconsIcon } from "@hugeicons/react";
import { Building06Icon, JobSearchIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { key: "candidato", href: "/", label: "Busco trabajo", icon: JobSearchIcon },
  { key: "empresa", href: "/empresas", label: "Soy empresa", icon: Building06Icon },
] as const;

/**
 * Top bar on both public landings: switch between the job-seeker landing (/) and the companies page
 * (/empresas). Always visible, every width; the current page is highlighted (aria-current="page").
 * It also takes the iPhone safe area, so the header below it doesn't need to.
 */
export function AudienceSwitch({ active }: { active: "candidato" | "empresa" }) {
  return (
    <div className="bg-ink text-white">
      <nav
        aria-label="Chambarrio para"
        className="mx-auto flex max-w-6xl items-center justify-center gap-3 px-4 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 sm:justify-end sm:px-6 lg:px-10"
      >
        <span className="hidden text-[0.88rem] font-semibold text-white/70 sm:inline">Chambarrio para</span>
        <div className="grid grid-cols-2 gap-1 rounded-full bg-white/12 p-1">
          {OPTIONS.map((o) => {
            const on = o.key === active;
            return (
              <Link
                key={o.key}
                href={o.href}
                aria-current={on ? "page" : undefined}
                className={cn(
                  "inline-flex h-11 min-w-[9.25rem] items-center justify-center gap-1.5 rounded-full px-4 text-[0.92rem] font-bold whitespace-nowrap outline-none transition-colors focus-visible:ring-3 focus-visible:ring-limon/70",
                  on ? "bg-limon text-ink" : "text-white hover:bg-white/15",
                )}
              >
                <HugeiconsIcon icon={o.icon} className="size-4.5 shrink-0" strokeWidth={2.2} />
                {o.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
