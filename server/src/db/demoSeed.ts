// Data contoh. Semua nama, harga, dan pesanan di sini FIKTIF dan hanya dipakai
// supaya layar dashboard tidak kosong saat dicoba. Dipakai oleh skrip lokal dan mode uji di Vercel.
import { first, stmt, type DB, type Stmt } from "./types";
import { businessDay } from "../lib/http";
import { hashPassword, newId, randomCode, randomToken } from "../lib/security";
import { computeTotals } from "../lib/orders";
import { newStoreBarcode } from "../../../shared/variants";

const DAY = 86_400_000;
const TZ = 420;

export const DEMO_ACCOUNTS = [
  ["Admin Pesan.in", "admin@mezan.local", "admin12345"],
  ["Pemilik toko", "pemilik@contoh.id", "contoh12345"],
  ["Manajer", "manajer@contoh.id", "contoh12345"],
  ["Karyawan kasir", "kasir@contoh.id", "contoh12345"],
  ["Pemilik toko baju", "toko@contoh.id", "contoh12345"],
] as const;

/**
 * opts.adminPassword: sandi admin platform. Di server publik (Vercel), isi lewat ADMIN_PASSWORD
 * supaya admin tidak memakai sandi contoh yang tertulis di README.
 */
export async function seedDemo(db: DB, opts: { adminPassword?: string } = {}): Promise<boolean> {
  if (await first(db, "SELECT 1 FROM users LIMIT 1")) return false;
  const now = Date.now();
  let seed = 20261019;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const pending: Stmt[] = [];
  const ins = (table: string, row: Record<string, unknown>) => {
    const keys = Object.keys(row);
    pending.push(stmt(db, `INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`, ...keys.map((k) => row[k])));
  };

  // Harga paket di bawah ini contoh, ubah dari panel Admin > Paket.
  const plans = [
    { code: "warung", name: "Warung", price_monthly: 49000, max_tables: 10, max_staff: 2, allow_video: 0, allow_inventory: 1, allow_analytics: 1, allow_branding: 0, max_photos: 3, max_videos: 0, sort: 1 },
    { code: "kafe", name: "Kafe", price_monthly: 99000, max_tables: 30, max_staff: 8, allow_video: 1, allow_inventory: 1, allow_analytics: 1, allow_branding: 0, max_photos: 5, max_videos: 1, sort: 2 },
    { code: "resto", name: "Resto", price_monthly: 199000, max_tables: 100, max_staff: 30, allow_video: 1, allow_inventory: 1, allow_analytics: 1, allow_branding: 1, max_photos: 6, max_videos: 2, sort: 3 },
  ];
  const planIds: Record<string, string> = {};
  for (const p of plans) {
    const id = newId();
    planIds[p.code] = id;
    ins("plans", { id, ...p, active: 1, created_at: now });
  }

  ins("users", { id: newId(), tenant_id: null, name: "Admin Pesan.in", login: "admin@mezan.local", password_hash: await hashPassword(opts.adminPassword || "admin12345"), role: "platform_admin", created_at: now });

  const tenantId = newId();
  ins("tenants", {
    id: tenantId, slug: "warung-contoh", name: "Warung Contoh", kind: "warung", plan_id: planIds.resto, status: "active",
    period_end: now + 20 * DAY, address: "Jl. Contoh No. 1", phone: "", tax_rate: 0, service_rate: 0,
    inventory_enabled: 1, qr_ordering_enabled: 1, tz_offset_minutes: TZ,
    takeaway_code: "contoh-bawa", takeaway_qr_enabled: 1,
    loyalty_enabled: 1, loyalty_target: 10, loyalty_min_spend: 15000, loyalty_reward: "1 Es Teh Manis gratis",
    waitlist_enabled: 1, waitlist_code: "contoh-antre",
    welcome_note: "Pesan dari meja, bayar di kasir setelah makan.", welcome_note_en: "Order from your table, pay at the cashier after your meal.", created_at: now - 60 * DAY,
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
    ins("categories", { id, tenant_id: tenantId, name, name_en: ({ Makanan: "Mains", Camilan: "Snacks", Minuman: "Drinks", Titipan: "Packaged goods" } as Record<string, string>)[name] ?? "", station: name === "Minuman" ? "bar" : "kitchen", sort: i + 1, created_at: now - 60 * DAY });
  });

  const menu: [string, string, number, string, string, number?][] = [
    ["Makanan", "Nasi Goreng Kampung", 22000, "Nasi goreng bumbu terasi, telur ceplok, kerupuk, acar.", "favorit"],
    ["Makanan", "Mie Ayam Bakso", 20000, "Mie kenyal, ayam kecap, dua bakso urat, sawi rebus.", ""],
    ["Makanan", "Ayam Geprek Sambal Bawang", 18000, "Ayam goreng tepung digeprek dengan sambal bawang. Level pedas bisa diminta di catatan.", "bestseller,pedas"],
    ["Makanan", "Soto Ayam Lamongan", 17000, "Kuah kuning bening, suwiran ayam, koya, telur rebus setengah.", ""],
    ["Makanan", "Nasi Uduk Komplit", 16000, "Nasi uduk, ayam goreng, orek tempe, bihun, sambal kacang.", ""],
    ["Makanan", "Tahu Tempe Penyet", 12000, "Tahu dan tempe goreng, sambal terasi, lalapan.", "vegetarian"],
    ["Makanan", "Bubur Ayam", 13000, "Bubur nasi, suwiran ayam, cakwe, kacang, kerupuk. Hanya pagi.", "baru"],
    ["Camilan", "Pisang Goreng Keju", 10000, "Lima potong pisang kepok, keju parut, susu kental manis.", ""],
    ["Camilan", "Tahu Crispy", 8000, "Tahu goreng tepung renyah, cocol sambal kecap.", "vegetarian"],
    ["Minuman", "Es Teh Manis", 5000, "Teh tubruk diseduh pagi, gula bisa dikurangi.", ""],
    ["Minuman", "Es Jeruk Peras", 8000, "Jeruk peras langsung, bukan sirup.", ""],
    ["Minuman", "Kopi Susu Gula Aren", 15000, "Espresso robusta lokal, susu segar, gula aren cair.", "bestseller"],
    ["Minuman", "Teh Tarik", 10000, "Teh hitam dan susu kental manis, ditarik sampai berbusa.", ""],
    ["Titipan", "Air Mineral 600 ml", 4000, "Botol dingin dari kulkas.", "", 36],
    ["Titipan", "Kerupuk Udang", 2000, "Per bungkus, titipan tetangga.", "", 4],
  ];
  // Info detail contoh: porsi, isi, level pedas, waktu saji, alergen.
  const details: Record<string, { portion?: string; components?: string; spice?: number; prep?: number; allergens?: string }> = {
    "Nasi Goreng Kampung": { portion: "1 orang", components: "Nasi goreng terasi\nTelur ceplok\nKerupuk udang\nAcar timun", spice: 2, prep: 10, allergens: "Mengandung udang (terasi, kerupuk)" },
    "Mie Ayam Bakso": { portion: "1 orang", components: "Mie telur\nAyam kecap\n2 bakso urat\nSawi rebus\nKuah kaldu terpisah", spice: 0, prep: 8, allergens: "Mengandung gluten dan telur" },
    "Ayam Geprek Sambal Bawang": { portion: "1 orang (paha atau dada)", components: "Nasi putih\nAyam goreng tepung\nSambal bawang\nLalapan", spice: 4, prep: 12, allergens: "Mengandung gluten" },
    "Soto Ayam Lamongan": { portion: "1 mangkuk", components: "Kuah kuning\nSuwiran ayam\nSetengah telur rebus\nKoya\nNasi terpisah", spice: 0, prep: 7 },
    "Nasi Uduk Komplit": { portion: "1 orang", components: "Nasi uduk\nAyam goreng\nOrek tempe\nBihun\nSambal kacang", spice: 1, prep: 6, allergens: "Mengandung kacang" },
    "Tahu Tempe Penyet": { portion: "1 orang", components: "Nasi putih\n2 tahu goreng\n2 tempe goreng\nSambal terasi\nLalapan", spice: 3, prep: 8, allergens: "Mengandung kedelai dan udang (terasi)" },
    "Pisang Goreng Keju": { portion: "5 potong, cukup berdua", components: "Pisang kepok\nKeju parut\nSusu kental manis", prep: 8, allergens: "Mengandung susu" },
    "Tahu Crispy": { portion: "8 potong", components: "Tahu goreng tepung\nSambal kecap", spice: 1, prep: 6 },
    "Es Teh Manis": { portion: "1 gelas 400 ml", prep: 2 },
    "Es Jeruk Peras": { portion: "1 gelas 400 ml", prep: 3 },
    "Kopi Susu Gula Aren": { portion: "1 gelas 300 ml", components: "Espresso robusta\nSusu segar\nGula aren cair\nEs batu", prep: 5, allergens: "Mengandung susu" },
    "Teh Tarik": { portion: "1 gelas 300 ml", prep: 4, allergens: "Mengandung susu" },
  };
  // Versi Inggris contoh. Nama asli tetap ditampilkan; name_en jadi keterangan di bawahnya.
  const english: Record<string, { name: string; description: string; portion?: string; components?: string; allergens?: string }> = {
    "Nasi Goreng Kampung": { name: "Village-style fried rice", description: "Fried rice with shrimp paste, a fried egg, prawn crackers and pickles.", portion: "1 person", components: "Shrimp-paste fried rice\nFried egg\nPrawn crackers\nCucumber pickles", allergens: "Contains shrimp (paste and crackers)" },
    "Mie Ayam Bakso": { name: "Chicken noodles with meatballs", description: "Springy egg noodles, soy-glazed chicken, two beef meatballs, boiled greens.", portion: "1 person", components: "Egg noodles\nSoy-glazed chicken\n2 beef meatballs\nBoiled mustard greens\nBroth on the side", allergens: "Contains gluten and egg" },
    "Ayam Geprek Sambal Bawang": { name: "Smashed crispy chicken, garlic chili", description: "Crispy battered chicken smashed into garlic chili sambal. Ask for a milder level in the note.", portion: "1 person (thigh or breast)", components: "Steamed rice\nCrispy chicken\nGarlic chili sambal\nFresh vegetables", allergens: "Contains gluten" },
    "Soto Ayam Lamongan": { name: "Turmeric chicken soup", description: "Clear yellow broth, shredded chicken, half a boiled egg, savory cracker powder.", portion: "1 bowl", components: "Turmeric broth\nShredded chicken\nHalf boiled egg\nCracker powder (koya)\nRice on the side" },
    "Nasi Uduk Komplit": { name: "Coconut rice platter", description: "Coconut rice, fried chicken, sweet tempeh, rice vermicelli, peanut sauce.", portion: "1 person", components: "Coconut rice\nFried chicken\nSweet soy tempeh\nRice vermicelli\nPeanut sauce", allergens: "Contains peanuts" },
    "Tahu Tempe Penyet": { name: "Smashed tofu & tempeh", description: "Fried tofu and tempeh with shrimp-paste chili and fresh vegetables.", portion: "1 person", components: "Steamed rice\n2 fried tofu\n2 fried tempeh\nShrimp-paste chili\nFresh vegetables", allergens: "Contains soy and shrimp (paste)" },
    "Pisang Goreng Keju": { name: "Fried banana with cheese", description: "Five pieces of fried banana, grated cheese, sweet condensed milk.", portion: "5 pieces, good for two", components: "Kepok banana\nGrated cheese\nCondensed milk", allergens: "Contains milk" },
    "Tahu Crispy": { name: "Crispy tofu", description: "Battered fried tofu with sweet soy chili dip.", portion: "8 pieces" },
    "Es Teh Manis": { name: "Sweet iced tea", description: "Brewed every morning. Ask for less sugar in the note.", portion: "400 ml glass" },
    "Es Jeruk Peras": { name: "Fresh orange juice", description: "Squeezed to order, not syrup.", portion: "400 ml glass" },
    "Kopi Susu Gula Aren": { name: "Iced coffee with palm sugar", description: "Local robusta espresso, fresh milk, liquid palm sugar.", portion: "300 ml glass", components: "Robusta espresso\nFresh milk\nPalm sugar syrup\nIce", allergens: "Contains milk" },
    "Teh Tarik": { name: "Pulled milk tea", description: "Black tea and condensed milk, pulled until frothy.", portion: "300 ml glass", allergens: "Contains milk" },
    "Air Mineral 600 ml": { name: "Mineral water", description: "Cold bottle from the fridge." },
    "Kerupuk Udang": { name: "Prawn crackers", description: "Per pack.", allergens: "Contains shrimp" },
  };
  // Modal (HPP) contoh per porsi, kira-kira 30-50% dari harga jual.
  const COST: Record<string, number> = {
    "Nasi Goreng Kampung": 9500, "Mie Ayam Bakso": 9000, "Ayam Geprek Sambal Bawang": 9800, "Soto Ayam Lamongan": 7000,
    "Nasi Uduk Komplit": 8500, "Tahu Tempe Penyet": 4500, "Bubur Ayam": 5000, "Pisang Goreng Keju": 4000, "Tahu Crispy": 2600,
    "Es Teh Manis": 1200, "Es Jeruk Peras": 3200, "Kopi Susu Gula Aren": 5200, "Teh Tarik": 3500, "Air Mineral 600 ml": 2800, "Kerupuk Udang": 1500,
  };
  const DEMO_ART: Record<string, string> = {
    "Nasi Goreng Kampung": "nasgor", "Ayam Geprek Sambal Bawang": "geprek", "Soto Ayam Lamongan": "soto", "Pisang Goreng Keju": "pisang",
    "Es Teh Manis": "esteh", "Es Jeruk Peras": "jeruk", "Kopi Susu Gula Aren": "kopi", "Teh Tarik": "teh", "Air Mineral 600 ml": "air", "Kerupuk Udang": "kerupuk",
  };
  const DEMO_VIDEO = new Set(["geprek", "kopi", "nasgor", "esteh"]);
  const items: { id: string; name: string; price: number; cat: string; weight: number; stock: boolean }[] = [];
  menu.forEach(([cat, name, price, description, tags, stock], i) => {
    const id = newId();
    const art = DEMO_ART[name];
    const media: { kind: string; url: string }[] = art ? [`/demo/menu/${art}-1.svg`, `/demo/menu/${art}-2.svg`].map((url) => ({ kind: "image", url })) : [];
    if (art && DEMO_VIDEO.has(art)) media.push({ kind: "video", url: `/demo/menu/${art}.mp4` });
    ins("menu_items", {
      // Sampul disalin ke menu_items, sama seperti saat pemilik mengunggah lewat form.
      image_url: media[0]?.url ?? null, video_url: media.find((m) => m.kind === "video")?.url ?? null,
      id, tenant_id: tenantId, category_id: cats[cat], name, description, price, tags, available: 1,
      track_stock: stock != null ? 1 : 0, stock_qty: stock ?? 0, low_stock_at: stock != null ? 6 : 5,
      unit: cat === "Titipan" ? (name.startsWith("Air") ? "botol" : "bungkus") : cat === "Minuman" ? "gelas" : "porsi",
      sort: i + 1, created_at: now - 60 * DAY,
      portion: details[name]?.portion ?? "", components: details[name]?.components ?? "",
      spice_level: details[name]?.spice ?? null, prep_minutes: details[name]?.prep ?? null, allergens: details[name]?.allergens ?? "",
      name_en: english[name]?.name ?? "", description_en: english[name]?.description ?? "", portion_en: english[name]?.portion ?? "",
      components_en: english[name]?.components ?? "", allergens_en: english[name]?.allergens ?? "",
      cost: COST[name] ?? null,
      // Menu sarapan: hanya 06.00 sampai 10.00.
      ...(name === "Bubur Ayam" ? { avail_from: 360, avail_to: 600 } : {}),
    });
    // bobot popularitas supaya laporan punya pola yang masuk akal
    const weight = name.includes("Es Teh") ? 9 : tags.includes("favorit") || tags.includes("bestseller") ? 6 : name.includes("Teh Tarik") || name === "Bubur Ayam" ? 1 : 3;
    items.push({ id, name, price, cat, weight, stock: stock != null });
    // Foto & video peraga (ilustrasi, bukan foto sungguhan) supaya galeri dan mode video bisa dicoba.
    if (media.length) {
      media.forEach((m, sort) => ins("menu_media", { id: newId(), tenant_id: tenantId, menu_item_id: id, kind: m.kind, url: m.url, sort, created_at: now - 60 * DAY }));
    }
  });

  const tables: { id: string; label: string }[] = [];
  for (let i = 1; i <= 8; i++) {
    const id = newId();
    const label = `Meja ${i}`;
    tables.push({ id, label });
    ins("dining_tables", { id, tenant_id: tenantId, label, code: i === 1 ? "contoh-meja1" : randomCode(10), area: i <= 5 ? "Dalam" : "Teras", created_at: now - 60 * DAY });
  }

  // Riwayat pesanan 45 hari ke belakang.
  const weighted = items.filter((i) => !i.stock && i.name !== "Bubur Ayam").flatMap((i) => Array(i.weight).fill(i));
  const esTeh = items.find((i) => i.name === "Es Teh Manis")!;
  const bubur = items.find((i) => i.name === "Bubur Ayam")!;
  const feedbackComments: [number, string][] = [
    [5, "Sambalnya pas, ayamnya renyah."], [5, ""], [4, "Enak, cuma agak lama datangnya."], [5, "Kopi susunya juara."],
    [4, ""], [3, "Kuah sotonya agak asin hari ini."], [5, "Porsinya besar, pas buat makan siang."], [2, "Nasi gorengnya dingin waktu sampai."],
    [4, "Es jeruknya segar, bukan sirup."], [5, ""], [4, "Tempat bersih, pelayan ramah."], [3, ""],
  ];
  const members = [
    ["6281234567801", "Andi"], ["6281234567802", "Sari"], ["6281234567803", "Budi"], ["6281234567804", "Wulan"], ["6281234567805", "Rizky"],
  ].map(([phone, name]) => ({ id: newId(), phone, name, total: 0, last: 0 }));
  for (const m of members) ins("loyalty_members", { id: m.id, tenant_id: tenantId, phone: m.phone, name: m.name, created_at: now - 40 * DAY });
  let fbCount = 0;
  const pendingMember = new Map<string, string>();
  const pendingShift: { id: string; open: number; close: number; diff: number }[] = [];
  const names = ["Andi", "Sari", "Budi", "Wulan", "Rizky", "Tika", "Fajar", "Lina", "Yoga", "Nia", ""];
  const hourWeights = [7, 7, 8, 11, 11, 12, 12, 12, 13, 13, 15, 16, 17, 18, 18, 19, 19, 19, 20, 20, 21];
  {
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
        if (rand() < 0.5) lines.set(esTeh.id, (lines.get(esTeh.id) ?? 0) + 1);
        const hour = new Date(ts + TZ * 60_000).getUTCHours();
        if (hour >= 6 && hour < 10 && rand() < 0.35) lines.set(bubur.id, 1);
        // Happy hour contoh: minuman diskon 20% jam 15.00 sampai 17.00.
        const happy = hour >= 15 && hour < 17;
        const unitPrice = (it: (typeof items)[number]) => (happy && it.cat === "Minuman" ? Math.round((it.price * 0.8) / 100) * 100 : it.price);
        let subtotal = 0;
        for (const [id, qty] of lines) subtotal += unitPrice(items.find((i) => i.id === id)!) * qty;
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
          accepted_at: status === "new" ? null : ts + 60_000,
          // Lama masak 8–16 menit (tanpa rand supaya urutan data contoh lain tidak bergeser).
          ready_at: status === "done" || status === "ready" ? ts + 60_000 + (8 + (number % 9)) * 60_000 : null,
        });
        for (const [itemId, qty] of lines) {
          const it = items.find((i) => i.id === itemId)!;
          const price = unitPrice(it);
          ins("order_items", {
            id: newId(), order_id: id, menu_item_id: it.id, category_name: it.cat, name: it.name, price, qty, note: "",
            station: it.cat === "Minuman" ? "bar" : "kitchen", list_price: price !== it.price ? it.price : null, unit_cost: COST[it.name] ?? null,
          });
        }
        // Sebagian pembeli memberi nilai setelah makan.
        if (status === "done" && d <= 30 && rand() < 0.12) {
          const [rating, comment] = feedbackComments[fbCount++ % feedbackComments.length];
          ins("order_feedback", { id: newId(), tenant_id: tenantId, order_id: id, rating, comment, created_at: ts + 50 * 60_000 });
          for (const itemId of lines.keys()) {
            if (rand() < 0.6) ins("item_feedback", { id: newId(), tenant_id: tenantId, order_id: id, menu_item_id: itemId, liked: rating >= 4 || rand() < 0.4 ? 1 : 0, created_at: ts + 50 * 60_000 });
          }
        }
        // Pelanggan tetap dengan kartu stempel.
        if (paid && totals.total >= 15000 && rand() < 0.15) {
          const m = pick(members);
          m.total++;
          m.last = ts;
          ins("loyalty_events", { id: newId(), tenant_id: tenantId, member_id: m.id, order_id: id, kind: "stamp", delta: 1, user_id: staff1, created_at: ts });
          pendingMember.set(id, m.id);
        }
      }
    }
  }

  members.forEach((m, i) => {
    // Pelanggan pertama dibuat siap tukar hadiah supaya alurnya bisa dicoba di kasir.
    const stamps = i === 0 && m.total >= 10 ? 10 : m.total % 10;
    pending.push(stmt(db, "UPDATE loyalty_members SET stamps = ?, total_stamps = ?, rewards = ?, last_visit_at = ? WHERE id = ?", stamps, m.total, Math.floor((m.total - stamps) / 10), m.last || null, m.id));
  });
  for (const [orderId, memberId] of pendingMember) pending.push(stmt(db, "UPDATE orders SET member_id = ? WHERE id = ?", memberId, orderId));

  // Promo jam tertentu, shift kasir, dan antrean contoh.
  ins("price_rules", { id: newId(), tenant_id: tenantId, name: "Happy hour", percent: 20, days: 127, start_min: 900, end_min: 1020, category_ids: cats.Minuman, active: 1, created_at: now - 30 * DAY });
  const today = businessDay(now, TZ);
  const todayStart = Date.parse(`${today}T00:00:00Z`) - TZ * 60_000;
  for (let d = 3; d >= 1; d--) {
    const open = todayStart - d * DAY + 7 * 3600_000;
    const sid = newId();
    const diff = [0, -5000, 2000][d - 1];
    ins("cash_shifts", { id: sid, tenant_id: tenantId, status: "closed", opened_by: staff1, opened_at: open, opening_cash: 200000, closed_by: staff1, closed_at: open + 14 * 3600_000, expected_cash: 0, counted_cash: diff, note: "" });
    ins("cash_moves", { id: newId(), tenant_id: tenantId, shift_id: sid, kind: "out", amount: 20000, note: "Beli es batu", user_id: staff1, created_at: open + 3 * 3600_000 });
    // Angka laci dihitung dari pesanan tunai di shift itu setelah semua pesanan tersimpan.
    pendingShift.push({ id: sid, open, close: open + 14 * 3600_000, diff });
  }
  if (now > todayStart + 7 * 3600_000) {
    ins("cash_shifts", { id: newId(), tenant_id: tenantId, status: "open", opened_by: staff1, opened_at: todayStart + 7 * 3600_000, opening_cash: 200000, note: "" });
  }
  ins("waitlist", { id: newId(), tenant_id: tenantId, number: 1, business_day: today, name: "Keluarga Hadi", party_size: 5, phone: "6281299990001", source: "qr", status: "waiting", token: randomToken(12), created_at: now - 9 * 60_000 });
  ins("waitlist", { id: newId(), tenant_id: tenantId, number: 2, business_day: today, name: "Maya", party_size: 2, phone: "", source: "kasir", status: "waiting", token: randomToken(12), created_at: now - 3 * 60_000 });

  ins("subscription_payments", {
    id: newId(), tenant_id: tenantId, plan_id: planIds.resto, amount: 199000, months: 1, method: "transfer",
    note: "Contoh pembayaran", period_end_after: now + 20 * DAY, recorded_by: null, created_at: now - 10 * DAY,
  });

  // Contoh varian untuk usaha makanan: Teh Tarik panas atau es (es lebih mahal).
  const tehTarik = items.find((i) => i.name === "Teh Tarik");
  if (tehTarik) {
    pending.push(stmt(db, "UPDATE menu_items SET opt1_name = 'Penyajian' WHERE id = ?", tehTarik.id));
    ins("item_variants", { id: newId(), tenant_id: tenantId, item_id: tehTarik.id, opt1: "Panas", opt2: "", price: null, cost: null, sku: "", barcode: "", stock_qty: 0, available: 1, sort: 0, created_at: now });
    ins("item_variants", { id: newId(), tenant_id: tenantId, item_id: tehTarik.id, opt1: "Es", opt2: "", price: 12000, cost: null, sku: "", barcode: "", stock_qty: 0, available: 1, sort: 1, created_at: now });
  }
  // Barcode pabrik contoh untuk barang titipan, supaya scan di kasir bisa dicoba.
  const air = items.find((i) => i.name === "Air Mineral 600 ml");
  if (air) pending.push(stmt(db, "UPDATE menu_items SET barcode = '8996001600146' WHERE id = ?", air.id));

  await seedRetail(ins, { now, planId: planIds.kafe, pw });

  // Kirim bertahap supaya tidak melebihi batas ukuran satu batch di database cloud.
  for (let k = 0; k < pending.length; k += 400) await db.batch(pending.slice(k, k + 400));
  for (const sh of pendingShift) {
    const r = await first<{ cash: number; out: number }>(
      db,
      `SELECT (SELECT COALESCE(SUM(total), 0) FROM orders WHERE tenant_id = ? AND payment_method = 'cash' AND payment_status = 'paid' AND status != 'cancelled' AND paid_at >= ? AND paid_at < ?) AS cash,
              (SELECT COALESCE(SUM(amount), 0) FROM cash_moves WHERE shift_id = ? AND kind = 'out') AS out`,
      tenantId, sh.open, sh.close, sh.id,
    );
    const expected = 200000 + (r?.cash ?? 0) - (r?.out ?? 0);
    await db.batch([stmt(db, "UPDATE cash_shifts SET expected_cash = ?, counted_cash = ? WHERE id = ?", expected, expected + sh.diff, sh.id)]);
  }
  return true;
}

