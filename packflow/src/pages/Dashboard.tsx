import { Box, CircleCheck, ExternalLink, Hash, MapPin, MapPinned, Route, Weight } from "lucide-react";
import { Link } from "react-router-dom";
import { VanView } from "../components/VanView";
import { buildFullRouteUrl, formatLabel, formatWeight, locationLabel, nextPending } from "../delivery";
import { usePackages } from "../package-context";
import type { Package } from "../types";

export function Dashboard() {
  const { packages, planGenerated, markDelivered, selectedId, demoActive } = usePackages();
  const total = packages.length;
  const delivered = packages.filter((pkg) => pkg.status === "delivered").length;
  const remaining = total - delivered;
  const progress = total === 0 ? 0 : Math.round((delivered / total) * 100);
  const next = nextPending(packages);
  const nextStopCount = next
    ? packages.filter(
        (pkg) => pkg.stopNumber === next.stopNumber && pkg.status !== "delivered",
      ).length
    : 0;

  const upcoming = new Map<number, { address: string; count: number }>();
  for (const pkg of packages) {
    if (pkg.status === "delivered") continue;
    if (next && pkg.stopNumber <= next.stopNumber) continue;
    const current = upcoming.get(pkg.stopNumber);
    if (current) current.count += 1;
    else upcoming.set(pkg.stopNumber, { address: pkg.deliveryAddress, count: 1 });
  }
  const upcomingStops = [...upcoming.entries()].sort((a, b) => a[0] - b[0]);
  const fullRouteUrl = buildFullRouteUrl(packages);

  return (
    <div className="page dash-page" data-page="dashboard">
      <section className="dash-status" aria-live="polite">
        <div className="dash-status-copy">
          <p>
            <strong>
              {delivered} of {total} delivered
            </strong>
            <span>Fredericton Delivery Route · Van 14</span>
          </p>
          <div
            className="dash-progress"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Delivery progress"
          >
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
        <p className="dash-remaining">
          <strong>{remaining}</strong>
          <span>Remaining</span>
        </p>
        <div className="dash-status-actions">
          {fullRouteUrl ? (
            <a
              className="dash-btn dash-btn-route"
              href={fullRouteUrl}
              target="_blank"
              rel="noreferrer"
              title="Open full delivery route on Google Maps"
            >
              <Route size={18} aria-hidden="true" />
              Full Route
            </a>
          ) : null}
          {!planGenerated ? (
            <Link className="dash-btn dash-btn-ghost" to="/loading-plan">
              Open loading plan
            </Link>
          ) : null}
        </div>
      </section>

      {demoActive && next ? (
        <div className="demo-banner" role="status">
          <p>
            Mid-route demo. {delivered} packages are already delivered. Next is stop{" "}
            {next.stopNumber}, {locationLabel(next)}.
          </p>
          <Link className="btn secondary" to={`/locator?q=${encodeURIComponent(next.trackingNumber)}`}>
            Open in locator
          </Link>
        </div>
      ) : null}

      <div className="dash-board">
        <article className="dash-hero">
          {next ? (
            <>
              <p className="eyebrow">Current delivery · Stop {next.stopNumber}</p>
              <p className="dash-recipient">{next.recipient}</p>
              <h1 className="dash-address">{next.deliveryAddress}</h1>
              <ul className="dash-meta">
                <li>
                  <Hash size={18} aria-hidden="true" />
                  <span>
                    Tracking <strong className="mono">{next.trackingNumber}</strong>
                  </span>
                </li>
                <li>
                  <Weight size={18} aria-hidden="true" />
                  <span>
                    Weight <strong>{formatWeight(next.weight)}</strong>
                  </span>
                </li>
                <li>
                  <Box size={18} aria-hidden="true" />
                  <span>
                    Size <strong>{formatLabel(next.size)}</strong>
                    {next.fragile ? " · Fragile" : ""}
                  </span>
                </li>
              </ul>
              {nextStopCount > 1 ? (
                <p className="dash-stop-note">
                  {nextStopCount} packages at this stop
                </p>
              ) : null}
              <div className="dash-loc">
                <span>Van location</span>
                <strong>{vanBadge(next, planGenerated)}</strong>
              </div>
              <div className="dash-actions">
                <button
                  type="button"
                  className="dash-btn dash-btn-done"
                  onClick={() => markDelivered(next.id)}
                >
                  Mark Delivered
                </button>
                <a
                  className="dash-btn dash-btn-nav"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(next.deliveryAddress)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MapPin size={18} aria-hidden="true" />
                  Navigate
                </a>
                <Link
                  className="dash-btn dash-btn-ghost"
                  to={`/locator?q=${encodeURIComponent(next.trackingNumber)}`}
                >
                  Find in Locator
                </Link>
              </div>
            </>
          ) : total === 0 ? (
            <div className="empty-state">
              <CircleCheck size={28} aria-hidden="true" />
              <h1>No packages loaded</h1>
              <p>Run the Supabase seed, or switch to the local Fredericton demo.</p>
            </div>
          ) : (
            <div className="empty-state">
              <CircleCheck size={28} aria-hidden="true" />
              <h1>Route complete</h1>
              <p>All {total} packages are marked delivered. The van is clear.</p>
            </div>
          )}
        </article>

        <aside className="dash-queue" aria-label="Upcoming queue">
          <div className="dash-queue-head">
            <h2>Upcoming</h2>
            {fullRouteUrl ? (
              <a
                className="dash-queue-map-link"
                href={fullRouteUrl}
                target="_blank"
                rel="noreferrer"
                title="Open all pending stops in Google Maps"
              >
                <MapPinned size={14} aria-hidden="true" />
                Map route
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            ) : null}
          </div>
          {upcomingStops.length === 0 ? (
            <p className="muted">No stops left after this one.</p>
          ) : (
            <ol className="dash-queue-list">
              {upcomingStops.map(([stopNumber, stop]) => (
                <li key={stopNumber} className="dash-stop">
                  <span className="dash-stop-num">{stopNumber}</span>
                  <span>
                    <strong>{stop.address.split(",")[0]}</strong>
                    <em>
                      {stop.count} package{stop.count === 1 ? "" : "s"}
                    </em>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2>Cargo bay</h2>
            <p className="muted">
              {selectedId
                ? "The selected package is highlighted in the cargo bay."
                : next && planGenerated
                  ? `Stop ${next.stopNumber} is highlighted until you select a package.`
                  : next
                    ? "Generate a loading plan to place this stop in the van."
                    : "Delivered packages stay faded in their slots."}
            </p>
          </div>
        </div>
        <VanView packages={packages} highlightId={next?.id ?? null} />
      </section>
    </div>
  );
}

function vanBadge(pkg: Package, planGenerated: boolean) {
  if (pkg.zone && pkg.shelf && pkg.slot != null) {
    return `Zone ${pkg.zone} • ${formatLabel(pkg.shelf)} • Slot ${pkg.slot}`;
  }
  return planGenerated ? "Not loaded yet" : "Not placed yet";
}
