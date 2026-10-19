import { useRef, type ReactNode } from "react";
import { BellRing, Check, Clapperboard, DoorOpen, LayoutGrid, List, MapPin, ReceiptText, ShoppingBag, Stamp, Star, ThumbsUp, Users } from "lucide-react";
import { rupiah } from "../../../lib/format";
import { AppIcon, FakeQR, Food, type FoodKind } from "./art";
import { useReducedMotion, useStepper, useVisible } from "./motion";
import { RatingDemo, StampDemo, VideoDemo, WaitlistDemo } from "./MoreDemos";

// Yang dirasakan pembeli di meja, diurutkan dari yang paling memikat. Setiap kartu memperagakan perilaku aplikasi yang sebenarnya.
export function Extras() {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const visible = useVisible(root, 0.15);
  const on = visible && !reduce;
  return (
    <div ref={root} className={`lp-bento${on ? "" : " is-still"}`}>
      <Card className="tall" icon={<Clapperboard />} title="Mode video ala TikTok" body="Pembeli menggeser menu satu per satu dalam layar penuh, videonya jalan sendiri. Tambah ke pesanan tanpa keluar dari video.">
        <VideoDemo on={on} />
      </Card>
      <Card className="span2" icon={<BellRing />} title="Panggil pelayan dari HP" body="Tidak perlu melambai atau berteriak. Panggilan muncul di layar kasir lengkap dengan nomor meja, dan pembeli tahu kapan sudah ditanggapi.">
        <CallDemo on={on} />
      </Card>
      <Card icon={<Users />} title="Pesan bareng satu meja" body="Semua orang di meja memindai QR yang sama dan memilih dari HP masing-masing. Satu daftar, dikirim sekali.">
        <GroupDemo on={on} />
      </Card>
      <Card icon={<Stamp />} title="Kartu stempel lewat nomor HP" body="Kasir mengetik nomor HP saat bayar. Tiap belanja di atas batas minimal dapat satu stempel. Pembeli tidak perlu pasang aplikasi.">
        <StampDemo on={on} />
      </Card>
      <Card className="span2" icon={<Star />} title="Struk digital & rating per menu" body="Kasir mengirim struk ke WhatsApp pembeli. Setelah makan, pembeli memberi bintang dan jempol per menu, lalu bisa lanjut menulis ulasan di Google Maps. Pemilik melihat menu mana yang disukai.">
        <RatingDemo on={on} />
      </Card>
      <Card icon={<ShoppingBag />} title="QR khusus bawa pulang" body="Satu QR di dekat kasir. Pesan tanpa antre, ambil saat nomornya dipanggil.">
        <PickupDemo on={on} />
      </Card>
      <Card className="span2" icon={<DoorOpen />} title="Antrean saat penuh" body="Pembeli memindai QR di pintu, mengisi nama dan jumlah orang, lalu bebas menunggu di mana saja. Halamannya diperbarui sendiri dan berubah saat mejanya siap.">
        <WaitlistDemo on={on} />
      </Card>
      <Card icon={<ReceiptText />} title="Bagi tagihan per orang" body="Kasir langsung melihat bagian masing-masing, sudah termasuk service dan pajak.">
        <SplitDemo />
      </Card>
    </div>
  );
}

export function Card({ icon, title, body, className = "", children }: { icon: ReactNode; title: string; body: string; className?: string; children: ReactNode }) {
  return (
    <article className={`lp-card ${className}`}>
      <div className="lp-card-copy">
        <h3><span className="ic">{icon}</span>{title}</h3>
        <p>{body}</p>
      </div>
      <div className="lp-card-demo" aria-hidden="true">{children}</div>
    </article>
  );
}

function CallDemo({ on }: { on: boolean }) {
  const [s] = useStepper(4, (i) => [1500, 1400, 2200, 1500][i], on);
  const step = on ? s : 2;
  const called = step >= 1 && step <= 2;
  return (
    <div className="lp-call">
      <div className="lp-call-phone">
        <div className="row between">
          <span className="lp-m-table">Meja 4</span>
          <span className={`lp-call-btn${called ? " on" : ""}`} key={called ? "on" : "off"}>
            <BellRing /> Panggil
            {step === 0 && on && <span className="lp-tap" style={{ animationDelay: "900ms" }} />}
          </span>
        </div>
        <div className="lp-call-msg">{called ? "Pelayan sudah dipanggil. Tunggu sebentar ya." : step === 3 ? "Panggilanmu sudah ditanggapi." : "Butuh bantuan? Ketuk Panggil."}</div>
      </div>
      <div className="lp-call-arrow" />
      <div className="lp-call-board">
        <small>Layar kasir</small>
        {called ? (
          <div className="lp-call-card" key="c">
            <BellRing />
            <div>
              <b>Meja 4</b>
              <span>Panggil pelayan · baru saja</span>
            </div>
            <span className="lp-btn">{step === 2 ? <><Check /> Selesai</> : "Selesai"}{step === 2 && on && <span className="lp-tap" style={{ animationDelay: "1300ms" }} />}</span>
          </div>
        ) : (
          <div className="lp-col-empty">Tidak ada panggilan</div>
        )}
      </div>
    </div>
  );
}

