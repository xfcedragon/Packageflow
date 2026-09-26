import JsBarcode from "jsbarcode";
import { useEffect, useRef } from "react";

export function TrackingBarcode({ value }: { value: string }) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    JsBarcode(ref.current, value, {
      format: "CODE128",
      displayValue: false,
      margin: 0,
      height: 64,
      width: 1.8,
      background: "#ffffff",
      lineColor: "#121826",
    });
  }, [value]);

  return <svg ref={ref} className="label-barcode" role="img" aria-label={`Code 128 ${value}`} />;
}
