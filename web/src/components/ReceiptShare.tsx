import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { Modal } from "./ui";
import { rupiah } from "../lib/format";
import { useSession } from "../lib/session";
import type { LoyaltyCard } from "../pages/store/types";

/** Nomor HP ke format wa.me (62...). Kosong = WhatsApp minta pilih kontak sendiri. */
export function waNumber(raw: string) {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("0")) d = `62${d.slice(1)}`;
  else if (d.startsWith("8")) d = `62${d}`;
  return /^62\d{8,13}$/.test(d) ? d : "";
}

export function receiptUrl(token: string) {
  return `${window.location.origin}/struk/${token}`;
}

export function waLink(phone: string, text: string) {
  const n = waNumber(phone);
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`;
}

export function receiptText(store: string, o: { number: number; total: number; token: string }, card?: LoyaltyCard | null) {
  const lines = [`Struk ${store} pesanan #${o.number}`, `Total ${rupiah(o.total)}`, receiptUrl(o.token)];
  if (card) lines.push(card.ready ? `Stempel ${card.stamps}/${card.target}. Hadiah siap ditukar: ${card.reward}.` : `Stempel ${card.stamps}/${card.target}. ${card.target - card.stamps} lagi dapat ${card.reward}.`);
  return lines.join("\n");
}

/** Setelah bayar di kasir: kirim struk digital lewat WhatsApp (dari HP/WA kasir), cetak, atau selesai. */
export function ReceiptShare({
  open,
  order,
  phone: phone0,
  card,
  onPrint,
  onClose,
  title,
}: {
  title?: string;
  open: boolean;
  order: { number: number; total: number; token: string; paid: boolean } | null;
  phone?: string;
  card?: LoyaltyCard | null;
  onPrint?: () => void;
  onClose: () => void;
}) {
  const { tenant } = useSession();
  const [phone, setPhone] = useState(phone0 ?? "");
  useEffect(() => setPhone(phone0 ?? ""), [phone0, open]);
  if (!order || !tenant) return null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title ?? `Pesanan #${order.number} ${order.paid ? "lunas" : "dikirim ke dapur"}`}
      footer={
        <>
          {onPrint && <button className="btn" onClick={onPrint}>Cetak struk</button>}
          <button className="btn btn-primary" onClick={onClose}>Selesai</button>
        </>
      }
    >
      <div className="stack">
        <div className="sum-row total"><span>Total</span><span className="money">{rupiah(order.total)}</span></div>
        {card && (
          <p className="small" style={{ color: "var(--brand-text)", fontWeight: 650 }}>
            Kartu stempel: {card.stamps}/{card.target}{card.ready ? ` · hadiah siap ditukar (${card.reward})` : ""}
          </p>
        )}
        <div className="field">
          <label htmlFor="rc-phone">Kirim struk digital ke WhatsApp pelanggan</label>
          <div className="row" style={{ gap: 8 }}>
            <input id="rc-phone" className="input" inputMode="tel" placeholder="0812 3456 7890 (boleh kosong)" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={20} />
            <a className="btn btn-wa" href={waLink(phone, receiptText(tenant.name, order, card))} target="_blank" rel="noopener noreferrer">
              <MessageCircle /> Kirim
            </a>
          </div>
          <span className="hint">Membuka WhatsApp di perangkat ini dengan tautan struk. Pelanggan bisa memberi rating menu dari tautan itu.</span>
        </div>
      </div>
    </Modal>
  );
}
