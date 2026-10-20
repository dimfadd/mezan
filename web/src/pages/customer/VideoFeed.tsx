import { useEffect, useRef, useState } from "react";
import { initials } from "../../lib/format";
import { ChevronUp, Info, Plus, ShoppingBag, ThumbsUp, X } from "lucide-react";
import { rupiah } from "../../lib/format";
import { useLang } from "../../lib/lang";
import { scheduleText } from "../../../../shared/schedule";
import type { Lang } from "../../../../shared/i18n";
import type { Dish, Priced } from "./Menu";

/**
 * Mode geser ala TikTok/Reels: satu menu satu layar, geser ke atas untuk menu berikutnya.
 * Foto dan video satu menu jadi carousel yang digeser ke samping; foto berganti sendiri seperti
 * carousel foto di TikTok, sampai pembeli menyentuhnya. Menu tanpa foto tetap ikut, dengan inisial.
 * Hanya video yang sedang terlihat yang diputar (tanpa suara), supaya hemat kuota dan baterai.
 */
export function VideoFeed({
  items,
  lang,
  priced,
  canOrder,
  count,
  onAdd,
  onOpen,
  onCart,
  onClose,
}: {
  items: Dish[];
  lang: Lang;
  priced: Priced;
  canOrder: boolean;
  count: number;
  onAdd: (d: Dish) => void;
  onOpen: (d: Dish) => void;
  onCart: () => void;
  onClose: () => void;
}) {
  const { t } = useLang();
  const box = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const root = box.current;
    if (!root) return;
    const slides = [...root.querySelectorAll<HTMLElement>(".vf-slide")];
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) setIdx(Number((e.target as HTMLElement).dataset.i));
        }
      },
      { root, threshold: [0, 0.6, 1] },
    );
    slides.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [items]);

  const go = (d: number) => {
    const root = box.current;
    if (!root) return;
    root.scrollBy({ top: d * root.clientHeight, behavior: "smooth" });
  };

  return (
    <div
      className="vf"
      role="dialog"
      aria-modal="true"
      aria-label={t.videoView}
      ref={box}
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
        if (e.key === "ArrowDown" || e.key === "PageDown") (e.preventDefault(), go(1));
        if (e.key === "ArrowUp" || e.key === "PageUp") (e.preventDefault(), go(-1));
      }}
    >
      <div className="vf-top">
        <button type="button" className="vf-btn" onClick={onClose} aria-label={t.closeVideo}>
          <X />
        </button>
        <span className="vf-count num" aria-live="polite">{idx + 1}/{items.length}</span>
        <button type="button" className="vf-btn" onClick={onCart} aria-label={`${t.viewOrder}: ${t.items(count)}`}>
          <ShoppingBag />
          {count > 0 && <span className="count">{count}</span>}
        </button>
      </div>
      {items.map((d, i) => {
        const p = priced(d);
        const ok = !d.sold_out && p.open;
        const near = Math.abs(i - idx) <= 1; // muat media hanya untuk slide sekitar
        return (
          <section key={d.id} className="vf-slide" data-i={i} aria-label={d.name}>
            <Carousel dish={d} active={i === idx} near={near} />
            <div className="vf-info">
              {d.tags.split(",").includes("bestseller") && (
                <span className="stamp-best"><ThumbsUp aria-hidden="true" /> {t.bestSeller}</span>
              )}
              <h2>{d.name}</h2>
              {lang === "en" && d.name_en && d.name_en !== d.name && <p className="vf-sub">{d.name_en}</p>}
              <p className="vf-price money">
                {p.promo && <s>{rupiah(p.list)}</s>} {rupiah(p.price)}
                {p.promo && <span className="promo-tag">{p.promo}</span>}
              </p>
              {!ok && <p className="vf-note">{d.sold_out ? t.soldOut : t.availableAt(scheduleText(d, lang))}</p>}
              <div className="vf-acts">
                {canOrder && ok && (
                  <button type="button" className="btn btn-primary btn-lg" onClick={() => onAdd(d)}>
                    <Plus /> {t.add}
                  </button>
                )}
                <button type="button" className="btn btn-lg vf-ghost" onClick={() => onOpen(d)}>
                  <Info /> {t.seeDetail}
                </button>
              </div>
              {i === 0 && mediaOf(d).length > 1 && <p className="vf-side">{t.swipeSide}</p>}
              {i === 0 && items.length > 1 && (
                <button type="button" className="vf-hint" onClick={() => go(1)}>
                  <ChevronUp aria-hidden="true" /> {t.swipeUp}
                </button>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

type Media = { kind: string; url: string };

/** Galeri menu sesuai urutan pemilik; data lama tanpa galeri memakai kolom sampul. */
function mediaOf(d: Dish): Media[] {
  if (d.media.length) return d.media;
  const out: Media[] = [];
  if (d.image_url) out.push({ kind: "image", url: d.image_url });
  if (d.video_url) out.push({ kind: "video", url: d.video_url });
  return out;
}

const PHOTO_MS = 3500;

function Carousel({ dish, active, near }: { dish: Dish; active: boolean; near: boolean }) {
  const { t } = useLang();
  const media = mediaOf(dish);
  const track = useRef<HTMLDivElement>(null);
  const vids = useRef<(HTMLVideoElement | null)[]>([]);
  const [page, setPage] = useState(0);
  const [touched, setTouched] = useState(false);
  const poster = media.find((m) => m.kind === "image")?.url;

  // Video hanya diputar kalau menunya sedang tampil dan halaman carousel-nya sedang dilihat.
  useEffect(() => {
    vids.current.forEach((v, i) => {
      if (!v) return;
      if (active && i === page) v.play().catch(() => {});
      else v.pause();
    });
  }, [active, page, near]);

  // Foto berganti sendiri seperti carousel foto TikTok, berhenti begitu pembeli menggeser sendiri.
  useEffect(() => {
    if (!active || touched || media.length < 2 || media[page]?.kind !== "image" || page >= media.length - 1) return;
    const id = window.setTimeout(() => goTo(page + 1), PHOTO_MS);
    return () => window.clearTimeout(id);
  });

  // Kembali ke awal saat menu ditinggalkan, supaya saat digeser balik mulai dari sampul.
  useEffect(() => {
    if (active) return;
    setTouched(false);
    const el = track.current;
    if (el && el.scrollLeft) el.scrollTo({ left: 0 });
  }, [active]);

  const goTo = (n: number) => {
    const el = track.current;
    if (el) el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
  };
  const onScroll = () => {
    const el = track.current;
    if (el) setPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
  };

  if (!media.length) {
    return (
      <div className="vf-media vf-empty" aria-hidden="true">
        <span className="vf-ini">{initials(dish.name)}</span>
        <small>{t.noPhoto}</small>
      </div>
    );
  }

  return (
    <div className="vf-media">
      <div
        className="vf-track"
        ref={track}
        onScroll={onScroll}
        onPointerDown={() => setTouched(true)}
        onTouchStart={() => setTouched(true)}
      >
        {media.map((m, i) => (
          <div className="vf-page" key={m.url + i} aria-label={t.mediaPos(i + 1, media.length)}>
            {!near ? null : m.kind === "video" ? (
              <video ref={(el) => { vids.current[i] = el; }} src={m.url} poster={poster} muted loop playsInline preload="metadata" aria-hidden="true" />
            ) : (
              <img src={m.url} alt="" loading={active ? "eager" : "lazy"} decoding="async" />
            )}
          </div>
        ))}
      </div>
      {media.length > 1 && (
        <div className="vf-dots" aria-hidden="true">
          {media.map((m, i) => (
            <span key={i} className={`${i === page ? "on" : ""}${m.kind === "video" ? " v" : ""}`} />
          ))}
        </div>
      )}
    </div>
  );
}
