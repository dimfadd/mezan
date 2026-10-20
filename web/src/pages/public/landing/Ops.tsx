import { useEffect, useRef, useState } from "react";
import { Calculator, Check, ChefHat, Clock3, MapPin, ReceiptText, ScanLine, Sparkles, ThumbsUp, Wallet, Wifi, WifiOff } from "lucide-react";
import { AppIcon } from "./art";
import { HappyDemo, PairDemo } from "./MoreDemos";
import { BillDemo, RetailDemo } from "./RetailDemos";
import { rupiah } from "../../../lib/format";
import { BestDemo, Card, GeoDemo, QrDemo } from "./Extras";
import { useCountUp, useReducedMotion, useStepper, useVisible } from "./motion";

// Sisi pemilik: yang menambah untung dulu, lalu yang menjaga dapur, laci, dan pesanan tetap rapi.
export function Ops() {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const visible = useVisible(root, 0.15);
  const on = visible && !reduce;
  return (
    <div ref={root} className={`lp-bento${on ? "" : " is-still"}`}>
      <Card className="span2" icon={<ScanLine />} title="Toko barang: varian & scan barcode" body="Kaos, kemeja, topi, sampai kelontong. Tiap ukuran dan warna punya harga, stok, dan barcode sendiri. Scan pakai alat scan atau kamera HP; belum ada barcode? Buat kodenya dan cetak labelnya.">
        <RetailDemo on={on} />
      </Card>
      <Card icon={<ReceiptText />} title="Makan dulu, bayar belakangan" body="Pesanan satu meja terkumpul jadi satu tagihan dan dibayar sekali. Tagihan yang sudah lama belum dibayar ditandai merah supaya tidak ada tamu yang lupa bayar.">
        <BillDemo on={on} />
      </Card>
      <Card className="span2" icon={<Calculator />} title="Modal & untung per menu" body="Isi modal per porsi. Laporan memilah menu jadi Andalan, Laris tapi tipis, Untung tapi jarang, dan Perlu dievaluasi, lengkap dengan persentase untungnya.">
        <MarginDemo on={on} />
      </Card>
      <Card icon={<Sparkles />} title="Saran pasangan menu" body="Pesan ayam geprek, muncul es teh. Pasangannya bisa diatur pemilik, atau diambil dari menu yang sering dipesan bareng.">
        <PairDemo on={on} />
      </Card>
      <Card className="span2" icon={<Clock3 />} title="Menu & harga ikut jam" body="Menu sarapan hanya bisa dipesan pagi. Happy hour memotong harga sendiri pada jamnya, di menu QR dan di kasir.">
        <HappyDemo on={on} />
      </Card>
      <Card icon={<ThumbsUp />} title="Best seller & tampilan kotak" body="Stempel jempol untuk menu terlaris. Pembeli bebas pilih tampilan daftar atau kotak.">
        <BestDemo on={on} />
      </Card>
      <Card className="span2" icon={<ChefHat />} title="Layar dapur per bagian" body="Makanan masuk ke layar dapur, minuman ke bar. Waktu tunggu berubah warna kalau lewat perkiraan saji. Begitu semua item dicentang, pesanan otomatis jadi Siap diantar.">
        <KdsDemo on={on} />
      </Card>
      <Card icon={<WifiOff />} title="Kasir tetap jalan saat internet putus" body="Pesanan disimpan di perangkat dan dikirim sendiri begitu sinyal kembali, lalu dapat nomor antrean. Pesanan QR dari pembeli tetap butuh internet.">
        <OfflineDemo on={on} />
      </Card>
      <Card icon={<Wallet />} title="Shift kasir & rekap laci" body="Buka dengan modal awal, catat kas masuk dan keluar, hitung uang saat tutup. Selisihnya langsung terlihat, lengkap dengan siapa yang bertugas.">
        <ShiftDemo on={on} />
      </Card>
      <Card icon={<MapPin />} title="Pengaman lokasi" body="Pesanan dari luar radius toko ditandai atau ditolak. QR yang difoto lalu dipakai dari rumah tidak lolos diam-diam.">
        <GeoDemo />
      </Card>
      <Card icon={<AppIcon size={18} />} title="QR berlogo pesan.in" body="Kode acak per meja yang tidak bisa ditebak, dengan logo di tengah dan tetap terbaca kamera HP biasa.">
        <QrDemo />
      </Card>
    </div>
  );
}

