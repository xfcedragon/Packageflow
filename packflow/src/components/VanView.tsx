import { DoorOpen, MapPin, Package as PackageIcon, UserRound } from "lucide-react";
import { useEffect, useRef, type CSSProperties } from "react";
import { formatLabel, locationLabel } from "../delivery";
import { ZONE_META } from "../loading";
import { usePackages } from "../package-context";
import type { Package, Shelf, VanZone } from "../types";

const shelves: { id: Shelf; label: string }[] = [
  { id: "upper", label: "Upper" },
  { id: "middle", label: "Middle" },
  { id: "lower", label: "Lower" },
];

type VanViewProps = {
  packages: Package[];
  highlightId?: string | null;
};

export function VanView({ packages, highlightId = null }: VanViewProps) {
  const { selectedId, selectPackage } = usePackages();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeId = selectedId ?? highlightId;
  const active = packages.find((pkg) => pkg.id === activeId) ?? null;
  const placed = packages.some((pkg) => pkg.zone);

  const byCell = new Map<string, Package>();
  for (const pkg of packages) {
    if (!pkg.zone || !pkg.shelf || pkg.slot == null) continue;
    byCell.set(`${pkg.zone}-${pkg.shelf}-${pkg.slot}`, pkg);
  }

  useEffect(() => {
    if (!activeId || !scrollerRef.current) return;
    const box = scrollerRef.current.querySelector(".pkg.is-selected");
    box?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [activeId]);

  return (
    <div className="van-wrap">
      <div className="van-body">
        <div className="rear-door">
          <DoorOpen size={18} aria-hidden="true" />
          <strong>Rear doors</strong>
          <span>Zone A is here</span>
        </div>

        <div className="cargo-scroll" ref={scrollerRef}>
          <div className="cargo-floor" aria-label="Top-down view of the van cargo area">
            <div className="shelf-col" aria-hidden="true">
              <span />
              {shelves.map((shelf) => (
                <span key={shelf.id}>{shelf.label}</span>
              ))}
            </div>
            {ZONE_META.map((zone) => (
              <ZoneBand
                key={zone.id}
                zoneId={zone.id}
                title={zone.title}
                stops={zone.stops}
                hint={zone.hint}
                packages={packages}
                byCell={byCell}
                activeId={active?.id ?? null}
                onSelect={selectPackage}
              />
            ))}
          </div>
        </div>

        <div className="cab" aria-label="Driver cab, empty">
          <UserRound size={18} aria-hidden="true" />
          <strong>Cab</strong>
          <span>Driver sits here</span>
        </div>
      </div>

      <p className="van-caption">
        Top-down cargo view. Rear doors open onto Zone A. The cab sits past Zone D and stays empty.
        Zone D stays in the cargo bay, against the bulkhead, and does not enter the cab.
      </p>

      {active ? (
        <div className="van-selected" aria-live="polite">
          <PackageIcon size={16} aria-hidden="true" />
          <div>
            <span>Selected package</span>
            <strong className="mono">{active.trackingNumber}</strong>
            <p>
              <MapPin size={14} aria-hidden="true" />
              {active.deliveryAddress}
            </p>
            <p>
              Stop {active.stopNumber}
              {placed && active.zone
                ? ` · ${locationLabel(active)}`
                : " · Not loaded yet"}
              {active.fragile ? " · Fragile" : ""}
              {` · ${formatLabel(active.size)}`}
            </p>
          </div>
        </div>
      ) : (
        <p className="van-caption">Select a package in the cargo bay to see where it sits.</p>
      )}
    </div>
  );
}

function ZoneBand({
  zoneId,
  title,
  stops,
  hint,
  packages,
  byCell,
  activeId,
  onSelect,
}: {
  zoneId: VanZone;
  title: string;
  stops: string;
  hint: string;
  packages: Package[];
  byCell: Map<string, Package>;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  const slotCount = Math.max(
    3,
    ...packages.filter((pkg) => pkg.zone === zoneId).map((pkg) => pkg.slot ?? 0),
  );
  const hot = packages.some((pkg) => pkg.id === activeId && pkg.zone === zoneId);

  return (
    <section
      className={hot ? `zone zone-${zoneId} is-hot` : `zone zone-${zoneId}`}
      data-zone={zoneId}
      style={{ "--slots": slotCount } as CSSProperties}
    >
      <header className="zone-head">
        <strong>{title}</strong>
        <span>
          {stops}
          <em>{hint}</em>
        </span>
      </header>
      {shelves.map((shelf) => (
        <div key={shelf.id} className="shelf-row" aria-label={`${title} ${shelf.label} shelf`}>
          <span className="shelf-name">{shelf.label}</span>
          {Array.from({ length: slotCount }, (_, index) => {
            const slot = index + 1;
            const pkg = byCell.get(`${zoneId}-${shelf.id}-${slot}`);
            if (!pkg) {
              return <div key={slot} className="slot-empty" aria-hidden="true" />;
            }
            const selected = pkg.id === activeId;
            return (
              <button
                key={slot}
                type="button"
                className={selected ? "pkg is-selected" : "pkg"}
                data-zone={zoneId}
                data-package={pkg.id}
                onClick={() => onSelect(pkg.id)}
                aria-pressed={selected}
                aria-label={`Stop ${pkg.stopNumber}, ${pkg.trackingNumber}, zone ${zoneId}, ${shelf.label} shelf, slot ${slot}`}
              >
                <PackageIcon size={12} aria-hidden="true" />
                <strong>{pkg.trackingNumber.slice(-4)}</strong>
                <em>Stop {pkg.stopNumber}</em>
              </button>
            );
          })}
        </div>
      ))}
    </section>
  );
}
