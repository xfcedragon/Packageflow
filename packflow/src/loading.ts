import type { Package, Shelf, VanZone } from "./types";

export const HEAVY_LBS = 25;

export const ZONE_META: {
  id: VanZone;
  title: string;
  stops: string;
  hint: string;
}[] = [
  { id: "A", title: "Zone A", stops: "Stops 1–5", hint: "At the rear door" },
  { id: "B", title: "Zone B", stops: "Stops 6–10", hint: "Next section" },
  { id: "C", title: "Zone C", stops: "Stops 11–15", hint: "Next section" },
  { id: "D", title: "Zone D", stops: "Stops 16+", hint: "Deepest cargo" },
];

export function zoneForStop(stopNumber: number): VanZone {
  if (stopNumber <= 5) return "A";
  if (stopNumber <= 10) return "B";
  if (stopNumber <= 15) return "C";
  return "D";
}

function byTracking(a: Package, b: Package) {
  return a.trackingNumber.localeCompare(b.trackingNumber);
}

/**
 * Stops 1–5 → A, 6–10 → B, 11–15 → C, 16+ → D.
 * Inside a zone, stops are placed from the door side backward.
 * One stop keeps a run of neighboring slots.
 * Heavy packages (25 lb and over) take the lower shelf.
 * Other fragile packages take the upper shelf, so they sit above
 * heavy ones and never underneath them. Everything else takes the middle.
 * A fragile heavy package stays on the lower shelf with nothing stacked on it.
 * Each zone + shelf + slot holds one package.
 */
export function assignLocations(packages: Package[]): Package[] {
  const next = packages.map((pkg) => ({
    ...pkg,
    zone: null,
    shelf: null,
    slot: null,
  }));

  for (const zone of ZONE_META) {
    const inZone = next
      .filter((pkg) => zoneForStop(pkg.stopNumber) === zone.id)
      .sort((a, b) => a.stopNumber - b.stopNumber || byTracking(a, b));

    const used = new Set<string>();
    let cursor = 1;
    const stopNumbers = [...new Set(inZone.map((pkg) => pkg.stopNumber))];

    for (const stopNumber of stopNumbers) {
      const group = inZone.filter((pkg) => pkg.stopNumber === stopNumber);
      const heavy = group
        .filter((pkg) => pkg.weight >= HEAVY_LBS)
        .sort((a, b) => b.weight - a.weight || byTracking(a, b));
      const fragile = group
        .filter((pkg) => pkg.fragile && pkg.weight < HEAVY_LBS)
        .sort(byTracking);
      const standard = group
        .filter((pkg) => !pkg.fragile && pkg.weight < HEAVY_LBS)
        .sort(byTracking);

      const span = Math.max(heavy.length, fragile.length, standard.length, 1);
      let edge = cursor + span;

      const claim = (pkg: Package, shelf: Shelf, slot: number) => {
        let nextSlot = slot;
        while (used.has(`${shelf}:${nextSlot}`)) nextSlot += 1;
        used.add(`${shelf}:${nextSlot}`);
        pkg.zone = zone.id;
        pkg.shelf = shelf;
        pkg.slot = nextSlot;
        edge = Math.max(edge, nextSlot + 1);
      };

      heavy.forEach((pkg, index) => claim(pkg, "lower", cursor + index));
      fragile.forEach((pkg, index) => claim(pkg, "upper", cursor + index));
      standard.forEach((pkg, index) => {
        const slot = heavy[index]?.fragile ? edge : cursor + index;
        claim(pkg, "middle", slot);
      });

      cursor = edge;
    }
  }

  return next;
}
