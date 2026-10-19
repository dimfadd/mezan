// Unggah media menu. Di Vercel dengan Blob aktif, file dikirim langsung dari browser ke Blob
// (bisa sampai 15 MB untuk video). Di server biasa, file dikirim lewat API.
import { api } from "./api";
import { runtimeInfo } from "./session";
import { checkVideo, prepareImage } from "./media";

const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "video/mp4": "mp4", "video/webm": "webm" };

export async function uploadMedia(file: File, tenantId: string): Promise<{ kind: "image" | "video"; url: string }> {
  const kind = file.type.startsWith("video/") ? "video" : "image";
  const ready = kind === "image" ? await prepareImage(file) : await checkVideo(file);
  if (runtimeInfo.directUpload) {
    const ext = EXT[ready.type];
    if (!ext) throw new Error("Format file tidak didukung.");
    const key = `${tenantId}/${crypto.randomUUID()}.${ext}`;
    const { upload } = await import("@vercel/blob/client");
    try {
      await upload(`media/${key}`, ready, { access: "public", handleUploadUrl: "/api/media-upload", contentType: ready.type });
    } catch (e) {
      throw new Error(`Unggahan gagal: ${(e as Error).message}`);
    }
    return { kind, url: `/media/${key}` };
  }
  const r = await api.upload<{ url: string }>("/api/store/media", ready);
  return { kind, url: r.url };
}
