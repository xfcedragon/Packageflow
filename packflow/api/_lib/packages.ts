import type { DeliveryStatus, Package, PackageSize, Shelf, VanZone } from "../../src/types.js";
import { execute, qualifiedTable, SnowflakeQueryError, type SqlRow } from "./snowflake.js";

export const PACKAGE_SELECT = `
  package_id,
  tracking_number,
  recipient,
  delivery_address,
  stop_number,
  package_size,
  weight,
  fragile,
  van_zone,
  shelf,
  slot,
  delivery_status
`;

export async function listPackages(): Promise<Package[]> {
  const rows = await execute(
    `SELECT ${PACKAGE_SELECT}
     FROM ${qualifiedTable("PACKAGES")}
     ORDER BY stop_number, tracking_number`,
  );
  return rows.map(mapPackageRow);
}

export async function packageById(id: string): Promise<Package | null> {
  const rows = await execute(
    `SELECT ${PACKAGE_SELECT}
     FROM ${qualifiedTable("PACKAGES")}
     WHERE package_id = :1`,
    [id],
  );
  return rows[0] ? mapPackageRow(rows[0]) : null;
}

export async function packageByTracking(trackingNumber: string): Promise<Package | null> {
  const rows = await execute(
    `SELECT ${PACKAGE_SELECT}
     FROM ${qualifiedTable("PACKAGES")}
     WHERE tracking_number = :1`,
    [trackingNumber],
  );
  return rows[0] ? mapPackageRow(rows[0]) : null;
}

export function mapPackageRow(row: SqlRow): Package {
  return {
    id: requiredText(row, "PACKAGE_ID"),
    trackingNumber: requiredText(row, "TRACKING_NUMBER"),
    recipient: requiredText(row, "RECIPIENT"),
    deliveryAddress: requiredText(row, "DELIVERY_ADDRESS"),
    stopNumber: requiredNumber(row, "STOP_NUMBER"),
    size: requiredSize(row),
    weight: requiredNumber(row, "WEIGHT"),
    fragile: requiredBoolean(row, "FRAGILE"),
    zone: optionalZone(row),
    shelf: optionalShelf(row),
    slot: optionalNumber(row, "SLOT"),
    status: requiredStatus(row),
  };
}

function requiredText(row: SqlRow, column: string): string {
  const value = row[column];
  if (!value?.trim()) throw badRow(column);
  return value.trim();
}

function requiredNumber(row: SqlRow, column: string): number {
  const value = row[column];
  if (value == null || value.trim() === "") throw badRow(column);
  const number = Number(value);
  if (!Number.isFinite(number)) throw badRow(column);
  return number;
}

function optionalNumber(row: SqlRow, column: string): number | null {
  const value = row[column];
  if (value == null || value.trim() === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw badRow(column);
  return number;
}

function requiredBoolean(row: SqlRow, column: string): boolean {
  const value = row[column]?.trim().toLowerCase();
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw badRow(column);
}

function requiredSize(row: SqlRow): PackageSize {
  const value = requiredText(row, "PACKAGE_SIZE");
  if (value === "small" || value === "medium" || value === "large") return value;
  throw badRow("PACKAGE_SIZE");
}

function requiredStatus(row: SqlRow): DeliveryStatus {
  const value = requiredText(row, "DELIVERY_STATUS");
  if (value === "pending" || value === "delivered") return value;
  throw badRow("DELIVERY_STATUS");
}

function optionalZone(row: SqlRow): VanZone | null {
  const value = row.VAN_ZONE?.trim() ?? "";
  if (!value) return null;
  if (value === "A" || value === "B" || value === "C" || value === "D") return value;
  throw badRow("VAN_ZONE");
}

function optionalShelf(row: SqlRow): Shelf | null {
  const value = row.SHELF?.trim().toLowerCase() ?? "";
  if (!value) return null;
  if (value === "lower" || value === "middle" || value === "upper") return value;
  throw badRow("SHELF");
}

function badRow(column: string): SnowflakeQueryError {
  return new SnowflakeQueryError(`Package row is missing a valid ${column}`, 502);
}
