export interface OrderItem {
  id: string;
  menu_item_id: string | null;
  name: string;
  price: number;
  qty: number;
  note: string;
}

export interface Order {
  id: string;
  number: number;
  business_day: string;
  table_label: string | null;
  source: "qr" | "pos";
  order_type: "dine_in" | "takeaway";
  customer_name: string;
  status: "new" | "preparing" | "ready" | "done" | "cancelled";
  payment_status: "unpaid" | "paid";
  payment_method: string | null;
  amount_received: number | null;
  subtotal: number;
  tax: number;
  service: number;
  total: number;
  note: string;
  cancel_reason: string | null;
  created_at: number;
  updated_at: number;
  paid_at: number | null;
  created_by_name: string | null;
  geo_check?: "" | "ok" | "far" | "unknown";
  geo_distance_m?: number | null;
  items: OrderItem[];
}

export interface MenuItem {
  id: string;
  category_id: string | null;
  name: string;
  description: string;
  price: number;
  image_url: string | null;
  video_url: string | null;
  tags: string;
  sold_30d?: number;
  available: number;
  track_stock: number;
  stock_qty: number;
  low_stock_at: number;
  unit: string;
  sort: number;
  media: { kind: "image" | "video"; url: string }[];
  portion: string;
  components: string;
  spice_level: number | null;
  prep_minutes: number | null;
  allergens: string;
  name_en: string;
  description_en: string;
  portion_en: string;
  components_en: string;
  allergens_en: string;
}

export interface Category {
  id: string;
  name: string;
  name_en?: string;
  sort: number;
  item_count?: number;
}

export interface DiningTable {
  id: string;
  label: string;
  code: string;
  area: string;
  active: number;
  open_orders: number;
}

export const STATUS_LABEL: Record<Order["status"], string> = {
  new: "Baru masuk",
  preparing: "Sedang dibuat",
  ready: "Siap diantar",
  done: "Selesai",
  cancelled: "Dibatalkan",
};

export const TAG_LABEL: Record<string, string> = { bestseller: "Best seller", favorit: "Rekomendasi", pedas: "Pedas", vegetarian: "Vegetarian", baru: "Menu baru" };
