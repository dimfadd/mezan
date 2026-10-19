// Data contoh untuk pengembangan lokal. Semua nama, harga, dan pesanan di sini FIKTIF
// dan hanya dipakai supaya layar dashboard tidak kosong saat dicoba.
import { resolve } from "node:path";
import { openNodeDb } from "../db/node";
import { migrate } from "../db/migrate";
import { businessDay } from "../lib/http";
import { hashPassword, newId, randomCode, randomToken } from "../lib/security";
import { computeTotals } from "../lib/orders";

const db = openNodeDb(resolve(process.env.DATABASE_PATH ?? "./data/mezan.db"));
migrate(db.raw, resolve("server/migrations"), false);
const raw = db.raw;

if (raw.prepare("SELECT 1 FROM users LIMIT 1").get()) {
  console.log("Database sudah berisi data. Jalankan `npm run db:reset` kalau mau mulai ulang.");
  process.exit(0);
}

const now = Date.now();
const DAY = 86_400_000;
const TZ = 420;

// Generator acak dengan seed tetap supaya data contoh selalu sama.
let seed = 20261019;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

const ins = (table: string, row: Record<string, unknown>) => {
  const keys = Object.keys(row);
  raw.prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`).run(...keys.map((k) => row[k]));
};

const main = async () => {
  // Harga paket di bawah ini contoh, ubah dari panel Admin > Paket.
  const plans = [
    { code: "warung", name: "Warung", price_monthly: 49000, max_tables: 10, max_staff: 2, allow_video: 0, allow_inventory: 1, allow_analytics: 1, sort: 1 },
    { code: "kafe", name: "Kafe", price_monthly: 99000, max_tables: 30, max_staff: 8, allow_video: 1, allow_inventory: 1, allow_analytics: 1, sort: 2 },
    { code: "resto", name: "Resto", price_monthly: 199000, max_tables: 100, max_staff: 30, allow_video: 1, allow_inventory: 1, allow_analytics: 1, sort: 3 },
  ];
  const planIds: Record<string, string> = {};
  for (const p of plans) {
    const id = newId();
    planIds[p.code] = id;
    ins("plans", { id, ...p, active: 1, created_at: now });
  }

  ins("users", { id: newId(), tenant_id: null, name: "Admin Mezan", login: "admin@mezan.local", password_hash: await hashPassword("admin12345"), role: "platform_admin", created_at: now });

  const tenantId = newId();
  ins("tenants", {
    id: tenantId, slug: "warung-contoh", name: "Warung Contoh", kind: "warung", plan_id: planIds.kafe, status: "active",
    period_end: now + 20 * DAY, address: "Jl. Contoh No. 1", phone: "", tax_rate: 0, service_rate: 0,
    inventory_enabled: 1, qr_ordering_enabled: 1, tz_offset_minutes: TZ,
    welcome_note: "Pesan dari meja, bayar di kasir setelah makan.", created_at: now - 60 * DAY,
  });
  const owner = newId(), manager = newId(), staff1 = newId(), staff2 = newId();
  const pw = await hashPassword("contoh12345");
  ins("users", { id: owner, tenant_id: tenantId, name: "Pak Pemilik", login: "pemilik@contoh.id", password_hash: pw, role: "owner", created_at: now - 60 * DAY });
  ins("users", { id: manager, tenant_id: tenantId, name: "Bu Manajer", login: "manajer@contoh.id", password_hash: pw, role: "manager", created_at: now - 60 * DAY });
  ins("users", { id: staff1, tenant_id: tenantId, name: "Rina (kasir)", login: "kasir@contoh.id", password_hash: pw, role: "staff", created_at: now - 60 * DAY });
  ins("users", { id: staff2, tenant_id: tenantId, name: "Dodi (dapur)", login: "dapur@contoh.id", password_hash: pw, role: "staff", created_at: now - 60 * DAY });

  const cats: Record<string, string> = {};
  ["Makanan", "Camilan", "Minuman", "Titipan"].forEach((name, i) => {
    const id = newId();
    cats[name] = id;
    ins("categories", { id, tenant_id: tenantId, name, sort: i + 1, created_at: now - 60 * DAY });
  });

  const menu: [string, string, number, string, string, number?][] = [
    ["Makanan", "Nasi Goreng Kampung", 22000, "Nasi goreng bumbu terasi, telur ceplok, kerupuk, acar.", "favorit"],
    ["Makanan", "Mie Ayam Bakso", 20000, "Mie kenyal, ayam kecap, dua bakso urat, sawi rebus.", ""],
    ["Makanan", "Ayam Geprek Sambal Bawang", 18000, "Ayam goreng tepung digeprek dengan sambal bawang. Level pedas bisa diminta di catatan.", "pedas,favorit"],
    ["Makanan", "Soto Ayam Lamongan", 17000, "Kuah kuning bening, suwiran ayam, koya, telur rebus setengah.", ""],
    ["Makanan", "Nasi Uduk Komplit", 16000, "Nasi uduk, ayam goreng, orek tempe, bihun, sambal kacang.", ""],
    ["Makanan", "Tahu Tempe Penyet", 12000, "Tahu dan tempe goreng, sambal terasi, lalapan.", "vegetarian"],
    ["Camilan", "Pisang Goreng Keju", 10000, "Lima potong pisang kepok, keju parut, susu kental manis.", ""],
    ["Camilan", "Tahu Crispy", 8000, "Tahu goreng tepung renyah, cocol sambal kecap.", "vegetarian"],
    ["Minuman", "Es Teh Manis", 5000, "Teh tubruk diseduh pagi, gula bisa dikurangi.", ""],
    ["Minuman", "Es Jeruk Peras", 8000, "Jeruk peras langsung, bukan sirup.", ""],
    ["Minuman", "Kopi Susu Gula Aren", 15000, "Espresso robusta lokal, susu segar, gula aren cair.", "favorit"],
    ["Minuman", "Teh Tarik", 10000, "Teh hitam dan susu kental manis, ditarik sampai berbusa.", ""],
    ["Titipan", "Air Mineral 600 ml", 4000, "Botol dingin dari kulkas.", "", 36],
    ["Titipan", "Kerupuk Udang", 2000, "Per bungkus, titipan tetangga.", "", 4],
  ];
  const items: { id: string; name: string; price: number; cat: string; weight: number; stock: boolean }[] = [];
  menu.forEach(([cat, name, price, description, tags, stock], i) => {
    const id = newId();
    ins("menu_items", {
      id, tenant_id: tenantId, category_id: cats[cat], name, description, price, tags, available: 1,
      track_stock: stock != null ? 1 : 0, stock_qty: stock ?? 0, low_stock_at: stock != null ? 6 : 5,
      unit: cat === "Titipan" ? (name.startsWith("Air") ? "botol" : "bungkus") : cat === "Minuman" ? "gelas" : "porsi",
      sort: i + 1, created_at: now - 60 * DAY,
    });
    // bobot popularitas supaya laporan punya pola yang masuk akal
    const weight = name.includes("Es Teh") ? 9 : tags.includes("favorit") ? 6 : name.includes("Teh Tarik") ? 1 : 3;
    items.push({ id, name, price, cat, weight, stock: stock != null });
  });

  const tables: { id: string; label: string }[] = [];
  for (let i = 1; i <= 8; i++) {
    const id = newId();
    const label = `Meja ${i}`;
    tables.push({ id, label });
    ins("dining_tables", { id, tenant_id: tenantId, label, code: i === 1 ? "contoh-meja1" : randomCode(10), area: i <= 5 ? "Dalam" : "Teras", created_at: now - 60 * DAY });
  }

  // Riwayat pesanan 45 hari ke belakang.
  const weighted = items.filter((i) => !i.stock).flatMap((i) => Array(i.weight).fill(i));
  const names = ["Andi", "Sari", "Budi", "Wulan", "Rizky", "Tika", "Fajar", "Lina", "Yoga", "Nia", ""];
  const hourWeights = [7, 7, 8, 11, 11, 12, 12, 12, 13, 13, 15, 16, 17, 18, 18, 19, 19, 19, 20, 20, 21];
  const insertOrder = raw.transaction(() => {
    for (let d = 45; d >= 0; d--) {
      const dayStart = Date.parse(businessDay(now - d * DAY, TZ) + "T00:00:00Z") - TZ * 60_000;
      const dow = new Date(dayStart + TZ * 60_000).getUTCDay();
      const base = dow === 0 || dow === 6 ? 34 : 22;
      const count = Math.round(base * (0.75 + rand() * 0.5) * (1 + (45 - d) / 180));
      const day = businessDay(dayStart + 12 * 3600_000, TZ);
      const times: number[] = [];
      for (let k = 0; k < count; k++) {
        const h = pick(hourWeights);
        times.push(dayStart + h * 3600_000 + Math.floor(rand() * 3600_000));
      }
      times.sort((a, b) => a - b);
      let number = 0;
      for (const ts of times) {
        if (ts > now) continue;
        number++;
        const lines = new Map<string, number>();
        const n = 1 + Math.floor(rand() * 3);
        for (let k = 0; k < n; k++) {
          const it = pick(weighted);
          lines.set(it.id, (lines.get(it.id) ?? 0) + 1 + (rand() < 0.2 ? 1 : 0));
        }
        if (rand() < 0.5) lines.set(items[8].id, (lines.get(items[8].id) ?? 0) + 1);
        let subtotal = 0;
        for (const [id, qty] of lines) subtotal += items.find((i) => i.id === id)!.price * qty;
        const totals = computeTotals(subtotal, 0, 0);
        const isToday = d === 0;
        const recent = now - ts < 40 * 60_000;
        const cancelled = rand() < 0.03;
        const source = rand() < 0.6 ? "qr" : "pos";
        const table = source === "qr" || rand() < 0.5 ? pick(tables) : null;
        const status = cancelled ? "cancelled" : isToday && recent ? pick(["new", "preparing", "ready"]) : "done";
        const paid = !cancelled && (status === "done" || (source === "pos" && rand() < 0.5));
        const id = newId();
        ins("orders", {
          id, tenant_id: tenantId, number, business_day: day, table_id: table?.id ?? null, table_label: table?.label ?? null,
          source, order_type: table ? "dine_in" : "takeaway", customer_name: pick(names), status,
          payment_status: paid ? "paid" : "unpaid", payment_method: paid ? pick(["cash", "cash", "cash", "qris", "qris", "transfer"]) : null,
          amount_received: null, subtotal: totals.subtotal, tax: totals.tax, service: totals.service, total: totals.total,
          note: "", cancel_reason: cancelled ? "Pelanggan batal" : null, public_token: randomToken(16),
          created_by: source === "pos" ? staff1 : null, paid_by: paid ? pick([staff1, staff1, manager]) : null,
          created_at: ts, updated_at: ts, paid_at: paid ? ts + 30 * 60_000 : null,
        });
        for (const [itemId, qty] of lines) {
          const it = items.find((i) => i.id === itemId)!;
          ins("order_items", { id: newId(), order_id: id, menu_item_id: it.id, category_name: it.cat, name: it.name, price: it.price, qty, note: "" });
        }
      }
    }
  });
  insertOrder();

  ins("subscription_payments", {
    id: newId(), tenant_id: tenantId, plan_id: planIds.kafe, amount: 99000, months: 1, method: "transfer",
    note: "Contoh pembayaran", period_end_after: now + 20 * DAY, recorded_by: null, created_at: now - 10 * DAY,
  });

  console.log(`
Data contoh siap.

  Admin Mezan     admin@mezan.local   / admin12345
  Pemilik toko    pemilik@contoh.id   / contoh12345
  Manajer         manajer@contoh.id   / contoh12345
  Karyawan kasir  kasir@contoh.id     / contoh12345

  Menu pelanggan (Meja 1): http://localhost:5173/m/contoh-meja1
`);
};

main();
