"use client";
import { Map, Marker } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";

/** Small, zoomed-in read-only map pinning a single job's property location. */
export default function JobLocationMapImpl({ token, lat, lng }: { token: string; lat: number; lng: number }) {
  return (
    <Map
      mapboxAccessToken={token}
      initialViewState={{ latitude: lat, longitude: lng, zoom: 14 }}
      mapStyle="mapbox://styles/mapbox/streets-v12"
      style={{ width: "100%", height: "100%" }}
    >
      <Marker latitude={lat} longitude={lng} anchor="bottom">
        <svg width="26" height="34" viewBox="0 0 26 34" className="drop-shadow-md" style={{ display: "block" }}>
          <path
            d="M13 0C5.82 0 0 5.82 0 13c0 9.25 13 21 13 21s13-11.75 13-21C26 5.82 20.18 0 13 0z"
            fill="#4f46e5"
            stroke="#ffffff"
            strokeWidth="1.5"
          />
          <circle cx="13" cy="13" r="4.5" fill="#ffffff" />
        </svg>
      </Marker>
    </Map>
  );
}
