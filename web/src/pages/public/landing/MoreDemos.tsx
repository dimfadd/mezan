import { Check, Clock3, Gift, MessageCircle, Plus, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { rupiah } from "../../../lib/format";
import { Food, type FoodKind } from "./art";
import { useStepper } from "./motion";

// Peraga kecil untuk fitur di sisi meja. Setiap langkah mengikuti perilaku aplikasi yang sebenarnya.

const Tap = ({ delay = 600 }: { delay?: number }) => <span className="lp-tap" style={{ animationDelay: `${delay}ms` }} />;

/** Kasir kirim struk ke WhatsApp, pembeli memberi bintang dan jempol per menu, lalu tombol ulasan Google Maps untuk semua. */
export function RatingDemo({ on }: { on: boolean }) {
  const [s] = useStepper(5, (i) => [1500, 1600, 1500, 1500, 3200][i], on);
  const step = on ? s : 4;
  const stars = step >= 2 ? 4 : 0;
  const thumbs = step >= 3;
  const sent = step === 4;
  return (
    <div className="lp-rate">
      <div className="lp-rate-wa">
        <small>Dari kasir</small>
        <span className={`lp-btn${step === 0 ? "" : " done"}`}>
          <MessageCircle /> Kirim struk ke WhatsApp
          {on && step === 0 && <Tap delay={700} />}
        </span>
        <div className={`lp-wa-bubble${step >= 1 ? " show" : ""}`}>
          <span>Struk Warung Contoh #18 · {rupiah(41000)}</span>
          <u>pesan.in/struk/k7f3qx</u>
          <i><Check /><Check /></i>
        </div>
      </div>
      <div className="lp-call-arrow" />
      <div className="lp-rate-card">
        {sent ? (
          <div className="lp-rate-done" key="done">
            <div className="lp-rate-stars" aria-label="4 dari 5 bintang">
              {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={n <= stars ? "on" : ""} />)}
            </div>
            <b>Terima kasih. Penilaianmu sudah sampai ke pemilik.</b>
            <span className="lp-btn">Tulis ulasan di Google Maps</span>
          </div>
        ) : (
          <>
            <b>Gimana makanannya?</b>
            <div className="lp-rate-stars">
              {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={n <= stars ? "on" : ""} style={{ transitionDelay: `${n * 70}ms` }} />)}
            </div>
            {(
              [
                ["Ayam Geprek", "geprek"],
                ["Es Teh Manis", "esteh"],
              ] as [string, FoodKind][]
            ).map(([n, k]) => (
              <div className="lp-rate-row" key={n}>
                <span className="th"><Food kind={k} /></span>
                <span className="n">{n}</span>
                <span className={`th-btn${thumbs ? " on" : ""}`}><ThumbsUp /></span>
                <span className="th-btn"><ThumbsDown /></span>
              </div>
            ))}
            <span className={`lp-btn primary${thumbs ? "" : " off"}`}>
              Kirim penilaian
              {on && step === 3 && <Tap delay={900} />}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

const SLIDES: { kind: FoodKind; name: string; price: number; video: boolean }[] = [
  { kind: "kopi", name: "Kopi Susu Gula Aren", price: 15000, video: true },
  { kind: "geprek", name: "Ayam Geprek Sambal Bawang", price: 18000, video: true },
  { kind: "pisang", name: "Pisang Goreng Keju", price: 10000, video: false },
];

/** Mode video: satu menu per layar, digeser ke atas seperti video pendek. */
export function VideoDemo({ on }: { on: boolean }) {
  const [s] = useStepper(SLIDES.length, () => 2800, on);
  const idx = on ? s : 0;
  return (
    <div className="lp-vphone">
      <div className="lp-vscreen">
        <div className="lp-vtrack" style={{ transform: `translateY(-${idx * (100 / SLIDES.length)}%)` }}>
          {SLIDES.map((sl, i) => (
            <div className="lp-vslide" key={sl.name}>
              <Food kind={sl.kind} view={i === 1 ? 1 : 0} />
              {sl.video && <span className="lp-vid-tag">Video</span>}
              {sl.video && i === idx && (
                <span className="lp-vbar" key={`${idx}-${on}`}>
                  <span />
                </span>
              )}
              <div className="lp-vinfo">
                <b>{sl.name}</b>
                <span className="p">{rupiah(sl.price)}</span>
                <span className="lp-vadd"><Plus /> Tambah</span>
              </div>
            </div>
          ))}
        </div>
        <div className="lp-vtoggle">
          <span>Daftar</span>
          <span>Kotak</span>
          <span className="on">Video</span>
        </div>
        <div className="lp-vdots">
          {SLIDES.map((sl, i) => <i key={sl.name} className={i === idx ? "on" : ""} />)}
        </div>
      </div>
    </div>
  );
}

/** Kartu stempel: satu stempel per belanja yang memenuhi batas minimal, hadiah ditukar di kasir. */
export function StampDemo({ on, reward = "1 Es Teh gratis" }: { on: boolean; reward?: string }) {
  const [s] = useStepper(5, (i) => [1300, 1300, 1300, 2600, 1900][i], on);
  const step = on ? s : 3;
  const stamps = [7, 8, 9, 10, 0][step];
  return (
    <div className="lp-stampcard">
      <div className="lp-stamp-h">
        <b>Kartu stempel</b>
        <span className="num">0812-••••-3021</span>
      </div>
      <div className="lp-stamp-grid">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className={`${i < stamps ? "on" : ""}${on && i === stamps - 1 && step > 0 ? " fresh" : ""}`}>
            {i < stamps ? <Check /> : i === 9 ? <Gift /> : null}
          </span>
        ))}
      </div>
      <div className="lp-stamp-foot">
        {step === 3 ? (
          <>
            <span className="lp-badge new"><Gift /> Hadiah siap ditukar: {reward}</span>
            <span className="lp-btn primary" style={{ flex: "none" }}>
              Tukar
              {on && <Tap delay={1700} />}
            </span>
          </>
        ) : step === 4 ? (
          <span className="lp-badge ok"><Check /> Hadiah ditukar, kartu mulai dari nol</span>
        ) : (
          <span className="muted">{stamps}/10 stempel · min. belanja {rupiah(15000)}</span>
        )}
      </div>
    </div>
  );
}