/**
 * Toko barang contoh (baju & aksesoris): varian warna/ukuran, barcode, stok per varian, dan riwayat
 * penjualan 30 hari. Pengacaknya terpisah supaya data warung contoh di atas tidak ikut berubah.
 */
async function seedRetail(ins: (table: string, row: Record<string, unknown>) => void, o: { now: number; planId: string; pw: string }) {
  const { now, planId, pw } = o;
  let seed = 7771;
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const tenantId = newId();
  ins("tenants", {
    id: tenantId, slug: "toko-contoh", name: "Toko Busana Contoh", kind: "toko", plan_id: planId, status: "active",
    period_end: now + 20 * DAY, address: "Pasar Contoh Blok B No. 7", phone: "", tax_rate: 0, service_rate: 0,
    inventory_enabled: 1, qr_ordering_enabled: 0, tz_offset_minutes: TZ,
    loyalty_enabled: 1, loyalty_target: 8, loyalty_min_spend: 100000, loyalty_reward: "Potongan Rp25.000",
    welcome_note: "", created_at: now - 40 * DAY,
  });
  const owner = newId();
  ins("users", { id: owner, tenant_id: tenantId, name: "Bu Rina", login: "toko@contoh.id", password_hash: pw, role: "owner", created_at: now - 40 * DAY });
  const cats: Record<string, string> = {};
  ["Atasan", "Bawahan", "Aksesoris"].forEach((n, i) => {
    cats[n] = newId();
    ins("categories", { id: cats[n], tenant_id: tenantId, name: n, sort: i + 1, created_at: now });
  });
  type V = { id: string; opt1: string; opt2: string; price: number | null; stock: number; code: string };
  type P = { id: string; name: string; cat: string; price: number; cost: number; o1: string; o2: string; vs: V[]; stock: number; code: string };
  const prods: P[] = [];
  const product = (name: string, cat: string, price: number, cost: number, o1 = "", a: string[] = [], o2 = "", b: string[] = [], bump: Record<string, number> = {}) => {
    const id = newId();
    const vs: V[] = [];
    for (const x of a) for (const y of b.length ? b : [""]) vs.push({ id: newId(), opt1: x, opt2: y, price: bump[y] ? price + bump[y] : null, stock: 2 + Math.floor(rand() * 10), code: newStoreBarcode() });
    prods.push({ id, name, cat, price, cost, o1, o2, vs, stock: vs.length ? vs.reduce((n, v) => n + v.stock, 0) : 5 + Math.floor(rand() * 20), code: vs.length ? "" : newStoreBarcode() });
  };
  product("Kaos Polos Cotton 30s", "Atasan", 75000, 38000, "Warna", ["Hitam", "Putih", "Navy"], "Ukuran", ["S", "M", "L", "XL"], { XL: 10000 });
  product("Kemeja Flanel", "Atasan", 145000, 80000, "Warna", ["Merah", "Biru"], "Ukuran", ["M", "L", "XL"]);
  product("Celana Chino", "Bawahan", 165000, 90000, "Warna", ["Krem", "Hitam"], "Ukuran", ["30", "32", "34"]);
  product("Topi Baseball", "Aksesoris", 55000, 25000, "Warna", ["Hitam", "Krem"]);
  product("Kaus Kaki (3 pasang)", "Aksesoris", 35000, 15000);
  product("Totebag Kanvas", "Aksesoris", 45000, 20000);
  prods.forEach((p, i) => {
    ins("menu_items", {
      id: p.id, tenant_id: tenantId, category_id: cats[p.cat], name: p.name, description: "", price: p.price, tags: i === 0 ? "bestseller" : "",
      available: 1, track_stock: 1, stock_qty: p.stock, low_stock_at: 3, unit: "pcs", sort: i + 1, created_at: now - 40 * DAY,
      cost: p.cost, opt1_name: p.vs.length ? p.o1 : "", opt2_name: p.vs.length ? p.o2 : "", barcode: p.code, sku: `BC-${String(i + 1).padStart(3, "0")}`,
    });
    p.vs.forEach((v, k) => ins("item_variants", {
      id: v.id, tenant_id: tenantId, item_id: p.id, opt1: v.opt1, opt2: v.opt2, price: v.price, cost: null, sku: "", barcode: v.code,
      stock_qty: v.stock, available: 1, sort: k, created_at: now - 40 * DAY,
    }));
  });
  // Penjualan 30 hari terakhir, langsung lunas di kasir.
  for (let d = 30; d >= 0; d--) {
    const n = 2 + Math.floor(rand() * 6);
    const day = businessDay(now - d * DAY, TZ);
    for (let k = 0; k < n; k++) {
      const at = Date.parse(`${day}T00:00:00Z`) - TZ * 60_000 + (10 + Math.floor(rand() * 10)) * 3600_000 + Math.floor(rand() * 3600_000);
      if (at > now) continue;
      const id = newId();
      const lines = Array.from({ length: 1 + Math.floor(rand() * 2) }, () => {
        const p = pick(prods);
        const v = p.vs.length ? pick(p.vs) : null;
        return { p, v, qty: 1 + Math.floor(rand() * 2), price: v && v.price != null ? v.price : p.price };
      });
      const totals = computeTotals(lines.reduce((s, l) => s + l.price * l.qty, 0), 0, 0);
      ins("orders", {
        id, tenant_id: tenantId, number: k + 1, business_day: day, table_id: null, table_label: null, source: "pos", order_type: "takeaway",
        customer_name: "", status: "done", payment_status: "paid", payment_method: pick(["cash", "cash", "qris", "transfer"]), amount_received: null,
        subtotal: totals.subtotal, tax: 0, service: 0, total: totals.total, note: "", public_token: randomToken(16), created_by: owner, paid_by: owner,
        created_at: at, updated_at: at, paid_at: at, accepted_at: at, ready_at: at,
      });
      for (const l of lines) {
        ins("order_items", {
          id: newId(), order_id: id, menu_item_id: l.p.id, category_name: l.p.cat, name: l.p.name, price: l.price, qty: l.qty, note: "",
          unit_cost: l.p.cost, variant_id: l.v?.id ?? null, variant_name: l.v ? [l.v.opt1, l.v.opt2].filter(Boolean).join(" / ") : "",
        });
      }
    }
  }
}
