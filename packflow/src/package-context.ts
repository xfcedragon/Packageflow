import { createContext, useContext } from "react";
import type { Package } from "./types";

export type PackageStore = {
  packages: Package[];
  planGenerated: boolean;
  selectedId: string | null;
  demoActive: boolean;
  generatePlan: () => void;
  markDelivered: (id: string) => void;
  selectPackage: (id: string) => void;
  startDemo: () => void;
  exitDemo: () => void;
};

export const PackageContext = createContext<PackageStore | null>(null);

export function usePackages() {
  const value = useContext(PackageContext);
  if (!value) {
    throw new Error("usePackages must be used within PackageProvider");
  }
  return value;
}
