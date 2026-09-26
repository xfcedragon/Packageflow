import { createHandler } from "./_lib/http";
import { execute, qualifiedTable, SnowflakeQueryError } from "./_lib/snowflake";

type Stop = {
  stopNumber: number;
  address: string;
  status: string;
};

export default createHandler("GET", async () => {
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
