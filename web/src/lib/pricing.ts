import { useEffect, useMemo, useState } from "react";
import { availableAt, clockAt, priceInfo, type Clock, type PriceRule } from "../../../shared/schedule";

/**
 * Jam toko yang dipakai untuk harga promo & jadwal menu. Memakai selisih jam server
 * (bukan jam HP yang bisa salah), dan diperbarui tiap menit supaya happy hour mulai/selesai tanpa muat ulang.
 */
export function useStoreClock(pricing: { tz: number; now: number } | null | undefined): Clock | null {
  const [tick, setTick] = useState(0);
  const offset = useMemo(() => (pricing ? pricing.now - Date.now() : 0), [pricing]);
  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);
  return useMemo(() => (pricing ? clockAt(Date.now() + offset, pricing.tz) : null), [pricing, offset, tick]);
}

export interface PriceNow {
  price: number;
  list: number;
  promo: string | null;
  percent: number;
  open: boolean;
}

export function priceNow(item: { price: number; category_id: string | null; avail_days?: number | null; avail_from?: number | null; avail_to?: number | null }, rules: PriceRule[], clock: Clock | null): PriceNow {
  if (!clock) return { price: item.price, list: item.price, promo: null, percent: 0, open: true };
  return { ...priceInfo(item, rules, clock), open: availableAt(item, clock) };
}
