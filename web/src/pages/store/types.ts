export interface OrderItem {
  id: string;
  menu_item_id: string | null;
  name: string;
  price: number;
  qty: number;
  note: string;
  person?: string;
  station?: "kitchen" | "bar";
  ready_at?: number | null;
  list_price?: number | null;
  variant_id?: string | null;
  variant_name?: string;
}

export interface ServiceCall {
  id: string;
  table_label: string;
  kind: "waiter" | "bill";
  geo_check: string;
  created_at: number;
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
  public_token?: string;
  accepted_at?: number | null;
  offline?: number;
  member_phone?: string | null;
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
  avail_days: number;
  avail_from: number | null;
  avail_to: number | null;
  pair_ids: string;
  pairs?: string[];
  cost?: number | null;
  opt1_name?: string;
  opt2_name?: string;
  barcode?: string;
  sku?: string;
  variants?: ItemVariant[];
}

export interface ItemVariant {
  id: string;
  opt1: string;
  opt2: string;
  price: number | null;
  cost?: number | null;
  sku: string;
  barcode: string;
  stock_qty: number;
  available: number;
}

export interface Category {
  id: string;
  name: string;
  name_en?: string;
  station?: "kitchen" | "bar";
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

export const STATION_LABEL: Record<string, string> = { kitchen: "Dapur", bar: "Bar / minuman" };

export interface Pricing {
  tz: number;
  now: number;
  rules: import("../../../../shared/schedule").PriceRule[];
}

export interface LoyaltyCard {
  phone: string;
  name: string;
  stamps: number;
  target: number;
  reward: string;
  ready: boolean;
  rewards: number;
}
