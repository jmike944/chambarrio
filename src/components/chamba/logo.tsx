import { ChambarrioLogo, ChambarrioMark } from "@/components/brand/chambarrio-logo";
import { cn } from "@/lib/utils";

/*
 * Back-compat aliases for the retired "chamb-a lado" logo: existing call sites keep working and
 * now render the Chambarrio brand. Prefer importing from @/components/brand/chambarrio-logo.
 * In-app the mark is drawn WITHOUT the purple tile (the tile is only for the app icon / favicon).
 */

/** Bare radius mark (house, rings, briefcase). Wiggles on hover of a parent `.group`. */
export function LogoMark({ className }: { className?: string }) {
  return <ChambarrioMark className={cn("size-9 shrink-0 group-hover:animate-wiggle", className)} />;
}

/** Header lockup: mark + "chambarrio" wordmark. */
export function Logo({ className }: { className?: string }) {
  return <ChambarrioLogo className={cn("group", className)} iconClassName="size-9 shrink-0 group-hover:animate-wiggle" />;
}
