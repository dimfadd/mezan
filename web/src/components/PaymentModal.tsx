import { useEffect, useState } from "react";
import { Modal, MoneyInput, Segmented } from "./ui";
import { rupiah } from "../lib/format";

export type PayMethod = "cash" | "qris" | "transfer" | "card";

export function PaymentModal({
  open,
  total,
  title = "Terima pembayaran",
  busy,
  onClose,
  onPay,
}: {
  open: boolean;
  total: number;
  title?: string;
  busy?: boolean;
  onClose: () => void;
  onPay: (p: { method: PayMethod; amountReceived: number | null }) => void;
}) {
  const [method, setMethod] = useState<PayMethod>("cash");
  const [received, setReceived] = useState<number | "">("");
  useEffect(() => {
    if (open) {
      setMethod("cash");
      setReceived("");
    }
  }, [open]);
  const cash = method === "cash";
  const amount = received === "" ? null : received;
  const short = cash && amount != null && amount < total;
  const change = cash && amount != null && amount >= total ? amount - total : null;
  // Pecahan uang yang wajar di atas total, untuk tombol cepat.
  const quick = [total, ...[10000, 20000, 50000, 100000].map((d) => Math.ceil(total / d) * d)]
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 4);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Batal
          </button>
          <button
            className="btn btn-primary btn-lg"
            disabled={busy || short}
            onClick={() => onPay({ method, amountReceived: cash ? amount : null })}
          >
            {busy ? "Menyimpan..." : `Lunas ${rupiah(total)}`}
          </button>
        </>
      }
    >
      <div className="stack">
        <div className="sum-row total">
          <span>Total tagihan</span>
          <span className="money">{rupiah(total)}</span>
        </div>
        <Segmented<PayMethod>
          label="Cara bayar"
          value={method}
          onChange={setMethod}
          options={[
            { value: "cash", label: "Tunai" },
            { value: "qris", label: "QRIS" },
            { value: "transfer", label: "Transfer" },
            { value: "card", label: "Kartu" },
          ]}
        />
        {cash ? (
          <>
            <div className="field">
              <label htmlFor="pay-received">Uang diterima</label>
              <MoneyInput id="pay-received" value={received} onChange={setReceived} />
              <span className="hint">Boleh dikosongkan kalau tidak perlu hitung kembalian.</span>
            </div>
            <div className="row wrap">
              {quick.map((q) => (
                <button key={q} type="button" className="btn btn-sm" onClick={() => setReceived(q)}>
                  {q === total ? "Uang pas" : rupiah(q)}
                </button>
              ))}
            </div>
            {short && <p className="err" style={{ color: "var(--danger)", fontWeight: 600 }}>Uangnya kurang {rupiah(total - (amount ?? 0))}.</p>}
            {change != null && (
              <div className="sum-row" style={{ fontSize: "1.1rem" }}>
                <span className="strong">Kembalian</span>
                <span className="money strong">{rupiah(change)}</span>
              </div>
            )}
          </>
        ) : (
          <p className="muted small">
            {method === "qris"
              ? "Minta pelanggan memindai QRIS toko, lalu cek notifikasi dana masuk sebelum menekan Lunas."
              : method === "transfer"
                ? "Cek mutasi rekening dulu sebelum menekan Lunas."
                : "Pastikan struk EDC sudah keluar sebelum menekan Lunas."}
          </p>
        )}
      </div>
    </Modal>
  );
}
