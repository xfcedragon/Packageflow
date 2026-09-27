import type { Package, Shelf } from "./types";

const shelfRank: Record<Shelf, number> = { upper: 0, middle: 1, lower: 2 };

export function nextPending(packages: Package[]): Package | null {
  const pending = packages.filter((pkg) => pkg.status !== "delivered");
  if (pending.length === 0) return null;

  const stopNumber = Math.min(...pending.map((pkg) => pkg.stopNumber));
  const atStop = pending.filter((pkg) => pkg.stopNumber === stopNumber);

  atStop.sort((a, b) => {
    const shelfDelta =
      (a.shelf ? shelfRank[a.shelf] : 9) - (b.shelf ? shelfRank[b.shelf] : 9);
    if (shelfDelta !== 0) return shelfDelta;
    return (a.slot ?? 99) - (b.slot ?? 99) || a.trackingNumber.localeCompare(b.trackingNumber);
  });

  return atStop[0] ?? null;
}

export function formatWeight(weight: number) {
  return `${weight.toFixed(1)} lb`;
}

export function formatLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function locationLabel(pkg: Package) {
  if (!pkg.zone || !pkg.shelf || !pkg.slot) return "Not placed yet";
  return `Zone ${pkg.zone} · ${formatLabel(pkg.shelf)} shelf · Slot ${pkg.slot}`;
}

export function driverLocation(pkg: Package) {
  if (!pkg.zone || !pkg.shelf || !pkg.slot) return "Not loaded yet";
  return locationLabel(pkg);
}

export function matchesQuery(pkg: Package, query: string) {
  const text = query.trim().toLowerCase();
  if (!text) return false;
  const compact = text.replace(/[^a-z0-9]/g, "");
  const tracking = pkg.trackingNumber.toLowerCase();
  return (
    tracking.includes(text) ||
    tracking.replace(/[^a-z0-9]/g, "").includes(compact) ||
    pkg.deliveryAddress.toLowerCase().includes(text) ||
    pkg.recipient.toLowerCase().includes(text)
  );
}

export function buildFullRouteUrl(packages: Package[], maxWaypoints: number = 9): string | null {
  const pendingByStop = [...packages]
    .filter((pkg) => pkg.status !== "delivered")
    .sort((a, b) => a.stopNumber - b.stopNumber);

  const uniqueAddresses: string[] = [];
  for (const pkg of pendingByStop) {
    if (!uniqueAddresses.includes(pkg.deliveryAddress)) {
      uniqueAddresses.push(pkg.deliveryAddress);
    }
  }

  if (uniqueAddresses.length === 0) return null;
  if (uniqueAddresses.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(uniqueAddresses[0])}`;
  }

  // Google Maps supports origin, destination, and up to 9 intermediate waypoints
  const stopsToInclude = uniqueAddresses.slice(0, maxWaypoints + 2);
  const origin = encodeURIComponent(stopsToInclude[0]);
  const destination = encodeURIComponent(stopsToInclude[stopsToInclude.length - 1]);
  const intermediate = stopsToInclude
    .slice(1, -1)
    .map((addr) => encodeURIComponent(addr))
    .join("|");

  return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}${
    intermediate ? `&waypoints=${intermediate}` : ""
  }&travelmode=driving`;
}

