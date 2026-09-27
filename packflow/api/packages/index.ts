import { activeBackend } from "../_lib/backend.js";
import { createHandler } from "../_lib/http.js";
import { listPackages } from "../_lib/packages.js";
import { listSupabasePackages } from "../_lib/supabase-store.js";

export default createHandler("GET", async () => {
  if (activeBackend() === "supabase") return listSupabasePackages();
  return listPackages();
});
