import { activeBackend } from "./_lib/backend";
import { createHandler, HttpError, readObject, textField } from "./_lib/http";
import { packageByTracking } from "./_lib/packages";
import { execute, qualifiedTable } from "./_lib/snowflake";
import { insertSupabaseEvent, supabasePackageByTracking } from "./_lib/supabase-store";

const EVENT_TYPE = /^[A-Za-z0-9_-]{1,32}$/;

export default createHandler("POST", async (req) => {
  const body = readObject(req);
  const trackingNumber = textField(body, "tracking_number");
  const eventType = textField(body, "event_type");
  if (!trackingNumber || !eventType) {
    throw new HttpError(400, "Provide tracking_number and event_type");
  }
  if (!EVENT_TYPE.test(eventType)) {
    throw new HttpError(400, "event_type must be 1-32 letters, numbers, underscores, or hyphens");
  }

  if (activeBackend() === "supabase") {
    const pkg = await supabasePackageByTracking(trackingNumber);
    if (!pkg) throw new HttpError(404, "Package not found");
    return insertSupabaseEvent(pkg.trackingNumber, eventType);
  }

  const pkg = await packageByTracking(trackingNumber);
  if (!pkg) throw new HttpError(404, "Package not found");

  await execute(
    `INSERT INTO ${qualifiedTable("DELIVERY_EVENTS")} (tracking_number, event_type)
     SELECT :1, :2`,
    [pkg.trackingNumber, eventType],
  );

  const rows = await execute(
    `SELECT event_id, tracking_number, event_type,
            TO_VARCHAR(event_timestamp) AS event_timestamp
     FROM ${qualifiedTable("DELIVERY_EVENTS")}
     WHERE tracking_number = :1 AND event_type = :2
     ORDER BY event_timestamp DESC
     LIMIT 1`,
    [pkg.trackingNumber, eventType],
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
});
