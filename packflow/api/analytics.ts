import { queryAnalytics, snowflakeConfigured } from "./_lib/analytics";
import { createHandler } from "./_lib/http";

export default createHandler("GET", async () => {
  if (!snowflakeConfigured()) {
    return {
      configured: false,
      message: "Snowflake is not configured on the server. Operational data still comes from Supabase.",
    };
  }
  return queryAnalytics();
});
