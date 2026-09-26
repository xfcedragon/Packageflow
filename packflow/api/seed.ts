import { mockPackages } from "../src/mockPackages";
import { createHandler, HttpError } from "./_lib/http";
import { execute, qualifiedTable, type SqlValue } from "./_lib/snowflake";

type StopSeed = {
  stopNumber: number;
  address: string;
};

export default createHandler("POST", async () => {
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

function stopsFromMock(): StopSeed[] {
  const byStop = new Map<number, string>();
  for (const pkg of mockPackages) {
    const existing = byStop.get(pkg.stopNumber);
    if (existing === undefined) {
      byStop.set(pkg.stopNumber, pkg.deliveryAddress);
      continue;
    }
    if (existing !== pkg.deliveryAddress) {
      throw new HttpError(500, `Stop ${pkg.stopNumber} has conflicting addresses in mock data`);
    }
  }
  return [...byStop.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([stopNumber, address]) => ({ stopNumber, address }));
}

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
