import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { ChambarrioLogo } from "@/components/brand/chambarrio-logo";
import { ThemeToggle } from "@/components/theme";
import { UnsubscribeCard, UnsubscribeFallback } from "./unsubscribe-card";

export const metadata: Metadata = {
  title: "Dejar de recibir correos",
  robots: { index: false, follow: false },
};

/**
 * /avisos/baja?t=<unsubscribe_token>&k=<alerts|updates|all> — the human unsubscribe page linked
 * from every email footer. Works signed out and outside the app shell. It never unsubscribes on
 * load (mail scanners open links): the person confirms with a button. The query is read on the
 * client, inside Suspense, so the page shell stays static.
 */
export default function BajaPage() {
  return (
    <div className="min-h-dvh overflow-x-clip">
      <header className="mx-auto flex max-w-xl items-center gap-3 px-4 pt-[max(1.25rem,env(safe-area-inset-top))] pb-4 sm:px-6">
        <Link href="/" aria-label="Chambarrio, inicio" className="group rounded-xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
          <ChambarrioLogo iconClassName="size-9 shrink-0 group-hover:animate-wiggle" />
        </Link>
        <ThemeToggle className="ml-auto size-11" />
      </header>
      <main className="mx-auto max-w-xl px-4 pt-4 pb-20 sm:px-6">
        <Suspense fallback={<UnsubscribeFallback />}>
          <UnsubscribeCard />
        </Suspense>
      </main>
    </div>
  );
}
