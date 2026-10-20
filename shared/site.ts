// Konten situs publik Pesan.in (menu atas, halaman solusi bisnis, testimoni, footer).
// Diubah dari panel admin; kalau belum pernah diubah, dipakai isi bawaan di bawah.

export interface SiteLink {
  label: string;
  href: string; // "/jalur", "#bagian", "https://...", atau "mailto:..."
  desc?: string;
}
export interface NavSection {
  title: string;
  items: SiteLink[];
}
export interface NavGroup {
  label: string;
  href?: string; // diisi = tautan biasa tanpa dropdown
  auto?: "solutions"; // isi dropdown otomatis dari halaman solusi yang terbit
  sections: NavSection[];
}
export interface Solution {
  slug: string;
  name: string;
  icon: SolutionIcon;
  headline: string;
  intro: string;
  points: string[];
  features: FeatureKey[];
  published: boolean;
}
export interface Testimonial {
  id: string;
  quote: string;
  name: string;
  role: string; // mis. "Pemilik"
  business: string; // mis. "Kopi Senja"
  city: string;
  photo_url: string;
  consent: boolean; // ada izin tertulis dari orang ini untuk menampilkan namanya
  published: boolean;
}
export interface FooterColumn {
  title: string;
  auto?: "solutions";
  links: SiteLink[];
}
export interface SiteFooter {
  tagline: string;
  columns: FooterColumn[];
  contact: { email: string; whatsapp: string; address: string; hours: string };
}
export interface Site {
  nav: NavGroup[];
  solutions: Solution[];
  testimonials: Testimonial[];
  footer: SiteFooter;
}
export type SiteKey = keyof Site;
export const SITE_KEYS: SiteKey[] = ["nav", "solutions", "testimonials", "footer"];

export const SOLUTION_ICONS = ["coffee", "utensils", "store", "cake", "soup", "sandwich"] as const;
export type SolutionIcon = (typeof SOLUTION_ICONS)[number];

/** Katalog fitur yang bisa ditampilkan di halaman solusi. Tautannya ke bagian landing yang memperagakannya. */
export const FEATURES = {
  qr: { title: "Menu QR dengan foto & video", desc: "Pembeli melihat wujud menu sebelum memesan, langsung dari HP tanpa pasang aplikasi.", href: "/#simulasi" },
  eta: { title: "Antrean & perkiraan siap", desc: "Pembeli tahu antrean ke-berapa dan kira-kira jam berapa pesanannya siap.", href: "/#antrean" },
  video: { title: "Mode video ala TikTok", desc: "Menu digeser satu per satu dalam layar penuh, videonya jalan sendiri.", href: "/#pembeli" },
  call: { title: "Panggil pelayan dari HP", desc: "Panggilan masuk ke layar kasir lengkap dengan nomor meja.", href: "/#pembeli" },
  group: { title: "Pesan bareng satu meja", desc: "Semua orang memilih dari HP masing-masing, dikirim sekali.", href: "/#pembeli" },
  split: { title: "Bagi tagihan per orang", desc: "Bagian tiap orang terlihat, sudah termasuk service dan pajak.", href: "/#pembeli" },
  stamp: { title: "Kartu stempel lewat nomor HP", desc: "Pelanggan kumpulkan stempel tanpa kartu kertas dan tanpa aplikasi.", href: "/#pembeli" },
  rating: { title: "Struk WhatsApp & rating per menu", desc: "Struk digital dan penilaian per menu, lalu ulasan di Google Maps.", href: "/#pembeli" },
  waitlist: { title: "Antrean saat penuh", desc: "Tamu memindai QR di pintu dan menunggu di mana saja sampai dipanggil.", href: "/#pembeli" },
  takeaway: { title: "QR khusus bawa pulang", desc: "Pesan tanpa antre di kasir, ambil saat nomornya dipanggil.", href: "/#pembeli" },
  pairs: { title: "Saran pasangan menu", desc: "Tawarkan minuman atau pelengkap yang cocok, di menu QR dan kasir.", href: "/#untung" },
  happy: { title: "Menu & harga ikut jam", desc: "Menu sarapan hanya pagi, happy hour memotong harga sendiri.", href: "/#untung" },
  margin: { title: "Modal & untung per menu", desc: "Tahu menu mana yang laris dan mana yang benar-benar menghasilkan.", href: "/#untung" },
  kds: { title: "Layar dapur & bar", desc: "Makanan ke dapur, minuman ke bar, waktu tunggu terlihat.", href: "/#untung" },
  offline: { title: "Kasir tetap jalan saat offline", desc: "Pesanan disimpan di perangkat dan terkirim sendiri saat sinyal kembali.", href: "/#untung" },
  shift: { title: "Shift kasir & rekap laci", desc: "Modal awal, kas masuk-keluar, dan selisih laci saat tutup.", href: "/#untung" },
  pos: { title: "Kasir di HP, tablet, atau komputer", desc: "Tunai, QRIS, transfer, atau kartu. Struk bisa dicetak atau dikirim.", href: "/#fitur" },
  stock: { title: "Stok berkurang sendiri", desc: "Stok turun tiap terjual, diingatkan saat menipis.", href: "/#fitur" },
  reports: { title: "Laporan penjualan", desc: "Omzet, menu terlaris, dan jam ramai, terbarui setiap transaksi.", href: "/#pantau" },
  staff: { title: "Akun karyawan & hak akses", desc: "Kasir tidak bisa mengubah harga atau melihat laporan.", href: "/#fitur" },
} as const;
export type FeatureKey = keyof typeof FEATURES;
export const FEATURE_KEYS = Object.keys(FEATURES) as FeatureKey[];

