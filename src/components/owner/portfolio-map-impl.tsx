"use client";
import { useRef, useState } from "react";
import { Map, Marker, Popup, type MapRef } from "react-map-gl/mapbox";
import { Building2, DoorOpen, MapPin, Wrench, X } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";

export type OwnerMapProperty = {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  unitCount: number;
  occupied: number;
  openRequests: number;
};

/** Teardrop pin — terracotta when the property has open fixes, sage otherwise. */
function Pin({ alert }: { alert: boolean }) {
  const color = alert ? "#c0613a" : "#8a9a72";
  return (
    <svg width="26" height="34" viewBox="0 0 26 34" className="cursor-pointer drop-shadow-md" style={{ display: "block" }}>
      <path
        d="M13 0C5.82 0 0 5.82 0 13c0 9.25 13 21 13 21s13-11.75 13-21C26 5.82 20.18 0 13 0z"
        fill={color}
        stroke="#ffffff"
        strokeWidth="1.5"
      />
      <circle cx="13" cy="13" r="4.5" fill="#ffffff" />
    </svg>
  );
}

function Row({
  icon,
  label,
  value,
  accent = "#64748b",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: string;
}) {
  return (
    <div className="flex gap-2.5">
      <div className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${accent}1a`, color: accent }}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">{label}</div>
        <div className="truncate text-[13px] font-semibold leading-tight text-slate-800">{value}</div>
      </div>
    </div>
  );
}

export default function PortfolioMapImpl({ token, properties }: { token: string; properties: OwnerMapProperty[] }) {
  const [active, setActive] = useState<OwnerMapProperty | null>(null);
  const mapRef = useRef<MapRef>(null);
  const center = properties[0] ?? { lat: 39.5, lng: -98.35 };

  // Frame all the owner's properties once the map is ready.
  function fit() {
    if (properties.length < 2) return;
    let minLat = 90;
    let maxLat = -90;
    let minLng = 180;
    let maxLng = -180;
    for (const p of properties) {
      minLat = Math.min(minLat, p.lat);
      maxLat = Math.max(maxLat, p.lat);
      minLng = Math.min(minLng, p.lng);
      maxLng = Math.max(maxLng, p.lng);
    }
    mapRef.current?.fitBounds(
      [
        [minLng, minLat],
        [maxLng, maxLat],
      ],
      { padding: 72, maxZoom: 14, duration: 0 },
    );
  }

  return (
    <div className="relative h-[42vh] overflow-hidden rounded-2xl border border-line">
      <style jsx global>{`
        .abode-pop .mapboxgl-popup-content {
          padding: 0;
          background: transparent;
          box-shadow: none;
          border-radius: 18px;
        }
        .abode-pop .mapboxgl-popup-tip {
          border-top-color: #ffffff;
          border-bottom-color: #ffffff;
          filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.06));
        }
      `}</style>

      <Map
        ref={mapRef}
        mapboxAccessToken={token}
        initialViewState={{ latitude: center.lat, longitude: center.lng, zoom: 10 }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: "100%", height: "100%" }}
        onLoad={fit}
      >
        {properties.map((p) => (
          <Marker
            key={p.id}
            latitude={p.lat}
            longitude={p.lng}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setActive(p);
              mapRef.current?.easeTo({ center: [p.lng, p.lat], offset: [0, 140], duration: 400 });
            }}
          >
            <Pin alert={p.openRequests > 0} />
          </Marker>
        ))}

        {active && (
          <Popup
            latitude={active.lat}
            longitude={active.lng}
            anchor="bottom"
            offset={38}
            maxWidth="320px"
            className="abode-pop"
            closeButton={false}
            onClose={() => setActive(null)}
            closeOnClick={false}
          >
            <div
              className="w-[272px] overflow-hidden rounded-[18px] bg-white text-slate-900 ring-1 ring-black/[0.06]"
              style={{ boxShadow: "0 12px 34px rgba(15,23,42,0.20), 0 2px 6px rgba(15,23,42,0.08)" }}
            >
              <div className="flex items-start justify-between gap-2 px-4 pb-2 pt-3">
                <h3 className="text-[15px] font-bold leading-snug tracking-[-0.01em] text-slate-900 line-clamp-2">
                  {active.name}
                </h3>
                <button
                  type="button"
                  aria-label="Close"
                  onClick={() => setActive(null)}
                  className="-mr-1.5 -mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 active:scale-95"
                >
                  <X className="h-4 w-4" strokeWidth={2.5} />
                </button>
              </div>
              <div className="space-y-2.5 border-t border-slate-100 px-4 py-3">
                <Row icon={<MapPin className="h-4 w-4" />} label="Address" value={active.address ?? "—"} accent="#0f172a" />
                <Row
                  icon={<DoorOpen className="h-4 w-4" />}
                  label="Units"
                  value={`${active.occupied}/${active.unitCount} occupied`}
                  accent="#8a9a72"
                />
                <Row
                  icon={active.openRequests > 0 ? <Wrench className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                  label="Open fixes"
                  value={active.openRequests > 0 ? `${active.openRequests} open` : "All clear"}
                  accent={active.openRequests > 0 ? "#c0613a" : "#64748b"}
                />
              </div>
              <div className="border-t border-slate-100 p-2.5">
                <a
                  href={`/properties#prop-${active.id}`}
                  className="flex w-full items-center justify-center rounded-xl bg-slate-900 py-2 text-[13px] font-semibold text-white transition hover:bg-slate-800 active:scale-[0.99]"
                >
                  Manage property
                </a>
              </div>
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
