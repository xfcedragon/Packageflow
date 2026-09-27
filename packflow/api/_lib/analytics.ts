import { HttpError } from "./http.js";
import { execute, qualifiedTable, snowflakeEnvStatus, type SqlValue } from "./snowflake.js";

export const ANALYTICS_EVENT_TYPES = [
  "package_scanned",
  "loading_plan_generated",
  "package_assigned",
  "package_retrieved",
  "package_delivered",
] as const;

export type AnalyticsEventType = (typeof ANALYTICS_EVENT_TYPES)[number];

export type AnalyticsEventInput = {
  event_type: AnalyticsEventType;
  tracking_number: string | null;
  stop_number: number | null;
  zone: string | null;
  shelf: string | null;
  slot: number | null;
  payload: string | null;
};

const EVENT_SET = new Set<string>(ANALYTICS_EVENT_TYPES);
const CHUNK = 20;

export function snowflakeConfigured(): boolean {
  return snowflakeEnvStatus().ready;
}

export function readAnalyticsEvents(body: Record<string, unknown>): AnalyticsEventInput[] {
  const raw = body.events;
  const items = Array.isArray(raw) ? raw : [body];
  if (items.length === 0) throw new HttpError(400, "Provide at least one event");
  if (items.length > 80) throw new HttpError(400, "Send at most 80 events at a time");
  return items.map((item, index) => parseEvent(item, index));
}

export async function insertAnalyticsEvents(events: AnalyticsEventInput[]): Promise<number> {
  const table = qualifiedTable("PACKFLOW_EVENTS");
  let inserted = 0;
  for (let offset = 0; offset < events.length; offset += CHUNK) {
    const chunk = events.slice(offset, offset + CHUNK);
    const values: string[] = [];
    const bindings: SqlValue[] = [];
    chunk.forEach((event, index) => {
      const base = index * 7;
      values.push(
        `(:${base + 1}, :${base + 2}, :${base + 3}, :${base + 4}, :${base + 5}, :${base + 6}, :${base + 7})`,
      );
      bindings.push(
        event.event_type,
        event.tracking_number,
        event.stop_number == null ? null : String(event.stop_number),
        event.zone,
        event.shelf,
        event.slot == null ? null : String(event.slot),
        event.payload,
      );
    });
    await execute(
      `INSERT INTO ${table}
         (event_type, tracking_number, stop_number, zone, shelf, slot, payload)
       SELECT
         event_row.event_type,
         event_row.tracking_number,
         TRY_TO_NUMBER(event_row.stop_number),
         event_row.zone,
         event_row.shelf,
         TRY_TO_NUMBER(event_row.slot),
         TRY_PARSE_JSON(event_row.payload)
       FROM (VALUES ${values.join(", ")})
         AS event_row(event_type, tracking_number, stop_number, zone, shelf, slot, payload)`,
      bindings,
    );
    inserted += chunk.length;
  }
  return inserted;
}

export async function queryAnalytics() {
  const table = qualifiedTable("PACKFLOW_EVENTS");
  const [totals, byType, recent] = await Promise.all([
    execute(
      `SELECT
         COUNT(*) AS event_count,
         COUNT(DISTINCT tracking_number) AS packages_seen,
         COUNT(DISTINCT IFF(event_type = 'package_scanned', tracking_number, NULL)) AS packages_scanned,
         COUNT(DISTINCT IFF(event_type = 'package_assigned', tracking_number, NULL)) AS packages_assigned,
         COUNT(DISTINCT IFF(event_type = 'package_retrieved', tracking_number, NULL)) AS packages_retrieved,
         COUNT(DISTINCT IFF(event_type = 'package_delivered', tracking_number, NULL)) AS packages_delivered
       FROM ${table}`,
    ),
    execute(
      `SELECT event_type, COUNT(*) AS event_count
       FROM ${table}
       GROUP BY event_type`,
    ),
    execute(
      `SELECT event_id, event_type, tracking_number,
              TO_VARCHAR(stop_number) AS stop_number,
              zone, shelf,
              TO_VARCHAR(slot) AS slot,
              TO_VARCHAR(payload) AS payload,
              TO_VARCHAR(event_timestamp) AS event_timestamp
       FROM ${table}
       ORDER BY event_timestamp DESC
       LIMIT 40`,
    ),
  ]);

  const total = totals[0] ?? {};
  const packagesSeen = countOf(total.PACKAGES_SEEN);
  const packagesDelivered = countOf(total.PACKAGES_DELIVERED);
  const counted = new Map(byType.map((row) => [row.EVENT_TYPE ?? "", countOf(row.EVENT_COUNT)]));

  return {
    configured: true as const,
    totals: {
      events: countOf(total.EVENT_COUNT),
      packages_seen: packagesSeen,
      packages_scanned: countOf(total.PACKAGES_SCANNED),
      packages_assigned: countOf(total.PACKAGES_ASSIGNED),
      packages_retrieved: countOf(total.PACKAGES_RETRIEVED),
      packages_delivered: packagesDelivered,
      delivery_progress:
        packagesSeen === 0 ? 0 : Math.round((packagesDelivered / packagesSeen) * 100),
    },
    by_type: ANALYTICS_EVENT_TYPES.map((eventType) => ({
      event_type: eventType,
      count: counted.get(eventType) ?? 0,
    })),
    recent: recent.map((row) => ({
      event_id: row.EVENT_ID,
      event_type: row.EVENT_TYPE,
      tracking_number: emptyToNull(row.TRACKING_NUMBER),
      stop_number: optionalCount(row.STOP_NUMBER),
      zone: emptyToNull(row.ZONE),
      shelf: emptyToNull(row.SHELF),
      slot: optionalCount(row.SLOT),
      payload: emptyToNull(row.PAYLOAD),
      event_timestamp: row.EVENT_TIMESTAMP,
    })),
  };
}

function parseEvent(value: unknown, index: number): AnalyticsEventInput {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, `Event ${index + 1} must be an object`);
  }
  const body = value as Record<string, unknown>;
  const eventType = typeof body.event_type === "string" ? body.event_type.trim() : "";
  if (!EVENT_SET.has(eventType)) {
    throw new HttpError(
      400,
      `Event ${index + 1} event_type must be one of ${ANALYTICS_EVENT_TYPES.join(", ")}`,
    );
  }
  return {
    event_type: eventType as AnalyticsEventType,
    tracking_number: optionalText(body.tracking_number, 64),
    stop_number: optionalInt(body.stop_number),
    zone: optionalText(body.zone, 8),
    shelf: optionalText(body.shelf, 16),
    slot: optionalInt(body.slot),
    payload: optionalPayload(body.payload),
  };
}

function optionalText(value: unknown, max: number): string | null {
  if (value == null || value === "") return null;
  if (typeof value !== "string") throw new HttpError(400, "Event text fields must be strings");
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) throw new HttpError(400, `Event text is longer than ${max} characters`);
  return trimmed;
}

function optionalInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  if (!Number.isInteger(number) || number < 0 || number > 1_000_000) {
    throw new HttpError(400, "stop_number and slot must be whole numbers");
  }
  return number;
}

function optionalPayload(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "payload must be a JSON object");
  }
  const encoded = JSON.stringify(value);
  if (encoded.length > 4000) throw new HttpError(400, "payload is too large");
  return encoded;
}

function countOf(value: string | null | undefined): number {
  if (value == null || value === "") return 0;
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function optionalCount(value: string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  return value;
}
