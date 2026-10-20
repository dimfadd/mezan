// Membuat foto & video peraga untuk menu contoh dari ilustrasi landing (bukan foto sungguhan).
// Jalankan: npx tsx scripts/make-demo-media.tsx  (butuh ffmpeg dan Chromium Playwright)
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { chromium } from "playwright";
import { Food, type FoodKind } from "../web/src/pages/public/landing/art";

const OUT = "web/public/demo/menu";
const KINDS: FoodKind[] = ["nasgor", "geprek", "soto", "pisang", "esteh", "jeruk", "kopi", "teh", "air", "kerupuk"];
const VIDEOS: FoodKind[] = ["geprek", "kopi", "nasgor", "esteh"];
mkdirSync(OUT, { recursive: true });

const svg = (k: FoodKind, view: 0 | 1) =>
  renderToStaticMarkup(createElement(Food, { kind: k, view })).replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" ');

for (const k of KINDS) {
  writeFileSync(`${OUT}/${k}-1.svg`, svg(k, 0));
  writeFileSync(`${OUT}/${k}-2.svg`, svg(k, 1));
}

// Video potret 9:16: dua bingkai ilustrasi, diperbesar pelan lalu berpindah sudut.
const tmp = "scripts/.media-tmp";
mkdirSync(tmp, { recursive: true });
const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 720, height: 1280 } });
for (const k of VIDEOS) {
  for (const v of [0, 1] as const) {
    const bg = /fill="(#[0-9a-f]{6})"/.exec(svg(k, v))![1];
    await p.setContent(`<body style="margin:0;background:${bg};display:grid;place-items:center;height:1280px">${svg(k, v).replace('width="800" height="800"', 'width="720" height="720"')}</body>`);
    await p.screenshot({ path: `${tmp}/${k}-${v}.png` });
  }
  const zoom = (i: number) => `[${i}:v]scale=1080:1920,zoompan=z='min(zoom+0.0009,1.12)':d=120:s=720x1280:fps=30,setsar=1[v${i}]`;
  execFileSync("ffmpeg", [
    "-y", "-loglevel", "error",
    "-i", `${tmp}/${k}-0.png`,
    "-i", `${tmp}/${k}-1.png`,
    "-filter_complex", `${zoom(0)};${zoom(1)};[v0][v1]xfade=transition=fade:duration=0.8:offset=3.2,format=yuv420p[out]`,
    "-map", "[out]", "-c:v", "libx264", "-preset", "slow", "-crf", "30", "-movflags", "+faststart", "-an",
    `${OUT}/${k}.mp4`,
  ]);
}
await b.close();
rmSync(tmp, { recursive: true, force: true });
console.log("selesai");
