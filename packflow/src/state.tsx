import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { nextPending } from "./delivery";
import { assignLocations } from "./loading";
import { recordEvents, type AnalyticsEvent } from "./lib/analytics-events";
import {
  getPackages,
  markPackageDelivered,
  updatePackageLocation,
} from "./lib/package-service";
import { supabaseConfigured } from "./lib/supabase";
import { mockPackages } from "./mockPackages";
import { PackageContext, type DataMode, type LoadSession, type PackageStore } from "./package-context";
import type { Package } from "./types";

const DEMO_DELIVERED_THROUGH_STOP = 8;

const emptySession: LoadSession = { ids: [], startedAt: null, status: "empty" };

function freshPackages(): Package[] {
  return mockPackages.map((pkg) => ({ ...pkg }));
}

function withoutLocation(pkg: Package): Package {
  return { ...pkg, zone: null, shelf: null, slot: null };
}

function isUuid(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function planEvents(rows: Package[], source: "route" | "session"): AnalyticsEvent[] {
  const assigned = rows.filter((pkg) => pkg.zone && pkg.shelf && pkg.slot != null);
  return [
    {
      event_type: "loading_plan_generated",
      payload: { package_count: assigned.length, source },
    },
    ...assigned.map((pkg) => ({
      event_type: "package_assigned" as const,
      tracking_number: pkg.trackingNumber,
      stop_number: pkg.stopNumber,
      zone: pkg.zone,
      shelf: pkg.shelf,
      slot: pkg.slot,
    })),
  ];
}

async function saveLocations(rows: Package[]) {
  const stored = rows.filter((pkg) => isUuid(pkg.id));
  await Promise.all(
    stored.map((pkg) =>
      updatePackageLocation(pkg.id, { zone: pkg.zone, shelf: pkg.shelf, slot: pkg.slot }),
    ),
  );
}

export function PackageProvider({ children }: { children: ReactNode }) {
  const supabaseReady = supabaseConfigured();
  const [packages, setPackages] = useState<Package[]>(() => freshPackages());
  const [planGenerated, setPlanGenerated] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [demoActive, setDemoActive] = useState(false);
  const [session, setSession] = useState<LoadSession>(emptySession);
  const [dataMode, setDataModeState] = useState<DataMode>(supabaseReady ? "supabase" : "local");
  const [sourceDetail, setSourceDetail] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const demoRef = useRef(false);
  demoRef.current = demoActive;

  useEffect(() => {
    if (dataMode !== "supabase") return;
    let cancelled = false;
    setSourceDetail("Loading packages from Supabase…");
    getPackages()
      .then((rows) => {
        if (cancelled || demoRef.current) return;
        setPackages(rows);
        setPlanGenerated(rows.some((pkg) => pkg.zone && pkg.shelf && pkg.slot != null));
        setSelectedId(null);
        setSession(emptySession);
        setSourceDetail(
          rows.length === 0
            ? "Supabase is connected. Run supabase/seed.sql to load the 30 packages."
            : null,
        );
      })
      .catch((error: unknown) => {
        if (cancelled || demoRef.current) return;
        setPackages(freshPackages());
        setPlanGenerated(false);
        setDataModeState("local");
        setSourceDetail(
          error instanceof Error
            ? `${error.message} Showing the local Fredericton demo.`
            : "Could not reach Supabase. Showing the local Fredericton demo.",
        );
      });
    return () => {
      cancelled = true;
    };
  }, [dataMode, reloadKey]);

  const value = useMemo<PackageStore>(
    () => ({
      packages,
      planGenerated,
      selectedId,
      demoActive,
      session,
      dataMode,
      supabaseReady,
      sourceDetail,
      setDataMode: (mode) => {
        setDemoActive(false);
        setSelectedId(null);
        setSession(emptySession);
        setDataModeState(mode);
        if (mode === "local") {
          setPackages(freshPackages());
          setPlanGenerated(false);
          setSourceDetail(null);
        }
      },
      generatePlan: () => {
        const placed = assignLocations(packages);
        setPackages(placed);
        setPlanGenerated(true);
        recordEvents(planEvents(placed, "route"));
        if (dataMode !== "supabase" || demoActive) return;
        void saveLocations(placed).catch((error: unknown) => {
          setSourceDetail(error instanceof Error ? error.message : "Could not save van locations.");
        });
      },
      generateSessionPlan: async () => {
        const selected = session.ids
          .map((id) => packages.find((pkg) => pkg.id === id))
          .filter((pkg): pkg is Package => pkg != null);
        if (selected.length === 0) return "skipped";
        const placed = assignLocations(selected);
        const byId = new Map(placed.map((pkg) => [pkg.id, pkg]));
        const next = packages.map((pkg) => {
          const updated = byId.get(pkg.id);
          if (!updated) return withoutLocation(pkg);
          return { ...pkg, zone: updated.zone, shelf: updated.shelf, slot: updated.slot };
        });
        setPackages(next);
        setPlanGenerated(true);
        setSession((current) => ({ ...current, status: "planned" }));
        recordEvents(planEvents(placed, "session"));
        if (dataMode !== "supabase" || demoActive || !next.some((pkg) => isUuid(pkg.id))) {
          return "skipped";
        }
        try {
          await saveLocations(next);
          return "sent";
        } catch (error: unknown) {
          setSourceDetail(error instanceof Error ? error.message : "Could not save van locations.");
          return "failed";
        }
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
      includePackage: (pkg: Package) => {
        setPackages((current) => (current.some((item) => item.id === pkg.id) ? current : [...current, pkg]));
      },
      loadDemoSession: () => {
        setSession({
          ids: packages.map((pkg) => pkg.id),
          startedAt: new Date().toISOString(),
          status: "scanning",
        });
      },
      markDelivered: (id: string) => {
        const current = packages.find((pkg) => pkg.id === id);
        setPackages((rows) =>
          rows.map((pkg) => (pkg.id === id ? { ...pkg, status: "delivered" } : pkg)),
        );
        setSelectedId((selected) => (selected === id ? null : selected));
        if (current) {
          recordEvents([
            {
              event_type: "package_delivered",
              tracking_number: current.trackingNumber,
              stop_number: current.stopNumber,
              zone: current.zone,
              shelf: current.shelf,
              slot: current.slot,
            },
          ]);
        }
        if (!current || dataMode !== "supabase" || demoActive || !isUuid(current.id)) return;
        void markPackageDelivered(current).catch((error: unknown) => {
          setSourceDetail(
            error instanceof Error ? error.message : "Could not save the delivery.",
          );
        });
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
        setSourceDetail(null);
        setSelectedId(nextPending(scenario)?.id ?? null);
        setSession(emptySession);
      },
      exitDemo: () => {
        setDemoActive(false);
        setSelectedId(null);
        setSession(emptySession);
        if (dataMode === "supabase") {
          setReloadKey((current) => current + 1);
          return;
        }
        setPackages(freshPackages());
        setPlanGenerated(false);
      },
    }),
    [packages, planGenerated, selectedId, demoActive, session, dataMode, supabaseReady, sourceDetail],
  );

  return <PackageContext.Provider value={value}>{children}</PackageContext.Provider>;
}
