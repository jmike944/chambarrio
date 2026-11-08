"use client";

import { useRef } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { BLOCK_CLASS, type BlockTone } from "@/components/chamba/primitives";
import { HARD, HARD_SM, INK_BUTTON, OUTLINE } from "@/components/empresa/workwear";
import { cn } from "@/lib/utils";

/*
 * The team dialogs' frame (same workwear look as the pipeline dialogs): a colored header strip with an
 * icon, a scrolling body and a footer that always shows the action. Opened from state, so focus goes
 * back to whatever opened it (or to `returnFocus` when that control is gone).
 */

/** Ink on light; lime on the dark popover (ink would vanish into it). */
export const SUBMIT = cn(
  "w-full text-[1.02rem] font-bold",
  INK_BUTTON,
  HARD_SM,
  "dark:border-ink dark:bg-limon dark:text-ink dark:hover:bg-limon/90 dark:[&_svg]:text-ink",
);

export function TeamDialog({
  open,
  onOpenChange,
  tone,
  icon,
  title,
  description,
  busy,
  returnFocus,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tone: BlockTone;
  icon: IconSvgElement;
  title: React.ReactNode;
  description: React.ReactNode;
  busy?: boolean;
  returnFocus?: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog open={open} onOpenChange={(o) => (busy ? undefined : onOpenChange(o))}>
      <DialogContent
        onOpenAutoFocus={() => {
          const el = document.activeElement;
          opener.current = el instanceof HTMLElement && el !== document.body ? el : null;
        }}
        onCloseAutoFocus={(e) => {
          const back = opener.current?.isConnected ? opener.current : (returnFocus?.current ?? null);
          opener.current = null;
          if (!back) return;
          e.preventDefault();
          back.focus();
        }}
        className={cn(
          "flex max-h-[min(calc(100dvh-2rem-env(safe-area-inset-top)-env(safe-area-inset-bottom)),52rem)] flex-col gap-0 overflow-hidden rounded-panel p-0 ring-0 sm:max-w-lg [&>[data-slot=dialog-close]]:top-3.5 [&>[data-slot=dialog-close]]:right-3.5 [&>[data-slot=dialog-close]]:text-ink [&>[data-slot=dialog-close]]:hover:bg-white/60",
          OUTLINE,
          HARD,
          "dark:border-white/25",
        )}
      >
        {/* Phones: a smaller tile and tighter padding leave more of the screen to the fields. */}
        <div className={cn("relative isolate flex shrink-0 items-center gap-3.5 border-b-2 border-ink px-5 pt-5 pr-14 pb-4 sm:px-6 max-sm:gap-3 max-sm:pt-4 max-sm:pb-3.5", BLOCK_CLASS[tone])}>
          <span aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-dots opacity-60" />
          <span className="grid size-12 shrink-0 -rotate-6 place-items-center rounded-[0.9rem] border-2 border-ink bg-white text-ink max-sm:size-10 max-sm:rounded-[0.8rem]">
            <HugeiconsIcon icon={icon} className="size-6 max-sm:size-5" strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <DialogTitle className="font-display text-[1.35rem] leading-[1.08] font-extrabold tracking-[-0.03em]">{title}</DialogTitle>
            <DialogDescription className="mt-1 text-[0.92rem] leading-snug text-muted-foreground">{description}</DialogDescription>
          </div>
        </div>
        {children}
      </DialogContent>
    </Dialog>
  );
}

/** Scrolling body + the footer with the action (a <form> when `onSubmit` is given). */
export function DialogBody({
  onSubmit,
  footer,
  children,
}: {
  onSubmit?: (e: React.FormEvent) => void;
  footer: React.ReactNode;
  children: React.ReactNode;
}) {
  const inner = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-5 sm:px-6">{children}</div>
      <div className="shrink-0 border-t-2 border-dashed border-border px-5 pt-3 pb-4 sm:px-6">{footer}</div>
    </>
  );
  return onSubmit ? (
    <form onSubmit={onSubmit} noValidate className="flex min-h-0 flex-1 flex-col">
      {inner}
    </form>
  ) : (
    <div className="flex min-h-0 flex-1 flex-col">{inner}</div>
  );
}

/** Inline problem under a field or the form (the action itself already toasted server errors). */
export function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="mt-2 text-[0.9rem] leading-snug font-semibold text-destructive">
      {children}
    </p>
  );
}
