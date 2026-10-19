import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, normalize, sep } from "node:path";
import type { MediaStorage } from "./storage";

const TYPES: Record<string, string> = {
  jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", mp4: "video/mp4", webm: "video/webm",
};

export function diskStorage(root: string): MediaStorage {
  const resolve = (key: string) => {
    const p = normalize(join(root, key));
    if (!p.startsWith(normalize(root) + sep)) throw new Error("path tidak valid");
    return p;
  };
  return {
    async put(key, data) {
      const p = resolve(key);
      await mkdir(dirname(p), { recursive: true });
      await writeFile(p, new Uint8Array(data));
    },
    async get(key) {
      try {
        const p = resolve(key);
        const s = await stat(p);
        const body = await readFile(p);
        const ext = key.split(".").pop() ?? "";
        return { body: new Uint8Array(body), contentType: TYPES[ext] ?? "application/octet-stream", size: s.size };
      } catch {
        return null;
      }
    },
    async delete(key) {
      try {
        await rm(resolve(key));
      } catch {
        /* sudah tidak ada */
      }
    },
  };
}
