import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Expand } from "lucide-react";
import { Thumb } from "./ui";
import { DICT, type Lang } from "../../../shared/i18n";

export interface MediaRef {
  kind: "image" | "video";
  url: string;
}

/**
 * Galeri geser untuk foto & video menu.
 * Hemat kuota: hanya slide pertama dimuat langsung, sisanya dimuat saat mendekat.
 * Video diputar otomatis (tanpa suara) hanya saat terlihat, dan berhenti saat digeser.
 */
export function Gallery({
  media,
  name,
  start = 0,
  fit = "cover",
  onExpand,
  lang = "id",
}: {
  media: MediaRef[];
  name: string;
  start?: number;
  fit?: "cover" | "contain";
  onExpand?: (index: number) => void;
  lang?: Lang;
}) {
  const t = DICT[lang];
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(start);
  const [near, setNear] = useState<Set<number>>(() => new Set([start, start + 1]));
  const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    const el = track.current;
    if (el && start > 0) el.scrollTo({ left: start * el.clientWidth, behavior: "instant" as ScrollBehavior });
  }, [start]);

  // Putar video yang sedang tampil, jeda yang lain.
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const vids = [...el.querySelectorAll("video")];
    if (reduce || vids.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const v = e.target as HTMLVideoElement;
          if (e.isIntersecting && e.intersectionRatio > 0.6) v.play().catch(() => {});
          else v.pause();
        }
      },
      { root: el, threshold: [0, 0.6, 1] },
    );
    vids.forEach((v) => io.observe(v));
    return () => io.disconnect();
  }, [near, reduce]);

  if (media.length === 0) {
    return (
      <div className="gallery">
        <div className="gallery-track">
          <div className="gallery-slide"><Thumb name={name} /></div>
        </div>
      </div>
    );
  }

  const go = (i: number) => {
    const el = track.current;
    if (!el) return;
    const n = Math.max(0, Math.min(media.length - 1, i));
    el.scrollTo({ left: n * el.clientWidth, behavior: reduce ? "auto" : "smooth" });
  };

  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== index) setIndex(i);
    if (!near.has(i + 1) || !near.has(i - 1)) setNear((s) => new Set([...s, i - 1, i, i + 1]));
  };

  const photos = media.filter((m) => m.kind === "image").length;
  const videos = media.length - photos;

  return (
    <div className={`gallery fit-${fit}`} aria-roledescription="galeri" aria-label={t.gallery(name)}>
      <div className="gallery-track" ref={track} onScroll={onScroll} tabIndex={0} aria-label={t.swipe}>
        {media.map((m, i) => (
          <div className="gallery-slide" key={m.url} aria-label={t.ofN(i + 1, media.length)} role="group">
            {!near.has(i) ? (
              <div className="ph" aria-hidden="true" />
            ) : m.kind === "image" ? (
              <img src={m.url} alt={t.photoN(name, i + 1)} loading={i === start ? "eager" : "lazy"} decoding="async" />
            ) : (
              <video
                src={m.url}
                muted
                loop
                playsInline
                controls={fit === "contain" || reduce}
                preload={i === start ? "metadata" : "none"}
                aria-label={t.videoN(name, i + 1)}
              />
            )}
            {onExpand && (
              <button type="button" className="gallery-expand" onClick={() => onExpand(i)} aria-label={t.fullscreen}>
                <Expand aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>
      {media.length > 1 && (
        <>
          <button type="button" className="gallery-nav prev" onClick={() => go(index - 1)} disabled={index === 0} aria-label={t.prev}>
            <ChevronLeft aria-hidden="true" />
          </button>
          <button type="button" className="gallery-nav next" onClick={() => go(index + 1)} disabled={index === media.length - 1} aria-label={t.next}>
            <ChevronRight aria-hidden="true" />
          </button>
          <div className="gallery-dots" aria-hidden="true">
            {media.map((m, i) => (
              <span key={m.url} className={`${i === index ? "on" : ""} ${m.kind === "video" ? "vid" : ""}`} />
            ))}
          </div>
          <span className="gallery-count" aria-live="polite">
            {index + 1}/{media.length}
            {videos > 0 && index === 0 && <> · {t.photos(photos)}, {t.videos(videos)}</>}
          </span>
        </>
      )}
    </div>
  );
}

export function mediaSummary(media: MediaRef[], lang: Lang = "id") {
  const t = DICT[lang];
  const p = media.filter((m) => m.kind === "image").length;
  const v = media.length - p;
  return [p > 1 ? t.photos(p) : null, v ? t.videos(v) : null].filter(Boolean).join(" · ");
}
