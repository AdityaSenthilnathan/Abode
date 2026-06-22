import type { Urgency } from "@/server/services/handyman";

// Color scale for maintenance urgency. `pin` is the vivid marker color; `bg`/`text`
// are a softer, readable pairing for pills. Shared by the map and the jobs list.
export const URGENCY: Record<Urgency, { pin: string; bg: string; text: string; label: string }> = {
  urgent: { pin: "#ef4444", bg: "#fee2e2", text: "#b91c1c", label: "Urgent" },
  high: { pin: "#f97316", bg: "#ffedd5", text: "#c2410c", label: "High" },
  med: { pin: "#eab308", bg: "#fef9c3", text: "#a16207", label: "Medium" },
  low: { pin: "#94a3b8", bg: "#f1f5f9", text: "#475569", label: "Low" },
};

export function urgencyOf(u: Urgency | null) {
  return URGENCY[u ?? "low"];
}

/** Great-circle distance in miles between two coordinates. */
export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 3958.8;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function formatMiles(mi: number) {
  return `${mi.toLocaleString(undefined, { maximumFractionDigits: 1 })} mi`;
}
