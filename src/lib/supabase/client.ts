"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

let client: SupabaseClient<Database> | null = null;

/** Browser Supabase client (singleton). Null when live mode isn't configured. */
export function getSupabase(): SupabaseClient<Database> | null {
  if (!isSupabaseConfigured) return null;
  client ??= createBrowserClient<Database>(SUPABASE_URL, SUPABASE_KEY);
  return client;
}
