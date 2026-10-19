// Persiapan file sebelum diunggah, supaya hemat kuota pelanggan dan penyimpanan.
import { runtimeInfo } from "./session";

const capMb = () => runtimeInfo.uploadLimitMb;

export const VIDEO_MAX_MB = 15;
export const VIDEO_MAX_SECONDS = 20;

/** Perkecil foto ke maksimal 1200px dan simpan sebagai WebP. GIF dibiarkan agar animasinya tidak hilang. */
export async function prepareImage(file: File): Promise<File> {
  if (file.type === "image/gif") {
    if (file.size > Math.min(3, capMb()) * 1024 * 1024) throw new Error("GIF maksimal 3 MB. Untuk gerakan, video MP4 pendek biasanya 5-10x lebih kecil.");
    return file;
  }
  if (!file.type.startsWith("image/")) throw new Error("File ini bukan gambar.");
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("Gambar tidak bisa dibaca. Coba format JPG atau PNG.");
  });
  const max = 1200;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, w, h);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", 0.82));
  if (!blob) return file;
  const out = new File([blob], file.name.replace(/\.\w+$/, "") + ".webp", { type: blob.type || "image/webp" });
  const best = out.size < file.size ? out : file;
  if (best.size > capMb() * 1024 * 1024) throw new Error(`Foto masih lebih dari ${capMb()} MB setelah diperkecil. Coba foto lain.`);
  return best;
}

/** Cek ukuran & durasi video sebelum diunggah. */
export async function checkVideo(file: File): Promise<File> {
  if (!["video/mp4", "video/webm"].includes(file.type)) throw new Error("Video harus berformat MP4 atau WebM.");
  const maxMb = Math.min(VIDEO_MAX_MB, capMb());
  if (file.size > maxMb * 1024 * 1024) throw new Error(`Video maksimal ${maxMb} MB di server ini. Potong jadi beberapa detik atau kecilkan resolusinya (720p cukup).`);
  const duration = await new Promise<number>((resolve) => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(v.src);
      resolve(v.duration);
    };
    v.onerror = () => resolve(0);
    v.src = URL.createObjectURL(file);
  });
  if (duration > VIDEO_MAX_SECONDS + 0.5) {
    throw new Error(`Video ${Math.round(duration)} detik terlalu panjang. Maksimal ${VIDEO_MAX_SECONDS} detik supaya cepat dibuka di HP pelanggan.`);
  }
  return file;
}
