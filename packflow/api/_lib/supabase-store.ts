import { mockPackages } from "../../src/mockPackages";
import type { Package } from "../../src/types";
import { HttpError } from "./http";
import { stopsFromMock } from "./mock-seed";
import { mapPackageRow } from "./packages";
import type { SqlRow } from "./snowflake";
import { getSupabase, isUniqueViolation, raiseSupabase } from "./supabase";

const PACKAGE_COLUMNS =
  "package_id, tracking_number, recipient, delivery_address, stop_number, package_size, weight, fragile, van_zone, shelf, slot, delivery_status";

type PackageRecord = {
  package_id: string;
  tracking_number: string;
  recipient: string;
  delivery_address: string;
  stop_number: number;
  package_size: string;
  weight: number | string;
  fragile: boolean | string;
  van_zone: string | null;
  shelf: string | null;
  slot: number | string | null;
  delivery_status: string;
};

type StopRecord = {
  stop_number: number;
  address: string;
  status: string;
};

type EventRecord = {
  event_id: string;
  tracking_number: string;
  event_type: string;
  event_timestamp: string;
};

export type LocationUpdate = {
  id: string;
  zone: string | null;
  shelf: string | null;
  slot: number | null;
};

export async function listSupabasePackages(): Promise<Package[]> {
  const { data, error } = await getSupabase()
    .from("packages")
    .select(PACKAGE_COLUMNS)
    .order("stop_number", { ascending: true })
    .order("tracking_number", { ascending: true });
  raiseSupabase(error, "Could not load packages");
  return ((data ?? []) as PackageRecord[]).map((row) => mapPackageRow(toSqlRow(row)));
}

export async function supabasePackageById(id: string): Promise<Package | null> {
  const { data, error } = await getSupabase()
    .from("packages")
    .select(PACKAGE_COLUMNS)
    .eq("package_id", id)
    .maybeSingle();
  raiseSupabase(error, "Could not load package");
  return data ? mapPackageRow(toSqlRow(data as PackageRecord)) : null;
}

export async function supabasePackageByTracking(trackingNumber: string): Promise<Package | null> {
  const { data, error } = await getSupabase()
    .from("packages")
    .select(PACKAGE_COLUMNS)
    .eq("tracking_number", trackingNumber)
    .maybeSingle();
  raiseSupabase(error, "Could not load package");
  return data ? mapPackageRow(toSqlRow(data as PackageRecord)) : null;
}

export async function findSupabasePackage(id?: string, trackingNumber?: string): Promise<Package | null> {
  if (id && trackingNumber) {
    const byId = await supabasePackageById(id);
    if (!byId || byId.trackingNumber !== trackingNumber) return null;
    return byId;
  }
  if (id) return supabasePackageById(id);
  return supabasePackageByTracking(trackingNumber ?? "");
}

export async function listSupabaseStops() {
  const { data, error } = await getSupabase()
    .from("delivery_stops")
    .select("stop_number, address, status")
    .order("stop_number", { ascending: true });
  raiseSupabase(error, "Could not load delivery stops");
  return ((data ?? []) as StopRecord[]).map((row) => ({
    stopNumber: row.stop_number,
    address: row.address,
    status: row.status,
  }));
}

export async function deliverSupabasePackage(pkg: Package) {
  const { error: updateError } = await getSupabase()
    .from("packages")
    .update({ delivery_status: "delivered" })
    .eq("package_id", pkg.id);
  raiseSupabase(updateError, "Could not update delivery status");

  const event = await insertSupabaseEvent(pkg.trackingNumber, "delivered");
  const updated = await supabasePackageById(pkg.id);
  return { package: updated ?? { ...pkg, status: "delivered" as const }, event };
}

export async function insertSupabaseEvent(trackingNumber: string, eventType: string) {
  const { data, error } = await getSupabase()
    .from("delivery_events")
    .insert({ tracking_number: trackingNumber, event_type: eventType })
    .select("event_id, tracking_number, event_type, event_timestamp")
    .single();
  raiseSupabase(error, "Could not store delivery event");
  const row = data as EventRecord | null;
  if (!row?.event_id || !row.tracking_number || !row.event_type || !row.event_timestamp) {
    throw new HttpError(502, "Delivery event was not stored");
  }
  return {
    event_id: row.event_id,
    tracking_number: row.tracking_number,
    event_type: row.event_type,
    event_timestamp: row.event_timestamp,
  };
}

export async function updateSupabaseLocations(placed: LocationUpdate[]) {
  for (const place of placed) {
    const { error } = await getSupabase()
      .from("packages")
      .update({
        van_zone: place.zone,
        shelf: place.shelf,
        slot: place.slot,
      })
      .eq("package_id", place.id);
    raiseSupabase(error, "Could not update package locations");
  }
}

export async function seedSupabase() {
  const before = await counts();
  if (before.packages === 0) await insertPackages();
  if (before.stops === 0) await insertStops();
  const after = await counts();
  return {
    seeded: after.packages > before.packages || after.stops > before.stops,
    packagesInserted: after.packages - before.packages,
    stopsInserted: after.stops - before.stops,
    packages: after.packages,
    stops: after.stops,
  };
}

async function counts(): Promise<{ packages: number; stops: number }> {
  const packages = await getSupabase()
    .from("packages")
    .select("package_id", { count: "exact", head: true });
  raiseSupabase(packages.error, "Could not count packages");
  const stops = await getSupabase()
    .from("delivery_stops")
    .select("stop_number", { count: "exact", head: true });
  raiseSupabase(stops.error, "Could not count stops");
  return { packages: packages.count ?? 0, stops: stops.count ?? 0 };
}

async function insertPackages() {
  const rows = mockPackages.map((pkg) => ({
    package_id: pkg.id,
    tracking_number: pkg.trackingNumber,
    recipient: pkg.recipient,
    delivery_address: pkg.deliveryAddress,
    stop_number: pkg.stopNumber,
    package_size: pkg.size,
    weight: pkg.weight,
    fragile: pkg.fragile,
    van_zone: null,
    shelf: null,
    slot: null,
    delivery_status: "pending",
  }));
  const { error } = await getSupabase().from("packages").insert(rows);
  if (isUniqueViolation(error)) return;
  raiseSupabase(error, "Could not seed packages");
}

async function insertStops() {
  const rows = stopsFromMock().map((stop) => ({
    stop_number: stop.stopNumber,
    address: stop.address,
    status: "pending",
  }));
  const { error } = await getSupabase().from("delivery_stops").insert(rows);
  if (isUniqueViolation(error)) return;
  raiseSupabase(error, "Could not seed stops");
}

function toSqlRow(row: PackageRecord): SqlRow {
  return {
    PACKAGE_ID: text(row.package_id),
    TRACKING_NUMBER: text(row.tracking_number),
    RECIPIENT: text(row.recipient),
    DELIVERY_ADDRESS: text(row.delivery_address),
    STOP_NUMBER: row.stop_number == null ? null : String(row.stop_number),
    PACKAGE_SIZE: text(row.package_size),
    WEIGHT: row.weight == null ? null : String(row.weight),
    FRAGILE: boolText(row.fragile),
    VAN_ZONE: row.van_zone,
    SHELF: row.shelf,
    SLOT: row.slot == null || row.slot === "" ? null : String(row.slot),
    DELIVERY_STATUS: text(row.delivery_status),
  };
}

function text(value: string | null | undefined): string | null {
  return value ?? null;
}

function boolText(value: boolean | string | null): string | null {
  if (typeof value === "boolean") return value ? "true" : "false";
  return value;
}
