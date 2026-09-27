import { BarChart3, CircleCheck, Package, RefreshCw, ScanBarcode } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { StatCard } from "../components/StatCard";

type TypeCount = { event_type: string; count: number };

type RecentEvent = {
  event_id: string | null;
  event_type: string | null;
  tracking_number: string | null;
  stop_number: number | null;
  zone: string | null;
  shelf: string | null;
  slot: number | null;
  payload: string | null;
  event_timestamp: string | null;
};

type AnalyticsPayload = {
  configured: boolean;
  message?: string;
  totals?: {
    events: number;
    packages_seen: number;
    packages_scanned: number;
    packages_assigned: number;
    packages_retrieved: number;
    packages_delivered: number;
    delivery_progress: number;
  };
  by_type?: TypeCount[];
  recent?: RecentEvent[];
};

const labels: Record<string, string> = {
  package_scanned: "Scanned",
  loading_plan_generated: "Plans generated",
  package_assigned: "Assigned to a slot",
  package_retrieved: "Retrieved in the van",
  package_delivered: "Delivered",
};

export function RouteAnalytics() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/analytics");
      const text = await response.text();
      const payload = parsePayload(text);
      if (!payload) {
        setData(null);
        setError("The analytics API is not available from this session.");
        return;
      }
      if (!response.ok) {
        setData(null);
        setError(payload.message ?? "Snowflake did not return analytics.");
        return;
      }
      setData(payload);
    } catch {
      setData(null);
      setError("The analytics API is not available from this session.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const report = data?.configured && data.totals ? data : null;

  return (
    <div className="page" data-page="analytics">
      <header className="page-head">
        <div>
          <p className="eyebrow">Snowflake events</p>
          <h1>Route Analytics</h1>
          <p className="lede">
            Counts and history come from Snowflake. Packages, stops, and delivery status stay in Supabase.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={16} aria-hidden="true" />
          Refresh
        </button>
      </header>

      {loading && !data ? <p className="muted">Loading analytics…</p> : null}

      {error ? (
        <section className="card analytics-note">
          <h2>Analytics API unavailable</h2>
          <p>
            {error} Scan, plan, locate, and deliver still work. On Vercel, <span className="mono">/api/analytics</span>{" "}
            reads Snowflake after the server environment variables are set.
          </p>
        </section>
      ) : null}

      {data && !data.configured ? (
        <section className="card analytics-note">
          <h2>Snowflake is not configured</h2>
          <p>
            {data.message ??
              "The server is missing Snowflake environment variables. The rest of PackFlow keeps working."}
          </p>
        </section>
      ) : null}

      {report?.totals ? (
        <>
          <section className="stats" aria-label="Event totals">
            <StatCard
              label="Events"
              value={report.totals.events}
              hint="Rows in PACKFLOW_EVENTS"
              icon={<BarChart3 size={18} />}
              tone="teal"
            />
            <StatCard
              label="Packages seen"
              value={report.totals.packages_seen}
              hint="Distinct tracking numbers"
              icon={<Package size={18} />}
              tone="blue"
            />
            <StatCard
              label="Scanned"
              value={report.totals.packages_scanned}
              hint="Distinct package_scanned"
              icon={<ScanBarcode size={18} />}
              tone="amber"
            />
            <StatCard
              label="Delivered"
              value={report.totals.packages_delivered}
              hint="Distinct package_delivered"
              icon={<CircleCheck size={18} />}
              tone="green"
            />
          </section>

          <section className="card progress-card">
            <div className="progress-copy">
              <strong>Delivery progress from events</strong>
              <span>
                {report.totals.packages_delivered} of {report.totals.packages_seen} packages with a delivery event ·{" "}
                {report.totals.delivery_progress}%
              </span>
            </div>
            <div className="progress-track" aria-hidden="true">
              <span style={{ width: `${report.totals.delivery_progress}%` }} />
            </div>
          </section>

          <section className="card">
            <h2>By event type</h2>
            <ul className="analytics-types">
              {(report.by_type ?? []).map((row) => (
                <li key={row.event_type}>
                  <span>{labels[row.event_type] ?? row.event_type}</span>
                  <strong>{row.count}</strong>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h2>Recent events</h2>
            {(report.recent ?? []).length === 0 ? (
              <p className="muted">No events yet. Scan a package or generate a loading plan, then refresh.</p>
            ) : (
              <div className="table-wrap">
                <table className="plan-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Event</th>
                      <th>Tracking</th>
                      <th>Stop</th>
                      <th>Location</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(report.recent ?? []).map((event) => (
                      <tr key={event.event_id ?? `${event.event_type}-${event.event_timestamp}`}>
                        <td>{event.event_timestamp ?? "—"}</td>
                        <td>{labels[event.event_type ?? ""] ?? event.event_type}</td>
                        <td className="mono">{event.tracking_number ?? "—"}</td>
                        <td>{event.stop_number ?? "—"}</td>
                        <td>{locationOf(event)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function locationOf(event: RecentEvent) {
  if (!event.zone && !event.shelf && event.slot == null) return "—";
  return [event.zone, event.shelf, event.slot != null ? `slot ${event.slot}` : null].filter(Boolean).join(" · ");
}

function parsePayload(text: string): AnalyticsPayload | null {
  if (!text || text.trim().startsWith("<")) return null;
  try {
    const value = JSON.parse(text) as AnalyticsPayload & { error?: string };
    if (value && typeof value === "object" && typeof value.configured === "boolean") return value;
    if (value && typeof value.error === "string") return { configured: false, message: value.error };
    return null;
  } catch {
    return null;
  }
}
