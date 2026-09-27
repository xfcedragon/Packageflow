import { activeBackend } from "./_lib/backend";
import { createHandler, HttpError, readObject, textField } from "./_lib/http";
import { packageById, packageByTracking } from "./_lib/packages";
import { execute, qualifiedTable } from "./_lib/snowflake";
import { deliverSupabasePackage, findSupabasePackage } from "./_lib/supabase-store";

export default createHandler("POST", async (req) => {
  const body = readObject(req);
  const id = textField(body, "id", "packageId", "package_id");
  const trackingNumber = textField(body, "trackingNumber", "tracking_number");
  if (!id && !trackingNumber) {
    throw new HttpError(400, "Provide id or trackingNumber");
  }

  if (activeBackend() === "supabase") {
    const pkg = await findSupabasePackage(id, trackingNumber);
    if (!pkg) throw new HttpError(404, "Package not found");
    return deliverSupabasePackage(pkg);
  }

  const pkg = await findPackage(id, trackingNumber);
  if (!pkg) throw new HttpError(404, "Package not found");

  await execute(
    `UPDATE ${qualifiedTable("PACKAGES")}
     SET delivery_status = 'delivered'
     WHERE package_id = :1`,
    [pkg.id],
  );
  await execute(
    `INSERT INTO ${qualifiedTable("DELIVERY_EVENTS")} (tracking_number, event_type)
     SELECT :1, 'delivered'`,
    [pkg.trackingNumber],
  );

  const updated = await packageById(pkg.id);
  const event = await latestEvent(pkg.trackingNumber, "delivered");
  return { package: updated ?? { ...pkg, status: "delivered" }, event };
});

async function findPackage(id: string | undefined, trackingNumber: string | undefined) {
  if (id && trackingNumber) {
    const byId = await packageById(id);
    if (!byId || byId.trackingNumber !== trackingNumber) return null;
    return byId;
  }
  if (id) return packageById(id);
  return packageByTracking(trackingNumber ?? "");
}

async function latestEvent(trackingNumber: string, eventType: string) {
  const rows = await execute(
    `SELECT event_id, tracking_number, event_type,
            TO_VARCHAR(event_timestamp) AS event_timestamp
     FROM ${qualifiedTable("DELIVERY_EVENTS")}
     WHERE tracking_number = :1 AND event_type = :2
     ORDER BY event_timestamp DESC
     LIMIT 1`,
    [trackingNumber, eventType],
  );
  const row = rows[0];
  if (!row?.EVENT_ID || !row.TRACKING_NUMBER || !row.EVENT_TYPE || !row.EVENT_TIMESTAMP) {
    throw new HttpError(502, "Delivery event was not stored");
  }
  return {
    event_id: row.EVENT_ID,
    tracking_number: row.TRACKING_NUMBER,
    event_type: row.EVENT_TYPE,
    event_timestamp: row.EVENT_TIMESTAMP,
  };
}
