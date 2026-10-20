import { useState } from "react";
import { isRetail, useSession } from "../../lib/session";
import { Download, Star } from "lucide-react";
import { BarChart, HBars } from "../../components/charts";
import { Empty, ErrorState, Loading, PageHead, Segmented } from "../../components/ui";
import { date, number, PAY_LABEL, rupiah, rupiahShort } from "../../lib/format";
import { useApi } from "../../lib/hooks";

interface Report {
  period: { from: string; to: string; days: number; prevFrom: string; prevTo: string; today: string };
  kpi: { omzet: number; orders: number; avg: number; items_sold: number; tax: number; service: number; unpaid: number; unpaid_count: number; cancelled: number; cancelled_value: number };
  prev: { omzet: number; orders: number; avg: number };
  series: { day: string; omzet: number; orders: number }[];
  hours: { hour: number; orders: number; omzet: number }[];
  weekdays: { dow: number; orders: number; omzet: number }[];
  topItems: { name: string; qty: number; revenue: number }[];
  topVariants?: { name: string; variant: string; qty: number; revenue: number }[];
  categories: { name: string; qty: number; revenue: number }[];
  payments: { method: string; orders: number; omzet: number }[];
  sources: { source: string; orders: number; omzet: number }[];
  staff: { name: string; orders: number; omzet: number }[];
  idle: { name: string; price: number }[];
  margins: { id: string; name: string; qty: number; revenue: number; cost: number | null; costed_qty: number }[];
  costCoverage: { total: number; costed: number };
  promo: { discount: number; qty: number };
  feedback: {
    count: number;
    avg: number | null;
    dist: { rating: number; n: number }[];
    recent: { rating: number; comment: string; created_at: number; number: number; customer_name: string; table_label: string | null }[];
    items: { name: string; likes: number; dislikes: number }[];
  };
}

type Klass = "star" | "horse" | "puzzle" | "dog";
const KLASS: Record<Klass, { label: string; tip: string; badge: string }> = {
  star: { label: "Andalan", tip: "Laris dan untungnya besar. Pertahankan kualitas, taruh di urutan atas.", badge: "badge-ok" },
  horse: { label: "Laris tapi tipis", tip: "Banyak dipesan, tapi untung per porsinya (dalam rupiah) kecil. Naikkan harga sedikit, tawarkan ukuran besar, atau jadikan pendamping menu andalan.", badge: "badge-warn" },
  puzzle: { label: "Untung tapi jarang", tip: "Untungnya besar tapi jarang dipesan. Beri foto/video, label Rekomendasi, atau jadikan pasangan menu laris.", badge: "badge-info" },
  dog: { label: "Perlu dievaluasi", tip: "Jarang dipesan dan untungnya kecil. Pertimbangkan diganti atau dihapus.", badge: "badge-danger" },
};

/**
 * Pengelompokan menu ala menu engineering (Kasavana & Smith):
 * laris = terjual minimal 70% dari rata-rata per menu; untung besar = untung per porsi di atas rata-rata tertimbang.
 */
function classify(rows: Report["margins"]) {
  const costed = rows.filter((r) => r.cost != null && r.costed_qty === r.qty && r.qty > 0);
  if (costed.length < 2) return { rows: [], avgMargin: 0 };
  const totalQty = costed.reduce((a, r) => a + r.qty, 0);
  const totalMargin = costed.reduce((a, r) => a + (r.revenue - r.cost!), 0);
  const avgMargin = totalMargin / totalQty;
  const popLine = (totalQty / costed.length) * 0.7;
  return {
    avgMargin,
    rows: costed
      .map((r) => {
        const unit = (r.revenue - r.cost!) / r.qty;
        const pop = r.qty >= popLine;
        const prof = unit >= avgMargin;
        const k: Klass = pop && prof ? "star" : pop ? "horse" : prof ? "puzzle" : "dog";
        return { ...r, unit, pct: r.revenue ? ((r.revenue - r.cost!) / r.revenue) * 100 : 0, k };
      })
      .sort((a, b) => (["star", "horse", "puzzle", "dog"].indexOf(a.k) - ["star", "horse", "puzzle", "dog"].indexOf(b.k)) || b.qty - a.qty),
  };
}

