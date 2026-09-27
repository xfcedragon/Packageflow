import { HttpError } from "./http.js";
import { snowflakeEnvStatus } from "./snowflake.js";

const SUPABASE_ENV = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"] as const;

export type Backend = "supabase" | "snowflake";

/**
 * Supabase is the deploy path. Snowflake is used only when Supabase is unset
 * and the Snowflake variables are complete. Otherwise the browser keeps using
 * local mock data and these routes answer 503.
 */
export function activeBackend(): Backend {
  const supabasePresent = SUPABASE_ENV.filter((name) => Boolean(process.env[name]?.trim()));
  if (supabasePresent.length === SUPABASE_ENV.length) return "supabase";
  if (supabasePresent.length > 0) {
    const missing = SUPABASE_ENV.filter((name) => !supabasePresent.includes(name));
    throw new HttpError(
      503,
      `Supabase is incomplete. Set ${missing.join(", ")}. The driver demo still runs on local mock data without a database.`,
    );
  }

  const snowflake = snowflakeEnvStatus();
  if (snowflake.ready) return "snowflake";
  if (snowflake.present.length > 0) {
    throw new HttpError(
      503,
      `Snowflake is incomplete. Missing ${snowflake.missing.join(", ")}. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to use Supabase, or finish the Snowflake variables. The driver demo still runs on local mock data.`,
    );
  }

  throw new HttpError(
    503,
    "No database is configured. Use the local mock demo, or set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
}
