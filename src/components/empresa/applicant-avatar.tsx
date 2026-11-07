"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { LockIcon } from "@hugeicons/core-free-icons";
import type { AvatarArt } from "@/lib/data/applicants";
import { InitialsAvatar } from "@/app/empresa/wait-ring";
import { cn } from "@/lib/utils";

/*
 * Applicant avatar, four states:
 *  - unlocked + photo (live signed URL)      → the photo
 *  - unlocked + demo "photo"                 → IllustratedAvatar (flat sticker bust, no face, no real person)
 *  - unlocked, no photo (or it failed)       → chunky initials badge
 *  - locked                                  → blurred silhouette behind a padlock
 * Decorative: the name is always printed next to it.
 */

const FRAME = "relative size-14 shrink-0 rounded-[0.9rem] border-2 border-ink shadow-[2px_3px_0_0_var(--ink)]";

export function ApplicantAvatar({
  name,
  locked,
  photoUrl,
  art,
  className,
}: {
  name: string | null;
  locked: boolean;
  photoUrl?: string | null;
  art?: AvatarArt | null;
  className?: string;
}) {
  const [broken, setBroken] = useState<string | null>(null);
  if (locked) return <LockedSilhouette className={className} />;
  if (photoUrl && broken !== photoUrl) {
    return (
      <span aria-hidden className={cn(FRAME, "overflow-hidden bg-white", className)}>
        {/* Signed, short-lived storage URL: next/image can't cache it, a plain img is right here. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photoUrl} alt="" className="size-full object-cover" onError={() => setBroken(photoUrl)} />
      </span>
    );
  }
  if (art) return <IllustratedAvatar art={art} className={className} />;
  return <InitialsAvatar name={name ?? "?"} size="lg" className={className} />;
}

function LockedSilhouette({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn(FRAME, "bg-white", className)}>
      <span className="absolute inset-0 overflow-hidden rounded-[0.75rem] bg-[color-mix(in_oklab,var(--ink)_8%,white)]">
        <svg viewBox="0 0 56 56" className="size-full blur-[2.5px]">
          <circle cx="28" cy="23" r="10" fill="rgb(22 15 51 / 0.42)" />
          <path d="M6 60 C7 45 16 37 28 37 C40 37 49 45 50 60 Z" fill="rgb(22 15 51 / 0.42)" />
        </svg>
      </span>
      <span className="absolute -right-2 -bottom-2 grid size-6 place-items-center rounded-full border-2 border-ink bg-block-sol text-ink">
        <HugeiconsIcon icon={LockIcon} className="size-3.5" strokeWidth={2.6} />
      </span>
    </span>
  );
}

const INK = "#160F33";
const SKIN = ["#F6D3B3", "#E2B189", "#C3895B", "#8A5838"] as const;
const BG: Record<AvatarArt["bg"], string> = {
  sol: "var(--block-sol)",
  cielo: "var(--block-cielo)",
  menta: "var(--block-menta)",
  lila: "var(--block-lila)",
  durazno: "var(--block-durazno)",
  limon: "var(--block-limon)",
};
const TOP: Record<AvatarArt["top"], string> = {
  chaleco: "#FF7A1A",
  playera: "#2F5FD0",
  camisa: "#FFFFFF",
  overol: "#355C8C",
};

/** Flat workwear bust: hard hat / cap, hair, shirt or safety vest. No facial features. */
export function IllustratedAvatar({ art, className }: { art: AvatarArt; className?: string }) {
  const skin = SKIN[art.skin];
  const hair = art.skin >= 2 ? "#1A120E" : "#3B2516";
  const top = TOP[art.top];
  const id = `av-${art.skin}${art.hair}${art.hat ?? ""}${art.top}${art.bg}`;
  return (
    <span aria-hidden className={cn(FRAME, "overflow-hidden", className)} style={{ background: BG[art.bg] }}>
      <svg viewBox="0 0 56 56" className="size-full">
        <defs>
          <clipPath id={id}>
            <path d="M5 60 C6 45 16 38 28 38 C40 38 50 45 51 60 Z" />
          </clipPath>
        </defs>
        {/* long hair falls behind the shoulders */}
        {art.hair === "largo" ? <path d="M16 25 C15 11 41 11 40 25 L42 42 L14 42 Z" fill={hair} stroke={INK} strokeWidth="2" /> : null}
        {/* body */}
        <path d="M5 60 C6 45 16 38 28 38 C40 38 50 45 51 60 Z" fill={top} stroke={INK} strokeWidth="2" />
        <g clipPath={`url(#${id})`}>
          {art.top === "chaleco" ? (
            <>
              <path d="M22 38 L28 50 L34 38 Z" fill="#5B6B7C" />
              <rect x="0" y="48" width="56" height="3.5" fill="#E9EEF2" />
              <rect x="0" y="54" width="56" height="3.5" fill="#E9EEF2" />
            </>
          ) : art.top === "camisa" ? (
            <path d="M21 38 L28 46 L35 38 L32 37 L28 42 L24 37 Z" fill="#DDE3EA" stroke={INK} strokeWidth="1.5" />
          ) : art.top === "overol" ? (
            <>
              <rect x="17" y="40" width="4" height="20" fill="#24446D" />
              <rect x="35" y="40" width="4" height="20" fill="#24446D" />
              <rect x="20" y="50" width="16" height="10" fill="#24446D" />
            </>
          ) : (
            <path d="M22 38.5 C24 42 32 42 34 38.5" fill="none" stroke={INK} strokeWidth="1.6" />
          )}
        </g>
        {/* neck + head */}
        <rect x="24" y="31" width="8" height="8" fill={skin} stroke={INK} strokeWidth="2" />
        <circle cx="28" cy="24" r="10" fill={skin} stroke={INK} strokeWidth="2" />
        {/* hair on top */}
        {art.hat ? null : art.hair === "rapado" ? (
          <path d="M18.6 21 C19.5 14 36.5 14 37.4 21 C33 18.6 23 18.6 18.6 21 Z" fill={hair} opacity="0.75" />
        ) : (
          <path d="M18 23 C17.5 12 38.5 12 38 23 C35 18.5 26 17.5 18 23 Z" fill={hair} stroke={INK} strokeWidth="1.5" />
        )}
        {art.hair === "chongo" && !art.hat ? <circle cx="28" cy="11.5" r="4.5" fill={hair} stroke={INK} strokeWidth="1.5" /> : null}
        {/* hats */}
        {art.hat === "casco" ? (
          <g stroke={INK} strokeWidth="2" strokeLinejoin="round">
            <path d="M17 21 C17 10.5 39 10.5 39 21 Z" fill="#FFC93C" />
            <path d="M28 11.5 L28 21" fill="none" strokeWidth="1.6" />
            <rect x="13.5" y="20" width="29" height="4" rx="2" fill="#FFC93C" />
          </g>
        ) : art.hat === "gorra" ? (
          <g stroke={INK} strokeWidth="2" strokeLinejoin="round">
            <path d="M18 21 C18 11.5 38 11.5 38 21 Z" fill="#E4472B" />
            <path d="M36 20 C40 19.5 45 20.5 46 22.5 L36 22.5 Z" fill="#E4472B" />
          </g>
        ) : null}
      </svg>
    </span>
  );
}
