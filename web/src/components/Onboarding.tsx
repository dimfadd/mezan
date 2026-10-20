import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, X } from "lucide-react";
import { useApi } from "../lib/hooks";
import { isManagement, isRetail, useSession } from "../lib/session";

interface Progress {
  items: number;
  tables: number;
  qrOrders: number;
  firstTableCode: string | null;
  qrEnabled: boolean;
  orders: number;
  barcodes: number;
}

const KEY = (id: string) => `pesanin-onboard-hide-${id}`;

/**
 * Panduan tiga langkah untuk toko baru, tampil di halaman Pesanan untuk pemilik/manajer.
 * Langkah tercentang sendiri dari data toko; kartu hilang setelah semuanya selesai atau ditutup.
 */
export function Onboarding() {
  const { tenant, user } = useSession();
  const show = !!tenant && isManagement(user?.role);
  const [hidden, setHidden] = useState(() => {
    try {
      return !!tenant && localStorage.getItem(KEY(tenant.id)) === "1";
    } catch {
      return false;
    }
  });
  const { data } = useApi<Progress>(show && !hidden ? "/api/store/onboarding" : null);
  if (!show || hidden || !data || !tenant) return null;
  const steps = isRetail(tenant) ? [
    { done: data.items > 0, title: "Isi produk", body: "Nama, harga, dan stok. Ukuran dan warna dibuat sebagai varian.", to: "/toko/menu", cta: "Buka Produk" },
    { done: data.barcodes > 0, title: "Pasang barcode", body: "Scan barcode kemasan, atau buat kode toko lalu cetak labelnya.", to: "/toko/menu", cta: "Buka Produk" },
    { done: data.orders > 0, title: "Coba jual di Kasir", body: "Scan barang atau ketuk produknya, lalu terima pembayaran.", to: "/toko/kasir", cta: "Buka Kasir" },
  ] : [
    { done: data.items > 0, title: "Isi menu", body: "Nama, harga, dan foto. Bisa langsung dari kamera HP.", to: "/toko/menu", cta: "Buka Menu & produk" },
    { done: data.tables > 0, title: "Tambah meja & cetak QR", body: "Buat beberapa meja sekaligus, lalu cetak semua QR-nya.", to: "/toko/meja", cta: "Buka Meja & QR" },
    {
      done: data.qrOrders > 0,
      title: "Coba pesan dari HP",
      body: "Pindai QR meja dengan HP-mu sendiri dan kirim satu pesanan. Pesanannya akan berbunyi di halaman ini.",
      to: data.firstTableCode ? `/m/${data.firstTableCode}` : "/toko/meja",
      cta: data.firstTableCode ? "Buka menu QR" : "Buat meja dulu",
      external: !!data.firstTableCode,
    },
  ];
  const left = steps.filter((s) => !s.done).length;
  if (left === 0) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY(tenant.id), "1");
    } catch {
      /* abaikan */
    }
    setHidden(true);
  };
  return (
    <section className="onb panel" aria-labelledby="onb-h">
      <div className="onb-head">
        <div>
          <h2 id="onb-h">Mulai jualan dalam 3 langkah</h2>
          <p className="small muted">{3 - left} dari 3 selesai. Fitur lain bisa dinyalakan nanti, pelan-pelan.</p>
        </div>
        <button type="button" className="icon-btn" aria-label="Sembunyikan panduan" onClick={close}><X /></button>
      </div>
      <div className="onb-bar" aria-hidden="true"><span style={{ width: `${((3 - left) / 3) * 100}%` }} /></div>
      <ol className="onb-steps">
        {steps.map((s, i) => (
          <li key={s.title} className={s.done ? "done" : ""}>
            <span className="onb-dot">{s.done ? <Check aria-hidden="true" /> : i + 1}</span>
            <div>
              <b>{s.title}</b>
              <p className="small muted">{s.done ? "Selesai." : s.body}</p>
              {!s.done && (s.external ? (
                <a className="btn btn-sm" href={s.to} target="_blank" rel="noreferrer">{s.cta}</a>
              ) : (
                <Link className="btn btn-sm" to={s.to}>{s.cta}</Link>
              ))}
            </div>
          </li>
        ))}
      </ol>
      {!isRetail(tenant) && !data.qrEnabled && <p className="tiny muted">Pesan lewat QR sedang dimatikan di Pengaturan. Nyalakan supaya pembeli bisa memesan dari meja.</p>}
    </section>
  );
}
