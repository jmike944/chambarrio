import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from "./env";

/** Server Supabase client bound to the request cookies (route handlers, server actions). */
export async function getServerSupabase() {
  if (!isSupabaseConfigured) return null;
  const store = await cookies();
  return createServerClient<Database>(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are read-only there; the proxy refreshes them.
        }
      },
    },
  });
}
