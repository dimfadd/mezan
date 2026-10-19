import type { Tenant } from "./auth";

export type GeoMode = "off" | "flag" | "block";
export type GeoCheck = "" | "ok" | "far" | "unknown";
export interface BuyerLocation {
  lat: number;
  lng: number;
  acc: number; // akurasi dari browser, meter
}

/** Jarak dua titik di permukaan bumi (meter). */
export function distanceM(aLat: number, aLng: number, bLat: number, bLng: number) {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// GPS di dalam gedung sering meleset puluhan meter. Akurasi dipakai sebagai kelonggaran (dibatasi),
// dan lokasi yang akurasinya lebih buruk dari 1 km dianggap tidak diketahui.
const MAX_SLACK = 150;
const USELESS_ACC = 1000;

export function geoActive(t: Pick<Tenant, "geo_mode" | "geo_lat" | "geo_lng">) {
  return t.geo_mode !== "off" && t.geo_lat != null && t.geo_lng != null;
}

export function checkGeo(t: Pick<Tenant, "geo_mode" | "geo_lat" | "geo_lng" | "geo_radius_m">, loc: BuyerLocation | null | undefined): { check: GeoCheck; distance: number | null } {
  if (!geoActive(t)) return { check: "", distance: null };
  if (!loc || !Number.isFinite(loc.lat) || !Number.isFinite(loc.lng) || !(loc.acc >= 0) || loc.acc > USELESS_ACC) {
    return { check: "unknown", distance: null };
  }
  const d = Math.round(distanceM(t.geo_lat!, t.geo_lng!, loc.lat, loc.lng));
  const inside = d - Math.min(loc.acc, MAX_SLACK) <= t.geo_radius_m;
  return { check: inside ? "ok" : "far", distance: d };
}