const GROUP: { who: string; color: string; item: string; qty: number; price: number }[] = [
  { who: "Sari", color: "#1f6b4f", item: "Ayam Geprek", qty: 1, price: 18000 },
  { who: "Budi", color: "#b5531f", item: "Nasi Goreng Kampung", qty: 1, price: 22000 },
  { who: "Dewi", color: "#2d4f86", item: "Soto Ayam Lamongan", qty: 1, price: 17000 },
  { who: "Budi", color: "#b5531f", item: "Es Teh Manis", qty: 2, price: 5000 },
];

function GroupDemo({ on }: { on: boolean }) {
  const [s] = useStepper(GROUP.length + 2, (i) => (i === GROUP.length + 1 ? 2400 : 1200), on);
  const n = on ? Math.min(s, GROUP.length) : GROUP.length;
  const shown = GROUP.slice(0, n);
  const total = shown.reduce((a, g) => a + g.qty * g.price, 0);
  return (
    <div className="lp-group">
      <div className="lp-avatars">
        {["Sari", "Budi", "Dewi"].map((w) => {
          const g = GROUP.find((x) => x.who === w)!;
          return <span key={w} style={{ background: g.color }} title={w}>{w[0]}</span>;
        })}
        <small>3 orang di Meja 7</small>
      </div>
      <div className="lp-group-list">
        {shown.map((g, i) => (
          <div className="lp-group-line" key={i}>
            <i style={{ background: g.color }} />
            <span className="who">{g.who}</span>
            <span className="it">{g.qty}× {g.item}</span>
            <b>{rupiah(g.qty * g.price)}</b>
          </div>
        ))}
        {n === 0 && <div className="lp-col-empty">Menunggu pilihan...</div>}
      </div>
      <span className={`lp-btn primary${n === GROUP.length ? "" : " off"}`}>
        Kirim pesanan meja · {rupiah(total)}
        {on && s === GROUP.length && <span className="lp-tap" style={{ animationDelay: "500ms" }} />}
      </span>
    </div>
  );
}

function SplitDemo() {
  // Subtotal 67.000 + service 5% + pajak 10% = 77.385, dibagi sebanding.
  const rows: [string, string, number][] = [["Sari", "#1f6b4f", 20790], ["Budi", "#b5531f", 36960], ["Dewi", "#2d4f86", 19635]];
  return (
    <div className="lp-split">
      <div className="lp-split-h"><b>#18 · Meja 7</b><span className="lp-badge warn">Belum bayar</span></div>
      {rows.map(([p, c, v]) => (
        <div className="lp-split-row" key={p}>
          <i style={{ background: c }} />
          <span>{p}</span>
          <b>{rupiah(v)}</b>
        </div>
      ))}
      <div className="lp-split-tot"><span>Total</span><b>{rupiah(77385)}</b></div>
    </div>
  );
}

export function GeoDemo() {
  return (
    <div className="lp-geo">
      <div className="lp-radar">
        <span className="ring" />
        <span className="ring r2" />
        <span className="pin"><MapPin /></span>
        <span className="dot ok" style={{ left: "58%", top: "38%" }} />
        <span className="dot ok" style={{ left: "40%", top: "60%" }} />
        <span className="dot far" style={{ left: "88%", top: "14%" }} />
        <span className="lbl">100 m</span>
      </div>
      <div className="lp-geo-note">
        <span className="lp-badge bad">Dari ±3,2 km</span>
        <span className="lp-badge ok">Di dalam toko</span>
      </div>
    </div>
  );
}

function PickupDemo({ on }: { on: boolean }) {
  const nums = [31, 32, 34];
  const [s] = useStepper(nums.length, () => 1800, on);
  const n = nums[on ? s : 2];
  return (
    <div className="lp-pickup">
      <span className="lp-pickup-bag"><ShoppingBag /></span>
      <div className="lp-pickup-board" key={n}>
        <small>Siap diambil</small>
        <b>#{n}</b>
      </div>
    </div>
  );
}

export function BestDemo({ on }: { on: boolean }) {
  const [s] = useStepper(2, () => 2600, on);
  const grid = (on ? s : 1) === 1;
  const items: [string, number, FoodKind, boolean][] = [["Ayam Geprek", 18000, "geprek", true], ["Kopi Susu Aren", 15000, "kopi", true], ["Soto Ayam", 17000, "soto", false], ["Es Jeruk", 8000, "jeruk", false]];
  return (
    <div className="lp-best">
      <div className="lp-best-toggle">
        <span className={grid ? "" : "on"}><List /></span>
        <span className={grid ? "on" : ""}><LayoutGrid /></span>
      </div>
      <div className={`lp-best-list${grid ? " grid" : ""}`}>
        {items.map(([n, p, f, best]) => (
          <div className="lp-best-card" key={n}>
            <div className="th">
              <Food kind={f} />
              {best && <span className="lp-stamp"><ThumbsUp /> Best seller</span>}
            </div>
            <div className="tx"><span>{n}</span><b>{rupiah(p)}</b></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function QrDemo() {
  return (
    <div className="lp-qrdemo">
      <div className="lp-qrbox">
        <FakeQR size={120} />
        <span className="lp-qrlogo"><AppIcon size={30} /></span>
        <span className="lp-scanline" />
      </div>
      <code>/m/k7f3qx2m9a</code>
    </div>
  );
}
