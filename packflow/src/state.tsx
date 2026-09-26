import { useMemo, useState, type ReactNode } from "react";
import { nextPending } from "./delivery";
import { assignLocations } from "./loading";
import { mockPackages } from "./mockPackages";
import { PackageContext, type LoadSession, type PackageStore } from "./package-context";
import { publishSessionLocations } from "./publish-locations";
import type { Package } from "./types";

const DEMO_DELIVERED_THROUGH_STOP = 8;

const emptySession: LoadSession = { ids: [], startedAt: null, status: "empty" };

function freshPackages(): Package[] {
  return mockPackages.map((pkg) => ({ ...pkg }));
}

function withoutLocation(pkg: Package): Package {
  return { ...pkg, zone: null, shelf: null, slot: null };
}

export function PackageProvider({ children }: { children: ReactNode }) {
  const [packages, setPackages] = useState<Package[]>(() =>
    mockPackages.map((pkg) => ({ ...pkg })),
  );
  const [planGenerated, setPlanGenerated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [demoActive, setDemoActive] = useState(false);
  const [session, setSession] = useState<LoadSession>(emptySession);

  const value = useMemo<PackageStore>(
    () => ({
      packages,
      planGenerated,
      selectedId,
      demoActive,
      session,
      generatePlan: () => {
        setPackages((current) => assignLocations(current));
        setPlanGenerated(true);
      },
      generateSessionPlan: async () => {
        const selected = session.ids
          .map((id) => packages.find((pkg) => pkg.id === id))
          .filter((pkg): pkg is Package => pkg != null);
        if (selected.length === 0) return "skipped";
        const placed = assignLocations(selected);
        const byId = new Map(placed.map((pkg) => [pkg.id, pkg]));
        setPackages((current) =>
          current.map((pkg) => {
            const next = byId.get(pkg.id);
            if (!next) return withoutLocation(pkg);
            return { ...pkg, zone: next.zone, shelf: next.shelf, slot: next.slot };
          }),
        );
        setPlanGenerated(true);
        setSession((current) => ({ ...current, status: "planned" }));
        return publishSessionLocations(placed);
      },
      addToSession: (id: string) => {
        if (session.ids.includes(id)) return "duplicate";
        setSession((current) => {
          if (current.ids.includes(id)) return current;
          return {
            ids: [...current.ids, id],
            startedAt: current.startedAt ?? new Date().toISOString(),
            status: "scanning",
          };
        });
        return "added";
      },
      removeFromSession: (id: string) => {
        setSession((current) => {
          const ids = current.ids.filter((item) => item !== id);
          return {
            ids,
            startedAt: ids.length === 0 ? null : current.startedAt,
            status: ids.length === 0 ? "empty" : "scanning",
          };
        });
      },
      clearSession: () => {
        const dropping = new Set(session.ids);
        const stillPlaced = packages.some((pkg) => !dropping.has(pkg.id) && pkg.zone);
        setSession(emptySession);
        setPackages((current) =>
          current.map((pkg) => (dropping.has(pkg.id) ? withoutLocation(pkg) : pkg)),
        );
        setPlanGenerated(stillPlaced);
      },
      loadDemoSession: () => {
        setSession({
          ids: packages.map((pkg) => pkg.id),
          startedAt: new Date().toISOString(),
          status: "scanning",
        });
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
        setSession(emptySession);
      },
      exitDemo: () => {
        setPackages(freshPackages());
        setPlanGenerated(false);
        setSelectedId(null);
        setDemoActive(false);
        setSession(emptySession);
      },
    }),
    [packages, planGenerated, selectedId, demoActive, session],
  );

  return (
    <PackageContext.Provider value={value}>{children}</PackageContext.Provider>
  );
}
