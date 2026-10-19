import { PAY_LABEL, rupiah } from "../lib/format";
import type { Order } from "../pages/store/types";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Cetak struk 58mm lewat dialog print browser (bisa ke printer thermal Bluetooth/USB). */
export function printReceipt(order: Order, store: { name: string; address: string; phone: string }) {
  const w = window.open("", "_blank", "width=380,height=640");
  if (!w) return false;
  const rows = order.items
    .map(
      (i) =>
        `<tr><td colspan="2">${esc(i.name)}${i.note ? `<br><small>${esc(i.note)}</small>` : ""}</td></tr>
         <tr><td>${i.qty} x ${rupiah(i.price)}</td><td class="r">${rupiah(i.qty * i.price)}</td></tr>`,
    )
    .join("");
  const when = new Date(order.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" });
  w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Struk #${order.number}</title>
<style>
  @page { size: 58mm auto; margin: 3mm; }
  body { font: 12px/1.35 ui-monospace, Menlo, Consolas, monospace; color: #000; margin: 0; width: 52mm; }
  h1 { font-size: 14px; text-align: center; margin: 0 0 2px; }
  .c { text-align: center; } .r { text-align: right; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; } td { padding: 1px 0; vertical-align: top; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  .t td { font-weight: bold; font-size: 13px; }
  small { font-size: 10px; }
</style></head><body>
<h1>${esc(store.name)}</h1>
${store.address ? `<div class="c"><small>${esc(store.address)}</small></div>` : ""}
${store.phone ? `<div class="c"><small>${esc(store.phone)}</small></div>` : ""}
<hr>
<div>No. ${order.number}${order.table_label ? ` · ${esc(order.table_label)}` : " · Bawa pulang"}</div>
<div>${when}</div>
${order.customer_name ? `<div>${esc(order.customer_name)}</div>` : ""}
<hr>
<table>${rows}</table>
<hr>
<table>
<tr><td>Subtotal</td><td class="r">${rupiah(order.subtotal)}</td></tr>
${order.service ? `<tr><td>Service</td><td class="r">${rupiah(order.service)}</td></tr>` : ""}
${order.tax ? `<tr><td>Pajak</td><td class="r">${rupiah(order.tax)}</td></tr>` : ""}
<tr class="t"><td>Total</td><td class="r">${rupiah(order.total)}</td></tr>
${order.payment_status === "paid" ? `<tr><td>Bayar (${PAY_LABEL[order.payment_method ?? "lainnya"] ?? "-"})</td><td class="r">${rupiah(order.amount_received ?? order.total)}</td></tr>` : `<tr><td colspan="2">BELUM DIBAYAR</td></tr>`}
${order.payment_status === "paid" && order.amount_received ? `<tr><td>Kembali</td><td class="r">${rupiah(order.amount_received - order.total)}</td></tr>` : ""}
</table>
<hr>
<div class="c">Terima kasih</div>
<script>window.onload = () => { window.print(); setTimeout(() => window.close(), 300); };</script>
</body></html>`);
  w.document.close();
  return true;
}