/** Detik yang berjalan selama animasi aktif, untuk jam tunggu di layar dapur. */
function useSeconds(on: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = window.setInterval(() => setN((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, [on]);
  return n;
}

const mmss = (sec: number) => `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;

interface KTicket {
  no: number;
  table: string;
  base: number; // detik sejak diterima
  prep: number; // menit, perkiraan saji paling lama di bagian ini
  items: { q: number; n: string; doneAt?: number }[];
}

function KdsScreen({ station, tickets, step, sec, on }: { station: "Dapur" | "Bar"; tickets: KTicket[]; step: number; sec: number; on: boolean }) {
  return (
    <div className="lp-kds">
      <div className="lp-kds-seg">
        {["Semua", "Dapur", "Bar"].map((x) => <span key={x} className={x === station ? "on" : ""}>{x}</span>)}
      </div>
      {tickets.map((t) => {
        const el = t.base + sec;
        const done = t.items.every((i) => i.doneAt != null && step >= i.doneAt);
        const tone = el > t.prep * 120 ? "bad" : el > t.prep * 60 ? "warn" : "";
        return (
          <div className={`lp-kds-t${done ? " done" : ""}`} key={t.no}>
            <div className="lp-kds-top">
              <b className="num">#{t.no}</b>
              <span className="tb">{t.table}</span>
              {done ? <span className="lp-badge ok"><Check /> Selesai</span> : <span className={`lp-timer ${tone}`}>{mmss(el)}</span>}
            </div>
            {t.items.map((i) => {
              const ticked = i.doneAt != null && step >= i.doneAt;
              return (
                <div className={`lp-kds-i${ticked ? " ticked" : ""}`} key={i.n}>
                  <span className="box">{ticked && <Check />}</span>
                  <span className="q num">{i.q}×</span>
                  <span className="n">{i.n}</span>
                  {on && i.doneAt === step + 1 && <span className="lp-tap" style={{ left: 18, animationDelay: "700ms" }} />}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function KdsDemo({ on }: { on: boolean }) {
  const [s] = useStepper(4, (i) => [1700, 1500, 1500, 3200][i], on);
  const step = on ? s : 3;
  const sec = useSeconds(on);
  const kitchen: KTicket[] = [
    { no: 21, table: "Meja 2", base: 785, prep: 10, items: [{ q: 1, n: "Nasi Goreng Kampung" }] },
    { no: 23, table: "Meja 4", base: 271, prep: 12, items: [{ q: 1, n: "Ayam Geprek", doneAt: 2 }, { q: 1, n: "Soto Ayam", doneAt: 3 }] },
  ];
  const bar: KTicket[] = [
    { no: 23, table: "Meja 4", base: 271, prep: 3, items: [{ q: 2, n: "Es Teh Manis", doneAt: 1 }] },
    { no: 24, table: "Meja 7", base: 48, prep: 5, items: [{ q: 1, n: "Kopi Susu Gula Aren" }] },
  ];
  return (
    <div className="lp-kds-wrap">
      <div className="lp-kds-pair">
        <KdsScreen station="Dapur" tickets={kitchen} step={step} sec={sec} on={on} />
        <KdsScreen station="Bar" tickets={bar} step={step} sec={sec} on={on} />
      </div>
      <div className="lp-kds-status">
        <span><b className="num">#23</b> Meja 4</span>
        {step >= 3 ? (
          <span className="lp-badge new" key="r">Siap diantar</span>
        ) : (
          <span className="lp-badge">Sedang dibuat · {[0, 1, 2].filter((k) => k < step).length}/3 item selesai</span>
        )}
      </div>
    </div>
  );
}

function OfflineDemo({ on }: { on: boolean }) {
  const [s] = useStepper(6, (i) => [1400, 1200, 1000, 1000, 2200, 2800][i], on);
  const step = on ? s : 4;
  const offline = step >= 1 && step <= 4;
  const waiting = offline ? step - 1 : 0;
  const synced = step === 5;
  const rows = [
    { tmp: "Offline 1", no: 41, total: 23000 },
    { tmp: "Offline 2", no: 42, total: 15000 },
    { tmp: "Offline 3", no: 43, total: 38000 },
  ];
  const shown = synced ? 3 : waiting;
  return (
    <div className="lp-off">
      <div className="lp-off-h">
        <b>Kasir</b>
        {offline ? (
          <span className="lp-badge warn"><WifiOff /> Offline{waiting ? ` · ${waiting} pesanan menunggu dikirim` : ""}</span>
        ) : (
          <span className="lp-badge ok"><Wifi /> Online</span>
        )}
      </div>
      <div className="lp-off-list">
        <div className="lp-off-row old">
          <b className="num">#40</b>
          <span>{rupiah(22000)} · Tunai</span>
          <Check />
        </div>
        {rows.slice(0, shown).map((r) => (
          <div className={`lp-off-row${synced ? " sent" : " wait"}`} key={r.tmp}>
            <b className="num">{synced ? `#${r.no}` : r.tmp}</b>
            <span>{rupiah(r.total)} · Tunai</span>
            {synced ? <Check /> : <WifiOff />}
          </div>
        ))}
      </div>
      {synced && (
        <div className="lp-off-toast">
          <Check /> 3 pesanan offline terkirim
        </div>
      )}
    </div>
  );
}

