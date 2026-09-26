import { Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { TrackingBarcode } from "../components/TrackingBarcode";
import { usePackages } from "../package-context";

export function PackageLabels() {
  const { packages } = usePackages();
  const [printId, setPrintId] = useState<string | null>(null);
  const rows = [...packages].sort(
    (a, b) => a.stopNumber - b.stopNumber || a.trackingNumber.localeCompare(b.trackingNumber),
  );

  useEffect(() => {
    const clear = () => setPrintId(null);
    window.addEventListener("afterprint", clear);
    return () => window.removeEventListener("afterprint", clear);
  }, []);

  function printLabels(id: string | null) {
    setPrintId(id);
    window.setTimeout(() => window.print(), 40);
  }

  return (
    <div className="page" data-page="labels">
      <header className="page-head no-print">
        <div>
          <p className="eyebrow">Package labels</p>
          <h1>Package Labels</h1>
          <p className="lede">
            CODE128 barcodes for the {rows.length} packages on this van. The barcode is the tracking number.
          </p>
        </div>
        <button type="button" className="btn" onClick={() => printLabels(null)}>
          <Printer size={16} aria-hidden="true" />
          Print Labels
        </button>
      </header>

      <div className="label-sheet">
        {rows.map((pkg) => (
          <article
            key={pkg.id}
            className={printId && printId !== pkg.id ? "label is-hidden-print" : "label"}
            data-tracking={pkg.trackingNumber}
          >
            <div className="label-top">
              <strong>PACKFLOW</strong>
              <button
                type="button"
                className="btn secondary no-print"
                onClick={() => printLabels(pkg.id)}
              >
                Print
              </button>
            </div>
            <TrackingBarcode value={pkg.trackingNumber} />
            <p className="mono label-code">{pkg.trackingNumber}</p>
            <p className="label-stop">STOP {pkg.stopNumber}</p>
            <p className="label-address">{pkg.deliveryAddress}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
