"use client";
import dynamic from "next/dynamic";

// Mapbox needs `window`; load client-only.
const Impl = dynamic(() => import("./job-location-map-impl"), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-surface-2" />,
});

export function JobLocationMap(props: { token: string; lat: number; lng: number }) {
  return <Impl {...props} />;
}
