"use client";
import { useState } from "react";
import { Map, Marker, Popup } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

export interface MapProperty {
  id: string;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
}

export default function MapImpl({ token, properties }: { token: string; properties: MapProperty[] }) {
  const [active, setActive] = useState<MapProperty | null>(null);
  const center = properties[0] ?? { lat: 39.5, lng: -98.35 };

  return (
    <div className="h-[60vh] overflow-hidden rounded-xl border border-black/10 dark:border-white/15">
      <Map
        mapboxAccessToken={token}
        initialViewState={{ latitude: center.lat, longitude: center.lng, zoom: 9 }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: "100%", height: "100%" }}
      >
        {properties.map((p) => (
          <Marker
            key={p.id}
            latitude={p.lat}
            longitude={p.lng}
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              setActive(p);
            }}
          >
            <span className="cursor-pointer text-2xl leading-none">📍</span>
          </Marker>
        ))}
        {active && (
          <Popup latitude={active.lat} longitude={active.lng} onClose={() => setActive(null)} closeOnClick={false}>
            <div className="text-sm text-black">
              <div className="font-medium">{active.name}</div>
              {active.address && <div>{active.address}</div>}
            </div>
          </Popup>
        )}
      </Map>
    </div>
  );
}
