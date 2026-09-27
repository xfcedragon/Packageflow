import { activeBackend } from "./_lib/backend.js";
import { createHandler } from "./_lib/http.js";
import { execute, qualifiedTable, SnowflakeQueryError } from "./_lib/snowflake.js";
import { listSupabaseStops } from "./_lib/supabase-store.js";

type Stop = {
  stopNumber: number;
  address: string;
  status: string;
};

export default createHandler("GET", async () => {
  if (activeBackend() === "supabase") return listSupabaseStops();
  const rows = await execute(
    `SELECT stop_number, address, status
     FROM ${qualifiedTable("DELIVERY_STOPS")}
     ORDER BY stop_number`,
  );
  return rows.map(mapStop);
});

function mapStop(row: Record<string, string | null>): Stop {
  const stopNumber = Number(row.STOP_NUMBER);
  const address = row.ADDRESS?.trim() ?? "";
  const status = row.STATUS?.trim() ?? "";
  if (!Number.isFinite(stopNumber) || !address || !status) {
    throw new SnowflakeQueryError("Stop row is incomplete", 502);
  }
  return { stopNumber, address, status };
}
