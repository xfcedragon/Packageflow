import { BarChart3, Barcode, LayoutDashboard, MapPinned, PackageSearch, Play, ScanBarcode, Truck } from "lucide-react";
import { NavLink, useNavigate } from "react-router-dom";
import { usePackages } from "../package-context";

const links = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/scan", label: "Scan Packages", icon: ScanBarcode, end: false },
  { to: "/loading-plan", label: "Loading Plan", icon: Truck, end: false },
  { to: "/locator", label: "Package Locator", icon: PackageSearch, end: false },
  { to: "/labels", label: "Package Labels", icon: Barcode, end: false },
  { to: "/analytics", label: "Route Analytics", icon: BarChart3, end: false },
];

export function Sidebar() {
  const { packages, demoActive, startDemo, exitDemo, dataMode, supabaseReady, sourceDetail, setDataMode } =
    usePackages();
  const navigate = useNavigate();
  const remaining = packages.filter((pkg) => pkg.status !== "delivered").length;

  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark" aria-hidden="true">
          <Truck size={18} />
        </span>
        <div>
          <strong>PackFlow</strong>
          <span>Van 14 · Fredericton, NB</span>
        </div>
      </div>

      <nav className="side-nav" aria-label="Primary">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) =>
                isActive ? "nav-link active" : "nav-link"
              }
            >
              <Icon size={18} aria-hidden="true" />
              {link.label}
            </NavLink>
          );
        })}
      </nav>

      <div className="side-foot">
        <p className="route-chip">
          <MapPinned size={14} aria-hidden="true" />
          {remaining === 0 ? "Route complete" : `${remaining} still on the van`}
        </p>
        <div className="driver">
          <span className="avatar" aria-hidden="true">
            AS
          </span>
          <div>
            <strong>Amritansh Singh</strong>
            <span>Fredericton route</span>
          </div>
        </div>
      </div>

      <div className="demo-controls">
        {supabaseReady ? (
          <button
            type="button"
            className={dataMode === "supabase" ? "demo-btn is-on" : "demo-btn"}
            onClick={() => setDataMode(dataMode === "supabase" ? "local" : "supabase")}
          >
            {dataMode === "supabase" ? "Supabase" : "Local demo"}
          </button>
        ) : (
          <p className="data-note">Local demo</p>
        )}
        {sourceDetail ? <p className="data-note">{sourceDetail}</p> : null}
        <button
          type="button"
          className={demoActive ? "demo-btn is-on" : "demo-btn"}
          onClick={() => {
            startDemo();
            navigate("/");
          }}
        >
          <Play size={14} aria-hidden="true" />
          Demo Mode
        </button>
        {demoActive ? (
          <button
            type="button"
            className="demo-exit"
            onClick={() => {
              exitDemo();
              navigate("/");
            }}
          >
            Exit demo
          </button>
        ) : null}
      </div>
    </aside>
  );
}
