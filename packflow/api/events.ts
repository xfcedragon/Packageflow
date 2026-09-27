import { insertAnalyticsEvents, readAnalyticsEvents, snowflakeConfigured } from "./_lib/analytics.js";
import { createHandler, readObject } from "./_lib/http.js";

export default createHandler("POST", async (req) => {
  const events = readAnalyticsEvents(readObject(req));
  if (!snowflakeConfigured()) {
    return { configured: false, skipped: true, inserted: 0 };
  }
  const inserted = await insertAnalyticsEvents(events);
  return { configured: true, skipped: false, inserted };
});
