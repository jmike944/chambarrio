"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockIcon } from "@hugeicons/core-free-icons";
import { Avatar, avatarCircleBg } from "@/components/avatar";
import { type AvatarConfig, randomAvatar, sanitizeAvatar } from "@/components/avatar/config";
import { cn } from "@/lib/utils";

/*
 * Applicant avatar (avatar engine), in a round sticker frame:
 *  - unlocked + photo (live signed URL)  → the photo
 *  - otherwise                           → the avatar they built ("Crea tu avatar"), or a deterministic
 *                                          random look; it identifies nobody, so it shows while locked too
 *  - locked                              → + a padlock badge (the photo, name and contact stay hidden)
 * Decorative: the name (or "Postulante · colonia") is always printed next to it.
 * Size / reshape it with className (default size-14, round); the drawing scales and clips with the frame.
 */

const FRAME = "relative size-14 shrink-0 rounded-full border-2 border-ink shadow-[2px_3px_0_0_var(--ink)]";

export function ApplicantAvatar({
  name,
  locked,
  photoUrl,
  art,
  seed,
  className,
}: {
  name: string | null;
  locked: boolean;
  photoUrl?: string | null;
  /** The applicant's avatar (any untrusted value is sanitized). Missing → randomAvatar(seed ?? name). */
  art?: AvatarConfig | null;
  /** Seed for the random look when there's no `art` (an application id keeps it stable while locked). */
  seed?: string;
  className?: string;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  if (!locked && photoUrl && broken !== photoUrl) {
    return (
      <span aria-hidden className={cn(FRAME, "overflow-hidden bg-white", className)}>
        {/* Signed, short-lived storage URL: next/image can't cache it, a plain img is right here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt="" className="size-full object-cover" onError={() => setBroken(photoUrl)} />
      </span>
    );
  }
  const look = art ? sanitizeAvatar(art) : randomAvatar(seed ?? name ?? "postulante");
  return (
    <span aria-hidden className={cn(FRAME, className)} style={{ background: avatarCircleBg(look) }}>
      <span className="absolute inset-0 overflow-hidden rounded-[inherit]">
        <Avatar config={look} framing="busto" size={56} animated={false} className="block size-full" />
      </span>
      {locked ? (
        <span className="absolute -right-1.5 -bottom-1.5 grid size-6 place-items-center rounded-full border-2 border-ink bg-block-sol text-ink">
          <HugeiconsIcon icon={LockIcon} className="size-3.5" strokeWidth={2.6} />
        </span>
      ) : null}
    </span>
  );
}
