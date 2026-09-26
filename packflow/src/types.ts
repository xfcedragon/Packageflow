export type PackageSize = "small" | "medium" | "large";

export type VanZone = "A" | "B" | "C" | "D";

export type Shelf = "lower" | "middle" | "upper";

export type DeliveryStatus = "pending" | "delivered";

export type Package = {
  id: string;
  trackingNumber: string;
  recipient: string;
  deliveryAddress: string;
  stopNumber: number;
  size: PackageSize;
  weight: number;
  fragile: boolean;
  zone: VanZone | null;
  shelf: Shelf | null;
  slot: number | null;
  status: DeliveryStatus;
};
