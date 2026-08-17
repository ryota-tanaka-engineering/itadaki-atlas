import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Cookie を使わない読み取り専用クライアント。
 * OGP画像生成など、リクエストのセッション文脈が無い場所で使う。
 * anon key なので RLS が適用され、published のみが読める。
 */
export function createStaticClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error(
      "Supabase environment variables are not configured (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }
  return createSupabaseClient(url, anonKey, { auth: { persistSession: false } });
}
