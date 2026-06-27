"use client";
import dynamic from "next/dynamic";
import type { OwnerMapProperty } from "./portfolio-map-impl";

export type { OwnerMapProperty };

// Mapbox needs `window`; load client-only.
const MapImpl = dynamic(() => import("./portfolio-map-impl"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[42vh] place-items-center rounded-2xl border border-line bg-surface text-sm text-muted">
      Loading map…
    </div>
  ),
});

export function PortfolioMap(props: { token: string; properties: OwnerMapProperty[] }) {
  return <MapImpl {...props} />;
}
