"use client";

import { create } from "zustand";
import { onLive } from "./events";

/** The Supabase user behind a live session (never persisted; Supabase keeps the session itself). */
export type LiveUser = { id: string; email: string | null; phone: string | null };

type LiveAuthState = {
  user: LiveUser | null;
  /** true once the user set a password through setPassword(); undefined = unknown. */
  hasPassword?: boolean;
  /** The first auth event (INITIAL_SESSION) arrived, so we know whether there is a session. */
  resolved: boolean;
  /** loadSession() finished at least once for the current user. */
  sessionLoaded: boolean;
  /** Last loadSession() error (Spanish), if any. */
  sessionError?: string;
};

export const useLiveAuth = create<LiveAuthState>()(() => ({ user: null, resolved: false, sessionLoaded: false }));

// The user changed (enterDemo / exitDemo / sign-out): forget the account. `resolved` stays: it
// describes the auth client, which keeps running.
onLive("reset", () =>
  useLiveAuth.setState({ user: null, hasPassword: undefined, sessionLoaded: false, sessionError: undefined }),
);
