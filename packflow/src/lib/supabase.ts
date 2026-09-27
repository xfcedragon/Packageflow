import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function supabaseUrl(): string {
  return import.meta.env.VITE_SUPABASE_URL?.trim() ?? "";
}

/** Publishable key. `VITE_SUPABASE_ANON_KEY` is accepted as the older name. */
export function supabasePublishableKey(): string {
  return (
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ||
    ""
  );
}

export function supabaseConfigured(): boolean {
  return Boolean(supabaseUrl() && supabasePublishableKey());
}

export function getSupabase(): SupabaseClient | null {
  if (!supabaseConfigured()) return null;
  if (client) return client;
  try {
    client = createClient(supabaseUrl(), supabasePublishableKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    return client;
  } catch {
    return null;
  }
}
