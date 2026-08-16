import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client for use in Server Components and Server
 * Actions only. Auth is sealed in phase 1-2 (see
 * .doc/10_system/01_architecture.md §4), so cookie writes are effectively a
 * no-op today, but the interface is required by `@supabase/ssr`.
 *
 * Reads are restricted by RLS to `status = 'published'` rows
 * (see .doc/10_system/06_security.md).
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Supabase environment variables are not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch (error) {
          // Expected when called from a Server Component (no Auth session
          // is maintained in phase 1-2, so there is nothing to refresh).
          // Logged instead of silently ignored, per project error-visibility rules.
          console.error(
            "supabase/server: cookie write skipped outside a Server Action/Route Handler",
            error,
          );
        }
      },
    },
  });
}
