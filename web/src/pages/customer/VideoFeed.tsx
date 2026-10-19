import { useEffect, useRef, useState } from "react";
import { ChevronUp, Info, Plus, ShoppingBag, ThumbsUp, X } from "lucide-react";
import { rupiah } from "../../lib/format";
import { useLang } from "../../lib/lang";
import { scheduleText } from "../../../../shared/schedule";
import type { Lang } from "../../../../shared/i18n";
import type { Dish, Priced } from "./Menu";

/**
 * Mode video ala TikTok: satu menu satu layar, geser ke atas untuk menu berikutnya.
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
          const v = e.target.querySelector("video");
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            setIdx(Number((e.target as HTMLElement).dataset.i));
            v?.play().catch(() => {});
          } else {
            v?.pause();
          }
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
        const vid = d.media.find((m) => m.kind === "video")?.url ?? d.video_url;
        const img = d.image_url ?? d.media.find((m) => m.kind === "image")?.url ?? null;
        const ok = !d.sold_out && p.open;
        const near = Math.abs(i - idx) <= 1; // muat media hanya untuk slide sekitar
        return (
          <section key={d.id} className="vf-slide" data-i={i} aria-label={d.name}>
            <div className="vf-media">
              {vid && near ? (
                <video src={vid} poster={img ?? undefined} muted loop playsInline preload="metadata" aria-hidden="true" />
              ) : img ? (
                <img src={img} alt="" loading={near ? "eager" : "lazy"} decoding="async" />
              ) : null}
            </div>
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