function ShiftDemo({ on }: { on: boolean }) {
  const [s] = useStepper(5, (i) => [1100, 1900, 1500, 1700, 3200][i], on);
  const step = on ? s : 4;
  const sales = useCountUp(step >= 1 ? 1070000 : 0, on, 1500);
  const salesShown = on ? sales : 1070000;
  const out = step >= 2 ? 20000 : 0;
  const expected = 200000 + salesShown - out;
  const counted = useCountUp(step >= 3 ? 1245000 : 0, on, 1100);
  const countedShown = on ? counted : 1245000;
  const closed = step === 4;
  return (
    <div className="lp-shift">
      <div className="lp-shift-h">
        <span>
          <b>Shift pagi</b>
          <small>Dibuka Rina, 07.02{closed ? " · ditutup Rina, 15.04" : ""}</small>
        </span>
        <span className={`lp-badge${closed ? "" : " ok"}`}>{closed ? "Ditutup" : "Buka"}</span>
      </div>
      <div className="lp-shift-row"><span>Modal awal</span><b>{rupiah(200000)}</b></div>
      <div className="lp-shift-row"><span>Penjualan tunai</span><b>+{rupiah(salesShown)}</b></div>
      <div className={`lp-shift-row${step >= 2 ? "" : " pending"}`}><span>Kas keluar · beli es batu</span><b>−{rupiah(20000)}</b></div>
      <div className="lp-shift-row tot"><span>Seharusnya di laci</span><b>{rupiah(expected)}</b></div>
      <div className={`lp-shift-row counted${step >= 3 ? "" : " pending"}`}><span>Uang dihitung</span><b>{rupiah(countedShown)}</b></div>
      <div className={`lp-shift-diff${closed ? "" : " pending"}`}>Selisih: kurang {rupiah(5000)}</div>
    </div>
  );
}

const QUADS = [
  { key: "puzzle", name: "Untung tapi jarang", tone: "info", items: [["Teh Tarik", 72]], tip: "Beri foto atau video, jadikan rekomendasi." },
  { key: "star", name: "Andalan", tone: "ok", items: [["Kopi Susu Gula Aren", 68], ["Ayam Geprek", 54]], tip: "Pertahankan, taruh paling atas di menu." },
  { key: "dog", name: "Perlu dievaluasi", tone: "bad", items: [["Mie Ayam Bakso", 22]], tip: "Ganti resepnya, jadikan paket, atau hapus." },
  { key: "horse", name: "Laris tapi tipis", tone: "warn", items: [["Nasi Goreng Kampung", 31]], tip: "Naikkan harga sedikit atau tekan modal." },
] as const;
// Urutan sorotan: Andalan dulu, baru yang lain.
const ORDER = [1, 3, 0, 2];

function MarginDemo({ on }: { on: boolean }) {
  const [s] = useStepper(5, (i) => (i === 0 ? 2200 : 2000), on);
  const step = on ? s : 1;
  const cost = useCountUp(step === 0 ? 0 : 4800, on, 1200);
  const costShown = on ? cost : 4800;
  const hi = step === 0 ? -1 : ORDER[step - 1];
  return (
    <div className="lp-margin">
      <div className="lp-margin-edit">
        <b>Kopi Susu Gula Aren</b>
        <div className="lp-shift-row"><span>Harga jual</span><b>{rupiah(15000)}</b></div>
        <div className="lp-shift-row field"><span>Modal per gelas</span><b>{rupiah(costShown)}</b></div>
        <div className={`lp-shift-row tot${costShown === 4800 ? "" : " pending"}`}>
          <span>Untung</span>
          <b>{rupiah(15000 - 4800)} · 68%</b>
        </div>
      </div>
      <div className="lp-quad-wrap">
        <div className="lp-quad">
          {QUADS.map((q, i) => (
            <div className={`lp-quad-cell${hi === i ? " hi" : ""}`} key={q.key}>
              <span className={`lp-badge ${q.tone}`}>{q.name}</span>
              {q.items.map(([n, m]) => (
                <div className="lp-quad-item" key={n}>
                  <span>{n}</span>
                  <b className="num">{m}%</b>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="lp-quad-axis y">Untung per porsi</div>
        <div className="lp-quad-axis x">Terjual</div>
        <p className="lp-quad-tip">{hi >= 0 ? QUADS[hi].tip : "Persentase untung per menu muncul begitu modalnya diisi."}</p>
      </div>
    </div>
  );
}