export const DEFAULT_SITE: Site = {
  nav: [
    {
      label: "Layanan",
      sections: [
        {
          title: "Di meja pembeli",
          items: [
            { label: "Menu QR foto & video", href: "/#simulasi" },
            { label: "Antrean & perkiraan siap", href: "/#antrean" },
            { label: "Panggil pelayan & pesan bareng", href: "/#pembeli" },
            { label: "Kartu stempel & ulasan", href: "/#pembeli" },
          ],
        },
        {
          title: "Di kasir & dapur",
          items: [
            { label: "Kasir & pembayaran", href: "/#fitur" },
            { label: "Layar dapur & bar", href: "/#untung" },
            { label: "Modal & untung per menu", href: "/#untung" },
            { label: "Laporan penjualan", href: "/#pantau" },
          ],
        },
      ],
    },
    { label: "Solusi bisnis", auto: "solutions", sections: [] },
    { label: "Cara mulai", href: "/#mudah", sections: [] },
    { label: "Paket", href: "/#paket", sections: [] },
  ],
  solutions: [
    {
      slug: "kedai-kopi",
      name: "Kedai kopi",
      icon: "coffee",
      headline: "Antrean kopi jalan terus, barista tetap fokus meracik.",
      intro: "Saat jam ramai, pembeli memesan dan membayar tanpa menumpuk di depan bar. Pesanan minuman langsung masuk ke layar bar, dan pembeli bisa melihat sendiri kapan kopinya siap.",
      points: [
        "Pembeli memesan dari HP sambil menunggu, tidak berdiri lama di depan kasir.",
        "Pesanan minuman masuk ke layar bar lengkap dengan catatan seperti gula sedikit atau tanpa es.",
        "Kartu stempel lewat nomor HP: kumpulkan stempel, tukar hadiah, tanpa kartu kertas.",
        "Happy hour sore memotong harga sendiri pada jamnya.",
      ],
      features: ["qr", "eta", "kds", "stamp", "happy", "takeaway"],
      published: true,
    },
    {
      slug: "restoran",
      name: "Restoran & rumah makan",
      icon: "utensils",
      headline: "Meja penuh, pesanan tetap rapi dari meja sampai dapur.",
      intro: "Satu meja bisa memesan bersama dari HP masing-masing, pelayan dipanggil tanpa melambai, dan dapur menerima pesanan per bagian sesuai urutannya.",
      points: [
        "Satu rombongan memesan dari HP masing-masing, dikirim sekali sebagai satu pesanan.",
        "Pembeli memanggil pelayan dari HP, kasir melihat nomor mejanya.",
        "Tagihan bisa dibagi per orang, sudah termasuk service dan pajak.",
        "Saat penuh, tamu mengantre lewat QR di pintu dan dipanggil saat meja siap.",
      ],
      features: ["qr", "group", "call", "split", "kds", "waitlist"],
      published: true,
    },
    {
      slug: "warung",
      name: "Warung & kaki lima",
      icon: "store",
      headline: "Cukup satu HP untuk catat pesanan, terima bayar, dan lihat untung.",
      intro: "Tidak perlu mesin kasir mahal. Buka dari HP yang sudah ada, catat pesanan dengan beberapa ketukan, dan lihat untung harian tanpa menghitung manual.",
      points: [
        "Bisa dijalankan satu orang dari satu HP.",
        "Kasir tetap mencatat walau sinyal hilang, terkirim sendiri saat online.",
        "Isi modal per porsi, laporan menunjukkan untung tiap menu.",
        "QR bawa pulang supaya pembeli bisa pesan tanpa antre.",
      ],
      features: ["pos", "offline", "margin", "takeaway", "reports", "stock"],
      published: true,
    },
    {
      slug: "kafe",
      name: "Kafe & tempat nongkrong",
      icon: "cake",
      headline: "Menu yang menggoda dilihat, pembeli yang betah balik lagi.",
      intro: "Foto dan video menu tampil menarik di HP pembeli, menu terlaris diberi tanda, dan setiap kunjungan bisa berujung ulasan di Google Maps.",
      points: [
        "Mode video membuat menu terasa hidup, seperti menggulir media sosial.",
        "Saran pasangan menu menawarkan minuman atau camilan yang cocok.",
        "Struk lewat WhatsApp dan rating per menu, lalu lanjut ulasan Google Maps.",
        "Akun karyawan dengan hak akses, kasir tidak bisa mengubah harga.",
      ],
      features: ["video", "pairs", "rating", "stamp", "happy", "staff"],
      published: true,
    },
  ],
  testimonials: [],
  footer: {
    tagline: "Menu QR, kasir, dan dapur dalam satu aplikasi untuk warung, kafe, dan resto.",
    columns: [
      {
        title: "Layanan",
        links: [
          { label: "Menu QR", href: "/#simulasi" },
          { label: "Antrean & perkiraan siap", href: "/#antrean" },
          { label: "Kasir & pembayaran", href: "/#fitur" },
          { label: "Layar dapur", href: "/#untung" },
          { label: "Kartu stempel", href: "/#pembeli" },
          { label: "Laporan penjualan", href: "/#pantau" },
        ],
      },
      { title: "Solusi bisnis", auto: "solutions", links: [] },
      {
        title: "Pesan.in",
        links: [
          { label: "Cara mulai", href: "/#mudah" },
          { label: "Paket", href: "/#paket" },
          { label: "Masuk", href: "/masuk" },
          { label: "Daftarkan usaha", href: "/daftar" },
          { label: "Syarat & Ketentuan", href: "/syarat" },
          { label: "Kebijakan Privasi", href: "/privasi" },
        ],
      },
    ],
    contact: { email: "", whatsapp: "", address: "", hours: "" },
  },
};

