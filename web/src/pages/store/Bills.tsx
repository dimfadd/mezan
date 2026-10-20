import { useState } from "react";
import { AlertTriangle, ReceiptText, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { Empty, ErrorState, Loading, useToast } from "../../components/ui";
import { PaymentModal, type PayMethod } from "../../components/PaymentModal";
import { api } from "../../lib/api";
import { rupiah, time } from "../../lib/format";
import { useOrderFeed } from "../../components/Shell";
import { STATUS_LABEL, type Order } from "./types";

export interface Bill {
  key: string;
  table_label: string | null;
  names: string[];
  orders: { id: string; number: number; total: number; status: Order["status"]; customer_name: string; created_at: number }[];
  total: number;
  first_at: number;
  served_at: number | null;
  unpaid_min: number | null;
  overdue: boolean;
}

/**
 * Tagihan untuk "makan dulu, bayar belakangan": semua pesanan meja yang belum dibayar digabung,
 * dibayar sekali. Yang sudah diantar lebih dari 30 menit tapi belum dibayar ditandai merah.
 */
export function Bills({ data, error, reload, retail }: { data: { bills: Bill[]; alertMin: number } | null; error: Error | null; reload: () => void; retail: boolean }) {
  const toast = useToast();
  const feed = useOrderFeed();
  const [paying, setPaying] = useState<Bill | null>(null);
  const [busy, setBusy] = useState(false);
  if (error && !data) return <ErrorState message={error.message} onRetry={reload} />;
  if (!data) return <Loading rows={3} height={110} />;
  if (!data.bills.length) {
    return (
      <div className="panel">
        <Empty icon={<ReceiptText aria-hidden="true" />} title="Semua sudah dibayar">
          {retail ? "Penjualan yang disimpan dengan Bayar nanti muncul di sini." : "Pesanan yang belum dibayar muncul di sini, digabung per meja. Cocok untuk makan dulu, bayar belakangan."}
        </Empty>
      </div>
    );
  }
  const pay = async (p: { method: PayMethod; amountReceived: number | null; phone?: string }) => {
    if (!paying) return;
    setBusy(true);
    try {
      const r = await api.post<{ change: number | null; loyalty?: { card: { stamps: number; target: number }; stamped: boolean } | null }>("/api/store/bills/pay", {
        orderIds: paying.orders.map((o) => o.id),
        method: p.method,
        amountReceived: p.amountReceived,
        ...(p.phone ? { phone: p.phone } : {}),
      });
      toast(`${paying.table_label ?? `Pesanan #${paying.orders[0].number}`} lunas${r.change ? `. Kembalian ${rupiah(r.change)}` : ""}.`);
      setPaying(null);
      reload();
      feed.reload();
    } catch (e) {
      toast((e as Error).message, "error");
      reload();
    } finally {
      setBusy(false);
    }
  };
  const overdue = data.bills.filter((b) => b.overdue).length;
  return (
    <>
      {overdue > 0 && (
        <div className="banner danger" role="status">
          <AlertTriangle aria-hidden="true" />
          <span>
            {overdue} tagihan sudah lebih dari {data.alertMin} menit sejak pesanan diantar dan belum dibayar. Cek mejanya sebelum tamunya pergi.
          </span>
        </div>
      )}
      <div className="bill-grid">
        {data.bills.map((b) => (
          <article key={b.key} className={`bill-card${b.overdue ? " overdue" : ""}`}>
            <header>
              <span className="bill-where">
                {b.table_label ? <UtensilsCrossed aria-hidden="true" /> : <ShoppingBag aria-hidden="true" />}
                {b.table_label ?? (retail ? `Penjualan #${b.orders[0].number}` : `#${b.orders[0].number} · Bawa pulang`)}
              </span>
              {b.unpaid_min != null && (
                <span className={`badge ${b.overdue ? "badge-danger" : "badge-warn"}`}>
                  {retail ? `${b.unpaid_min} menit` : `Diantar ${b.unpaid_min < 1 ? "baru saja" : `${b.unpaid_min} menit lalu`}`}
                </span>
              )}
            </header>
            {b.names.length > 0 && <p className="small muted">{b.names.join(", ")}</p>}
            <ul className="bill-orders">
              {b.orders.map((o) => (
                <li key={o.id}>
                  <span>#{o.number} · {time(o.created_at)}</span>
                  <span className="muted small">{STATUS_LABEL[o.status]}</span>
                  <span className="money">{rupiah(o.total)}</span>
                </li>
              ))}
            </ul>
            <div className="sum-row total"><span>{b.orders.length > 1 ? `Total ${b.orders.length} pesanan` : "Total"}</span><span className="money">{rupiah(b.total)}</span></div>
            <button type="button" className="btn btn-primary btn-block" onClick={() => setPaying(b)}>
              Terima bayar {rupiah(b.total)}
            </button>
          </article>
        ))}
      </div>
      <PaymentModal open={!!paying} total={paying?.total ?? 0} busy={busy} onClose={() => setPaying(null)} onPay={pay} />
    </>
  );
}
