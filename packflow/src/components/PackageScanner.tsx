import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import { ScanBarcode, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cameraMessage, interpretScan } from "../scan";
import type { Package } from "../types";

const REGION_ID = "packflow-scanner";

let cameraQueue: Promise<void> = Promise.resolve();

function enqueueCamera(task: () => Promise<void>) {
  const run = cameraQueue.then(task, task);
  cameraQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

const FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.CODABAR,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.PDF_417,
];

type PackageScannerProps = {
  packages: Package[];
  onClose: () => void;
  onFound: (pkg: Package) => void;
  resolveMissing?: (code: string) => Promise<Package | null>;
};

export function PackageScanner({ packages, onClose, onFound, resolveMissing }: PackageScannerProps) {
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const packagesRef = useRef(packages);
  const onFoundRef = useRef(onFound);
  const onCloseRef = useRef(onClose);
  const resolveRef = useRef(resolveMissing);

  useEffect(() => {
    packagesRef.current = packages;
    onFoundRef.current = onFound;
    onCloseRef.current = onClose;
    resolveRef.current = resolveMissing;
  });

  useEffect(() => {
    if (notFound) return;
    let cancelled = false;
    let settled = false;
    const holder: { scanner: Html5Qrcode | null } = { scanner: null };

    const finish = async (decoded: string) => {
      if (settled) return;
      settled = true;
      cancelled = true;
      const result = interpretScan(packagesRef.current, decoded);
      await enqueueCamera(async () => {
        if (holder.scanner) await release(holder.scanner);
      });
      if (result.status === "found") {
        onFoundRef.current(result.pkg);
        onCloseRef.current();
        return;
      }
      if (result.status === "not-found") {
        try {
          const resolved = resolveRef.current ? await resolveRef.current(result.code) : null;
          if (resolved) {
            onFoundRef.current(resolved);
            onCloseRef.current();
            return;
          }
        } catch {
          // The local list already missed, so show the not-found state.
        }
        setNotFound(result.code);
        return;
      }
      setCameraError("That barcode could not be read. It may be an unsupported format.");
    };

    const onSimulate = (event: Event) => {
      const text = (event as CustomEvent<string>).detail;
      if (typeof text === "string") void finish(text);
    };
    window.addEventListener("packflow-scan", onSimulate);

    enqueueCamera(async () => {
      const scanner = new Html5Qrcode(REGION_ID, {
        verbose: false,
        formatsToSupport: FORMATS,
      });
      holder.scanner = scanner;
      if (cancelled) {
        await release(scanner);
        return;
      }
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (cancelled) {
          await release(scanner);
          return;
        }
        if (cameras.length === 0) {
          setCameraError("No camera is available on this device.");
          return;
        }
        await startCamera(scanner, (text) => {
          void finish(text);
        });
        if (cancelled) await release(scanner);
      } catch (error) {
        if (!cancelled) setCameraError(cameraMessage(error));
        await release(scanner);
      }
    });

    return () => {
      cancelled = true;
      window.removeEventListener("packflow-scan", onSimulate);
      enqueueCamera(async () => {
        if (holder.scanner) await release(holder.scanner);
      });
    };
  }, [attempt, notFound]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="scanner-backdrop" role="presentation" onClick={onClose}>
      <div
        className="scanner-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="scan-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="scanner-head">
          <ScanBarcode size={18} aria-hidden="true" />
          <h2 id="scan-title">SCAN PACKAGE</h2>
        </div>

        {notFound ? (
          <div className="scanner-message" role="status">
            <strong>Package not found</strong>
            <p>
              Scanned <span className="mono">{notFound}</span>
            </p>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setNotFound(null);
                setCameraError(null);
                setAttempt((current) => current + 1);
              }}
            >
              Scan Again
            </button>
          </div>
        ) : (
          <>
            <div id={REGION_ID} className="scanner-frame" />
            <p className="scanner-hint">Position barcode inside frame</p>
            {cameraError ? (
              <div className="scanner-message" role="alert">
                <p>{cameraError}</p>
                <button
                  type="button"
                  className="btn secondary"
                  onClick={() => {
                    setCameraError(null);
                    setAttempt((current) => current + 1);
                  }}
                >
                  Scan Again
                </button>
              </div>
            ) : null}
          </>
        )}

        <button type="button" className="btn scanner-close" onClick={onClose} autoFocus>
          <X size={16} aria-hidden="true" />
          Close Scanner
        </button>
      </div>
    </div>
  );
}

function scanConfig() {
  const narrow = window.matchMedia("(max-width: 720px)").matches;
  if (!narrow) return { fps: 8, qrbox: { width: 240, height: 120 }, aspectRatio: 1.777 };
  return {
    fps: 8,
    aspectRatio: 1,
    qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
      const width = Math.max(160, Math.floor(Math.min(viewfinderWidth * 0.86, 320)));
      const height = Math.max(90, Math.floor(Math.min(viewfinderHeight * 0.42, 180)));
      return { width, height };
    },
  };
}

async function startCamera(scanner: Html5Qrcode, onDecode: (text: string) => void) {
  const config = scanConfig();
  const ignore = () => {};
  try {
    await scanner.start({ facingMode: "environment" }, config, onDecode, ignore);
  } catch (error) {
    if (isPermissionError(error) || scanner.isScanning) throw error;
    await scanner.start({ facingMode: "user" }, config, onDecode, ignore);
  }
}

function isPermissionError(error: unknown) {
  const text = (error instanceof Error ? `${error.name} ${error.message}` : String(error)).toLowerCase();
  return text.includes("notallowed") || text.includes("permission") || text.includes("denied");
}

async function release(scanner: Html5Qrcode) {
  try {
    if (scanner.isScanning) await scanner.stop();
  } catch {
    // The camera is already stopped.
  }
  const region = document.getElementById(REGION_ID);
  region?.querySelectorAll("video").forEach((node) => {
    const video = node as HTMLVideoElement;
    const stream = video.srcObject;
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
    }
  });
  try {
    scanner.clear();
  } catch {
    // The preview element is already empty.
  }
}
