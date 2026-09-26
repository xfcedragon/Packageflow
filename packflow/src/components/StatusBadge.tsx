import type { DeliveryStatus } from "../types";

export function StatusBadge({ status }: { status: DeliveryStatus }) {
  return (
    <span className={`badge badge-${status}`}>
      {status === "delivered" ? "Delivered" : "Pending"}
    </span>
  );
}
