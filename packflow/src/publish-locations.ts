import type { Package } from "./types";

export type PublishResult = "skipped" | "sent" | "failed";

export async function publishSessionLocations(packages: Package[]): Promise<PublishResult> {
  const base = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/$/, "") ?? "";
  if (!base) return "skipped";

  const locations = packages
    .filter((pkg) => pkg.zone && pkg.shelf && pkg.slot != null)
    .map((pkg) => ({
      id: pkg.id,
      zone: pkg.zone,
      shelf: pkg.shelf,
      slot: pkg.slot,
    }));

  try {
    const response = await fetch(`${base}/api/locations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ locations }),
    });
    return response.ok ? "sent" : "failed";
  } catch {
    return "failed";
  }
}
