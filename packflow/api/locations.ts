import { assignLocations } from "../src/loading";
import { activeBackend } from "./_lib/backend";
import { createHandler, HttpError } from "./_lib/http";
import { listPackages } from "./_lib/packages";
import { execute, qualifiedTable } from "./_lib/snowflake";
import { listSupabasePackages, updateSupabaseLocations } from "./_lib/supabase-store";

type Placement = {
  id: string;
  zone: string | null;
  shelf: string | null;
  slot: number | null;
};

const ZONES = new Set(["A", "B", "C", "D"]);
const SHELVES = new Set(["lower", "middle", "upper"]);

export default createHandler("POST", async (req) => {
  const backend = activeBackend();
  const provided = providedPlacements(req.body);
  if (backend === "supabase") {
    if (provided) {
      await updateSupabaseLocations(provided);
      return { updated: provided.length, source: "request" };
    }
    const packages = await listSupabasePackages();
    const placed = assignLocations(packages);
    await updateSupabaseLocations(placed);
    return { updated: placed.length, packages: placed };
  }

  if (provided) {
    await mergePlacements(provided);
    return { updated: provided.length, source: "request" };
  }

  const packages = await listPackages();
  const placed = assignLocations(packages);
  await mergePlacements(placed);
  return { updated: placed.length, packages: placed };
});

async function mergePlacements(placed: Placement[]) {
  if (placed.length === 0) return;

  const bindings: string[] = [];
  const tuples = placed.map((pkg) => {
    bindings.push(pkg.id, pkg.zone ?? "", pkg.shelf ?? "", pkg.slot == null ? "" : String(pkg.slot));
    const start = bindings.length - 3;
    return `(:${start}, :${start + 1}, :${start + 2}, :${start + 3})`;
  });

  await execute(
    `MERGE INTO ${qualifiedTable("PACKAGES")} AS target
     USING (
       SELECT
         package_id,
         NULLIF(van_zone, '') AS van_zone,
         NULLIF(shelf, '') AS shelf,
         TRY_TO_NUMBER(NULLIF(slot_text, '')) AS slot
       FROM VALUES
         ${tuples.join(",\n")}
         AS seed(package_id, van_zone, shelf, slot_text)
     ) AS source
     ON target.package_id = source.package_id
     WHEN MATCHED THEN UPDATE SET
       van_zone = source.van_zone,
       shelf = source.shelf,
       slot = source.slot`,
    bindings,
  );
}

function providedPlacements(body: unknown): Placement[] | null {
  if (body == null || body === "") return null;
  const value = typeof body === "string" ? parseJson(body) : body;
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  if (!("locations" in value)) return null;
  const locations = (value as { locations?: unknown }).locations;
  if (!Array.isArray(locations)) {
    throw new HttpError(400, "locations must be a list");
  }
  return locations.map(readPlacement);
}

function readPlacement(value: unknown, index: number): Placement {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `Location ${index + 1} is not an object`);
  }
  const row = value as Record<string, unknown>;
  const id = typeof row.id === "string" ? row.id.trim() : "";
  const zone = typeof row.zone === "string" ? row.zone.trim() : "";
  const shelf = typeof row.shelf === "string" ? row.shelf.trim() : "";
  const slot = typeof row.slot === "number" ? row.slot : Number(row.slot);
  if (!id) throw new HttpError(400, `Location ${index + 1} is missing an id`);
  if (!ZONES.has(zone)) throw new HttpError(400, `Location ${index + 1} has an invalid zone`);
  if (!SHELVES.has(shelf)) throw new HttpError(400, `Location ${index + 1} has an invalid shelf`);
  if (!Number.isInteger(slot) || slot < 1) {
    throw new HttpError(400, `Location ${index + 1} has an invalid slot`);
  }
  return { id, zone, shelf, slot };
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new HttpError(400, "Request body must be JSON");
  }
}