/** Saran pasangan di detail menu: tambah pelengkap dengan satu ketukan. */
export function PairDemo({ on }: { on: boolean }) {
  const [s] = useStepper(3, (i) => [1800, 1100, 2600][i], on);
  const step = on ? s : 2;
  const added = step === 2;
  return (
    <div className="lp-pair">
      <div className="lp-pair-dish">
        <span className="th"><Food kind="geprek" /></span>
        <div>
          <b>Ayam Geprek Sambal Bawang</b>
          <span className="lp-badge ok"><Check /> Ditambahkan</span>
        </div>
      </div>
      <div className="lp-pair-h">Cocok dengan ini</div>
      <div className="lp-pair-chips">
        <span className={`lp-pair-chip${added ? " on" : ""}`}>
          <span className="th"><Food kind="esteh" /></span>
          Es Teh Manis
          <b>{added ? <Check /> : `+${rupiah(5000)}`}</b>
          {on && step === 1 && <Tap delay={500} />}
        </span>
        <span className="lp-pair-chip">
          <span className="th"><Food kind="kerupuk" /></span>
          Kerupuk Udang
          <b>+{rupiah(2000)}</b>
        </span>
      </div>
      <div className={`lp-pair-cart${added ? " bump" : ""}`} key={String(added)}>
        {added ? "2 item" : "1 item"} · <b>{rupiah(added ? 23000 : 18000)}</b>
      </div>
    </div>
  );
}

