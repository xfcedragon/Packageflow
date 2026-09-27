import { activeBackend } from "../_lib/backend.js";
import { createHandler, HttpError, queryValue, type ApiRequest } from "../_lib/http.js";
import { packageByTracking } from "../_lib/packages.js";
import { supabasePackageByTracking } from "../_lib/supabase-store.js";

export default createHandler("GET", async (req) => {
  const trackingNumber = trackingFromRequest(req);
  if (!trackingNumber) throw new HttpError(400, "Tracking number is required");
  const pkg =
    activeBackend() === "supabase"
      ? await supabasePackageByTracking(trackingNumber)
      : await packageByTracking(trackingNumber);
  if (!pkg) throw new HttpError(404, "Package not found");
  return pkg;
});

function trackingFromRequest(req: ApiRequest): string {
  const fromQuery = queryValue(req.query?.tracking);
  if (fromQuery) return fromQuery;
  const path = (req.url ?? "").split("?")[0] ?? "";
  const match = path.match(/\/api\/packages\/([^/]+)\/?$/);
  if (!match?.[1]) return "";
  try {
    return decodeURIComponent(match[1]).trim();
  } catch {
    return "";
  }
}
