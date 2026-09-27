import { mockPackages } from "../../src/mockPackages";
import { HttpError } from "./http";

export type StopSeed = {
  stopNumber: number;
  address: string;
};

export function stopsFromMock(): StopSeed[] {
  const byStop = new Map<number, string>();
  for (const pkg of mockPackages) {
    const existing = byStop.get(pkg.stopNumber);
    if (existing === undefined) {
      byStop.set(pkg.stopNumber, pkg.deliveryAddress);
      continue;
    }
    if (existing !== pkg.deliveryAddress) {
      throw new HttpError(500, `Stop ${pkg.stopNumber} has conflicting addresses in mock data`);
    }
  }
  return [...byStop.entries()]
    .sort((left, right) => left[0] - right[0])
    .map(([stopNumber, address]) => ({ stopNumber, address }));
}
