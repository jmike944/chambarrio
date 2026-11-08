import { Reveal } from "@/components/chamba/motion";
import { cn } from "@/lib/utils";
import { HazardStripe } from "./decor";

/** Focus ring for plain text links on the public pages. */
export const focusLink = "rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/60";

/** Eyebrow (hazard tick + caps) + big display title, shared by the public pages ("/" and "/empresas"). */
export function SectionHead({
  id,
  eyebrow,
  title,
  children,
  className,
  invert,
}: {
  id: string;
  eyebrow: string;
  title: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** On an ink/violet block: lime eyebrow. */
  invert?: boolean;
}) {
  return (
    <Reveal inView className={cn("max-w-3xl", className)}>
      <p
        className={cn(
          "inline-flex items-center gap-2 font-display text-[0.8rem] font-extrabold tracking-[0.16em] uppercase",
          invert ? "text-limon" : "text-uva-ink",
        )}
      >
        <HazardStripe className="h-3 w-8 rounded-sm" size={5} />
        {eyebrow}
      </p>
      <h2
        id={id}
        className="mt-3 font-display text-[2.3rem] leading-[1] font-extrabold tracking-[-0.045em] sm:text-[3.2rem] lg:text-[3.6rem]"
      >
        {title}
      </h2>
      {children}
    </Reveal>
  );
}
