import QRCode from "qrcode";

/**
 * QR dengan logo pesan.in di tengah, sebagai tanda QR ini dari Pesan.in.
 * Koreksi galat level H (bisa pulih sampai ±30% modul rusak); logo + bingkai putih menutup ±7%,
 * jadi tetap terbaca kamera HP biasa.
 */
export async function brandedQr(text: string, size = 600): Promise<string> {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, text, { errorCorrectionLevel: "H", margin: 1, width: size, color: { dark: "#1e1b16", light: "#ffffff" } });
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/png");
  const w = canvas.width;
  const s = Math.round(w * 0.22);
  const pad = Math.round(s * 0.09);
  const x = Math.round((w - s) / 2);
  const round = (px: number, py: number, pw: number, r: number) => {
    ctx.beginPath();
    ctx.roundRect(px, py, pw, pw, r);
    ctx.fill();
  };
  ctx.fillStyle = "#ffffff";
  round(x - pad, x - pad, s + pad * 2, (s + pad * 2) * 0.24);
  // Ikon aplikasi (sama dengan web/public/icons/icon.svg, viewBox 512).
  ctx.save();
  ctx.translate(x, x);
  ctx.scale(s / 512, s / 512);
  ctx.fillStyle = "#1f6b4f";
  round(0, 0, 512, 112);
  ctx.strokeStyle = "#f7f4ee";
  ctx.lineWidth = 58;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(166, 176);
  ctx.lineTo(166, 408);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(252, 250, 86, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = "#e8a317";
  ctx.beginPath();
  ctx.arc(388, 334, 32, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  return canvas.toDataURL("image/png");
}
