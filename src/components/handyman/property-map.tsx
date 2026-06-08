"use client";
import dynamic from "next/dynamic";
import type { MapProperty } from "./property-map-impl";

// Mapbox needs `window`; load client-only.
const MapImpl = dynamic(() => import("./property-map-impl"), {
  ssr: false,
  loading: () => (
    <div className="grid h-[60vh] place-items-center rounded-xl border border-black/10 text-sm opacity-60 dark:border-white/15">
      Loading map…
    </div>
  ),
});

export function PropertyMap(props: { token: string; properties: MapProperty[] }) {
  return <MapImpl {...props} />;
}
