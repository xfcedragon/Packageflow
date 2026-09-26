import { useMemo, useState, type ReactNode } from "react";
import { nextPending } from "./delivery";
import { assignLocations } from "./loading";
import { mockPackages } from "./mockPackages";
import { PackageContext, type PackageStore } from "./package-context";
import type { Package } from "./types";

const DEMO_DELIVERED_THROUGH_STOP = 8;

function freshPackages(): Package[] {
  return mockPackages.map((pkg) => ({ ...pkg }));
}

export function PackageProvider({ children }: { children: ReactNode }) {
  const [packages, setPackages] = useState<Package[]>(() =>
    mockPackages.map((pkg) => ({ ...pkg })),
  );
  const [planGenerated, setPlanGenerated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [demoActive, setDemoActive] = useState(false);

  const value = useMemo<PackageStore>(
    () => ({
      packages,
      planGenerated,
      selectedId,
      demoActive,
      generatePlan: () => {
        setPackages((current) => assignLocations(current));
        setPlanGenerated(true);
      },
      markDelivered: (id: string) => {
        setPackages((current) =>
          current.map((pkg) =>
            pkg.id === id ? { ...pkg, status: "delivered" } : pkg,
          ),
        );
        setSelectedId((current) => (current === id ? null : current));
      },
      selectPackage: (id: string) => setSelectedId(id),
      startDemo: () => {
        const scenario = assignLocations(freshPackages()).map((pkg) =>
          pkg.stopNumber <= DEMO_DELIVERED_THROUGH_STOP
            ? { ...pkg, status: "delivered" as const }
            : pkg,
        );
        setPackages(scenario);
        setPlanGenerated(true);
        setDemoActive(true);
        setSelectedId(nextPending(scenario)?.id ?? null);
      },
      exitDemo: () => {
        setPackages(freshPackages());
        setPlanGenerated(false);
        setSelectedId(null);
        setDemoActive(false);
      },
    }),
    [packages, planGenerated, selectedId, demoActive],
  );

  return (
    <PackageContext.Provider value={value}>{children}</PackageContext.Provider>
  );
}
