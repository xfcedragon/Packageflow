import { createContext, useContext } from "react";
import type { Package } from "./types";

export type DataMode = "local" | "supabase";

export type PublishResult = "skipped" | "sent" | "failed";

export type LoadSessionStatus = "empty" | "scanning" | "planned";

export type LoadSession = {
  ids: string[];
  startedAt: string | null;
  status: LoadSessionStatus;
};

export type PackageStore = {
  packages: Package[];
  planGenerated: boolean;
  selectedId: string | null;
  demoActive: boolean;
  session: LoadSession;
  dataMode: DataMode;
  supabaseReady: boolean;
  sourceDetail: string | null;
  setDataMode: (mode: DataMode) => void;
  generatePlan: () => void;
  generateSessionPlan: () => Promise<PublishResult>;
  addToSession: (id: string) => "added" | "duplicate";
  removeFromSession: (id: string) => void;
  clearSession: () => void;
  includePackage: (pkg: Package) => void;
  loadDemoSession: () => void;
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
