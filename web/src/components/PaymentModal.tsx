import { useEffect, useState } from "react";
import { Gift, Stamp } from "lucide-react";
import { Modal, MoneyInput, Segmented, useToast } from "./ui";
import { rupiah } from "../lib/format";
import { api } from "../lib/api";
import { useSession } from "../lib/session";
import type { LoyaltyCard } from "../pages/store/types";

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
  onPay: (p: { method: PayMethod; amountReceived: number | null; phone?: string }) => void;
}) {
  const { tenant } = useSession();
  const [method, setMethod] = useState<PayMethod>("cash");
  const [received, setReceived] = useState<number | "">("");
  const [phone, setPhone] = useState("");
  useEffect(() => {
    if (open) {
      setMethod("cash");
      setReceived("");
      setPhone("");
    }
  }, [open]);
  const loyaltyOn = !!tenant?.loyalty_enabled;
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
            onClick={() => onPay({ method, amountReceived: cash ? amount : null, ...(loyaltyOn && phone.trim() ? { phone: phone.trim() } : {}) })}
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
        ) : null}
        {!cash && (
          <p className="muted small">
            {method === "qris"
              ? "Minta pelanggan memindai QRIS toko, lalu cek notifikasi dana masuk sebelum menekan Lunas."
              : method === "transfer"
                ? "Cek mutasi rekening dulu sebelum menekan Lunas."
                : "Pastikan struk EDC sudah keluar sebelum menekan Lunas."}
          </p>
        )}
        {loyaltyOn && <LoyaltyField phone={phone} setPhone={setPhone} total={total} />}
      </div>
    </Modal>
  );
}

/** Nomor HP pelanggan untuk kartu stempel. Kartunya langsung tampil supaya kasir bisa bilang "tinggal 2 lagi". */
export function LoyaltyField({ phone, setPhone, total }: { phone: string; setPhone: (v: string) => void; total: number }) {
  const { tenant } = useSession();
  const toast = useToast();
  const [card, setCard] = useState<LoyaltyCard | null>(null);
  const [busy, setBusy] = useState(false);
  const digits = phone.replace(/\D/g, "");
  useEffect(() => {
    setCard(null);
    if (digits.length < 9) return;
    const id = window.setTimeout(async () => {
      try {
        const r = await api.get<{ card: LoyaltyCard | null }>(`/api/store/loyalty/lookup?phone=${digits}`);
        setCard(r.card);
      } catch {
        /* offline: stempel tetap diberikan saat pesanan tersinkron */
      }
    }, 350);
    return () => window.clearTimeout(id);
  }, [digits]);
  if (!tenant) return null;
  const min = tenant.loyalty_min_spend;
  const enough = total >= min;
  const redeemNow = async () => {
    setBusy(true);
    try {
      const r = await api.post<{ card: LoyaltyCard }>("/api/store/loyalty/redeem", { phone: digits });
      setCard(r.card);
      toast(`Hadiah ditukar: ${tenant.loyalty_reward}. Jangan lupa berikan ke pelanggan.`);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="field loyalty-field">
      <label htmlFor="pay-phone"><Stamp aria-hidden="true" /> No. HP untuk kartu stempel (opsional)</label>
      <input id="pay-phone" className="input" inputMode="tel" autoComplete="off" placeholder="0812 3456 7890" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
      {digits.length >= 9 && (
        <div className="stamp-line small">
          {card ? (
            <>
              <StampDots n={Math.min(card.stamps, card.target)} of={card.target} />
              <span>
                {card.name ? `${card.name} · ` : ""}{card.stamps}/{card.target} stempel
                {card.ready ? " · tukar hadiahnya dulu" : enough ? ` · jadi ${card.stamps + 1} setelah bayar` : ""}
              </span>
            </>
          ) : (
            <span className="muted">Pelanggan baru. Kartunya dibuat otomatis setelah bayar.</span>
          )}
        </div>
      )}
      {!enough && min > 0 && digits.length >= 9 && <span className="hint">Belanja minimal {rupiah(min)} untuk dapat stempel. Kunjungannya tetap dicatat.</span>}
      {card?.ready && (
        <button type="button" className="btn btn-sm btn-accent" disabled={busy} onClick={redeemNow}>
          <Gift /> Tukar hadiah: {tenant.loyalty_reward}
        </button>
      )}
    </div>
  );
}

export function StampDots({ n, of }: { n: number; of: number }) {
  return (
    <span className="stamp-dots" aria-hidden="true">
      {Array.from({ length: Math.min(of, 20) }, (_, i) => (
        <i key={i} className={i < n ? "on" : ""} />
      ))}
    </span>
  );
}
