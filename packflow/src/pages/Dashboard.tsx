import { Box, CircleCheck, MapPin, Package, Truck } from "lucide-react";
import { Link } from "react-router-dom";
import { StatCard } from "../components/StatCard";
import { VanView } from "../components/VanView";
import { formatWeight, locationLabel, nextPending } from "../delivery";
import { usePackages } from "../package-context";

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
    const current = upcoming.get(pkg.stopNumber);
    if (current) current.count += 1;
    else upcoming.set(pkg.stopNumber, { address: pkg.deliveryAddress, count: 1 });
  }
  const upcomingStops = [...upcoming.entries()].sort((a, b) => a[0] - b[0]).slice(0, 6);

  return (
    <div className="page" data-page="dashboard">
      <header className="page-head">
        <div>
          <p className="eyebrow">Driver dashboard</p>
          <h1>Where is the next package?</h1>
          <p className="lede">Amritansh Singh · Fredericton Delivery Route · Van 14</p>
        </div>
        {!planGenerated ? (
          <Link className="btn" to="/loading-plan">
            Open loading plan
          </Link>
        ) : null}
      </header>

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

      <section className="stats" aria-live="polite">
        <StatCard
          label="Total packages"
          value={total}
          hint="Loaded for this route"
          icon={<Package size={18} />}
          tone="teal"
        />
        <StatCard
          label="Delivered"
          value={delivered}
          hint={delivered === 0 ? "None handed off yet" : "Marked at the door"}
          icon={<CircleCheck size={18} />}
          tone="green"
        />
        <StatCard
          label="Remaining"
          value={remaining}
          hint={remaining === 0 ? "Van is clear" : "Still in the cargo bay"}
          icon={<Box size={18} />}
          tone="amber"
        />
        <StatCard
          label="Progress"
          value={`${progress}%`}
          hint={`${delivered} of ${total} packages`}
          icon={<Truck size={18} />}
          tone="blue"
        />
      </section>

      <section className="card progress-card">
        <div className="progress-copy">
          <strong>Delivery progress</strong>
          <span>
            {remaining === 0
              ? "Every package on this route is delivered."
              : `${remaining} package${remaining === 1 ? "" : "s"} left on the van.`}
          </span>
        </div>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Delivery progress"
        >
          <span style={{ width: `${progress}%` }} />
        </div>
      </section>

      <div className="split">
        <article className="card next-card">
          {next ? (
            <>
              <p className="eyebrow">Next delivery</p>
              <div className="next-top">
                <div className="stop-badge">
                  <span>Stop</span>
                  <strong>{next.stopNumber}</strong>
                </div>
                <div>
                  <h2>{next.recipient}</h2>
                  <p className="address">
                    <MapPin size={16} aria-hidden="true" />
                    {next.deliveryAddress}
                  </p>
                </div>
              </div>
              <dl className="facts">
                <div>
                  <dt>Tracking</dt>
                  <dd className="mono">{next.trackingNumber}</dd>
                </div>
                <div>
                  <dt>Package</dt>
                  <dd>
                    {next.size} · {formatWeight(next.weight)}
                    {next.fragile ? " · Fragile" : ""}
                  </dd>
                </div>
                <div>
                  <dt>At this stop</dt>
                  <dd>
                    {nextStopCount} package{nextStopCount === 1 ? "" : "s"}
                  </dd>
                </div>
              </dl>
              <div className="location-callout">
                <span>Van location</span>
                <strong>{planGenerated ? locationLabel(next) : "Not placed yet"}</strong>
              </div>
              <div className="button-row">
                <button
                  type="button"
                  className="btn"
                  onClick={() => markDelivered(next.id)}
                >
                  Mark delivered
                </button>
                <Link
                  className="btn secondary"
                  to={`/locator?q=${encodeURIComponent(next.trackingNumber)}`}
                >
                  Find in locator
                </Link>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <CircleCheck size={28} aria-hidden="true" />
              <h2>Route complete</h2>
              <p>All 30 packages are marked delivered. The van is clear.</p>
            </div>
          )}
        </article>

        <article className="card">
          <h2>Coming up</h2>
          {upcomingStops.length === 0 ? (
            <p className="muted">No stops left on this route.</p>
          ) : (
            <ol className="stop-list">
              {upcomingStops.map(([stopNumber, stop]) => (
                <li key={stopNumber}>
                  <span className="stop-num">{stopNumber}</span>
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
        </article>
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
