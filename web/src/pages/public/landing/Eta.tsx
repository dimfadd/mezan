import { useRef } from "react";
import { Check, ChefHat, Timer } from "lucide-react";
import { Card } from "./Extras";
import { useReducedMotion, useStepper, useVisible } from "./motion";

// Antrean dapur di layar kasir dan halaman pesanan di HP pembeli, bergerak bersama.
// Angka menit mengikuti cara hitung aplikasi: waktu saji menu + pesanan di depan.
const KITCHEN = [
  { no: 21, who: "Meja 2", item: "2× Nasi Goreng" },
  { no: 22, who: "Bawa pulang", item: "1× Mie Ayam" },
  { no: 23, who: "Meja 5", item: "3× Ayam Geprek" },
  { no: 24, who: "Meja 7 · Sari", item: "2× Ayam Geprek, 2× Es Teh", me: true },
];
// Keadaan HP per langkah: antrean, pesanan di depan, rentang menit, pukul.
const FRAMES = [
  { pos: 4, ahead: 3, range: "16–22", at: "13.04", pct: 8 },
  { pos: 3, ahead: 2, range: "12–17", at: "13.03", pct: 30 },
  { pos: 2, ahead: 1, range: "8–12", at: "13.01", pct: 52 },
  { pos: 1, ahead: 0, range: "4–7", at: "12.58", pct: 78 },
  { pos: 0, ahead: 0, range: "", at: "", pct: 100 },
];

export function EtaSpotlight() {
  const root = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const visible = useVisible(root, 0.2);
  const on = visible && !reduce;
  return (
    <div ref={root} className={`lp-bento${on ? "" : " is-still"}`}>
      <Card
        className="span3"
        icon={<Timer />}
        title="Antrean ke-berapa, siap jam berapa"
        body="Begitu pesanan masuk, HP pembeli menunjukkan posisinya di antrean dapur dan perkiraan siap dalam menit. Angkanya bergerak sendiri setiap kali dapur menyelesaikan pesanan di depannya, jadi tidak ada lagi yang bolak-balik bertanya ke kasir."
      >
        <EtaDemo on={on} />
      </Card>
    </div>
  );
}

export function EtaDemo({ on }: { on: boolean }) {
  const [s] = useStepper(FRAMES.length, (i) => [2200, 1900, 1900, 2300, 3400][i], on);
  // Gerak dikurangi: tampilkan keadaan tengah yang paling menjelaskan (antrean ke-2).
  const step = on ? s : 2;
  const f = FRAMES[step];
  const ready = f.pos === 0;
  return (
    <div className="lp-eta">
      <div className={`lp-eta-phone${ready ? " ready" : ""}`}>
        <small>Warung Contoh · Meja 7</small>
        <b className="lp-eta-no">Pesanan #24</b>
        {ready ? (
          <div className="lp-eta-ready" key="r">
            <span className="ic"><Check /></span>
            <b>Siap diantar</b>
            <span>Sebentar lagi sampai di meja.</span>
          </div>
        ) : (
          <div className="lp-eta-box" key={step}>
            <div className="top">
              <span className="pill num">Antrean ke-{f.pos}</span>
              <span className="ahead">{f.ahead === 0 ? "Sedang dimasak" : `${f.ahead} pesanan di depanmu`}</span>
            </div>
            <span className="lbl"><Timer /> Perkiraan siap</span>
            <b className="big num">{f.range} menit</b>
            <span className="at">sekitar pukul {f.at}</span>
          </div>
        )}
        <div className="lp-eta-bar"><span style={{ width: `${f.pct}%` }} /></div>
      </div>
      <div className="lp-call-arrow" />
      <div className="lp-eta-board">
        <small><ChefHat /> Layar dapur</small>
        {KITCHEN.map((k, i) => {
          const done = i < step;
          const cooking = !done && (i === step || (i === step + 1 && step < 3));
          return (
            <div className={`lp-eta-row${done ? " done" : ""}${k.me ? " me" : ""}`} key={k.no}>
              <b className="num">#{k.no}</b>
              <span className="nm">
                {k.who}
                <em>{k.item}</em>
              </span>
              {done ? (
                <span className="lp-badge ok"><Check /> Siap</span>
              ) : cooking ? (
                <span className="lp-badge warn">Dimasak</span>
              ) : (
                <span className="lp-badge">Antre</span>
              )}
            </div>
          );
        })}
        <span className="foot">2 pesanan dimasak bersamaan</span>
      </div>
    </div>
  );
}