const DOW = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
const DOW_SHORT = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

function Delta({ now, prev, label }: { now: number; prev: number; label: string }) {
  if (!prev) return <span className="delta">Belum ada data {label} untuk dibandingkan</span>;
  const pct = ((now - prev) / prev) * 100;
  const up = pct >= 0;
  return (
    <span className={`delta ${Math.abs(pct) < 0.5 ? "" : up ? "up" : "down"}`}>
      {up ? "Naik" : "Turun"} {Math.abs(pct).toLocaleString("id-ID", { maximumFractionDigits: 1 })}% dari {label}
    </span>
  );
}

export function ReportsPage() {
  const [range, setRange] = useState<"today" | "7" | "30" | "90" | "custom">("7");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const qs = range === "custom" && from && to ? `from=${from}&to=${to}` : `range=${range === "custom" ? "30" : range}`;
  const { data, error, loading, reload } = useApi<Report>(`/api/store/analytics?${qs}`);

  const prevLabel = range === "today" ? "kemarin" : `${data?.period.days ?? ""} hari sebelumnya`;

  return (
    <>
      <PageHead
        title="Laporan penjualan"
        sub={data ? `${date(data.period.from, { day: "numeric", month: "long" })} sampai ${date(data.period.to, { day: "numeric", month: "long", year: "numeric" })}` : "Hanya bisa dilihat pemilik dan manajer."}
        actions={
          data && (
            <a className="btn" href={`/api/store/analytics/export.csv?from=${data.period.from}&to=${data.period.to}`} download>
              <Download /> Unduh CSV
            </a>
          )
        }
      />
      <div className="row wrap" style={{ marginBottom: 18 }}>
        <Segmented
          label="Periode"
          value={range}
          onChange={setRange}
          options={[
            { value: "today", label: "Hari ini" },
            { value: "7", label: "7 hari" },
            { value: "30", label: "30 hari" },
            { value: "90", label: "3 bulan" },
            { value: "custom", label: "Pilih tanggal" },
          ]}
        />
        {range === "custom" && (
          <div className="row wrap">
            <input type="date" className="input" style={{ width: "auto" }} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Dari tanggal" />
            <span className="muted">sampai</span>
            <input type="date" className="input" style={{ width: "auto" }} value={to} onChange={(e) => setTo(e.target.value)} aria-label="Sampai tanggal" />
          </div>
        )}
      </div>

      {error ? (
        <ErrorState message={error.message} onRetry={() => reload()} />
      ) : loading || !data ? (
        <div className="stack">
          <Loading rows={1} height={110} />
          <Loading rows={2} height={240} />
        </div>
      ) : (
        <ReportBody r={data} prevLabel={prevLabel} />
      )}
    </>
  );
}

