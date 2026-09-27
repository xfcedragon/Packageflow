import { mockPackages } from "../src/mockPackages";
import { activeBackend } from "./_lib/backend";
import { createHandler } from "./_lib/http";
import { stopsFromMock, type StopSeed } from "./_lib/mock-seed";
import { execute, qualifiedTable, type SqlValue } from "./_lib/snowflake";
import { seedSupabase } from "./_lib/supabase-store";

export default createHandler("POST", async () => {
  if (activeBackend() === "supabase") return seedSupabase();
  const stops = stopsFromMock();
  const before = await counts();
  if (before.packages === 0) await insertPackages();
  if (before.stops === 0) await insertStops(stops);
  const after = await counts();
  return {
    seeded: after.packages > before.packages || after.stops > before.stops,
    packagesInserted: after.packages - before.packages,
    stopsInserted: after.stops - before.stops,
    packages: after.packages,
    stops: after.stops,
  };
});

async function counts(): Promise<{ packages: number; stops: number }> {
  const rows = await execute(
    `SELECT
       (SELECT COUNT(*) FROM ${qualifiedTable("PACKAGES")}) AS package_count,
       (SELECT COUNT(*) FROM ${qualifiedTable("DELIVERY_STOPS")}) AS stop_count`,
  );
  return {
    packages: Number(rows[0]?.PACKAGE_COUNT ?? 0),
    stops: Number(rows[0]?.STOP_COUNT ?? 0),
  };
}

async function insertPackages() {
  const bindings: SqlValue[] = [];
  const tuples = mockPackages.map((pkg) => {
    bindings.push(
      pkg.id,
      pkg.trackingNumber,
      pkg.recipient,
      pkg.deliveryAddress,
      String(pkg.stopNumber),
      pkg.size,
      String(pkg.weight),
      pkg.fragile ? "true" : "false",
    );
    const start = bindings.length - 7;
    return `(:${start}, :${start + 1}, :${start + 2}, :${start + 3}, :${start + 4}, :${start + 5}, :${start + 6}, :${start + 7})`;
  });
  const table = qualifiedTable("PACKAGES");
  await execute(
    `INSERT INTO ${table} (
       package_id, tracking_number, recipient, delivery_address,
       stop_number, package_size, weight, fragile
     )
     SELECT
       package_id, tracking_number, recipient, delivery_address,
       TO_NUMBER(stop_number), package_size, TO_DECIMAL(weight, 10, 1), TO_BOOLEAN(fragile)
     FROM VALUES
       ${tuples.join(",\n")}
       AS seed(
         package_id, tracking_number, recipient, delivery_address,
         stop_number, package_size, weight, fragile
       )
     WHERE (SELECT COUNT(*) FROM ${table}) = 0`,
    bindings,
  );
}

async function insertStops(stops: StopSeed[]) {
  const bindings: SqlValue[] = [];
  const tuples = stops.map((stop) => {
    bindings.push(String(stop.stopNumber), stop.address);
    const start = bindings.length - 1;
    return `(:${start}, :${start + 1})`;
  });
  const table = qualifiedTable("DELIVERY_STOPS");
  await execute(
    `INSERT INTO ${table} (stop_number, address)
     SELECT TO_NUMBER(stop_number), address
     FROM VALUES
       ${tuples.join(",\n")}
       AS seed(stop_number, address)
     WHERE (SELECT COUNT(*) FROM ${table}) = 0`,
    bindings,
  );
}
