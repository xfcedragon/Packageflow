import { Check, ScanBarcode, Trash2 } from "lucide-react";
import { lazy, Suspense, useMemo, useState, type FormEvent } from "react";
import { VanView } from "../components/VanView";
import { driverLocation, formatLabel, formatWeight } from "../delivery";
import { recordEvents } from "../lib/analytics-events";
import { getPackageByTrackingNumber } from "../lib/package-service";
import { usePackages } from "../package-context";
import { interpretScan } from "../scan";
import type { Package, Shelf, VanZone } from "../types";

const PackageScanner = lazy(() =>
  import("../components/PackageScanner").then((mod) => ({ default: mod.PackageScanner })),
);

type Notice =
  | { kind: "added"; tracking: string; count: number; total: number }
  | { kind: "duplicate"; tracking: string }
  | { kind: "missing"; tracking: string }
  | { kind: "plan"; placed: number; publish: string };

const shelves: Shelf[] = ["upper", "middle", "lower"];
const zones: VanZone[] = ["A", "B", "C", "D"];

export function ScanPackages() {
  const {
    packages,
    session,
    addToSession,
    removeFromSession,
    clearSession,
    loadDemoSession,
    generateSessionPlan,
    selectPackage,
    selectedId,
    dataMode,
    includePackage,
  } = usePackages();
  const [scanOpen, setScanOpen] = useState(false);
  const [manual, setManual] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);

  const scanned = useMemo(
    () =>
      session.ids
        .map((id) => packages.find((pkg) => pkg.id === id))
        .filter((pkg): pkg is Package => pkg != null),
    [packages, session.ids],
  );
  const total = packages.length;
  const placed = scanned.filter((pkg) => pkg.zone && pkg.shelf && pkg.slot != null);
  const stale = session.status === "scanning" && placed.length > 0;

  function accept(pkg: Package) {
    const result = addToSession(pkg.id);
    if (result === "duplicate") {
      setNotice({ kind: "duplicate", tracking: pkg.trackingNumber });
      return;
    }
    recordEvents([
      {
        event_type: "package_scanned",
        tracking_number: pkg.trackingNumber,
        stop_number: pkg.stopNumber,
        zone: pkg.zone,
        shelf: pkg.shelf,
        slot: pkg.slot,
      },
    ]);
    setNotice({
      kind: "added",
      tracking: pkg.trackingNumber,
      count: session.ids.length + 1,
      total,
    });
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

  async function addManual(event: FormEvent) {
    event.preventDefault();
    const typed = manual.trim();
    const result = interpretScan(packages, typed);
    if (result.status === "found") {
      setManual("");
      accept(result.pkg);
      return;
    }
    const remote = await resolveMissing(typed);
    if (remote) {
      setManual("");
      accept(remote);
      return;
    }
    setNotice({ kind: "missing", tracking: typed });
  }

  async function onGenerate() {
    setBusy(true);
    const publish = await generateSessionPlan();
    setBusy(false);
    setNotice({ kind: "plan", placed: session.ids.length, publish });
  }

  return (
    <div className="page load-page" data-page="scan">
      <header className="load-head">
        <div>
          <p className="eyebrow">Loading session</p>
          <h1>Scan Packages</h1>
        </div>
        <p className="load-fraction" aria-live="polite">
          <strong>{scanned.length}</strong>
          <span>/ {total}</span>
        </p>
      </header>

      <div className="load-flow">
        <p className="load-meta">
          <span className={`load-pill is-${session.status}`}>
            {session.status === "planned"
              ? "Plan ready"
              : session.status === "scanning"
                ? "Scanning"
                : "Empty"}
          </span>
          <span>packages scanned</span>
          {session.startedAt ? <span>Started {formatWhen(session.startedAt)}</span> : null}
        </p>

        <button type="button" className="btn scan-btn load-scan" onClick={() => setScanOpen(true)}>
          <ScanBarcode size={22} aria-hidden="true" />
          {scanned.length === 0 ? "Scan Package" : "Scan Next Package"}
        </button>

        {notice ? <ScanNotice notice={notice} /> : null}
        {stale ? (
          <p className="load-warn" role="status">
            The session changed after the last plan. Generate again to place the latest scans.
          </p>
        ) : null}

        <section className="card load-card">
          <div className="load-card-head">
            <h2>Scanned packages</h2>
            <button
              type="button"
              className="load-clear"
              onClick={() => {
                clearSession();
                setNotice(null);
              }}
              disabled={scanned.length === 0}
            >
              Clear
            </button>
          </div>
          {scanned.length === 0 ? (
            <p className="muted">No packages scanned yet. Scan a barcode to start.</p>
          ) : (
            <ul className="load-list">
              {scanned.map((pkg) => (
                <li key={pkg.id}>
                  <div>
                    <strong className="mono">{pkg.trackingNumber}</strong>
                    <span>
                      Stop {pkg.stopNumber} · {pkg.deliveryAddress.split(",")[0]}
                    </span>
                    <em className={pkg.zone ? "is-placed" : "is-waiting"}>
                      {pkg.zone ? driverLocation(pkg) : "Not loaded yet"}
                    </em>
                  </div>
                  <button
                    type="button"
                    className="load-remove"
                    onClick={() => removeFromSession(pkg.id)}
                    aria-label={`Remove ${pkg.trackingNumber}`}
                  >
                    <Trash2 size={18} aria-hidden="true" />
                    <span>Remove</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <button
          type="button"
          className="btn load-generate"
          onClick={() => void onGenerate()}
          disabled={scanned.length === 0 || busy}
        >
          Generate Loading Plan
        </button>
        <button
          type="button"
          className="btn secondary load-demo"
          onClick={() => {
            loadDemoSession();
            setNotice(null);
          }}
        >
          Load Demo Packages
        </button>

        <form className="load-manual" onSubmit={addManual}>
          <label htmlFor="manual-tracking">Add a tracking number</label>
          <div>
            <input
              id="manual-tracking"
              value={manual}
              onChange={(event) => setManual(event.target.value)}
              placeholder="PF…"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" className="btn secondary">
              Add
            </button>
          </div>
          <p>Looks up an existing package. Unknown barcodes are not added.</p>
        </form>
      </div>

      {placed.length > 0 ? (
        <SessionPlan
          scanned={scanned}
          placed={placed}
          packages={packages}
          selectedId={selectedId}
          onSelect={selectPackage}
        />
      ) : null}

      {scanOpen ? (
        <Suspense fallback={null}>
          <PackageScanner
            packages={packages}
            onClose={() => setScanOpen(false)}
            resolveMissing={resolveMissing}
            onFound={(pkg) => {
              setScanOpen(false);
              includePackage(pkg);
              accept(pkg);
            }}
          />
        </Suspense>
      ) : null}
    </div>
  );
}

function ScanNotice({ notice }: { notice: Notice }) {
  if (notice.kind === "added") {
    return (
      <div className="load-success" role="status">
        <p className="load-ok">
          <Check size={18} aria-hidden="true" /> Package added
        </p>
        <p className="load-code">{notice.tracking}</p>
        <p>
          {notice.count} / {notice.total} packages scanned
        </p>
      </div>
    );
  }
  if (notice.kind === "duplicate") {
    return (
      <div className="load-warn" role="status">
        <strong>Package already scanned</strong>
        <p className="load-code">{notice.tracking}</p>
      </div>
    );
  }
  if (notice.kind === "missing") {
    return (
      <div className="load-error" role="status">
        <strong>Package not found</strong>
        <p className="load-code">{notice.tracking || "Blank barcode"}</p>
      </div>
    );
  }
  return (
    <div className="load-success" role="status">
      <p className="load-ok">
        <Check size={18} aria-hidden="true" /> Loading plan generated
      </p>
      <p>{countLabel(notice.placed).replace("scanned", "placed")} in the van.</p>
      <p>{publishNote(notice.publish)}</p>
    </div>
  );
}

function SessionPlan({
  scanned,
  placed,
  packages,
  selectedId,
  onSelect,
}: {
  scanned: Package[];
  placed: Package[];
  packages: Package[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const rows = [...scanned].sort(
    (a, b) => a.stopNumber - b.stopNumber || a.trackingNumber.localeCompare(b.trackingNumber),
  );

  return (
    <>
      <section className="card">
        <h2>Loading plan</h2>
        <p className="load-totals">
          {placed.length} placed
          {zones.map((zone) => ` · ${zone} ${placed.filter((pkg) => pkg.zone === zone).length}`).join("")}
        </p>
        <ul className="rule-list">
          {shelves.map((shelf) => (
            <li key={shelf}>
              {formatLabel(shelf)} shelf {placed.filter((pkg) => pkg.shelf === shelf).length}
            </li>
          ))}
        </ul>
        <VanView packages={packages} highlightId={selectedId} />
      </section>

      <section className="card">
        <h2>Session packages</h2>
        <div className="table-wrap">
          <table className="plan-table">
            <thead>
              <tr>
                <th>Tracking</th>
                <th>Stop</th>
                <th>Address</th>
                <th>Size</th>
                <th>Weight</th>
                <th>Fragile</th>
                <th>Zone</th>
                <th>Shelf</th>
                <th>Slot</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((pkg) => (
                <tr key={pkg.id} onClick={() => onSelect(pkg.id)}>
                  <td className="mono" data-label="Tracking">
                    {pkg.trackingNumber}
                  </td>
                  <td data-label="Stop">{pkg.stopNumber}</td>
                  <td data-label="Address">{pkg.deliveryAddress}</td>
                  <td data-label="Size">{formatLabel(pkg.size)}</td>
                  <td data-label="Weight">{formatWeight(pkg.weight)}</td>
                  <td data-label="Fragile">{pkg.fragile ? "Yes" : "No"}</td>
                  <td data-label="Zone">{pkg.zone ?? "—"}</td>
                  <td data-label="Shelf">{pkg.shelf ? formatLabel(pkg.shelf) : "—"}</td>
                  <td data-label="Slot">{pkg.slot ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function publishNote(publish: string) {
  if (publish === "sent") return "Locations were sent to the warehouse service.";
  if (publish === "failed") return "Locations stayed on this device. The warehouse service did not accept them.";
  return "Saved on this device.";
}

function countLabel(count: number) {
  return `${count} package${count === 1 ? "" : "s"} scanned`;
}

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
