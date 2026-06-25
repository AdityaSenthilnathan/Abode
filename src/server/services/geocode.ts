import "server-only";

/**
 * Mapbox forward-geocoding — turns a free-form address into a single canonical,
 * real-world location (formatted address + coordinates). This is the server-side
 * authority behind property creation: it is what guarantees a property's address
 * actually exists on the map before we store it, so the handyman map can later
 * drop an accurate pin on it. The client autocomplete is only a UX convenience;
 * this re-check is the real gate.
 */

const MAPBOX_FORWARD = "https://api.mapbox.com/search/geocode/v6/forward";

export interface GeocodeResult {
  /** Canonical, fully-qualified address as Mapbox knows it. */
  formattedAddress: string;
  lat: number;
  lng: number;
}

/** The public Mapbox token, or undefined when geocoding isn't configured. */
export function mapboxToken(): string | undefined {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN || undefined;
}

interface MapboxFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    full_address?: string;
    place_formatted?: string;
    name?: string;
    coordinates?: { longitude?: number; latitude?: number };
  };
}

/**
 * Resolve `query` to the single best real-world address match. Returns null when
 * the address can't be found — callers treat that as "this place doesn't exist,
 * don't store it". Also returns null (silently) when no token is configured, so
 * a token-less dev setup keeps working with the legacy free-text behaviour.
 */
export async function geocodeAddress(query: string): Promise<GeocodeResult | null> {
  const token = mapboxToken();
  if (!token || !query.trim()) return null;

  const url = new URL(MAPBOX_FORWARD);
  url.searchParams.set("q", query);
  url.searchParams.set("access_token", token);
  url.searchParams.set("country", "us");
  url.searchParams.set("types", "address");
  url.searchParams.set("limit", "1");

  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  } catch {
    // Network/timeout — treat as unresolvable rather than silently storing junk.
    return null;
  }
  if (!res.ok) return null;

  const data = (await res.json()) as { features?: MapboxFeature[] };
  const f = data.features?.[0];
  if (!f) return null;

  const lng = f.properties?.coordinates?.longitude ?? f.geometry?.coordinates?.[0];
  const lat = f.properties?.coordinates?.latitude ?? f.geometry?.coordinates?.[1];
  if (typeof lat !== "number" || typeof lng !== "number") return null;

  const formattedAddress =
    f.properties?.full_address ?? f.properties?.place_formatted ?? f.properties?.name ?? query.trim();

  return { formattedAddress, lat, lng };
}
