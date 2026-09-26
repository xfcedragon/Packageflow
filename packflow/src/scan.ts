import type { Package } from "./types";

export type ScanLookup =
  | { status: "found"; pkg: Package }
  | { status: "not-found"; code: string }
  | { status: "invalid" };

export function interpretScan(packages: Package[], decoded: string): ScanLookup {
  const code = decoded.trim();
  if (!code) return { status: "invalid" };
  const pkg = packages.find((item) => item.trackingNumber === code);
  if (!pkg) return { status: "not-found", code };
  return { status: "found", pkg };
}

export function cameraMessage(error: unknown): string {
  const text = (
    error instanceof Error ? `${error.name} ${error.message}` : String(error)
  ).toLowerCase();

  if (text.includes("notallowed") || text.includes("permission") || text.includes("denied")) {
    return "Camera permission was denied. Allow camera access in the browser, then try again.";
  }
  if (
    text.includes("notfound") ||
    text.includes("requested device not found") ||
    text.includes("no camera") ||
    text.includes("devices not found") ||
    text.includes("could not start video source")
  ) {
    return "No camera is available on this device.";
  }
  if (text.includes("notreadable") || text.includes("abort") || text.includes("in use")) {
    return "The camera is unavailable. Close other apps using it, then try again.";
  }
  return "The scanner could not start. Check the camera and try again.";
}
