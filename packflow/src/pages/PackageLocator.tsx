import { MapPin, ScanBarcode, Search } from "lucide-react";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

const PackageScanner = lazy(() =>
  import("../components/PackageScanner").then((mod) => ({ default: mod.PackageScanner })),
);
import { StatusBadge } from "../components/StatusBadge";
import { VanView } from "../components/VanView";
import {
  driverLocation,
  formatLabel,
  formatWeight,
  matchesQuery,
  nextPending,
} from "../delivery";
import { getPackageByTrackingNumber } from "../lib/package-service";
import { usePackages } from "../package-context";
import type { Package } from "../types";

export function PackageLocator() {
  const { packages, markDelivered, selectedId, selectPackage, demoActive, dataMode, includePackage } =
    usePackages();
  const [params, setParams] = useSearchParams();
  const [scanOpen, setScanOpen] = useState(false);
  const query = params.get("q") ?? "";

  const matches = useMemo(
    () => (query.trim() ? packages.filter((pkg) => matchesQuery(pkg, query)) : []),
    [packages, query],
  );

  const fallback = nextPending(packages);
  const selectedFromSearch = query.trim()
    ? matches.find((pkg) => pkg.id === selectedId) ?? matches[0] ?? null
    : null;
  const selected = query.trim()
    ? selectedFromSearch
    : packages.find((pkg) => pkg.id === selectedId) ?? fallback;

  useEffect(() => {
    if (!query.trim() || !selectedFromSearch) return;
    if (selectedFromSearch.id !== selectedId) selectPackage(selectedFromSearch.id);
  }, [query, selectedFromSearch, selectedId, selectPackage]);

  useEffect(() => {
    if (dataMode !== "supabase") return;
    const text = query.trim();
    if (!/^PF\d{12}$/.test(text)) return;
    if (packages.some((pkg) => pkg.trackingNumber === text)) return;
    let cancelled = false;
    void getPackageByTrackingNumber(text)
      .then((pkg) => {
        if (!cancelled && pkg) includePackage(pkg);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [dataMode, includePackage, packages, query]);

  function updateQuery(value: string) {
    if (value) setParams({ q: value }, { replace: true });
    else setParams({}, { replace: true });
  }

  async function resolveMissing(code: string) {
    if (dataMode !== "supabase") return null;
    try {
      const pkg = await getPackageByTrackingNumber(code);
      if (pkg) includePackage(pkg);
      return pkg;
    } catch {
      return null;
    }
  }

  return (
    <div className="page" data-page="locator">
      <header className="page-head">
        <div>
          <p className="eyebrow">Package locator</p>
          <h1>Find it in the van</h1>
          <p className="lede">Search a tracking number or address, or scan the barcode.</p>
        </div>
      </header>

      {demoActive ? (
        <p className="demo-note">
          Demo: the highlighted box is the next delivery. Mark it delivered, then check the dashboard.
        </p>
      ) : null}

      <div className="locator-tools">
        <form className="search-bar" role="search" onSubmit={(event) => event.preventDefault()}>
          <Search size={18} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => updateQuery(event.target.value)}
            placeholder="Tracking number or address"
            aria-label="Search by tracking number or address"
          />
        </form>
        <button type="button" className="btn scan-btn" onClick={() => setScanOpen(true)}>
          <ScanBarcode size={18} aria-hidden="true" />
          Scan Package
        </button>
      </div>

      {scanOpen ? (
        <Suspense fallback={null}>
          <PackageScanner
            packages={packages}
            onClose={() => setScanOpen(false)}
            resolveMissing={resolveMissing}
            onFound={(pkg) => {
              setScanOpen(false);
              includePackage(pkg);
              if (query) setParams({}, { replace: true });
              selectPackage(pkg.id);
            }}
          />
        </Suspense>
      ) : null}

      <div className="locator">
        <section className="card results-card">
          <h2>{query.trim() ? "Matches" : "Next package"}</h2>
          {query.trim() && matches.length === 0 ? (
            <p className="muted">
              No package matches “{query.trim()}”. Try the street or the full tracking number.
            </p>
          ) : (
            <ul className="result-list">
              {(query.trim() ? matches : selected ? [selected] : []).map((pkg) => (
                <li key={pkg.id}>
                  <button
                    type="button"
                    className={pkg.id === selected?.id ? "result active" : "result"}
                    onClick={() => selectPackage(pkg.id)}
                  >
                    <span className="mono">{pkg.trackingNumber}</span>
                    <strong>{pkg.recipient}</strong>
                    <em>{pkg.deliveryAddress}</em>
                    <span className="result-meta">
                      Stop {pkg.stopNumber} · {driverLocation(pkg)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card detail-card">
          {selected ? (
            <PackageDetail
              pkg={selected}
              onDelivered={() => markDelivered(selected.id)}
              packages={packages}
            />
          ) : (
            <div className="empty-state">
              <Search size={28} aria-hidden="true" />
              <h2>Nothing to show</h2>
              <p>Search a tracking number or street to highlight a slot.</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function PackageDetail({
  pkg,
  onDelivered,
  packages,
}: {
  pkg: Package;
  onDelivered: () => void;
  packages: Package[];
}) {
  const delivered = pkg.status === "delivered";

  return (
    <>
      <div className="detail-head">
        <div>
          <p className="eyebrow">Stop {pkg.stopNumber}</p>
          <h2>{pkg.recipient}</h2>
          <p className="address">
            <MapPin size={16} aria-hidden="true" />
            {pkg.deliveryAddress}
          </p>
        </div>
        <StatusBadge status={pkg.status} />
      </div>

      <dl className="facts">
        <div>
          <dt>Tracking</dt>
          <dd className="mono">{pkg.trackingNumber}</dd>
        </div>
        <div>
          <dt>Size</dt>
          <dd>{formatLabel(pkg.size)}</dd>
        </div>
        <div>
          <dt>Weight</dt>
          <dd>{formatWeight(pkg.weight)}</dd>
        </div>
        <div>
          <dt>Fragile</dt>
          <dd>{pkg.fragile ? "Yes" : "No"}</dd>
        </div>
      </dl>

      <div className="location-callout">
        <span>Exact van location</span>
        <strong>{driverLocation(pkg)}</strong>
      </div>

      <VanView packages={packages} highlightId={pkg.id} />

      <div className="button-row">
        <button
          type="button"
          className="btn"
          onClick={onDelivered}
          disabled={delivered}
        >
          {delivered ? "Delivered" : "Mark delivered"}
        </button>
      </div>
    </>
  );
}
