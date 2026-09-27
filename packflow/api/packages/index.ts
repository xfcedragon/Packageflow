import { activeBackend } from "../_lib/backend";
import { createHandler } from "../_lib/http";
import { listPackages } from "../_lib/packages";
import { listSupabasePackages } from "../_lib/supabase-store";

export default createHandler("GET", async () => {
  if (activeBackend() === "supabase") return listSupabasePackages();
  return listPackages();
});
