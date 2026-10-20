import { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { isEan13, normalizeBarcode } from "../../../shared/variants";

/**
 * Alat scan barcode USB/Bluetooth bekerja seperti keyboard: mengetik angka sangat cepat lalu Enter.
 * Hook ini menangkap ketikan secepat itu di mana saja di halaman (kecuali sedang mengetik di kolom isian),
 * sehingga kasir tidak perlu mengarahkan kursor ke kolom cari dulu.
 */
export function useScannerInput(onScan: (code: string) => void, enabled = true) {
  const cb = useRef(onScan);
  cb.current = onScan;
  useEffect(() => {
    if (!enabled) return;
    let buf = "";
    let last = 0;
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const now = performance.now();
      // Jeda lebih dari 60 ms antar tombol = diketik manusia, mulai ulang.
      if (now - last > 60) buf = "";
      last = now;
      if (e.key === "Enter") {
        if (buf.length >= 4) {
          e.preventDefault();
          cb.current(normalizeBarcode(buf));
        }
        buf = "";
      } else if (e.key.length === 1) {
        buf += e.key;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);
}

type Detector = { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> };
type DetectorCtor = new (o?: { formats?: string[] }) => Detector;

function beep() {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 1400;
    g.gain.value = 0.08;
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + 0.08);
    o.onended = () => ctx.close();
  } catch {
    /* tanpa suara */
  }
  navigator.vibrate?.(40);
}

/**
 * Scan barcode dengan kamera HP. Memakai BarcodeDetector bawaan browser kalau ada (Chrome Android),
 * selain itu ZXing yang dimuat hanya saat dibutuhkan (Safari/iPhone, browser komputer).
 * `continuous`: tetap terbuka untuk scan berikutnya (kasir), atau tutup setelah satu hasil (isi kolom barcode).
 */
export function CameraScanner({ open, onClose, onScan, continuous = false, title = "Scan barcode" }: { open: boolean; onClose: () => void; onScan: (code: string) => void; continuous?: boolean; title?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const cb = useRef(onScan);
  cb.current = onScan;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open) return;
    setError(null);
    setLast(null);
    let stop = false;
    let stream: MediaStream | null = null;
    let zxingStop: (() => void) | null = null;
    let lastCode = "";
    let lastAt = 0;
    const hit = (raw: string) => {
      const code = normalizeBarcode(raw);
      const now = Date.now();
      // Kode yang sama dalam 1,5 detik dianggap satu scan (kamera membaca berkali-kali per detik).
      if (code === lastCode && now - lastAt < 1500) return;
      lastCode = code;
      lastAt = now;
      beep();
      setLast(code);
      cb.current(code);
      if (!continuous) closeRef.current();
    };
    (async () => {
      try {
        const Native = (window as unknown as { BarcodeDetector?: DetectorCtor & { getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector;
        const formats = Native?.getSupportedFormats ? await Native.getSupportedFormats() : [];
        if (Native && formats.includes("ean_13")) {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
          if (stop || !video.current) return;
          video.current.srcObject = stream;
          await video.current.play();
          const det = new Native({ formats: formats.filter((f) => /ean|upc|code_128|code_39|qr/.test(f)) });
          const loop = async () => {
            if (stop || !video.current) return;
            try {
              const r = await det.detect(video.current);
              if (r[0]?.rawValue) hit(r[0].rawValue);
            } catch {
              /* bingkai belum siap */
            }
            window.setTimeout(loop, 180);
          };
          loop();
        } else {
          const { BrowserMultiFormatReader } = await import("@zxing/browser");
          if (stop || !video.current) return;
          const reader = new BrowserMultiFormatReader();
          const ctl = await reader.decodeFromConstraints({ video: { facingMode: "environment" }, audio: false }, video.current, (res) => {
            if (res) hit(res.getText());
          });
          zxingStop = () => ctl.stop();
          if (stop) ctl.stop();
        }
      } catch (e) {
        const name = (e as Error).name;
        setError(
          name === "NotAllowedError"
            ? "Izin kamera ditolak. Izinkan kamera untuk situs ini di pengaturan browser, lalu coba lagi."
            : name === "NotFoundError"
              ? "Kamera tidak ditemukan di perangkat ini. Pakai alat scan atau ketik kodenya."
              : "Kamera tidak bisa dibuka. Pastikan halaman dibuka lewat https dan kamera tidak dipakai aplikasi lain.",
        );
      }
    })();
    return () => {
      stop = true;
      zxingStop?.();
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [open, continuous]);
  if (!open) return null;
  return (
    <div className="scan" role="dialog" aria-modal="true" aria-label={title}>
      <div className="scan-top">
        <span><Camera aria-hidden="true" /> {title}</span>
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup kamera"><X /></button>
      </div>
      <div className="scan-view">
        <video ref={video} muted playsInline aria-hidden="true" />
        <span className="scan-frame" aria-hidden="true" />
      </div>
      <p className="scan-msg" aria-live="polite">
        {error ?? (last ? `Terbaca: ${last}${continuous ? ". Arahkan ke barang berikutnya." : ""}` : "Arahkan kamera ke barcode. Jaga jarak sekitar 15 cm.")}
      </p>
    </div>
  );
}

/** Gambar barcode (SVG) untuk label. EAN-13 kalau kodenya EAN-13 sah, selain itu Code 128. */
export function BarcodeSvg({ code, height = 44, width = 1.6, fontSize = 12 }: { code: string; height?: number; width?: number; fontSize?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [bad, setBad] = useState(false);
  useEffect(() => {
    let live = true;
    import("jsbarcode").then(({ default: JsBarcode }) => {
      if (!live || !ref.current) return;
      try {
        JsBarcode(ref.current, code, { format: isEan13(code) ? "EAN13" : "CODE128", height, width, fontSize, margin: 0, background: "transparent" });
        setBad(false);
      } catch {
        setBad(true);
      }
    });
    return () => {
      live = false;
    };
  }, [code, height, width, fontSize]);
  return bad ? <span className="tiny muted">Kode tidak bisa digambar</span> : <svg ref={ref} role="img" aria-label={`Barcode ${code}`} />;
}
