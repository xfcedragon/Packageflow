import type { DeliveryStatus, Package, PackageSize, Shelf, VanZone } from "../types";
import { getSupabase } from "./supabase";

const PACKAGE_COLUMNS =
  "id, tracking_number, recipient, delivery_address, stop_number, package_size, weight, fragile, van_zone, shelf, slot, delivery_status";

type PackageRow = {
  id: string;
  tracking_number: string;
  recipient: string;
  delivery_address: string;
  stop_number: number;
  package_size: string;
  weight: number | string;
  fragile: boolean;
  van_zone: string | null;
  shelf: string | null;
  slot: number | null;
  delivery_status: string;
};

export type DeliveryStop = {
  id: string;
  stopNumber: number;
  address: string;
  status: string;
};

export type PackageDraft = {
  trackingNumber: string;
  recipient: string;
  deliveryAddress: string;
  stopNumber: number;
  size: PackageSize;
  weight: number;
  fragile?: boolean;
};

export type PackageLocation = {
  zone: VanZone | null;
  shelf: Shelf | null;
  slot: number | null;
};

function db() {
  const client = getSupabase();
  if (!client) throw new Error("Supabase is not configured");
  return client;
}

function fail(error: { message: string } | null, fallback: string) {
  if (!error) return;
  throw new Error(error.message || fallback);
}

export async function getPackages(): Promise<Package[]> {
  const { data, error } = await db()
    .from("packages")
    .select(PACKAGE_COLUMNS)
    .order("stop_number", { ascending: true })
    .order("tracking_number", { ascending: true });
  fail(error, "Could not load packages");
  return ((data ?? []) as PackageRow[]).map(toPackage);
}

export async function getPackageByTrackingNumber(trackingNumber: string): Promise<Package | null> {
  const { data, error } = await db()
    .from("packages")
    .select(PACKAGE_COLUMNS)
    .eq("tracking_number", trackingNumber.trim())
    .maybeSingle();
  fail(error, "Could not load package");
  return data ? toPackage(data as PackageRow) : null;
}

export async function createPackage(draft: PackageDraft): Promise<Package> {
  const { data, error } = await db()
    .from("packages")
    .insert({
      tracking_number: draft.trackingNumber.trim(),
      recipient: draft.recipient,
      delivery_address: draft.deliveryAddress,
      stop_number: draft.stopNumber,
      package_size: draft.size,
      weight: draft.weight,
      fragile: draft.fragile ?? false,
    })
    .select(PACKAGE_COLUMNS)
    .single();
  fail(error, "Could not create package");
  if (!data) throw new Error("Could not create package");
  return toPackage(data as PackageRow);
}

export async function updatePackageLocation(id: string, location: PackageLocation): Promise<void> {
  const { error } = await db()
    .from("packages")
    .update({
      van_zone: location.zone,
      shelf: location.shelf,
      slot: location.slot,
    })
    .eq("id", id);
  fail(error, "Could not save van location");
}

export async function markPackageDelivered(pkg: Package): Promise<void> {
  const { error } = await db()
    .from("packages")
    .update({ delivery_status: "delivered" })
    .eq("id", pkg.id);
  fail(error, "Could not mark package delivered");
  await createDeliveryEvent(pkg.trackingNumber, "delivered");
}

export async function getDeliveryStops(): Promise<DeliveryStop[]> {
  const { data, error } = await db()
    .from("delivery_stops")
    .select("id, stop_number, address, status")
    .order("stop_number", { ascending: true });
  fail(error, "Could not load delivery stops");
  return ((data ?? []) as { id: string; stop_number: number; address: string; status: string }[]).map(
    (row) => ({
      id: row.id,
      stopNumber: row.stop_number,
      address: row.address,
      status: row.status,
    }),
  );
}

export async function createDeliveryEvent(trackingNumber: string, eventType: string): Promise<void> {
  const { error } = await db().from("delivery_events").insert({
    tracking_number: trackingNumber,
    event_type: eventType,
  });
  fail(error, "Could not record delivery event");
}

function toPackage(row: PackageRow): Package {
  return {
    id: row.id,
    trackingNumber: row.tracking_number,
    recipient: row.recipient,
    deliveryAddress: row.delivery_address,
    stopNumber: Number(row.stop_number),
    size: asSize(row.package_size),
    weight: Number(row.weight),
    fragile: Boolean(row.fragile),
    zone: asZone(row.van_zone),
    shelf: asShelf(row.shelf),
    slot: row.slot == null ? null : Number(row.slot),
    status: asStatus(row.delivery_status),
  };
}

function asSize(value: string): PackageSize {
  if (value === "small" || value === "medium" || value === "large") return value;
  return "medium";
}

function asZone(value: string | null): VanZone | null {
  if (value === "A" || value === "B" || value === "C" || value === "D") return value;
  return null;
}

function asShelf(value: string | null): Shelf | null {
  if (value === "lower" || value === "middle" || value === "upper") return value;
  return null;
}

function asStatus(value: string): DeliveryStatus {
  return value === "delivered" ? "delivered" : "pending";
}