/** Gabungkan isi tersimpan dengan bawaan per bagian; bagian yang belum pernah disimpan memakai bawaan. */
export function mergeSite(stored: Partial<Site>): Site {
  return {
    nav: stored.nav ?? DEFAULT_SITE.nav,
    solutions: stored.solutions ?? DEFAULT_SITE.solutions,
    testimonials: stored.testimonials ?? DEFAULT_SITE.testimonials,
    footer: stored.footer ?? DEFAULT_SITE.footer,
  };
}

/** Versi untuk pengunjung: hanya solusi & testimoni yang terbit, dropdown solusi diisi otomatis. */
export function publicSite(site: Site): Site {
  const solutions = site.solutions.filter((s) => s.published);
  const solLinks: SiteLink[] = solutions.map((s) => ({ label: s.name, href: `/solusi/${s.slug}` }));
  return {
    nav: site.nav.map((g) => (g.auto === "solutions" ? { ...g, sections: [{ title: "", items: solLinks }] } : g)),
    solutions,
    testimonials: site.testimonials.filter((t) => t.published),
    footer: { ...site.footer, columns: site.footer.columns.map((c) => (c.auto === "solutions" ? { ...c, links: solLinks } : c)) },
  };
}

export function waLink(num: string) {
  const d = num.replace(/\D/g, "").replace(/^0/, "62");
  return d ? `https://wa.me/${d}` : "";
}
