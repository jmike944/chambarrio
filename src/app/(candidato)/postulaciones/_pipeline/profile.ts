"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { PROFILE_COMPLETE_AT, strengthOf } from "@/lib/profile-strength";
import { useApp } from "@/lib/store";

/** The candidate's profile strength (0–100), same formula as the server's profile_strength. */
export function useMyStrength(): { value: number; low: boolean } {
  const input = useApp(
    useShallow((s) => ({
      name: s.name,
      phone: s.phone,
      hasHome: s.hasHome,
      interests: s.interests,
      headline: s.headline,
      about: s.about,
      education: s.education,
      skills: s.skills,
      certifications: s.certifications,
      shifts: s.shifts,
      availableFrom: s.availableFrom,
      avatarPath: s.avatarPath,
      cvPath: s.cvPath,
      experiences: s.workExperiences.length,
    })),
  );
  return useMemo(() => {
    const value = strengthOf(input);
    return { value, low: value < PROFILE_COMPLETE_AT };
  }, [input]);
}
