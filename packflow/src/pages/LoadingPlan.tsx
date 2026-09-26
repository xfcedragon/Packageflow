import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { StatusBadge } from "../components/StatusBadge";
import { VanView } from "../components/VanView";
import { formatLabel, formatWeight } from "../delivery";
import { HEAVY_LBS } from "../loading";
import { usePackages } from "../package-context";
import type { Package } from "../types";

export function LoadingPlan() {
  const { packages, planGenerated, generatePlan, selectPackage } = usePackages();
  const navigate = useNavigate();
  const [revision, setRevision] = useState(0);
  const [fresh, setFresh] = useState(false);
  const placed = packages.filter((pkg) => pkg.zone).length;
  const zoneCounts = (["A", "B", "C", "D"] as const).map((zone) => ({
    zone,
    count: packages.filter((pkg) => pkg.zone === zone).length,
  }));

  useEffect(() => {
    if (!fresh) return;
    const timer = window.setTimeout(() => setFresh(false), 1600);
    return () => window.clearTimeout(timer);
  }, [fresh]);

  function onGenerate() {
    generatePlan();
    setRevision((current) => current + 1);
    setFresh(true);
  }

  const rows = [...packages].sort(
    (a, b) => a.stopNumber - b.stopNumber || a.trackingNumber.localeCompare(b.trackingNumber),
  );

  return (
    <div className="page" data-page="loading-plan">
      <header className="page-head">
        <div>
          <p className="eyebrow">Loading plan</p>
          <h1>Place every package before rollout</h1>
          <p className="lede">
            {planGenerated
              ? `${placed} packages placed. Load zone D first, then C, B, and A so early stops stay by the door.`
              : "Generate the plan to assign a zone, shelf, and slot to each package."}
          </p>
        </div>
        <button type="button" className="btn" onClick={onGenerate}>
          {planGenerated ? "Regenerate plan" : "Generate loading plan"}
        </button>
      </header>

      {revision > 0 ? (
        <p className={fresh ? "plan-banner is-fresh" : "plan-banner"} role="status">
          Loading plan {revision === 1 ? "generated" : `updated (run ${revision})`}. {placed} packages
          placed
          {zoneCounts.map((item) => ` · ${item.zone} ${item.count}`).join("")}. Each package has its own
          shelf and slot.
        </p>
      ) : null}

      <ul className="rule-list">
        <li>Stops 1–5 zone A, 6–10 B, 11–15 C, 16+ D</li>
        <li>{HEAVY_LBS} lb and over go on the lower shelf</li>
        <li>Fragile packages go on the upper shelf, never under a heavy one</li>
        <li>Packages for the same stop share neighboring slots</li>
      </ul>

      <section className="card">
        <div className="section-head">
          <div>
            <h2>Van layout</h2>
            <p className="muted">
              Numbers in each cell are delivery stops. Select a cell to open that package.
            </p>
          </div>
        </div>
        <VanView packages={packages} />
      </section>

      <section className="card">
        <div className="section-head">
          <div>
            <h2>All packages</h2>
            <p className="muted">{rows.length} packages across 20 stops</p>
          </div>
        </div>
        <div className="table-wrap">
          <table className={fresh ? "plan-table is-fresh" : "plan-table"}>
            <thead>
              <tr>
                <th>Stop</th>
                <th>Tracking number</th>
                <th>Recipient</th>
                <th>Delivery address</th>
                <th>Size</th>
                <th>Weight</th>
                <th>Fragile</th>
                <th>Zone</th>
                <th>Shelf</th>
                <th>Slot</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((pkg) => (
                <tr
                  key={pkg.id}
                  onClick={() => {
                    selectPackage(pkg.id);
                    navigate(`/locator?q=${encodeURIComponent(pkg.trackingNumber)}`);
                  }}
                >
                  <td data-label="Stop">{pkg.stopNumber}</td>
                  <td className="mono" data-label="Tracking">
                    {pkg.trackingNumber}
                  </td>
                  <td data-label="Recipient">{pkg.recipient}</td>
                  <td data-label="Address">{pkg.deliveryAddress}</td>
                  <td data-label="Size">{formatLabel(pkg.size)}</td>
                  <td data-label="Weight">{formatWeight(pkg.weight)}</td>
                  <td data-label="Fragile">{pkg.fragile ? "Yes" : "No"}</td>
                  <td data-label="Zone">{zoneCell(pkg)}</td>
                  <td data-label="Shelf">{pkg.shelf ? formatLabel(pkg.shelf) : "—"}</td>
                  <td data-label="Slot">{pkg.slot ?? "—"}</td>
                  <td data-label="Status">
                    <StatusBadge status={pkg.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function zoneCell(pkg: Package) {
  if (!pkg.zone) return "—";
  return <span className={`zone-pill zone-${pkg.zone}`}>{pkg.zone}</span>;
}
