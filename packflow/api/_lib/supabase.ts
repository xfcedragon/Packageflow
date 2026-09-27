import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "./http.js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new HttpError(503, "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  if (!client) {
    client = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

type PostgrestLike = { message?: string; code?: string } | null;

export function raiseSupabase(error: PostgrestLike, fallback: string): void {
  if (!error) return;
  throw new HttpError(502, scrub(error.message || fallback));
}

export function isUniqueViolation(error: PostgrestLike): boolean {
  return error?.code === "23505";
}

function scrub(message: string): string {
  return message
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]")
    .replace(/service_role/gi, "[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
}