function ReportBody({ r, prevLabel }: { r: Report; prevLabel: string }) {
  const k = r.kpi;
  const nothing = k.orders === 0 && k.unpaid_count === 0 && k.cancelled === 0;
  if (nothing) {
    return (
      <div className="panel">
        <Empty title="Belum ada penjualan di periode ini">Laporan terisi otomatis begitu ada pesanan yang dibayar.</Empty>
      </div>
    );
  }
  const peakHour = [...r.hours].sort((a, b) => b.orders - a.orders)[0];
  const peakDay = [...r.weekdays].sort((a, b) => b.omzet - a.omzet)[0];
  const best = r.topItems[0];
  const qr = r.sources.find((s) => s.source === "qr");
  const qrShare = k.orders ? Math.round(((qr?.orders ?? 0) / k.orders) * 100) : 0;
  const activeHours = r.hours.filter((h) => h.orders > 0);
  const firstH = activeHours.length ? Math.max(0, activeHours[0].hour - 1) : 6;
  const lastH = activeHours.length ? Math.min(23, activeHours[activeHours.length - 1].hour + 1) : 22;
  const multiDay = r.period.days > 1;

  return (
    <div className="stack" style={{ gap: 20 }}>
      <div className="kpis">
        <div className="kpi hero">
          <span className="label">Omzet (sudah dibayar)</span>
          <span className="value">{rupiah(k.omzet)}</span>
          <Delta now={k.omzet} prev={r.prev.omzet} label={prevLabel} />
        </div>
        <div className="kpi">
          <span className="label">Pesanan</span>
          <span className="value">{number(k.orders)}</span>
          <Delta now={k.orders} prev={r.prev.orders} label={prevLabel} />
        </div>
        <div className="kpi">
          <span className="label">Rata-rata per pesanan</span>
          <span className="value">{rupiah(k.avg)}</span>
          <Delta now={k.avg} prev={r.prev.avg} label={prevLabel} />
        </div>
        <div className="kpi">
          <span className="label">Item terjual</span>
          <span className="value">{number(k.items_sold)}</span>
          <span className="delta">porsi, gelas, dan barang</span>
        </div>
      </div>

      {/* Ringkasan dalam kalimat, untuk pemilik yang tidak mau membaca grafik */}
      <section className="panel" aria-labelledby="sum-title">
        <h2 id="sum-title" style={{ marginBottom: 10 }}>Ringkasnya</h2>
        <ul className="stack-sm" style={{ margin: 0, paddingLeft: 18 }}>
          {best && <li>Paling laku: <strong>{best.name}</strong>, terjual {number(best.qty)} kali ({rupiah(best.revenue)}).</li>}
          {peakHour && peakHour.orders > 0 && <li>Jam paling ramai: <strong>{String(peakHour.hour).padStart(2, "0")}.00 sampai {String((peakHour.hour + 1) % 24).padStart(2, "0")}.00</strong> ({number(peakHour.orders)} pesanan).</li>}
          {multiDay && peakDay && peakDay.omzet > 0 && r.period.days >= 7 && <li>Hari dengan omzet terbesar: <strong>{DOW[peakDay.dow]}</strong>.</li>}
          {k.orders > 0 && <li>{qrShare}% pesanan datang dari QR meja, sisanya dicatat di kasir.</li>}
          {k.unpaid_count > 0 && <li style={{ color: "var(--warn-text)" }}>Ada {number(k.unpaid_count)} pesanan belum dibayar senilai <strong>{rupiah(k.unpaid)}</strong>. Cek di halaman Pesanan.</li>}
          {k.cancelled > 0 && <li>{number(k.cancelled)} pesanan dibatalkan ({rupiah(k.cancelled_value)}).</li>}
          {(k.tax > 0 || k.service > 0) && <li>Termasuk di omzet: pajak {rupiah(k.tax)} dan service {rupiah(k.service)}.</li>}
          {r.promo.discount > 0 && <li>Potongan promo jam tertentu: {rupiah(r.promo.discount)} untuk {number(r.promo.qty)} item.</li>}
          {r.feedback.count > 0 && r.feedback.avg != null && <li>Rata-rata penilaian pembeli: <strong>{r.feedback.avg.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} dari 5</strong> ({number(r.feedback.count)} penilaian).</li>}
        </ul>
      </section>

      {multiDay && (
        <section className="panel" aria-labelledby="daily-title">
          <div className="panel-head">
            <div>
              <h2 id="daily-title">Omzet per hari</h2>
              <p>Arahkan kursor atau ketuk batang untuk melihat angkanya.</p>
            </div>
          </div>
          <BarChart
            ariaLabel="Grafik omzet per hari"
            formatAxis={rupiahShort}
            data={r.series.map((d) => ({
              key: d.day,
              value: d.omzet,
              label: date(d.day, { day: "numeric", ...(r.period.days > 31 ? { month: "short" } : {}) }),
              highlight: d.day === r.period.today,
              tip: (
                <>
                  <strong>{rupiah(d.omzet)}</strong>
                  {date(d.day, { weekday: "long", day: "numeric", month: "short" })} · {d.orders} pesanan
                </>
              ),
            }))}
          />
        </section>
      )}

      <div className="grid-2">
        <section className="panel" aria-labelledby="hour-title">
          <div className="panel-head">
            <div>
              <h2 id="hour-title">Jam ramai</h2>
              <p>Jumlah pesanan per jam. Pakai untuk mengatur jadwal karyawan.</p>
            </div>
          </div>
          <BarChart
            ariaLabel="Grafik jumlah pesanan per jam"
            height={200}
            formatAxis={(v) => number(Math.round(v))}
            labelEvery={2}
            data={r.hours.slice(firstH, lastH + 1).map((h) => ({
              key: String(h.hour),
              value: h.orders,
              label: String(h.hour).padStart(2, "0"),
              highlight: h.hour === peakHour?.hour,
              tip: (
                <>
                  <strong>{number(h.orders)} pesanan</strong>
                  Jam {String(h.hour).padStart(2, "0")}.00 · {rupiah(h.omzet)}
                </>
              ),
            }))}
          />
        </section>
        {r.period.days >= 7 ? (
          <section className="panel" aria-labelledby="dow-title">
            <div className="panel-head">
              <div>
                <h2 id="dow-title">Hari ramai</h2>
                <p>Total omzet per hari dalam seminggu.</p>
              </div>
            </div>
            <BarChart
              ariaLabel="Grafik omzet per hari dalam seminggu"
              height={200}
              formatAxis={rupiahShort}
              data={r.weekdays.map((w) => ({
                key: String(w.dow),
                value: w.omzet,
                label: DOW_SHORT[w.dow],
                highlight: w.dow === peakDay?.dow,
                tip: (
                  <>
                    <strong>{rupiah(w.omzet)}</strong>
                    {DOW[w.dow]} · {number(w.orders)} pesanan
                  </>
                ),
              }))}
            />
          </section>
        ) : (
          <section className="panel" aria-labelledby="pay-title-1">
            <div className="panel-head"><h2 id="pay-title-1">Cara bayar</h2></div>
            <HBars format={rupiah} rows={r.payments.map((p) => ({ key: p.method, name: PAY_LABEL[p.method] ?? p.method, value: p.omzet, extra: `· ${p.orders}x` }))} />
          </section>
        )}
      </div>

      <div className="grid-2">
        <TopSection r={r} />
        <div className="stack" style={{ gap: 20 }}>
          <section className="panel" aria-labelledby="cat-title">
            <div className="panel-head"><h2 id="cat-title">Per kategori</h2></div>
            <HBars format={rupiah} rows={r.categories.map((c) => ({ key: c.name, name: c.name, value: c.revenue }))} />
          </section>
          {r.period.days >= 7 && (
            <section className="panel" aria-labelledby="pay-title">
              <div className="panel-head"><h2 id="pay-title">Cara bayar</h2></div>
              <HBars format={rupiah} rows={r.payments.map((p) => ({ key: p.method, name: PAY_LABEL[p.method] ?? p.method, value: p.omzet, extra: `· ${p.orders}x` }))} />
            </section>
          )}
        </div>
      </div>

      <div className="grid-2">
        <section className="panel" aria-labelledby="staff-title">
          <div className="panel-head">
            <div>
              <h2 id="staff-title">Pembayaran diterima oleh</h2>
              <p>Membantu mencocokkan uang di laci dengan catatan.</p>
            </div>
          </div>
          {r.staff.length === 0 ? (
            <p className="muted small">Belum ada data.</p>
          ) : (
            <HBars format={rupiah} rows={r.staff.map((s) => ({ key: s.name, name: s.name, value: s.omzet, extra: `· ${s.orders}x` }))} />
          )}
        </section>
        <section className="panel" aria-labelledby="idle-title">
          <div className="panel-head">
            <div>
              <h2 id="idle-title">Tidak terjual di periode ini</h2>
              <p>Pertimbangkan diganti, diberi foto/video, atau dijadikan paket.</p>
            </div>
          </div>
          {r.idle.length === 0 ? (
            <p className="muted small">Semua menu terjual minimal sekali.</p>
          ) : (
            <div className="stack-sm">
              {r.idle.map((i) => (
                <div key={i.name} className="row between small" style={{ borderTop: "1px solid var(--line)", paddingTop: 6 }}>
                  <span>{i.name}</span>
                  <span className="money muted">{rupiah(i.price)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <MarginSection r={r} />
      <FeedbackSection r={r} />
    </div>
  );
}

/** Terlaris per produk, atau per ukuran/warna kalau tokonya memakai varian. */
function TopSection({ r }: { r: Report }) {
  const { tenant } = useSession();
  const retail = isRetail(tenant);
  const hasV = (r.topVariants?.length ?? 0) > 0;
  const [by, setBy] = useState<"item" | "variant">("item");
  const rows = by === "variant" && hasV ? r.topVariants!.map((v) => ({ name: v.name, sub: v.variant, qty: v.qty, revenue: v.revenue })) : r.topItems.map((t) => ({ name: t.name, sub: "", qty: t.qty, revenue: t.revenue }));
  return (
    <section className="panel flush" aria-labelledby="top-title">
      <div className="row between wrap" style={{ padding: "18px 18px 6px", gap: 8 }}>
        <h2 id="top-title">{retail ? "Produk terlaris" : "Menu terlaris"}</h2>
        {hasV && (
          <div className="segmented" role="group" aria-label="Kelompokkan">
            <button type="button" aria-pressed={by === "item"} onClick={() => setBy("item")}>Per produk</button>
            <button type="button" aria-pressed={by === "variant"} onClick={() => setBy("variant")}>Per varian</button>
          </div>
        )}
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>#</th><th>{retail ? "Produk" : "Menu"}</th><th className="r">Terjual</th><th className="r">Pendapatan</th></tr>
          </thead>
          <tbody>
            {rows.map((t, i) => (
              <tr key={`${i}-${t.name}-${t.sub}`}>
                <td className="num muted">{i + 1}</td>
                <td className="strong">{t.name}{t.sub && <span className="variant-tag">{t.sub}</span>}</td>
                <td className="r num">{number(t.qty)}</td>
                <td className="r money">{rupiah(t.revenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MarginSection({ r }: { r: Report }) {
  const { rows, avgMargin } = classify(r.margins);
  const costedRows = r.margins.filter((m) => m.cost != null);
  const revenue = costedRows.reduce((a, m) => a + m.revenue, 0);
  const cost = costedRows.reduce((a, m) => a + (m.cost ?? 0), 0);
  const cov = r.costCoverage;
  const { tenant } = useSession();
  const retail = isRetail(tenant);
  const noun = retail ? "produk" : "menu";
  const unit = retail ? "pcs" : "porsi";
  return (
    <section className="panel flush" aria-labelledby="margin-title">
      <div style={{ padding: "18px 18px 8px" }}>
        <h2 id="margin-title">Untung per {noun}</h2>
        <p className="small muted">
          Dari modal (HPP) yang diisi di Menu & produk. Sudah diisi untuk {cov.costed} dari {cov.total} {noun}.
          {cov.costed < cov.total ? ` ${retail ? "Produk" : "Menu"} yang belum diisi tidak ikut dihitung.` : ""}
        </p>
      </div>
      {costedRows.length === 0 ? (
        <div style={{ padding: "0 18px 18px" }}>
          <p className="small">Isi modal per {unit} di halaman {retail ? "Produk" : "Menu & produk"} (kolom "Modal per {unit}"), lalu laporan ini menunjukkan {noun} mana yang laris tapi untungnya tipis.</p>
        </div>
      ) : (
        <>
          <div className="kpis" style={{ padding: "0 18px 12px" }}>
            <div className="kpi"><span className="label">Penjualan {noun} ber-HPP</span><span className="value">{rupiah(revenue)}</span></div>
            <div className="kpi"><span className="label">Modal</span><span className="value">{rupiah(cost)}</span></div>
            <div className="kpi hero"><span className="label">Laba kotor</span><span className="value">{rupiah(revenue - cost)}</span><span className="delta">{revenue ? Math.round(((revenue - cost) / revenue) * 100) : 0}% dari penjualan, sebelum pajak, gaji, dan sewa</span></div>
          </div>
          {rows.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr><th>{retail ? "Produk" : "Menu"}</th><th>Kelompok</th><th className="r">Terjual</th><th className="r">Untung/{unit}</th><th className="r">Margin</th><th className="r">Laba kotor</th></tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id}>
                      <td className="strong">{m.name}</td>
                      <td><span className={`badge ${KLASS[m.k].badge}`} title={KLASS[m.k].tip}>{KLASS[m.k].label}</span></td>
                      <td className="r num">{number(m.qty)}</td>
                      <td className="r money">{rupiah(Math.round(m.unit))}</td>
                      <td className="r num">{Math.round(m.pct)}%</td>
                      <td className="r money">{rupiah(m.revenue - (m.cost ?? 0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > 0 && (
            <ul className="klass-legend">
              {(Object.keys(KLASS) as Klass[]).filter((k) => rows.some((x) => x.k === k)).map((k) => (
                <li key={k}><span className={`badge ${KLASS[k].badge}`}>{KLASS[k].label}</span> {KLASS[k].tip}</li>
              ))}
              <li className="muted">Rata-rata untung per {unit}: {rupiah(Math.round(avgMargin))}.</li>
            </ul>
          )}
        </>
      )}
    </section>
  );
}

function FeedbackSection({ r }: { r: Report }) {
  const f = r.feedback;
  return (
    <section className="panel" aria-labelledby="fb-title">
      <div className="panel-head">
        <div>
          <h2 id="fb-title">Penilaian pembeli</h2>
          <p>Dari halaman pesanan/struk digital setelah makan. Nilai rendah juga masuk ke sini, tidak disaring.</p>
        </div>
      </div>
      {f.count === 0 ? (
        <p className="small muted">Belum ada penilaian di periode ini. Pembeli bisa menilai dari halaman status pesanan QR, atau dari tautan struk yang dikirim kasir lewat WhatsApp.</p>
      ) : (
        <div className="grid-2">
          <div className="stack" style={{ alignContent: "start" }}>
            <div className="row" style={{ gap: 10, alignItems: "baseline" }}>
              <span className="fb-avg num">{f.avg?.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
              <span className="muted">dari 5 · {number(f.count)} penilaian</span>
            </div>
            <HBars format={(v) => `${v}`} rows={[...f.dist].reverse().map((d) => ({ key: String(d.rating), name: `${d.rating} bintang`, value: d.n }))} />
            {f.items.length > 0 && (
              <div className="stack-sm">
                <h3>Per menu</h3>
                {f.items.slice(0, 8).map((i) => {
                  const pct = Math.round((i.likes / (i.likes + i.dislikes)) * 100);
                  return (
                    <div key={i.name} className="row between small" style={{ borderTop: "1px solid var(--line)", paddingTop: 6 }}>
                      <span>{i.name}</span>
                      <span className={pct < 60 ? "strong" : "muted"} style={pct < 60 ? { color: "var(--danger)" } : undefined}>{pct}% suka · {i.likes + i.dislikes} nilai</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div className="stack-sm" style={{ alignContent: "start" }}>
            <h3>Catatan terbaru</h3>
            {f.recent.length === 0 ? (
              <p className="small muted">Belum ada catatan.</p>
            ) : (
              f.recent.map((c, i) => (
                <div key={i} className="fb-note">
                  <span className="fb-stars" aria-label={`${c.rating} dari 5`}>
                    {Array.from({ length: 5 }, (_, k) => <Star key={k} aria-hidden="true" className={k < c.rating ? "on" : ""} />)}
                  </span>
                  {c.comment ? <p>{c.comment}</p> : <p className="muted small">Tanpa catatan.</p>}
                  <span className="tiny muted">#{c.number}{c.table_label ? ` · ${c.table_label}` : ""}{c.customer_name ? ` · ${c.customer_name}` : ""} · {date(c.created_at, { day: "numeric", month: "short" })}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </section>
  );
}