const CLOCK = ["07.30", "10.15", "15.05", "17.10"];

/** Menu sarapan hanya pagi, happy hour memotong harga sendiri pada jamnya. */
export function HappyDemo({ on }: { on: boolean }) {
  const [s] = useStepper(4, (i) => [1900, 1700, 2800, 1700][i], on);
  const step = on ? s : 2;
  const morning = step === 0;
  const happy = step === 2;
  const rows: { kind: FoodKind; name: string; price: number; drink: boolean }[] = [
    { kind: "bubur", name: "Bubur Ayam", price: 14000, drink: false },
    { kind: "kopi", name: "Kopi Susu Gula Aren", price: 15000, drink: true },
    { kind: "jeruk", name: "Es Jeruk Peras", price: 8000, drink: true },
  ];
  return (
    <div className="lp-happy">
      <div className="lp-happy-h">
        <span className="lp-clock" key={step}><Clock3 /> {CLOCK[step]}</span>
        <span className={`lp-badge${happy ? " new" : ""}`}>{happy ? "Happy hour minuman −20%" : "Harga normal"}</span>
      </div>
      {rows.map((r) => {
        const out = !r.drink && !morning;
        const cut = happy && r.drink;
        return (
          <div className={`lp-happy-row${out ? " out" : ""}`} key={r.name}>
            <span className="th"><Food kind={r.kind} /></span>
            <span className="n">
              {r.name}
              {!r.drink && <small>Tersedia 06.00–10.00</small>}
            </span>
            <span className="p">
              {cut && <s>{rupiah(r.price)}</s>}
              <b>{rupiah(cut ? r.price * 0.8 : r.price)}</b>
            </span>
          </div>
        );
      })}
    </div>
  );
}

const QUEUE = [
  ["A9", "Rina", 4],
  ["A10", "Bayu", 2],
  ["A11", "Dewi", 5],
  ["A12", "Sari", 3],
] as const;

/** Antrean saat penuh: pembeli menunggu dengan nomor, kasir memanggil saat meja siap. */
export function WaitlistDemo({ on }: { on: boolean }) {
  const [s] = useStepper(5, (i) => [1500, 1500, 1500, 1700, 3200][i], on);
  const step = on ? s : 4;
  const ahead = Math.max(0, 3 - step);
  const ready = step === 4;
  return (
    <div className="lp-wait">
      <div className={`lp-wait-phone${ready ? " ready" : ""}`}>
        <small>Antrean · Warung Contoh</small>
        <span className="no">A12</span>
        <span className="who">Sari · 3 orang</span>
        <div className="msg" key={step}>
          {ready ? (
            <b>Mejamu siap! Silakan ke kasir.</b>
          ) : ahead === 0 ? (
            "Kamu berikutnya"
          ) : (
            <>
              <b className="num">{ahead}</b> rombongan di depanmu
            </>
          )}
        </div>
        <span className="tiny">Halaman ini diperbarui sendiri</span>
      </div>
      <div className="lp-call-arrow" />
      <div className="lp-wait-list">
        <small>Layar kasir · Antrean</small>
        {QUEUE.map(([no, name, n], i) => {
          const seated = i < 3 && i < step;
          const called = i === 3 && ready;
          return (
            <div className={`lp-wait-row${seated ? " seated" : ""}`} key={no}>
              <b className="num">{no}</b>
              <span className="nm">{name} · {n} orang</span>
              {seated ? (
                <span className="lp-badge">Duduk</span>
              ) : called ? (
                <span className="lp-badge new"><MessageCircle /> Dipanggil</span>
              ) : (
                <span className="acts">
                  <span className="lp-btn">
                    Panggil
                    {on && i === 3 && step === 3 && <Tap delay={1000} />}
                  </span>
                  <span className="lp-btn">
                    Duduk
                    {on && i === step && i < 3 && <Tap delay={800} />}
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

