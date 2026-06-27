import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A lightweight static map thumbnail (Mapbox Static Images API → a plain <img>,
 * no GL instance) for property cards. Renders a graceful placeholder when the
 * property has no coordinates or no Mapbox token is configured.
 */
export function PropertyStaticMap({
  lat,
  lng,
  token,
  zoom = 13,
  className,
  alt = "Property location",
}: {
  lat: number | null;
  lng: number | null;
  token?: string;
  zoom?: number;
  className?: string;
  alt?: string;
}) {
  if (lat == null || lng == null || !token) {
    return (
      <div className={cn("flex items-center justify-center bg-surface-2 text-muted", className)}>
        <MapPin className="h-5 w-5" />
      </div>
    );
  }
  // Brand terracotta pin, anchored on the location, retina (@2x). A square
  // source crops cleanly under object-cover whether the box is tall (desktop
  // side column) or wide (mobile top banner).
  const marker = `pin-s+c0613a(${lng},${lat})`;
  const src = `https://api.mapbox.com/styles/v1/mapbox/streets-v12/static/${marker}/${lng},${lat},${zoom},0/600x600@2x?access_token=${token}`;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" className={cn("h-full w-full object-cover", className)} />
  );
}
