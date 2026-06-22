"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Map, Marker, Popup, type MapRef } from "react-map-gl/mapbox";
import { Briefcase, LocateFixed, MapPin, Navigation, User, X } from "lucide-react";
import "mapbox-gl/dist/mapbox-gl.css";
import type { EmployeeMapProperty, Urgency } from "@/server/services/handyman";
import { URGENCY, urgencyOf, milesBetween, formatMiles } from "./urgency";

export type { Urgency };
export type MapProperty = EmployeeMapProperty;

/** Google-Maps-style teardrop pin, anchored at the bottom tip. */
function Pin({ color }: { color: string }) {
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

/** One icon-led section row: leading tile, small label, bold value, detail line. */
function Row({
  icon,
  label,
  value,
  detail,
  accent = "#64748b",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string | null;
  accent?: string;
}) {
  return (
    <div className="flex gap-2.5">
      <div
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
        style={{ background: `${accent}1a`, color: accent }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">{label}</div>
        <div className="truncate text-[13px] font-semibold leading-tight text-slate-800">{value}</div>
        {detail && <div className="mt-0.5 text-[12px] leading-snug text-slate-500">{detail}</div>}
      </div>
    </div>
  );
}

export default function MapImpl({ token, properties }: { token: string; properties: MapProperty[] }) {
  const [active, setActive] = useState<MapProperty | null>(null);
  const [me, setMe] = useState<{ lat: number; lng: number } | null>(null);
  const [heading, setHeading] = useState<number | null>(null);
  const mapRef = useRef<MapRef>(null);
  const center = properties[0] ?? { lat: 39.5, lng: -98.35 };

  // Open a pin's popup and pan so the (tall) card has room above the marker.
  const openProperty = (p: MapProperty) => {
    setActive(p);
    mapRef.current?.easeTo({ center: [p.lng, p.lat], offset: [0, 190], duration: 500 });
  };

  const recenterOnMe = () => {
    if (me) mapRef.current?.easeTo({ center: [me.lng, me.lat], zoom: 13, duration: 600 });
  };

  const requestLocation = useCallback(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setMe({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setMe(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 600000 },
    );
  }, []);

  useEffect(() => {
    requestLocation();
  }, [requestLocation]);

  // Compass heading for the direction cone. Unavailable on most desktops (no
  // sensor) → heading stays null and we just render the dot.
  useEffect(() => {
    function onOrient(e: DeviceOrientationEvent) {
      const compass = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading;
      if (typeof compass === "number" && !Number.isNaN(compass)) {
        setHeading(compass);
      } else if (e.absolute && typeof e.alpha === "number") {
        setHeading((360 - e.alpha) % 360);
      }
    }
    window.addEventListener("deviceorientationabsolute", onOrient as EventListener);
    window.addEventListener("deviceorientation", onOrient as EventListener);
    return () => {
      window.removeEventListener("deviceorientationabsolute", onOrient as EventListener);
      window.removeEventListener("deviceorientation", onOrient as EventListener);
    };
  }, []);

  return (
    <div className="relative h-[60vh] overflow-hidden rounded-xl border border-black/10 dark:border-white/15">
      {/* Popup chrome — our card owns all the styling */}
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
        initialViewState={{ latitude: center.lat, longitude: center.lng, zoom: 9 }}
        mapStyle="mapbox://styles/mapbox/streets-v12"
        style={{ width: "100%", height: "100%" }}
      >
        {/* "You are here" — blue location dot, with a facing cone when a heading is known. */}
        {me && (
          <Marker latitude={me.lat} longitude={me.lng} anchor="center">
            <div className="relative h-10 w-10">
              {heading != null && (
                <svg
                  viewBox="0 0 40 40"
                  className="absolute inset-0"
                  style={{ transform: `rotate(${heading}deg)`, transformOrigin: "50% 50%" }}
                >
                  <defs>
                    <linearGradient id="meCone" x1="20" y1="20" x2="20" y2="4" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.55" />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d="M20 20 L10.8 6.9 A16 16 0 0 1 29.2 6.9 Z" fill="url(#meCone)" />
                </svg>
              )}
              <span className="absolute left-1/2 top-1/2 h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/15" />
              <span className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-500 shadow-md" />
            </div>
          </Marker>
        )}

        {properties.map((p) => (
          <Marker
            key={p.id}
            latitude={p.lat}
            longitude={p.lng}
            anchor="bottom"
            onClick={(e) => {
              e.originalEvent.stopPropagation();
              openProperty(p);
            }}
          >
            <Pin color={urgencyOf(p.urgency).pin} />
          </Marker>
        ))}

        {active && (
          <Popup
            latitude={active.lat}
            longitude={active.lng}
            anchor="bottom"
            offset={38}
            maxWidth="340px"
            className="abode-pop"
            closeButton={false}
            onClose={() => setActive(null)}
            closeOnClick={false}
          >
            <div
              className="w-[288px] overflow-hidden rounded-[18px] bg-white text-slate-900 ring-1 ring-black/[0.06]"
              style={{ boxShadow: "0 12px 34px rgba(15,23,42,0.20), 0 2px 6px rgba(15,23,42,0.08)" }}
            >
              {/* ── Header ───────────────────────────────── */}
              <div className="px-4 pb-3 pt-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[15px] font-bold leading-snug tracking-[-0.01em] text-slate-900 line-clamp-2">
                    {active.task ?? active.name}
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

                {/* stat chips */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-semibold tracking-wide"
                    style={{ background: urgencyOf(active.urgency).bg, color: urgencyOf(active.urgency).text }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: urgencyOf(active.urgency).pin }} />
                    {urgencyOf(active.urgency).label}
                  </span>

                  {me ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-600">
                      <Navigation className="h-3.5 w-3.5 text-slate-400" />
                      {formatMiles(milesBetween(me, active))} away
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={requestLocation}
                      className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-[12px] font-semibold text-slate-500 transition hover:text-slate-700"
                    >
                      <Navigation className="h-3.5 w-3.5 text-slate-400" />
                      Enable distance
                    </button>
                  )}
                </div>
              </div>

              {/* ── Detail sections ──────────────────────── */}
              <div className="space-y-2.5 border-t border-slate-100 px-4 py-3">
                <Row
                  icon={<MapPin className="h-4 w-4" />}
                  label="Property"
                  value={active.unit ? `${active.name} · Unit ${active.unit}` : active.name}
                  detail={active.address}
                  accent="#0f172a"
                />
                {active.tenantNote && (
                  <Row
                    icon={<User className="h-4 w-4" />}
                    label="Reported by tenant"
                    value={active.tenantName ?? "Tenant"}
                    detail={active.tenantNote}
                    accent="#0ea5e9"
                  />
                )}
                {active.ownerNote && (
                  <Row
                    icon={<Briefcase className="h-4 w-4" />}
                    label="Note from manager"
                    value={active.ownerName ?? "Manager"}
                    detail={active.ownerNote}
                    accent="#6366f1"
                  />
                )}
              </div>

              {/* ── Action ───────────────────────────────── */}
              {active.taskId && (
                <div className="border-t border-slate-100 p-2.5">
                  <a
                    href={`/jobs/${active.taskId}`}
                    className="flex w-full items-center justify-center rounded-xl bg-slate-900 py-2 text-[13px] font-semibold text-white transition hover:bg-slate-800 active:scale-[0.99]"
                  >
                    View job
                  </a>
                </div>
              )}
            </div>
          </Popup>
        )}
      </Map>

      {/* Recenter on my location */}
      {me && (
        <button
          type="button"
          onClick={recenterOnMe}
          aria-label="Recenter on my location"
          title="Recenter on my location"
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-white/90 text-slate-700 shadow-md backdrop-blur transition hover:bg-white active:scale-95 dark:bg-black/70 dark:text-slate-200"
        >
          <LocateFixed className="h-4 w-4" />
        </button>
      )}

      {/* Legend */}
      <div className="absolute bottom-3 left-3 rounded-lg bg-white/90 p-2 text-xs shadow-md backdrop-blur dark:bg-black/70">
        <div className="mb-1 font-medium tracking-wide opacity-70">Urgency</div>
        <div className="flex flex-col gap-1">
          {(["urgent", "high", "med", "low"] as Urgency[]).map((u) => (
            <div key={u} className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: URGENCY[u].pin }} />
              <span className="tracking-wide">{URGENCY[u].label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
